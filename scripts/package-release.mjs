import { cp, mkdir, readFile, readdir, rm, writeFile, realpath } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { brandMacBundle } from '../lib/macos-bundle.mjs';
import { workspaceTemplate } from '../lib/release-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mac = process.platform === 'darwin';
if ((!mac && process.platform !== 'win32') || (mac ? process.arch !== 'arm64' : process.arch !== 'x64')) throw new Error('Release targets: macOS arm64 and Windows x64.');
const source = mac ? path.resolve(root, '../deepseek-harness') : path.join(root, 'data/harness-source');
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const destination = path.resolve(root, 'release');
const bundle = path.join(destination, 'Bloop');
const business = path.join(bundle, 'gzh-agent');
const runtime = path.join(bundle, 'runtime');
const { desktopTargetBuildPaths } = await import(pathToFileURL(path.join(source, 'apps/desktop/scripts/desktop-build-paths.mjs')));
const target = desktopTargetBuildPaths(mac ? 'mac-arm64' : 'win-x64');
await mkdir(destination, { recursive: true });
await rm(bundle, { recursive: true, force: true });
await mkdir(business, { recursive: true });
const archive = path.join(destination, 'source.tar');
execFileSync('git', ['archive', '--format=tar', '-o', archive, 'HEAD'], { cwd: root });
execFileSync('tar', ['-xf', archive, '-C', business]);
await rm(archive);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: business, stdio: 'inherit', shell: !mac });
if (install.error) throw install.error;
if (install.status !== 0) throw new Error('Business dependency installation failed.');
let app;
if (mac) {
  const vendor = path.resolve(root, '../DeepSeek Harness.app');
  app = path.join(bundle, 'Bloop.app');
  await cp(vendor, app, { recursive: true, verbatimSymlinks: true });
  const desktopRequire = createRequire(path.join(source, 'apps/desktop/package.json'));
  const asar = desktopRequire(desktopRequire.resolve('@electron/asar', { paths: [path.join(source, 'node_modules/.pnpm/node_modules')] }));
  const unpacked = path.join(destination, 'vendor-extracted');
  await rm(unpacked, { recursive: true, force: true });
  asar.extractAll(path.join(vendor, 'Contents/Resources/app.asar'), unpacked);
  await cp(path.join(unpacked, 'dsh'), runtime, { recursive: true });
  await mkdir(path.join(runtime, 'desktop'), { recursive: true });
  await cp(path.join(unpacked, 'node_modules'), path.join(runtime, 'desktop/node_modules'), { recursive: true });
  // Overlay Bloop's built workspace packages over the same pinned vendor runtime.
  for (const name of await readdir(path.join(runtime, 'node_modules/@deepseek-ai'))) {
    const link = path.join(root, 'data/source-runtime/node_modules/@deepseek-ai', name);
    let location;
    try { location = await realpath(link); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!location.startsWith(source + path.sep)) continue;
    await cp(location, path.join(runtime, 'node_modules/@deepseek-ai', name), { recursive: true,
      filter: file => !['node_modules', '.git', 'src', 'tests'].includes(path.basename(file)) && !/\.(?:map|tsbuildinfo)$/.test(file) });
  }
  await cp(path.join(source, 'apps/web/dist'), path.join(runtime, 'node_modules/@deepseek-ai/dsh-web-frontend/dist'), { recursive: true });
  await cp(path.join(vendor, 'Contents/Resources/runtime/primary-runtime'), path.join(runtime, 'primary-runtime'), { recursive: true, verbatimSymlinks: true });
  await rm(path.join(app, 'Contents/Resources/app.asar'));
  await rm(path.join(app, 'Contents/Resources/app.asar.unpacked'), { recursive: true, force: true });
  await rm(path.join(app, 'Contents/Resources/runtime'), { recursive: true, force: true });
  await brandMacBundle(app);
  await cp(path.resolve(root, '../Bloop.app/Contents/Resources/icon.icns'), path.join(app, 'Contents/Resources/icon.icns'));
  await cp(path.resolve(root, '../Bloop.app/Contents/Resources/icon.png'), path.join(app, 'Contents/Resources/icon.png'));
  for (const key of ['CFBundleShortVersionString', 'CFBundleVersion']) execFileSync('plutil', ['-replace', key, '-string', version, path.join(app, 'Contents/Info.plist')]);
  await rm(unpacked, { recursive: true, force: true });
} else {
  await cp(target.electron, bundle, { recursive: true });
  await cp(target.dsh, runtime, { recursive: true });
  await cp(path.join(target.runtime, 'primary-runtime'), path.join(runtime, 'primary-runtime'), { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(source, 'apps/desktop/package.json'), 'utf8'));
  const dependencies = Object.fromEntries(Object.entries(manifest.dependencies).filter(([, v]) => !v.startsWith('workspace:')));
  await mkdir(path.join(runtime, 'desktop'), { recursive: true });
  await writeFile(path.join(runtime, 'desktop/package.json'), JSON.stringify({ name: 'bloop-desktop-dependencies', private: true, dependencies }));
  const extra = spawnSync('npm.cmd', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: path.join(runtime, 'desktop'), stdio: 'inherit', shell: true });
  if (extra.error) throw extra.error;
  if (extra.status !== 0) throw new Error('Desktop dependency installation failed.');
  await writeFile(path.join(bundle, 'Bloop.cmd'), '@echo off\r\nset ELECTRON_RUN_AS_NODE=\r\nstart "" "%~dp0electron.exe"\r\n');
}
for (const name of ['lib', 'renderer', 'resources']) await cp(path.join(source, 'apps/desktop', name), path.join(runtime, 'desktop', name), { recursive: true, filter: file => !/\.(?:map|tsbuildinfo)$/.test(file) });
await mkdir(path.join(runtime, 'desktop/scripts'), { recursive: true });
await cp(path.join(source, 'apps/desktop/scripts/node-bin'), path.join(runtime, 'desktop/scripts/node-bin'), { recursive: true });
await cp(path.join(source, 'apps/desktop/package.json'), path.join(runtime, 'desktop/package.json'));
const templates = [];
await mkdir(path.join(business, 'release-templates'));
const oldLiteral = JSON.stringify(root);
async function templatePaths(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await templatePaths(file);
    else if (item.isFile() && /\.js$/.test(item.name)) {
      const text = await readFile(file, 'utf8');
      if (!text.includes(oldLiteral)) continue;
      const template = `release-templates/${templates.length}.js.txt`;
      await writeFile(path.join(business, template), workspaceTemplate(text, root));
      await writeFile(file, text.replaceAll(oldLiteral, JSON.stringify('__BLOOP_RELEASE_WORKSPACE__')));
      templates.push({ path: path.relative(runtime, file), template });
    }
  }
}
await templatePaths(path.join(runtime, 'node_modules/@deepseek-ai'));
if (!templates.length) throw new Error('The built single-workspace client contains no relocatable workspace value.');
await writeFile(path.join(business, 'release.json'), JSON.stringify({ version, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), templates }, null, 2));
const resources = mac ? path.join(app, 'Contents/Resources') : path.join(bundle, 'resources');
await rm(path.join(resources, 'app.asar'), { force: true });
await mkdir(path.join(resources, 'app'), { recursive: true });
await writeFile(path.join(resources, 'app/package.json'), JSON.stringify({ name: 'Bloop', productName: 'Bloop', version, type: 'module', main: 'main.mjs' }));
await writeFile(path.join(resources, 'app/main.mjs'), `import path from 'node:path';\nimport {pathToFileURL} from 'node:url';\nawait import(pathToFileURL(path.resolve(process.resourcesPath, ${JSON.stringify(mac ? '../../../gzh-agent/scripts/release-main.mjs' : '../gzh-agent/scripts/release-main.mjs')})).href);\n`);
await writeFile(path.join(bundle, '使用说明.txt'), 'Bloop '+version+'\n\n完整解压到可写文件夹，保留 Bloop.app/运行程序、runtime、gzh-agent 的相对位置。\nMac：双击 Bloop.app；Windows：双击 Bloop.cmd。无需安装 Node、Git 或编译工具。\n首次打开在设置 > 模型填写自己的服务，发布包不包含密钥。\n数据和文章保存在 gzh-agent/data 与 gzh-agent/gzh-output，更新前请备份；不要仅替换这两个目录。\n软件遵循包内 LICENSE 和第三方声明。本包未进行 Apple 公证或 Windows 代码签名。\n');
if (mac) {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app]);
  execFileSync('codesign', ['--verify', '--deep', '--strict', app]);
}
const filename = `Bloop-v${version}-${mac ? 'macOS-arm64' : 'Windows-x64'}-portable.zip`;
const zip = path.join(destination, filename);
await rm(zip, { force: true });
if (mac) execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', bundle, zip]);
else execFileSync('7z', ['a', '-tzip', '-mx=5', zip, 'Bloop'], { cwd: destination, stdio: 'inherit' });
const hash = createHash('sha256').update(await readFile(zip)).digest('hex');
await writeFile(zip + '.sha256', `${hash}  ${filename}\n`);
console.log(JSON.stringify({ zip, sha256: hash, templates: templates.length }));
