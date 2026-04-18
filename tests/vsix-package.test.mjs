import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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

function ensureUnzipAvailable(t) {
  const probe = spawnSync("unzip", ["-v"], { encoding: "utf8" });
  if (probe.error?.code === "ENOENT") {
    t.skip("unzip is not available on PATH");
    return false;
  }
  if (probe.error) {
    throw probe.error;
  }
  return probe.status === 0;
}

test("packaged VSIX contains the bundled extension runtime", async (t) => {
  if (!ensureUnzipAvailable(t)) {
    return;
  }

  const version = await readPackageVersion();
  const vsixPath = path.join(ROOT, `eta-template-language-${version}.vsix`);
  const entries = execFileSync("unzip", ["-Z1", vsixPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

  assert.ok(entries.includes("extension/dist/extension.js"), "VSIX should package extension/dist/extension.js");
  assert.ok(
    entries.includes("extension/node_modules/prettier/package.json"),
    "VSIX should package the explicit prettier runtime dependency"
  );
  assert.ok(
    !entries.some((entry) => entry.includes("packages/prettier-plugin-eta/")),
    "VSIX should not package the workspace plugin sources"
  );
  assert.ok(
    !entries.some((entry) => entry.includes(".github/workflows/")),
    "VSIX should not package GitHub workflow files"
  );

  const packagedManifest = JSON.parse(
    execFileSync("unzip", ["-p", vsixPath, "extension/package.json"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    })
  );
  assert.equal(packagedManifest.workspaces, undefined, "VSIX manifest should not expose workspace metadata");

  const bundle = execFileSync("unzip", ["-p", vsixPath, "extension/dist/extension.js"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });

  // The packaged VSIX intentionally ships prettier as an explicit runtime dependency.
  // This bundle must therefore use a stable static require, not a dynamic import path.
  assert.doesNotMatch(bundle, /\bimport\((["'])prettier\1\)/);
  assert.match(bundle, /\brequire\((["'])prettier\1\)/);
});

test("packaged VSIX bundle can load and format an Eta document", async (t) => {
  if (!ensureUnzipAvailable(t)) {
    return;
  }

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
