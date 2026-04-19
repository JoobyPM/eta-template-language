import * as vscode from "vscode";

import { findMatchingHtmlTag, type NameRange } from "../packages/prettier-plugin-eta/src/html-tag-matcher.js";

function rangeFromName(document: vscode.TextDocument, name: NameRange): vscode.Range {
  return new vscode.Range(document.positionAt(name.start), document.positionAt(name.end));
}

export const etaDocumentHighlightProvider: vscode.DocumentHighlightProvider = {
  provideDocumentHighlights(document, position) {
    const match = findMatchingHtmlTag(document.getText(), document.offsetAt(position));
    if (!match) {
      return undefined;
    }

    const highlights: vscode.DocumentHighlight[] = [
      new vscode.DocumentHighlight(rangeFromName(document, match.primary), vscode.DocumentHighlightKind.Text)
    ];

    if (match.mate) {
      highlights.push(
        new vscode.DocumentHighlight(rangeFromName(document, match.mate), vscode.DocumentHighlightKind.Text)
      );
    }

    return highlights;
  }
};
