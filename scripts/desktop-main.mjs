import { app, dialog } from 'electron';
import { createWriteStream } from 'node:fs';
import { Console } from 'node:console';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { appRoot, prepareDesktop, desktopEnvironment } from './start-desktop.mjs';

try {
  const prepared = await prepareDesktop();
  const sourceApp = path.resolve(appRoot, '../deepseek-harness/apps/desktop');
  Object.assign(process.env, desktopEnvironment(prepared, path.resolve(appRoot, '../DeepSeek Harness.app/Contents/Resources/runtime')));
  process.chdir(appRoot);
  app.setName('Bloop');
  app.setPath('userData', path.join(prepared.data, 'desktop-user-data'));
  app.setAppPath(sourceApp);
  app.commandLine.appendSwitch('force-renderer-accessibility');
  const log = createWriteStream(path.join(prepared.data, 'desktop.log'), { flags: 'a', mode: 0o600 });
  globalThis.console = new Console({ stdout: log, stderr: log });
  await import(pathToFileURL(path.join(sourceApp, 'lib/main.js')).href);
} catch (error) {
  console.error(error);
  dialog.showErrorBox('Bloop 启动失败', '无法加载桌面运行环境，请查看项目 data/desktop.log。');
  app.exit(1);
}
