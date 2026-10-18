import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
const primary = path.join(vendor, 'Contents/Resources/runtime/primary-runtime');
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
// Use the unmodified Electron default-app loader to run the built source application.
await rm(path.join(stage, 'Contents/Resources/app.asar'));
await rm(path.join(stage, 'Contents/Resources/app.asar.unpacked'), { recursive: true, force: true });
await rm(path.join(stage, 'Contents/Resources/runtime'), { recursive: true, force: true });
await rename(path.join(stage, 'Contents/MacOS/DeepSeek Harness'), path.join(stage, 'Contents/MacOS/Electron'));
const frameworks = path.join(stage, 'Contents/Frameworks');
for (const name of await readdir(frameworks)) {
  if (!name.startsWith('DeepSeek Harness Helper') || !name.endsWith('.app')) continue;
  const helper = path.join(frameworks, name.replace('DeepSeek Harness', 'Electron'));
  await rename(path.join(frameworks, name), helper);
  await rename(path.join(helper, 'Contents/MacOS', name.slice(0, -4)), path.join(helper, 'Contents/MacOS', name.replace('DeepSeek Harness', 'Electron').slice(0, -4)));
  execFileSync('/usr/bin/plutil', ['-replace', 'CFBundleExecutable', '-string', name.replace('DeepSeek Harness', 'Electron').slice(0, -4), path.join(helper, 'Contents/Info.plist')]);
}
const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
await writeFile(path.join(stage, 'Contents/MacOS/GzhAgent'), `#!/bin/sh\nset -e\ncd ${quote(root)}\nexec ${quote(path.join(primary, 'dependencies/node/bin/node'))} ${quote(path.join(root, 'scripts/start-desktop.mjs'))}\n`, { mode: 0o755 });
const sharp = (await import('sharp')).default;
const iconset = path.join(parent, '运行环境/Bloop.iconset');
await mkdir(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) await sharp(path.join(root, 'assets/bloop.svg')).resize(size * scale).png().toFile(path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`));
}
await sharp(path.join(root, 'assets/bloop.svg')).resize(512, 512).png().toFile(path.join(stage, 'Contents/Resources/icon.png'));
execFileSync('/usr/bin/iconutil', ['-c', 'icns', '-o', path.join(stage, 'Contents/Resources/icon.icns'), iconset]);
const plist = path.join(stage, 'Contents/Info.plist');
for (const [key, value] of Object.entries({ CFBundleIdentifier: 'local.gzh.design.agent', CFBundleName: 'Bloop', CFBundleDisplayName: 'Bloop', CFBundleExecutable: 'GzhAgent' })) {
  execFileSync('/usr/bin/plutil', ['-replace', key, '-string', value, plist]);
}
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', stage], { stdio: 'pipe' });
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', stage], { stdio: 'pipe' });
const backup = output + '.previous';
await rm(backup, { recursive: true, force: true });
try { await rename(output, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await rename(stage, output);
await rm(backup, { recursive: true, force: true });
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', output]);
console.log(`已构建桌面入口：${output}`);
