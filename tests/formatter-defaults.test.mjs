import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const FORMATTER_SOURCE_PATH = path.join(ROOT, "src", "formatter.ts");

// Locked contract: each `etaFormatter.*` setting declared in package.json
// must carry the same default as the hard-coded fallback that `formatter.ts`
// passes to the corresponding `pickValidated*` helper. Drift between the two
// is a silent bug — the schema default applies when a setting is unset but
// the code fallback applies when a setting is set to an invalid value.
const EXPECTED_DEFAULTS = [
  { setting: "etaFormatter.formatHtml", fallback: "true" },
  { setting: "etaFormatter.printWidth", fallback: "80" },
  { setting: "etaFormatter.singleQuote", fallback: "false" },
  { setting: "etaFormatter.semi", fallback: "true" },
  { setting: "etaFormatter.trailingComma", fallback: '"all"' },
  { setting: "etaFormatter.proseWrap", fallback: '"preserve"' },
  { setting: "etaFormatter.htmlWhitespaceSensitivity", fallback: '"ignore"' }
];

function extractFallback(source, settingKey) {
  const shortKey = settingKey.replace(/^etaFormatter\./, "");
  const pattern = new RegExp(`settingKey:\\s*"${shortKey}"[\\s\\S]*?fallback:\\s*([^\\s,}]+)`);
  const match = source.match(pattern);
  return match ? match[1] : null;
}

test("etaFormatter schema defaults match formatter.ts fallbacks", async () => {
  const manifest = JSON.parse(await fs.readFile(PACKAGE_JSON_PATH, "utf8"));
  const formatterSource = await fs.readFile(FORMATTER_SOURCE_PATH, "utf8");
  const schema = manifest.contributes?.configuration?.properties ?? {};

  for (const { setting, fallback } of EXPECTED_DEFAULTS) {
    const entry = schema[setting];
    assert.ok(entry, `${setting} should be declared in package.json contributes.configuration`);
    assert.equal(
      JSON.stringify(entry.default),
      fallback,
      `${setting} schema default should match formatter.ts fallback ${fallback}`
    );

    const codeFallback = extractFallback(formatterSource, setting);
    assert.equal(
      codeFallback,
      fallback,
      `formatter.ts fallback for ${setting} should be ${fallback}, found ${codeFallback ?? "nothing"}`
    );
  }
});
