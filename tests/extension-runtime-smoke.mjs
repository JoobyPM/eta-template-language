import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function installPrettierRuntime(tempDir, prettierSourceDir) {
  const prettierModuleDir = path.join(tempDir, "node_modules", "prettier");
  await fs.mkdir(path.dirname(prettierModuleDir), { recursive: true });

  try {
    await fs.symlink(prettierSourceDir, prettierModuleDir, "dir");
  } catch {
    await fs.cp(prettierSourceDir, prettierModuleDir, { recursive: true });
  }
}

async function assertFormattingCase(provider, vscode, tempDir, relativePath, source, expected) {
  const document = {
    uri: {
      scheme: "file",
      fsPath: path.join(tempDir, relativePath),
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
  assert.equal(edits[0]?.newText, expected);
}

export async function assertBundledExtensionFormats(
  bundlePath,
  { prettierSourceDir = path.join(ROOT, "node_modules", "prettier") } = {}
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eta-extension-smoke-"));
  try {
    const vscodeModuleDir = path.join(tempDir, "node_modules", "vscode");
    await fs.mkdir(vscodeModuleDir, { recursive: true });
    await installPrettierRuntime(tempDir, prettierSourceDir);
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

    await assertFormattingCase(provider, vscode, tempDir, "sample.eta", "<div><%=foo +bar%></div>", "<div><%= foo + bar %></div>\n");
    await assertFormattingCase(
      provider,
      vscode,
      tempDir,
      "configuration.md.eta",
      "# Config\n\n<%=it.value%>\n",
      "# Config\n\n<%= it.value %>\n"
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
