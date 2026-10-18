import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, copyFile, appendFile } from 'node:fs/promises';
import { settings, publicSettings, updateSettings, writeJson, readJson, saveImage, dataRoot, projectRoot } from './lib/storage.mjs';
import { runHarness } from './lib/harness.mjs';
import { demoArticle, documentHtml, validateArticle, themes, articleBody } from './lib/article.mjs';
import { embedArticleImages, restoreArticleImageReferences } from './lib/article-images.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const active = new Map();
const controllers = new Map();
const errorText = error => String(error.message || error).replace(/sk-[A-Za-z0-9_-]+/g, '[已隐藏密钥]').slice(0, 3000);
const json = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) {
  if (!String(req.headers['content-type']).startsWith('application/json')) throw new Error('请求必须使用 JSON。');
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 42 * 1024 * 1024) throw new Error('请求过大，请减少图片。');
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString());
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('无效的请求。');
  return value;
}
async function events(directory) {
  try { return (await readFile(path.join(directory, 'events.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).slice(-80).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function viewJob(id) {
  const directory = projectRoot(id);
  const job = await readJson(path.join(directory, 'job.json'));
  return { ...job, previousHtml: undefined, events: await events(directory) };
}
async function finishJob(id, config) {
  const directory = projectRoot(id), controller = new AbortController();
  controllers.set(id, controller);
  const timeout = setTimeout(() => controller.abort(new Error('任务超过五分钟，请精简输入后重试。')), 300_000);
  let runtime;
  const setStatus = async (status, extra = {}) => { const job = await readJson(path.join(directory, 'job.json')); Object.assign(job, { status, updatedAt: new Date().toISOString() }, extra); await writeJson(path.join(directory, 'job.json'), job); return job; };
  try {
    const job = await setStatus('running');
    await appendFile(path.join(directory, 'events.jsonl'), JSON.stringify({ time: new Date().toISOString(), message: job.mode === 'demo' ? '本地体验模式：使用确定性样例排版，不调用 AI' : '主 Agent：启动真实 DeepSeek Harness' }) + '\n');
    let submission;
    if (job.mode === 'demo') {
      const sample = demoArticle(job.text, job.assets, job.theme);
      const checked = validateArticle(sample.html, { assets: job.assets, source: job.text });
      if (checked.errors.length) throw new Error(checked.errors.join('\n'));
      await writeFile(path.join(directory, 'article.html'), checked.html);
      submission = { title: sample.title, notes: '本地体验模式，仅验证输入、预览、修改和导出。未使用 AI，也未执行视觉识别或生图。', warnings: checked.warnings };
    } else submission = await runHarness(directory, config, controller.signal, value => { runtime = value; });
    controller.signal.throwIfAborted();
    const current = await readJson(path.join(directory, 'job.json'));
    const stored = await restoreArticleImageReferences(await readFile(path.join(directory, 'article.html'), 'utf8'), directory, current.assets);
    const checked = validateArticle(stored, { assets: current.assets, source: current.text });
    if (checked.errors.length) throw new Error(checked.errors.join('\n'));
    const embedded = await embedArticleImages(checked.html, directory, current.assets);
    await writeFile(path.join(directory, 'article.html'), documentHtml(embedded, submission.title));
    await writeFile(path.join(directory, 'preview.html'), documentHtml(embedded, submission.title, { preview: true }));
    await setStatus('completed', { title: submission.title, notes: submission.notes, warnings: [...new Set([...checked.warnings, ...(submission.warnings || [])])] });
  } catch (error) {
    const message = errorText(controller.signal.aborted ? controller.signal.reason || error : error);
    await setStatus(controller.signal.aborted ? 'cancelled' : 'failed', { error: message });
    await appendFile(path.join(directory, 'events.jsonl'), JSON.stringify({ time: new Date().toISOString(), message }) + '\n');
  } finally {
    clearTimeout(timeout);
    controllers.delete(id);
    if (runtime) await runtime.close().catch(() => {});
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const host = req.headers.host;
      if (!/^127\.0\.0\.1:\d+$/.test(host ?? '') && !/^localhost:\d+$/.test(host ?? '')) return json(res, 403, { error: '仅允许本地访问。' });
      if (req.headers.origin && ![`http://${host}`].includes(req.headers.origin)) return json(res, 403, { error: '不允许跨站请求。' });
      const url = new URL(req.url, `http://${host}`), pathname = decodeURIComponent(url.pathname);
      if (req.method === 'GET' && pathname === '/api/settings') return json(res, 200, { config: publicSettings(await settings()), themes, runtime: 'DeepSeek Harness 0.2.0-rc.2', active: active.size });
      if (req.method === 'POST' && pathname === '/api/settings') {
        const updated = updateSettings(await settings(), await body(req));
        await writeJson(path.join(dataRoot, 'settings.json'), updated, true);
        return json(res, 200, { config: publicSettings(updated) });
      }
      if (req.method === 'GET' && pathname === '/api/projects') {
        await mkdir(path.join(dataRoot, 'projects'), { recursive: true });
        const entries = await readdir(path.join(dataRoot, 'projects'));
        const jobs = [];
        for (const id of entries) {
          if (!/^[a-f0-9-]{36}$/.test(id)) continue;
          const job = await readJson(path.join(projectRoot(id), 'job.json'));
          if (['queued', 'running'].includes(job.status) && !active.has(id)) {
            job.status = 'failed'; job.error = '上次服务中断，请重新生成；已有成功版本不受影响。';
            await writeJson(path.join(projectRoot(id), 'job.json'), job);
          }
          jobs.push({ id, title: job.title || '未命名文章', status: job.status, mode: job.mode, createdAt: job.createdAt });
        }
        return json(res, 200, jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30));
      }
      if (req.method === 'POST' && pathname === '/api/projects') {
        if (active.size) return json(res, 409, { error: '初版一次处理一个任务，请等待或取消当前任务。' });
        const input = await body(req), config = await settings();
        const text = String(input.text ?? '').trim(), instruction = String(input.instruction ?? '').trim();
        if (text.length > 16000 || instruction.length > 3000) throw new Error('正文请控制在 16000 字内，设计要求在 3000 字内。');
        if (!['live', 'demo'].includes(input.mode)) throw new Error('请选择真实 Agent 或本地体验模式。');
        if (input.mode === 'live' && !config.main.apiKey) throw new Error('请先配置主模型 API 密钥。');
        const uploads = input.images ?? [];
        if (!Array.isArray(uploads) || uploads.length > 6) throw new Error('最多上传六张图片。');
        if (!text && !uploads.length && !input.previousId) throw new Error('请提供文字或图片。');
        const id = randomUUID(), directory = projectRoot(id);
        await mkdir(path.join(directory, 'assets'), { recursive: true });
        const assets = [], job = { id, text, instruction, mode: input.mode, theme: Object.hasOwn(themes, input.theme) ? input.theme : 'editorial', generateImages: input.generateImages === true, assets, status: 'queued', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), previousId: input.previousId || null };
        if (input.previousId) {
          const previous = await viewJob(input.previousId);
          if (previous.status !== 'completed') throw new Error('只能基于已完成的文章创建新版本。');
          job.previousHtml = await restoreArticleImageReferences(await readFile(path.join(projectRoot(previous.id), 'article.html'), 'utf8'), projectRoot(previous.id), previous.assets);
          if (!text) job.text = previous.text;
          for (const asset of previous.assets) { await copyFile(path.join(projectRoot(previous.id), 'assets', asset.file), path.join(directory, 'assets', asset.file)); assets.push(asset); }
        }
        if (assets.length + uploads.length > 8) throw new Error('当前版本累计素材不能超过八张。');
        for (const image of uploads) assets.push(await saveImage(directory, image));
        await writeJson(path.join(directory, 'job.json'), job);
        const task = finishJob(id, config).catch(error => console.error('任务存储失败：', errorText(error))).finally(() => active.delete(id));
        active.set(id, task);
        return json(res, 202, { id });
      }
      const match = /^\/api\/projects\/([a-f0-9-]{36})(\/cancel|\/export)?$/.exec(pathname);
      if (match && req.method === 'POST' && match[2] === '/cancel') {
        controllers.get(match[1])?.abort(new Error('用户取消了任务。'));
        return json(res, 200, { ok: true });
      }
      if (match && req.method === 'GET' && match[2] === '/export') {
        const job = await viewJob(match[1]);
        if (job.status !== 'completed') throw new Error('文章尚未完成。');
        const html = await embedArticleImages(await readFile(path.join(projectRoot(job.id), 'article.html'), 'utf8'), projectRoot(job.id), job.assets);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'attachment; filename="article.html"' });
        return res.end(documentHtml(articleBody(html), job.title));
      }
      if (match && req.method === 'GET' && !match[2]) return json(res, 200, await viewJob(match[1]));
      const file = /^\/files\/([a-f0-9-]{36})\/(article\.html|preview\.html|assets\/[a-f0-9-]{36}\.png)$/.exec(pathname);
      if (file && req.method === 'GET') {
        const bytes = await readFile(path.join(projectRoot(file[1]), file[2]));
        const image = file[2].endsWith('.png');
        res.setHeader('Content-Type', image ? 'image/png' : 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        if (!image) res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src ${file[2] === 'preview.html' ? "'unsafe-inline'" : "'none'"}; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`);
        return res.end(bytes);
      }
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(pathname)) {
        const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
        res.setHeader('Content-Type', { 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'style.css': 'text/css; charset=utf-8' }[filename]);
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
        return res.end(await readFile(path.join(root, 'public', filename)));
      }
      return json(res, 404, { error: '未找到该资源。' });
    } catch (error) {
      return json(res, error.code === 'ENOENT' ? 404 : 400, { error: errorText(error) });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => console.log(`GZH Agent 已启动：http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(errorText(error)); process.exitCode = 1; });
  async function close() {
    for (const controller of controllers.values()) controller.abort(new Error('服务正在关闭。'));
    server.close();
    await Promise.allSettled([...active.values()]);
  }
  process.on('SIGTERM', () => { void close(); });
  process.on('SIGINT', () => { void close(); });
}
