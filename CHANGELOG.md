# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.11] - 2026-04-19

### Added

- Exposed `etaFormatter.trailingComma` (`all`, `es5`, `none`), `etaFormatter.htmlWhitespaceSensitivity` (`css`, `strict`, `ignore`), and `etaFormatter.proseWrap` (`always`, `never`, `preserve`) as workspace-scoped settings. All three follow the same precedence: workspace setting overrides `.prettierrc`, which overrides the extension default.
- Added an Eta-aware HTML tag pair highlight provider so placing the cursor on an opening or closing tag name highlights only the matching pair instead of every same-named word in the document.
- Exposed the Eta-aware HTML tag matcher as a `prettier-plugin-eta/html-tag-matcher` subpath import for downstream Eta tooling.

### Changed

- Replaced the 0.2.10 placeholder logo with a cleaner `<%>` mark that centers the `%` symbol as the Eta identity.

### Fixed

- Fixed `htmlWhitespaceSensitivity` being silently dropped by the plugin's internal Prettier calls, causing inline HTML elements to always produce `><span` hug patterns. Default is now `ignore` so Eta templates format cleanly out of the box.
- Validated all enum formatter settings at the extension boundary instead of relying on unchecked type casts; invalid values now fall back to the documented default.

## [0.2.10] - 2026-04-19

### Added

- Added a shared Eta logo asset and extension icon, and surfaced the same branding in the extension and `prettier-plugin-eta` package documentation.

## [0.2.9] - 2026-04-19

### Changed

- Removed `<%` / `%>` from Eta editor bracket-pair configuration so Cursor and VS Code no longer recolor nested Eta delimiters by bracket nesting depth.

## [0.2.8] - 2026-04-19

### Changed

- Unified the outer TextMate tag scope for exec, escaped-output, raw-output, and comment tags so Cursor and VS Code themes see Eta open/close delimiters under the same scope stack regardless of tag kind.

## [0.2.7] - 2026-04-19

### Changed

- Unified `<%=`, `<%~`, and `<%#` opening delimiters under the shared Eta delimiter scope so attribute-valued output tags no longer pick up a separate operator color.
- Removed `{}` from Eta top-level bracket colorization and surrounding-pair configuration so Cursor and VS Code no longer recolor JavaScript braces inside Eta tags as document-level bracket pairs.

## [0.2.6] - 2026-04-19

### Changed

- Moved embedded Eta JavaScript bodies under an Eta-owned TextMate scope and stopped advertising them as embedded JavaScript languages in the extension manifest, preventing Cursor and VS Code from overriding Eta delimiter colors with JavaScript semantic highlighting.

## [0.2.5] - 2026-04-18

### Changed

- Unified Eta delimiter TextMate scopes across opening tags, closing tags, and inline JavaScript braces so Cursor and VS Code themes render embedded Eta punctuation consistently.

### Added

- Added carried-state grammar regressions that cover nested Eta control blocks and mixed HTML attribute expressions modeled after the EMS templates.

## [0.2.4] - 2026-04-18

### Added

- Added staged VSIX packaging that emits a stripped extension manifest and verifies the packaged manifest does not expose workspace metadata.
- Added an Open VSX extension publish workflow that tags releases as `eta-template-language-v<version>` and attaches the packaged VSIX to the matching GitHub release.
- Added formatter regressions for Markdown tables and fenced code blocks, standalone Eta control-line indentation recovery, inline raw-output includes, and Alpine attribute tokenization.

### Changed

- Marked Eta formatter settings as resource-scoped so folder and file overrides work correctly in multi-root workspaces.
- Documented Prettier-upgrade sensitivity for exact-output formatter tests and the staged extension packaging flow.
- Switched the extension publisher id from the local placeholder value to the real `JoobyPM` namespace used for Open VSX publication.
- Stopped reflowing Markdown tables and fenced code blocks in `.md.eta` and `.markdown.eta` files during placeholder formatting.
- Recovered standalone Eta exec-tag indentation from surrounding HTML context so previously mangled nested control blocks reformat cleanly.
- Wrapped long HTML start tags that contain embedded Eta-controlled attributes so mixed HTML/Eta lines honor `printWidth` instead of staying as single unreadable lines.

### Fixed

- Fixed postfix `++` and `--` handling in the Eta lexer so division after increment or decrement is no longer misread as a regex literal.
- Hardened Eta expression extraction against wrapper-tail semicolon assumptions without perturbing Prettier layout decisions.
- Stopped conflating missing slot replacements with empty-string replacements in HTML/Markdown placeholder stitching.
- Cleaned up temporary directories created by extension runtime smoke tests.
- Hardened grammar contract tests so both generated repositories are checked for structural equality before shared assertions run.
- Hardened VSIX smoke checks so the packaged manifest must preserve the real publisher id and reject the placeholder publisher.
- Fixed standalone raw output tags so simple include-style calls collapse back to a single inline Eta tag when they fit within the configured print width.

## [0.2.3] - 2026-04-18

### Added

- Added bundled extension-runtime regression tests and packaged VSIX smoke checks.
- Added behavioral bundle-loading smoke tests for both unpacked and packaged extension runtimes.
- Added `CONTRIBUTING.md` and documented the release workflow, validation steps, and generated-file rules.

### Changed

- Bundled the extension runtime while shipping `prettier` as an explicit packaged dependency in the VSIX, avoiding dynamic module loading and unreliable full-Prettier bundling.
- Moved the extension and `prettier-plugin-eta` package versions back into lockstep.
- Targeted the packaged extension bundle at Node 18 so it matches the minimum supported VS Code extension host runtime.
- Exposed Python grammar checks as standard `test_...` functions so they can run under either direct `python3` execution or `pytest`.

### Fixed

- Preserved whitespace inside JavaScript strings, template literals, regex literals, and path strings when formatting Eta tags.
- Fixed `%>` handling inside single-line Eta `//` comments so formatting is idempotent for `<% // ... %>`.
- Preserved JavaScript division-vs-regex lexer state across inline comments inside Eta tags.
- Stopped overriding user `trailingComma` preferences when formatting JavaScript inside Eta tags.
- Emitted canonical Eta trim-marker output for `<%-=`, `<%-~`, and `<%-#`.
- Fixed multiline execution and expression indentation so wrapper formatting does not leak into Eta output.
- Preserved trim-sensitive text blocks, empty Eta comments, and adjacent-tag line breaks during HTML and Markdown formatting.
- Surfaced invalid Prettier config resolution errors instead of silently falling back to defaults.
- Prevented placeholder token collisions and adjacent-tag line reflow in HTML and Markdown formatting.
- Switched editor block comments to Eta-native `<%# ... %>` toggles.

## [0.2.2] - 2026-04-18

### Added

- Added npm trusted publishing for `prettier-plugin-eta`.
- Published `prettier-plugin-eta` to npm.

## [0.2.0] - 2026-04-18

### Added

- Introduced the dedicated Eta language extension and reusable `prettier-plugin-eta` package.
- Added stateful Eta lexing, grammar generation, syntax tests, and Prettier-backed full-document formatting.
