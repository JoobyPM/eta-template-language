import * as vscode from "vscode";

import { etaFormatterOutputChannel, provideEtaFormattingEdits } from "./formatter";

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
}

export function deactivate(): void {}
