import type {
  CommentTagNode,
  EscapedOutputTagNode,
  ExecTagNode,
  RawOutputTagNode,
  TagNode,
  TemplateNode,
  TrimMarker
} from "./types.js";

const KEYWORDS_REQUIRING_EXPRESSION = new Set([
  "await",
  "case",
  "delete",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield"
]);

interface CloseMatch {
  contentEnd: number;
  rightTrim: TrimMarker;
  tagEnd: number;
}

function isWhitespace(character: string): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function isIdentifierStart(character: string): boolean {
  return /[A-Za-z_$]/.test(character);
}

function isIdentifierPart(character: string): boolean {
  return /[A-Za-z0-9_$]/.test(character);
}

function isDigit(character: string): boolean {
  return /[0-9]/.test(character);
}

function scanStringLiteral(source: string, index: number, quote: "'" | "\""): number {
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

  throw new Error("Unterminated JavaScript string inside Eta tag.");
}

function scanLineComment(source: string, index: number): number {
  let cursor = index + 2;
  while (cursor < source.length && source[cursor] !== "\n") {
    cursor += 1;
  }
  return cursor;
}

function scanBlockComment(source: string, index: number): number {
  const end = source.indexOf("*/", index + 2);
  if (end === -1) {
    throw new Error("Unterminated block comment inside Eta tag.");
  }
  return end + 2;
}

function scanRegexLiteral(source: string, index: number): number {
  let cursor = index + 1;
  let inCharacterClass = false;

  while (cursor < source.length) {
    const current = source[cursor];
    if (current === "\\") {
      cursor += 2;
      continue;
    }
    if (current === "[" && !inCharacterClass) {
      inCharacterClass = true;
      cursor += 1;
      continue;
    }
    if (current === "]" && inCharacterClass) {
      inCharacterClass = false;
      cursor += 1;
      continue;
    }
    if (current === "/" && !inCharacterClass) {
      cursor += 1;
      while (cursor < source.length && /[A-Za-z]/.test(source.charAt(cursor))) {
        cursor += 1;
      }
      return cursor;
    }
    cursor += 1;
  }

  throw new Error("Unterminated regular expression inside Eta tag.");
}

function scanIdentifier(source: string, index: number): { end: number; value: string } {
  let cursor = index + 1;
  while (cursor < source.length && isIdentifierPart(source.charAt(cursor))) {
    cursor += 1;
  }
  return {
    end: cursor,
    value: source.slice(index, cursor)
  };
}

function scanNumber(source: string, index: number): number {
  let cursor = index + 1;
  while (cursor < source.length && /[0-9A-Za-z._]/.test(source.charAt(cursor))) {
    cursor += 1;
  }
  return cursor;
}

function matchTagClose(source: string, index: number): CloseMatch | null {
  let cursor = index;
  while (cursor < source.length && isWhitespace(source.charAt(cursor))) {
    cursor += 1;
  }

  let rightTrim: TrimMarker = null;
  if (source.charAt(cursor) === "-" || source.charAt(cursor) === "_") {
    rightTrim = source.charAt(cursor) as TrimMarker;
    cursor += 1;
  }

  if (source.charAt(cursor) === "%" && source.charAt(cursor + 1) === ">") {
    return {
      contentEnd: index,
      rightTrim,
      tagEnd: cursor + 2
    };
  }

  return null;
}

function scanTemplateLiteral(source: string, index: number): number {
  let cursor = index + 1;

  while (cursor < source.length) {
    const current = source.charAt(cursor);
    if (current === "\\") {
      cursor += 2;
      continue;
    }
    if (current === "`") {
      return cursor + 1;
    }
    if (current === "$" && source.charAt(cursor + 1) === "{") {
      cursor = scanTemplateExpression(source, cursor + 2);
      continue;
    }
    cursor += 1;
  }

  throw new Error("Unterminated template literal inside Eta tag.");
}

function scanTemplateExpression(source: string, index: number): number {
  const scanned = scanJavaScript(source, index, false, true);
  if ("index" in scanned) {
    return scanned.index;
  }
  throw new Error("Failed to scan template literal interpolation.");
}

