import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import oniguruma from "vscode-oniguruma";
import vscodeTextmate from "vscode-textmate";

const { loadWASM, OnigScanner, OnigString } = oniguruma;
const { Registry, parseRawGrammar } = vscodeTextmate;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ETA_GRAMMAR_PATH = path.join(ROOT, "syntaxes", "eta.tmLanguage.json");
const ETA_INJECTION_GRAMMAR_PATH = path.join(ROOT, "syntaxes", "eta.injection.tmLanguage.json");
const ONIG_WASM_PATH = path.join(ROOT, "node_modules", "vscode-oniguruma", "release", "onig.wasm");
const ETA_DELIMITER_SCOPE = "punctuation.section.embedded.eta";

const MOCK_HTML_GRAMMAR = {
  scopeName: "text.html.basic",
  patterns: [{ include: "#tag" }],
  repository: {
    tag: {
      name: "meta.tag.html",
      begin: "<[/]?[A-Za-z][A-Za-z0-9:-]*",
      end: ">",
      patterns: [
        { include: "#double-quoted-string" },
        { match: "[A-Za-z_:][-A-Za-z0-9_:]*", name: "entity.other.attribute-name.html" },
        { match: "=", name: "punctuation.separator.key-value.html" },
        { match: "\\s+", name: "text.whitespace.html" },
      ],
    },
    "double-quoted-string": {
      name: "string.quoted.double.html",
      begin: '"',
      end: '"',
    },
  },
};

let wasmLoaded = false;

async function ensureOniguruma() {
  if (wasmLoaded) {
    return;
  }

  await loadWASM(await fs.readFile(ONIG_WASM_PATH));
  wasmLoaded = true;
}

async function loadRawGrammar(filePath) {
  return parseRawGrammar(await fs.readFile(filePath, "utf8"), filePath);
}

async function createRegistry() {
  await ensureOniguruma();

  return new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (sources) => new OnigScanner(sources),
      createOnigString: (text) => new OnigString(text),
    }),
    loadGrammar: async (scopeName) => {
      if (scopeName === "text.html.eta") {
        return loadRawGrammar(ETA_GRAMMAR_PATH);
      }

      if (scopeName === "text.html.eta.injection") {
        return loadRawGrammar(ETA_INJECTION_GRAMMAR_PATH);
      }

      if (scopeName === "text.html.basic") {
        return parseRawGrammar(JSON.stringify(MOCK_HTML_GRAMMAR), "mock-html.tmLanguage.json");
      }

      return null;
    },
    getInjections: (scopeName) => {
      if (scopeName === "text.html.basic") {
        return ["text.html.eta.injection"];
      }

      return [];
    },
  });
}

function tokenizeLine(grammar, line) {
  return grammar.tokenizeLine(line).tokens.map((token) => ({
    text: line.slice(token.startIndex, token.endIndex),
    scopes: token.scopes,
  }));
}

function tokenizeLines(grammar, lines) {
  let stack = vscodeTextmate.INITIAL;

  return lines.map((line) => {
    const result = grammar.tokenizeLine(line, stack);
    stack = result.ruleStack;

    return result.tokens.map((token) => ({
      text: line.slice(token.startIndex, token.endIndex),
      scopes: token.scopes,
    }));
  });
}

function findToken(tokens, text, scope) {
  return tokens.find((token) => token.text === text && token.scopes.includes(scope));
}

function countTokens(tokens, text, scope) {
  return tokens.filter((token) => token.text === text && token.scopes.includes(scope)).length;
}

test("exec tags close cleanly after an opening block brace", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokens = tokenizeLine(grammar, "<% if (it.extraClass) { %>");

  assert.ok(findToken(tokens, "<%", ETA_DELIMITER_SCOPE));
  assert.ok(findToken(tokens, "{", ETA_DELIMITER_SCOPE));
  assert.ok(findToken(tokens, "%>", ETA_DELIMITER_SCOPE));
  assert.equal(countTokens(tokens, "%>", ETA_DELIMITER_SCOPE), 1);
});

test("standalone closing braces keep Eta punctuation scopes", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokens = tokenizeLine(grammar, "<% } %>");

  assert.ok(findToken(tokens, "}", ETA_DELIMITER_SCOPE));
  assert.ok(findToken(tokens, "%>", ETA_DELIMITER_SCOPE));
});

test("percent-close inside JavaScript strings does not terminate the tag", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokens = tokenizeLine(grammar, '<% const x = "%>"; %>');

  assert.ok(findToken(tokens, "%>", "string.quoted.double.js"));
  assert.ok(findToken(tokens, "%>", ETA_DELIMITER_SCOPE));
  assert.equal(countTokens(tokens, "%>", ETA_DELIMITER_SCOPE), 1);
});

