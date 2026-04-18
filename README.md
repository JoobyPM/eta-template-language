# Eta Template Language

Eta language support plus a dedicated Prettier formatter for Cursor and VS Code-compatible editors.

## Architecture

The repository now has two clear layers:

- The root package remains the editor extension with grammar files, snippets, and a thin formatter wrapper.
- `packages/prettier-plugin-eta` contains the reusable formatter core and Prettier plugin.

The extension is bundled into a single runtime file for packaging, and the VSIX ships `prettier` as an explicit production dependency. The Eta plugin code is compiled into `dist/extension.js`, while `prettier` is resolved from the packaged `node_modules/prettier` runtime. The packaging step stages a stripped extension manifest so workspace metadata does not leak into the installed VSIX.

The formatter uses a stateful Eta scanner rather than a regex. It safely walks Eta tags, understands JavaScript strings, comments, template literals, and regex literals inside tags, formats JS payloads with Prettier, formats surrounding HTML through placeholder-based document formatting, and then stitches the template back together while preserving trim markers.

## Features

- Dedicated Eta language id (`eta`) with `.eta` file association.
- HTML highlighting outside Eta tags.
- Embedded JavaScript highlighting inside Eta tags.
- Distinct grammar rules for escaped output (`<%=`), raw output (`<%~`), comments (`<%#`), and execution tags (`<% ... %>`).
- Prettier-backed full document formatting for Eta templates.
- Whitespace-control delimiter markers (`-` and `_`) recognized on both opening and closing sides.
- Eta grammar injection for HTML files.
- Auto-closing pairs for Eta delimiters and a formatter entry point inside the extension.
- Useful snippets for common Eta patterns.
- Emmet support in Eta files via `eta -> html` mapping.

## Workspace Layout

```text
packages/prettier-plugin-eta/
  src/
  test/
src/
  extension.ts
  formatter.ts
syntaxes/
language-configuration.json
snippets/
```

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the plugin and extension:

   ```bash
   npm run build
   ```

3. Run type checks, syntax checks, plugin tests, and extension bundle checks:

   ```bash
   npm test
   ```

4. Build and validate a VSIX package:

   ```bash
   npm run package
   ```

5. In Cursor/VS Code, run **Extensions: Install from VSIX...** and choose the generated `.vsix`.

## CI And Release

- `.github/workflows/ci.yml` runs the dedicated `prettier-plugin-eta` build/test job and then validates the bundled extension runtime, syntax checks, VSIX packaging, and packaged artifact contents.
- `.github/workflows/publish-prettier-plugin.yml` publishes `packages/prettier-plugin-eta` to npm through npm trusted publishing.
- `.github/workflows/publish-extension.yml` publishes the packaged VSIX to Open VSX and attaches the same VSIX to the GitHub release for manual installation fallback.
- The repository now keeps the extension package and `prettier-plugin-eta` in lockstep version numbers. Update both package manifests together and record user-visible changes in `CHANGELOG.md`.

To publish the Prettier plugin:

1. Bump both `package.json` and `packages/prettier-plugin-eta/package.json` to the version you want to release.
2. Configure npm trusted publishing for package `prettier-plugin-eta` with:
   - GitHub owner/user: `JoobyPM`
   - repository: `eta-template-language`
   - workflow filename: `publish-prettier-plugin.yml`
3. Push a git tag in the form `prettier-plugin-eta-v<version>`.
4. Let GitHub Actions publish from that tag; no `NPM_TOKEN` secret is required for publishing.

The publish workflow verifies that the tag version matches the package version before it runs `npm publish`. If the package later needs private npm dependencies during CI, add a separate read-only install token rather than a publish token.

To publish the extension for Cursor through Open VSX:

1. Do the one-time Open VSX setup:
   - create an Eclipse account and sign the Open VSX Publisher Agreement
   - create an Open VSX access token
   - create the namespace that matches the extension `publisher` field:

     ```bash
     npx ovsx create-namespace JoobyPM -p <your-open-vsx-token>
     ```

   - add the token to GitHub at `Repository -> Settings -> Secrets and variables -> Actions -> New repository secret`
   - use `OVSX_PAT` as the secret name
2. Update both `package.json` files and `CHANGELOG.md`.
3. Merge to `main`.
4. Push a git tag in the form `eta-template-language-v<version>`.
5. Let `.github/workflows/publish-extension.yml` build, test, package, publish to Open VSX, and create a GitHub release with the `.vsix` asset.

After Open VSX accepts the publish, Cursor should pick it up from the Open VSX-backed marketplace. If Cursor takes time to surface the new version, install the VSIX from the GitHub release asset manually and retry later.

## Formatter Scope

The formatter intentionally focuses on safe full-document formatting:

- Eta tag scanning is structure-aware instead of regex-based.
- JavaScript inside execution and output tags is formatted with Prettier's JS parser.
- HTML around Eta tags is formatted with Prettier's HTML parser.
- Range formatting is intentionally not implemented yet.

## Known Limitations

- Prettier may reflow tagged templates such as `html\`...\`` inside Eta tags according to its own tagged-template heuristics. That behavior comes from Prettier's JavaScript formatter rather than the Eta parser.

## Snippets

- `etaout` — escaped output
- `etaraw` — raw output
- `etaif` — if block
- `etaelse` — else block
- `etafor` — for loop
- `etainclude` — include partial
- `etalayout` — layout declaration

## Sample

Open `samples/demo.eta` after installation for a quick smoke test.

## Validation

Run the extension grammar checks plus plugin tests:

```bash
npm test
```

## Project Docs

- Contributor workflow and release expectations: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Release history: [CHANGELOG.md](./CHANGELOG.md)
