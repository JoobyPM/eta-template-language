import type * as prettier from "prettier";

import type { EtaPluginOptions } from "./types.js";

export function buildPrettierOptions(
  options: EtaPluginOptions,
  extras: Partial<prettier.Options> = {}
): prettier.Options {
  const resolved: Partial<prettier.Options> = {};

  if (options.printWidth !== undefined) {
    resolved.printWidth = options.printWidth;
  }
  if (options.proseWrap !== undefined) {
    resolved.proseWrap = options.proseWrap;
  }
  if (options.semi !== undefined) {
    resolved.semi = options.semi;
  }
  if (options.singleQuote !== undefined) {
    resolved.singleQuote = options.singleQuote;
  }
  if (options.tabWidth !== undefined) {
    resolved.tabWidth = options.tabWidth;
  }
  if (options.trailingComma !== undefined) {
    resolved.trailingComma = options.trailingComma;
  }
  if (options.useTabs !== undefined) {
    resolved.useTabs = options.useTabs;
  }

  return {
    ...resolved,
    ...extras
  };
}
