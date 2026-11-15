import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const settingsPath =
  process.env.WECHAT_COMPANION_SETTINGS ||
  path.join(process.env.LOCALAPPDATA || os.homedir(), 'WeChatCompanion', 'settings.json');
const cfg = JSON.parse((await fs.readFile(settingsPath, 'utf8')).replace(/^\uFEFF/, ''));
process.env.WEFLOW_CACHE_ENABLED = '0';
const root = await fs.realpath(cfg.weflowRoot);
const sdk = path.join(root, '..', '@modelcontextprotocol', 'sdk', 'dist', 'esm');
const { Server } = await import(pathToFileURL(path.join(sdk, 'server/index.js')));
const { StdioServerTransport } = await import(pathToFileURL(path.join(sdk, 'server/stdio.js')));
const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
  pathToFileURL(path.join(sdk, 'types.js'))
);
const { chatService } = await import(
  pathToFileURL(path.join(root, 'dist/src/services/chatService.js'))
);
const { configService } = await import(
  pathToFileURL(path.join(root, 'dist/src/services/configService.js'))
);
const { getPythonCommand } = await import(
  pathToFileURL(path.join(root, 'dist/src/utils/python.js'))
);
const { createPythonProcessEnv } = await import(
  pathToFileURL(path.join(root, 'dist/src/utils/pythonProcessEnv.js'))
);
const { buildContactIndex, searchContacts, resolveContact, contactSummary, normalizeName } =
  await import('./contact-resolution.mjs');
