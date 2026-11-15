# Troubleshooting

For pixelated pictures, check `source_width`, `source_height` and `quality`. If the result says `thumbnail_only`, the connector currently retrieved only a low-resolution copy. Open/download the original in WeChat on the source PC, then retrieve the message again. The connector never AI-upscales a thumbnail or claims that resizing restores missing detail. When `original_available` is true, its download link supplies the original local image file. Images are limited to 8 MiB per local candidate and 25 megapixels for decoding; oversized or unsupported originals can remain unavailable.

| Symptom                                             | First action                                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Node or npx is missing                              | Install Node.js 22.13+ from the official Node site, then reopen PowerShell                                      |
| PowerShell blocks installation                      | Use your administrator-approved environment; do not blindly disable policy                                      |
| Setup cannot replace the executable                 | Close the companion before updating; keep WeChat open                                                           |
| Local source unavailable                            | Run Check; complete Initialize WeChat locally if needed                                                         |
| Contact not found                                   | Search a saved remark, nickname or WeChat ID; a failed lookup is not proof of no history                        |
| Several people match                                | Select a returned candidate; do not merge them or guess                                                         |
| Private link returns unauthorized                   | Copy the current link from the companion; a reset invalidates the old one                                       |
| PC offline                                          | Wake the source PC and start the companion; reconnect automatically resumes network interruptions               |
| OAuth or invalid browser form error in normal setup | Use the current private link with No authentication; the public `/d/.../mcp` address is the optional OAuth path |
| Picture placeholder only                            | Retrieve its attachment handle; local image bytes may be missing or undecryptable                               |
| Image/file link stopped working                     | Fetch its source message and attachment again; temporary links and handles expire                               |
| A file has no extracted text                        | Use its original-file download; extraction can fail independently of download availability                      |
| Voice transcript unavailable                        | No speech provider is configured; there is no generated transcript                                              |
| ChatGPT offers no custom MCP control                | Check account/workspace eligibility in official OpenAI guidance                                                 |
| ChatGPT describes old capabilities                  | Refresh connector tools where supported; no private-link reset is needed                                        |

## Share safe diagnostics

Run `npx @zakir300408/wechat-companion@latest doctor`. Review the output before sharing it. Do not attach settings, DPAPI profiles, database files, message exports, media, private URLs or full terminal logs. Remove any private link from screenshots. Report the action, error category, package version and whether the source PC is online.
