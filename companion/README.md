# WeChat Bridge

Read your WeChat chats, pictures, and files from ChatGPT or another MCP client.

```powershell
npx @zakir300408/wechat-companion@latest setup
```

Requires Windows, local WeChat history, and Node.js 22.13+. Follow the local setup, copy your private link into your chat app's MCP settings, and choose No authentication. Keep the link private.

[English guide](https://github.com/zakir300408/wechat-bridge#readme) · [中文说明](https://github.com/zakir300408/wechat-bridge/blob/main/README.zh-CN.md)

Tray mode, automatic startup, and the link/stop commands require 0.6.0-preview.2 or newer. Older versions use an app window.

The tray version runs quietly after setup. Double-click its icon for the connection page. Right-click to disconnect, reset your link, or turn off Start with Windows. Keep the PC awake and online.

Database keys stay on your PC. Requested content passes through the Cloudflare server and your chat provider. Pictures depend on the copies saved locally. Voice transcription and message sending are not supported.

[Help](https://github.com/zakir300408/wechat-bridge/blob/main/docs/SETUP.md) · [Privacy](https://github.com/zakir300408/wechat-bridge/blob/main/PRIVACY.md) · [Security](https://github.com/zakir300408/wechat-bridge/blob/main/SECURITY.md)

MIT licensed. Early Windows release, unsigned, without an independent security audit.
