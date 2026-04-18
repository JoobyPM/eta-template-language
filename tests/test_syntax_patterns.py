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
    "comment": [
        "<%# note %>",
        "<%-# note -%>",
        "<%_ # note _%>",
    ],
}

INVALID_FOR_EXEC = [
    "<%= it.name %>",
    "<%~ it.html %>",
    "<%# note %>",
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


def test_syntax_patterns_match_the_generator_contract() -> None:
    for file in GRAMMAR_FILES:
        data = json.loads(file.read_text())
        repo = data["repository"]
        curly_repo = repo["eta-js-curly-block"]
        js_body = repo["eta-js-body"]
        js_repo = repo["eta-js"]
        escaped_begin = compile_pattern(repo, "eta-output-escaped", "begin")
        raw_begin = compile_pattern(repo, "eta-output-raw", "begin")
        comment_begin = compile_pattern(repo, "eta-comment", "begin")
        exec_begin = compile_pattern(repo, "eta-exec", "begin")
        end_pat = compile_pattern(repo, "eta-exec", "end")

        assert js_body["begin"] == r"\G", f"js body begin mismatch in {file}"
        assert js_body["end"] == r"(?=(\s*)(-|_)?(%>))", f"js body end mismatch in {file}"
        assert js_body["name"] == "source.js.embedded.eta", f"js body scope mismatch in {file}"
        assert js_body["patterns"][0]["include"] == "#eta-js", (
            f"js body should route through the Eta JS lexer in {file}"
        )
        assert len(js_body["patterns"]) == 1, f"js body should use a single Eta JS entrypoint in {file}"
        assert js_repo["patterns"][0]["include"] == "#eta-js-comment-block", (
            f"Eta JS lexer should prioritize comments in {file}"
        )
        assert js_repo["patterns"][5]["include"] == "#eta-js-curly-block", (
            f"Eta JS lexer should treat opening braces before generic tokens in {file}"
        )
        assert js_repo["patterns"][6]["include"] == "#eta-js-curly-close", (
            f"Eta JS lexer should recognize standalone closing braces in {file}"
        )
        assert js_repo["patterns"][-1]["include"] == "#eta-js-operator", (
            f"Eta JS lexer should still recognize operators in {file}"
        )

        assert curly_repo["begin"] == r"\{", f"curly begin mismatch in {file}"
        assert curly_repo["end"] == r"(\})|(?=(\s*)(-|_)?(%>))", f"curly end mismatch in {file}"
        assert curly_repo["beginCaptures"]["0"]["name"] == "punctuation.section.embedded.begin.eta", (
            f"curly begin scope mismatch in {file}"
        )
        assert curly_repo["endCaptures"]["1"]["name"] == "punctuation.section.embedded.end.eta", (
            f"curly end scope mismatch in {file}"
        )

        for sample in VALID_CASES["escaped"]:
            assert escaped_begin.search(sample), f"escaped begin mismatch in {file}: {sample}"
        for sample in VALID_CASES["raw"]:
            assert raw_begin.search(sample), f"raw begin mismatch in {file}: {sample}"
        for sample in VALID_CASES["exec"]:
            assert exec_begin.search(sample), f"exec begin mismatch in {file}: {sample}"
        for sample in VALID_CASES["comment"]:
            assert comment_begin.search(sample), f"comment begin mismatch in {file}: {sample}"
        for sample in INVALID_FOR_EXEC:
            assert not exec_begin.search(sample), f"exec should not match prefixed tag in {file}: {sample}"
        for sample in END_CASES:
            assert end_pat.search(sample), f"end mismatch in {file}: {sample}"

        for key in ("eta-output-escaped", "eta-output-raw", "eta-exec"):
            patterns = repo[key]["patterns"]
            assert patterns[0]["include"] == "#eta-js-body", (
                f"{key} should delegate body parsing through the Eta JS wrapper in {file}"
            )
            assert len(patterns) == 1, f"{key} should use a single Eta JS wrapper in {file}"

        if file.name == "eta.injection.tmLanguage.json":
            selector = data["injectionSelector"]
            assert "-comment" in selector, f"injection selector should still exclude HTML comments: {selector}"
            assert "-string" not in selector, (
                "injection selector must allow Eta tags inside HTML attribute strings; "
                f"got: {selector}"
            )
if __name__ == "__main__":
    test_syntax_patterns_match_the_generator_contract()
    print("syntax-pattern checks passed")
