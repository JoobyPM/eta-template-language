import { randomUUID } from "node:crypto";

import * as prettier from "prettier";

import {
  formatCommentSource,
  formatExecSource,
  formatExpressionSource,
  formatExpressionSourceInline,
  indentationUnit,
  logFormattingFailure
} from "./format-js.js";
import { buildPrettierOptions } from "./prettier-options.js";
import type { EtaPluginOptions, TagNode, TemplateNode } from "./types.js";

const SLOT_PREFIX = "ETASLOT";
const SLOT_SUFFIX = "X";
const PROTECTED_PREFIX = "ETAPROTECT";
const PROTECTED_SUFFIX = "X";
const STANDALONE_TAG_LINE_PATTERN = new RegExp(
  `^[\\t ]*${SLOT_PREFIX}[A-F0-9]+TAG\\d+${SLOT_SUFFIX}[\\t ]*$`
);
const MARKDOWN_TABLE_SEPARATOR_PATTERN =
  /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)\|?\s*$/;

function slotToken(kind: string, index: number, nonce: string): string {
  return `${SLOT_PREFIX}${nonce}${kind}${index}${SLOT_SUFFIX}`;
}

function protectedToken(kind: string, index: number, nonce: string): string {
  return `${PROTECTED_PREFIX}${nonce}${kind}${index}${PROTECTED_SUFFIX}`;
}

function buildSlotPattern(tokens: Iterable<string>): RegExp | null {
  const escapedTokens = Array.from(tokens, (token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escapedTokens.length === 0) {
    return null;
  }

  return new RegExp(escapedTokens.join("|"), "g");
}

function replaceProtectedRegions(
  source: string,
  replacements: Map<string, string>,
  pattern: RegExp | null
): string {
  if (!pattern) {
    return source;
  }

  return source.replace(pattern, (token) => replacements.get(token) ?? token);
}

function detectNeighborIndentation(lines: string[], index: number): string {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? "";
    if (line.trim()) {
      return line.match(/^[\t ]*/)?.[0] ?? "";
    }
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = lines[cursor] ?? "";
    if (line.trim()) {
      return line.match(/^[\t ]*/)?.[0] ?? "";
    }
  }

  return "";
}

function restoreStandaloneTagLines(source: string, replacements: Map<string, string>): string {
  const tokens = Array.from(replacements.keys());
  if (tokens.length === 0) {
    return source;
  }

  const escapedTokens = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const linePattern = new RegExp(`^([\\t ]*)(${escapedTokens.join("|")})([\\t ]*)$`);
  const lines = source.split("\n");

  return lines
    .map((line, index) => {
      const match = line.match(linePattern);
      if (!match?.[2]) {
        return line;
      }

      const replacement = replacements.get(match[2]);
      if (replacement === undefined) {
        return line;
      }

      const indentation = match[1] || detectNeighborIndentation(lines, index);
      return `${indentation}${replacement}`;
    })
    .join("\n");
}

function selectDocumentParser(options: EtaPluginOptions): "html" | "markdown" {
  const filepath = options.filepath?.toLowerCase() ?? "";
  if (filepath.endsWith(".md.eta") || filepath.endsWith(".markdown.eta")) {
    return "markdown";
  }

  return "html";
}

function isTagNode(node: TemplateNode | undefined): node is TagNode {
  return node !== undefined && node.type !== "TextNode";
}

function isProtectedWhitespaceNode(
  node: TemplateNode | undefined,
  previous: TemplateNode | undefined,
  next: TemplateNode | undefined
): boolean {
  if (node?.type !== "TextNode" || !/^\s+$/.test(node.value)) {
    return false;
  }

  return isTagNode(previous) && isTagNode(next);
}

function isTrimSensitiveTextNode(
  node: TemplateNode | undefined,
  previous: TemplateNode | undefined,
  next: TemplateNode | undefined
): boolean {
  if (node?.type !== "TextNode" || !node.value.includes("\n")) {
    return false;
  }

  if (!isTagNode(previous) || !isTagNode(next)) {
    return false;
  }

  return previous.rightTrim !== null || next.leftTrim !== null;
}

