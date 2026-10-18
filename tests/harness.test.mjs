import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { writeJson, readJson, saveImage } from '../lib/storage.mjs';
import { runHarness } from '../lib/harness.mjs';

test('real Harness delegates vision and image planning, then validates an HTML delivery against fixture APIs', { timeout: 60000 }, async () => {
  await mkdir('data', { recursive: true });
  const directory = await mkdtemp(path.resolve('data', 'harness-test-'));
  const pixels = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#a4bf86' } }).png().toBuffer();
  const asset = await saveImage(directory, { name: 'fixture.png', dataUrl: 'data:image/png;base64,' + pixels.toString('base64') });
  const text = '城市散步计划\n\n这个周末一起观察街道细节，记录生活中容易忽略的美。';
  const job = { id: randomUUID(), text, instruction: '保留原文并生成一张配图。', theme: 'editorial', assets: [asset], generateImages: true };
  await writeJson(path.join(directory, 'job.json'), job);
  const seen = [];
  const fixture = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks).toString());
      if (req.url === '/v1/images/generations') {
        seen.push('image-api'); assert.ok(input.prompt);
        res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ data: [{ b64_json: pixels.toString('base64') }] }));
      }
      const names = (input.tools || []).map(t => t.function.name);
      let content, call;
      if (names.includes('submit_article')) {
        const results = input.messages.filter(m => m.role === 'tool');
        if (results.length === 0) { seen.push('main-vision'); call = { name: 'inspect_images', arguments: { focus: '识别画面和文字。' } }; }
        else if (results.length === 1) { seen.push('main-image'); call = { name: 'generate_image', arguments: { brief: '城市散步的绿色简洁插图', alt: '散步插图' } }; }
        else if (results.length === 2) {
          seen.push('main-update');
          call = { name: 'update_article_assets', arguments: { updates: [{ asset_id: asset.id, image_path: path.join(directory, 'assets', asset.file) }] } };
        } else {
          seen.push('main-submit');
          const latest = await readJson(path.join(directory, 'job.json'));
          call = { name: 'submit_article', arguments: { title: '城市散步计划', html: `<section><h1>城市散步计划</h1><p>这个周末一起观察街道细节，记录生活中容易忽略的美。</p>${latest.assets.map(a => `<img src="asset://${a.id}" alt="配图">`).join('')}</section>`, notes: '由测试 API 返回，用于验证真实 Harness 的业务工具与子 Agent 连接。' } };
        }
      } else if (input.messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'))) {
        seen.push('vision-child'); content = '画面为绿色色块，横向构图，无可辨识文字。';
      } else { seen.push('image-child'); content = 'A quiet editorial illustration of a city walk, soft green palette, no text.'; }
      const id = 'fixture-' + randomUUID();
      const delta = call ? { role: 'assistant', tool_calls: [{ index: 0, id: 'call-' + randomUUID(), type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } }] } : { role: 'assistant', content };
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const [value, finish] of [[delta, null], [{}, call ? 'tool_calls' : 'stop']]) res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'fixture-model', choices: [{ index: 0, delta: value, finish_reason: finish }] }) + '\n\n');
      res.end('data: [DONE]\n\n');
    } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: { message: error.message } })); }
  });
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${fixture.address().port}/v1`;
  const config = { main: { baseUrl, model: 'fixture-model', apiKey: 'fixture-key' }, vision: { baseUrl: '', model: '', apiKey: '' }, image: { baseUrl, model: 'fixture-image', apiKey: 'fixture-image-key' } };
  try {
    const result = await runHarness(directory, config, AbortSignal.timeout(45000));
    assert.equal(result.title, '城市散步计划');
    assert.deepEqual(seen, ['main-vision', 'vision-child', 'main-image', 'image-child', 'image-api', 'main-update', 'main-submit']);
    const savedAssets = (await readJson(path.join(directory, 'job.json'))).assets;
    assert.equal(savedAssets.length, 2);
    assert.equal(savedAssets[0].id, asset.id);
    assert.notEqual(savedAssets[0].file, asset.file);
    assert.match(await readFile(path.join(directory, 'article.html'), 'utf8'), /记录生活中容易忽略的美/);
  } finally {
    await new Promise(resolve => fixture.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
