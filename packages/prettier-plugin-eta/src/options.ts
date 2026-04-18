import type { SupportOption } from "prettier";

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
