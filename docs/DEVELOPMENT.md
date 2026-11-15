# Development

Requirements: Node.js 22.13+, npm and Git. Python is needed for syntax checks; Windows and .NET Framework's C# compiler are needed to build the native launcher. Do not initialize WeChat to run the offline suite.

```powershell
npm ci --ignore-scripts
npm run check
python -m compileall -q companion
```

`npm run check` performs publication/privacy checks, offline tests and formatting validation. Test fixtures are synthetic. The lockfile under companion/backend is the dependency tree shipped for source-reader installation; gateway/package-lock.json pins development tooling separately.

## Gateway runtime

```powershell
cd gateway
npm ci
npm run dev
```

Local Wrangler listens only on 127.0.0.1:8787 with route-origin inference disabled. Do not expose the local development server to the network. The public wrangler.jsonc contains no account ID or production route. Keep a real deployment config in the ignored wrangler.local.jsonc and pass `--config wrangler.local.jsonc` explicitly when deploying it.

## Build Windows installer

```powershell
.\companion\Build.ps1
.\companion\Test-Tray.ps1
```

Build output goes to ignored dist/. The executable is compiled from GatewayCompanion.cs and is not checked into Git. Build.ps1 creates a ZIP and checksum from an explicit file list. Before npm publication, inspect the exact package with the release checks described in RELEASING.md.

## Runtime validation

Live source tests are optional, local-only and require the account owner's consent. A real test must read the minimum requested data and print only redacted results. Never commit account-specific verifiers or run them in public CI. Record pass/fail and coverage limitations, not messages, images, links, IDs or keys.
