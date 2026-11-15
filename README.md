# WeChat Bridge

English · [简体中文](README.zh-CN.md)

Ask ChatGPT about your WeChat chats, pictures, and files.

![Your WeChat history → WeChat Bridge → your AI chat](assets/overview.svg)

## Setup

On the Windows PC where you use WeChat, install [Node.js](https://nodejs.org/) 22.13 or newer. Then open PowerShell and run:

```powershell
npx @zakir300408/wechat-companion@latest setup
```

Follow the local WeChat setup if asked. On the connection page, click **Copy private link**. Add it as a custom MCP server in ChatGPT and choose **No authentication**.

Keep that link private: it gives access to your chats while the bridge is connected.

> The tray update, **0.6.0-preview.2**, has been submitted to npm and is still processing. `latest` currently installs **0.5.0**, which uses an app window. You can use the tray version from [source](docs/DEVELOPMENT.md) while it is pending.

## After setup

The new version runs in the system tray and starts with Windows. No app window needs to stay open. Double-click its tray icon to open the connection page, or right-click to disconnect, reset your link, or turn off startup.

Keep this PC awake and online. You can use ChatGPT from another computer or phone without installing the bridge there. To read history stored on a different PC, install it on that PC too; each gets its own link.

Try asking:

- “Summarize my chats with Alex from last week.”
- “Show me the last picture I sent Alex.”
- “Find the PDF Alex sent yesterday.”

## What works

- Find people by their saved name, nickname, WeChat ID, or stored pinyin.
- Read local messages and view pictures.
- Download chat files up to 30 MB. Download links last ten minutes.
- Read text from PDF, Word, Excel, and text files.

Picture quality depends on what WeChat saved on this PC. If only a thumbnail is available, open the picture in WeChat and download the original, then try again.

Voice transcription and sending messages are not supported. History stored only on another device is not available here.

## Privacy

Database keys stay on your PC. Requested messages and files pass through our Cloudflare server and your chat provider. Both are part of the connection you trust.

Anyone with your private link can read through the bridge while it is connected. Use **Reset private link** from the tray menu if it leaks. Use **Disconnect** or **Quit** to stop access.

This is an early Windows release. It is unsigned and has not had an independent security audit. WeChat updates may break it. See [Privacy](PRIVACY.md) and [Security](SECURITY.md) for details.

## Help and development

[Setup help](docs/SETUP.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Let ChatGPT help you set up](docs/ASSISTANT_SETUP.md)

[Build from source](docs/DEVELOPMENT.md) · [Host your own server](docs/SELF_HOSTING.md) · [Contribute](CONTRIBUTING.md)

The hosted server needs no OpenAI tunnel or Cloudflare account from you. Your chat app must support custom MCP servers; its account requirements and charges still apply.

Built with [WeFlow](https://github.com/zhuobichen/weflow-cli). [MIT license](LICENSE).
