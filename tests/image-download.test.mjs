import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { downloadPublicImage, downloadImageBatch } from '../lib/image-download.mjs';

test('downloader rejects local/credential/non-HTTP URLs before connecting', async () => {
  for (const url of ['http://127.0.0.1/a', 'http://10.0.0.1/a', 'http://[::1]/a', 'http://[::ffff:127.0.0.1]/a', 'file:///tmp/image.png', 'https://user:secret@example.com/a', 'http://example.com:3000/a']) {
    await assert.rejects(downloadPublicImage(url, AbortSignal.timeout(1000)));
  }
});
test('batch uses three concurrent workers, keeps partial success, produces one contact sheet and never retries', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bloop-images-'));
  const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#174c43' } }).png().toBuffer();
  const calls = []; let active = 0, peak = 0;
  try {
    const result = await downloadImageBatch(Array.from({ length: 8 }, (_, n) => `${n}`), dir, AbortSignal.timeout(2000), async url => {
      calls.push(url); peak = Math.max(peak, ++active);
      try {
        await new Promise(resolve => setTimeout(resolve, 2));
        if (url === '2') throw new Error('fixture HTTP 404');
        if (url === '3') return Buffer.from('not an image');
        return png;
      } finally { active--; }
    });
    assert.equal(peak, 3); assert.equal(calls.length, 8);
    assert.equal(result.images.length, 6); assert.equal(result.failures.length, 2);
    assert.deepEqual(result.images.map(x => x.index), [1, 2, 5, 6, 7, 8]);
    const meta = await sharp(result.contactSheet).metadata(); assert.equal(meta.width, 720); assert.equal(meta.height, 390);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'sources.json'))).images.length, 6);
    await assert.rejects(downloadImageBatch(Array(13).fill('x'), dir, new AbortController().signal), /十二/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('deadline cancels outstanding downloads and does not start the remaining queue', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bloop-cancel-'));
  const controller = new AbortController(); const calls = [];
  try {
    const result = await downloadImageBatch(Array(12).fill('fixture'), dir, controller.signal, async (_, signal) => {
      calls.push(1);
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        queueMicrotask(() => controller.abort(new Error('time budget')));
      });
    });
    assert.equal(calls.length, 3); assert.equal(result.timedOut, true); assert.equal(result.images.length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
