import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['198.18.0.0',15],['224.0.0.0',3]]) blocked.addSubnet(ip, prefix);
const globalIPv6 = new BlockList(); globalIPv6.addSubnet('2000::', 3, 'ipv6');
const MAX_BYTES = 5 * 1024 * 1024;

/** Public HTTP(S) images only; DNS is pinned for the connection and rechecked on redirects. */
export async function downloadPublicImage(input, signal, redirects = 0) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port && !['80', '443'].includes(url.port)) throw new Error('仅支持公共 HTTP(S) 图片地址和标准端口。');
  signal.throwIfAborted();
  let cancelLookup;
  const cancelled = new Promise((_, reject) => {
    cancelLookup = () => reject(signal.reason);
    signal.addEventListener('abort', cancelLookup, { once: true });
  });
  let addresses;
  try { addresses = await Promise.race([dns.lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true }), cancelled]); }
  finally { signal.removeEventListener('abort', cancelLookup); }
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(a => a.family === 4 ? blocked.check(a.address) : !globalIPv6.check(a.address, 'ipv6') || /^(2002:|2001:0:)/i.test(a.address))) throw new Error('图片地址不能访问本机、私有网络或保留网络。');
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      signal, agent: false, family: address.family,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Bloop/0.1', Accept: 'image/png,image/jpeg,image/webp', 'Accept-Encoding': 'identity' },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.destroy();
        if (redirects >= 3 || !response.headers.location) return reject(new Error('图片重定向次数过多。'));
        resolve(downloadPublicImage(new URL(response.headers.location, url).href, signal, redirects + 1)); return;
      }
      if (response.statusCode !== 200 || Number(response.headers['content-length']) > MAX_BYTES) {
        response.destroy(); reject(new Error(`图片请求返回 HTTP ${response.statusCode} 或超过5MB。`)); return;
      }
      let size = 0; const chunks = [];
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) response.destroy(new Error('图片超过5MB。'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('error', reject);
  });
}

/** Bounded batch with partial success; no automatic retries. */
export async function downloadImageBatch(urls, directory, signal, download = downloadPublicImage) {
  if (!Array.isArray(urls) || !urls.length || urls.length > 12) throw new Error('每批必须为一至十二个图片候选。');
  await mkdir(directory, { recursive: true });
  let cursor = 0; const images = [], failures = [];
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, async () => {
    while (cursor < urls.length && !signal.aborted) {
      const index = cursor++;
      try {
        const local = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
        const bytes = await download(urls[index], local);
        local.throwIfAborted();
        if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BYTES) throw new Error('图片超过5MB。');
        const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('不是支持的 PNG、JPG 或 WebP 图片。');
        local.throwIfAborted();
        const file = path.join(directory, `${index + 1}.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}`);
        await writeFile(file, bytes);
        images.push({ index: index + 1, file, sourceUrl: urls[index], width: metadata.width, height: metadata.height });
      } catch (error) { failures.push({ index: index + 1, reason: error.message }); }
    }
  }));
  images.sort((a, b) => a.index - b.index);
  let contactSheet;
  if (images.length) {
    contactSheet = path.join(directory, 'contact-sheet.png');
    const thumbnails = await Promise.all(images.map(async (image, n) => ({
      input: await sharp(image.file).resize(240, 170, { fit: 'contain', background: '#ffffff' }).extend({ top: 25, bottom: 0, left: 0, right: 0, background: '#ffffff' }).composite([{ input: Buffer.from(`<svg width="240" height="25"><text x="8" y="18" font-size="16">${image.index}</text></svg>`), top: 0, left: 0 }]).png().toBuffer(),
      left: n % 3 * 240, top: Math.floor(n / 3) * 195,
    })));
    await sharp({ create: { width: 720, height: Math.ceil(images.length / 3) * 195, channels: 3, background: '#ffffff' } }).composite(thumbnails).png().toFile(contactSheet);
  }
  const result = { images, failures, contactSheet, timedOut: signal.aborted, next: '只看联系表筛选，最终最多六张；失败来源不原样重试，预算用尽就使用已有素材并说明缺失。' };
  await writeFile(path.join(directory, 'sources.json'), JSON.stringify(result, null, 2));
  return result;
}
