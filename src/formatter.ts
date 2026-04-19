import * as vscode from "vscode";

import { formatEtaDocument, resolveEtaPrettierConfig, type EtaFormatterConfig } from "./runtime.js";

export const etaFormatterOutputChannel = vscode.window.createOutputChannel("Eta Formatter");

let lastShownErrorMessage: string | undefined;

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  const end = document.positionAt(document.getText().length);
  return new vscode.Range(new vscode.Position(0, 0), end);
}

function clampTabWidth(tabSize: number): number {
  return Math.max(1, Math.trunc(tabSize));
}

function readPrettierValue(resolvedConfig: EtaFormatterConfig, key: string): unknown {
  return (resolvedConfig as Record<string, unknown>)[key];
}

interface PickedOption<T> {
  formatterConfig: vscode.WorkspaceConfiguration;
  resolvedConfig: EtaFormatterConfig;
  settingKey: string;
  prettierKey?: string;
  fallback: T;
}

function pickValidatedBool(options: PickedOption<boolean>): boolean {
  const { formatterConfig, resolvedConfig, settingKey, prettierKey = settingKey, fallback } = options;
  const prettierValue = readPrettierValue(resolvedConfig, prettierKey);
  const seed = typeof prettierValue === "boolean" ? prettierValue : fallback;
  const raw = formatterConfig.get<boolean>(settingKey, seed);
  return typeof raw === "boolean" ? raw : fallback;
}

function pickValidatedNumber(options: PickedOption<number>): number {
  const { formatterConfig, resolvedConfig, settingKey, prettierKey = settingKey, fallback } = options;
  const prettierValue = readPrettierValue(resolvedConfig, prettierKey);
  const seed = typeof prettierValue === "number" && Number.isFinite(prettierValue) ? prettierValue : fallback;
  const raw = formatterConfig.get<number>(settingKey, seed);
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function pickValidatedEnum<const Values extends readonly string[]>(
  options: PickedOption<Values[number]> & { allowedValues: Values }
): Values[number] {
  const { formatterConfig, resolvedConfig, settingKey, prettierKey = settingKey, allowedValues, fallback } = options;
  const prettierValue = readPrettierValue(resolvedConfig, prettierKey);
  const seed =
    typeof prettierValue === "string" && allowedValues.includes(prettierValue)
      ? (prettierValue as Values[number])
      : fallback;
  const raw = formatterConfig.get<string>(settingKey, seed);
  return typeof raw === "string" && allowedValues.includes(raw) ? (raw as Values[number]) : fallback;
}

export async function provideEtaFormattingEdits(
  document: vscode.TextDocument,
  options: vscode.FormattingOptions
): Promise<vscode.TextEdit[]> {
  try {
    const resolvedConfig = document.uri.scheme === "file" ? await resolveEtaPrettierConfig(document.uri.fsPath) : {};
    const formatterConfig = vscode.workspace.getConfiguration("etaFormatter", document.uri);

    const formatted = await formatEtaDocument(document.getText(), {
      ...resolvedConfig,
      filepath: document.uri.scheme === "file" ? document.uri.fsPath : undefined,
      tabWidth: clampTabWidth(Number.isFinite(options.tabSize) ? options.tabSize : 2),
      useTabs: !options.insertSpaces,
      printWidth: pickValidatedNumber({ formatterConfig, resolvedConfig, settingKey: "printWidth", fallback: 80 }),
      singleQuote: pickValidatedBool({ formatterConfig, resolvedConfig, settingKey: "singleQuote", fallback: false }),
      semi: pickValidatedBool({ formatterConfig, resolvedConfig, settingKey: "semi", fallback: true }),
      trailingComma: pickValidatedEnum({
        formatterConfig,
        resolvedConfig,
        settingKey: "trailingComma",
        allowedValues: ["all", "es5", "none"] as const,
        fallback: "all"
      }),
      htmlWhitespaceSensitivity: pickValidatedEnum({
        formatterConfig,
        resolvedConfig,
        settingKey: "htmlWhitespaceSensitivity",
        allowedValues: ["css", "strict", "ignore"] as const,
        fallback: "ignore"
      }),
      proseWrap: pickValidatedEnum({
        formatterConfig,
        resolvedConfig,
        settingKey: "proseWrap",
        allowedValues: ["always", "never", "preserve"] as const,
        fallback: "preserve"
      }),
      etaFormatHtml: pickValidatedBool({
        formatterConfig,
        resolvedConfig,
        settingKey: "formatHtml",
        prettierKey: "etaFormatHtml",
        fallback: true
      })
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
