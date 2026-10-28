"""
Report every English string that has no French yet.

  python scripts/i18n_check.py            # list what is missing; exit 1 if anything is
  python scripts/i18n_check.py --write X  # also write the missing strings to X (JSON) to translate

Run after changing interface text: new English sentences show in English to French users until
they are added to src/lib/i18n/fr-ui.json (or fr-keys.json for t() keys).
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from i18n_extract import keys_dictionary, ui_strings  # noqa: E402

HERE = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "i18n")


def load(name):
    return json.load(io.open(os.path.join(HERE, name), encoding="utf-8"))


def main():
    keys, ui = keys_dictionary(), ui_strings()
    fr_keys, fr_ui = load("fr-keys.json"), load("fr-ui.json")
    missing_keys = {k: v for k, v in keys.items() if not fr_keys.get(k)}
    missing_ui = [s for s in ui if not fr_ui.get(s)]
    bad_placeholders = [
        s for s, fr in {**fr_ui, **{keys.get(k, k): v for k, v in fr_keys.items()}}.items()
        if set(re.findall(r"\{\w+\}", s)) != set(re.findall(r"\{\w+\}", fr or ""))
    ]
    print(f"t() keys: {len(keys) - len(missing_keys)}/{len(keys)} in French")
    print(f"page text: {len(ui) - len(missing_ui)}/{len(ui)} in French")
    print(f"placeholder mismatches: {len(bad_placeholders)}")
    for s in list(missing_keys)[:20] + missing_ui[:20] + bad_placeholders[:20]:
        print("  -", s[:110])
    if "--write" in sys.argv:
        out = sys.argv[sys.argv.index("--write") + 1]
        json.dump({"keys": missing_keys, "ui": missing_ui}, io.open(out, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    return 1 if (missing_keys or missing_ui or bad_placeholders) else 0


if __name__ == "__main__":
    sys.exit(main())
