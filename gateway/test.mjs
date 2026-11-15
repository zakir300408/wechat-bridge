import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { Device, hash, ALLOWED_TOOLS } from './worker.mjs';
import { gatewayUrl } from '../companion/connector.mjs';
class Store {
  values = new Map();
  async get(k) {
    return structuredClone(this.values.get(k));
  }
  async put(k, v) {
    this.values.set(k, structuredClone(v));
  }
  async delete(k) {
    return this.values.delete(k);
  }
  async deleteAll() {
    this.values.clear();
  }
  async transaction(fn) {
    return fn(this);
  }
}
const devices = new Map();
const env = {
  DEVICES: {
    idFromName: (name) => name,
    get(id) {
      if (!devices.has(id))
        devices.set(id, new Device({ storage: new Store(), getWebSockets: () => [] }, env));
      return devices.get(id);
    },
  },
};
const root = 'https://gateway.example',
  a = 'a'.repeat(32),
  b = 'b'.repeat(32),
  key = 'v'.repeat(43),
  agent = 'a'.repeat(43);
const base = (id) => `${root}/d/${id}`;
const request = (url, options) => worker.fetch(new Request(url, options), env);
const post = (url, data, token) =>
  request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(data),
  });
test('gateway URLs reject credentials, insecure remote origins and query strings', () => {
  assert.equal(gatewayUrl('https://example.com'), 'https://example.com');
  assert.equal(gatewayUrl('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
  for (const u of [
    'http://example.com',
    'https://u:p@example.com',
    'https://example.com/path',
    'https://example.com/?key=secret',
  ])
    assert.throws(() => gatewayUrl(u));
});
test('enrollment never replaces credentials; MCP requires the matching device key', async () => {
  for (const [id, viewerKey] of [
    [a, key],
    [b, 'b'.repeat(43)],
  ])
    assert.equal(
      (await post(base(id) + '/enroll', { agentKey: agent, viewerKey, deviceName: 'Test PC' }))
        .status,
      201,
    );
  assert.equal(
    (
      await post(base(a) + '/enroll', {
        agentKey: agent,
        viewerKey: 'c'.repeat(43),
        deviceName: 'Other',
      })
    ).status,
    409,
  );
  const rpc = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26' },
  };
  assert.equal((await post(base(a) + '/mcp', rpc)).status, 401);
  assert.equal((await post(base(b) + '/mcp', rpc, key)).status, 401);
  assert.equal((await post(base(a) + '/mcp', rpc, key)).status, 200);
  assert.equal(
    (
      await request(base(a) + '/mcp', {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
});
test('arbitrary tools are rejected and offline reads give an explicit error', async () => {
  assert.deepEqual(
    [...ALLOWED_TOOLS],
    ['companion_status', 'list_conversations', 'read_messages', 'read_attachment'],
  );
  for (const name of ['send_message', 'read_file']) {
    const r = await post(
      base(a) + '/mcp',
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name } },
      key,
    );
    assert.equal((await r.json()).error.code, -32601);
  }
  const r = await post(
    base(a) + '/mcp',
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'companion_status' } },
    key,
  );
  assert.match((await r.json()).error.message, /offline/);
});
test('ChatGPT origins can discover and authenticate MCP; private management and other origins stay blocked', async () => {
  for (const origin of ['https://chatgpt.com', 'https://chat.openai.com']) {
    const metadata = await request(root + '/.well-known/oauth-protected-resource/d/' + a + '/mcp', {
      headers: { Origin: origin },
    });
    assert.equal(metadata.status, 200);
    assert.equal(metadata.headers.get('Access-Control-Allow-Origin'), origin);
    const unauthenticated = await request(base(a) + '/mcp', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    assert.equal(unauthenticated.status, 401);
    assert.match(unauthenticated.headers.get('WWW-Authenticate'), /resource_metadata/);
    assert.equal(unauthenticated.headers.get('Access-Control-Allow-Origin'), origin);
    const authenticated = await request(base(a) + '/mcp', {
      method: 'POST',
      headers: {
        Origin: origin,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    assert.equal(authenticated.status, 200);
    assert.equal(authenticated.headers.get('Access-Control-Allow-Origin'), origin);
    const preflight = await request(base(a) + '/mcp', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type,mcp-protocol-version',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
    for (const action of ['enroll', 'agent', 'revoke', 'forget', 'authorize'])
      assert.equal(
        (await request(base(a) + '/' + action, { method: 'POST', headers: { Origin: origin } }))
          .status,
        403,
      );
  }
  for (const origin of [
    'https://attacker.example',
    'https://chatgpt.com.attacker.example',
    'null',
  ]) {
    const r = await request(base(a) + '/mcp', {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(
    (
      await request(base(a) + '/mcp', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://chatgpt.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-arbitrary-header',
        },
      })
    ).status,
    403,
  );
});
let access, refresh, client;
test('OAuth requires the owner key and S256 PKCE, rejects replay and isolates devices', async () => {
  const r = await post(base(a) + '/register', {
    redirect_uris: ['https://client.example/callback'],
    client_name: 'Test client',
    token_endpoint_auth_method: 'none',
  });
  assert.equal(r.status, 201);
  client = (await r.json()).client_id;
  const verifier = 'z'.repeat(50),
    params = new URLSearchParams({
      client_id: client,
      redirect_uri: 'https://client.example/callback',
      response_type: 'code',
      code_challenge_method: 'S256',
      code_challenge: await hash(verifier),
      resource: base(a) + '/mcp',
      scope: 'wechat.read',
      state: 'preserve-me',
    });
  assert.equal((await request(base(a) + '/authorize?' + params)).status, 302);
  params.set('connection_key', 'wrong');
  assert.equal(
    (await request(base(a) + '/authorize', { method: 'POST', body: params })).status,
    403,
  );
  params.set('connection_key', key);
  const approved = await request(base(a) + '/authorize', { method: 'POST', body: params });
  assert.equal(approved.status, 302);
  const callback = new URL(approved.headers.get('Location'));
  assert.equal(callback.searchParams.get('state'), 'preserve-me');
  const grant = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: client,
    redirect_uri: 'https://client.example/callback',
    code: callback.searchParams.get('code'),
    code_verifier: 'x'.repeat(50),
  });
  assert.equal((await request(base(a) + '/token', { method: 'POST', body: grant })).status, 400);
  grant.set('code_verifier', verifier);
  const tokens = await (await request(base(a) + '/token', { method: 'POST', body: grant })).json();
  assert.equal(tokens.token_type, 'Bearer');
  access = tokens.access_token;
  refresh = tokens.refresh_token;
  assert.equal((await request(base(a) + '/token', { method: 'POST', body: grant })).status, 400);
  const rpc = { jsonrpc: '2.0', id: 1, method: 'initialize' };
  assert.equal((await post(base(a) + '/mcp', rpc, access)).status, 200);
  assert.equal((await post(base(b) + '/mcp', rpc, access)).status, 401);
  assert.equal((await post(base(a) + '/mcp', rpc, access + 'x')).status, 401);
});
test('OAuth refresh and revocation require the correct grant and owner', async () => {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: client,
    refresh_token: refresh,
  });
  const rotated = await request(base(a) + '/token', { method: 'POST', body: params });
  assert.equal(rotated.status, 200);
  const next = await rotated.json();
  assert.notEqual(next.refresh_token, refresh);
  assert.equal((await request(base(a) + '/token', { method: 'POST', body: params })).status, 400);
  params.set('refresh_token', next.refresh_token);
  assert.equal((await post(base(a) + '/revoke', {}, key)).status, 401);
  assert.equal((await post(base(a) + '/revoke', {}, agent)).status, 200);
  assert.equal(
    (await post(base(a) + '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize' }, access)).status,
    401,
  );
  assert.equal((await request(base(a) + '/token', { method: 'POST', body: params })).status, 400);
});
test('metadata advertises the exact device resource, public clients and PKCE', async () => {
  const resource = await (
    await request(root + '/.well-known/oauth-protected-resource/d/' + a + '/mcp')
  ).json();
  assert.equal(resource.resource, base(a) + '/mcp');
  const auth = await (
    await request(root + '/.well-known/oauth-authorization-server/d/' + a)
  ).json();
  assert.equal(auth.issuer, base(a));
  assert.deepEqual(auth.code_challenge_methods_supported, ['S256']);
  assert.equal(
    (await post(base(a) + '/register', { redirect_uris: ['http://attacker.example/callback'] }))
      .status,
    400,
  );
});
test('keyless OAuth grants access only after this device approves; denial, unsolicited replies and prompt spam cannot grant access', async () => {
  const id = 'c'.repeat(32);
  assert.equal(
    (
      await post(base(id) + '/enroll', {
        agentKey: agent,
        viewerKey: key,
        deviceName: 'Approval PC',
      })
    ).status,
    201,
  );
  const device = env.DEVICES.get(id),
    sent = [];
  let decision = false,
    manualReply;
  const socket = {
    send(raw) {
      const message = JSON.parse(raw);
      sent.push(message);
      device.webSocketMessage(
        socket,
        JSON.stringify({ id: 'unsolicited', result: { approved: true } }),
      );
      if (manualReply) {
        manualReply(message);
        return;
      }
      queueMicrotask(() =>
        device.webSocketMessage(
          socket,
          JSON.stringify({ id: message.id, result: { approved: decision } }),
        ),
      );
    },
  };
  device.ctx.getWebSockets = () => [socket];
  const registered = await (
    await post(base(id) + '/register', {
      client_name: 'Chat app',
      redirect_uris: ['https://chatgpt.com/callback'],
    })
  ).json();
  const verifier = 'k'.repeat(50),
    params = new URLSearchParams({
      client_id: registered.client_id,
      redirect_uri: 'https://chatgpt.com/callback',
      response_type: 'code',
      code_challenge_method: 'S256',
      code_challenge: await hash(verifier),
      resource: base(id) + '/mcp',
      approve_on_pc: '1',
      state: 'test-state',
    });
  const denied = await request(base(id) + '/authorize', { method: 'POST', body: params });
  assert.equal(new URL(denied.headers.get('Location')).searchParams.get('error'), 'access_denied');
  assert.equal(await device.ctx.storage.get('codes'), undefined);
  decision = true;
  const allowed = await request(base(id) + '/authorize', { method: 'POST', body: params });
  const callback = new URL(allowed.headers.get('Location'));
  assert.ok(callback.searchParams.get('code'));
  assert.equal(callback.searchParams.get('state'), 'test-state');
  assert.equal(sent[0].method, 'companion/approve_oauth');
  assert.deepEqual(sent[0].params, {
    client_name: 'Chat app',
    redirect_origin: 'https://chatgpt.com',
  });
  const tokens = await request(base(id) + '/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: registered.client_id,
      redirect_uri: 'https://chatgpt.com/callback',
      code: callback.searchParams.get('code'),
      code_verifier: verifier,
    }),
  });
  assert.equal(tokens.status, 200);
  let notify;
  const captured = new Promise((resolve) => (notify = resolve));
  manualReply = (message) => notify(message);
  const pending = request(base(id) + '/authorize', { method: 'POST', body: params });
  const message = await captured;
  const concurrent = await request(base(id) + '/authorize', { method: 'POST', body: params });
  assert.equal(
    new URL(concurrent.headers.get('Location')).searchParams.get('error'),
    'access_denied',
  );
  assert.equal(sent.length, 3);
  device.webSocketMessage(socket, JSON.stringify({ id: message.id, result: { approved: false } }));
  await pending;
  const limited = await request(base(id) + '/authorize', { method: 'POST', body: params });
  assert.equal(new URL(limited.headers.get('Location')).searchParams.get('error'), 'access_denied');
  assert.equal(sent.length, 3);
  const forged = new URLSearchParams(params);
  forged.delete('approve_on_pc');
  forged.set('approved', 'true');
  assert.equal(
    (await request(base(id) + '/authorize', { method: 'POST', body: forged })).status,
    403,
  );
});
test('opaque-origin OAuth navigation survives retries without forms or duplicate approvals; tickets cannot cross devices or mint fresh grants on replay', async () => {
  const id = 'd'.repeat(32);
  assert.equal(
    (
      await post(base(id) + '/enroll', {
        agentKey: agent,
        viewerKey: key,
        deviceName: 'Opaque browser test',
      })
    ).status,
    201,
  );
  const device = env.DEVICES.get(id);
  let prompts = 0;
  const socket = {
    send(raw) {
      const rpc = JSON.parse(raw);
      prompts++;
      queueMicrotask(() =>
        device.webSocketMessage(socket, JSON.stringify({ id: rpc.id, result: { approved: true } })),
      );
    },
  };
  device.ctx.getWebSockets = () => [socket];
  const registered = await (
    await post(base(id) + '/register', {
      client_name: 'ChatGPT',
      redirect_uris: ['https://chatgpt.com/connector/oauth/test'],
    })
  ).json();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: registered.client_id,
    redirect_uri: 'https://chatgpt.com/connector/oauth/test',
    scope: 'wechat.read offline_access',
    code_challenge: await hash('x'.repeat(50)),
    code_challenge_method: 'S256',
    resource: base(id) + '/mcp',
    state: 'test-browser-state',
    ui_locales: 'en-US',
  });
  const start = await request(base(id) + '/authorize?' + params, { headers: { Origin: 'null' } });
  assert.equal(start.status, 302);
  const location = start.headers.get('Location');
  assert.match(location, /\/confirm\/[A-Za-z0-9_-]{43}$/);
  assert.equal(prompts, 0);
  const accepted = await request(location, { headers: { Origin: 'null' } });
  assert.equal(accepted.status, 302);
  const callback = new URL(accepted.headers.get('Location'));
  assert.ok(callback.searchParams.get('code'));
  assert.equal(callback.searchParams.get('state'), 'test-browser-state');
  assert.equal(prompts, 1);
  const retried = await request(location, { headers: { Origin: 'null' } });
  assert.equal(retried.headers.get('Location'), callback.href);
  assert.equal(prompts, 1);
  const wrongDevice = await request(location.replace('/d/' + id, '/d/' + a), {
    headers: { Origin: 'null' },
  });
  assert.equal(wrongDevice.status, 200);
  assert.match(await wrongDevice.text(), /expired/);
  assert.equal(prompts, 1);
  const grant = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: registered.client_id,
    redirect_uri: params.get('redirect_uri'),
    code: callback.searchParams.get('code'),
    code_verifier: 'x'.repeat(50),
  });
  assert.equal((await request(base(id) + '/token', { method: 'POST', body: grant })).status, 200);
  await request(location, { headers: { Origin: 'null' } });
  assert.equal((await request(base(id) + '/token', { method: 'POST', body: grant })).status, 400);
  assert.equal(prompts, 1);
  const oldForm = new URLSearchParams(params);
  oldForm.set('connection_key', 'must-not-enter-url');
  oldForm.set('_browser_token', 'expired');
  oldForm.set('approve_on_pc', '1');
  const recovery = await request(base(id) + '/authorize', {
    method: 'POST',
    headers: { Origin: 'null' },
    body: oldForm,
  });
  assert.equal(recovery.status, 303);
  const recoverUrl = new URL(recovery.headers.get('Location'));
  assert.equal(recoverUrl.searchParams.get('client_id'), registered.client_id);
  assert.equal(recoverUrl.searchParams.has('connection_key'), false);
  assert.equal(recoverUrl.searchParams.has('_browser_token'), false);
  assert.equal(prompts, 1);
  const sessions = await device.ctx.storage.get('oauth-navigations');
  for (const session of Object.values(sessions)) session.exp = Date.now() - 1;
  await device.ctx.storage.put('oauth-navigations', sessions);
  assert.match(await (await request(location, { headers: { Origin: 'null' } })).text(), /expired/);
  assert.equal(prompts, 1);
  for (const endpoint of ['mcp', 'enroll', 'revoke', 'forget', 'register', 'token', 'agent'])
    assert.equal(
      (await request(base(id) + '/' + endpoint, { method: 'POST', headers: { Origin: 'null' } }))
        .status,
      403,
    );
});
test('private MCP links authenticate without OAuth or headers; only the local agent can rotate them', async () => {
  const endpoint = (viewer) => `${root}/c/${a}/${viewer}/mcp`,
    rpc = { jsonrpc: '2.0', id: 1, method: 'initialize' };
  assert.equal((await post(endpoint(key), rpc)).status, 200);
  assert.equal(
    (
      await request(endpoint(key), {
        method: 'POST',
        headers: { Origin: 'null', 'Content-Type': 'application/json' },
        body: JSON.stringify(rpc),
      })
    ).status,
    200,
  );
  assert.equal((await post(endpoint('w'.repeat(43)), rpc, key)).status, 401);
  assert.equal((await post(endpoint(key).replace('/c/' + a, '/c/' + b), rpc)).status, 401);
  assert.equal(
    (
      await request(endpoint(key), {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
  const denied = await post(endpoint(key), {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'send_message' },
  });
  assert.equal((await denied.json()).error.code, -32601);
  const replacement = 'r'.repeat(43),
    device = env.DEVICES.get(a),
    before = await device.config();
  assert.equal((await post(base(a) + '/rotate-link', { viewerKey: replacement }, key)).status, 401);
  assert.equal(
    (await post(base(a) + '/rotate-link', { viewerKey: replacement }, agent)).status,
    200,
  );
  assert.equal((await post(endpoint(key), rpc)).status, 401);
  assert.equal((await post(endpoint(replacement), rpc)).status, 200);
  const after = await device.config();
  assert.equal(after.epoch, before.epoch + 1);
  assert.equal(after.agentHash, before.agentHash);
  assert.equal(
    (await post(base(a) + '/rotate-link', { viewerKey: replacement }, agent)).status,
    200,
  );
  assert.equal((await device.config()).epoch, after.epoch);
});
test('message-specific downloads stream bounded chunks and ranges; tokens expire, reject tampering/cross-device access, and are revoked by link reset', async () => {
  const id = 'e'.repeat(32),
    attachment = '12345678-1234-1234-1234-123456789abc';
  assert.equal(
    (
      await request(base(id) + '/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.23' },
        body: JSON.stringify({ agentKey: agent, viewerKey: key, deviceName: 'File test PC' }),
      })
    ).status,
    201,
  );
  const data = new Uint8Array(300000);
  for (let i = 0; i < data.length; i++) data[i] = i % 251;
  const device = env.DEVICES.get(id);
  let chunks = 0;
  const socket = {
    send(raw) {
      const rpc = JSON.parse(raw),
        args = rpc.params.arguments;
      assert.equal(rpc.params.name, 'read_attachment');
      assert.equal(args.attachment_id, attachment);
      let result;
      if (args.format === 'binary') {
        chunks++;
        const piece = data.subarray(args.byte_offset, args.byte_offset + args.max_bytes);
        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                base64: Buffer.from(piece).toString('base64'),
                offset: args.byte_offset,
                total_bytes: data.length,
              }),
            },
          ],
        };
      } else
        result = {
          content: [
            { type: 'text', text: JSON.stringify({ available: true, name: 'example.pdf' }) },
          ],
          _meta: {
            companion_download: {
              id: attachment,
              name: 'example.pdf',
              mimeType: 'application/pdf',
              size: data.length,
              preview: false,
            },
          },
        };
      queueMicrotask(() => device.webSocketMessage(socket, JSON.stringify({ id: rpc.id, result })));
    },
  };
  device.ctx.getWebSockets = () => [socket];
  const called = await post(
    base(id) + '/mcp',
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'read_attachment',
        arguments: { attachment_id: attachment, format: 'download' },
      },
    },
    key,
  );
  const result = await called.json(),
    metadata = JSON.parse(result.result.content[0].text),
    url = metadata.download_url;
  assert.ok(url);
  assert.ok(!url.includes(key));
  const downloaded = await request(url);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers.get('Content-Disposition'), /^attachment/);
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), data);
  assert.equal(chunks, 2);
  const partial = await request(url, { headers: { Range: 'bytes=20-39' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('Content-Range'), 'bytes 20-39/300000');
  assert.deepEqual(new Uint8Array(await partial.arrayBuffer()), data.subarray(20, 40));
  const before = chunks;
  assert.equal((await request(url, { method: 'HEAD' })).headers.get('Content-Length'), '300000');
  assert.equal(chunks, before);
  assert.equal((await request(url, { headers: { Range: 'bytes=999999-' } })).status, 416);
  assert.equal((await request(url + 'x')).status, 401);
  assert.equal((await request(url.replace('/f/' + id, '/f/' + a))).status, 401);
  const cfg = await device.config(),
    expired = await device.sign(
      {
        type: 'attachment',
        epoch: cfg.epoch,
        exp: Date.now() - 1,
        handle: attachment,
        name: 'expired.pdf',
        mimeType: 'application/pdf',
        size: data.length,
      },
      cfg,
    );
  assert.equal((await request(root + '/f/' + id + '/' + expired)).status, 401);
  assert.equal(
    (await post(base(id) + '/rotate-link', { viewerKey: 'n'.repeat(43) }, agent)).status,
    200,
  );
  assert.equal((await request(url)).status, 401);
});
test('a reader cannot revoke or delete a device; the authenticated local agent can', async () => {
  const id = 'b'.repeat(32),
    viewer = 'b'.repeat(43);
  assert.equal((await post(base(id) + '/forget', {}, viewer)).status, 401);
  assert.equal((await post(base(id) + '/revoke', {}, viewer)).status, 401);
  assert.equal(
    (await post(base(id) + '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize' }, viewer)).status,
    200,
  );
  assert.equal((await post(base(id) + '/forget', {}, agent)).status, 200);
  assert.equal(
    (await post(base(id) + '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize' }, viewer)).status,
    404,
  );
});