const { createAttachments, attachmentToolResult } = await import('./attachments.mjs');
const attachments = createAttachments({
  cfg,
  root,
  configService,
  pythonCommand: getPythonCommand,
  pythonEnv: createPythonProcessEnv,
});
let contactCache;
async function contactIndex() {
  if (contactCache && Date.now() - contactCache.loaded < 30000) return contactCache;
  const sessions = await chatService.listSessions(undefined, Infinity);
  let contacts = [],
    available = false;
  try {
    const r = await exec(
      getPythonCommand(),
      [path.join(import.meta.dirname, 'contacts.py'), root],
      {
        windowsHide: true,
        timeout: 30000,
        maxBuffer: 16 * 1024 * 1024,
        env: createPythonProcessEnv({ PYTHONIOENCODING: 'utf-8', WEFLOW_CACHE_ENABLED: '0' }),
      },
    );
    const result = JSON.parse(r.stdout);
    contacts = result.contacts || [];
    available = result.available === true;
  } catch {}
  contactCache = { loaded: Date.now(), available, index: buildContactIndex(contacts, sessions) };
  return contactCache;
}
const key = crypto.randomBytes(32);
const digest = (x) => crypto.createHmac('sha256', key).update(x).digest('base64url');
const device = cfg.deviceName || os.hostname();
function integer(x, d, max) {
  if (x === undefined) return d;
  if (!Number.isInteger(x) || x < 1 || x > max) throw Error('Invalid page size');
  return x;
}
function window(a) {
  const from = Date.parse(a.from),
    to = Date.parse(a.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to)
    throw Error('Use explicit ISO timestamps with timezone');
  if (!/[zZ]|[+-]\d\d:\d\d$/.test(a.from) || !/[zZ]|[+-]\d\d:\d\d$/.test(a.to))
    throw Error('Timezone required');
  return [from / 1000, to / 1000];
}
function encode(offset, scope) {
  const b = Buffer.from(JSON.stringify({ offset, scope })).toString('base64url');
  return b + '.' + digest(b);
}
function decode(c, scope) {
  if (!c) return 0;
  const [b, s] = c.split('.');
  if (!b || s !== digest(b)) throw Error('Cursor expired or invalid; restart pagination');
  const p = JSON.parse(Buffer.from(b, 'base64url'));
  if (p.scope !== scope || !Number.isSafeInteger(p.offset) || p.offset < 0)
    throw Error('Cursor scope mismatch');
  return p.offset;
}
async function connected() {
  const c = await chatService.connect();
  if (!c.success) throw Error('WeFlow database unavailable; run local connection check');
}
const tools = [
  ['companion_status', 'Local device and connection status', {}],
  [
    'list_conversations',
    'Find local conversations by saved remark, nickname, public WeChat ID or pinyin using query. Omit query for paginated conversation inventory. Do not ask for screenshots to resolve a name.',
    {
      query: { type: 'string' },
      limit: { type: 'integer' },
      cursor: { type: 'string' },
      active_since: { type: 'string' },
    },
  ],
  [
    'read_messages',
    'Read messages by conversation_id, which accepts internal ID OR saved remark, nickname, public WeChat ID or pinyin. Names resolve automatically. If ambiguous, ask the user to select a returned candidate. Continue next_cursor until null even for empty pages. Fixed ISO timestamps with timezone required.',
    {
      conversation_id: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      limit: { type: 'integer' },
      cursor: { type: 'string' },
    },
  ],
  [
    'read_attachment',
    'Retrieve a message-linked image preview, extract document text, or obtain a temporary file download link. Use an attachment_id from read_messages. For pictures, return the image content and display the download_url as a Markdown image; for files, provide its download_url. format=download skips text extraction. No arbitrary paths or audio transcription.',
    {
      attachment_id: { type: 'string' },
      format: { type: 'string', enum: ['auto', 'text', 'download'] },
      offset: { type: 'integer' },
      max_chars: { type: 'integer' },
    },
  ],
].map(([name, description, properties]) => ({
  name,
  description,
  inputSchema: {
    type: 'object',
    properties,
    additionalProperties: false,
    required:
      name === 'read_messages'
        ? ['conversation_id', 'from', 'to']
        : name === 'read_attachment'
          ? ['attachment_id']
          : [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}));
async function run(name, a) {
  if (name === 'companion_status') {
    await connected();
    return {
      device,
      connected: true,
      read_only: true,
      attachment_formats: [
        'image previews',
        'message-linked file downloads',
        'pdf',
        'docx',
        'xlsx',
        'txt',
        'md',
        'csv',
      ],
      voice_transcription: 'not_configured',
      history_scope: 'local account only',
      version: '0.6.0-preview.1',
    };
  }
  if (name === 'list_conversations') {
    await connected();
    const limit = integer(a.limit, 50, 200),
      catalog = await contactIndex();
    let all = a.query
      ? searchContacts(catalog.index, a.query).map((m) => m.contact)
      : catalog.index
          .filter((c) => c.has_session)
          .sort(
            (a, b) => (b.last_timestamp || 0) - (a.last_timestamp || 0) || a.id.localeCompare(b.id),
          );
    if (a.active_since) {
      const t = Date.parse(a.active_since) / 1000;
      if (!Number.isFinite(t)) throw Error('Invalid activity date');
      all = all.filter((x) => (x.last_timestamp || 0) >= t);
    }
    const scope = JSON.stringify(['sessions', normalizeName(a.query), a.active_since || '']);
    const off = decode(a.cursor, scope);
    return {
      device,
      total: all.length,
      conversations: all.slice(off, off + limit).map(contactSummary),
      next_cursor: off + limit < all.length ? encode(off + limit, scope) : null,
      contact_index_available: catalog.available,
      coverage: 'local contact and session metadata; not a guarantee of every message shard',
    };
  }
  if (name === 'read_messages') {
    await connected();
    const [from, to] = window(a),
      limit = integer(a.limit, 100, 200);
    if (typeof a.conversation_id !== 'string' || !a.conversation_id)
      throw Error('Conversation required');
    const catalog = await contactIndex(),
      resolved = resolveContact(catalog.index, a.conversation_id);
    if (resolved.status !== 'matched')
      return {
        device,
        ...resolved,
        contact_index_available: catalog.available,
        instruction:
          resolved.instruction ||
          'No local contact matched. This is a lookup failure, not evidence of an empty chat. Try another saved name/WeChat ID; if contact_index_available is false, repair local contact access.',
      };
    const conversation = resolved.contact;
    const scope = JSON.stringify([conversation.id, from, to]);
    const off = decode(a.cursor, scope);
    const result = await chatService.getMessagesWithShards(conversation.id, limit, off, from);
    const page = result.messages || [];
    const filtered = page.filter((m) => m.createTime >= from && m.createTime <= to);
    const oldest = page.length ? Math.min(...page.map((m) => m.createTime)) : null;
    const messages = [];
    for (const m of filtered) {
      const f = await attachments.fromMessage(m, conversation.id);
      messages.push({
        id: m.serverId || String(m.localId),
        local_id: m.localId,
        timestamp: m.createTime,
        sent_by_me: m.isSend === 1,
        sender: m.senderDisplay || m.senderUsername || null,
        type: m.localType,
        text: m.localType === 1 ? m.content : (m.parsedContent || '').split('｜ 引：')[0],
        attachment: f,
      });
    }
    return {
      device,
      status: 'matched',
      conversation_id: conversation.id,
      contact: contactSummary(conversation),
      matched_by: resolved.matched_by,
      messages,
      scanned: page.length,
      next_cursor:
        page.length === limit && oldest >= from ? encode(off + page.length, scope) : null,
      shards: result.shards
        ? {
            scanned: result.shards.scanned,
            opened: result.shards.opened,
            failed: result.shards.failed,
          }
        : null,
      coverage: result.shards
        ? 'backend shard report attached'
        : 'unverified shard coverage; empty result may mean unavailable data',
    };
  }
  if (name === 'read_attachment') return attachments.read(a);
  throw Error('Tool not allowed');
}
if (process.argv.includes('--check')) {
  try {
    console.log(JSON.stringify(await run('companion_status', {})));
  } catch {
    console.log(
      JSON.stringify({
        device,
        connected: false,
        reason: 'WeFlow unavailable; initialize locally',
      }),
    );
    process.exitCode = 1;
  }
  chatService.disconnect();
  process.exit();
}
const server = new Server(
  { name: 'wechat-companion', version: '0.6.0-preview.1' },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (r) => {
  try {
    return attachmentToolResult(await run(r.params.name, r.params.arguments || {}));
  } catch {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Request failed: invalid input, expired cursor/handle, unsupported attachment, or local source unavailable. Run the local check. No private paths or credentials included.',
        },
      ],
    };
  }
});
await server.connect(new StdioServerTransport());
