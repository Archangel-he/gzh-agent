import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { commitArticle, withArticleLock } from '../lib/article-revisions.mjs';
import { createDesktopUi, writeUiSession, readUiSession } from '../lib/desktop-ui.mjs';
import { writeJson, readJson } from '../lib/json-file.mjs';
import { defaultSettings } from '../lib/model-settings.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bloop-ui-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'gzh-output', randomUUID());
  await mkdir(directory, { recursive: true });
  const job = { assets: [], text: '正文', instruction: '保留' };
  await writeJson(path.join(directory, 'job.json'), job);
  const submit = title => commitArticle(directory, { html: `<section><p>${title}</p></section>`, preview: `<html><body><div class="toolbar">不要复制工具栏</div><article><section style="color: #123456"><p>${title}</p><script>throw 1</script><img src="data:image/png;base64,AAAA" onerror="bad()"></section></article></body></html>`, submission: { title, warnings: [] }, job });
  return { root, directory, job, submit, ui: createDesktopUi(root) };
}

test('fixed deliveries survive editing, native export excludes active content, and restoring appends a version', async t => {
  const {root, directory, submit, ui} = await fixture(t);
  const first = await submit('第一版');
  const saved = await readFile(first.preview, 'utf8');
  const second = await submit('第二版');
  assert.equal(await readFile(first.preview, 'utf8'), saved);
  const info = (await ui.request('article', {path: second.preview, sessionId: 'session'})).article;
  assert.equal(info.versions.length, 2);
  assert.equal(info.currentVersion, 'v0002');
  const copied = await ui.exported(first.preview);
  assert.match(copied.html, /第一版/);
  assert.match(copied.html, /style="color:\s*#123456"/);
  assert.match(copied.html, /data:image\/png/);
  assert.doesNotMatch(copied.html, /script|onerror|不要复制/);
  await writeUiSession(root, 'session', {phase: 'running', stage: 'vision'});
  await assert.rejects(ui.request('restore', {path: first.preview, version: first.version, sessionId: 'session'}), /任务正在运行/);
  await writeUiSession(root, 'session', {phase: 'completed'});
  const restored = (await ui.request('restore', {path: first.preview, version: first.version, sessionId: 'session'})).article;
  assert.equal(restored.version, 'v0003');
  assert.match(await readFile(path.join(directory, 'article.html'), 'utf8'), /第一版/);
  assert.match(await readFile(second.article, 'utf8'), /第二版/);
  assert.equal(await readFile(first.preview, 'utf8'), saved);
});

test('native operations reject path escapes, invalid image intents, and duplicate writers', async t => {
  const {root, directory, submit, ui} = await fixture(t);
  const first = await submit('正文');
  await assert.rejects(ui.request('article', {path: path.join(root, '../other.html')}));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'bloop-outside-'));
  t.after(() => rm(outside, {recursive: true, force: true}));
  await writeJson(path.join(outside, 'preview.html'), {});
  const link = path.join(root, 'gzh-output', randomUUID());
  await symlink(outside, link, 'dir');
  await assert.rejects(ui.request('article', {path: path.join(link, 'preview.html')}), /只能操作/);
  await assert.rejects(ui.request('draft-images', {sessionId: 's', images: [{name: 'x', role: 'execute'}]}), /图片用途无效/);
  await withArticleLock(directory, async () => assert.rejects(submit('竞争写入'), /文章正在保存/));
  assert.equal((await ui.request('article', {path: first.preview})).article.currentVersion, first.version);
});

test('image choices persist independently of progress; model writes redact keys and preserve unrelated routes', async t => {
  const {root, ui} = await fixture(t);
  await writeJson(path.join(root, 'data/settings.json'), {...defaultSettings, main: {...defaultSettings.main, apiKey: 'fixture-main-secret'}});
  const profile = path.join(root, 'data/desktop-home/profiles/desktop/cordis.patch.yml');
  await writeJson(profile, [{id: 'llm-pi-ai', config: {providers: {'gzh-main': {model: 'custom-main'}, custom: {apiKeyEnv: 'EXAMPLE'}}}}, {id: 'plugin', disabled: true}]);
  await ui.request('draft-images', {sessionId: '../s', images: [{name: 'image.png', role: 'reference'}]});
  await writeUiSession(root, '../s', {phase: 'running', stage: 'vision'});
  assert.equal((await readUiSession(root, '../s')).draftImages[0].role, 'reference');
  const result = await ui.request('save-settings', {vision: {baseUrl: 'https://vision.example/v1', model: 'visual-model', apiKey: 'fixture-vision-secret'}, image: {baseUrl: 'https://image.example/v1', model: 'image-model', apiKey: 'fixture-image-secret'}});
  assert.doesNotMatch(JSON.stringify(result), /fixture-.*secret/);
  assert.equal(result.capabilities.imageConfigured, true);
  assert.equal(result.capabilities.restartRequired, true);
  assert.equal((await readJson(profile))[0].config.providers['gzh-main'].model, 'custom-main');
  assert.equal((await readJson(profile))[0].config.providers['gzh-vision'].models[0].id, 'visual-model');
  assert.equal((await readJson(profile))[1].disabled, true);
  assert.equal((await readJson(path.join(root, 'data/settings.json'))).main.apiKey, 'fixture-main-secret');
  if (process.platform !== 'win32') assert.equal((await stat(path.join(root, 'data/settings.json'))).mode & 0o777, 0o600);
});

test('two legacy cards share one migration and saving the design model updates only its owned routes', async t => {
  const {root, directory, submit, ui} = await fixture(t);
  await submit('升级前文章');
  await rm(path.join(directory, 'current.json'));
  await rm(path.join(directory, 'revisions'), {recursive: true});
  const [left, right] = await Promise.all([1, 2].map(() => ui.request('article', {path: path.join(directory, 'preview.html')})));
  assert.equal(left.article.version, 'v0001');
  assert.equal(right.article.version, 'v0001');
  assert.equal(left.article.versions.length, 1);
  await writeJson(path.join(root, 'data/settings.json'), structuredClone(defaultSettings));
  const profile = path.join(root, 'data/desktop-home/profiles/desktop/cordis.patch.yml');
  await writeJson(profile, [{id: 'llm-pi-ai', config: {providers: {custom: {apiKeyEnv: 'CUSTOM'}}}}, {id: 'user-plugin', disabled: false}]);
  const result = await ui.request('save-settings', {main: {baseUrl: 'https://design.example/v1', model: 'design-new', apiKey: 'fixture-design-secret'}});
  assert.equal(result.settings.main.model, 'design-new');
  assert.doesNotMatch(JSON.stringify(result), /fixture-design-secret/);
  const patch = await readJson(profile);
  assert.equal(patch[0].config.providers['gzh-main'].models[0].id, 'design-new');
  assert.equal(patch[0].config.providers.custom.apiKeyEnv, 'CUSTOM');
  assert.equal(patch.find(item => item.id === 'agent-default-model').config.model, 'design-new');
  assert.equal((await ui.request('settings')).settings.main.model, 'design-new');
});
