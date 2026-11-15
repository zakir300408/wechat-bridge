# Self-host the gateway

Self-hosting changes the operator in the trust boundary; it does not create end-to-end encryption. The gateway can see requested content and processes credential-bearing URLs. Understand PRIVACY.md and SECURITY.md first.

1. Use a Cloudflare account with Workers and SQLite-backed Durable Objects available. Check its actual plan, quotas and billing settings.
2. Install gateway development dependencies with `npm ci` in gateway/ and authenticate Wrangler using its documented browser flow. Never send a token through a setup chat.
3. Copy wrangler.jsonc to the ignored wrangler.local.jsonc. Add your own account ID and, optionally, a new custom subdomain route. Do not overwrite an existing website's DNS/route.
4. Run tests and `npx wrangler deploy --dry-run --config wrangler.local.jsonc`. Review the target before `npx wrangler deploy --config wrangler.local.jsonc`.
5. Keep application request logging disabled. Review every reverse proxy, access log and security/observability layer for credential-bearing URL capture.
6. Configure the gateway origin in the companion's Connection settings before first pairing, or pass it to `wechat-companion connect https://your-gateway.example`. Existing pairings cannot silently switch gateways.

Use a separate identity for each source PC. Keep the agent secret local; it manages enrollment and revocation. Do not copy Windows DPAPI profiles to other PCs. Users of your hosted gateway do not need their own Cloudflare accounts, but they must understand that you operate a trusted relay.

Before broad public enrollment, provide an abuse/contact process, assess quotas, evaluate stronger signup controls, monitor availability without retaining credentials, and complete the remaining review items. The preview's rate limits are not a complete multi-tenant service operation.
