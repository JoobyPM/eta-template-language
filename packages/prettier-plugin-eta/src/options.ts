import type { SupportOption } from "prettier";

// The plugin inherits standard Prettier core options such as `printWidth`,
// `tabWidth`, `useTabs`, `singleQuote`, `semi`, `trailingComma`, and
// `proseWrap`. Only Eta-specific options are declared here.
export const options: Record<string, SupportOption> = {
  etaFormatHtml: {
    type: "boolean",
    category: "Global",
    default: true,
    description: "Format non-Eta regions between Eta tags with Prettier's document parser."
  }
};

export const defaultOptions = {
  etaFormatHtml: true
};
