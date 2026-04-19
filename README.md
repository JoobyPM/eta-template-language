<p align="center">
  <img src="https://raw.githubusercontent.com/JoobyPM/eta-template-language/main/images/icon.png" width="160" alt="Eta Template Language logo">
</p>

# Eta Template Language

Eta language support and Prettier-backed formatting for Cursor and VS Code-compatible editors.

## Features

- Dedicated `eta` language id for `.eta` files.
- TextMate grammar with embedded JavaScript highlighting inside Eta tags.
- Grammar injection so Eta tags are highlighted inside HTML files as well.
- Full-document formatter that understands Eta trim markers, JavaScript strings, template literals, comments, and regex literals inside tags.
- HTML tag pair highlighting that recognises matching `<tag>…</tag>` pairs across Eta control blocks.
- Auto-closing pairs, Emmet support, and snippets for common Eta patterns (`etaout`, `etaraw`, `etaif`, `etaelse`, `etafor`, `etainclude`, `etalayout`).

## Install

Install the extension from Open VSX (Cursor) or by picking **Extensions: Install from VSIX…** and choosing a VSIX from the [GitHub Releases](https://github.com/JoobyPM/eta-template-language/releases).

## Configure

All settings are resource-scoped; the precedence is **workspace setting → `.prettierrc` → extension default**.

| Setting                                  | Default      | Notes                                                                                |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `etaFormatter.formatHtml`                | `true`       | Format HTML regions around Eta tags.                                                 |
| `etaFormatter.printWidth`                | `80`         | Preferred maximum line width.                                                        |
| `etaFormatter.singleQuote`               | `false`      | Use single quotes in embedded JavaScript.                                            |
| `etaFormatter.semi`                      | `true`       | Print semicolons in embedded JavaScript.                                             |
| `etaFormatter.trailingComma`             | `"all"`      | `all` / `es5` / `none`.                                                              |
| `etaFormatter.proseWrap`                 | `"preserve"` | Markdown prose wrap for `.md.eta`.                                                   |
| `etaFormatter.htmlWhitespaceSensitivity` | `"ignore"`   | `ignore` avoids inline `><span` hug patterns; `css` matches Prettier's HTML default. |

The packaged VSIX bundles the extension runtime and a pruned `prettier` so the formatter never depends on dynamic module resolution.

## Architecture

- Root package — the editor extension (grammar, snippets, language config, formatter entry point).
- [`packages/prettier-plugin-eta`](./packages/prettier-plugin-eta) — the reusable Prettier plugin that the extension wraps, also published to npm.

The formatter uses a stateful Eta scanner rather than a regex. It walks Eta tags, formats JavaScript payloads with Prettier, formats surrounding HTML through placeholder-based document formatting, and stitches the template back together with trim markers preserved.

## Formatter Scope

- Safe full-document formatting only; range formatting is intentionally out of scope.
- JavaScript inside execution and output tags is formatted with Prettier's `babel-ts` parser.
- HTML around Eta tags is formatted with Prettier's HTML parser.

## Known Limitations

- Prettier may reflow tagged templates such as `` html`…` `` inside Eta tags according to its own tagged-template heuristics. That behaviour comes from Prettier's JavaScript formatter, not the Eta parser.

## Project Docs

- Contributor workflow, local setup, and release process: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Release history: [CHANGELOG.md](./CHANGELOG.md)
- Sample template: [`samples/demo.eta`](./samples/demo.eta)
