# Install and connect

## Before you begin

Use a Windows PC that already holds your WeChat account and local history. A browser-only device cannot supply another computer's local history. Install Node.js 22.13 or later from nodejs.org, then open a normal PowerShell window. Administrator privileges are not normally required. Respect any organization-managed software policy.

## Install

```powershell
npx @zakir300408/wechat-companion@latest setup
```

The installer prepares a user-local companion, a locked Node reader dependency tree, Python environments, and a desktop shortcut. npm lifecycle scripts are disabled for reader installation. It does not install an OpenAI tunnel or enable a paid model service.

If local WeChat access is not initialized, choose Initialize WeChat and follow the local WeFlow window. Login/key acquisition requires your interaction. Never paste a password, database key, runtime credential or private MCP link into a setup chat. Do not weaken PowerShell execution policy to make an unknown installer run; use an administrator-approved environment.

## Connect ChatGPT

The companion opens a connection page. Copy the **private link** there. It contains a credential, so paste it only into the intended connector configuration.

Where available in your ChatGPT account/workspace: Plugins → add a custom MCP server → paste the private link → choose **No authentication**. No separate OAuth key, client secret, OpenAI tunnel or Allow prompt is needed in private-link mode. Account and workspace permissions still apply; the project cannot unlock features your account does not offer.

Select the resulting connector in a chat and try: “Check the companion status,” then “Find the conversation with [a saved contact name].” Read messages only for an explicit date range. If ChatGPT still sees an earlier tool description, refresh its connector tools using the controls available in your account.

## Everyday use

```powershell
npx @zakir300408/wechat-companion@latest start
npx @zakir300408/wechat-companion@latest check
npx @zakir300408/wechat-companion@latest doctor
```

The source PC must remain awake and online. Startup at Windows login is optional. Disconnect or close the companion to stop reads. **Reset private link** replaces the link and invalidates previous private links, OAuth grants and temporary media links. Update the connector configuration after a reset.

For a different source PC, run setup there and use its separate link. Do not share an agent identity, copy DPAPI profiles, or point multiple source PCs at one identity.

## Safe verification

Check status first. Search for a known contact next. Read a small date-bounded page, then test one image or document if desired. A setup assistant should not request a full account export to verify installation.
