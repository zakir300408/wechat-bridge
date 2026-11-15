# Third-party software

The MIT license at this repository's root applies to this project's code. It does not replace dependency licenses. Installed dependencies must retain their original notices and licenses.

| Component                             | Purpose                                         | Source / license                                                              |
| ------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| WeFlow CLI 1.21.15                    | Local WeChat reader and media helpers           | https://github.com/zhuobichen/weflow-cli — MIT, as distributed in its LICENSE |
| Model Context Protocol TypeScript SDK | MCP transport and request types                 | https://github.com/modelcontextprotocol/typescript-sdk — MIT                  |
| ws                                    | Local outbound WebSocket client                 | https://github.com/websockets/ws — MIT                                        |
| Cloudflare Wrangler / Workers tooling | Gateway development and deployment              | https://github.com/cloudflare/workers-sdk — see installed package notices     |
| Python extraction/database libraries  | Local SQLCipher, images and document extraction | See pinned requirements and each installed distribution's license metadata    |
| Prettier                              | Source formatting in development                | https://github.com/prettier/prettier — MIT                                    |

Reader dependencies are fetched during setup from a committed integrity-bearing npm lockfile. Third-party source is not vendored into this repository. Python dependencies are version-pinned; their wheels and transitive dependency licenses must be considered in a release review. Version pins are reproducibility aids, not security certification.