function buildOpenDelimiter(node: TagNode): string {
  const trim = node.leftTrim ?? "";
  switch (node.type) {
    case "EscapedOutputTagNode":
      return `<%${trim}=`;
    case "RawOutputTagNode":
      return `<%${trim}~`;
    case "CommentTagNode":
      return `<%${trim}#`;
    default:
      return `<%${trim}`;
  }
}

function buildCloseDelimiter(node: TagNode): string {
  return `${node.rightTrim ?? ""}%>`;
}

function isStandaloneLineTag(node: TagNode, originalSource: string): boolean {
  const lineStart = originalSource.lastIndexOf("\n", node.start - 1) + 1;
  const lineEnd = originalSource.indexOf("\n", node.end);
  const safeLineEnd = lineEnd === -1 ? originalSource.length : lineEnd;
  const before = originalSource.slice(lineStart, node.start);
  const after = originalSource.slice(node.end, safeLineEnd);
  return /^[\t ]*$/.test(before) && /^[\t ]*$/.test(after);
}

async function formatTagNode(
  node: TagNode,
  options: EtaPluginOptions,
  originalSource: string
): Promise<string> {
  const open = buildOpenDelimiter(node);
  const close = buildCloseDelimiter(node);
  const standaloneLine = isStandaloneLineTag(node, originalSource);

  const formattedInner = await (() => {
    switch (node.type) {
      case "EscapedOutputTagNode":
      case "RawOutputTagNode":
        return formatExpressionSource(node.innerSource, options);
      case "CommentTagNode":
        return Promise.resolve(formatCommentSource(node.innerSource));
      default:
        return formatExecSource(node.innerSource, options);
    }
  })();

  if (
    standaloneLine &&
    node.type === "RawOutputTagNode" &&
    (formattedInner.includes("\n") || node.innerSource.includes("\n"))
  ) {
    const compactInner = await formatExpressionSourceInline(node.innerSource, options);
    const inlineLength = `${open} ${compactInner} ${close}`.length;
    if (inlineLength <= (options.printWidth ?? 80)) {
      return close === "%>"
        ? `${open} ${compactInner} %>`
        : `${open} ${compactInner} ${close}`;
    }
  }

  if (!formattedInner) {
    if (node.type === "CommentTagNode") {
      return `${open}${close}`;
    }
    return close === "%>" ? `${open} %>` : `${open} ${close}`;
  }

  if (!formattedInner.includes("\n")) {
    return close === "%>"
      ? `${open} ${formattedInner} %>`
      : `${open} ${formattedInner} ${close}`;
  }

  return [open, formattedInner, close].join("\n");
}

function protectStandaloneTagLines(source: string): {
  replacements: Map<string, string>;
  source: string;
} {
  const nonce = createSlotNonce(source);
  const replacements = new Map<string, string>();
  const lines = source.split("\n");
  let lineIndex = 0;

  const protectedSource = lines
    .map((line) => {
      if (!STANDALONE_TAG_LINE_PATTERN.test(line)) {
        return line;
      }

      const token = protectedToken("LINE", lineIndex, nonce);
      lineIndex += 1;
      replacements.set(token, line.trimStart());
      return token;
    })
    .join("\n");

  return {
    replacements,
    source: protectedSource
  };
}

