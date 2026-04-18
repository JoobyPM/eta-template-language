import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";

type PrettierModule = typeof import("prettier");
type EtaPluginModule = { default?: object } & Record<string, unknown>;

export const etaFormatterOutputChannel = vscode.window.createOutputChannel("Eta Formatter");

let lastShownErrorMessage: string | undefined;

async function importEsmModule<T>(specifier: string): Promise<T> {
  const importer = Function("target", "return import(target);") as (
    target: string,
  ) => Promise<T>;
  return importer(specifier);
}

async function loadPrettier(): Promise<PrettierModule> {
  return importEsmModule<PrettierModule>("prettier");
}

async function loadEtaPlugin(): Promise<object> {
  const pluginPath = path.resolve(__dirname, "..", "packages", "prettier-plugin-eta", "dist", "src", "index.js");
  const module = await importEsmModule<EtaPluginModule>(pathToFileURL(pluginPath).href);
  return module.default ?? module;
}

async function resolvePrettierConfig(
  prettier: PrettierModule,
  document: vscode.TextDocument,
): Promise<Record<string, unknown>> {
  if (document.uri.scheme !== "file") {
    return {};
  }

  try {
    return (await prettier.resolveConfig(document.uri.fsPath)) ?? {};
  } catch {
    return {};
  }
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  const end = document.positionAt(document.getText().length);
  return new vscode.Range(new vscode.Position(0, 0), end);
}

function resolvedEtaFormatHtml(config: Record<string, unknown>): boolean | undefined {
  const etaFormatHtml = (config as { etaFormatHtml?: unknown }).etaFormatHtml;
  return typeof etaFormatHtml === "boolean" ? etaFormatHtml : undefined;
}

export async function provideEtaFormattingEdits(
  document: vscode.TextDocument,
  options: vscode.FormattingOptions,
): Promise<vscode.TextEdit[]> {
  try {
    const prettier = await loadPrettier();
    const plugin = await loadEtaPlugin();
    const resolvedConfig = await resolvePrettierConfig(prettier, document);
    const formatterConfig = vscode.workspace.getConfiguration("etaFormatter", document.uri);

    const formatted = await prettier.format(document.getText(), {
      ...resolvedConfig,
      parser: "eta-template",
      plugins: [plugin],
      filepath: document.uri.fsPath,
      tabWidth: Number.isFinite(options.tabSize) ? options.tabSize : 2,
      useTabs: !options.insertSpaces,
      printWidth: formatterConfig.get<number>(
        "printWidth",
        typeof resolvedConfig.printWidth === "number" ? resolvedConfig.printWidth : 80,
      ),
      singleQuote: formatterConfig.get<boolean>(
        "singleQuote",
        typeof resolvedConfig.singleQuote === "boolean" ? resolvedConfig.singleQuote : false,
      ),
      semi: formatterConfig.get<boolean>(
        "semi",
        typeof resolvedConfig.semi === "boolean" ? resolvedConfig.semi : true,
      ),
      etaFormatHtml: formatterConfig.get<boolean>(
        "formatHtml",
        resolvedEtaFormatHtml(resolvedConfig) ?? true,
      ),
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
