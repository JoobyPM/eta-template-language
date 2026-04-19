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

function computeLineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function lineForOffset(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if ((lineStarts[mid] ?? 0) <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

function createEtaDocument(vscode, tempDir, relativePath, source) {
  const lineStarts = computeLineStarts(source);
  return {
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
    offsetAt(position) {
      const clampedLine = Math.max(0, Math.min(position.line, lineStarts.length - 1));
      const lineStart = lineStarts[clampedLine] ?? 0;
      return lineStart + position.character;
    },
    positionAt(offset) {
      const clamped = Math.max(0, Math.min(offset, source.length));
      const line = lineForOffset(lineStarts, clamped);
      const character = clamped - (lineStarts[line] ?? 0);
      return new vscode.Position(line, character);
    }
  };
}

async function formatEtaViaProvider(provider, vscode, tempDir, relativePath, source) {
  const document = createEtaDocument(vscode, tempDir, relativePath, source);
  const edits = await provider.provideDocumentFormattingEdits(document, {
    tabSize: 2,
    insertSpaces: true
  });
  assert.equal(edits.length, 1, "formatting provider should emit a single edit");
  return edits[0]?.newText ?? "";
}

async function assertFormattingCase(provider, vscode, tempDir, relativePath, source, expected) {
  const actual = await formatEtaViaProvider(provider, vscode, tempDir, relativePath, source);
  assert.equal(actual, expected);
}

function assertHighlightCase(provider, vscode, tempDir, source, cursorOffset, expectedOffsetRanges) {
  const document = createEtaDocument(vscode, tempDir, "sample.eta", source);
  const position = document.positionAt(cursorOffset);
  const highlights = provider.provideDocumentHighlights(document, position);
  assert.ok(Array.isArray(highlights), "highlight provider should return an array");
  assert.equal(highlights.length, expectedOffsetRanges.length, "unexpected number of highlights");
  const actual = highlights
    .map((highlight) => [document.offsetAt(highlight.range.start), document.offsetAt(highlight.range.end)])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const expected = expectedOffsetRanges
    .map((range) => [range[0], range[1]])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  assert.deepEqual(actual, expected);
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
let registeredFormattingProvider;
let registeredHighlightProvider;

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

class DocumentHighlight {
  constructor(range, kind) {
    this.range = range;
    this.kind = kind;
  }
}

const DocumentHighlightKind = {
  Text: 0,
  Read: 1,
  Write: 2
};

const TextEdit = {
  replace(range, newText) {
    return { range, newText };
  }
};

module.exports = {
  __getRegisteredFormattingProvider() {
    return registeredFormattingProvider;
  },
  __getRegisteredHighlightProvider() {
    return registeredHighlightProvider;
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
      registeredFormattingProvider = provider;
      return {
        dispose() {}
      };
    },
    registerDocumentHighlightProvider(_selector, provider) {
      registeredHighlightProvider = provider;
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
  DocumentHighlight,
  DocumentHighlightKind,
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
    const formattingProvider = vscode.__getRegisteredFormattingProvider();
    const highlightProvider = vscode.__getRegisteredHighlightProvider();

    assert.ok(formattingProvider, "extension should register a document formatting provider");
    assert.ok(highlightProvider, "extension should register a document highlight provider");

    await assertFormattingCase(
      formattingProvider,
      vscode,
      tempDir,
      "sample.eta",
      "<div><%=foo +bar%></div>",
      "<div><%= foo + bar %></div>\n"
    );
    await assertFormattingCase(
      formattingProvider,
      vscode,
      tempDir,
      "configuration.md.eta",
      "# Config\n\n<%=it.value%>\n",
      "# Config\n\n<%= it.value %>\n"
    );

    const hugSource =
      '<button><span><i class="fa fa-spinner"></i> <span x-text="$t(\'ems.import_modal.triggering\')">Triggering now</span></span></button>\n';
    const formattedHug = await formatEtaViaProvider(formattingProvider, vscode, tempDir, "hug.eta", hugSource);
    assert.doesNotMatch(
      formattedHug,
      /><i\b/,
      "default htmlWhitespaceSensitivity should be 'ignore' — no inline hug pattern expected"
    );
    assert.doesNotMatch(
      formattedHug,
      /><span\b/,
      "default htmlWhitespaceSensitivity should be 'ignore' — no inline hug pattern expected"
    );
    assert.match(formattedHug, /<i class="fa fa-spinner"><\/i>/, "inline content should remain intact");

    const singleLineSource = "<div><span>x</span></div>";
    assertHighlightCase(
      highlightProvider,
      vscode,
      tempDir,
      singleLineSource,
      singleLineSource.indexOf("div") + 1,
      [
        [singleLineSource.indexOf("div"), singleLineSource.indexOf("div") + 3],
        [singleLineSource.lastIndexOf("div"), singleLineSource.lastIndexOf("div") + 3]
      ]
    );

    const multiLineSource = [
      "<section>",
      '  <div class="<%= it.cls %>">',
      "    <% if (it.ready) { %>",
      "      <span><%= it.label %></span>",
      "    <% } %>",
      "  </div>",
      "</section>",
      ""
    ].join("\n");
    assertHighlightCase(
      highlightProvider,
      vscode,
      tempDir,
      multiLineSource,
      multiLineSource.indexOf("section") + 1,
      [
        [multiLineSource.indexOf("section"), multiLineSource.indexOf("section") + 7],
        [multiLineSource.lastIndexOf("section"), multiLineSource.lastIndexOf("section") + 7]
      ]
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