function scanJavaScript(
  source: string,
  start: number,
  stopAtTagClose: boolean,
  stopAtClosingBrace: boolean
): CloseMatch | { index: number } {
  let cursor = start;
  let lastTokenCanEndExpression = false;
  let braceDepth = stopAtClosingBrace ? 1 : 0;

  while (cursor < source.length) {
    if (stopAtTagClose) {
      const closeMatch = matchTagClose(source, cursor);
      if (closeMatch) {
        return closeMatch;
      }
    }

    const current = source.charAt(cursor);
    if (current === "'" || current === "\"") {
      cursor = scanStringLiteral(source, cursor, current);
      lastTokenCanEndExpression = true;
      continue;
    }
    if (current === "`") {
      cursor = scanTemplateLiteral(source, cursor);
      lastTokenCanEndExpression = true;
      continue;
    }
    if (current === "/" && source.charAt(cursor + 1) === "/") {
      cursor = scanLineComment(source, cursor);
      lastTokenCanEndExpression = false;
      continue;
    }
    if (current === "/" && source.charAt(cursor + 1) === "*") {
      cursor = scanBlockComment(source, cursor);
      lastTokenCanEndExpression = false;
      continue;
    }
    if (current === "/" && !lastTokenCanEndExpression) {
      cursor = scanRegexLiteral(source, cursor);
      lastTokenCanEndExpression = true;
      continue;
    }
    if (isWhitespace(current)) {
      cursor += 1;
      continue;
    }
    if (isIdentifierStart(current)) {
      const identifier = scanIdentifier(source, cursor);
      cursor = identifier.end;
      lastTokenCanEndExpression = !KEYWORDS_REQUIRING_EXPRESSION.has(identifier.value);
      continue;
    }
    if (isDigit(current)) {
      cursor = scanNumber(source, cursor);
      lastTokenCanEndExpression = true;
      continue;
    }
    if (current === "{") {
      braceDepth += 1;
      cursor += 1;
      lastTokenCanEndExpression = false;
      continue;
    }
    if (current === "}") {
      if (stopAtClosingBrace) {
        braceDepth -= 1;
        cursor += 1;
        if (braceDepth === 0) {
          return { index: cursor };
        }
        lastTokenCanEndExpression = true;
        continue;
      }
      cursor += 1;
      lastTokenCanEndExpression = true;
      continue;
    }
    if (current === ")" || current === "]") {
      cursor += 1;
      lastTokenCanEndExpression = true;
      continue;
    }
    if (current === "(" || current === "[") {
      cursor += 1;
      lastTokenCanEndExpression = false;
      continue;
    }

    cursor += 1;
    lastTokenCanEndExpression = false;
  }

  if (stopAtTagClose) {
    throw new Error("Unterminated Eta tag.");
  }

  throw new Error("Unterminated template literal interpolation inside Eta tag.");
}

function buildTagNode(
  sigil: "" | "#" | "=" | "~",
  start: number,
  end: number,
  slot: number,
  innerSource: string,
  leftTrim: TrimMarker,
  rightTrim: TrimMarker
): TagNode {
  const shared = {
    end,
    innerSource,
    leftTrim,
    rightTrim,
    slot,
    start
  };

  switch (sigil) {
    case "=":
      return {
        type: "EscapedOutputTagNode",
        ...shared
      } satisfies EscapedOutputTagNode;
    case "~":
      return {
        type: "RawOutputTagNode",
        ...shared
      } satisfies RawOutputTagNode;
    case "#":
      return {
        type: "CommentTagNode",
        ...shared
      } satisfies CommentTagNode;
    default:
      return {
        type: "ExecTagNode",
        ...shared
      } satisfies ExecTagNode;
  }
}

function readTag(source: string, start: number, slot: number): { nextIndex: number; tag: TagNode } {
  let cursor = start + 2;
  let leftTrim: TrimMarker = null;

  if (source.charAt(cursor) === "-" || source.charAt(cursor) === "_") {
    leftTrim = source.charAt(cursor) as TrimMarker;
    cursor += 1;
  }

  while (cursor < source.length && isWhitespace(source.charAt(cursor))) {
    cursor += 1;
  }

  let sigil: "" | "#" | "=" | "~" = "";
  const current = source.charAt(cursor);
  if (current === "=" || current === "~" || current === "#") {
    sigil = current as "#" | "=" | "~";
    cursor += 1;
  }

  const bodyStart = cursor;
  const scanned =
    sigil === "#"
      ? (() => {
          let innerCursor = cursor;
          while (innerCursor < source.length) {
            const closeMatch = matchTagClose(source, innerCursor);
            if (closeMatch) {
              return closeMatch;
            }
            innerCursor += 1;
          }
          throw new Error("Unterminated Eta comment tag.");
        })()
      : scanJavaScript(source, cursor, true, false);

  const closeMatch = "tagEnd" in scanned ? scanned : null;
  if (!closeMatch) {
    throw new Error("Failed to scan Eta tag.");
  }

  return {
    nextIndex: closeMatch.tagEnd,
    tag: buildTagNode(
      sigil,
      start,
      closeMatch.tagEnd,
      slot,
      source.slice(bodyStart, closeMatch.contentEnd),
      leftTrim,
      closeMatch.rightTrim
    )
  };
}

export function lexTemplate(source: string): TemplateNode[] {
  const nodes: TemplateNode[] = [];
  let cursor = 0;
  let slot = 0;

  while (cursor < source.length) {
    const openIndex = source.indexOf("<%", cursor);
    if (openIndex === -1) {
      nodes.push({
        type: "TextNode",
        value: source.slice(cursor),
        start: cursor,
        end: source.length
      });
      break;
    }

    if (openIndex > cursor) {
      nodes.push({
        type: "TextNode",
        value: source.slice(cursor, openIndex),
        start: cursor,
        end: openIndex
      });
    }

    const read = readTag(source, openIndex, slot);
    nodes.push(read.tag);
    cursor = read.nextIndex;
    slot += 1;
  }

  if (source.length === 0) {
    return [];
  }

  return nodes;
}
