# Changelog

## 0.6.0-preview.2 — submitted 2026-11-16 (npm processing)

- Run in the system tray, with a connection page at setup and quiet startup afterward.
- Start with Windows by default; keep the user's startup choice on updates.
- Reuse one running instance, stop the owned reader on quit, and retry failed connections.
- Add link and stop commands, shorter English docs, and Chinese setup guides.
- Update pypdf to 6.21.4 for reported PDF parsing vulnerabilities; add Python requirement audits and a PDF extraction test.

## 0.6.0-preview.1 — unreleased

- Clean public source tree, MIT license, user/assistant setup guides, contribution and privacy/security policies.
- Separate remote read privileges from local device-management privileges.
- Integrity-bearing reader lockfile, pinned Python dependencies, offline CI, package/privacy guards and reviewable release artifacts.
- Prefer the largest genuine local image, expose original-file downloads when available, and report thumbnail dimensions without upscaling.
- Redacted doctor command and explicit preview/compatibility limits.

## Earlier local previews

- 0.5: message-linked image previews and temporary file downloads; voice transcription explicitly unconfigured.
- 0.4.1: contact resolution by saved remarks, nicknames, WeChat IDs and stored pinyin.
- 0.4: private-link connection mode and local link reset.
- 0.2–0.3: Cloudflare relay and optional OAuth/PC approval.
- 0.1: initial local reader and OpenAI tunnel preview.

Earlier previews were developed locally. npm acceptance and registry availability are distinct; verify an exact version before distributing an installation command.
