import { app, dialog } from 'electron';
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { appRoot, prepareDesktop, desktopEnvironment } from './start-desktop.mjs';
import { bindWorkspace } from '../lib/release-layout.mjs';

try {
  const bundle = path.dirname(appRoot);
  const runtime = path.join(bundle, 'runtime');
  const manifest = JSON.parse(await readFile(path.join(appRoot, 'release.json'), 'utf8'));
  for (const entry of manifest.templates) {
    const text = await readFile(path.join(appRoot, entry.template), 'utf8');
    await writeFile(path.join(runtime, entry.path), bindWorkspace(text, appRoot));
  }
  await mkdir(path.join(appRoot, 'data'), { recursive: true });
  try { await copyFile(path.join(appRoot, 'settings.example.json'), path.join(appRoot, 'data/settings.json'), 1); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const prepared = await prepareDesktop();
  Object.assign(process.env, desktopEnvironment(prepared, runtime), { DSH_DESKTOP_DSH_DIR: runtime });
  process.chdir(appRoot);
  app.setName('Bloop');
  app.setPath('userData', path.join(prepared.data, 'desktop-user-data'));
  app.setAppPath(path.join(runtime, 'desktop'));
  app.commandLine.appendSwitch('force-renderer-accessibility');
  await import(pathToFileURL(path.join(runtime, 'desktop/lib/main.js')).href);
} catch (error) {
  console.error(error);
  dialog.showErrorBox('Bloop 启动失败', '请完整解压发布包到可写文件夹，并保留其中的 runtime 和 gzh-agent 文件夹。');
  app.exit(1);
}
