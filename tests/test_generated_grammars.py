#!/usr/bin/env python3
"""Verify committed grammar files are in sync with SSOT generator output."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.generate_grammars import build_injection_grammar, build_main_grammar


def load(path: str) -> dict:
    return json.loads((ROOT / path).read_text())


def run() -> None:
    main_actual = load("syntaxes/eta.tmLanguage.json")
    inj_actual = load("syntaxes/eta.injection.tmLanguage.json")
    assert main_actual == build_main_grammar(), "eta.tmLanguage.json is out of sync; run scripts/generate_grammars.py"
    assert inj_actual == build_injection_grammar(), "eta.injection.tmLanguage.json is out of sync; run scripts/generate_grammars.py"
    print("grammar generation sync checks passed")


if __name__ == "__main__":
    run()
