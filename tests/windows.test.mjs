import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, source, setupWindows } from '../scripts/setup-windows.mjs';

test('Windows bootstrap dependency resolves to a runnable pinned pnpm entry', async () => {
  const require = createRequire(import.meta.url);
  const pnpm = path.join(path.dirname(require.resolve('pnpm')), 'bin/pnpm.cjs');
  await access(pnpm);
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.devDependencies.pnpm, '11.28.5');
  assert.equal(source, path.join(root, 'data/harness-source'));
});

test('Windows setup refuses another platform before changing files', { skip: process.platform === 'win32' && process.arch === 'x64' }, async () => {
  await assert.rejects(setupWindows(), /Windows x64/);
});
