# Contributing

## Scope

This repository contains two packages that move together:

- the root `eta-template-language` extension
- `packages/prettier-plugin-eta`

User-visible changes should keep both package versions in lockstep and update [CHANGELOG.md](./CHANGELOG.md).

## Branches

- Branch from `main`.
- Use one topic branch per change.
- Keep branches small enough that formatter, grammar, and packaging regressions can be traced to a single change set.

## Local Setup

```bash
npm install
```

## Required Validation

Run these before opening or updating a PR:

```bash
npm test
npm run package
```

`npm test` covers:

- root and plugin TypeScript checks
- grammar generation sync checks
- TextMate tokenization regressions
- Prettier plugin regression tests
- extension bundle regression checks

`npm run package` additionally verifies the packaged VSIX contents.

## Generated Files

Do not hand-edit generated grammar JSON files unless you are also updating the source generator.

Source of truth:

- [scripts/generate_grammars.py](./scripts/generate_grammars.py)

Generated artifacts:

- [syntaxes/eta.tmLanguage.json](./syntaxes/eta.tmLanguage.json)
- [syntaxes/eta.injection.tmLanguage.json](./syntaxes/eta.injection.tmLanguage.json)

After changing the grammar generator, regenerate and rerun the syntax tests.

## Formatter Changes

When changing formatter behavior:

- add or update regression tests in `packages/prettier-plugin-eta/test`
- verify idempotence for the affected cases
- check both HTML-flavored `.eta` templates and Markdown-flavored `.md.eta` / `.markdown.eta` templates
- keep user Prettier settings as the source of truth unless there is a documented Eta-specific override
- exact-output assertions are sensitive to Prettier upgrades; when bumping `prettier`, rerun the plugin test suite and review any expectations that hard-code wrapped JS or Markdown output before updating snapshots or strings

## Extension Packaging

The extension is bundled into `dist/extension.js`. The VSIX also ships `node_modules/prettier` as an explicit runtime dependency, so avoid dynamic loading tricks and keep runtime dependencies intentional and test-covered. `npm run package` stages a stripped extension manifest before invoking `vsce`, which keeps monorepo workspace metadata out of the shipped package.

If you touch extension runtime loading:

- keep `vscode` as the only external dependency in the bundle
- rerun `npm run package`
- confirm the VSIX smoke test still passes

## Releases

### Extension and plugin versioning

- update `package.json`
- update `packages/prettier-plugin-eta/package.json`
- update `CHANGELOG.md`

### Publishing `prettier-plugin-eta`

The plugin is published through npm trusted publishing.

1. Update both package versions.
2. Merge to `main`.
3. Push a tag in the form:

   ```bash
   git tag prettier-plugin-eta-v<version>
   git push origin prettier-plugin-eta-v<version>
   ```

4. Let `.github/workflows/publish-prettier-plugin.yml` publish the plugin.

## Pull Requests

PRs should describe:

- the user-visible behavior change
- the regression coverage added or updated
- any release impact, especially version bumps or npm publishing implications
