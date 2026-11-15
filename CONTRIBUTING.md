# Contributing

Use a small branch and a focused pull request. Describe the problem, resulting behavior, validation and any privacy/compatibility impact. Read SECURITY.md before changing authorization, attachment handling, source initialization or release workflows.

```powershell
npm ci --ignore-scripts
npm run check
```

Gateway changes can also be exercised with its local Wrangler runtime; see docs/DEVELOPMENT.md. Never point an automated test at someone else's account. Offline tests must not require WeChat, keys, a model API, Cloudflare credentials or a private history export.

Use synthetic contact names and message fixtures. Do not add production account IDs, deploy credentials, private links, media, personal usernames/paths, or local debug scripts. Keep source code and npm-package allowlists synchronized when adding a runtime file. Update setup documentation for user-visible behavior changes.

Dependencies are deliberate compatibility boundaries. Do not bump the pinned reader or add an audit override without running the affected runtime checks and documenting why it is compatible.
