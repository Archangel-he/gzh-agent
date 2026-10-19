import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_REFERENCES, readDesignReference } from '../lib/design-guidance.mjs';
import { validateArticle } from '../lib/article.mjs';

test('bundled design references resolve independently and reject arbitrary file access', async () => {
  for (const topic of Object.keys(DESIGN_REFERENCES)) {
    const text = await readDesignReference(topic);
    assert.ok(text.length > 100, topic);
  }
  for (const topic of ['../settings.json', 'constructor', '__proto__', '/etc/passwd']) {
    await assert.rejects(readDesignReference(topic), /未知设计参考/);
  }
});

test('new theme and component examples retain their declared styles after the real HTML sanitizer', async () => {
  const assets = [{ id: 'fixture', file: 'fixture.png', role: 'article' }];
  for (const topic of ['editorial', 'warm', 'brief', 'components']) {
    const examples = [...(await readDesignReference(topic)).matchAll(/```html\r?\n([\s\S]*?)```/g)];
    assert.ok(examples.length, topic);
    for (const [, example] of examples) {
      const raw = example.replaceAll('素材ID', 'fixture');
      const result = validateArticle(raw, { assets: raw.includes('asset://') ? assets : [] });
      assert.deepEqual(result.errors, [], topic);
      const originalStyles = [...raw.matchAll(/style="([^"]+)"/g)].map(match => match[1]);
      for (const style of originalStyles) {
        for (const declaration of style.split(';').filter(Boolean)) {
          assert.ok(result.html.includes(declaration), `${topic}: style lost: ${declaration}`);
        }
      }
    }
  }
});
