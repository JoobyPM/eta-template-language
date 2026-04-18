export type TrimMarker = "-" | "_" | null;

export interface BaseNode {
  start: number;
  end: number;
}

export interface TemplateProgram extends BaseNode {
  type: "TemplateProgram";
  body: TemplateNode[];
  formatted: string;
}

export interface TextNode extends BaseNode {
  type: "TextNode";
  value: string;
}

interface TagNodeBase extends BaseNode {
  innerSource: string;
  leftTrim: TrimMarker;
  rightTrim: TrimMarker;
  slot: number;
}

export interface ExecTagNode extends TagNodeBase {
  type: "ExecTagNode";
}

export interface EscapedOutputTagNode extends TagNodeBase {
  type: "EscapedOutputTagNode";
}

export interface RawOutputTagNode extends TagNodeBase {
  type: "RawOutputTagNode";
}

export interface CommentTagNode extends TagNodeBase {
  type: "CommentTagNode";
}

export type TagNode =
  | ExecTagNode
  | EscapedOutputTagNode
  | RawOutputTagNode
  | CommentTagNode;

export type TemplateNode = TextNode | TagNode;

export interface EtaPluginOptions {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  singleQuote?: boolean;
  semi?: boolean;
  proseWrap?: "always" | "never" | "preserve";
  filepath?: string;
  etaFormatHtml?: boolean;
}
