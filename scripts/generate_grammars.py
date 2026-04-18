#!/usr/bin/env python3
"""Generate Eta TextMate grammars from a single source of truth."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ETA_REPOSITORY = {
    "eta-output-escaped": {
        "name": "meta.embedded.block.eta.output.escaped",
        "begin": "(<%)(-|_)?(\\s*)(=)",
        "beginCaptures": {
            "1": {"name": "punctuation.section.embedded.begin.eta"},
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "4": {"name": "keyword.operator.output.escaped.eta"},
        },
        "end": "(\\s*)(-|_)?(%>)",
        "endCaptures": {
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "3": {"name": "punctuation.section.embedded.end.eta"},
        },
        "contentName": "source.js.embedded.eta",
        "patterns": [{"include": "source.js"}],
    },
    "eta-output-raw": {
        "name": "meta.embedded.block.eta.output.raw",
        "begin": "(<%)(-|_)?(\\s*)(~)",
        "beginCaptures": {
            "1": {"name": "punctuation.section.embedded.begin.eta"},
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "4": {"name": "keyword.operator.output.raw.eta"},
        },
        "end": "(\\s*)(-|_)?(%>)",
        "endCaptures": {
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "3": {"name": "punctuation.section.embedded.end.eta"},
        },
        "contentName": "source.js.embedded.eta",
        "patterns": [{"include": "source.js"}],
    },
    "eta-exec": {
        "name": "meta.embedded.block.eta.code",
        "begin": "(<%)(-|_)?(?!\\s*[=~])",
        "beginCaptures": {
            "1": {"name": "punctuation.section.embedded.begin.eta"},
            "2": {"name": "keyword.operator.whitespace-control.eta"},
        },
        "end": "(\\s*)(-|_)?(%>)",
        "endCaptures": {
            "2": {"name": "keyword.operator.whitespace-control.eta"},
            "3": {"name": "punctuation.section.embedded.end.eta"},
        },
        "contentName": "source.js.embedded.eta",
        "patterns": [{"include": "source.js"}],
    },
}

SCHEMA = "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json"



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
        "injectionSelector": "L:text.html.basic -comment -string",
        "patterns": [
            {"include": "#eta-output-escaped"},
            {"include": "#eta-output-raw"},
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
