import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prepareDesktop } from '../scripts/start-desktop.mjs';
import { apply } from '../desktop-plugin.mjs';

const bundledNode = fileURLToPath(new URL('../../DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node', import.meta.url));
test('the desktop launcher imports under the app bundled Node without native image dependencies', { skip: process.platform !== 'darwin' || !existsSync(bundledNode) }, () => {
  const result = spawnSync(bundledNode, ['--input-type=module', '--eval', `await import(${JSON.stringify(new URL('../scripts/start-desktop.mjs', import.meta.url).href)})`], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test('desktop setup adds business capabilities without replacing builtin bundles or later plugin settings', async () => {
  await mkdir('data', { recursive: true });
  const root = await mkdtemp(path.resolve('data', 'desktop-config-'));
  try {
    await mkdir(path.join(root, 'data'));
    const config = { main: { baseUrl: 'https://api.deepseek.com/v1', model: 'fixture-model', apiKey: 'fixture-secret' }, vision: {}, image: {} };
    await writeFile(path.join(root, 'data/settings.json'), JSON.stringify(config));
    const result = await prepareDesktop(root);
    const filename = path.join(result.home, 'profiles/desktop/cordis.patch.yml');
    const content = await readFile(filename, 'utf8');
    assert.ok(!content.includes('fixture-secret'));
    assert.ok(!content.includes('bundles'));
    assert.equal(JSON.parse(content).find(p => p.id === 'llm-pi-ai').config.providers['gzh-main'].models[0].input[1], 'image');
    await writeFile(filename, '# user plugin settings\n');
    await prepareDesktop(root);
    assert.equal(await readFile(filename, 'utf8'), '# user plugin settings\n');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a fresh desktop can configure its model in Settings without a shipped API key', async () => {
  await mkdir('data', { recursive: true });
  const root = await mkdtemp(path.resolve('data', 'desktop-empty-'));
  try {
    await mkdir(path.join(root, 'data'));
    await writeFile(path.join(root, 'data/settings.json'), JSON.stringify({ main: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash', apiKey: '' }, vision: {}, image: {} }));
    const result = await prepareDesktop(root);
    const patch = JSON.parse(await readFile(path.join(result.home, 'profiles/desktop/cordis.patch.yml'), 'utf8'));
    assert.ok(!patch.some(entry => entry.id === 'agent-default-model' || entry.id === 'llm-pi-ai'));
    assert.ok(patch.some(entry => entry.insert?.some(plugin => plugin.id === 'gzh-desktop')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('desktop sessions retain builtin tools, ingest chat images, delegate with the new API and preserve successful revisions', async () => {
  await mkdir('data', { recursive: true });
  const directory = await mkdtemp(path.resolve('data', 'desktop-tools-'));
  const handlers = new Map(), tools = new Map([['bash', {}], ['present', {}]]);
  const image = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#174c43' } }).png().toBuffer();
  let activation, workflow;
  const ctx = {
    inject(services, callback) { assert.ok(services.includes('workingDirectory')); return callback(ctx); },
    on(name, fn) { handlers.set(name, [...(handlers.get(name) || []), fn]); },
    tools: { register(definition) { tools.set(definition.name, definition); }, restrict() { assert.fail('desktop must retain builtin tools'); } },
    systemPrompt: { section(section) { assert.equal(typeof section.text, 'string'); workflow = section.text; } },
    workingDirectory: { async ensure() { return directory; } },
    attachments: { async readImage(ref) { return { ref, data: image }; }, async saveImage(ref) { return ref; } },
    subagents: { async startActivation(spec) { activation = spec; return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '绿色色块，无文字。' }] }), async dispose() {} }; } },
  };
  const agent = { ctx, session: { id: 'desktop-fixture' } };
  const emit = async (name, ...args) => { for (const fn of handlers.get(name) || []) await fn(...args); };
  const exec = { agent, signal: AbortSignal.timeout(10000), concludeTurn() { assert.fail('desktop must still be able to present files'); } };
  try {
    await apply(ctx);
    await emit('agent/created', { agent });
    assert.match(workflow, /不需要选择工作区、启用插件或指定技能名称/);
    assert.ok(workflow.includes(await readFile(new URL('../.agents/skills/gzh-design/SKILL.md', import.meta.url), 'utf8')));
    await emit('session/event', agent.session, { type: 'user/message', data: { content: [{ type: 'image', attachment: { name: 'chat.png', mediaType: 'image/png' } }] } });
    const source = '这是一段需要完整保留、用于验证公众号设计交付的原始正文。';
    const prepared = JSON.parse((await tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。' }, exec)).result);
    assert.equal(prepared.assets.length, 1);
    assert.equal(tools.size, 8);
    assert.ok(tools.has('bash') && tools.has('present'));
    await tools.get('inspect_images').execute({ focus: '识别主体' }, exec);
    assert.equal(activation.delivery, 'caller');
    assert.equal(activation.provider, 'spawn');
    assert.ok(activation.request.prompt.some(p => p.type === 'image'));
    const asset = prepared.assets[0];
    for (let turn = 1; turn <= 4; turn++) {
      await emit('session/event', agent.session, { type: 'turn/start', data: { turn } });
      await tools.get('submit_article').execute({ title: '验证文章', html: `<section><p>${source}</p><img src="asset://${asset.id}" alt="测试图"/><p>第 ${turn} 版。</p></section>`, notes: '测试交付' }, exec);
    }
    assert.equal((await readdir(path.join(prepared.directory, 'versions'))).length, 3);
    assert.match(await readFile(path.join(prepared.directory, 'article.html'), 'utf8'), /第 4 版/);
    assert.match(await readFile(path.join(prepared.directory, 'preview.html'), 'utf8'), /src="data:image\/png;base64,/);
    await assert.rejects(tools.get('submit_article').execute({ title: '验证文章', html: '<section><p>被删掉的正文。</p></section>', notes: '' }, exec));
    assert.match(await readFile(path.join(prepared.directory, 'article.html'), 'utf8'), /第 4 版/);
    await emit('session/event', agent.session, { type: 'turn/start', data: { turn: 5 } });
    const oldArticle = await readFile(path.join(prepared.directory, 'article.html'), 'utf8');
    const oldPreview = await readFile(path.join(prepared.directory, 'preview.html'), 'utf8');
    const oldJob = JSON.parse(await readFile(path.join(prepared.directory, 'job.json'), 'utf8'));
    const replacement = path.join(directory, 'new.png');
    await sharp({ create: { width: 60, height: 30, channels: 3, background: '#ffcc00' } }).png().toFile(replacement);
    const update = tools.get('update_article_assets');
    const changed = JSON.parse((await update.execute({ updates: [{ asset_id: asset.id, image_path: replacement }] }, exec)).result);
    assert.equal(changed.assets[0].id, asset.id); assert.notEqual(changed.assets[0].file, asset.file);
    assert.equal(changed.assets[0].width, 60);
    assert.equal(await readFile(path.join(prepared.directory, 'article.html'), 'utf8'), oldArticle);
    assert.equal(await readFile(path.join(prepared.directory, 'preview.html'), 'utf8'), oldPreview);
    assert.ok((await readFile(path.join(prepared.directory, 'assets', oldJob.assets[0].file))).length);
    const jobAfter = await readFile(path.join(prepared.directory, 'job.json'), 'utf8');
    const filesAfter = await readdir(path.join(prepared.directory, 'assets'));
    await assert.rejects(update.execute({ updates: [{ asset_id: asset.id, image_path: replacement }, { image_path: 'missing.png' }] }, exec));
    assert.equal(await readFile(path.join(prepared.directory, 'job.json'), 'utf8'), jobAfter);
    assert.deepEqual(await readdir(path.join(prepared.directory, 'assets')), filesAfter);
    await assert.rejects(update.execute({ updates: [{ asset_id: 'unknown', image_path: replacement }] }, exec));
    await assert.rejects(update.execute({ updates: [{ asset_id: asset.id, image_path: replacement }, { asset_id: asset.id, image_path: replacement }] }, exec));
    await assert.rejects(update.execute({ updates: [{ image_path: replacement }] }, { ...exec, agent: { session: { id: 'child' } } }), /主 Agent/);
    await symlink(path.resolve('assets'), path.join(directory, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(update.execute({ updates: [{ image_path: 'escape/bloop.svg' }] }, exec), /工作区/);
    const appended = JSON.parse((await update.execute({ updates: [{ image_path: replacement, name: '新增' }] }, exec)).result);
    assert.equal(appended.assets.length, 2);
    await tools.get('submit_article').execute({ title: '验证文章', html: `<section><p>${source}</p>${appended.assets.map(a => `<img src="asset://${a.id}" alt="测试图"/>`).join('')}</section>`, notes: '素材更新' }, exec);
    assert.match(await readFile(path.join(prepared.directory, 'article.html'), 'utf8'), new RegExp(changed.assets[0].file));
    assert.equal((await readdir(path.join(prepared.directory, 'versions'))).length, 4);
    const again = JSON.parse((await tools.get('gzh_prepare_article').execute({ text: '不能覆盖', instruction: '' }, exec)).result);
    assert.equal(again.directory, prepared.directory); assert.equal(again.assets.length, 2);
    assert.equal(JSON.parse(await readFile(path.join(prepared.directory, 'job.json'))).text, source);
    // Recreate the plugin as on app restart; durable tool results recover the task.
    handlers.clear();
    agent.session.snapshotEvents = () => [
      { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'gzh_prepare_article', id: 'prepare' }] } } },
      { type: 'tool/result', data: { message: { toolCallId: 'prepare', content: [{ type: 'text', text: JSON.stringify(prepared) }] } } },
    ];
    await apply(ctx); await emit('agent/created', { agent });
    const restored = JSON.parse((await tools.get('gzh_prepare_article').execute({ text: '不覆盖', instruction: '' }, exec)).result);
    assert.equal(restored.directory, prepared.directory); assert.equal(restored.assets.length, 2);
    assert.ok(tools.has('update_article_assets'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
