# Security policy

This is an early preview. It has targeted automated checks and a maintainer review, **not an independent penetration test or a guarantee of safety**. Read the current [review](docs/SECURITY_REVIEW.md) before using it with sensitive history or exposing a gateway to other users.

## Report a vulnerability privately

Use the repository's **Security → Report a vulnerability** control if enabled. If unavailable, open a minimal issue asking for a private reporting channel without exploit details or secrets. Never publish a private MCP link, database key, account export, DPAPI file, real media URL or a working exploit against another person's PC.

Include the affected version, expected/actual behavior, synthetic reproduction and impact. Maintainer response times are not guaranteed; there is no paid support or bounty promise.

## Threat model

| Boundary                            | Control                                                                  | Remaining risk                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Remote MCP client → one PC          | Separate 256-bit read credential, per-PC routing and four-tool allowlist | Anyone with the private link can read all exposed conversations for that PC     |
| Read credential → device management | Agent-only rotation, revocation and device removal                       | A compromised local agent/Windows account already has broader access            |
| Gateway → local reader              | Authenticated outbound WebSocket; exact allowed methods                  | The gateway operator is trusted and terminates TLS                              |
| Attachment → local filesystem       | Issued handles, realpath containment, size checks and bounded chunks     | Filename/month matching does not cryptographically prove the sent revision      |
| Image/document content → assistant  | No source-content execution; image preview and text extraction only      | Chat clients must resist prompt injection from retrieved content                |
| Download recipient → attachment     | Signed single-file capability, short expiry and epoch revocation         | Returned content can be copied and cannot be recalled                           |
| Dependencies → runtime              | Lockfiles, exact direct versions, lifecycle scripts disabled and review  | Third-party reader internals and unresolved advisories remain a dependency risk |
| Contributor → CI/release            | Secret scans, pinned Actions, read-only CI token, no account fixtures    | Maintainer-account or npm-account compromise remains a release risk             |

## Operational rules

- Keep WeChat/database keys and agent credentials on the source PC. DPAPI protects pairing at rest for the current Windows user; it does not protect against malware running as that user.
- Treat private URLs as passwords. Disable request-URL logging at every gateway/proxy layer. Cloudflare and the chat provider still process traffic; do not promise provider-independent secrecy.
- Use **Reset private link** after exposure and replace the connector URL. Closing the companion stops new reads. Revocation cannot erase content already disclosed.
- Do not run WeChat automation, send messages, execute attachments, accept arbitrary file paths, or upload an account dump to troubleshoot a name lookup.
- Only test with accounts/data you control. CI uses synthetic data and never initializes WeChat.
- Do not silently enable speech APIs, download a model, change paid plans, or disable OS security policy.
- Keep the hosted gateway's quotas, abuse controls and operator access under review before inviting users. Public enrollment is capped, but there is no full account/invitation/abuse-management system yet.

## Release criteria

Every release must pass repository privacy checks, package-content inspection, tests and the Windows build. Review dependency advisories and the threat model. A known high/critical advisory or a new privilege-boundary failure blocks normal release until fixed or explicitly reviewed and documented. Code signing, clean second-PC validation, a full dependency assessment and an independent review remain required before claiming production readiness.
