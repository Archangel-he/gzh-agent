import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { brandMacBundle } from '../lib/macos-bundle.mjs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.dirname(root);
const source = path.join(parent, 'deepseek-harness');
const vendor = path.join(parent, 'DeepSeek Harness.app');
const output = path.join(parent, 'Bloop.app');
const stage = path.join(parent, '运行环境', 'Bloop.build.app');
const require = createRequire(path.join(source, 'package.json'));
const { tsImport } = await import(pathToFileURL(require.resolve('tsx/esm/api')));
const { prepareDevelopmentProject } = await tsImport(path.join(source, 'apps/desktop/scripts/development-project.ts'), { parentURL: import.meta.url });
const { DESKTOP_HOST_PROTOCOL_VERSION } = await tsImport(path.join(source, 'apps/desktop/src/host-protocol.ts'), { parentURL: import.meta.url });
const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
const versions = JSON.parse(await readFile(path.join(vendor, 'Contents/Resources/runtime/versions.json'), 'utf8'));

await readFile(path.join(source, 'apps/desktop/lib/main.js'));
await readFile(path.join(source, 'apps/web/dist/index.html'));
const record = JSON.parse(await readFile(path.join(source, '.dsh-build/client-build-environment.json'), 'utf8'));
if (record.environment?.DSH_CLIENT_WORKSPACE_PATH !== root || record.environment?.DSH_CLIENT_BLOOP !== '1' || record.environment?.DSH_CLIENT_TITLE !== 'Bloop') throw new Error('请先使用固定项目目录构建 Harness 源码。');

prepareDevelopmentProject({
  projectDir: path.join(root, 'data/source-runtime'),
  cliDir: path.join(source, 'apps/cli'), hostDir: path.join(source, 'apps/desktop-host'),
  dependencyDir: path.join(source, 'node_modules/.pnpm/node_modules'),
  release: { schemaVersion: 1, version: manifest.version, hostProtocolVersion: DESKTOP_HOST_PROTOCOL_VERSION, nodeVersion: versions.node, pnpmVersion: versions.pnpm },
  target: 'mac-arm64',
});

await mkdir(path.dirname(stage), { recursive: true });
await rm(stage, { recursive: true, force: true });
await cp(vendor, stage, { recursive: true, verbatimSymlinks: true });
// Launch a signed native app entry while retaining the existing source runtime and data paths.
await rm(path.join(stage, 'Contents/Resources/app.asar'));
await rm(path.join(stage, 'Contents/Resources/app.asar.unpacked'), { recursive: true, force: true });
await rm(path.join(stage, 'Contents/Resources/runtime'), { recursive: true, force: true });
await brandMacBundle(stage);
const appDirectory = path.join(stage, 'Contents/Resources/app');
await mkdir(appDirectory, { recursive: true });
await writeFile(path.join(appDirectory, 'package.json'), JSON.stringify({ name: 'Bloop', productName: 'Bloop', version: manifest.version, type: 'module', main: 'main.mjs' }));
await writeFile(path.join(appDirectory, 'main.mjs'), `await import(${JSON.stringify(pathToFileURL(path.join(root, 'scripts/desktop-main.mjs')).href)});\n`);
const sharp = (await import('sharp')).default;
const iconset = path.join(parent, '运行环境/Bloop.iconset');
await mkdir(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) await sharp(path.join(root, 'assets/bloop.svg')).resize(size * scale).png().toFile(path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`));
}
await sharp(path.join(root, 'assets/bloop.svg')).resize(512, 512).png().toFile(path.join(stage, 'Contents/Resources/icon.png'));
execFileSync('/usr/bin/iconutil', ['-c', 'icns', '-o', path.join(stage, 'Contents/Resources/icon.icns'), iconset]);
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', stage], { stdio: 'pipe' });
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', stage], { stdio: 'pipe' });
const backup = output + '.previous';
await rm(backup, { recursive: true, force: true });
try { await rename(output, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await rename(stage, output);
await rm(backup, { recursive: true, force: true });
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', output]);
console.log(`已构建桌面入口：${output}`);
