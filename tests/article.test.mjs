import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArticle, demoArticle, documentHtml } from '../lib/article.mjs';
import { updateSettings, publicSettings, defaultSettings, saveImage, projectRoot } from '../lib/storage.mjs';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

test('rejects an empty delivery, omitted source text, unknown images and active HTML', () => {
  assert.ok(validateArticle('').errors.length);
  assert.ok(validateArticle('<section>这是一篇不同的文章内容。</section>', { source: '原始正文内容不能在设计时被无故遗漏。' }).errors.length);
  assert.ok(validateArticle('<p>这是一段足够长的正文文字。</p><img src="https://invalid.example/p.png">').errors.length);
  assert.ok(validateArticle('<p>这是一段足够长的正文文字。</p><img src="x" onerror="alert(1)">').errors.length);
  assert.ok(validateArticle('<script>alert(1)</script><p>这是一段足够长的正文文字。</p>').errors.length);
});
test('preserves a valid original article and maps only registered image IDs', () => {
  const source = '这是一段需要完整保留的文章正文内容。';
  const sample = demoArticle('活动标题\n\n' + source, [{ id: 'a', file: 'a.png', name: '配图', role: 'article' }]);
  const result = validateArticle(sample.html, { source, assets: [{ id: 'a', file: 'a.png' }] });
  assert.deepEqual(result.errors, []);
  assert.match(result.html, /src="assets\/a.png"/);
  assert.match(result.html, /style=/);
  assert.ok(!documentHtml(result.html, '<标题>').includes('<title><标题>'));
});
test('settings redact secrets, preserve blank fields and reject credential-bearing URLs', () => {
  const first = updateSettings(defaultSettings, { main: { apiKey: 'test-secret' } });
  assert.equal(publicSettings(first).main.apiKey, '');
  assert.equal(publicSettings(first).main.hasKey, true);
  assert.equal(updateSettings(first, { main: { apiKey: '' } }).main.apiKey, 'test-secret');
  assert.equal(updateSettings(first, { main: { clearKey: true } }).main.apiKey, '');
  assert.throws(() => updateSettings(first, { main: { baseUrl: 'https://user:pass@example.com' } }));
  assert.throws(() => projectRoot('../settings'));
});
test('uploads decode and normalize real pixels rather than trusting the filename', async () => {
  await mkdir(path.join(process.cwd(), 'data'), { recursive: true });
  const directory = await mkdtemp(path.join(process.cwd(), 'data', 'upload-test-'));
  try {
    const bytes = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#175b42' } }).png().toBuffer();
    const asset = await saveImage(directory, { name: '../../secret.png', dataUrl: 'data:image/png;base64,' + bytes.toString('base64') });
    assert.equal(asset.width, 32); assert.equal(asset.height, 16);
    assert.match(asset.file, /^[a-f0-9-]+\.png$/);
    assert.ok((await readFile(path.join(directory, 'assets', asset.file))).length);
    await assert.rejects(saveImage(directory, { dataUrl: 'data:image/png;base64,' + Buffer.from('not a picture').toString('base64') }));
    await assert.rejects(saveImage(directory, { dataUrl: 'data:image/png;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').toString('base64') }), /实际的/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
