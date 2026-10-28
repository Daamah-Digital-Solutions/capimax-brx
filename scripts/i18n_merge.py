"""
Merge translated batches into the French dictionaries.

  python scripts/i18n_merge.py <dir>   # fr_keys_*.json → fr-keys.json, fr_ui_*.json → fr-ui.json

Existing entries are kept; a batch only adds or updates. Entries whose placeholders differ from
the English are skipped and listed (they would print wrong values).
"""
import glob
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from i18n_extract import keys_dictionary  # noqa: E402

HERE = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "i18n")


def placeholders(s: str):
    return sorted(re.findall(r"\$?\{\w+\}", s or ""))


def merge(pattern: str, target: str, english_of):
    path = os.path.join(HERE, target)
    current = json.load(io.open(path, encoding="utf-8"))
    skipped = []
    for f in sorted(glob.glob(pattern)):
        for k, fr in json.load(io.open(f, encoding="utf-8")).items():
            en = english_of(k)
            if en is None:
                continue
            if placeholders(en) != placeholders(fr):
                skipped.append((k, en, fr))
                continue
            current[k] = fr
    json.dump(dict(sorted(current.items())), io.open(path, "w", encoding="utf-8", newline="\n"),
              ensure_ascii=False, indent=0)
    return len(current), skipped


if __name__ == "__main__":
    src = sys.argv[1]
    keys = keys_dictionary()
    n_keys, bad_keys = merge(os.path.join(src, "fr_keys_*.json"), "fr-keys.json", keys.get)
    n_ui, bad_ui = merge(os.path.join(src, "fr_ui_*.json"), "fr-ui.json", lambda k: k)
    print(f"fr-keys.json: {n_keys} entries   fr-ui.json: {n_ui} entries")
    for k, en, fr in bad_keys + bad_ui:
        print("  placeholder mismatch:", k[:60], "|", en[:60], "→", fr[:60])
