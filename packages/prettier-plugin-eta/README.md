<p align="center">
  <img src="https://raw.githubusercontent.com/JoobyPM/eta-template-language/main/images/icon.png" width="144" alt="prettier-plugin-eta logo">
</p>

# prettier-plugin-eta

Prettier plugin for [Eta](https://eta.js.org/) templates.

## Install

```bash
npm install --save-dev prettier prettier-plugin-eta
```

## Usage

Create a `.prettierrc` file:

```json
{
  "plugins": ["prettier-plugin-eta"]
}
```

Then format Eta files with Prettier:

```bash
npx prettier --write "views/**/*.eta"
```

## Status

Current scope is safe full-document formatting for Eta templates:

- formats JavaScript inside Eta execution and output tags
- formats surrounding HTML through Prettier's HTML parser
- preserves Eta trim markers
- handles `%>` inside JavaScript strings and template literals
- honors standard Prettier options such as `printWidth`, `tabWidth`, `useTabs`, `singleQuote`, `semi`, `trailingComma`, and `proseWrap`

Range formatting is intentionally out of scope for the plugin package.
