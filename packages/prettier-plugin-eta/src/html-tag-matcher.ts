import { scanEtaTagEnd } from "./lexer.js";

/**
 * Eta-aware HTML tag pair matcher.
 *
 * Given a source offset, identifies whether the offset sits on an HTML tag
 * name and returns the name ranges of both the tag under the cursor and its
 * matching opening or closing counterpart. Skips over Eta `<%...%>` tags so
 * HTML tags inside Eta control blocks are balanced correctly.
 */

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "menuitem",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

export type TagKind = "open" | "close" | "selfClose" | "void";

export interface TagToken {
  kind: TagKind;
  name: string;
  nameStart: number;
  nameEnd: number;
}

export interface NameRange {
  start: number;
  end: number;
}

export interface TagMatch {
  primary: NameRange;
  mate: NameRange | null;
}

function safeScanEtaTagEnd(source: string, index: number): number {
  try {
    return scanEtaTagEnd(source, index);
  } catch {
    return index + 2;
  }
}

function skipAttributeValue(source: string, index: number): number {
  const quote = source[index];
  if (quote !== '"' && quote !== "'") {
    return index;
  }
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === quote) {
      return cursor + 1;
    }
    if (source.startsWith("<%", cursor)) {
      cursor = safeScanEtaTagEnd(source, cursor);
      continue;
    }
    cursor += 1;
  }
  return source.length;
}

function isNameChar(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9._:-]/.test(character);
}

function isTagNameStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z]/.test(character);
}

function isAsciiWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function tokenizeHtmlTags(source: string): TagToken[] {
  const tokens: TagToken[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (source.startsWith("<%", cursor)) {
      cursor = safeScanEtaTagEnd(source, cursor);
      continue;
    }
    if (source.startsWith("<!--", cursor)) {
      const end = source.indexOf("-->", cursor + 4);
      cursor = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<!", cursor) || source.startsWith("<?", cursor)) {
      const end = source.indexOf(">", cursor + 2);
      cursor = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source[cursor] !== "<") {
      cursor += 1;
      continue;
    }

    let scan = cursor + 1;
    let isClose = false;
    if (source[scan] === "/") {
      isClose = true;
      scan += 1;
    }
    if (!isTagNameStart(source[scan])) {
      cursor += 1;
      continue;
    }

    const nameStart = scan;
    while (isNameChar(source[scan])) {
      scan += 1;
    }
    const nameEnd = scan;
    const name = source.slice(nameStart, nameEnd).toLowerCase();

    let tagEnd = -1;
    while (scan < source.length) {
      const character = source[scan];
      if (character === ">") {
        tagEnd = scan + 1;
        break;
      }
      if (character === '"' || character === "'") {
        scan = skipAttributeValue(source, scan);
        continue;
      }
      if (source.startsWith("<%", scan)) {
        scan = safeScanEtaTagEnd(source, scan);
        continue;
      }
      scan += 1;
    }

    if (tagEnd === -1) {
      cursor = scan;
      continue;
    }

    let checkSelfClose = tagEnd - 2;
    while (checkSelfClose > nameEnd && isAsciiWhitespace(source[checkSelfClose])) {
      checkSelfClose -= 1;
    }
    const isSelfClose = !isClose && source[checkSelfClose] === "/";

    const kind: TagKind = isClose ? "close" : isSelfClose ? "selfClose" : VOID_ELEMENTS.has(name) ? "void" : "open";

    tokens.push({ kind, name, nameStart, nameEnd });
    cursor = tagEnd;
  }

  return tokens;
}

function findTokenAtOffset(tokens: TagToken[], offset: number): { token: TagToken; index: number } | null {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    if (token.nameStart > offset) {
      return null;
    }
    if (offset >= token.nameStart && offset <= token.nameEnd) {
      return { token, index };
    }
  }
  return null;
}

function findForwardMatch(tokens: TagToken[], anchorIndex: number, anchor: TagToken): TagToken | null {
  let depth = 1;
  for (let index = anchorIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || token.name !== anchor.name) {
      continue;
    }
    if (token.kind === "open") {
      depth += 1;
    } else if (token.kind === "close") {
      depth -= 1;
      if (depth === 0) {
        return token;
      }
    }
  }
  return null;
}

function findBackwardMatch(tokens: TagToken[], anchorIndex: number, anchor: TagToken): TagToken | null {
  let depth = 1;
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (!token || token.name !== anchor.name) {
      continue;
    }
    if (token.kind === "close") {
      depth += 1;
    } else if (token.kind === "open") {
      depth -= 1;
      if (depth === 0) {
        return token;
      }
    }
  }
  return null;
}

function rangeFromToken(token: TagToken): NameRange {
  return { start: token.nameStart, end: token.nameEnd };
}

export function findMatchingHtmlTag(source: string, offset: number): TagMatch | null {
  const tokens = tokenizeHtmlTags(source);
  const located = findTokenAtOffset(tokens, offset);
  if (!located) {
    return null;
  }

  const { token: primary, index: anchorIndex } = located;
  const primaryRange = rangeFromToken(primary);

  if (primary.kind === "selfClose" || primary.kind === "void") {
    return { primary: primaryRange, mate: null };
  }

  const mate =
    primary.kind === "open"
      ? findForwardMatch(tokens, anchorIndex, primary)
      : findBackwardMatch(tokens, anchorIndex, primary);

  return { primary: primaryRange, mate: mate ? rangeFromToken(mate) : null };
}
