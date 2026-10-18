import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLE_LIMITS, createArticleBudget, registerArticleBudget } from '../lib/article-budget.mjs';

function fixture(active = true) {
  const handlers = new Map(), budget = createArticleBudget(); budget.active = active;
  registerArticleBudget({ on: (name, fn) => handlers.set(name, fn) }, budget, 'root');
  const call = (name, args = {}, id = 'root') => handlers.get('tools/pre-execute')({ name, arguments: args, agent: { session: { id } } }, () => 'allowed');
  return { handlers, budget, call };
}
test('article budgets bound search, pages, visual review and shell download escape; delivery retains reserved calls', async () => {
  const { budget, call } = fixture();
  assert.equal(await call('web_search'), 'allowed');
  assert.equal(await call('web_search'), 'allowed');
  assert.equal((await call('web_search')).kind, 'deny');
  assert.equal((await call('bash', { command: 'curl https://example.com/a.png' })).kind, 'deny');
  assert.equal((await call('pwsh', { command: 'Invoke-WebRequest https://example.com/a.png' })).kind, 'deny');
  for (let n = 0; n < 6; n++) assert.equal(await call('web_fetch'), 'allowed');
  assert.equal((await call('web_fetch')).kind, 'deny');
  budget.submitted = true;
  for (let n = 0; n < 2; n++) {
    assert.equal(await call('read_image'), 'allowed');
    assert.equal(await call(n ? 'pwsh' : 'bash', { command: 'node screenshot.mjs' }), 'allowed');
  }
  assert.equal((await call('read_image')).kind, 'deny');
  assert.equal((await call('bash', { command: 'node screenshot.mjs' })).kind, 'deny');
  assert.equal((await call('pwsh', { command: 'node screenshot.mjs' })).kind, 'deny');
  budget.calls = ARTICLE_LIMITS.calls;
  assert.equal((await call('read_file')).kind, 'deny');
  assert.equal(await call('submit_article'), 'allowed');
  assert.equal(await call('present'), 'allowed');
});
test('material deadline closes all network tools; other tasks and child agents are unaffected', async () => {
  const { budget, call } = fixture(false);
  assert.equal(await call('web_search'), 'allowed');
  assert.equal(budget.searches, 0);
  assert.equal(await call('gzh_prepare_article'), 'allowed');
  budget.materialStarted = Date.now() - ARTICLE_LIMITS.materialMs;
  for (const name of ['web_search', 'web_fetch', 'gzh_download_images']) assert.equal((await call(name)).kind, 'deny');
  const before = budget.calls;
  assert.equal(await call('bash', { command: 'curl https://example.com' }, 'child'), 'allowed');
  assert.equal(budget.calls, before);
});
test('execution deadline cancels underlying work and restores signal; external cancellation is preserved', async () => {
  const { handlers, budget } = fixture();
  budget.materialStarted = Date.now() - ARTICLE_LIMITS.materialMs + 20;
  const upstream = new AbortController();
  const exec = { name: 'web_fetch', signal: upstream.signal, agent: { session: { id: 'root' } } };
  const result = await handlers.get('tools/execute')(exec, async () => {
    await new Promise((_, reject) => exec.signal.addEventListener('abort', () => reject(exec.signal.reason), { once: true }));
  });
  assert.equal(result.isError, true);
  assert.equal(exec.signal, upstream.signal);
  budget.materialStarted = Date.now();
  await assert.rejects(handlers.get('tools/execute')(exec, async () => { upstream.abort(new Error('user stopped')); exec.signal.throwIfAborted(); }), /user stopped/);
  assert.equal(exec.signal, upstream.signal);
});
