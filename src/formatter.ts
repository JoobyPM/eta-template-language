import * as vscode from "vscode";

import { formatEtaDocument, resolveEtaPrettierConfig, type EtaFormatterConfig } from "./runtime.js";

export const etaFormatterOutputChannel = vscode.window.createOutputChannel("Eta Formatter");

let lastShownErrorMessage: string | undefined;

function pickBool(config: EtaFormatterConfig, key: string): boolean | undefined {
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : undefined;
}

function pickEnum<const Values extends readonly string[]>(
  config: EtaFormatterConfig,
  key: string,
  allowedValues: Values
): Values[number] | undefined {
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" && allowedValues.includes(value) ? (value as Values[number]) : undefined;
}

function pickNumber(config: EtaFormatterConfig, key: string): number | undefined {
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  const end = document.positionAt(document.getText().length);
  return new vscode.Range(new vscode.Position(0, 0), end);
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
        pickNumber(resolvedConfig, "printWidth") ?? 80
      ),
      singleQuote: formatterConfig.get<boolean>(
        "singleQuote",
        pickBool(resolvedConfig, "singleQuote") ?? false
      ),
      semi: formatterConfig.get<boolean>(
        "semi",
        pickBool(resolvedConfig, "semi") ?? true
      ),
      trailingComma: pickEnum(resolvedConfig, "trailingComma", ["all", "es5", "none"] as const),
      proseWrap: pickEnum(resolvedConfig, "proseWrap", ["always", "never", "preserve"] as const),
      etaFormatHtml: formatterConfig.get<boolean>(
        "formatHtml",
        pickBool(resolvedConfig, "etaFormatHtml") ?? true
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
