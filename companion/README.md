# WeChat Bridge

Read your own local WeChat messages, pictures and documents from an MCP client.

```powershell
npx @zakir300408/wechat-companion@latest setup
```

The npm package keeps its existing name for compatibility. The project and GitHub repository are **WeChat Bridge**.

Requirements: Windows, Node.js 22.13+, local WeChat history and interactive local initialization. The companion opens a private link; paste it directly into your chat app's MCP configuration and choose No authentication. The private URL is the credential. Do not paste it into a setup chat, issue or screenshot.

Your source PC must stay awake, online and connected. Reset private link locally to revoke a leaked link. The connector exposes only four read tools. It does not send messages, control the WeChat screen or read arbitrary filesystem paths. Voice transcription is not configured.

- [Setup and troubleshooting](https://github.com/zakir300408/wechat-bridge/tree/main/docs)
- [Guide for a ChatGPT setup assistant](https://github.com/zakir300408/wechat-bridge/blob/main/docs/ASSISTANT_SETUP.md)
- [Privacy](https://github.com/zakir300408/wechat-bridge/blob/main/PRIVACY.md)
- [Security and preview limits](https://github.com/zakir300408/wechat-bridge/blob/main/SECURITY.md)

This source tree prepares 0.6.0-preview.1. The registry's latest release may be older; check an exact version before distributing a command for a new feature. The doctor command is available in the professionalization preview; earlier releases may not include it.

Images use the best message-linked copy available locally. Full-resolution availability depends on what this PC actually downloaded. Temporary attachment links require the source PC online and expire after ten minutes. Do not infer that an empty result proves no history exists.

MIT licensed. Third-party dependencies retain their own licenses. This is an unsigned, early Windows preview and has not undergone an independent security audit.
