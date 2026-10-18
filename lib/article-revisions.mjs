import { readFile, writeFile, mkdir, rename, readdir, rm, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, writeJson } from './json-file.mjs';
import { embedArticleImages } from './article-images.mjs';
import { articleBody, documentHtml } from './article.mjs';

/** Serialize operations on one article across model tools and desktop actions, including separate processes. */
export async function withArticleLock(directory, action) {
  const lock = path.join(directory, '.article-lock');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let stale = false;
    try {
      const { pid } = await readJson(path.join(lock, 'owner.json'));
      if (!Number.isInteger(pid) || pid <= 0) throw new Error('无效的保存锁。');
      try { process.kill(pid, 0); } catch (cause) { if (cause.code === 'ESRCH') stale = true; else throw cause; }
    } catch (cause) { if (cause.code === 'ENOENT') stale = Date.now() - (await stat(lock)).mtimeMs > 60000; else throw cause; }
    if (!stale) throw new Error('文章正在保存，请稍后重试。');
    await rm(lock, { recursive: true, force: true });
    return withArticleLock(directory, action);
  }
  try { await writeJson(path.join(lock, 'owner.json'), { pid: process.pid }); return await action(); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

/** Store a complete, immutable, self-contained revision; publish the latest pointer last. */
export async function commitArticle(directory, { html, preview, submission, job, restoredFrom }, signal) {
  if (!job || !Array.isArray(job.assets) || job.assets.length > 6 || job.assets.some(asset => !asset || !/^[a-f0-9-]{36}\.png$/.test(asset.file))) throw new Error('文章素材记录无效。');
  return withArticleLock(directory, async () => {
    signal?.throwIfAborted();
    html = documentHtml(await embedArticleImages(articleBody(html), directory, job.assets), submission.title || '公众号文章');
    preview = await embedArticleImages(preview, directory, job.assets);
    const folder = path.join(directory, 'revisions');
    await mkdir(folder, { recursive: true });
    const names = (await readdir(folder)).filter(name => /^v\d{4,}$/.test(name));
    const number = Math.max(0, ...names.map(name => Number(name.slice(1)))) + 1;
    const version = `v${String(number).padStart(4, '0')}`;
    const stage = path.join(folder, '.' + randomUUID());
    await mkdir(stage);
    const metadata = { ...submission, version, createdAt: new Date().toISOString(), ...(restoredFrom ? { restoredFrom } : {}) };
    try {
      await Promise.all([
        writeFile(path.join(stage, 'article.html'), html), writeFile(path.join(stage, 'preview.html'), preview),
        writeJson(path.join(stage, 'submission.json'), metadata), writeJson(path.join(stage, 'job.json'), job),
        mkdir(path.join(stage, 'assets')),
      ]);
      for (const asset of job.assets) await copyFile(path.join(directory, 'assets', asset.file), path.join(stage, 'assets', asset.file));
      signal?.throwIfAborted();
      await rename(stage, path.join(folder, version));
      // Compatibility files remain available; versioned cards never point at these mutable aliases.
      for (const name of ['article.html', 'preview.html', 'submission.json']) {
        const temp = path.join(directory, randomUUID() + '.tmp');
        await copyFile(path.join(folder, version, name), temp);
        await rename(temp, path.join(directory, name));
      }
      if (restoredFrom) await writeJson(path.join(directory, 'job.json'), job);
      await writeJson(path.join(directory, 'current.json'), { version });
      return { ...metadata, article: path.join(folder, version, 'article.html'), preview: path.join(folder, version, 'preview.html') };
    } catch (error) { await rm(stage, { recursive: true, force: true }); throw error; }
  });
}

/** Upgrade legacy successful output once without changing the existing files or their old snapshots. */
export async function importLegacyArticle(directory) {
  try { return await readJson(path.join(directory, 'current.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let html, preview, submission, job;
  try { [html, preview, submission, job] = await Promise.all([
    readFile(path.join(directory, 'article.html'), 'utf8'), readFile(path.join(directory, 'preview.html'), 'utf8'),
    readJson(path.join(directory, 'submission.json')), readJson(path.join(directory, 'job.json')),
  ]); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return commitArticle(directory, { html, preview, submission, job });
}