function isMarkdownFenceStart(line: string): { marker: "`" | "~"; width: number } | null {
  const match = line.match(/^\s*([`~]{3,})/);
  if (!match?.[1]) {
    return null;
  }

  const marker = match[1][0];
  if (marker !== "`" && marker !== "~") {
    return null;
  }

  return {
    marker,
    width: match[1].length
  };
}

function isMarkdownFenceEnd(line: string, marker: "`" | "~", width: number): boolean {
  return new RegExp(`^\\s*${marker}{${width},}\\s*$`).test(line);
}

function isTableRowLike(line: string): boolean {
  return line.includes("|");
}

function isStandaloneEtaLine(line: string): boolean {
  return STANDALONE_TAG_LINE_PATTERN.test(line);
}

function protectMarkdownSensitiveBlocks(source: string): {
  pattern: RegExp | null;
  replacements: Map<string, string>;
  source: string;
} {
  const nonce = createSlotNonce(source);
  const replacements = new Map<string, string>();
  const lines = source.split("\n");
  const protectedLines: string[] = [];
  let index = 0;
  let blockIndex = 0;

  while (index < lines.length) {
    const currentLine = lines[index] ?? "";
    const fence = isMarkdownFenceStart(currentLine);
    if (fence) {
      let end = index + 1;
      while (end < lines.length && !isMarkdownFenceEnd(lines[end] ?? "", fence.marker, fence.width)) {
        end += 1;
      }
      if (end < lines.length) {
        end += 1;
      }
      const token = protectedToken("MDBLOCK", blockIndex, nonce);
      blockIndex += 1;
      replacements.set(token, lines.slice(index, end).join("\n"));
      protectedLines.push(token);
      index = end;
      continue;
    }

    if (
      index + 1 < lines.length &&
      isTableRowLike(currentLine) &&
      MARKDOWN_TABLE_SEPARATOR_PATTERN.test(lines[index + 1] ?? "")
    ) {
      let end = index + 2;
      while (end < lines.length) {
        const line = lines[end] ?? "";
        if (!line.trim()) {
          break;
        }
        if (!(isTableRowLike(line) || isStandaloneEtaLine(line))) {
          break;
        }
        end += 1;
      }

      const token = protectedToken("MDTABLE", blockIndex, nonce);
      blockIndex += 1;
      replacements.set(token, lines.slice(index, end).join("\n"));
      protectedLines.push(token);
      index = end;
      continue;
    }

    protectedLines.push(currentLine);
    index += 1;
  }

  return {
    pattern: buildSlotPattern(replacements.keys()),
    replacements,
    source: protectedLines.join("\n")
  };
}

async function formatTextPlaceholders(source: string, options: EtaPluginOptions): Promise<string> {
  if (options.etaFormatHtml === false) {
    return source;
  }

  try {
    const parser = selectDocumentParser(options);
    let protectedSource = source;
    const markdownProtectedReplacements = new Map<string, string>();

    if (parser === "markdown") {
      const markdownProtection = protectMarkdownSensitiveBlocks(protectedSource);
      protectedSource = markdownProtection.source;
      for (const [token, value] of markdownProtection.replacements) {
        markdownProtectedReplacements.set(token, value);
      }
    }

    const standaloneLineProtection = protectStandaloneTagLines(protectedSource);
    protectedSource = standaloneLineProtection.source;
    const markdownProtectedPattern = buildSlotPattern(markdownProtectedReplacements.keys());

    const extraOptions: Partial<prettier.Options> = { parser };
    if (parser === "markdown" && options.proseWrap !== undefined) {
      extraOptions.proseWrap = options.proseWrap;
    }

    const formatted = await prettier.format(
      protectedSource,
      buildPrettierOptions(options, extraOptions)
    );
    const restoredMarkdown = replaceProtectedRegions(
      formatted,
      markdownProtectedReplacements,
      markdownProtectedPattern
    );
    return restoreStandaloneTagLines(restoredMarkdown, standaloneLineProtection.replacements);
  } catch (error) {
    logFormattingFailure("document placeholder formatting failed", error);
    return source;
  }
}

function replaceSlots(source: string, replacements: Map<string, string>, slotPattern: RegExp | null): string {
  if (!slotPattern) {
    return source;
  }

  return source.replace(slotPattern, (token, offset) => {
    const replacement = replacements.get(token);
    if (replacement === undefined) {
      return token;
    }
    if (!replacement.includes("\n")) {
      return replacement;
    }

    const lineStart = source.lastIndexOf("\n", offset) + 1;
    const prefix = source.slice(lineStart, offset);
    if (!/^[\t ]*$/.test(prefix)) {
      return replacement;
    }

    const lines = replacement.split("\n");
    return [lines[0] ?? "", ...lines.slice(1).map((line) => (line ? `${prefix}${line}` : line))].join(
      "\n"
    );
  });
}

function leadingIndentation(line: string): string {
  return line.match(/^[\t ]*/)?.[0] ?? "";
}

function findNeighborIndentation(lines: string[], index: number, direction: 1 | -1): string {
  for (
    let cursor = index + direction;
    cursor >= 0 && cursor < lines.length;
    cursor += direction
  ) {
    const line = lines[cursor] ?? "";
    if (!line.trim()) {
      continue;
    }
    return leadingIndentation(line);
  }

  return "";
}

function classifyStandaloneExecTag(line: string): "open" | "close" | null {
  const trimmed = line.trim();
  if (!/^<%[-_]?(?!\s*[=~#]).*%>$/.test(trimmed)) {
    return null;
  }
  if (/^<%[-_]?\s*}/.test(trimmed)) {
    return "close";
  }
  return "open";
}

function normalizeStandaloneExecTagIndentation(source: string): string {
  const lines = source.split("\n");

  return lines
    .map((line, index) => {
      const classification = classifyStandaloneExecTag(line);
      if (!classification) {
        return line;
      }

      const currentIndentation = leadingIndentation(line);
      const previousIndentation = findNeighborIndentation(lines, index, -1);
      const nextIndentation = findNeighborIndentation(lines, index, 1);
      const desiredIndentation =
        classification === "open"
          ? nextIndentation || currentIndentation || previousIndentation
          : previousIndentation || currentIndentation || nextIndentation;

      if (!desiredIndentation || desiredIndentation === currentIndentation) {
        return line;
      }

      return `${desiredIndentation}${line.trimStart()}`;
    })
    .join("\n");
}

function scanQuotedAttributeValue(source: string, index: number): number {
  const quote = source[index];
  if (quote !== '"' && quote !== "'") {
    return index;
  }

  let cursor = index + 1;
  while (cursor < source.length) {
    const current = source[cursor];
    if (current === "\\") {
      cursor += 2;
      continue;
    }
    if (current === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }

  return source.length;
}

function scanEtaTagInHtmlText(source: string, index: number): number {
  const end = source.indexOf("%>", index + 2);
  return end === -1 ? source.length : end + 2;
}

function findOpeningTagClose(source: string): number {
  let cursor = 0;
  while (cursor < source.length) {
    if (source.startsWith("<%", cursor)) {
      cursor = scanEtaTagInHtmlText(source, cursor);
      continue;
    }

    const current = source[cursor];
    if (current === '"' || current === "'") {
      cursor = scanQuotedAttributeValue(source, cursor);
      continue;
    }

    if (current === ">") {
      return cursor;
    }

    cursor += 1;
  }

  return -1;
}

function findTagNameEnd(source: string): number {
  let cursor = 1;
  while (cursor < source.length && /[A-Za-z0-9:-]/.test(source[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}

function isCloseLikeEtaTag(token: string): boolean {
  return /^<%[-_]?\s*}/.test(token);
}

function consumeAttributeChunk(source: string, start: number): { end: number; value: string } {
  let cursor = start;
  let chunk = "";

  if (source.startsWith("<%", cursor)) {
    const prefixEnd = scanEtaTagInHtmlText(source, cursor);
    chunk += source.slice(cursor, prefixEnd);
    cursor = prefixEnd;

    while (cursor < source.length && /\s/.test(source[cursor] ?? "")) {
      chunk += source[cursor];
      cursor += 1;
    }
  }

  while (cursor < source.length) {
    if (source.startsWith("<%", cursor)) {
      const etaEnd = scanEtaTagInHtmlText(source, cursor);
      const etaToken = source.slice(cursor, etaEnd);
      if (chunk && !isCloseLikeEtaTag(etaToken)) {
        break;
      }
      chunk += etaToken;
      cursor = etaEnd;
      continue;
    }

    const current = source[cursor];
    if (current === '"' || current === "'") {
      const quotedEnd = scanQuotedAttributeValue(source, cursor);
      chunk += source.slice(cursor, quotedEnd);
      cursor = quotedEnd;
      continue;
    }

    if (/\s/.test(current ?? "")) {
      break;
    }

    chunk += current;
    cursor += 1;
  }

  return {
    end: cursor,
    value: chunk.trim()
  };
}

function wrapLongEmbeddedHtmlTagLines(source: string, options: EtaPluginOptions): string {
  const printWidth = options.printWidth ?? 80;
  const indent = indentationUnit(options);

  return source
    .split("\n")
    .map((line) => {
      if (line.length <= printWidth || !line.includes("<%")) {
        return line;
      }
      if (!/^[\t ]*<[A-Za-z]/.test(line)) {
        return line;
      }

      const lineIndentation = leadingIndentation(line);
      const trimmed = line.slice(lineIndentation.length);
      const openingTagClose = findOpeningTagClose(trimmed);
      if (openingTagClose === -1) {
        return line;
      }

      const tagNameEnd = findTagNameEnd(trimmed);
      if (tagNameEnd <= 1) {
        return line;
      }

      const head = trimmed.slice(0, tagNameEnd);
      let body = trimmed.slice(tagNameEnd, openingTagClose).trimStart();
      const tail = trimmed.slice(openingTagClose);
      if (!body) {
        return line;
      }

      const chunks: string[] = [];
      let cursor = 0;
      while (cursor < body.length) {
        while (cursor < body.length && /\s/.test(body[cursor] ?? "")) {
          cursor += 1;
        }
        if (cursor >= body.length) {
          break;
        }
        const chunk = consumeAttributeChunk(body, cursor);
        if (!chunk.value) {
          break;
        }
        chunks.push(chunk.value);
        cursor = chunk.end;
      }

      if (chunks.length < 2 && !chunks[0]?.startsWith("<%")) {
        return line;
      }

      const lines = [`${lineIndentation}${head}`];
      const lastIndex = chunks.length - 1;
      chunks.forEach((chunk, index) => {
        const suffix = index === lastIndex ? tail : "";
        lines.push(`${lineIndentation}${indent}${chunk}${suffix}`);
      });
      return lines.join("\n");
    })
    .join("\n");
}

function createSlotNonce(originalSource: string): string {
  let nonce = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  while (originalSource.includes(nonce)) {
    nonce = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  }

  return nonce;
}

export async function formatTemplateDocument(
  body: TemplateNode[],
  options: EtaPluginOptions,
  originalSource: string
): Promise<string> {
  const replacements = new Map<string, string>();
  const placeholderParts: string[] = [];
  const replacementTasks: Promise<void>[] = [];
  const slotNonce = createSlotNonce(originalSource);
  let whitespaceSlot = 0;

  for (let index = 0; index < body.length; index += 1) {
    const node = body[index];
    if (!node) {
      continue;
    }

    if (isTagNode(node)) {
      const token = slotToken("TAG", node.slot, slotNonce);
      placeholderParts.push(token);
      replacementTasks.push(
        formatTagNode(node, options, originalSource).then((formatted) => {
          replacements.set(token, formatted);
        })
      );
      continue;
    }

    if (
      isProtectedWhitespaceNode(node, body[index - 1], body[index + 1]) ||
      isTrimSensitiveTextNode(node, body[index - 1], body[index + 1])
    ) {
      const token = slotToken("WS", whitespaceSlot, slotNonce);
      whitespaceSlot += 1;
      placeholderParts.push(token);
      replacements.set(token, node.value);
      continue;
    }

    placeholderParts.push(node.value);
  }

  await Promise.all(replacementTasks);

  const placeholderSource = placeholderParts.join("");
  const slotPattern = buildSlotPattern(replacements.keys());
  const formattedText = await formatTextPlaceholders(placeholderSource, options);
  const rendered = wrapLongEmbeddedHtmlTagLines(
    normalizeStandaloneExecTagIndentation(replaceSlots(formattedText, replacements, slotPattern)),
    options
  );
  return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
}
