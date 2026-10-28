"""
Extract every English UI string the French layer must know.

  python scripts/i18n_extract.py [out_dir]

Writes:
  keys_en.json  {key: English}   — the t() dictionary (translated key by key)
  ui_en.json    [English, ...]   — every other English text the pages render: the English side of
                                   `isAr ? "…" : "…"` / `L("…", "…")`, `en:` / `…En:` fields,
                                   JSX text and placeholder / title / aria-label attributes.
                                   A text built with ${…} becomes a template: "Paid {0} of {1}".

src/lib/i18n/fr-ui.json must hold a French line for each ui_en.json entry and
src/lib/i18n/fr-keys.json one for each key (scripts/i18n_check.py reports what is missing).
"""
import html
import io
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "src")
STR = r'''(?P<q>["'`])(?P<s>(?:\\.|(?!(?P=q)).)*?)(?P=q)'''


def unescape(s: str) -> str:
    return (s.replace("\\'", "'").replace('\\"', '"').replace("\\`", "`")
            .replace("\\n", "\n").replace("\\\\", "\\"))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def template(s: str) -> str:
    """`Paid ${a} of ${b}` → "Paid {0} of {1}"."""
    i = -1

    def rep(_m):
        nonlocal i
        i += 1
        return "{%d}" % i

    return re.sub(r"\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", rep, s)


CSSISH = re.compile(r"^[a-z0-9\-:/\[\]\.%#_ ()!,=>&]+$")
CODEISH = re.compile(
    r"[{}]|;\s*(?:const|let|var|return|if|\}|\)|$)|=>|===|!==|&&|\|\||\bconst\b|\buse[A-Z]\w*|\breturn\b|\(\)|\bnull\b"
)


def is_ui_text(s: str) -> bool:
    s = norm(s)
    if not s or not re.search(r"[A-Za-z]", s):
        return False
    if re.match(r"^[MmLlCcHhVvZz]\s*-?[\d.]", s) or re.fullmatch(r"[dMyHhms ,:/.\-]+", s):
        return False  # an SVG path or a date-format pattern, never shown as text
    if CODEISH.search(re.sub(r"\{\d+\}", "", s)):
        return False  # a TypeScript fragment the JSX-text pattern caught (generics etc.)
    if s.startswith(("http", "/", "#", "./", "@/", "mailto:", "tel:")) or s.endswith((".tsx", ".ts", ".png", ".svg")):
        return False
    if " " not in s:
        # one word: keep Capitalised words ("Deposit"), drop identifiers / css / keys
        return bool(re.fullmatch(r"[A-Z][a-zA-Z'’]*[.!?:]?", s)) or s in {"e.g."}
    if CSSISH.match(s) and ("-" in s or ":" in s):
        return False  # tailwind classes
    return True


def concat_strings(expr: str) -> str | None:
    """'"a " + "b"' → "a b" (only plain literals)."""
    parts = re.findall(r'''(["'])((?:\\.|(?!\1).)*)\1''', expr)
    rest = re.sub(r'''(["'])((?:\\.|(?!\1).)*)\1''', "", expr)
    if re.sub(r"[\s+]", "", rest):
        return None
    return "".join(unescape(p[1]) for p in parts)


def keys_dictionary():
    src = io.open(os.path.join(ROOT, "contexts", "LanguageContext.tsx"), encoding="utf-8").read()
    start = src.index("\n  en: {")
    end = src.index("\n  },", start)
    block = src[start:end]
    return {k: unescape(v) for k, v in re.findall(r'^\s+"([^"]+)":\s*"((?:\\.|[^"\\])*)",?\s*$', block, re.M)}


