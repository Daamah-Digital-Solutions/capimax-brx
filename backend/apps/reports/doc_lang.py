"""
The language a document is issued in — the language the person has the site in.

The frontend asks for a document with ?lang=ar|fr; the view wraps the rendering in
`with doc_language(language_of(request))`. `tr` then gives the text in that language from
doc_strings.TEXT (exact text or a {0} template), and in Arabic the design mirrors right to
left (apps/reports/brand.py). English is the default and leaves everything untouched.
"""
from __future__ import annotations

import re
from contextlib import contextmanager
from contextvars import ContextVar

from .doc_strings import MONTHS, TEXT

_LANG: ContextVar[str] = ContextVar("doc_lang", default="en")
_NAMES: ContextVar[dict | None] = ContextVar("doc_names", default=None)
_COLUMN = {"ar": 0, "fr": 1}


def _compile() -> tuple[dict[str, dict[str, str]], list[tuple[re.Pattern, tuple[str, str]]]]:
    exact: dict[str, dict[str, str]] = {"ar": {}, "fr": {}}
    templates = []
    for en, pair in TEXT.items():
        if re.search(r"\{\d+\}", en):
            pattern = re.sub(r"\\\{(\d+)\\\}", r"(?P<v\1>.+?)", re.escape(en))
            templates.append((re.compile(pattern), pair))
        else:
            for lang, i in _COLUMN.items():
                exact[lang][" ".join(en.split())] = pair[i]
    templates.sort(key=lambda t: -len(t[0].pattern))  # the more specific first
    return exact, templates


_EXACT, _TEMPLATES = _compile()


def current() -> str:
    return _LANG.get()


def is_rtl() -> bool:
    return _LANG.get() == "ar"


def language_of(request) -> str:
    params = getattr(request, "query_params", None) or getattr(request, "GET", {})
    return params.get("lang", "en")


@contextmanager
def doc_language(code: str | None):
    """Everything rendered inside the block is in this language (unknown code → English)."""
    lang_token = _LANG.set(code if code in _COLUMN else "en")
    names_token = _NAMES.set(None)
    try:
        yield
    finally:
        _LANG.reset(lang_token)
        _NAMES.reset(names_token)


def _property_names(lang: str) -> dict:
    """Property name / location → the version the admin entered in the document's language."""
    names = _NAMES.get()
    if names is None:
        from apps.properties.models import Property

        names = {}
        for name, translated, location, location_translated in Property.objects.values_list(
            "name", f"name_{lang}", "location", f"location_{lang}"
        ):
            if name and translated:
                names[name] = translated
            if location and location_translated:
                names[location] = location_translated
        _NAMES.set(names)
    return names


def _lookup(text: str, lang: str) -> str | None:
    key = " ".join(text.split())
    found = _EXACT[lang].get(key)
    if found is not None:
        return found
    found = _property_names(lang).get(key)
    if found:
        return found
    for pattern, pair in _TEMPLATES:
        m = pattern.fullmatch(key)
        if m:
            return re.sub(r"\{(\d+)\}", lambda v: tr(m.group(f"v{v.group(1)}")), pair[_COLUMN[lang]])
    return None


def tr(text):
    """`text` in the document's language; the text itself when English or unknown."""
    lang = _LANG.get()
    if lang == "en" or text in (None, ""):
        return text
    found = _lookup(str(text), lang)
    return text if found is None else found


def tr_value(value):
    """A table / CSV value: known text is translated, raw slugs ("paid") count as their label."""
    lang = _LANG.get()
    if lang == "en" or not isinstance(value, str) or not value:
        return value
    found = _lookup(value, lang)
    if found is None and "@" not in value:
        found = _lookup(value.replace("_", " ").capitalize(), lang)
    return value if found is None else found


def month_name(month: int, default: str) -> str:
    """The month's short name in the document's language."""
    names = MONTHS.get(_LANG.get())
    return names[month - 1] if names else default
