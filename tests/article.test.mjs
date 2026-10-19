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
test('image design survives validation while defaults and security checks remain active', () => {
  const assets = [{ id: 'photo', file: 'photo.png', role: 'article' }];
  const body = '<section><p>这是一段需要完整保留的原文内容。</p>';
  const result = validateArticle(body + '<img src="asset://photo" style="width:80%;max-width:90%;height:180px;border-radius:16px;margin:8px auto;border:1px solid #ddd;object-fit:cover;object-position:50% 40%;aspect-ratio:4/3;box-shadow:0 4px 12px rgba(0,0,0,.1);opacity:.95;overflow:hidden;"></section>', { assets });
  assert.deepEqual(result.errors, []);
  for (const declaration of ['width:80%', 'max-width:90%', 'height:180px', 'border-radius:16px', 'margin:8px auto', 'border:1px solid #ddd', 'object-fit:cover', 'object-position:50% 40%', 'aspect-ratio:4/3', 'box-shadow:0 4px 12px rgba(0,0,0,.1)', 'opacity:.95', 'overflow:hidden']) assert.ok(result.html.includes(declaration), declaration);
  assert.ok(result.html.lastIndexOf('margin:8px auto') > result.html.lastIndexOf('margin:18px auto'));
  const defaults = validateArticle(body + '<img src="asset://photo"></section>', { assets });
  for (const declaration of ['max-width:100%', 'height:auto', 'display:block', 'margin:18px auto']) assert.ok(defaults.html.includes(declaration));
  assert.ok(validateArticle(body + '<img src="asset://photo" style="position:absolute;"></section>', { assets }).errors.length);
  const unsafe = validateArticle(body + '<img src="asset://photo" style="border-radius:12px;behavior:url(evil);background:url(javascript:evil);" onerror="evil()"></section>', { assets });
  assert.ok(unsafe.errors.length);
  assert.ok(!unsafe.html.includes('onerror'));
  assert.ok(!unsafe.html.includes('javascript:'));
  assert.ok(!unsafe.html.includes('behavior:'));
  assert.ok(unsafe.html.includes('border-radius:12px'));
});
test('coverage tolerates layout splits and merges but still catches dropped text', () => {
  const source = '第一段讲清楚背景与动机，这部分文字必须保留。第二段讨论方法细节，同样不能丢失。';
  const assets = [{ id: 'a', file: 'a.png' }];
  // A source paragraph split around an inserted figure + caption is still covered.
  const split = '<section><p>第一段讲清楚背景与动机，这部分文字必须保留。</p><img src="asset://a" alt="图"><p>图：示意</p><p>第二段讨论方法细节，同样不能丢失。</p></section>';
  assert.deepEqual(validateArticle(split, { source, assets }).errors, []);
  // Both source paragraphs merged into one body paragraph is still covered.
  assert.deepEqual(validateArticle(`<section><p>${source}</p></section>`, { source, assets }).errors, []);
  // A caption interleaved INSIDE a source sentence is still covered (clause tier).
  const interleaved = '<section><p>第一段讲清楚背景与动机，</p><p>图：示意</p><p>这部分文字必须保留。第二段讨论方法细节，同样不能丢失。</p></section>';
  assert.deepEqual(validateArticle(interleaved, { source, assets }).errors, []);
  // Dropping a clause still fails, and the error names the missing paragraph.
  const dropped = '<section><p>第一段讲清楚背景与动机，</p><p>第二段讨论方法细节，同样不能丢失。</p></section>';
  const bad = validateArticle(dropped, { source, assets });
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /未完整保留/);
  assert.match(bad.errors[0], /这部分文字必须保留/);
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

test('short clauses and dates cannot disappear during layout', () => {
  const source = '今天，下雨，明天，放晴，后天，出发。';
  assert.ok(validateArticle('<p>这是一段足够长的其他正文内容。</p>', { source }).errors.some(e => e.includes('未完整保留')));
  assert.ok(validateArticle('<p>研究活动定于开展，欢迎同学报名。</p>', { source: '研究活动定于2026年10月19日开展，欢迎同学报名。' }).errors.some(e => e.includes('未完整保留')));
});
