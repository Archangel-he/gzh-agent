import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { access, readFile, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { root, source, setupWindows, cloneHarness } from '../scripts/setup-windows.mjs';

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


test('Windows runtime recovery preserves existing files and local commits, including failed downloads', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bloop-recovery-'));
  const upstream = path.join(directory, 'upstream');
  const checkout = path.join(directory, 'checkout');
  const git = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout.trim();
  };
  try {
    await mkdir(upstream);
    git(upstream, 'init');
    await writeFile(path.join(upstream, 'source.txt'), 'pinned source');
    git(upstream, 'add', '.');
    git(upstream, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture');
    const commit = git(upstream, 'rev-parse', 'HEAD');
    const pin = { repository: upstream, commit };
    await mkdir(checkout);
    await writeFile(path.join(checkout, 'keep.txt'), 'private local file');
    await cloneHarness(pin, [], checkout);
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), commit);
    let backups = (await readdir(directory)).filter(name => name.startsWith('checkout.backup-'));
    assert.equal(await readFile(path.join(directory, backups[0], 'keep.txt'), 'utf8'), 'private local file');
    await writeFile(path.join(checkout, 'local.txt'), 'local commit');
    git(checkout, 'add', '.');
    git(checkout, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'local');
    const localCommit = git(checkout, 'rev-parse', 'HEAD');
    await assert.rejects(cloneHarness({ repository: path.join(directory, 'missing'), commit }, [], checkout), /git exited/);
    backups = (await readdir(directory)).filter(name => name.startsWith('checkout.backup-'));
    assert.equal(backups.length, 2);
    const repositories = backups.filter(name => { return spawnSync('git', ['rev-parse', '--git-dir'], { cwd: path.join(directory, name), encoding: 'utf8' }).status === 0; });
    assert.equal(repositories.length, 1);
    assert.equal(git(path.join(directory, repositories[0]), 'rev-parse', 'HEAD'), localCommit);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
