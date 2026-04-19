import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VSCE_BIN = path.join(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vsce.cmd" : "vsce"
);

const PACKAGE_CONTENTS = [
  "dist",
  "language-configuration.json",
  "snippets",
  "syntaxes",
  "README.md",
  "CHANGELOG.md",
  "LICENSE"
];

const PRETTIER_RUNTIME_FILES = [
  "package.json",
  "LICENSE",
  "THIRD-PARTY-NOTICES.md",
  "index.cjs",
  "index.mjs",
  "doc.js",
  "doc.mjs",
  "plugins/babel.js",
  "plugins/babel.mjs",
  "plugins/estree.js",
  "plugins/estree.mjs",
  "plugins/html.js",
  "plugins/html.mjs",
  "plugins/markdown.js",
  "plugins/markdown.mjs"
];

async function stagePackageContents(stageDir) {
  for (const entry of PACKAGE_CONTENTS) {
    await fs.cp(path.join(ROOT, entry), path.join(stageDir, entry), { recursive: true });
  }

  for (const entry of PRETTIER_RUNTIME_FILES) {
    await fs.cp(
      path.join(ROOT, "node_modules", "prettier", entry),
      path.join(stageDir, "node_modules", "prettier", entry),
      { recursive: true }
    );
  }
}

async function writeExtensionManifest(stageDir) {
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
  delete manifest.workspaces;
  delete manifest.scripts;
  delete manifest.devDependencies;
  if (manifest.dependencies) {
    delete manifest.dependencies.prettier;
    if (Object.keys(manifest.dependencies).length === 0) {
      delete manifest.dependencies;
    }
  }
  await fs.writeFile(path.join(stageDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(
    path.join(stageDir, ".vscodeignore"),
    "# Staging directory already contains only the files intended for the packaged VSIX.\n"
  );
  return manifest;
}

async function main() {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "eta-vsix-stage-"));

  try {
    const manifest = await writeExtensionManifest(stageDir);
    await stagePackageContents(stageDir);

    execFileSync(
      VSCE_BIN,
      ["package", "--out", path.join(ROOT, `eta-template-language-${manifest.version}.vsix`)],
      {
        cwd: stageDir,
        stdio: "inherit"
      }
    );
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
}

await main();
