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

function normalizeSource(text: string): string {
  return trimBlankLines(text);
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

  return trimOuterWhitespace(formatted.slice(startIndex + startMarker.length, endIndex));
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

function logFormattingFailure(context: string, error: unknown): void {
  if (!process.env.ETA_DEBUG) {
    return;
  }

  const details = error instanceof Error ? error.stack ?? error.message : String(error);
  console.warn(`[prettier-plugin-eta] ${context}: ${details}`);
}

async function formatWithParser(wrapped: string, options: EtaPluginOptions): Promise<string> {
  return prettier.format(wrapped, buildPrettierOptions(options, { parser: "babel-ts" }));
}

async function formatOpenControlFragment(source: string, options: EtaPluginOptions): Promise<string> {
  const startMarker = createCommentMarker("OPEN_START");
  const endMarker = createCommentMarker("OPEN_END");
  const wrapped = [
    "async function __eta_exec__() {",
    startMarker,
    source,
    endMarker,
    "}",
    "}",
    ""
  ].join("\n");

  const formatted = await formatWithParser(wrapped, options);
  return extractBetweenMarkers(formatted, startMarker, endMarker, "Eta open control fragment");
}

async function formatElseFragment(source: string, options: EtaPluginOptions): Promise<string> {
  const startMarker = createCommentMarker("ELSE_START");
  const endMarker = createCommentMarker("ELSE_END");
  const wrapped = [
    "async function __eta_exec__() {",
    "if (true) {",
    startMarker,
    source,
    endMarker,
    "}",
    "}",
    ""
  ].join("\n");

  const formatted = await formatWithParser(wrapped, options);
  return extractBetweenMarkers(formatted, startMarker, endMarker, "Eta else fragment");
}

async function formatCatchOrFinallyFragment(
  source: string,
  options: EtaPluginOptions
): Promise<string> {
  const startMarker = createCommentMarker("CATCH_START");
  const endMarker = createCommentMarker("CATCH_END");
  const wrapped = [
    "async function __eta_exec__() {",
    "try {",
    startMarker,
    source,
    endMarker,
    "}",
    "}",
    ""
  ].join("\n");

  const formatted = await formatWithParser(wrapped, options);
  return extractBetweenMarkers(formatted, startMarker, endMarker, "Eta catch/finally fragment");
}

export async function formatExecSource(source: string, options: EtaPluginOptions): Promise<string> {
  const normalized = normalizeSource(source);
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

    const startMarker = createCommentMarker("EXEC_START");
    const endMarker = createCommentMarker("EXEC_END");
    const wrapped = [
      "async function __eta_exec__() {",
      startMarker,
      normalized,
      endMarker,
      "}",
      ""
    ].join("\n");

    const formatted = await formatWithParser(wrapped, options);
    return extractBetweenMarkers(formatted, startMarker, endMarker, "Eta execution block");
  } catch (error) {
    logFormattingFailure("execution block formatting failed", error);
    return normalized;
  }
}

export async function formatExpressionSource(
  source: string,
  options: EtaPluginOptions
): Promise<string> {
  const normalized = normalizeSource(source);
  if (!normalized) {
    return "";
  }

  const binding = createMarker("EXPR_BINDING");
  const prefix = `const ${binding} =`;
  const wrapped = [`${prefix} (${normalized});`, ""].join("\n");

  try {
    const formatted = await formatWithParser(wrapped, options);
    const startIndex = formatted.indexOf(prefix);
    const endIndex = formatted.trimEnd().lastIndexOf(";");
    if (startIndex === -1 || endIndex <= startIndex) {
      throw new Error("Unable to extract Eta expression from formatted wrapper.");
    }

    return trimOuterWhitespace(formatted.slice(startIndex + prefix.length, endIndex));
  } catch (error) {
    logFormattingFailure("expression formatting failed", error);
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
