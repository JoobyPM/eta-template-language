import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function assertBundledExtensionFormats(bundlePath) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eta-extension-smoke-"));
  const vscodeModuleDir = path.join(tempDir, "node_modules", "vscode");
  const prettierModuleDir = path.join(tempDir, "node_modules", "prettier");
  await fs.mkdir(vscodeModuleDir, { recursive: true });
  try {
    await fs.symlink(path.join(ROOT, "node_modules", "prettier"), prettierModuleDir, "dir");
  } catch {
    await fs.cp(path.join(ROOT, "node_modules", "prettier"), prettierModuleDir, { recursive: true });
  }
  await fs.writeFile(
    path.join(vscodeModuleDir, "index.js"),
    `
let registeredProvider;

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

const TextEdit = {
  replace(range, newText) {
    return { range, newText };
  }
};

module.exports = {
  __getRegisteredProvider() {
    return registeredProvider;
  },
  window: {
    createOutputChannel() {
      return {
        appendLine() {},
        dispose() {}
      };
    },
    showErrorMessage() {
      return Promise.resolve(undefined);
    }
  },
  languages: {
    registerDocumentFormattingEditProvider(_selector, provider) {
      registeredProvider = provider;
      return {
        dispose() {}
      };
    }
  },
  workspace: {
    getConfiguration() {
      return {
        get(_key, fallback) {
          return fallback;
        }
      };
    }
  },
  Position,
  Range,
  TextEdit
};
`
  );

  const tempBundlePath = path.join(tempDir, "extension.js");
  await fs.copyFile(bundlePath, tempBundlePath);

  const require = createRequire(path.join(tempDir, "index.cjs"));
  const vscode = require("vscode");
  const extension = require(tempBundlePath);

  extension.activate({ subscriptions: [] });
  const provider = vscode.__getRegisteredProvider();

  assert.ok(provider, "extension should register a document formatting provider");

  const source = "<div><%=foo +bar%></div>";
  const document = {
    uri: {
      scheme: "file",
      fsPath: path.join(tempDir, "sample.eta"),
      toString() {
        return this.fsPath;
      }
    },
    getText() {
      return source;
    },
    positionAt(offset) {
      return new vscode.Position(0, offset);
    }
  };

  const edits = await provider.provideDocumentFormattingEdits(document, {
    tabSize: 2,
    insertSpaces: true
  });

  assert.equal(edits.length, 1);
  assert.equal(edits[0]?.newText, "<div><%= foo + bar %></div>\n");
}
