import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { renderDesignAsset } from '../lib/design-assets.mjs';
import { apply } from '../harness-plugin.mjs';
import { writeJson, readJson } from '../lib/json-file.mjs';
import { validateArticle } from '../lib/article.mjs';

test('local design artwork renders bounded PNGs and rejects untrusted SVG inputs', async () => {
  const cover = await renderDesignAsset({ kind: 'cover', title_lines: ['在紫金港', '一湖清水'], color: '#527958' });
  assert.deepEqual(cover, await renderDesignAsset({ kind: 'cover', title_lines: ['在紫金港', '一湖清水'], color: '#527958', font_style: 'serif', title_effect: 'solid' }), 'art effects remain opt-in');
  const rendered = [];
  for (const effect of ['solid', 'outline', 'cutout', 'mixed']) {
    const png = await renderDesignAsset({ kind: 'cover', title_lines: ['在紫金港', '一湖清水'], title_effect: effect, font_style: 'contrast' });
    assert.equal((await sharp(png).metadata()).format, 'png');
    assert.ok(rendered.every(previous => !previous.equals(png)), 'art effects must render different pixels');
    rendered.push(png);
  }
  await assert.rejects(renderDesignAsset({kind: 'cover', title_lines: ['题图'], title_effect: '<script>'}), /艺术字效果无效/);
  const divider = await renderDesignAsset({ kind: 'divider' });
  assert.deepEqual([(await sharp(cover).metadata()).width, (await sharp(cover).metadata()).height], [750, 820]);
  assert.equal((await sharp(divider).metadata()).height, 104);
  await assert.rejects(renderDesignAsset({ kind: 'cover', title_lines: ['题图'], color: 'url(https://example.invalid/)' }), /颜色无效/);
  await assert.rejects(renderDesignAsset({ kind: 'cover', title_lines: ['字'.repeat(15)] }), /每行最多14字/);
  await assert.rejects(renderDesignAsset({ kind: 'cover', title_lines: [] }), /题图需/);
  // Markup is text, never an SVG element or a fetched resource.
  assert.equal((await sharp(await renderDesignAsset({ kind: 'cover', title_lines: ['<svg>&"'] })).metadata()).format, 'png');
});

test('design tool registers real assets without a model, preserves source text and obeys ownership and image limits', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bloop-design-tool-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const text = '这篇原始文章的文字必须完整保留，不能因为增加设计图而被替换。';
  await writeJson(path.join(directory, 'job.json'), { text, assets: [], generateImages: false });
  const tools = new Map();
  await apply({ on() {}, tools: { register(tool) { tools.set(tool.name, tool); } }, subagents: { start() { assert.fail('no image model needed'); } } }, { directory, rootId: 'root', keepBuiltins: true });
  const exec = { agent: { session: { id: 'root' } }, signal: AbortSignal.timeout(5000) };
  const tool = tools.get('gzh_create_design_asset');
  await assert.rejects(tool.execute({ kind: 'divider' }, {...exec, agent: { session: { id: 'child' } }}), /主 Agent/);
  const cover = JSON.parse((await tool.execute({ kind: 'cover', title_lines: ['在紫金港', '一湖清水'] }, exec)).result).asset;
  const divider = JSON.parse((await tool.execute({ kind: 'divider' }, exec)).result).asset;
  const job = await readJson(path.join(directory, 'job.json'));
  assert.equal(job.text, text); assert.equal(job.generateImages, false); assert.equal(job.assets.length, 2);
  assert.equal(cover.source, 'design'); assert.equal(divider.source, 'design');
  assert.equal((await sharp(await readFile(path.join(directory, 'assets', cover.file))).metadata()).format, 'png');
  assert.deepEqual(validateArticle(`<section><p>${text}</p><img src="${cover.src}"><img src="${divider.src}"></section>`, { assets: job.assets, source: text }).errors, []);
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  const files = await readdir(path.join(directory, 'assets'));
  await writeJson(path.join(directory, 'job.json'), { ...job, assets: [...job.assets, ...job.assets, ...job.assets] });
  await assert.rejects(tool.execute({ kind: 'divider' }, exec), /最多六张/);
  assert.deepEqual(await readdir(path.join(directory, 'assets')), files);
});
