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
ETA_DELIMITER_SCOPE = "punctuation.section.embedded.eta"

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
    parsed_grammars = [(file, json.loads(file.read_text())) for file in GRAMMAR_FILES]
    shared_repo = parsed_grammars[0][1]["repository"]
    for file, data in parsed_grammars[1:]:
        assert data["repository"] == shared_repo, f"repository mismatch in {file}"

    curly_repo = shared_repo["eta-js-curly-block"]
    js_body = shared_repo["eta-js-body"]
    js_repo = shared_repo["eta-js"]
    js_pattern_includes = [pattern["include"] for pattern in js_repo["patterns"]]
    comment_block_index = js_pattern_includes.index("#eta-js-comment-block")
    curly_block_index = js_pattern_includes.index("#eta-js-curly-block")
    curly_close_index = js_pattern_includes.index("#eta-js-curly-close")
    operator_index = js_pattern_includes.index("#eta-js-operator")

    assert js_body["begin"] == r"\G", "js body begin mismatch in shared Eta repository"
    assert js_body["end"] == r"(?=(\s*)(-|_)?(%>))", "js body end mismatch in shared Eta repository"
    assert js_body["name"] == "source.js.embedded.eta", "js body scope mismatch in shared Eta repository"
    assert js_body["patterns"][0]["include"] == "#eta-js", "js body should route through the Eta JS lexer"
    assert len(js_body["patterns"]) == 1, "js body should use a single Eta JS entrypoint"
    assert comment_block_index < curly_block_index, "Eta JS lexer should prioritize comments before braces"
    assert curly_block_index < curly_close_index, "Eta JS lexer should scan opening braces before close-only braces"
    assert curly_close_index < operator_index, "Eta JS lexer should recognize curly-close before generic operators"

    assert curly_repo["begin"] == r"\{", "curly begin mismatch in shared Eta repository"
    assert curly_repo["end"] == r"(\})|(?=(\s*)(-|_)?(%>))", "curly end mismatch in shared Eta repository"
    assert curly_repo["beginCaptures"]["0"]["name"] == ETA_DELIMITER_SCOPE, (
        "curly begin scope mismatch in shared Eta repository"
    )
    assert curly_repo["endCaptures"]["1"]["name"] == ETA_DELIMITER_SCOPE, (
        "curly end scope mismatch in shared Eta repository"
    )

    for file, data in parsed_grammars:
        repo = data["repository"]
        escaped_begin = compile_pattern(repo, "eta-output-escaped", "begin")
        raw_begin = compile_pattern(repo, "eta-output-raw", "begin")
        comment_begin = compile_pattern(repo, "eta-comment", "begin")
        exec_begin = compile_pattern(repo, "eta-exec", "begin")
        end_pat = compile_pattern(repo, "eta-exec", "end")

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
