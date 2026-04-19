import * as vscode from "vscode";

import { etaFormatterOutputChannel, provideEtaFormattingEdits } from "./formatter.js";
import { etaDocumentHighlightProvider } from "./highlight-provider.js";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(etaFormatterOutputChannel);
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      { language: "eta" },
      {
        provideDocumentFormattingEdits: provideEtaFormattingEdits,
      },
    ),
  );
  context.subscriptions.push(
    vscode.languages.registerDocumentHighlightProvider(
      { language: "eta" },
      etaDocumentHighlightProvider,
    ),
  );
}

export function deactivate(): void {}
