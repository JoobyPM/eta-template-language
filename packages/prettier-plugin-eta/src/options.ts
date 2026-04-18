import type { SupportOption } from "prettier";

export const options: Record<string, SupportOption> = {
  etaFormatHtml: {
    type: "boolean",
    category: "Global",
    default: true,
    description: "Format HTML regions between Eta tags with Prettier's HTML parser."
  }
};

export const defaultOptions = {
  etaFormatHtml: true
};
