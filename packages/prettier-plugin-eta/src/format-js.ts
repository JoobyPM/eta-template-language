import * as prettier from "prettier";

import type { EtaPluginOptions } from "./types.js";

function getCommonWhitespacePrefix(lines: string[]): string {
  let prefix: string | null = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const whitespace = line.match(/^[\t ]*/)?.[0] ?? "";
    if (prefix === null) {
      prefix = whitespace;
      continue;
    }

    let sharedLength = 0;
    while (
      sharedLength < prefix.length &&
      sharedLength < whitespace.length &&
      prefix[sharedLength] === whitespace[sharedLength]
    ) {
      sharedLength += 1;
    }

    prefix = prefix.slice(0, sharedLength);
  }

  return prefix ?? "";
}

function trimBlankLines(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && !(lines[0] ?? "").trim()) {
    lines.shift();
  }
  while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
    lines.pop();
  }
  return lines.join("\n");
}

function dedent(text: string): string {
  const trimmed = trimBlankLines(text);
  if (!trimmed) {
    return "";
  }

  const lines = trimmed.split("\n");
  const prefix = getCommonWhitespacePrefix(lines);
  if (!prefix) {
    return trimmed;
  }

  return lines
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
    .join("\n");
}

function normalizeFallback(text: string): string {
  const trimmed = trimBlankLines(text);
  if (!trimmed.includes("\n")) {
    return trimmed.replace(/\s+/g, " ").trim();
  }
  return dedent(trimmed);
}

function trimTrailingBlankLineEntries(lines: string[]): string[] {
  const result = [...lines];

  while (result.length > 0 && !result[result.length - 1]?.trim()) {
    result.pop();
  }

  return result;
}

function extractFunctionBody(formatted: string): string {
  const prefix = "async function __eta_exec__() {";
  const start = formatted.indexOf(prefix);
  if (start === -1) {
    throw new Error("Unable to extract formatted Eta statement block from Prettier wrapper.");
  }

  const lines = trimTrailingBlankLineEntries(formatted.slice(start + prefix.length).split("\n"));
  const closingLine = lines.pop();
  if (closingLine?.trim() !== "}") {
    throw new Error("Unable to extract formatted Eta statement block from Prettier wrapper.");
  }

  return dedent(lines.join("\n"));
}

function extractBeforePlaceholder(formattedBody: string, placeholder: string): string {
  const lines = dedent(formattedBody).split("\n");
  const placeholderIndex = lines.findIndex((line) => line.includes(placeholder));
  if (placeholderIndex === -1) {
    throw new Error("Unable to locate Eta placeholder in formatted fragment.");
  }
  return trimBlankLines(lines.slice(0, placeholderIndex).join("\n"));
}

function extractBetweenPlaceholders(
  formattedBody: string,
  startPlaceholder: string,
  endPlaceholder: string
): string {
  const lines = dedent(formattedBody).split("\n");
  const startIndex = lines.findIndex((line) => line.includes(startPlaceholder));
  const endIndex = lines.findIndex((line) => line.includes(endPlaceholder));
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Unable to locate Eta fragment placeholders in formatted branch.");
  }
  return trimBlankLines(lines.slice(startIndex + 1, endIndex).join("\n"));
}

function extractCallArgument(formatted: string): string {
  const prefix = "__eta_expr__(";
  const start = formatted.indexOf(prefix);
  if (start === -1) {
    throw new Error("Unable to extract formatted Eta expression from Prettier wrapper.");
  }

  const lines = trimTrailingBlankLineEntries(dedent(formatted.slice(start + prefix.length)).split("\n"));
  const closingLine = lines.pop();
  if (closingLine === undefined || !closingLine.trimEnd().endsWith(");")) {
    throw new Error("Unable to extract formatted Eta expression from Prettier wrapper.");
  }

  lines.push(closingLine.slice(0, closingLine.lastIndexOf(");")));
  return trimBlankLines(lines.join("\n"));
}

function isOpenControlFragment(source: string): boolean {
  return source.endsWith("{") && !source.startsWith("}") && !/^\s*(else\b|catch\b|finally\b)/.test(source);
}

function isElseFragment(source: string): boolean {
  return /^}\s*else\b/.test(source);
}

