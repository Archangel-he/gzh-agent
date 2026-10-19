import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { brandMacBundle } from '../lib/macos-bundle.mjs';
import { desktopEnvironment } from '../scripts/start-desktop.mjs';

test('macOS signs the real app entry and gives every helper a distinct Bloop identity', { skip: process.platform !== 'darwin' }, async t => {
  const bundle = await mkdtemp(path.join(os.tmpdir(), 'bloop-identity-'));
  t.after(() => rm(bundle, { recursive: true, force: true }));
  const writePlist = async (file, data) => {
    await writeFile(file, JSON.stringify(data));
    execFileSync('/usr/bin/plutil', ['-convert', 'xml1', file]);
  };
  const readPlist = file => JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' }));
  await mkdir(path.join(bundle, 'Contents/MacOS'), { recursive: true });
  await writeFile(path.join(bundle, 'Contents/MacOS/DeepSeek Harness'), 'native app fixture');
  await writePlist(path.join(bundle, 'Contents/Info.plist'), { ElectronAsarIntegrity: {}, CFBundleURLTypes: [{CFBundleURLName: 'DeepSeek Harness', CFBundleURLSchemes: ['dsh']}] });
  const names = ['DeepSeek Harness Helper', 'DeepSeek Harness Helper (GPU)', 'DeepSeek Harness Helper (Renderer)', 'DeepSeek Harness Helper (Plugin)'];
  for (const name of names) {
    const dir = path.join(bundle, 'Contents/Frameworks', name + '.app', 'Contents');
    await mkdir(path.join(dir, 'MacOS'), { recursive: true });
    await writeFile(path.join(dir, 'MacOS', name), 'helper fixture');
    await writePlist(path.join(dir, 'Info.plist'), { CFBundleIdentifier: 'com.deepseek.dsh.helper', LSUIElement: true });
  }
  await brandMacBundle(bundle);
  const main = readPlist(path.join(bundle, 'Contents/Info.plist'));
  assert.equal(main.CFBundleExecutable, 'Electron');
  assert.equal(main.CFBundleIdentifier, 'local.gzh.design.agent');
  assert.equal(main.CFBundleDisplayName, 'Bloop');
  assert.equal(main.ElectronAsarIntegrity, undefined);
  assert.match(main.NSMicrophoneUsageDescription, /^Bloop/);
  assert.match(main.NSAppleEventsUsageDescription, /^Bloop/);
  assert.deepEqual(main.CFBundleURLTypes[0].CFBundleURLSchemes, ['dsh']);
  assert.equal(await readFile(path.join(bundle, 'Contents/MacOS/Electron'), 'utf8'), 'native app fixture');
  const ids = [];
  for (const name of names) {
    const dir = path.join(bundle, 'Contents/Frameworks', name.replace('DeepSeek Harness', 'Electron') + '.app', 'Contents');
    const info = readPlist(path.join(dir, 'Info.plist'));
    assert.match(info.CFBundleIdentifier, /^local\.gzh\.design\.agent\.helper/);
    assert.match(info.CFBundleDisplayName, /^Bloop Helper/);
    assert.equal(info.LSUIElement, true);
    assert.equal(await readFile(path.join(dir, 'MacOS', info.CFBundleExecutable), 'utf8'), 'helper fixture');
    ids.push(info.CFBundleIdentifier);
  }
  assert.equal(new Set(ids).size, names.length);
});

test('native and command launchers share model routes, data paths and a clean Electron environment', () => {
  const old = process.env.ELECTRON_RUN_AS_NODE;
  try {
    process.env.ELECTRON_RUN_AS_NODE = '1';
    const env = desktopEnvironment({ home: '/fixture/home', data: '/fixture/data', config: { main: { apiKey: 'fixture-main' } }, vision: { apiKey: 'fixture-vision' } }, '/fixture/runtime');
    assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
    assert.equal(env.DSH_HOME, '/fixture/home');
    assert.equal(env.DSH_DESKTOP_DSH_DIR, path.join('/fixture/data', 'source-runtime'));
    assert.equal(env.DSH_DESKTOP_PRIMARY_RUNTIME_DIR, path.join('/fixture/runtime', 'primary-runtime'));
    assert.equal(env.GZH_MAIN_KEY, 'fixture-main');
    assert.equal(env.GZH_VISION_KEY, 'fixture-vision');
  } finally {
    if (old === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
    else process.env.ELECTRON_RUN_AS_NODE = old;
  }
});
