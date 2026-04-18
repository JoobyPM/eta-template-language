import { formatTemplateDocument } from "./format-html.js";
import { lexTemplate } from "./lexer.js";
import type { EtaPluginOptions, TemplateProgram } from "./types.js";

export async function parse(text: string, options: EtaPluginOptions): Promise<TemplateProgram> {
  const body = lexTemplate(text);
  const formatted = await formatTemplateDocument(body, options, text);

  return {
    type: "TemplateProgram",
    start: 0,
    end: text.length,
    body,
    formatted
  };
}

export function locStart(node: { start: number }): number {
  return node.start;
}

export function locEnd(node: { end: number }): number {
  return node.end;
}
