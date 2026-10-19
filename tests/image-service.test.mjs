import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { receiveGeneratedImage } from '../lib/image-service.mjs';

const pngBytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#3366cc' } }).png().toBuffer();
const jpegBytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#cc6633' } }).jpeg().toBuffer();

test('accepts b64_json responses', async () => {
  const generated = await receiveGeneratedImage({ data: [{ b64_json: pngBytes.toString('base64') }] });
  assert.equal(generated.source, 'b64_json');
  assert.equal(generated.format, 'png');
  assert.equal(generated.mime, 'image/png');
  assert.equal(generated.width, 64);
  assert.equal(generated.height, 48);
  assert.deepEqual(generated.bytes, pngBytes);
});

test('accepts URL responses (Seedream-style jpg links) via injected downloader', async () => {
  let requested;
  const generated = await receiveGeneratedImage({ data: [{ url: 'https://cdn.example.com/out.jpg' }] }, {
    download: async (url, signal) => { requested = url; assert.ok(signal); return jpegBytes; },
  });
  assert.equal(requested, 'https://cdn.example.com/out.jpg');
  assert.equal(generated.source, 'url');
  assert.equal(generated.format, 'jpeg');
  assert.equal(generated.mime, 'image/jpeg');
  assert.equal(generated.width, 32);
});

test('prefers b64_json when both fields are present', async () => {
  const generated = await receiveGeneratedImage({ data: [{ b64_json: pngBytes.toString('base64'), url: 'https://cdn.example.com/out.jpg' }] }, {
    download: () => { throw new Error('should not download'); },
  });
  assert.equal(generated.source, 'b64_json');
});

test('rejects responses without image data', async () => {
  await assert.rejects(() => receiveGeneratedImage({ data: [{}] }), /b64_json 或 data\[0\]\.url/);
  await assert.rejects(() => receiveGeneratedImage({}), /b64_json 或 data\[0\]\.url/);
  await assert.rejects(() => receiveGeneratedImage({ data: [{ url: 'ftp://example.com/x.png' }] }), /b64_json 或 data\[0\]\.url/);
});

test('rejects oversized and non-image payloads', async () => {
  const huge = 'A'.repeat(7_000_001);
  await assert.rejects(() => receiveGeneratedImage({ data: [{ b64_json: huge }] }), /5 MB/);
  await assert.rejects(() => receiveGeneratedImage({ data: [{ url: 'https://cdn.example.com/x.png' }] }, {
    download: async () => Buffer.alloc(5 * 1024 * 1024 + 1),
  }), /5 MB/);
  await assert.rejects(() => receiveGeneratedImage({ data: [{ url: 'https://cdn.example.com/x.png' }] }, {
    download: async () => Buffer.from('not an image at all'),
  }), /PNG、JPG 或 WebP|无效/);
});
