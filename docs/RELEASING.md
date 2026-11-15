# Release process

1. Review SECURITY.md, dependency advisories, compatibility and the dated security review. Close release blockers; do not treat a successful test suite as an independent audit.
2. Update the version consistently, changelog and user docs. Use a preview tag until clean-PC, signing and wider-client validation are complete.
3. Run `npm ci --ignore-scripts`, `npm run check`, Python syntax checks and the Windows build. Review the generated ZIP manifest and checksum.
4. From companion/, run `npm pack --dry-run --json --ignore-scripts`. The package must contain only the approved application files, licenses and dependency manifests. It must never contain settings, DPAPI profiles, account data, reports, media, development fixtures or production deployment configuration.
5. Use the manual Release artifacts workflow to build a reviewable artifact. It does not deploy the gateway or publish to npm. Inspect the artifact before publication.
6. Publish a reviewed prerelease with `npm publish --access public --tag next`. Complete npm's own MFA approval on npm's site. Do not paste a token into a chat or add a long-lived publish token to this repository.
7. npm can accept an upload before making it downloadable. Verify the exact version and package integrity from the registry, then test the actual registry `npx` command. Do not announce that `latest` or `next` works while scanning/processing is pending.
8. Promote to latest only after validation and an explicit release decision. Announce limitations and avoid claims of independent security certification.

For repeatable releases, configure npm trusted publishing with GitHub OIDC through the service's current official workflow. It is intentionally not auto-enabled in this preview. Keep deployment and npm publication separate from PR CI; PRs receive no production credentials.
