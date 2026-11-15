import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export function gatewayUrl(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/' ||
    !(
      u.protocol === 'https:' ||
      (u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname))
    )
  )
    throw Error('Use an HTTPS gateway origin.');
  return u.origin;
}
const dir = path.join(process.env.LOCALAPPDATA || os.homedir(), 'WeChatCompanion');
function dpapi(mode, input) {
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-File', path.join(import.meta.dirname, 'credentials.ps1'), '-Mode', mode],
    { input, encoding: 'utf8', windowsHide: true },
  );
  if (r.status !== 0) throw Error('Windows credential protection failed.');
  return r.stdout;
}
export async function requestConsent(info, { signal } = {}) {
  if (signal?.aborted) return false;
  if (typeof info?.client_name !== 'string' || typeof info?.redirect_origin !== 'string')
    return false;
  try {
    const destination = new URL(info.redirect_origin);
    if (
      !['https:', 'http:'].includes(destination.protocol) ||
      destination.origin !== info.redirect_origin
    )
      return false;
  } catch {
    return false;
  }
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-File', path.join(import.meta.dirname, 'consent.ps1')],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );
    let answer = '',
      done = false;
    const abort = () => {
      child.kill();
      finish(false);
    };
    const finish = (allowed) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve(allowed);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(false);
    }, 50000);
    child.stdout.on('data', (data) => {
      answer += data.toString();
      if (answer.length > 100) {
        child.kill();
        finish(false);
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', () => finish(false));
    child.on('exit', (code) => finish(code === 0 && answer.trim() === 'allow'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdin.on('error', () => finish(false));
    child.stdin.end(
      JSON.stringify({
        client_name: info.client_name.slice(0, 80),
        redirect_origin: info.redirect_origin.slice(0, 250),
      }),
    );
  });
}
async function openPrivatePage(url) {
  const nonce = crypto.randomBytes(24).toString('hex');
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/launch/' + nonce) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(302, {
      Location: url,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
    response.end();
    server.close();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const local = 'http://127.0.0.1:' + server.address().port + '/launch/' + nonce;
  // Only the short-lived local URL enters browser-launch arguments; no credential does.
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${local}'`], {
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', () => {});
  child.unref();
  setTimeout(() => server.close(), 60000).unref();
  console.log(
    'Opened your private connection page. Copy its private link into your chat app and select No authentication.',
  );
}
export async function connect(gateway) {
  const settings = JSON.parse(
    (await fs.readFile(path.join(dir, 'settings.json'), 'utf8')).replace(/^\uFEFF/, ''),
  );
  const profileFile = path.join(dir, 'gateway.dpapi');
  let profile;
  try {
    profile = JSON.parse(dpapi('unprotect', await fs.readFile(profileFile, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (profile) {
    if (gateway && gatewayUrl(gateway) !== profile.gateway)
      throw Error(
        'This PC is paired to a different gateway. Keep the existing profile or explicitly unpair it first.',
      );
  } else {
    profile = {
      gateway: gatewayUrl(gateway || 'https://wechat.clonemeup.com'),
      device: crypto.randomBytes(16).toString('hex'),
      agentKey: crypto.randomBytes(32).toString('base64url'),
      viewerKey: crypto.randomBytes(32).toString('base64url'),
    };
    await fs.writeFile(profileFile, dpapi('protect', JSON.stringify(profile)), { mode: 0o600 });
  }
  const base = profile.gateway + '/d/' + profile.device,
    pendingFile = profileFile + '.pending';
  async function commitRotation(candidate) {
    if (
      candidate.gateway !== profile.gateway ||
      candidate.device !== profile.device ||
      candidate.agentKey !== profile.agentKey
    )
      throw Error('Pairing reset mismatch.');
    const response = await fetch(base + '/rotate-link', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + profile.agentKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerKey: candidate.viewerKey }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('Private link reset failed.');
    await fs.rename(pendingFile, profileFile);
    Object.assign(profile, candidate);
  }
  async function resetPrivateLink() {
    let candidate;
    try {
      candidate = JSON.parse(dpapi('unprotect', await fs.readFile(pendingFile, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!candidate) {
      candidate = { ...profile, viewerKey: crypto.randomBytes(32).toString('base64url') };
      await fs.writeFile(pendingFile, dpapi('protect', JSON.stringify(candidate)), { mode: 0o600 });
    }
    await commitRotation(candidate);
  }
  try {
    await fs.access(pendingFile);
    await resetPrivateLink();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const privateUrl = () =>
    profile.gateway + '/c/' + profile.device + '/' + profile.viewerKey + '/mcp';
  const enrolled = await fetch(base + '/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentKey: profile.agentKey,
      viewerKey: profile.viewerKey,
      deviceName: settings.deviceName || os.hostname(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!enrolled.ok && enrolled.status !== 409)
    throw Error('Gateway enrollment unavailable (' + enrolled.status + '). Retry later.');
  if (enrolled.status === 409) {
    const check = await fetch(base + '/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + profile.viewerKey },
      body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'ping' }),
      signal: AbortSignal.timeout(15000),
    });
    if (check.status === 401) await resetPrivateLink();
    else if (!check.ok) throw Error('The saved profile does not own this gateway device.');
  }
  await fs.writeFile(
    path.join(dir, 'gateway-public.json'),
    JSON.stringify(
      { gateway: profile.gateway, device: profile.device, mcp: base + '/mcp' },
      null,
      2,
    ),
  );
  const sdk = path.join(settings.weflowRoot, '..', '@modelcontextprotocol', 'sdk', 'dist', 'esm');
  const { Client } = await import(pathToFileURL(path.join(sdk, 'client/index.js')));
  const { StdioClientTransport } = await import(pathToFileURL(path.join(sdk, 'client/stdio.js')));
  const { default: WebSocket } = await import(
    pathToFileURL(path.join(settings.weflowRoot, '..', 'ws', 'wrapper.mjs'))
  );
  const client = new Client(
    { name: 'wechat-companion-connector', version: '0.6.0-preview.1' },
    { capabilities: {} },
  );
  const transport = new StdioClientTransport({
    command: settings.node,
    args: [path.join(import.meta.dirname, 'server.mjs')],
    env: { ...process.env, WECHAT_COMPANION_SETTINGS: path.join(dir, 'settings.json') },
    stderr: 'pipe',
  });
  // Backend diagnostics can contain local paths. Never relay them to the gateway or console.
  transport.stderr?.on('data', () => {});
  await client.connect(transport);
  const status = await client.callTool({ name: 'companion_status', arguments: {} });
  if (status.isError) {
    await client.close();
    throw Error('Initialize local WeChat and run the connection check first.');
  }
  const allowed = new Set([
    'companion_status',
    'list_conversations',
    'read_messages',
    'read_attachment',
  ]);
  let stopped = false,
    socket,
    retry = 1000,
    heartbeat,
    reconnectTimer,
    active = 0,
    consentPending = false;
  const consentAbort = new AbortController();
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    consentAbort.abort();
    clearTimeout(reconnectTimer);
    clearInterval(heartbeat);
    socket?.close();
    await client.close();
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
  let resetting = false;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (data) => {
    if (data.trim() === 'stop') void stop().then(() => process.exit(0));
    else if (data.trim() === 'reset-link' && !resetting) {
      resetting = true;
      void resetPrivateLink()
        .then(async () => {
          console.log('Private link reset. The previous link no longer works.');
          console.log('Private MCP link: ' + privateUrl());
          if (process.env.COMPANION_NO_BROWSER !== '1')
            await openPrivatePage(base + '/#key=' + encodeURIComponent(profile.viewerKey));
        })
        .catch(() => console.error('Link reset could not finish. Reconnect to retry safely.'))
        .finally(() => (resetting = false));
    }
  });
  function dial() {
    if (stopped) return;
    socket = new WebSocket(base.replace(/^http/, 'ws') + '/agent', {
      headers: { Authorization: 'Bearer ' + profile.agentKey },
      maxPayload: 131072,
      handshakeTimeout: 15000,
    });
    socket.on('open', () => {
      retry = 1000;
      console.log('Connected. Read-only access is available while this process runs.');
      let alive = true;
      socket.on('pong', () => {
        alive = true;
      });
      heartbeat = setInterval(() => {
        if (!alive) return socket.terminate();
        alive = false;
        socket.ping();
      }, 30000);
    });
    socket.on('message', async (raw) => {
      const source = socket;
      let request,
        counted = false;
      try {
        request = JSON.parse(raw.toString());
        if (typeof request.id !== 'string') return;
        if (request.method === 'companion/approve_oauth') {
          if (consentPending) {
            source.send(JSON.stringify({ id: request.id, result: { approved: false } }));
            return;
          }
          consentPending = true;
          console.log(
            'Connection request: choose Allow or Deny in the WeChat Companion approval window.',
          );
          let approved = false;
          try {
            approved = await requestConsent(request.params, { signal: consentAbort.signal });
          } finally {
            consentPending = false;
          }
          if (source.readyState === WebSocket.OPEN)
            source.send(JSON.stringify({ id: request.id, result: { approved } }));
          return;
        }
        if (active >= 8) return;
        active++;
        counted = true;
        let result;
        if (request.method === 'tools/list') {
          const list = await client.listTools();
          result = { tools: list.tools.filter((t) => allowed.has(t.name)) };
        } else if (request.method === 'tools/call' && allowed.has(request.params?.name))
          result = await client.callTool(
            { name: request.params.name, arguments: request.params.arguments || {} },
            undefined,
            { timeout: 50000 },
          );
        else throw Error('Tool not allowed');
        if (source.readyState === WebSocket.OPEN)
          source.send(JSON.stringify({ id: request.id, result }));
      } catch {
        if (request?.id && source.readyState === WebSocket.OPEN)
          source.send(
            JSON.stringify({
              id: request.id,
              error: { code: -32000, message: 'Local read failed. Check the source PC.' },
            }),
          );
      } finally {
        if (counted) active--;
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      clearInterval(heartbeat);
      if (stopped) return;
      console.log('Connection interrupted; reconnecting automatically.');
      reconnectTimer = setTimeout(dial, retry + Math.random() * 1000);
      retry = Math.min(retry * 2, 30000);
    });
  }
  console.log('Private MCP link: ' + privateUrl());
  dial();
  if (process.env.COMPANION_NO_BROWSER !== '1')
    await openPrivatePage(base + '/#key=' + encodeURIComponent(profile.viewerKey));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    await connect(process.argv[2]);
  } catch {
    console.error(
      'Could not connect. Check the gateway URL, local installation and WeChat initialization. No credentials logged.',
    );
    process.exitCode = 1;
  }
}
