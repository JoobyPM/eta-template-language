<p align="center">
  <img src="https://raw.githubusercontent.com/JoobyPM/eta-template-language/main/images/icon.png" width="144" alt="prettier-plugin-eta logo">
</p>

# prettier-plugin-eta

Prettier plugin for [Eta](https://eta.js.org/) templates.

## Install

```bash
npm install --save-dev prettier prettier-plugin-eta
```

## Use

```json
{
  "plugins": ["prettier-plugin-eta"]
}
```

```bash
npx prettier --write "views/**/*.eta"
```

## Scope

Safe full-document formatting for Eta templates:

- formats JavaScript inside execution and output tags with `babel-ts`;
- formats surrounding HTML through Prettier's HTML parser;
- preserves Eta trim markers, `%>` inside JavaScript strings, and template-literal content;
- honors standard Prettier options (`printWidth`, `tabWidth`, `useTabs`, `singleQuote`, `semi`, `trailingComma`, `proseWrap`, `htmlWhitespaceSensitivity`).

Range formatting is intentionally out of scope.

## Secondary export: `prettier-plugin-eta/html-tag-matcher`

For editor tooling that needs to find matching HTML tag pairs in Eta templates (e.g. VS Code document-highlight providers), the plugin exposes its Eta-aware matcher as a separate entry point:

```ts
import { findMatchingHtmlTag } from "prettier-plugin-eta/html-tag-matcher";

const match = findMatchingHtmlTag(source, cursorOffset);
if (match?.mate) {
  // match.primary and match.mate are { start, end } offsets into `source`.
}
```

The matcher skips `<% … %>` regions using the plugin's lexer so tags inside Eta control blocks stay balanced.

## Links

- Repository and issues: <https://github.com/JoobyPM/eta-template-language>
- Release notes: <https://github.com/JoobyPM/eta-template-language/blob/main/CHANGELOG.md>
