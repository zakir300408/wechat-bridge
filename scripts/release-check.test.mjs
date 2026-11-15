import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFile, inspectPackage } from './release-check.mjs';
test('publication checks reject private links, secret files and unintended artifacts without echoing values', () => {
  const privateLink = 'https://example.test/c/' + 'a'.repeat(32) + '/' + 'b'.repeat(43) + '/mcp';
  assert.ok(inspectFile('notes.md', privateLink).includes('private capability URL'));
  for (const name of [
    'reports/account.md',
    'settings.json',
    'profile.dpapi.pending',
    'companion/Companion.exe',
    'gateway/wrangler.local.jsonc',
  ])
    assert.ok(inspectFile(name, '').length);
  const credential = 'npm' + '_' + 'x'.repeat(40);
  assert.ok(inspectFile('notes.md', credential).includes('credential/key material'));
  assert.ok(!inspectFile('notes.md', credential).join('').includes(credential));
  assert.equal(inspectFile('docs/SETUP.md', 'Use the private link shown locally.').length, 0);
  assert.ok(inspectPackage(['package.json', 'settings.json']).length);
  assert.equal(
    inspectPackage(['package.json', 'server.mjs', 'backend/package-lock.json']).length,
    0,
  );
});
