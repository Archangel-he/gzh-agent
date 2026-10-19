import { mkdir, readFile, writeFile, open, access } from 'node:fs/promises';
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
  try { await writeFile(path.join(profile, 'cordis.patch.yml'), JSON.stringify(patch, null, 2), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return { home, data, config, vision };
}

export function desktopEnvironment({ home, data, config, vision }, vendorRuntime) {
  /* A host Electron app (or DSH) can export ELECTRON_RUN_AS_NODE=1. Inheriting it
     makes this Electron binary behave like plain Node and reject Chromium flags. */
  const childEnv = { ...process.env, BLOOP_PERFORMANCE: '1', DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1', GZH_DATA_DIR: data, DSH_PERMISSION_MODE: 'danger-full-access',
    DSH_DESKTOP_OPEN_DEVTOOLS: '0',
    DSH_DESKTOP_DSH_DIR: path.join(data, 'source-runtime'),
    DSH_DESKTOP_PRIMARY_RUNTIME_DIR: path.join(vendorRuntime, 'primary-runtime'),
    DSH_DESKTOP_PNPM_ENTRY: path.join(vendorRuntime, 'primary-runtime/dependencies/pnpm/bin/pnpm.mjs'),
    GZH_MAIN_KEY: config.main.apiKey, GZH_VISION_KEY: vision.apiKey, DEEPSEEK_API_KEY: config.main.apiKey };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  return childEnv;
}

export async function startDesktop() {
  const windows = process.platform === 'win32';
  if (process.platform === 'darwin') {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const launch = spawn('/usr/bin/open', ['-a', desktopApp], { stdio: 'inherit', env });
    await new Promise((resolve, reject) => {
      launch.once('error', reject);
      launch.once('exit', code => code === 0 ? resolve() : reject(new Error('无法打开 Bloop.app，请先重新构建桌面应用。')));
    });
    return;
  }
  const source = windows ? path.join(appRoot, 'data', 'harness-source') : path.resolve(appRoot, '..', 'deepseek-harness');
  const sourceApp = path.join(source, 'apps/desktop');
  const buildPaths = windows ? (await import(pathToFileURL(path.join(sourceApp, 'scripts/desktop-build-paths.mjs')))).desktopTargetBuildPaths('win-x64') : undefined;
  const binary = windows ? path.join(buildPaths.electron, 'electron.exe') : path.join(desktopApp, 'Contents', 'MacOS', 'Electron');
  await access(binary);
  const { home, data, config, vision } = await prepareDesktop();
  const log = await open(path.join(data, 'desktop.log'), 'a', 0o600);
  const vendorRuntime = windows ? buildPaths.runtime : path.resolve(appRoot, '..', 'DeepSeek Harness.app/Contents/Resources/runtime');
  const childEnv = desktopEnvironment({ home, data, config, vision }, vendorRuntime);
  const child = spawn(binary, [`--user-data-dir=${path.join(data, 'desktop-user-data')}`, '--force-renderer-accessibility', sourceApp], {
    cwd: appRoot, stdio: ['ignore', log.fd, log.fd],
    env: childEnv,
  });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  await log.close();
  console.log('已启动 Bloop。默认目录与插件已配置，可以直接提问。');
  console.log(`启动日志：${path.join(data, 'desktop.log')}`);
  await new Promise((resolve, reject) => child.once('exit', code => code === 0 ? resolve() : reject(new Error(`桌面应用退出：${code}，请查看启动日志。`))));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDesktop().catch(error => { console.error(error.message); process.exitCode = 1; });
}
