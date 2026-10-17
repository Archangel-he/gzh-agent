import { mkdir, readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

export const dataRoot = path.resolve(process.env.GZH_DATA_DIR || 'data');
export const projectRoot = id => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('无效的项目 ID。');
  return path.join(dataRoot, 'projects', id);
};
export async function writeJson(file, value, secret = false) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: secret ? 0o600 : 0o644 });
  await rename(temp, file);
  if (secret) await chmod(file, 0o600);
}
export async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }

export const defaultSettings = {
  main: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash', apiKey: '' },
  vision: { baseUrl: '', model: '', apiKey: '' },
  image: { baseUrl: '', model: '', apiKey: '' },
};
export async function settings() {
  try { return await readJson(path.join(dataRoot, 'settings.json')); }
  catch (error) { if (error.code === 'ENOENT') return structuredClone(defaultSettings); throw error; }
}
export function publicSettings(config) {
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, { baseUrl: value.baseUrl, model: value.model, hasKey: Boolean(value.apiKey), apiKey: '' }]));
}
export function updateSettings(previous, input) {
  const output = {};
  for (const key of ['main', 'vision', 'image']) {
    const value = input[key] ?? {};
    const baseUrl = String(value.baseUrl ?? previous[key].baseUrl).trim().replace(/\/+$/, '');
    if (baseUrl) {
      const url = new URL(baseUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('模型地址必须是有效的 HTTP(S) API 基础地址。');
    }
    const model = String(value.model ?? previous[key].model).trim();
    if (model.length > 160) throw new Error('模型名称过长。');
    const apiKey = value.clearKey ? '' : (String(value.apiKey ?? '').trim() || previous[key].apiKey);
    if (apiKey.length > 1000 || /[\r\n]/.test(apiKey)) throw new Error('API 密钥格式无效。');
    output[key] = { baseUrl, model, apiKey };
  }
  return output;
}
export async function saveImage(directory, { name, dataUrl, role = 'article' }) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!match) throw new Error('请上传 PNG、JPG 或 WebP 图片。');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('单张图片不能超过 5 MB。');
  const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }).rotate();
  const { data, info } = await image.resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  const id = randomUUID();
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await writeFile(path.join(directory, 'assets', id + '.png'), data);
  return { id, file: id + '.png', name: String(name ?? '配图').slice(0, 120), role: ['article', 'reference', 'document'].includes(role) ? role : 'article', width: info.width, height: info.height, source: 'upload' };
}
