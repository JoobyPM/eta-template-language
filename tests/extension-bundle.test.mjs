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
  assert.match(bundle, /eta-template/);
});

test("extension bundle can be loaded and format an Eta document", async () => {
  await assertBundledExtensionFormats(EXTENSION_BUNDLE_PATH);
});