function isCatchOrFinallyFragment(source: string): boolean {
  return /^}\s*(catch\b|finally\b)/.test(source);
}

async function formatOpenControlFragment(
  source: string,
  options: EtaPluginOptions
): Promise<string> {
  const placeholder = "__eta_open_fragment__();";
  const wrapped = [
    "async function __eta_exec__() {",
    source,
    placeholder,
    "}",
    "}",
    ""
  ].join("\n");

  const formatted = await prettier.format(wrapped, {
    ...sharedPrettierOptions(options),
    parser: "babel-ts"
  });

  return extractBeforePlaceholder(extractFunctionBody(formatted), placeholder);
}

async function formatElseFragment(
  source: string,
  options: EtaPluginOptions
): Promise<string> {
  const beforePlaceholder = "__eta_before_branch__();";
  const afterPlaceholder = "__eta_after_branch__();";
  const wrapped = [
    "async function __eta_exec__() {",
    "if (true) {",
    beforePlaceholder,
    source,
    afterPlaceholder,
    "}",
    "}",
    ""
  ].join("\n");

  const formatted = await prettier.format(wrapped, {
    ...sharedPrettierOptions(options),
    parser: "babel-ts"
  });

  return extractBetweenPlaceholders(extractFunctionBody(formatted), beforePlaceholder, afterPlaceholder);
}

async function formatCatchOrFinallyFragment(
  source: string,
  options: EtaPluginOptions
): Promise<string> {
  const beforePlaceholder = "__eta_before_try__();";
  const afterPlaceholder = "__eta_after_try__();";
  const wrapped = [
    "async function __eta_exec__() {",
    "try {",
    beforePlaceholder,
    source,
    afterPlaceholder,
    "}",
    "}",
    ""
  ].join("\n");

  const formatted = await prettier.format(wrapped, {
    ...sharedPrettierOptions(options),
    parser: "babel-ts"
  });

  return extractBetweenPlaceholders(extractFunctionBody(formatted), beforePlaceholder, afterPlaceholder);
}

function sharedPrettierOptions(options: EtaPluginOptions) {
  return Object.fromEntries(
    Object.entries({
      printWidth: options.printWidth,
      semi: options.semi,
      singleQuote: options.singleQuote,
      tabWidth: options.tabWidth,
      trailingComma: "none",
      useTabs: options.useTabs
    }).filter(([, value]) => value !== undefined)
  ) as prettier.Options;
}

export async function formatExecSource(source: string, options: EtaPluginOptions): Promise<string> {
  const normalized = normalizeFallback(source);
  if (!normalized) {
    return "";
  }

  try {
    if (isElseFragment(normalized)) {
      return await formatElseFragment(normalized, options);
    }
    if (isCatchOrFinallyFragment(normalized)) {
      return await formatCatchOrFinallyFragment(normalized, options);
    }
    if (isOpenControlFragment(normalized)) {
      return await formatOpenControlFragment(normalized, options);
    }
  } catch {
    return normalized;
  }

  const wrapped = [
    "async function __eta_exec__() {",
    normalized,
    "}",
    ""
  ].join("\n");

  try {
    const formatted = await prettier.format(wrapped, {
      ...sharedPrettierOptions(options),
      parser: "babel-ts"
    });
    return extractFunctionBody(formatted);
  } catch {
    return normalized;
  }
}

export async function formatExpressionSource(
  source: string,
  options: EtaPluginOptions
): Promise<string> {
  const normalized = normalizeFallback(source);
  if (!normalized) {
    return "";
  }

  const wrapped = [
    "__eta_expr__(",
    normalized,
    ");",
    ""
  ].join("\n");

  try {
    const formatted = await prettier.format(wrapped, {
      ...sharedPrettierOptions(options),
      parser: "babel-ts"
    });
    return extractCallArgument(formatted);
  } catch {
    return normalized;
  }
}

export function formatCommentSource(source: string): string {
  const normalized = trimBlankLines(source);
  if (!normalized.includes("\n")) {
    return normalized.replace(/\s+/g, " ").trim();
  }
  return dedent(normalized);
}

export function indentationUnit(options: EtaPluginOptions): string {
  if (options.useTabs) {
    return "\t";
  }
  return " ".repeat(options.tabWidth ?? 2);
}
