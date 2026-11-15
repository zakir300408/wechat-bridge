# Maintainer security review

Date: 2026-11-16. Scope: this repository's gateway, local connector, attachment boundary, installer and distribution process. This is not an independent audit.

## Fixed in the professionalization preview

- The read credential previously authorized the hidden device-forget endpoint and OAuth revocation. Those operations now require the separate local agent credential. A private-link holder is read-only at the HTTP boundary as well as the MCP boundary.
- Secret-token checks use Cloudflare's timing-safe comparison, with a Web Crypto verification fallback for the Node test runtime.
- The installer uses a shipped Node dependency lockfile and pinned Python package versions instead of resolving a broad tree afresh on every PC.
- The public source tree is assembled from a file allowlist. Account reports, test media, temporary verifiers, personal setup notes, credentials and deployment account configuration are excluded.
- CI and package checks reject private links, recognizable tokens, key material, personal local paths, unsafe artifacts and unexpected package files. Checks report categories/filenames without echoing secret values.

## Dependency review

The gateway development dependency scan reported no known advisories at review time. The locked reader tree reported six affected packages: five moderate and one low, with no high or critical findings. A compatible `npm audit fix --package-lock-only` was attempted; remaining reports involve `uuid` through `exceljs` and `katex` through `mermaid` / `@wenyan-md/core` / `weflow-cli`.

The exposed reader uses the chat database service and Python extraction; it does not expose the upstream HTML/Mermaid/KaTeX renderer or ExcelJS spreadsheet-writing commands. This reduces the known paths' exposure but is **not proof that the whole dependency is safe**. Do not force a breaking dependency override merely to silence an audit. Review upstream fixes and run compatibility tests before updating the reader. Re-run the scans for each release; these counts are a dated snapshot.

## Validation

Offline unit checks cover cross-device credential rejection, read-only role separation, invalid/expired/replayed OAuth grants, link rotation, unknown tools, temporary file-token tampering and revocation, bounded/ranged downloads, filesystem containment, changed files, contact ambiguity and private package contents.

Earlier local/live tests verified real contact lookup, bounded messages, one locally decoded image preview, document extraction and gateway media delivery. Those tests used the maintainer's own account and are deliberately not copied into public CI or published as fixtures. A clean second physical PC and actual end-user ChatGPT rendering remain separate checks. Unsigned Windows binary trust is unresolved; reproducible source/build instructions are provided, but no signature claim is made.

## Limits that remain

- Capability URLs are powerful bearer secrets and can leak through clipboard, browser, client or provider records.
- The shared gateway is trusted, not an end-to-end encrypted relay.
- Public enrollment has rate limits but no full invitation, account recovery or per-person billing/abuse system.
- The upstream WeChat reader uses internal formats and can break after WeChat updates.
- Voice transcription has no configured provider and is not part of this release's validation.
- Maintainer review and tests cannot replace an independent security assessment before wider deployment.
