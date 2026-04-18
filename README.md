# Eta Template Language

Language support for Eta templates in Cursor and VS Code compatible editors.

## Features

- Syntax highlighting for `.eta` files.
- Embedded JavaScript highlighting inside Eta delimiters.
- Eta tag highlighting when editing HTML files (via injection grammar).
- Auto-closing and bracket support for Eta delimiters.
- Handy snippets for common Eta patterns.
- Emmet mapped to HTML in Eta files.

## Usage

1. Install dependencies: `npm install`
2. Package extension: `npm run package`
3. Install the generated `.vsix` in Cursor or VS Code.

## Snippets

- `etaout` – escaped output
- `etaraw` – raw output
- `etaif` – if block
- `etaelse` – else block
- `etafor` – for loop
- `etainclude` – include partial
- `etalayout` – layout declaration

## Notes

This repository is an independent Eta language extension and intentionally contains no references to other Eta extension projects.
