import sharp from 'sharp';
import { downloadPublicImage } from './image-download.mjs';

const MAX_BYTES = 5 * 1024 * 1024;
const mimeOf = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function decode(bytes, source) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) throw new Error('生图服务返回的图片无效或超过 5 MB。');
  let metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }).metadata();
  } catch {
    throw new Error('生图服务返回的内容不是有效图片，仅接受 PNG、JPG 或 WebP。');
  }
  if (!mimeOf[metadata.format]) throw new Error(`生图服务返回了不支持的图片格式，仅接受 PNG、JPG 或 WebP（收到 ${metadata.format || '未知'}）。`);
  return { bytes, mime: mimeOf[metadata.format], format: metadata.format, width: metadata.width, height: metadata.height, source };
}

/**
 * Accepts either response shape of OpenAI-compatible images/generations:
 * data[0].b64_json (e.g. DeepInfra) or data[0].url (e.g. Volcengine Ark / Seedream, jpg links).
 * URL downloads go through the bounded public downloader: HTTP(S) only, DNS pinned,
 * private/reserved ranges blocked, 5 MB cap, plus an overall timeout here.
 */
export async function receiveGeneratedImage(payload, { signal, download = downloadPublicImage, timeoutMs = 60_000 } = {}) {
  const item = payload?.data?.[0];
  const base64 = item?.b64_json;
  if (typeof base64 === 'string' && base64.length) {
    if (base64.length > 7_000_000) throw new Error('生图接口返回的 base64 图片超过 5 MB。');
    return decode(Buffer.from(base64, 'base64'), 'b64_json');
  }
  const url = item?.url;
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const bytes = await download(url, signal ? AbortSignal.any([signal, timeout]) : timeout);
    return decode(bytes, 'url');
  }
  throw new Error(`生图接口响应中没有 data[0].b64_json 或 data[0].url；data[0] 实际字段：${JSON.stringify(Object.keys(item || {}))}。`);
}
