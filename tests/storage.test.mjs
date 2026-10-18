import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeJson } from '../lib/storage.mjs';

test('Windows atomic JSON replacement retries short file locks, preserves old data on exhaustion and cleans its temp file', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bloop-json-'));
  const file = path.join(directory, 'job.json');
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const rename = fs.rename; let attempts = 0;
  try {
    await writeJson(file, { version: 1 });
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const lock = Object.assign(new Error('file held by a reader'), { code: 'EPERM' });
    const mocked = t.mock.method(fs, 'rename', async (...args) => {
      if (++attempts < 3) throw lock;
      return rename(...args);
    });
    await writeJson(file, { version: 2 });
    assert.equal(attempts, 3);
    assert.deepEqual(JSON.parse(await fs.readFile(file)), { version: 2 });
    attempts = 0; mocked.mock.mockImplementation(async () => { attempts++; throw lock; });
    await assert.rejects(writeJson(file, { version: 3 }), /file held/);
    assert.equal(attempts, 10);
    assert.deepEqual(JSON.parse(await fs.readFile(file)), { version: 2 });
    assert.deepEqual(await fs.readdir(directory), ['job.json']);
    attempts = 0; Object.defineProperty(process, 'platform', { value: 'darwin' });
    await assert.rejects(writeJson(file, { version: 4 }), /file held/);
    assert.equal(attempts, 1);
  } finally {
    Object.defineProperty(process, 'platform', platform);
    t.mock.restoreAll();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
