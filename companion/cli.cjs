#!/usr/bin/env node
'use strict';
const { spawnSync, spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const command = process.argv[2] || 'help';
if (command === 'doctor') {
  const base = process.env.LOCALAPPDATA || require('node:os').homedir();
  const installed = path.join(base, 'WeChatCompanion');
  console.log(
    JSON.stringify(
      {
        project: 'WeChat Bridge',
        version: require('./package.json').version,
        platform: process.platform,
        architecture: process.arch,
        node: process.versions.node,
        windows_supported: process.platform === 'win32',
        local_installation_present: existsSync(path.join(installed, 'settings.json')),
        pairing_present: existsSync(path.join(installed, 'gateway.dpapi')),
        private_urls_included: false,
        account_data_included: false,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (['help', '--help', '-h'].includes(command)) {
  console.log(
    'WeChat Bridge\n\n  setup             Install dependencies and open the companion\n  start             Open the installed companion\n  check             Verify local WeChat access\n  doctor            Show redacted installation diagnostics\n  connect [gateway] Connect this PC to a private Cloudflare gateway\n\nWindows source PC required. No OpenAI tunnel or Cloudflare account needed for users.',
  );
  process.exit(0);
}
if (process.platform !== 'win32') {
  console.error('This preview supports Windows only.');
  process.exit(1);
}
const dir = path.join(process.env.LOCALAPPDATA, 'WeChatCompanion');
if (command === 'setup') {
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-File', path.join(__dirname, 'Install.ps1')],
    { stdio: 'inherit', windowsHide: false },
  );
  if (r.error)
    console.error('Could not start the installer. Use an allowed Windows PowerShell environment.');
  process.exit(r.status ?? 1);
}
if (command === 'start') {
  const exe = path.join(dir, 'Companion.exe');
  if (!existsSync(exe)) {
    console.error('Run wechat-companion setup first.');
    process.exit(1);
  }
  const p = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false });
  p.on('error', () => {
    console.error('Could not open the companion.');
    process.exitCode = 1;
  });
  p.unref();
} else if (command === 'connect') {
  const connector = path.join(dir, 'connector.mjs');
  if (!existsSync(connector)) {
    console.error('Run setup first.');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [connector, ...process.argv.slice(3)], {
    stdio: 'inherit',
    windowsHide: true,
  });
  process.exit(r.status ?? 1);
} else if (command === 'check') {
  const server = path.join(dir, 'server.mjs');
  if (!existsSync(server)) {
    console.error('Run setup first.');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [server, '--check'], {
    stdio: 'inherit',
    windowsHide: true,
  });
  process.exit(r.status ?? 1);
} else {
  console.error('Unknown command. Use --help.');
  process.exit(1);
}
