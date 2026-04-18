# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
