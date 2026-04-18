import type * as prettier from "prettier";

import type { EtaPluginOptions } from "./types.js";

export function buildPrettierOptions(
  options: EtaPluginOptions,
  extras: Partial<prettier.Options> = {}
): prettier.Options {
  return Object.fromEntries(
    Object.entries({
      printWidth: options.printWidth,
      proseWrap: options.proseWrap,
      semi: options.semi,
      singleQuote: options.singleQuote,
      tabWidth: options.tabWidth,
      trailingComma: options.trailingComma,
      useTabs: options.useTabs,
      ...extras
    }).filter(([, value]) => value !== undefined)
  ) as prettier.Options;
}
