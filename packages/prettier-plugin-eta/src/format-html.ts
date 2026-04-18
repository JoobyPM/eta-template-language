import * as prettier from "prettier";

import {
  formatCommentSource,
  formatExecSource,
  formatExpressionSource,
  indentationUnit
} from "./format-js.js";
import type { EtaPluginOptions, TagNode, TemplateNode } from "./types.js";

const SLOT_PREFIX = "__ETA_TAG_SLOT_";
const SLOT_SUFFIX = "__";

function slotToken(slot: number): string {
  return `${SLOT_PREFIX}${slot}${SLOT_SUFFIX}`;
}

function isTagNode(node: TemplateNode): node is TagNode {
  return node.type !== "TextNode";
}

function buildOpenDelimiter(node: TagNode): string {
  const trim = node.leftTrim ?? "";
  switch (node.type) {
    case "EscapedOutputTagNode":
      return trim ? `<%${trim} =` : "<%=";
    case "RawOutputTagNode":
      return trim ? `<%${trim} ~` : "<%~";
    case "CommentTagNode":
      return trim ? `<%${trim} #` : "<%#";
    default:
      return `<%${trim}`;
  }
}

function buildCloseDelimiter(node: TagNode): string {
  return `${node.rightTrim ?? ""}%>`;
}

function indentBlock(text: string, options: EtaPluginOptions): string {
  const unit = indentationUnit(options);
  return text
    .split("\n")
    .map((line) => (line ? `${unit}${line}` : line))
    .join("\n");
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

  return [open, indentBlock(formattedInner, options), close].join("\n");
}

async function formatHtmlPlaceholders(
  source: string,
  options: EtaPluginOptions
): Promise<string> {
  if (options.etaFormatHtml === false) {
    return source;
  }

  try {
    return await prettier.format(
      source,
      Object.fromEntries(
        Object.entries({
          parser: "html",
          printWidth: options.printWidth,
          tabWidth: options.tabWidth,
          useTabs: options.useTabs
        }).filter(([, value]) => value !== undefined)
      ) as prettier.Options
    );
  } catch {
    return source;
  }
}

function replaceSlots(source: string, replacements: Map<string, string>): string {
  return source.replace(/__ETA_TAG_SLOT_\d+__/g, (token, offset) => {
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

export async function formatTemplateDocument(
  body: TemplateNode[],
  options: EtaPluginOptions
): Promise<string> {
  const replacements = new Map<string, string>();
  const placeholderSource = body
    .map((node) => {
      if (!isTagNode(node)) {
        return node.value;
      }
      return slotToken(node.slot);
    })
    .join("");

  for (const node of body) {
    if (!isTagNode(node)) {
      continue;
    }
    replacements.set(slotToken(node.slot), await formatTagNode(node, options));
  }

  const formattedHtml = await formatHtmlPlaceholders(placeholderSource, options);
  const rendered = replaceSlots(formattedHtml, replacements);
  return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
}
