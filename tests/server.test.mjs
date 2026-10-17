import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

test('local HTTP flow saves, previews and exports an article with embedded images; rejects cross-origin writes', async () => {
  await mkdir('data', { recursive: true });
  const directory = await mkdtemp(path.resolve('data', 'server-test-'));
  process.env.GZH_DATA_DIR = directory;
  const { createServer } = await import('../server.mjs');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, value, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });
  try {
    assert.equal((await fetch(base)).status, 200);
    const saved = await post('/api/settings', { main: { apiKey: 'test-only-key' } });
    assert.equal(saved.status, 200);
    assert.ok(!(await (await fetch(base + '/api/settings')).text()).includes('test-only-key'));
    assert.equal((await post('/api/settings', {}, { Origin: 'https://untrusted.example' })).status, 403);
    const bytes = await sharp({ create: { width: 64, height: 32, channels: 3, background: '#baca9b' } }).png().toBuffer();
    const response = await post('/api/projects', { mode: 'demo', text: '城市散步\n这是一段需要完整保留的活动介绍正文。', images: [{ name: 'sample.png', role: 'article', dataUrl: 'data:image/png;base64,' + bytes.toString('base64') }] });
    assert.equal(response.status, 202);
    const { id } = await response.json();
    let job;
    for (let i = 0; i < 100; i++) { job = await (await fetch(base + '/api/projects/' + id)).json(); if (!['queued', 'running'].includes(job.status)) break; await new Promise(resolve => setTimeout(resolve, 20)); }
    assert.equal(job.status, 'completed', job.error);
    const html = await (await fetch(base + '/files/' + id + '/article.html')).text();
    assert.match(html, /assets\/[a-f0-9-]+\.png/);
    const exported = await (await fetch(base + '/api/projects/' + id + '/export')).text();
    assert.match(exported, /data:image\/png;base64,/);
    assert.match(exported, /这是一段需要完整保留的活动介绍正文/);
    assert.equal((await fetch(base + '/files/' + id + '/job.json')).status, 404);
    assert.equal((await fetch(base + '/files/' + id + '/assets/' + job.assets[0].file)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
