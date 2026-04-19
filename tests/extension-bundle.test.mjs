import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertBundledExtensionFormats } from "./extension-runtime-smoke.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_BUNDLE_PATH = path.join(ROOT, "dist", "extension.js");

test("extension bundle uses static runtime imports without dynamic loading", async () => {
  const bundle = await fs.readFile(EXTENSION_BUNDLE_PATH, "utf8");

  assert.doesNotMatch(bundle, /\bimport\((["'])prettier\1\)/);
  assert.doesNotMatch(bundle, /Function\("target", "return import\(target\);"\)/);
  assert.match(bundle, /\brequire\((["'])prettier\1\)/);
});

test("extension bundle inlines the formatter settings and tag matcher", async () => {
  const bundle = await fs.readFile(EXTENSION_BUNDLE_PATH, "utf8");

  assert.match(bundle, /etaFormatter/, "bundle should expose the etaFormatter configuration namespace");
  assert.match(bundle, /eta-template/, "bundle should register the eta-template Prettier parser");
  assert.match(bundle, /findMatchingHtmlTag/, "bundle should include the HTML tag matcher entry point");
  assert.match(bundle, /htmlWhitespaceSensitivity/, "bundle should wire htmlWhitespaceSensitivity through to Prettier");
  assert.match(bundle, /scanEtaTagEnd/, "bundle should reuse the Eta lexer tag-end scanner");
});

test("extension bundle registers formatter and highlight providers that work end-to-end", async () => {
  await assertBundledExtensionFormats(EXTENSION_BUNDLE_PATH);
});