test("Eta injection inside HTML attribute strings stays balanced", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.basic");
  const line =
    '<table class="table table-condensed table-striped<% if (it.extraClass) { %> <%= it.extraClass %><% } %>" id="<%= it.tableId %>">';
  const tokens = tokenizeLine(grammar, line);

  assert.equal(countTokens(tokens, "<%", ETA_DELIMITER_SCOPE), 4);
  assert.equal(countTokens(tokens, "%>", ETA_DELIMITER_SCOPE), 4);
  assert.ok(findToken(tokens, "{", ETA_DELIMITER_SCOPE));
  assert.ok(findToken(tokens, "}", ETA_DELIMITER_SCOPE));
});

test("escaped output delimiters keep a shared Eta scope in attribute values", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokens = tokenizeLine(grammar, '            colspan="<%= it.tables.programmes.emptyColspan || 28 %>"');

  assert.ok(findToken(tokens, "<%", ETA_DELIMITER_SCOPE));
  assert.ok(findToken(tokens, "=", ETA_DELIMITER_SCOPE));
  assert.ok(findToken(tokens, "%>", ETA_DELIMITER_SCOPE));
});

test("Eta comment tags get dedicated comment scopes", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokens = tokenizeLine(grammar, "<%# note %>");

  assert.ok(findToken(tokens, "<%", ETA_DELIMITER_SCOPE));
  assert.ok(findToken(tokens, "%>", ETA_DELIMITER_SCOPE));
  assert.ok(tokens.some((token) => token.text.includes("note") && token.scopes.includes("comment.block.eta")));
});

test("Eta line comments still yield to the tag close delimiter", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokens = tokenizeLine(grammar, "<% // note %>");

  assert.ok(findToken(tokens, "//", "punctuation.definition.comment.js"));
  assert.ok(findToken(tokens, "%>", ETA_DELIMITER_SCOPE));
});

test("Eta number highlighting recognizes modern JavaScript numeric literals", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokens = tokenizeLine(grammar, "<%= .5 + 1e10 + 1.5e-3 + 0b10 + 0o77 + 0xFF + 123n + 1_000 %>");

  for (const literal of [".5", "1e10", "1.5e-3", "0b10", "0o77", "0xFF", "123n", "1_000"]) {
    assert.ok(findToken(tokens, literal, "constant.numeric.js"), `missing numeric token for ${literal}`);
  }
});

test("Eta injection stays balanced inside Alpine attribute expressions", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.basic");
  const line = `<span x-text="<%= it.tFn || "$t" %>('<%= it.loadingKey %>')"></span>`;
  const tokens = tokenizeLine(grammar, line);

  assert.equal(countTokens(tokens, "<%", ETA_DELIMITER_SCOPE), 2);
  assert.equal(countTokens(tokens, "%>", ETA_DELIMITER_SCOPE), 2);
  assert.ok(findToken(tokens, "||", "keyword.operator.js"));
});

test("Eta delimiters keep a single scope across carried state in nested HTML blocks", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const tokenLines = tokenizeLines(grammar, [
    "    <% if (it.loadingKey) { %>",
    "      <span>Loading</span>",
    "    <% } %>",
    "    <% if (it.labelExpr) { %>",
    "    <% } else if (it.labelKey) { %>",
    "    <% } %>",
  ]);

  for (const [index, tokens] of tokenLines.entries()) {
    const delimiters = tokens.filter((token) => ["<%", "%>", "{", "}"].includes(token.text));
    if (delimiters.length === 0) {
      continue;
    }
    assert.ok(
      delimiters.every((token) => token.scopes.includes(ETA_DELIMITER_SCOPE)),
      `expected every Eta delimiter to use the shared Eta delimiter scope on carried-state line ${index + 1}`,
    );
  }
});

test("Eta open delimiters share the same scope stack across exec and output tags", async () => {
  const registry = await createRegistry();
  const grammar = await registry.loadGrammar("text.html.eta");
  const execOpen = findToken(tokenizeLine(grammar, "<% if (it.ok) { %>"), "<%", ETA_DELIMITER_SCOPE);
  const escapedOpen = findToken(tokenizeLine(grammar, "<%= it.value %>"), "<%", ETA_DELIMITER_SCOPE);
  const rawOpen = findToken(tokenizeLine(grammar, "<%~ include('/x') %>"), "<%", ETA_DELIMITER_SCOPE);

  assert.ok(execOpen);
  assert.ok(escapedOpen);
  assert.ok(rawOpen);
  assert.deepEqual(execOpen.scopes, escapedOpen.scopes);
  assert.deepEqual(execOpen.scopes, rawOpen.scopes);
});
