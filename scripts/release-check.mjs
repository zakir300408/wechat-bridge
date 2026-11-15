import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const packageFiles = new Set([
  'package.json',
  'README.md',
  'LICENSE',
  'cli.cjs',
  'Companion.exe',
  'Install.ps1',
  'server.mjs',
  'connector.mjs',
  'credentials.ps1',
  'consent.ps1',
  'contacts.py',
  'contact-resolution.mjs',
  'attachments.mjs',
  'media.py',
  'image_quality.py',
  'extract.py',
  'requirements.txt',
  'requirements-backend.txt',
  'backend/package.json',
  'backend/package-lock.json',
]);
export function inspectFile(name, content) {
  const issues = [];
  const file = name.replaceAll('\\', '/');
  if (/\.(png|jpe?g|webp|gif|pdf|zip|tgz|db|sqlite)$/i.test(file) && file !== 'assets/overview.png')
    issues.push('unapproved binary/media artifact');
  if (/\bwxid_[a-z0-9]{10,}\b/i.test(content)) issues.push('account identifier in source');
  if (
    /(^|\/)(reports|dist|node_modules|\.wrangler|\.weflow-cli)(\/|$)|\.tmp\.|\.dpapi|(^|\/)(settings|gateway-public|gateway-preferences)\.json$|wrangler\.(local|production)\.jsonc$|\.(exe|pem|pfx|p12)$/i.test(
      file,
    )
  )
    issues.push('private/generated file');
  if (
    /https?:\/\/[^\s"'<>]+\/c\/[a-f0-9]{32}\/[A-Za-z0-9_-]{43}\/mcp/.test(content) ||
    /\/f\/[a-f0-9]{32}\/[A-Za-z0-9_-]{64,}\.[A-Za-z0-9_-]{43}/.test(content)
  )
    issues.push('private capability URL');
  if (
    /(?:gh[pousr]_|github_pat_|npm_)[A-Za-z0-9_]{20,}/.test(content) ||
    /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(content)
  )
    issues.push('credential/key material');
  if (/C:[\\/]+Users[\\/]+(?!Public\b|<)[a-z0-9_.-]+[\\/]/i.test(content))
    issues.push('personal Windows path');
  if (/"account_id"\s*:\s*"[a-f0-9]{32}"/.test(content)) issues.push('local deployment account');
  return issues;
}
export function inspectPackage(files) {
  return files
    .filter((file) => !packageFiles.has(file))
    .map((file) => 'Unexpected package file: ' + file);
}
async function run() {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  let names;
  try {
    names = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
  } catch {
    throw Error('Run this check in the prepared Git repository.');
  }
  if (!names.length)
    throw Error('No tracked files to inspect. Stage the reviewed source tree first.');
  const findings = [];
  for (const name of names) {
    const content = await fs.readFile(path.join(root, name), 'utf8');
    for (const issue of inspectFile(name, content)) findings.push(name + ': ' + issue);
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'companion/package.json'), 'utf8'));
  if (manifest.license !== 'MIT') findings.push('companion/package.json: expected MIT license');
  const lock = JSON.parse(
    await fs.readFile(path.join(root, 'companion/backend/package-lock.json'), 'utf8'),
  );
  for (const [name, entry] of Object.entries(lock.packages || {})) {
    if (!name) continue;
    if (
      entry.resolved &&
      (!entry.resolved.startsWith('https://registry.npmjs.org/') || !entry.integrity)
    )
      findings.push('reader lockfile: untrusted/missing integrity source');
  }
  if (process.argv.includes('--package')) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const output = execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: path.join(root, 'companion'),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    const packed = JSON.parse(output)[0];
    findings.push(...inspectPackage(packed.files.map((f) => f.path)));
    if (!packed.files.some((f) => f.path === 'Companion.exe'))
      findings.push('Package is missing the built launcher.');
  }
  if (findings.length) {
    for (const finding of findings) console.error(finding);
    process.exitCode = 1;
  } else
    console.log(
      JSON.stringify({
        tracked_files: names.length,
        privacy_guard: 'passed',
        package_checked: process.argv.includes('--package'),
        secret_values_logged: false,
      }),
    );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch(() => {
    console.error('Release check failed. No credential values logged.');
    process.exitCode = 1;
  });
