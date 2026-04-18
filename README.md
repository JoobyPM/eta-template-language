# Eta Template Language

Language support for Eta templates in Cursor and VS Code compatible editors.

## Source-of-truth alignment

This grammar is aligned to Eta v4 parsing behavior from `src/parse.ts` in the `bgub/eta` repository:

- Open tag shape: `<%` + optional trim marker (`-` or `_`) + optional whitespace + optional prefix (`=` interpolate, `~` raw).
- Close tag shape: optional whitespace + optional trim marker (`-` or `_`) + `%>`.
- JS strings/comments/template literals are valid inside tags (delegated to `source.js`).

## Features

- Dedicated Eta language id (`eta`) with `.eta` file association.
- HTML highlighting outside Eta tags.
- Embedded JavaScript highlighting inside Eta tags.
- Distinct grammar rules for escaped output (`<%=`), raw output (`<%~`), and execution tags (`<% ... %>`).
- Whitespace-control delimiter markers (`-` and `_`) recognized on both opening and closing sides, including forms like `<%- = it.name -%>`.
- Eta grammar injection for HTML files.
- Auto-closing pairs for Eta delimiters.
- Useful snippets for common Eta patterns.
- Emmet support in Eta files via `eta -> html` mapping.

## Install (local development)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build a VSIX package:

   ```bash
   npm run package
   ```

3. In Cursor/VS Code, run **Extensions: Install from VSIX...** and choose the generated `.vsix`.

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

## Project position

This repository is an independent Eta language extension and intentionally contains no references to other Eta extension projects.
