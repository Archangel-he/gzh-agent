import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { root, source } from './setup-windows.mjs';

if (process.platform !== 'win32') throw new Error('Build the Windows release runtime on Windows.');
const require = createRequire(import.meta.url);
const pnpm = path.join(path.dirname(require.resolve('pnpm')), 'bin/pnpm.cjs');
const { desktopTargetBuildPaths } = await import(pathToFileURL(path.join(source, 'apps/desktop/scripts/desktop-build-paths.mjs')));
const paths = desktopTargetBuildPaths('win-x64');
const env = { ...process.env, DSH_CLIENT_BLOOP: '1', DSH_CLIENT_TITLE: 'Bloop', DSH_CLIENT_WORKSPACE_PATH: root,
  DSH_DESKTOP_TARGET_PLATFORM: 'win32', DSH_DESKTOP_TARGET_ARCH: 'x64', DSH_DESKTOP_UNSIGNED: '1' };
const run = args => {
  const result = spawnSync(process.execPath, [pnpm, ...args], { cwd: source, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Release runtime preparation failed (${result.status}).`);
};
await mkdir(paths.packedDsh, { recursive: true });
run(['pack', '--recursive', '--workspace-concurrency=4', '--filter=@deepseek-ai/dsh...', '--filter=@deepseek-ai/dsh-desktop-host...', '--filter=!@deepseek-ai/node-addon-system-darwin-*', '--filter=!@deepseek-ai/node-addon-system-linux-*', '--pack-destination', paths.packedDsh]);
run(['--dir', 'apps/desktop', 'run', 'prepare:packages', '--from', paths.packedDsh]);
run(['--dir', 'apps/desktop', 'run', 'prepare:dsh']);
