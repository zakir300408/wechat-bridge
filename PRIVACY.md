# Privacy

## What stays on the source PC

WeChat databases, their decryption keys, the local reader configuration and Windows DPAPI-protected pairing profiles stay on the source PC. The local process reads contact metadata to resolve names; the index is cached in RAM and only bounded requested results are returned. Decoded image previews are kept in bounded RAM. Document extraction reads only message-issued file handles with path containment checks.

The upstream reader's initialization has its own local behavior. Review WeFlow's documentation before authorizing it. This project does not promise that a third-party dependency never writes its own local configuration or caches.

## What leaves the PC

Requested contact, message, image and file results pass through the gateway to the chosen MCP client/chat provider. The gateway terminates HTTPS. The gateway operator and hosting provider are in the trust boundary. This is not end-to-end encryption against them.

The gateway persists hashed reader/agent credentials and device/authorization metadata, short-lived per-minute counters keyed by hashed network addresses, and a daily request counter. Hashing these addresses does not guarantee anonymity. It does not intentionally persist message bodies or file bytes. Application request logging is disabled because request paths contain credentials. The hosting provider may still process URLs and retain platform, security or billing metadata. Do not interpret disabled application logs as a promise that no provider ever retains metadata.

The connection page displays the private URL locally. The tray process does not print that URL; running the connector directly in a terminal does. That is an intentional credential display; terminal capture, clipboard history, browser history, screenshots and chat-provider connector settings can expose it. The browser entry fragment is cleared after page load. Treat the copied link like a password.

## Access and revocation

A private link grants all four read tools for one source PC; it is not conversation-scoped. Temporary media URLs grant one attachment for up to ten minutes and require the source PC online. They do not contain the full-account private key.

Closing/disconnecting stops source access. Reset private link replaces the read credential and invalidates prior private links, OAuth grants and temporary media links. Device-management operations require the separate local agent credential. Reset does not delete content already returned to a chat, saved by another recipient, or retained by a provider.

No model API calls, voice uploads or local transcription-model downloads happen automatically. The project has no telemetry SDK or centralized user analytics. Cloudflare hosting quotas and the chat provider's policies still apply.

## Public contributions

Use synthetic fixtures. Do not upload real account data in issues, pull requests or workflow artifacts. Follow [SECURITY.md](SECURITY.md) for vulnerability reports.
