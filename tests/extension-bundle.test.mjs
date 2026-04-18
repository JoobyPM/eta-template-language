import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_BUNDLE_PATH = path.join(ROOT, "dist", "extension.js");

test("extension bundle inlines prettier runtime dependencies", async () => {
  const bundle = await fs.readFile(EXTENSION_BUNDLE_PATH, "utf8");

  assert.doesNotMatch(bundle, /\brequire\((["'])prettier\1\)/);
  assert.doesNotMatch(bundle, /\bimport\((["'])prettier\1\)/);
  assert.doesNotMatch(bundle, /Function\("target", "return import\(target\);"\)/);
  assert.match(bundle, /eta-template/);
});
