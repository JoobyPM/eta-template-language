import { randomUUID } from "node:crypto";

import * as prettier from "prettier";

import { buildPrettierOptions } from "./prettier-options.js";
import type { EtaPluginOptions } from "./types.js";

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

function trimOuterWhitespace(text: string): string {
  let start = 0;
  while (start < text.length && /\s/.test(text[start] ?? "")) {
    start += 1;
  }

  let end = text.length;
  while (end > start && /\s/.test(text[end - 1] ?? "")) {
    end -= 1;
  }

  return text.slice(start, end);
}

function dedentExtractedBlock(text: string): string {
  const trimmed = trimBlankLines(text);
  if (!trimmed.includes("\n")) {
    return trimOuterWhitespace(trimmed);
  }

  const lines = trimmed.split("\n");
  const indentationWidths = lines.filter((line) => line.trim()).map((line) => line.match(/^[\t ]*/)?.[0].length ?? 0);

  const minIndentation = indentationWidths.reduce((currentMinimum, width) => Math.min(currentMinimum, width), Infinity);
  if (!Number.isFinite(minIndentation) || minIndentation <= 0) {
    return trimmed;
  }

  return lines
    .map((line) => {
      const lineIndentation = line.match(/^[\t ]*/)?.[0].length ?? 0;
      return line.slice(Math.min(minIndentation, lineIndentation));
    })
    .join("\n");
}

function dedentWrappedExpression(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("\n")) {
    return trimOuterWhitespace(normalized);
  }
  return dedentExtractedBlock(normalized);
}

function stripWrapperSemicolon(text: string): string {
  return text.replace(/;\s*$/, "");
}

function createMarker(prefix: string): string {
  return `__ETA_${prefix}_${randomUUID().replace(/-/g, "")}__`;
}

function createCommentMarker(prefix: string): string {
  return `/*${createMarker(prefix)}*/`;
}

function extractBetweenMarkers(formatted: string, startMarker: string, endMarker: string, context: string): string {
  const startIndex = formatted.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Unable to locate Eta start marker for ${context}.`);
  }

  const endIndex = formatted.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Unable to locate Eta end marker for ${context}.`);
  }

  return dedentExtractedBlock(formatted.slice(startIndex + startMarker.length, endIndex));
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

function isCloseOnlyFragment(source: string): boolean {
  return /^\s*}/.test(source);
}

export function logFormattingFailure(context: string, error: unknown): void {
  if (!process.env.ETA_DEBUG) {
    return;
  }

  const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.warn(`[prettier-plugin-eta] ${context}: ${details}`);
}

async function formatWithParser(
  wrapped: string,
  options: EtaPluginOptions,
  overrides: Partial<prettier.Options> = {}
): Promise<string> {
  return prettier.format(wrapped, buildPrettierOptions(options, { parser: "babel-ts", ...overrides }));
}

async function formatOpenControlFragment(source: string, options: EtaPluginOptions): Promise<string> {
  const startMarker = createCommentMarker("OPEN_START");
  const endMarker = createCommentMarker("OPEN_END");
  const wrapped = ["async function __eta_exec__() {", startMarker, source, endMarker, "}", "}", ""].join("\n");

  const formatted = await formatWithParser(wrapped, options);
  return extractBetweenMarkers(formatted, startMarker, endMarker, "Eta open control fragment");
}

async function formatElseFragment(source: string, options: EtaPluginOptions): Promise<string> {
  const startMarker = createCommentMarker("ELSE_START");
  const endMarker = createCommentMarker("ELSE_END");
  const wrapped = ["async function __eta_exec__() {", "if (true) {", startMarker, source, endMarker, "}", "}", ""].join(
    "\n"
  );

  const formatted = await formatWithParser(wrapped, options);
  return extractBetweenMarkers(formatted, startMarker, endMarker, "Eta else fragment");
}

async function formatCatchOrFinallyFragment(source: string, options: EtaPluginOptions): Promise<string> {
  const startMarker = createCommentMarker("CATCH_START");
  const endMarker = createCommentMarker("CATCH_END");
  const wrapped = ["async function __eta_exec__() {", "try {", startMarker, source, endMarker, "}", "}", ""].join("\n");

  const formatted = await formatWithParser(wrapped, options);
  return extractBetweenMarkers(formatted, startMarker, endMarker, "Eta catch/finally fragment");
}

export async function formatExecSource(source: string, options: EtaPluginOptions): Promise<string> {
  const normalized = trimBlankLines(source);
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
    if (isCloseOnlyFragment(normalized)) {
      return normalized;
    }
    if (isOpenControlFragment(normalized)) {
      return await formatOpenControlFragment(normalized, options);
    }

    return trimBlankLines(await formatWithParser(`${normalized}\n`, options));
  } catch (error) {
    logFormattingFailure("execution block formatting failed", error);
    return normalized;
  }
}

export async function formatExpressionSource(source: string, options: EtaPluginOptions): Promise<string> {
  const normalized = trimBlankLines(source);
  if (!normalized) {
    return "";
  }

  const binding = createMarker("EXPR_BINDING");
  const endMarker = createCommentMarker("EXPR_END");
  const prefix = `const ${binding} =`;
  const wrapped = [`${prefix} (${normalized});`, endMarker, ""].join("\n");

  try {
    const formatted = await formatWithParser(wrapped, options);
    const startIndex = formatted.indexOf(prefix);
    const endMarkerIndex = formatted.indexOf(endMarker, startIndex + prefix.length);
    if (startIndex === -1 || endMarkerIndex <= startIndex) {
      throw new Error("Unable to extract Eta expression from formatted wrapper.");
    }

    const extracted = stripWrapperSemicolon(formatted.slice(startIndex + prefix.length, endMarkerIndex));
    return dedentWrappedExpression(extracted);
  } catch (error) {
    logFormattingFailure("expression formatting failed", error);
    return normalized;
  }
}

export async function formatExpressionSourceInline(source: string, options: EtaPluginOptions): Promise<string> {
  const normalized = trimBlankLines(source);
  if (!normalized) {
    return "";
  }

  const binding = createMarker("EXPR_INLINE_BINDING");
  const endMarker = createCommentMarker("EXPR_INLINE_END");
  const prefix = `const ${binding} =`;
  const wrapped = [`${prefix} (${normalized});`, endMarker, ""].join("\n");

  try {
    const formatted = await formatWithParser(wrapped, options, { printWidth: 1_000_000 });
    const startIndex = formatted.indexOf(prefix);
    const endMarkerIndex = formatted.indexOf(endMarker, startIndex + prefix.length);
    if (startIndex === -1 || endMarkerIndex <= startIndex) {
      throw new Error("Unable to extract inline Eta expression from formatted wrapper.");
    }

    const extracted = stripWrapperSemicolon(formatted.slice(startIndex + prefix.length, endMarkerIndex));
    return trimOuterWhitespace(extracted);
  } catch (error) {
    logFormattingFailure("inline expression formatting failed", error);
    return normalized;
  }
}

export function formatCommentSource(source: string): string {
  const normalized = trimBlankLines(source);
  if (!normalized.includes("\n")) {
    return normalized.replace(/\s+/g, " ").trim();
  }
  return normalized;
}

export function indentationUnit(options: EtaPluginOptions): string {
  if (options.useTabs) {
    return "\t";
  }
  return " ".repeat(Math.max(1, options.tabWidth ?? 2));
}
