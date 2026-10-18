import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { articleBody } from './article.mjs';

async function dataSource(directory, asset) {
  if (!/^[a-f0-9-]{36}\.png$/.test(asset.file)) throw new Error('文章素材文件名无效。');
  const bytes = await readFile(path.join(directory, 'assets', asset.file));
  if (!bytes.length) throw new Error('文章引用了空图片。');
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

/** Embed only registered local images; saved HTML no longer needs an assets directory. */
export async function embedArticleImages(html, directory, assets) {
  for (const asset of assets) {
    const reference = `src="assets/${asset.file}"`;
    if (html.includes(reference)) html = html.replaceAll(reference, `src="${await dataSource(directory, asset)}"`);
  }
  return html;
}

/** Restore known image IDs before revalidating or editing saved, embedded HTML. */
export async function restoreArticleImageReferences(html, directory, assets) {
  html = articleBody(html);
  if (!html.includes('src="data:image/png;base64,')) return html;
  for (const asset of assets) html = html.replaceAll(`src="${await dataSource(directory, asset)}"`, `src="asset://${asset.id}"`);
  return html;
}
