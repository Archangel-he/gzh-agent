import { readFile, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument, DomUtils } from 'htmlparser2';
import { load } from 'js-yaml';
import { route } from './model-route.mjs';
import sanitizeHtml from 'sanitize-html';
import { readJson, writeJson } from './json-file.mjs';
import { defaultSettings, publicSettings, updateSettings } from './model-settings.mjs';
import { commitArticle, importLegacyArticle } from './article-revisions.mjs';
import { documentHtml } from './article.mjs';

const sessionFile = (root, id) => {
  if (typeof id !== 'string' || !id || id.length > 240) throw new Error('无效的对话。');
  return path.join(root, 'data', 'bloop', Buffer.from(id).toString('base64url') + '.json');
};
async function optionalJson(file, fallback) {
  try { return await readJson(file); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
/** Publish actual tool lifecycle facts; no model-generated progress percentages. */
export async function writeUiSession(root, id, update) {
  const folder = sessionFile(root, id);
  if (update.directory) await writeJson(path.join(folder, 'article.json'), { directory: update.directory }, true);
  if (update.stage || update.phase) await writeJson(path.join(folder, 'progress.json'), { stage: update.stage, phase: update.phase, updatedAt: new Date().toISOString() }, true);
  if (update.draftImages) await writeJson(path.join(folder, 'draft.json'), { draftImages: update.draftImages }, true);
}
export async function readUiSession(root, id) {
  const folder = sessionFile(root, id);
  return Object.assign({}, ...await Promise.all(['article', 'progress', 'draft'].map(name => optionalJson(path.join(folder, name + '.json'), {}))));
}

/** Desktop-only article and model operations. Callers supply native clipboard/save dialogs separately. */
export function createDesktopUi(rootPath) {
  let restartRequired = false;
  const root = path.resolve(rootPath);
  const migrations = new Map();
  const readSettings = async () => {
    const config = await optionalJson(path.join(root, 'data', 'settings.json'), structuredClone(defaultSettings));
    try {
      const patch = load(await readFile(path.join(root, 'data/desktop-home/profiles/desktop/cordis.patch.yml'), 'utf8'));
      const model = Array.isArray(patch) ? patch.find(row => row?.id === 'llm-pi-ai')?.config?.providers?.['gzh-main'] : undefined;
      if (model?.baseURL && model.models?.[0]?.id) config.main = {...config.main, baseUrl: model.baseURL, model: model.models[0].id};
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return config;
  };
  async function capabilities() {
    const config = await readSettings();
    return { visionConfigured: Boolean((config.vision.apiKey || config.main.apiKey) && (config.vision.model || config.main.model)),
      imageConfigured: Boolean(config.image.apiKey && config.image.baseUrl && config.image.model), restartRequired };
  }
  async function locate(supplied) {
    if (typeof supplied !== 'string' || supplied.length > 4096) throw new Error('无效的文章路径。');
    const output = await realpath(path.join(root, 'gzh-output'));
    const target = await realpath(path.resolve(root, supplied));
    if (!target.startsWith(output + path.sep)) throw new Error('只能操作本项目生成的文章。');
    const relative = path.relative(output, target).split(path.sep);
    if (!/^[a-f0-9-]{36}$/.test(relative[0] || '') || !['article.html', 'preview.html'].includes(relative.at(-1))) throw new Error('无效的文章文件。');
    if (!(relative.length === 2 || (relative.length === 4 && ['revisions', 'versions'].includes(relative[1]) && /^[\w.-]+$/.test(relative[2])))) throw new Error('无效的文章版本。');
    return { directory: path.join(output, relative[0]), target, version: relative.length === 4 ? relative[2] : undefined };
  }
  async function article(supplied) {
    const found = await locate(supplied);
    for (const name of ['article.html', 'preview.html', 'submission.json', 'job.json']) {
      const file = path.join(found.directory, name);
      if (await realpath(file) !== file) throw new Error('文章文件不能指向其它文件。');
    }
    if (!migrations.has(found.directory)) migrations.set(found.directory,
      importLegacyArticle(found.directory).finally(() => migrations.delete(found.directory)));
    await migrations.get(found.directory);
    const current = await optionalJson(path.join(found.directory, 'current.json'), null);
    if (!current) throw new Error('文章尚未校验完成。');
    const versions = [];
    for (const container of ['revisions', 'versions']) {
      const names = await readdir(path.join(found.directory, container)).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
      for (const name of names.filter(n => container === 'revisions' ? /^v\d{4,}$/.test(n) : /^[\dT_Z.-]+$/.test(n))) {
        const folder = path.join(found.directory, container, name);
        if (await realpath(folder) !== folder) continue;
        for (const name of ['article.html', 'preview.html', 'submission.json']) {
          const file = path.join(folder, name);
          if (await realpath(file) !== file) throw new Error('文章版本不能指向其它文件。');
        }
        const meta = await optionalJson(path.join(folder, 'submission.json'), {});
        versions.push({ version: name, title: meta.title || '', createdAt: meta.createdAt || name,
          preview: path.join(folder, 'preview.html'), article: path.join(folder, 'article.html'), restorable: container === 'revisions' });
      }
    }
    const selected = versions.find(item => item.version === (found.version || current.version));
    if (!selected) throw new Error('没有找到这个版本。');
    const job = await readJson(path.join(found.directory, 'job.json'));
    const meta = await readJson(path.join(path.dirname(selected.preview), 'submission.json'));
    return { directory: found.directory, version: selected.version, currentVersion: current.version,
      title: meta.title || '未命名文章', article: selected.article, preview: selected.preview,
      legacy: !found.version || !selected.restorable, versions: versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      assets: job.assets.map(({ id, name, role, width, height }) => ({ id, name, role, width, height })), warnings: meta.warnings || [] };
  }
  async function exported(supplied) {
    const info = await article(supplied);
    const preview = await readFile(info.preview, 'utf8');
    // Only the article element is copied; generated toolbar scripts stay outside the application clipboard.
    const document = parseDocument(preview);
    const find = nodes => { for (const node of nodes) { if (node.type === 'tag' && node.name === 'article') return node;
      if (node.children) { const match = find(node.children); if (match) return match; } } };
    const node = find(document.children);
    if (!node) throw new Error('没有可复制的文章正文。');
    const html = sanitizeHtml(DomUtils.getInnerHTML(node), { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'section', 'figure', 'figcaption', 'span']),
      allowedAttributes: { '*': ['style'], img: ['src', 'alt', 'width', 'height'], a: ['href'] }, allowedSchemes: ['https', 'http'], allowedSchemesByTag: { img: ['https', 'http', 'data'] }, allowProtocolRelative: false });
    const text = DomUtils.textContent(parseDocument(html.replace(/<\/(?:p|h[1-6]|li|section)>/g, '$&\n'))).trim();
    return { html, text, document: documentHtml(html, info.title), title: info.title };
  }
  return {
    exported,
    async request(operation, args = {}) {
      if (typeof operation !== 'string' || args === null || typeof args !== 'object' || Array.isArray(args)) throw new Error('无效的桌面请求。');
      if (operation === 'capabilities') return { capabilities: await capabilities() };
      if (operation === 'settings' || operation === 'save-settings') {
        let config = await readSettings();
        if (operation === 'save-settings') {
          const next = updateSettings(config, { main: args.main, vision: args.vision, image: args.image });
          const profile = path.join(root, 'data/desktop-home/profiles/desktop/cordis.patch.yml');
          let original;
          try { original = load(await readFile(profile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          if (original !== undefined) {
            if (!Array.isArray(original) || original.some(row => row === null || typeof row !== 'object' || Array.isArray(row))) throw new Error('模型配置格式无效，请先检查桌面配置。');
            const patch = structuredClone(original);
            let adapter = patch.find(row => row.id === 'llm-pi-ai');
            if (!adapter) { adapter = { id: 'llm-pi-ai', config: {} }; patch.push(adapter); }
            const vision = { baseUrl: next.vision.baseUrl || next.main.baseUrl, model: next.vision.model || next.main.model, apiKey: next.vision.apiKey || next.main.apiKey };
            adapter.config = { ...adapter.config, providers: { ...adapter.config?.providers,
              ...(args.main ? {'gzh-main': route(next.main, 'GZH_MAIN_KEY', true)} : {}),
              'gzh-vision': route(vision, 'GZH_VISION_KEY', true) } };
            if (args.main) {
              let defaults = patch.find(row => row.id === 'agent-default-model');
              if (!defaults) { defaults = {id: 'agent-default-model'}; patch.push(defaults); }
              defaults.config = {...defaults.config, provider: 'gzh-main', model: next.main.model};
            }
            await writeJson(profile, patch, true);
          }
          try { await writeJson(path.join(root, 'data/settings.json'), next, true); }
          catch (error) { if (original !== undefined) await writeJson(profile, original, true); throw error; }
          config = next;
          restartRequired = true;
        }
        const view = publicSettings(config);
        return { settings: { main: view.main, vision: view.vision, image: view.image }, capabilities: await capabilities() };
      }
      if (operation === 'draft-images') {
        if (!Array.isArray(args.images) || args.images.length > 6 || args.images.some(image => !image || typeof image.name !== 'string' || image.name.length > 240 || !['article', 'reference', 'document'].includes(image.role) || (image.replaceAssetId !== undefined && !/^[a-f0-9-]{36}$/.test(image.replaceAssetId)))) throw new Error('图片用途无效，每篇最多六张图片。');
        await writeUiSession(root, args.sessionId, { draftImages: args.images.map(({ name, role, replaceAssetId }) => ({ name, role, ...(replaceAssetId ? { replaceAssetId } : {}) })) });
        return { images: args.images };
      }
      if (operation === 'session') {
        const state = await readUiSession(root, args.sessionId);
        let result;
        if (state.directory) {
          try { result = await article(path.join(state.directory, 'preview.html')); }
          catch (error) { if (error.code !== 'ENOENT' && !/尚未校验/.test(error.message)) throw error; }
        }
        return { stage: state.stage || 'thinking', phase: state.phase || 'idle', article: result || null,
          images: state.draftImages || [], capabilities: await capabilities() };
      }
      if (operation === 'article') {
        const result = await article(args.path);
        if (args.sessionId) await writeUiSession(root, args.sessionId, { directory: result.directory });
        return { article: result };
      }
      if (operation === 'restore') {
        if ((await readUiSession(root, args.sessionId)).phase === 'running') throw new Error('任务正在运行，请先停止后再恢复旧版。');
        const info = await article(args.path);
        const revision = info.versions.find(item => item.version === args.version && item.restorable);
        if (!revision) throw new Error('此旧版只能预览，无法安全恢复素材记录。');
        const folder = path.dirname(revision.preview);
        if (await realpath(path.join(folder, 'job.json')) !== path.join(folder, 'job.json')) throw new Error('文章素材记录不能指向其它文件。');
        const job = await readJson(path.join(folder, 'job.json'));
        const result = await commitArticle(info.directory, { html: await readFile(revision.article, 'utf8'), preview: await readFile(revision.preview, 'utf8'), submission: await readJson(path.join(folder, 'submission.json')), job, restoredFrom: revision.version });
        return { article: await article(result.preview) };
      }
      throw new Error('不支持的桌面操作。');
    },
  };
}
