export const normalizeName = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '');
export function buildContactIndex(contacts, sessions) {
  const entries = new Map();
  for (const c of contacts) {
    if (!c.id) continue;
    entries.set(c.id, {
      ...c,
      name: c.remark || c.nickname || c.wechat_id || c.id,
      group: c.id.endsWith('@chatroom'),
      has_session: false,
    });
  }
  for (const s of sessions) {
    const entry = entries.get(s.username) || {
      id: s.username,
      name: s.displayName || s.username,
      remark: '',
      nickname: '',
      wechat_id: '',
      pinyin: [],
      group: s.username.endsWith('@chatroom'),
    };
    entry.session_name = s.displayName;
    entry.last_timestamp = s.lastTimestamp;
    entry.has_session = true;
    entries.set(entry.id, entry);
  }
  return [...entries.values()];
}
function score(contact, query) {
  if (normalizeName(contact.id) === query) return { score: 100, matched_by: 'internal_id' };
  if (contact.wechat_id && normalizeName(contact.wechat_id) === query)
    return { score: 90, matched_by: 'wechat_id' };
  for (const field of ['remark', 'nickname', 'name', 'session_name'])
    if (contact[field] && normalizeName(contact[field]) === query)
      return { score: 80, matched_by: field };
  if ((contact.pinyin || []).some((p) => normalizeName(p) === query))
    return { score: 70, matched_by: 'pinyin' };
  if (
    [
      contact.id,
      contact.wechat_id,
      contact.remark,
      contact.nickname,
      contact.name,
      contact.session_name,
      ...(contact.pinyin || []),
    ].some((v) => v && normalizeName(v).includes(query))
  )
    return { score: 10, matched_by: 'partial_name' };
  return null;
}
export function searchContacts(index, value) {
  const query = normalizeName(value);
  if (!query || query.length > 200)
    throw Error('Use a contact name or ID, at most 200 characters.');
  return index
    .map((contact) => ({ contact, match: score(contact, query) }))
    .filter((x) => x.match)
    .sort((a, b) => b.match.score - a.match.score || a.contact.id.localeCompare(b.contact.id));
}
export function contactSummary(c) {
  return {
    id: c.id,
    name: c.name,
    remark: c.remark || undefined,
    nickname: c.nickname || undefined,
    wechat_id: c.wechat_id || undefined,
    group: c.group,
    has_session: c.has_session,
    last_timestamp: c.last_timestamp,
  };
}
export function resolveContact(index, value) {
  const matches = searchContacts(index, value);
  if (!matches.length) return { status: 'contact_not_found', query: value };
  const best = matches.filter((m) => m.match.score === matches[0].match.score);
  if (best.length !== 1)
    return {
      status: 'ambiguous_contact',
      query: value,
      total_matches: best.length,
      candidates: best.slice(0, 20).map((m) => contactSummary(m.contact)),
      instruction:
        'Ask which candidate the user means. Do not read or merge their messages until selected.',
    };
  return { status: 'matched', contact: best[0].contact, matched_by: best[0].match.matched_by };
}
