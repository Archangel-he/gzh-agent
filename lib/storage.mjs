import { mkdir, readFile, writeFile, realpath, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

export const dataRoot = path.resolve(process.env.GZH_DATA_DIR || 'data');
export const projectRoot = id => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('无效的项目 ID。');
  return path.join(dataRoot, 'projects', id);
};
export { writeJson, readJson } from './json-file.mjs';
import { writeJson, readJson } from './json-file.mjs';

export { defaultSettings, publicSettings, updateSettings } from './model-settings.mjs';
import { defaultSettings } from './model-settings.mjs';
export async function settings() {
  try { return await readJson(path.join(dataRoot, 'settings.json')); }
  catch (error) { if (error.code === 'ENOENT') return structuredClone(defaultSettings); throw error; }
}
export async function saveImage(directory, { name, dataUrl, role = 'article' }) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!match) throw new Error('请上传 PNG、JPG 或 WebP 图片。');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('单张图片不能超过 5 MB。');
  const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }).rotate();
  if (!['png', 'jpeg', 'webp'].includes((await image.metadata()).format)) throw new Error('仅支持实际的 PNG、JPG 或 WebP 图片。');
  const { data, info } = await image.resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  const id = randomUUID();
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await writeFile(path.join(directory, 'assets', id + '.png'), data);
  return { id, file: id + '.png', name: String(name ?? '配图').slice(0, 120), role: ['article', 'reference', 'document'].includes(role) ? role : 'article', width: info.width, height: info.height, source: 'upload' };
}

export async function saveWorkspaceImage(directory, workspace, supplied, options = {}) {
  const root = await realpath(workspace);
  const file = await realpath(path.resolve(workspace, supplied));
  if (!file.startsWith(root + path.sep)) throw new Error('图片路径必须位于当前工作区内；也可以直接拖入聊天。');
  const mime = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' }[path.extname(file).toLowerCase()];
  if (!mime) throw new Error('仅支持 PNG、JPG、WebP 图片。');
  if ((await stat(file)).size > 5 * 1024 * 1024) throw new Error('单张图片不能超过 5 MB。');
  return saveImage(directory, { name: options.name ?? path.basename(file), role: options.role, dataUrl: `data:image/${mime};base64,${(await readFile(file)).toString('base64')}` });
}