def ui_strings():
    found = set()
    ternary = re.compile(
        r"(?:isAr|isRTL|\bar|language\s*===\s*[\"']ar[\"'])\s*\?\s*" + STR.replace("q>", "q1>").replace("s>", "a>").replace("(?P=q)", "(?P=q1)")
        + r"\s*:\s*" + STR, re.S)
    field = re.compile(r"\b(?:en|[a-z]+En)\s*:\s*((?:" + r'''(["'])(?:\\.|(?!\2).)*\2''' + r"\s*\+?\s*)+)", re.S)
    lcall = re.compile(r"\bL\(\s*" + STR + r"\s*,", re.S)
    jsx_text = re.compile(r">\s*([^<>{}]*[A-Za-z][^<>{}]*?)\s*<")
    # `isAr ? ["…", …] : ["…", …]` — every string of the English list
    arr_ternary = re.compile(
        r"(?:isAr|isRTL|language\s*===\s*[\"']ar[\"'])\s*\?\s*\[[^\[\]]*\]\s*:\s*\[([^\[\]]*)\]", re.S)
    # any English sentence literal ("Something with spaces"): English-only text, toasts, labels
    sentence = re.compile(r"""(["'])([A-Z][^"'\n]*? [^"'\n]*?)\1""")
    quoted = re.compile(r"""(["'])((?:\\.|(?!\1).)*)\1""")
    # any helper called as f("English", "عربي") — the English argument
    en_ar_call = re.compile(r"\(\s*" + STR + r"""\s*,\s*["'][^"'\n]*[؀-ۿ]""")
    attr = re.compile(r"\b(?:placeholder|title|aria-label|alt|label)=\"([^\"]*[A-Za-z][^\"]*)\"")
    # `en: \`Receipt — ${title}\`` — a template field
    bt_field = re.compile(r"\b(?:en|[a-z]+En)\s*:\s*`((?:\\.|[^`\\])*)`")
    # Labels the server sends in English (wallet ledger sources, payment providers)
    labels = os.path.join(ROOT, "..", "backend", "apps", "reports", "labels.py")
    if os.path.exists(labels):
        for v in re.findall(r'^\s+"[^"]+":\s*"([^"]+)",\s*$', io.open(labels, encoding="utf-8").read(), re.M):
            if not re.search(r"[؀-ۿ]", v):
                found.add(v)
    for dirpath, _dirs, files in os.walk(ROOT):
        for fn in files:
            if not fn.endswith((".tsx", ".ts")) or fn.endswith((".test.tsx", ".test.ts", ".d.ts")):
                continue
            path = os.path.join(dirpath, fn)
            if path.endswith(os.path.join("contexts", "LanguageContext.tsx")) or os.path.join("lib", "i18n") in path:
                continue
            src = io.open(path, encoding="utf-8").read()
            for m in ternary.finditer(src):
                found.add(template(unescape(m.group("s"))) if m.group("q") == "`" else unescape(m.group("s")))
            for m in field.finditer(src):
                if re.search(r"\bnameEn\s*:", m.group(0)):
                    continue  # names (properties, partners) stay as written
                val = concat_strings(m.group(1))
                if val:
                    found.add(val)
            for m in bt_field.finditer(src):
                if not re.search(r"\bnameEn\s*:", m.group(0)):
                    found.add(template(unescape(m.group(1))))
            for m in lcall.finditer(src):
                found.add(unescape(m.group("s")))
            for m in en_ar_call.finditer(src):
                found.add(unescape(m.group("s")))
            for m in arr_ternary.finditer(src):
                for q in quoted.findall(m.group(1)):
                    found.add(unescape(q[1]))
            for line in src.splitlines():
                if re.match(r"\s*(import|export \* from)\b", line) or "console." in line:
                    continue
                for m in sentence.finditer(line):
                    if not re.search(r"[؀-ۿ]", m.group(2)):
                        found.add(unescape(m.group(2)))
            if fn.endswith(".tsx"):
                for m in jsx_text.finditer(src):
                    found.add(html.unescape(m.group(1)))
                for m in attr.finditer(src):
                    found.add(m.group(1))
    out = {norm(s) for s in found if is_ui_text(s)}
    return sorted(out)


if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out_dir, exist_ok=True)
    keys = keys_dictionary()
    ui = ui_strings()
    json.dump(keys, io.open(os.path.join(out_dir, "keys_en.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(ui, io.open(os.path.join(out_dir, "ui_en.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"keys: {len(keys)}  ui strings: {len(ui)}  templates: {sum('{0}' in s for s in ui)}")
