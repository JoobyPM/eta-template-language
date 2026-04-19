import * as prettier from "prettier";

import etaPlugin from "../packages/prettier-plugin-eta/src/index.js";

export type EtaFormatterConfig = Record<string, unknown>;

export async function resolveEtaPrettierConfig(filepath: string | undefined): Promise<EtaFormatterConfig> {
  if (!filepath) {
    return {};
  }

  try {
    return (await prettier.resolveConfig(filepath)) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve Prettier config for ${filepath}: ${message}`);
  }
}

export async function formatEtaDocument(source: string, options: EtaFormatterConfig): Promise<string> {
  return prettier.format(source, {
    ...options,
    parser: "eta-template",
    plugins: [etaPlugin]
  });
}
