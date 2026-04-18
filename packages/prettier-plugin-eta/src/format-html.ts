import { randomUUID } from "node:crypto";

import * as prettier from "prettier";

import {
  formatCommentSource,
  formatExecSource,
  formatExpressionSource
} from "./format-js.js";
import { buildPrettierOptions } from "./prettier-options.js";
import type { EtaPluginOptions, TagNode, TemplateNode } from "./types.js";

const SLOT_PREFIX = "ETASLOT";
const SLOT_SUFFIX = "X";

function slotToken(kind: string, index: number, nonce: string): string {
  return `${SLOT_PREFIX}${nonce}${kind}${index}${SLOT_SUFFIX}`;
}

function buildSlotPattern(tokens: Iterable<string>): RegExp | null {
  const escapedTokens = Array.from(tokens, (token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escapedTokens.length === 0) {
    return null;
  }

  return new RegExp(escapedTokens.join("|"), "g");
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

async function formatTagNode(node: TagNode, options: EtaPluginOptions): Promise<string> {
  const open = buildOpenDelimiter(node);
  const close = buildCloseDelimiter(node);

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

  if (!formattedInner) {
    return close === "%>" ? `${open} %>` : `${open} ${close}`;
  }

  if (!formattedInner.includes("\n")) {
    return close === "%>"
      ? `${open} ${formattedInner} %>`
      : `${open} ${formattedInner} ${close}`;
  }

  return [open, formattedInner, close].join("\n");
}

async function formatTextPlaceholders(source: string, options: EtaPluginOptions): Promise<string> {
  if (options.etaFormatHtml === false) {
    return source;
  }

  try {
    const parser = selectDocumentParser(options);
    const extraOptions: Partial<prettier.Options> = { parser };
    if (parser === "markdown" && options.proseWrap !== undefined) {
      extraOptions.proseWrap = options.proseWrap;
    }

    return await prettier.format(
      source,
      buildPrettierOptions(options, extraOptions)
    );
  } catch {
    return source;
  }
}

function replaceSlots(source: string, replacements: Map<string, string>, slotPattern: RegExp | null): string {
  if (!slotPattern) {
    return source;
  }

  return source.replace(slotPattern, (token, offset) => {
    const replacement = replacements.get(token);
    if (!replacement) {
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
        formatTagNode(node, options).then((formatted) => {
          replacements.set(token, formatted);
        })
      );
      continue;
    }

    if (isProtectedWhitespaceNode(node, body[index - 1], body[index + 1])) {
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
  const rendered = replaceSlots(formattedText, replacements, slotPattern);
  return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
}
