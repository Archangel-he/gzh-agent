import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveImageConfig, IMAGE_KEY_REF } from '../lib/image-config.mjs';

const base = { baseUrl: 'https://ark.example/api/v3/', model: 'seedream-flash', apiKey: 'settings-key' };
const storeWithValue = value => ({ resolve: async ref => { assert.equal(ref, IMAGE_KEY_REF); return value === undefined ? undefined : { value, source: 'file' }; } });

test('the machine credential store outranks the settings.json fallback', async () => {
  const resolved = await resolveImageConfig(storeWithValue('own-key'), base);
  assert.equal(resolved.apiKey, 'own-key');
  assert.equal(resolved.source, 'credential-store');
  assert.equal(resolved.configured, true);
});

test('settings.json is the fallback when the store has no key', async () => {
  const resolved = await resolveImageConfig(storeWithValue(undefined), base);
  assert.equal(resolved.apiKey, 'settings-key');
  assert.equal(resolved.source, 'settings');
  assert.equal(resolved.configured, true);
});

test('an empty stored value counts as absent and keeps the fallback', async () => {
  const resolved = await resolveImageConfig(storeWithValue('   '), base);
  assert.equal(resolved.apiKey, 'settings-key');
  assert.equal(resolved.source, 'settings');
});

test('a missing credential seam still resolves from settings.json', async () => {
  const resolved = await resolveImageConfig(undefined, base);
  assert.equal(resolved.apiKey, 'settings-key');
  assert.equal(resolved.source, 'settings');
  assert.equal(resolved.configured, true);
});

test('a throwing credential store degrades to the settings fallback', async () => {
  const resolved = await resolveImageConfig({ resolve: async () => { throw new Error('store offline'); } }, base);
  assert.equal(resolved.apiKey, 'settings-key');
  assert.equal(resolved.source, 'settings');
});

test('configured requires baseUrl, model and a key; baseUrl trailing slash is trimmed', async () => {
  assert.equal((await resolveImageConfig(undefined, { baseUrl: base.baseUrl, model: base.model })).configured, false);
  assert.equal((await resolveImageConfig(undefined, { baseUrl: '', model: 'm', apiKey: 'k' })).configured, false);
  const resolved = await resolveImageConfig(undefined, base);
  assert.equal(resolved.baseUrl, 'https://ark.example/api/v3');
});
