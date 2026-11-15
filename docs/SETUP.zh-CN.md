# 安装与使用

[English](SETUP.md)

在保存微信记录的 Windows 电脑上安装 Node.js 22.13 或更新版本，然后打开 PowerShell：

```powershell
npx @zakir300408/wechat-companion@latest setup
```

npm 当前提供 0.5.0，使用应用窗口。下文介绍的是新版托盘程序 0.6.0-preview.2；在发布前，需要按[源码运行说明](DEVELOPMENT.md)安装。

## 首次运行

安装后桥接程序会自动启动。如果需要初始化微信，会出现本地设置窗口，请在该窗口中完成微信登录等操作。

连接成功后，浏览器会打开连接页面。点击 **Copy private link（复制私有链接）**，在聊天应用的自定义 MCP 服务器设置中粘贴，认证方式选择 **No authentication（无需认证）**。不需要另外获取 OAuth 密钥。你的聊天账号必须支持自定义 MCP 服务器。

链接本身就是访问凭证。只粘贴到服务器设置中，不要发到聊天窗口或 GitHub 问题中。

可以先问：“检查桥接程序状态”，再问：“找到我和某个联系人的聊天”。

## 日常使用

桥接程序在系统托盘运行，默认随 Windows 登录启动，不会每次登录都打开浏览器。双击托盘图标可重新打开连接页面。

右键菜单提供：

- **Disconnect**：断开远程读取；**Connect**：恢复连接。
- **Reset private link**：更换私有链接，更换后需要更新聊天应用中的链接。
- **Start with Windows**：开启或关闭随系统启动，更新时会保留选择。
- **Check WeChat / Set up WeChat**：检查或重新设置本地微信访问。
- **Quit**：退出桥接程序及其后台读取进程。如未关闭开机启动，下次登录仍会启动。

也可在 PowerShell 中运行：

```powershell
npx @zakir300408/wechat-companion@latest start
npx @zakir300408/wechat-companion@latest link
npx @zakir300408/wechat-companion@latest stop
```

`link` 和 `stop` 需要新版托盘程序。`start` 在后台启动，不打开浏览器。

保存记录的电脑需要保持唤醒并联网。另一台电脑的记录需要单独安装、单独连接，不要在电脑之间复制配对文件。

## 更新

重新运行 setup 即可。安装程序会先停止已安装的桥接程序，更新文件后重新启动。原来的连接和开机启动设置会保留，微信本身不会退出。

遇到问题可查看[故障排查](TROUBLESHOOTING.md)（英文）。不要分享数据库密钥、配对文件或私有链接。
