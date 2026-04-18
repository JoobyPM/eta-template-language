import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertBundledExtensionFormats } from "./extension-runtime-smoke.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readPackageVersion() {
  const packageJson = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
  return packageJson.version;
}

test("packaged VSIX contains the bundled extension runtime", async () => {
  const version = await readPackageVersion();
  const vsixPath = path.join(ROOT, `eta-template-language-${version}.vsix`);
  const entries = execFileSync("unzip", ["-Z1", vsixPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

  assert.ok(entries.includes("extension/dist/extension.js"));
  assert.ok(entries.includes("extension/node_modules/prettier/package.json"));
  assert.ok(!entries.some((entry) => entry.includes("packages/prettier-plugin-eta/")));
  assert.ok(!entries.some((entry) => entry.includes(".github/workflows/")));

  const bundle = execFileSync("unzip", ["-p", vsixPath, "extension/dist/extension.js"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });

  assert.doesNotMatch(bundle, /\bimport\((["'])prettier\1\)/);
  assert.match(bundle, /\brequire\((["'])prettier\1\)/);
});

test("packaged VSIX bundle can load and format an Eta document", async () => {
  const version = await readPackageVersion();
  const vsixPath = path.join(ROOT, `eta-template-language-${version}.vsix`);
  const tempBundlePath = path.join(ROOT, "dist", `vsix-extension-${version}.js`);

  try {
    await fs.writeFile(
      tempBundlePath,
      execFileSync("unzip", ["-p", vsixPath, "extension/dist/extension.js"], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024
      })
    );

    await assertBundledExtensionFormats(tempBundlePath);
  } finally {
    await fs.rm(tempBundlePath, { force: true });
  }
});
