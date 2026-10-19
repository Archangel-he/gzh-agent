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
  const result = spawnSync(bundledNode, ['--input-type=module', '--eval', `await import(${JSON.stringify(new URL('../scripts/start-desktop.mjs', import.meta.url).href)}); await import(${JSON.stringify(new URL('../lib/desktop-ui.mjs', import.meta.url).href)})`], { encoding: 'utf8', timeout: 10000 });
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
    const repaired = await readFile(filename, 'utf8');
    assert.ok(repaired.startsWith('# user plugin settings\n'));
    assert.ok(repaired.includes('llm-pi-ai'));
    assert.ok(!repaired.includes('fixture-secret'));
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
    permissionPresets: { set(session, preset) { assert.equal(preset, 'danger-full-access'); assert.equal(session.id, 'desktop-fixture'); } },
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
    // The mandatory questionnaire gates task creation until ask_user_question was called and answered.
    await assert.rejects(tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。' }, exec), /ask_user_question/);
    agent.session.snapshotEvents = () => [
      { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'ask_user_question', id: 'ask-pending' }] } } },
      { type: 'tool/result', data: { message: { toolCallId: 'ask-pending', content: [{ type: 'text', text: '{"pending":true}' }] } } },
    ];
    await assert.rejects(tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。', questionnaire: {} }, exec), /ask_user_question/);
    agent.session.snapshotEvents = () => [
      { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'ask_user_question', id: 'ask-1' }] } } },
      { type: 'tool/result', data: { message: { toolCallId: 'ask-1', content: [{ type: 'text', text: '{"answers":[{"id":"title_font","selected":["思源宋体 24px"]},{"id":"body_font","selected":["思源黑体 16px"]}]}' }] } } },
    ];
    await assert.rejects(tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。' }, exec), /questionnaire/);
    const questionnaire = { title_font: '思源宋体 24px', body_font: '思源黑体 16px', head_image: '使用本轮上传的图片', tail_image: '无', signature: '作者：测试同学', style: '极简风', illustrations: '不需要 AI 配图' };
    await assert.rejects(tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。', questionnaire: { ...questionnaire, signature: ' ' } }, exec), /署名/);
    // Both font items are enforced: dropping the body font (or the title font) is refused.
    await assert.rejects(tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。', questionnaire: { ...questionnaire, body_font: ' ' } }, exec), /正文字体与字号/);
    await assert.rejects(tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。', questionnaire: { ...questionnaire, title_font: '' } }, exec), /标题字体与字号/);
    const prepared = JSON.parse((await tools.get('gzh_prepare_article').execute({ text: source, instruction: '保留原文。', questionnaire }, exec)).result);
    assert.equal(prepared.assets.length, 1);
    assert.equal(tools.size, 11);
    const reference = tools.get('gzh_design_reference');
    assert.match((await reference.execute({ topic: 'index' }, exec)).result, /文章配方/);
    await assert.rejects(tools.get('submit_article').execute({ title: '验证文章', html: `<section><p>${source}</p></section>`, notes: '未审稿' }, exec), /提交前请先调用/);
    await reference.execute({ topic: 'review' }, exec);
    await assert.rejects(reference.execute({ topic: '../settings.json' }, exec), /未知设计参考|must be one of/);
    await assert.rejects(reference.execute({ topic: 'index' }, { ...exec, agent: { session: { id: 'child' } } }), /主 Agent/);
    assert.equal(prepared.questionnaire.body_font, '思源黑体 16px');
    assert.equal(prepared.questionnaire.title_font, '思源宋体 24px');
    assert.equal(JSON.parse(await readFile(path.join(prepared.directory, 'job.json'))).questionnaire.style, '极简风');
    assert.ok(tools.has('bash') && tools.has('present'));
    await tools.get('inspect_images').execute({ focus: '识别主体' }, exec);
    assert.equal(activation.delivery, 'caller');
    assert.equal(activation.provider, 'spawn');
    assert.ok(activation.request.prompt.some(p => p.type === 'image'));
    const asset = prepared.assets[0];
    for (let turn = 1; turn <= 4; turn++) {
      await emit('session/event', agent.session, { type: 'turn/start', data: { turn } });
      await tools.get('submit_article').execute({ title: '验证文章', html: `<section><p>${source}</p><img src="asset://${asset.id}" alt="测试图" style="border-radius:16px;width:80%;margin:8px auto;"/><p>第 ${turn} 版。</p></section>`, notes: '测试交付' }, exec);
    }
    assert.equal((await readdir(path.join(prepared.directory, 'revisions'))).length, 4);
    assert.match(await readFile(path.join(prepared.directory, 'article.html'), 'utf8'), /第 4 版/);
    assert.match(await readFile(path.join(prepared.directory, 'preview.html'), 'utf8'), /src="data:image\/png;base64,/);
    assert.match(await readFile(path.join(prepared.directory, 'preview.html'), 'utf8'), /border-radius:16px/);
    assert.match(await readFile(path.join(prepared.directory, 'article.html'), 'utf8'), /margin:8px auto/);
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
    await emit('session/event', agent.session, { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'image', attachment: { name: 'replacement.png', mediaType: 'image/png' } }] } });
    const chatUpdate = JSON.parse((await update.execute({ updates: [{ asset_id: asset.id, image_index: 1 }] }, exec)).result);
    assert.equal(chatUpdate.assets[0].id, asset.id); assert.equal(chatUpdate.assets[0].width, 40);
    // Runtime snapshots must not overwrite the human's attachment references.
    await emit('session/event', agent.session, { type: 'user/message', data: { source: { kind: 'runtime-context' }, content: [] } });
    await assert.rejects(update.execute({ updates: [{ asset_id: asset.id, image_index: 2 }] }, exec), /编号/);
    await assert.rejects(update.execute({ updates: [{ asset_id: asset.id, image_index: 1, image_path: replacement }] }, exec), /二选一/);
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
    // Cover poster composed from an existing asset: 2.35:1 banner, 1:1 square and the stacked combined sheet.
    await assert.rejects(tools.get('generate_cover').execute({ title: '城市散步计划', brief: '科技风' }, exec), /尚未授权生图/);
    const cover = JSON.parse((await tools.get('generate_cover').execute({ title: '城市散步计划', brief: '极简墨绿大字海报', source_asset_id: asset.id }, exec)).result);
    const wideMeta = await sharp(cover.cover.wide).metadata();
    assert.equal(wideMeta.width, 1024); assert.equal(wideMeta.height, 436);
    const squareMeta = await sharp(cover.cover.square).metadata();
    assert.equal(squareMeta.width, 1024); assert.equal(squareMeta.height, 1024);
    const combinedMeta = await sharp(cover.cover.combined).metadata();
    assert.equal(combinedMeta.width, 1024); assert.equal(combinedMeta.height, 1460);
    assert.ok(cover.cover.combined.endsWith('-combined.png'));
    assert.equal(JSON.parse(await readFile(path.join(prepared.directory, 'job.json'))).cover.mode, 'composed');
    await assert.rejects(tools.get('generate_cover').execute({ title: ' ', brief: '科技风' }, exec), /主标题/);
    const finalSubmission = JSON.parse((await tools.get('submit_article').execute({ title: '验证文章', html: `<section><p>${source}</p>${appended.assets.map(a => `<img src="asset://${a.id}" alt="测试图"/>`).join('')}</section>`, notes: '素材更新' }, exec)).result);
    assert.ok(finalSubmission.cover.combined.endsWith('-combined.png'));
    assert.match(finalSubmission.next, /封面/);
    assert.match(await readFile(path.join(prepared.directory, 'article.html'), 'utf8'), /src="data:image\/png;base64,/);
    assert.ok(!(await readFile(path.join(prepared.directory, 'article.html'), 'utf8')).includes('src="assets/'));
    assert.equal((await readdir(path.join(prepared.directory, 'revisions'))).length, 5);
    const again = JSON.parse((await tools.get('gzh_prepare_article').execute({ text: '不能覆盖', instruction: '' }, exec)).result);
    assert.equal(again.directory, prepared.directory); assert.equal(again.assets.length, 2);
    assert.equal(again.previous_design_notes, '素材更新');
    assert.ok(!again.previous_html.includes('base64,'));
    assert.ok(again.previous_html.includes(`asset://${asset.id}`));
    assert.equal(JSON.parse(await readFile(path.join(prepared.directory, 'job.json'))).text, source);
    // Recreate the plugin as on app restart; durable tool results recover the task.
    handlers.clear();
    agent.session.snapshotEvents = () => [
      { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'gzh_prepare_article', id: 'prepare' }] } } },
      { type: 'tool/result', data: { message: { toolCallId: 'prepare', content: [{ type: 'text', text: JSON.stringify(prepared) }] } } },
    ];
    await apply(ctx); await emit('agent/created', { agent });
    await emit('session/event', agent.session, { type: 'turn/start', data: { turn: 6 } });
    const gate = handlers.get('tools/pre-execute')[0];
    for (let n = 0; n < 2; n++) assert.equal(await gate({ name: 'web_search', agent }, () => 'allowed'), 'allowed');
    assert.equal((await gate({ name: 'web_search', agent }, () => 'allowed')).kind, 'deny');
    const restored = JSON.parse((await tools.get('gzh_prepare_article').execute({ text: '不覆盖', instruction: '' }, exec)).result);
    assert.equal(restored.directory, prepared.directory); assert.equal(restored.assets.length, 2);
    assert.ok(tools.has('update_article_assets'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the desktop plugin exposes live image-service fields without ever holding the key', async () => {
  const { Config, imageSettingsOverride, liveImageConfig } = await import('../desktop-plugin.mjs');
  const { resolveImageConfig } = await import('../lib/image-config.mjs');
  // The Settings page projects only volatile fields, so both must be live.
  assert.equal(Config.dict.imageBaseUrl.meta.volatile, true);
  assert.equal(Config.dict.imageModel.meta.volatile, true);
  // A secret in Config would be persisted in the profile patch: the key stays in the credential store.
  assert.equal(Config.dict.imageApiKey, undefined);
  const parsed = Config({ imageBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', imageModel: 'seedream-flash' });
  assert.equal(parsed.imageBaseUrl.get(), 'https://ark.cn-beijing.volces.com/api/v3');
  // An empty Settings field falls back to data/settings.json; a filled one wins.
  const fallback = { baseUrl: 'https://from-settings/v1', model: 'settings-model', apiKey: 'settings-key' };
  assert.deepEqual(imageSettingsOverride(fallback, Config({})), fallback);
  assert.equal(imageSettingsOverride(fallback, parsed).baseUrl, 'https://ark.cn-beijing.volces.com/api/v3');
  assert.equal(imageSettingsOverride(fallback, undefined).model, 'settings-model');
  // The endpoint is read per access, so a value saved mid-task reaches the next image.
  const live = liveImageConfig(fallback, parsed);
  assert.equal(live.model, 'seedream-flash');
  parsed.imageModel = { get: () => 'seedream-pro' };
  assert.equal(live.model, 'seedream-pro');
  assert.equal(live.apiKey, 'settings-key');
  // Only the key reference is stored here, so baseUrl/model fall through to `live`.
  const keyOnly = { resolve: async (ref) => (ref === 'GZH_IMAGE_KEY' ? { value: 'own-key' } : undefined) };
  const resolved = await resolveImageConfig(keyOnly, live);
  assert.deepEqual({ baseUrl: resolved.baseUrl, model: resolved.model, source: resolved.source, configured: resolved.configured },
    { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'seedream-pro', source: 'credential-store', configured: true });
  assert.equal(resolved.apiKey, 'own-key');
  // When the endpoint references are stored too, they outrank the settings block.
  const full = { resolve: async (ref) => ({
    GZH_IMAGE_BASEURL: { value: 'https://from-store/v1/' },
    GZH_IMAGE_MODEL: { value: 'store-model' },
    GZH_IMAGE_KEY: { value: 'own-key' },
  }[ref]) };
  const overridden = await resolveImageConfig(full, live);
  assert.deepEqual({ baseUrl: overridden.baseUrl, model: overridden.model, source: overridden.source },
    { baseUrl: 'https://from-store/v1', model: 'store-model', source: 'credential-store' });
});
