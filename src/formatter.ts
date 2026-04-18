import * as vscode from "vscode";

import { formatEtaDocument, resolveEtaPrettierConfig, type EtaFormatterConfig } from "./runtime.js";

export const etaFormatterOutputChannel = vscode.window.createOutputChannel("Eta Formatter");

let lastShownErrorMessage: string | undefined;

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  const end = document.positionAt(document.getText().length);
  return new vscode.Range(new vscode.Position(0, 0), end);
}

function resolvedEtaFormatHtml(config: EtaFormatterConfig): boolean | undefined {
  const etaFormatHtml = (config as { etaFormatHtml?: unknown }).etaFormatHtml;
  return typeof etaFormatHtml === "boolean" ? etaFormatHtml : undefined;
}

function resolvedTrailingComma(config: EtaFormatterConfig): "all" | "es5" | "none" | undefined {
  const trailingComma = (config as { trailingComma?: unknown }).trailingComma;
  return trailingComma === "all" || trailingComma === "es5" || trailingComma === "none"
    ? trailingComma
    : undefined;
}

function resolvedProseWrap(config: EtaFormatterConfig): "always" | "never" | "preserve" | undefined {
  const proseWrap = (config as { proseWrap?: unknown }).proseWrap;
  return proseWrap === "always" || proseWrap === "never" || proseWrap === "preserve" ? proseWrap : undefined;
}

function clampTabWidth(tabSize: number): number {
  return Math.max(1, Math.trunc(tabSize));
}

export async function provideEtaFormattingEdits(
  document: vscode.TextDocument,
  options: vscode.FormattingOptions
): Promise<vscode.TextEdit[]> {
  try {
    const resolvedConfig =
      document.uri.scheme === "file" ? await resolveEtaPrettierConfig(document.uri.fsPath) : {};
    const formatterConfig = vscode.workspace.getConfiguration("etaFormatter", document.uri);

    const formatted = await formatEtaDocument(document.getText(), {
      ...resolvedConfig,
      filepath: document.uri.scheme === "file" ? document.uri.fsPath : undefined,
      tabWidth: clampTabWidth(Number.isFinite(options.tabSize) ? options.tabSize : 2),
      useTabs: !options.insertSpaces,
      printWidth: formatterConfig.get<number>(
        "printWidth",
        typeof resolvedConfig.printWidth === "number" ? resolvedConfig.printWidth : 80
      ),
      singleQuote: formatterConfig.get<boolean>(
        "singleQuote",
        typeof resolvedConfig.singleQuote === "boolean" ? resolvedConfig.singleQuote : false
      ),
      semi: formatterConfig.get<boolean>(
        "semi",
        typeof resolvedConfig.semi === "boolean" ? resolvedConfig.semi : true
      ),
      trailingComma: resolvedTrailingComma(resolvedConfig),
      proseWrap: resolvedProseWrap(resolvedConfig),
      etaFormatHtml: formatterConfig.get<boolean>(
        "formatHtml",
        resolvedEtaFormatHtml(resolvedConfig) ?? true
      )
    });

    if (formatted === document.getText()) {
      lastShownErrorMessage = undefined;
      return [];
    }

    lastShownErrorMessage = undefined;
    return [vscode.TextEdit.replace(fullDocumentRange(document), formatted)];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const target = document.uri.scheme === "file" ? document.uri.fsPath : document.uri.toString();
    etaFormatterOutputChannel.appendLine(`[${new Date().toISOString()}] Formatting failed for ${target}`);
    etaFormatterOutputChannel.appendLine(`Eta formatting failed: ${message}`);
    if (error instanceof Error && error.stack) {
      etaFormatterOutputChannel.appendLine(error.stack);
    }
    etaFormatterOutputChannel.appendLine("");

    if (lastShownErrorMessage !== message) {
      lastShownErrorMessage = message;
      void vscode.window.showErrorMessage(`Eta formatting failed: ${message}`);
    }
    return [];
  }
}
