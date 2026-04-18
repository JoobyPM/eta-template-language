import type { TemplateProgram } from "./types.js";

function getVisitorKeys(): string[] {
  return [];
}

export const printers = {
  "eta-template-ast": {
    print(path: { node: TemplateProgram }): string {
      return path.node.formatted;
    },
    getVisitorKeys
  }
};
