import { mkdir, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

export async function writeJson(file, value, secret = false) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: secret ? 0o600 : 0o644 });
  try {
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temp, file); break; }
      catch (error) {
        // Windows readers and antivirus can briefly hold the destination without delete sharing.
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 9) throw error;
        await delay(50);
      }
    }
  } catch (error) { await rm(temp, { force: true }).catch(() => {}); throw error; }
  if (secret) await chmod(file, 0o600);
}
export async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
