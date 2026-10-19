import { mkdir, readFile, writeFile, open, access, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { route } from '../lib/model-route.mjs';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const desktopApp = path.resolve(appRoot, '..', 'Bloop.app');

export async function prepareDesktop(root = appRoot) {
  const data = path.join(root, 'data');
  const config = JSON.parse(await readFile(path.join(data, 'settings.json'), 'utf8'));
  const vision = { baseUrl: config.vision.baseUrl || config.main.baseUrl, model: config.vision.model || config.main.model, apiKey: config.vision.apiKey || config.main.apiKey };
  const home = path.join(data, 'desktop-home');
  const profile = path.join(home, 'profiles', 'desktop');
  await mkdir(profile, { recursive: true });
  const patch = [
    { id: 'session-log-deepseek', disabled: true },
    ...(config.main.apiKey ? [
      { id: 'agent-default-model', config: { provider: 'gzh-main', model: config.main.model } },
      { id: 'llm-pi-ai', config: { providers: { 'gzh-main': route(config.main, 'GZH_MAIN_KEY', true), 'gzh-vision': route(vision, 'GZH_VISION_KEY', true) } } },
    ] : []),
    { id: 'skill-filesystem', config: { customSkillDirs: [path.join(root, '.agents', 'skills')] } },
    { insert: [{ id: 'gzh-desktop', name: path.join(root, 'desktop-plugin.mjs') }] },
  ];
  // Initialize once: later settings and plugin edits belong to the native app.
  const patchPath = path.join(profile, 'cordis.patch.yml');
  try { await writeFile(patchPath, JSON.stringify(patch, null, 2), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  // Repair installs initialized before an API key existed: the routed business
  // providers were skipped then, and the patch is never rewritten afterwards.
  if (config.main.apiKey) {
    const text = await readFile(patchPath, 'utf8');
    if (!text.includes('llm-pi-ai')) {
      const entry = { id: 'llm-pi-ai', config: { providers: { 'gzh-main': route(config.main, 'GZH_MAIN_KEY', true), 'gzh-vision': route(vision, 'GZH_VISION_KEY', true) } } };
      const lines = JSON.stringify(entry, null, 2).split('\n');
      await appendFile(patchPath, '\n- ' + lines[0] + '\n' + lines.slice(1).map(line => '  ' + line).join('\n') + '\n');
    }
  }
  return { home, data, config, vision };
}

export async function startDesktop() {
  const windows = process.platform === 'win32';
  const source = windows ? path.join(appRoot, 'data', 'harness-source') : path.resolve(appRoot, '..', 'deepseek-harness');
  const sourceApp = path.join(source, 'apps/desktop');
  const buildPaths = windows ? (await import(pathToFileURL(path.join(sourceApp, 'scripts/desktop-build-paths.mjs')))).desktopTargetBuildPaths('win-x64') : undefined;
  const binary = windows ? path.join(buildPaths.electron, 'electron.exe') : path.join(desktopApp, 'Contents', 'MacOS', 'Electron');
  await access(binary);
  const { home, data, config, vision } = await prepareDesktop();
  const log = await open(path.join(data, 'desktop.log'), 'a', 0o600);
  const vendorRuntime = windows ? buildPaths.runtime : path.resolve(appRoot, '..', 'DeepSeek Harness.app/Contents/Resources/runtime');
  const baseArgs = [`--user-data-dir=${path.join(data, 'desktop-user-data')}`, '--force-renderer-accessibility', sourceApp];
  const env = { ...process.env, BLOOP_PERFORMANCE: '1', DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1', GZH_DATA_DIR: data,
    DSH_DESKTOP_OPEN_DEVTOOLS: '0',
    DSH_DESKTOP_DSH_DIR: path.join(data, 'source-runtime'),
    DSH_DESKTOP_PRIMARY_RUNTIME_DIR: path.join(vendorRuntime, 'primary-runtime'),
    DSH_DESKTOP_PNPM_ENTRY: path.join(vendorRuntime, 'primary-runtime/dependencies/pnpm/bin/pnpm.mjs'),
    GZH_MAIN_KEY: config.main.apiKey, GZH_VISION_KEY: vision.apiKey, DEEPSEEK_API_KEY: config.main.apiKey };
  // Third-party antivirus or GPU drivers can kill sandboxed Electron at startup (e.g. Windows 0x80000003).
  // Retry with relaxed flags when the window dies within seconds, instead of failing the whole launcher.
  const attempts = [[], ['--no-sandbox'], ['--no-sandbox', '--disable-gpu']];
  let last = { code: 0 };
  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const startedAt = Date.now();
    const child = spawn(binary, [...attempts[attempt], ...baseArgs], { cwd: appRoot, stdio: ['ignore', log.fd, log.fd], env });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    if (attempt === 0) {
      console.log('已启动 Bloop。默认目录与插件已配置，可以直接提问。');
      console.log(`启动日志：${path.join(data, 'desktop.log')}`);
    }
    last = await new Promise(resolve => child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal, quick: Date.now() - startedAt < 60_000 })));
    if (last.code === 0 || !last.quick || attempt === attempts.length - 1) break;
    console.log(`桌面应用在启动阶段异常退出（${last.code}），正以放宽沙箱/GPU 限制的方式重试（第 ${attempt + 1} 次）…`);
  }
  await log.close();
  if (last.code !== 0) throw new Error(`桌面应用退出：${last.code}，请查看启动日志。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDesktop().catch(error => { console.error(error.message); process.exitCode = 1; });
}
