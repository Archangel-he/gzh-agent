// One-time, per-machine setup for YOUR OWN image-generation service (BYOK).
//
// Each person who runs Bloop pays their own provider account: this writes the
// secret key into the harness credential store ($DSH_HOME/.credentials.yaml,
// private to your OS user, hot-reloaded, never committed to Git) and the
// non-secret address/model into data/settings.json. The key is never echoed.
//
//   npm run setup:image           # set baseUrl / model / apiKey
//   npm run setup:image -- --clear  # remove the stored key from this machine

import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import YAML from 'yaml';
import { IMAGE_KEY_REF } from '../lib/image-config.mjs';

const dataRoot = path.resolve(process.env.GZH_DATA_DIR || 'data');
const desktopHome = path.join(dataRoot, 'desktop-home');
const credentialsFile = path.join(desktopHome, '.credentials.yaml');
const settingsFile = path.join(dataRoot, 'settings.json');

const clear = process.argv.includes('--clear');

/** A Writable that swallows everything, so a secret typed at the prompt is never echoed. */
const muted = () => new Writable({ write(_chunk, _enc, cb) { cb(); } });

function ask(question, { secret = false, validate = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    if (secret) {
      // Print the label on the real stdout, then read the answer silently.
      process.stdout.write(question);
      const rl = readline.createInterface({ input: process.stdin, output: muted(), terminal: false });
      rl.once('line', line => {
        rl.close();
        process.stdout.write('\n');
        const value = String(line ?? '').trim();
        try { validate(value); } catch (error) { reject(error); return; }
        resolve(value);
      });
      rl.once('error', reject);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      const value = String(answer ?? '').trim();
      try { validate(value); } catch (error) { reject(error); return; }
      resolve(value);
    });
  });
}

const validateBaseUrl = value => {
  if (!value) throw new Error('生图服务地址不能为空。');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('生图服务地址必须是有效的 HTTP(S) API 基础地址。');
};
const validateModel = value => {
  if (!value) throw new Error('模型名称不能为空。');
  if (value.length > 160) throw new Error('模型名称过长。');
};
const validateKey = value => {
  if (!value) throw new Error('API 密钥不能为空。');
  if (value.length > 1000 || /[\r\n]/.test(value)) throw new Error('API 密钥格式无效。');
};

async function readCredentialsDoc() {
  await mkdir(desktopHome, { recursive: true });
  try {
    const doc = YAML.parse(await readFile(credentialsFile, 'utf8'));
    return doc && typeof doc === 'object' ? doc : { version: 1 };
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1 };
    throw new Error(`无法解析 ${credentialsFile}：${error.message}`);
  }
}

async function writeCredentialsDoc(doc) {
  if (doc.version === undefined) doc.version = 1;
  await writeFile(credentialsFile, YAML.stringify(doc), { mode: 0o600 });
  await chmod(credentialsFile, 0o600);
}

async function readSettings() {
  try { return JSON.parse(await readFile(settingsFile, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return { main: {}, vision: {}, image: {} };
    throw error;
  }
}

if (clear) {
  const doc = await readCredentialsDoc();
  if (doc.refs && Object.hasOwn(doc.refs, IMAGE_KEY_REF)) {
    delete doc.refs[IMAGE_KEY_REF];
    if (!Object.keys(doc.refs).length) delete doc.refs;
    await writeCredentialsDoc(doc);
    console.log(`已移除本机存储的生图密钥（${IMAGE_KEY_REF}）。data/settings.json 的 image.apiKey 兜底值未改动。`);
  } else {
    console.log('本机凭据库中没有存储的生图密钥，无需移除。');
  }
  process.exit(0);
}

console.log('配置你自己的生图服务（BYOK）。密钥只保存在本机凭据库，绝不回显、不写入 Git。');
console.log(`凭据库文件：${credentialsFile}\n`);

const settings = await readSettings();
const current = settings.image || {};

const baseUrl = await ask(`生图服务地址（当前：${current.baseUrl || '未设置'}）：`, { validate: validateBaseUrl });
const model = await ask(`生图模型名称（当前：${current.model || '未设置'}）：`, { validate: validateModel });
const apiKey = await ask('你的生图服务 API 密钥（输入时不回显）：', { secret: true, validate: validateKey });

// Non-secret address/model live in settings.json (shared by the desktop and web surfaces).
settings.image = { ...current, baseUrl: baseUrl.replace(/\/+$/, ''), model };
await writeFile(settingsFile, JSON.stringify(settings, null, 2), { mode: 0o600 });

// The secret lives only in the per-machine credential store, merged into the existing document.
const doc = await readCredentialsDoc();
doc.refs = { ...(doc.refs || {}), [IMAGE_KEY_REF]: apiKey };
await writeCredentialsDoc(doc);

console.log(`\n已保存：地址 ${settings.image.baseUrl}`);
console.log(`        模型 ${model}`);
console.log(`        密钥 已写入本机凭据库（${apiKey.length} 字符，不显示），引用名 ${IMAGE_KEY_REF}`);
console.log('\n桌面版会自动热加载凭据库，无需重启。可运行 `npm run check:image` 验证真实生图。');
console.log('费用计入你自己的服务商账号；data/settings.json 中的 image.apiKey 仅作为未设置本机密钥时的兜底。');
