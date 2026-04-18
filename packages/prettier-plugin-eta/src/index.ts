import { defaultOptions, options } from "./options.js";
import { locEnd, locStart, parse } from "./parser.js";
import { printers } from "./printer.js";

export const languages = [
  {
    name: "Eta",
    parsers: ["eta-template"],
    extensions: [".eta"],
    vscodeLanguageIds: ["eta"]
  }
];

export const parsers = {
  "eta-template": {
    parse,
    astFormat: "eta-template-ast",
    locStart,
    locEnd
  }
};

const plugin = {
  languages,
  parsers,
  printers,
  options,
  defaultOptions
};

export { defaultOptions, options, printers };
export default plugin;
