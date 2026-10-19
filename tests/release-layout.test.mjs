import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceTemplate, bindWorkspace, WORKSPACE_MARKER } from '../lib/release-layout.mjs';

test('portable client paths survive relocation across spaces, Chinese names, quotes and Windows backslashes', () => {
  for (const oldPath of ['/Users/build/项目', 'D:\\a\\gzh-agent\\gzh-agent']) {
    const original = `const fixed = ${JSON.stringify(oldPath)}; const duplicate = ${JSON.stringify(oldPath)};`;
    const template = workspaceTemplate(original, oldPath);
    assert.ok(!template.includes(JSON.stringify(oldPath)));
    assert.equal(template.split(WORKSPACE_MARKER).length, 3);
    for (const newPath of ['/Users/test/全新 Bloop', 'D:\\Users\\Jill\'s PC\\Bloop', '/tmp/Bloop "moved"']) {
      const bound = bindWorkspace(template, newPath);
      assert.equal(Function(bound + 'return fixed;')(), newPath);
      assert.equal(Function(bound + 'return duplicate;')(), newPath);
    }
  }
});
