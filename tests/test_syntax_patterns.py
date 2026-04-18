#!/usr/bin/env python3
"""Lightweight SSOT-aligned checks for Eta TextMate regex patterns.

These checks validate the starter grammar matches core Eta parser delimiter behavior
for default tags/prefixes. This is intentionally dependency-free for CI portability.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

GRAMMAR_FILES = [
    Path("syntaxes/eta.tmLanguage.json"),
    Path("syntaxes/eta.injection.tmLanguage.json"),
]

VALID_CASES = {
    "escaped": [
        "<%= it.name %>",
        "<% = it.name %>",
        "<%-= it.name -%>",
        "<%- = it.name -%>",
        "<%_ = it.name _%>",
    ],
    "raw": [
        "<%~ it.html %>",
        "<% ~ it.html %>",
        "<%-~ it.html -%>",
        "<%_ ~ it.html _%>",
    ],
    "exec": [
        "<% const x = 1 %>",
        "<%- if (it.user) { -%>",
        "<%_ for (const x of xs) { _%>",
        "<%/* comment */%>",
    ],
}

INVALID_FOR_EXEC = [
    "<%= it.name %>",
    "<%~ it.html %>",
]

END_CASES = [
    "%>",
    " %>",
    "  _%>",
    " -%>",
]


def compile_pattern(repo: dict, key: str, field: str) -> re.Pattern[str]:
    raw = repo[key][field]
    return re.compile(raw)


def run() -> None:
    for file in GRAMMAR_FILES:
        data = json.loads(file.read_text())
        repo = data["repository"]
        escaped_begin = compile_pattern(repo, "eta-output-escaped", "begin")
        raw_begin = compile_pattern(repo, "eta-output-raw", "begin")
        exec_begin = compile_pattern(repo, "eta-exec", "begin")
        end_pat = compile_pattern(repo, "eta-exec", "end")

        for sample in VALID_CASES["escaped"]:
            assert escaped_begin.search(sample), f"escaped begin mismatch in {file}: {sample}"
        for sample in VALID_CASES["raw"]:
            assert raw_begin.search(sample), f"raw begin mismatch in {file}: {sample}"
        for sample in VALID_CASES["exec"]:
            assert exec_begin.search(sample), f"exec begin mismatch in {file}: {sample}"
        for sample in INVALID_FOR_EXEC:
            assert not exec_begin.search(sample), f"exec should not match prefixed tag in {file}: {sample}"
        for sample in END_CASES:
            assert end_pat.search(sample), f"end mismatch in {file}: {sample}"

        if file.name == "eta.injection.tmLanguage.json":
            selector = data["injectionSelector"]
            assert "-comment" in selector, f"injection selector should still exclude HTML comments: {selector}"
            assert "-string" not in selector, (
                "injection selector must allow Eta tags inside HTML attribute strings; "
                f"got: {selector}"
            )

    print("syntax-pattern checks passed")


if __name__ == "__main__":
    run()
