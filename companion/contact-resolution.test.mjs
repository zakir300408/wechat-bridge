import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactIndex, resolveContact, searchContacts } from './contact-resolution.mjs';
const index = buildContactIndex(
  [
    {
      id: 'wxid_a',
      wechat_id: 'alice_public',
      remark: 'Alice Smith',
      nickname: '阿丽',
      pinyin: ['alisi'],
    },
    {
      id: 'wxid_b',
      wechat_id: 'bob_public',
      remark: 'Shared name',
      nickname: 'Bob',
      pinyin: ['bob'],
    },
    {
      id: 'wxid_c',
      wechat_id: 'charlie_public',
      remark: 'Shared name',
      nickname: 'Charlie',
      pinyin: ['charlie'],
    },
  ],
  [
    {
      username: 'wxid_a',
      displayName: 'wxid_a',
      summary: 'not a contact search field',
      lastTimestamp: 10,
    },
  ],
);
test('resolves public IDs, saved remarks, nicknames, spaced names, pinyin and internal IDs to the same contact', () => {
  for (const value of [
    'alice_public',
    'ALICE_PUBLIC',
    'Alice Smith',
    'alice smith',
    'alicesmith',
    '阿丽',
    'alisi',
    'wxid_a',
  ])
    assert.equal(resolveContact(index, value).contact.id, 'wxid_a');
  assert.equal(resolveContact(index, 'alice_public').matched_by, 'wechat_id');
  assert.equal(index[0].name, 'Alice Smith');
});
test('duplicate names return candidates instead of selecting or reading the wrong person', () => {
  const result = resolveContact(index, 'Shared name');
  assert.equal(result.status, 'ambiguous_contact');
  assert.equal(result.total_matches, 2);
  assert.equal(result.contact, undefined);
});
test('unknown contacts are lookup failures rather than empty conversations; partial search is bounded by caller pagination', () => {
  assert.equal(resolveContact(index, 'not-a-person').status, 'contact_not_found');
  assert.equal(resolveContact(index, 'not-a-person').messages, undefined);
  assert.equal(searchContacts(index, 'public').length, 3);
  assert.equal(searchContacts(index, 'not a contact search field').length, 0);
});
