# Setup

[中文](SETUP.zh-CN.md)

Use the Windows PC that holds your WeChat history. Install Node.js 22.13 or newer, then open PowerShell:

```powershell
npx @zakir300408/wechat-companion@latest setup
```

Tray mode requires 0.6.0-preview.2 or newer. That release has been submitted to npm and is still processing; latest currently installs 0.5.0. You can [build from source](DEVELOPMENT.md) to use tray mode while it is pending.

## First run

The installer starts WeChat Bridge. If WeChat access needs setting up, a local setup window opens. Follow it and complete your WeChat login there.

The connection page opens in your browser when the bridge connects. Click **Copy private link**, add it to your chat app as a custom MCP server, and choose **No authentication**. No separate OAuth key is needed. Your chat account must support custom MCP servers.

Keep the link private. Paste it into the server settings, not into a chat or GitHub issue.

Try asking: “Check the bridge status,” then “Find my chat with [contact name].”

## Everyday use

The bridge runs in the system tray and starts when you sign in to Windows. It does not open the browser on each login. Double-click its tray icon to open the connection page again.

Right-click the icon for:

- **Disconnect**: stop remote reads. **Connect** resumes them.
- **Reset private link**: replace your link. Update the saved link in your chat app afterward.
- **Start with Windows**: turn automatic startup on or off. Updates keep this choice.
- **Check WeChat** / **Set up WeChat**: check or repair local access.
- **Quit**: close the bridge and stop its background reader. It can start again at your next login unless you turn off startup.

You can also use PowerShell:

```powershell
npx @zakir300408/wechat-companion@latest start
npx @zakir300408/wechat-companion@latest link
npx @zakir300408/wechat-companion@latest stop
```

The `link` and `stop` commands require the new tray version. `start` runs quietly and does not open a browser.

Keep the source PC awake and online. To read another PC's history, install there separately and use that PC's link. Do not copy pairing files between PCs.

## Updating

Run setup again. It stops the installed bridge, updates its files, and starts it again. Your pairing and Windows startup choice are kept. WeChat itself stays running.

For help, see [Troubleshooting](TROUBLESHOOTING.md). Never share database keys, pairing files, or your private link.
