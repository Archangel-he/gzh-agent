import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const source = path.join(root, 'data', 'harness-source');
const require = createRequire(import.meta.url);

function run(command, args, cwd = source, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
}

/* schannel cannot always use the Windows certificate store (SEC_E_NO_CREDENTIALS),
   so Git for Windows' bundled OpenSSL backend is forced. An optional data/proxy.txt
   or HTTPS_PROXY routes the GitHub fetch through a proxy when one is required. */
async function resolveProxy() {
  try {
    const value = (await readFile(path.join(root, 'data', 'proxy.txt'), 'utf8')).trim();
    if (value) return value;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';
}

async function cloneHarness(pin, gitNet) {
  await rm(source, { recursive: true, force: true });
  await mkdir(source, { recursive: true });
  run('git', [...gitNet, 'init']);
  run('git', [...gitNet, 'config', 'core.autocrlf', 'false']);
  run('git', [...gitNet, 'remote', 'add', 'origin', pin.repository]);
  run('git', [...gitNet, 'fetch', '--depth=1', 'origin', pin.commit]);
  run('git', [...gitNet, 'checkout', '--detach', 'FETCH_HEAD']);
}

/** Prepare the Windows development runtime; all private state stays in data/. */
export async function setupWindows() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This launcher requires Windows x64.');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Install Node.js 24 or later.');
  const pin = JSON.parse(await readFile(path.join(root, 'harness.json'), 'utf8'));
  const patchFile = path.join(root, 'patches', 'bloop-harness.patch');
  const patch = await readFile(patchFile);
  const proxy = await resolveProxy();
  const gitNet = ['-c', 'http.sslBackend=openssl', ...(proxy ? ['-c', `http.proxy=${proxy}`, '-c', `https.proxy=${proxy}`] : [])];
  await mkdir(path.dirname(source), { recursive: true });
  const headOf = () => spawnSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' });
  let head = headOf();
  if (head.status !== 0 || head.stdout.trim() !== pin.commit) {
    const status = spawnSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8' });
    const pristine = status.status === 0 && status.stdout.trim() === '';
    const hasGit = await access(path.join(source, '.git')).then(() => true, () => false);
    if (hasGit && !pristine) {
      try {
        run('git', [...gitNet, 'fetch', '--depth=1', 'origin', pin.commit]);
        run('git', [...gitNet, 'checkout', '--detach', 'FETCH_HEAD']);
      } catch {
        throw new Error('data/harness-source has local changes and cannot move to the pinned commit; move that folder away and run the launcher again.');
      }
    } else {
      await cloneHarness(pin, gitNet);
    }
    head = headOf();
  }
  if (head.status !== 0 || head.stdout.trim() !== pin.commit) throw new Error(`Harness checkout does not match harness.json after re-cloning; check network access to ${pin.repository}.`);
  const reverse = spawnSync('git', ['apply', '--reverse', '--check', patchFile], { cwd: source, stdio: 'ignore' });
  if (reverse.status !== 0) run('git', ['apply', '--check', patchFile]);
  if (reverse.status !== 0) run('git', ['apply', patchFile]);

  const pnpm = path.join(path.dirname(require.resolve('pnpm')), 'bin', 'pnpm.cjs');
  const env = { ...process.env, DSH_CLIENT_BLOOP: '1', DSH_CLIENT_TITLE: 'Bloop', DSH_CLIENT_WORKSPACE_PATH: root,
    DSH_DESKTOP_TARGET_PLATFORM: 'win32', DSH_DESKTOP_TARGET_ARCH: 'x64',
    // GitHub release downloads are blocked on some networks; the mirror keeps rebuilds working.
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    ...(proxy ? { HTTPS_PROXY: proxy, https_proxy: proxy, HTTP_PROXY: proxy, http_proxy: proxy } : {}) };
  const fingerprint = createHash('sha256').update(patch).update(root).update(pin.commit).digest('hex');
  const stamp = path.join(root, 'data', 'windows-build.json');
  let previous;
  try { previous = JSON.parse(await readFile(stamp, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous?.fingerprint !== fingerprint) {
    run(process.execPath, [pnpm, 'install', '--frozen-lockfile'], source, env);
    run(process.execPath, [pnpm, 'run', 'build:artifacts'], source, env);
    run(process.execPath, [pnpm, 'run', 'build:check'], source, env);
    run(process.execPath, [pnpm, '--dir', 'apps/desktop', 'run', 'prepare:runtime'], source, env);
  }
  const sourceRequire = createRequire(path.join(source, 'package.json'));
  const { tsImport } = await import(pathToFileURL(sourceRequire.resolve('tsx/esm/api')));
  const { prepareDevelopmentProject } = await tsImport(pathToFileURL(path.join(source, 'apps/desktop/scripts/development-project.ts')).href, { parentURL: import.meta.url });
  const { DESKTOP_HOST_PROTOCOL_VERSION } = await tsImport(pathToFileURL(path.join(source, 'apps/desktop/src/host-protocol.ts')).href, { parentURL: import.meta.url });
  const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  const { desktopTargetBuildPaths } = await import(pathToFileURL(path.join(source, 'apps/desktop/scripts/desktop-build-paths.mjs')));
  const versions = JSON.parse(await readFile(path.join(desktopTargetBuildPaths('win-x64').runtime, 'versions.json'), 'utf8'));
  prepareDevelopmentProject({ projectDir: path.join(root, 'data/source-runtime'), cliDir: path.join(source, 'apps/cli'),
    hostDir: path.join(source, 'apps/desktop-host'), dependencyDir: path.join(source, 'node_modules/.pnpm/node_modules'),
    release: { schemaVersion: 1, version: manifest.version, hostProtocolVersion: DESKTOP_HOST_PROTOCOL_VERSION, nodeVersion: versions.node, pnpmVersion: versions.pnpm }, target: 'win-x64' });
  try { await copyFile(path.join(root, 'settings.example.json'), path.join(root, 'data/settings.json'), 1); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await writeFile(stamp, JSON.stringify({ fingerprint }, null, 2));
  console.log('Bloop Windows runtime is ready. Configure your provider in Settings > Models.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupWindows().catch(error => { console.error(error.message); process.exitCode = 1; });
}
