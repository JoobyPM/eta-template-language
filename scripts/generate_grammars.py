#!/usr/bin/env python3
"""Generate Eta TextMate grammars from a single source of truth."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json"
ETA_CLOSE_LOOKAHEAD = r"(?=(\s*)(-|_)?(%>))"
ETA_DELIMITER_SCOPE = "punctuation.section.embedded.eta"

ETA_REPOSITORY = {
    "eta-js-body": {
        "begin": r"\G",
        "end": ETA_CLOSE_LOOKAHEAD,
        "name": "source.js.embedded.eta",
        "patterns": [{"include": "#eta-js"}],
    },
    "eta-js": {
        "patterns": [
            {"include": "#eta-js-comment-block"},
            {"include": "#eta-js-comment-line"},
            {"include": "#eta-js-template-string"},
            {"include": "#eta-js-string-single"},
            {"include": "#eta-js-string-double"},
            {"include": "#eta-js-curly-block"},
            {"include": "#eta-js-curly-close"},
            {"include": "#eta-js-paren-group"},
            {"include": "#eta-js-bracket-group"},
            {"include": "#eta-js-keyword"},
            {"include": "#eta-js-constant"},
            {"include": "#eta-js-number"},
            {"include": "#eta-js-identifier"},
            {"include": "#eta-js-accessor"},
            {"include": "#eta-js-punctuation"},
            {"include": "#eta-js-operator"},
        ],
    },
    "eta-js-comment-block": {
        "name": "comment.block.js",
        "begin": r"/\*",
        "beginCaptures": {
            "0": {"name": "punctuation.definition.comment.js"},
        },
        "end": r"\*/",
        "endCaptures": {
            "0": {"name": "punctuation.definition.comment.js"},
        },
    },
    "eta-js-comment-line": {
        "name": "comment.line.double-slash.js",
        "begin": r"//",
        "beginCaptures": {
            "0": {"name": "punctuation.definition.comment.js"},
        },
        "end": rf"{ETA_CLOSE_LOOKAHEAD}|(?=$)",
    },
    "eta-js-template-string": {
        "name": "string.quoted.template.js",
        "begin": r"`",
        "beginCaptures": {
            "0": {"name": "punctuation.definition.string.begin.js"},
        },
        "end": r"`",
        "endCaptures": {
            "0": {"name": "punctuation.definition.string.end.js"},
        },
        "patterns": [
            {"match": r"\\.", "name": "constant.character.escape.js"},
            {"include": "#eta-js-template-interpolation"},
        ],
    },
    "eta-js-template-interpolation": {
        "name": "meta.template.expression.js",
        "begin": r"\$\{",
        "beginCaptures": {
            "0": {"name": "punctuation.section.embedded.begin.js"},
        },
        "end": rf"(\}})|{ETA_CLOSE_LOOKAHEAD}",
        "endCaptures": {
            "1": {"name": "punctuation.section.embedded.end.js"},
        },
        "patterns": [{"include": "#eta-js"}],
    },
    "eta-js-string-single": {
        "name": "string.quoted.single.js",
        "begin": r"'",
        "beginCaptures": {
            "0": {"name": "punctuation.definition.string.begin.js"},
        },
        "end": r"'",
        "endCaptures": {
            "0": {"name": "punctuation.definition.string.end.js"},
        },
        "patterns": [{"match": r"\\.", "name": "constant.character.escape.js"}],
    },
    "eta-js-string-double": {
        "name": "string.quoted.double.js",
        "begin": r'"',
        "beginCaptures": {
            "0": {"name": "punctuation.definition.string.begin.js"},
        },
        "end": r'"',
        "endCaptures": {
            "0": {"name": "punctuation.definition.string.end.js"},
        },
        "patterns": [{"match": r"\\.", "name": "constant.character.escape.js"}],
    },
    "eta-js-curly-block": {
        "name": "meta.embedded.block.eta.js.curly",
        "begin": r"\{",
        "beginCaptures": {
            "0": {"name": ETA_DELIMITER_SCOPE},
        },
        "end": rf"(\}})|{ETA_CLOSE_LOOKAHEAD}",
        "endCaptures": {
            "1": {"name": ETA_DELIMITER_SCOPE},
        },
        "patterns": [{"include": "#eta-js"}],
    },
    "eta-js-curly-close": {
        "match": r"\}",
        "name": ETA_DELIMITER_SCOPE,
    },
    "eta-js-paren-group": {
        "name": "meta.group.parens.eta.js",
        "begin": r"\(",
        "beginCaptures": {
            "0": {"name": "meta.brace.round.js"},
        },
        "end": rf"(\))|{ETA_CLOSE_LOOKAHEAD}",
        "endCaptures": {
            "1": {"name": "meta.brace.round.js"},
        },
        "patterns": [{"include": "#eta-js"}],
    },
    "eta-js-bracket-group": {
        "name": "meta.group.brackets.eta.js",
        "begin": r"\[",
        "beginCaptures": {
            "0": {"name": "meta.brace.square.js"},
        },
        "end": rf"(\])|{ETA_CLOSE_LOOKAHEAD}",
        "endCaptures": {
            "1": {"name": "meta.brace.square.js"},
        },
        "patterns": [{"include": "#eta-js"}],
    },
    "eta-js-keyword": {
        "match": (
            r"(?<![_$[:alnum:]])"
            r"(?:async|await|break|case|catch|const|continue|default|do|else|finally|for|function|"
            r"if|in|let|new|of|return|switch|throw|try|typeof|var|while)"
            r"(?![_$[:alnum:]])"
        ),
        "name": "keyword.control.js",
    },
    "eta-js-constant": {
        "match": r"(?<![_$[:alnum:]])(?:false|null|this|true|undefined)(?![_$[:alnum:]])",
        "name": "constant.language.js",
    },
    "eta-js-number": {
        "match": (
            r"(?<![_$[:alnum:]])(?:"
            r"0[bB][01](?:_?[01])*n?|"
            r"0[oO][0-7](?:_?[0-7])*n?|"
            r"0[xX][0-9A-Fa-f](?:_?[0-9A-Fa-f])*n?|"
            r"\d(?:_?\d)*n|"
            r"(?:\d(?:_?\d)*\.\d(?:_?\d)*|\d(?:_?\d)*\.|\.\d(?:_?\d)*|\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?"
            r")"
        ),
        "name": "constant.numeric.js",
    },
    "eta-js-identifier": {
        "match": r"[_$[:alpha:]][_$[:alnum:]]*",
        "name": "variable.other.readwrite.js",
    },
    "eta-js-accessor": {
        "match": r"\.",
        "name": "punctuation.accessor.js",
    },
    "eta-js-punctuation": {
        "match": r"[,;]",
        "name": "punctuation.separator.delimiter.js",
    },
    "eta-js-operator": {
        "match": r"===|!==|=>|==|!=|<=|>=|\+\+|--|\|\||&&|\?\?|[+\-*/%?:=<>!&|~^]",
        "name": "keyword.operator.js",
    },
    "eta-output-escaped": {
        "name": "meta.embedded.block.eta.output.escaped",
        "begin": "(<%)(-|_)?(\\s*)(=)",
        "beginCaptures": {
            "1": {"name": ETA_DELIMITER_SCOPE},
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "4": {"name": "keyword.operator.output.escaped.eta"},
        },
        "end": "(\\s*)(-|_)?(%>)",
        "endCaptures": {
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "3": {"name": ETA_DELIMITER_SCOPE},
        },
        "patterns": [{"include": "#eta-js-body"}],
    },
    "eta-output-raw": {
        "name": "meta.embedded.block.eta.output.raw",
        "begin": "(<%)(-|_)?(\\s*)(~)",
        "beginCaptures": {
            "1": {"name": ETA_DELIMITER_SCOPE},
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "4": {"name": "keyword.operator.output.raw.eta"},
        },
        "end": "(\\s*)(-|_)?(%>)",
        "endCaptures": {
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "3": {"name": ETA_DELIMITER_SCOPE},
        },
        "patterns": [{"include": "#eta-js-body"}],
    },
    "eta-comment": {
        "name": "meta.embedded.block.eta.comment",
        "begin": "(<%)(-|_)?(\\s*)(#)",
        "beginCaptures": {
            "1": {"name": ETA_DELIMITER_SCOPE},
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "4": {"name": "keyword.operator.comment.eta"},
        },
        "end": "(\\s*)(-|_)?(%>)",
        "endCaptures": {
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "3": {"name": ETA_DELIMITER_SCOPE},
        },
        "contentName": "comment.block.eta",
    },
    "eta-exec": {
        "name": "meta.embedded.block.eta.code",
        "begin": "(<%)(-|_)?(?!\\s*[=~#])",
        "beginCaptures": {
            "1": {"name": ETA_DELIMITER_SCOPE},
            "2": {"name": "keyword.operator.whitespace-control.eta"},
        },
        "end": "(\\s*)(-|_)?(%>)",
        "endCaptures": {
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "3": {"name": ETA_DELIMITER_SCOPE},
        },
        "patterns": [{"include": "#eta-js-body"}],
    },
}


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def build_main_grammar() -> dict:
    return {
        "$schema": SCHEMA,
        "name": "Eta",
        "scopeName": "text.html.eta",
        "patterns": [
            {"include": "#eta-output-escaped"},
            {"include": "#eta-output-raw"},
            {"include": "#eta-comment"},
            {"include": "#eta-exec"},
            {"include": "text.html.basic"},
        ],
        "repository": deepcopy(ETA_REPOSITORY),
    }


def build_injection_grammar() -> dict:
    return {
        "$schema": SCHEMA,
        "name": "Eta (HTML injection)",
        "scopeName": "text.html.eta.injection",
        # Eta tags must still be tokenized inside HTML attribute values.
        "injectionSelector": "L:text.html.basic -comment",
        "patterns": [
            {"include": "#eta-output-escaped"},
            {"include": "#eta-output-raw"},
            {"include": "#eta-comment"},
            {"include": "#eta-exec"},
        ],
        "repository": deepcopy(ETA_REPOSITORY),
    }


def main() -> None:
    write_json(ROOT / "syntaxes/eta.tmLanguage.json", build_main_grammar())
    write_json(ROOT / "syntaxes/eta.injection.tmLanguage.json", build_injection_grammar())
    print("Generated syntaxes/eta.tmLanguage.json and syntaxes/eta.injection.tmLanguage.json")


if __name__ == "__main__":
    main()
