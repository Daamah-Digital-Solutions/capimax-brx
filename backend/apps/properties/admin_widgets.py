"""
Property-admin form widgets (client review of the listing page).

StickyFileInput: the file is uploaded the moment it is picked (admin_property.js posts it to
PropertyAdmin's upload view) and the form only carries the PendingUpload id in a hidden
`<name>__pending` input. A validation error, an edit of another field or a reload therefore
never loses it; the file is attached to the property when the form finally saves. Without
JavaScript the input still works as a normal file field.
"""
import uuid

from django import forms
from django.contrib.admin.widgets import AdminFileWidget
from django.core.files.base import ContentFile
from django.utils.html import format_html


class StickyFileInput(AdminFileWidget):
    kind = "document"

    def __init__(self, attrs=None):
        attrs = {**(attrs or {}), "data-sticky": self.kind}
        if self.kind in ("image", "video"):
            attrs.setdefault("accept", f"{self.kind}/*")
        super().__init__(attrs)

    @staticmethod
    def pending_key(name):
        return f"{name}__pending"

    def value_from_datadict(self, data, files, name):
        upload = super().value_from_datadict(data, files, name)
        if upload not in (None, False):  # a file posted the classic way (or a contradiction)
            return upload
        token = data.get(self.pending_key(name))
        if token and upload is None:
            pending = _pending(token)
            if pending is not None:
                with pending.file.open("rb") as fh:  # read and close: the copy is deleted after save
                    f = ContentFile(fh.read(), name=pending.original_name)
                f.pending_token = str(pending.pk)
                f.pending_url = pending.file.url
                f.pending_is_image = pending.is_image
                return f
        return upload

    def value_omitted_from_data(self, data, files, name):
        return (
            super().value_omitted_from_data(data, files, name)
            and self.pending_key(name) not in data
        )

    def render(self, name, value, attrs=None, renderer=None):
        token = getattr(value, "pending_token", "")
        html = super().render(name, None if token else value, attrs, renderer)
        status = ""
        if token:
            thumb = (
                format_html('<img src="{}" alt="">', value.pending_url)
                if getattr(value, "pending_is_image", False) else ""
            )
            status = format_html(
                "{}<span>✓ {} — kept, it is attached when you save.</span>"
                ' <a href="#" class="sticky-remove">Remove</a>',
                thumb, value.name,
            )
        return format_html(
            '{}<input type="hidden" name="{}" value="{}" class="sticky-token"'
            ' data-label="{}" data-url="{}" data-image="{}">'
            '<span class="sticky-status">{}</span>',
            html, self.pending_key(name), token,
            value.name if token else "", getattr(value, "pending_url", ""),
            "1" if getattr(value, "pending_is_image", False) else "",
            status,
        )


class StickyImageInput(StickyFileInput):
    kind = "image"


class StickyVideoInput(StickyFileInput):
    kind = "video"


def _pending(token):
    from .models import PendingUpload

    try:
        return PendingUpload.objects.filter(pk=uuid.UUID(str(token))).first()
    except (ValueError, TypeError):
        return None


class DatalistTextInput(forms.TextInput):
    """A free-text input that suggests the values already in use (any new value is accepted)."""

    def __init__(self, options_fn, attrs=None):
        self.options_fn = options_fn
        super().__init__(attrs)

    def render(self, name, value, attrs=None, renderer=None):
        list_id = f"{(attrs or {}).get('id') or name}-options"
        self.attrs["list"] = list_id
        options = format_html("".join('<option value="{}">' for _ in self._options()), *self._options())
        return format_html('{}<datalist id="{}">{}</datalist>', super().render(name, value, attrs, renderer),
                           list_id, options)

    def _options(self):
        if not hasattr(self, "_cached"):
            self._cached = list(self.options_fn())
        return self._cached


class _KeepsPending:
    """Re-render a refused form with the picked file (Django's file fields drop it by design)."""

    def bound_data(self, data, initial):
        if getattr(data, "pending_token", None):
            return data
        return super().bound_data(data, initial)


class StickyFormFileField(_KeepsPending, forms.FileField):
    pass


class StickyFormImageField(_KeepsPending, forms.ImageField):
    pass


class JsonRowsWidget(forms.Widget):
    """
    A JSON list typed as table rows (client letter 2026-11, admin §1): one input per column, with
    Add row / Remove buttons, and the JSON the model stores is written behind the scenes into a
    hidden textarea under the field's own name — so the field, its validation and the property
    page are unchanged. `columns` = [(key, label, "text" | "number"), ...]. Without JavaScript the
    textarea shows and the JSON can still be typed.
    """

    def __init__(self, columns, max_rows=None, attrs=None):
        super().__init__(attrs)
        self.columns = list(columns)
        self.max_rows = max_rows

    def format_value(self, value):
        import json

        if value in (None, ""):
            return "[]"
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False)

    def value_from_datadict(self, data, files, name):
        return data.get(name)

    def render(self, name, value, attrs=None, renderer=None):
        import json

        from django.utils.safestring import mark_safe

        attrs = self.build_attrs(self.attrs, attrs or {})
        field_id = attrs.get("id") or f"id_{name}"
        raw = self.format_value(value)
        cols = json.dumps([{"key": k, "label": str(lbl), "type": t} for k, lbl, t in self.columns])
        head = "".join(format_html('<th style="text-align:start;padding:4px 6px">{}</th>', lbl) for _k, lbl, _t in self.columns)
        return mark_safe(
            format_html(
                '<div class="json-rows" data-for="{}" data-max="{}" data-cols="{}">'
                '<table style="border-collapse:collapse;margin-bottom:6px"><thead><tr>{}<th></th></tr></thead>'
                '<tbody></tbody></table>'
                '<button type="button" class="button json-rows-add">+ Add row / إضافة صف</button>'
                '<textarea name="{}" id="{}" class="json-rows-raw" rows="3" cols="60" '
                'style="margin-top:6px;font-family:monospace">{}</textarea>'
                "</div>",
                field_id, self.max_rows or "", cols, mark_safe(head), name, field_id, raw,
            )
            + _JSON_ROWS_SCRIPT
        )


# Inline once per widget; idempotent (window flag). Builds the rows from the textarea's JSON,
# keeps the textarea in step on every edit, hides it when JS runs, and handles inlines added
# later (django:formset:added) — their prefix is renamed by the admin, so rows are found by class.
_JSON_ROWS_SCRIPT = """
<script>
(function () {
  if (window.__jsonRows) return; window.__jsonRows = true;
  function init(box) {
    if (box.dataset.ready) return; box.dataset.ready = "1";
    var cols = JSON.parse(box.dataset.cols), max = parseInt(box.dataset.max || "0", 10);
    var raw = box.querySelector(".json-rows-raw"), body = box.querySelector("tbody");
    var add = box.querySelector(".json-rows-add");
    raw.style.display = "none";
    function sync() {
      var out = [];
      body.querySelectorAll("tr").forEach(function (tr) {
        var row = {}, empty = true;
        cols.forEach(function (c, i) {
          var v = tr.querySelectorAll("input")[i].value.trim();
          if (v !== "") empty = false;
          row[c.key] = c.type === "number" ? (v === "" ? null : Number(v)) : v;
        });
        if (!empty) out.push(row);
      });
      raw.value = JSON.stringify(out);
      add.disabled = max > 0 && body.querySelectorAll("tr").length >= max;
    }
    function addRow(data) {
      var tr = document.createElement("tr");
      cols.forEach(function (c) {
        var td = document.createElement("td"), inp = document.createElement("input");
        inp.type = c.type === "number" ? "number" : "text";
        if (c.type === "number") inp.step = "any";
        inp.value = data && data[c.key] != null ? data[c.key] : "";
        inp.style.width = c.type === "number" ? "8em" : "14em";
        inp.addEventListener("input", sync);
        td.style.padding = "2px 6px"; td.appendChild(inp); tr.appendChild(td);
      });
      var td = document.createElement("td"), del = document.createElement("button");
      del.type = "button"; del.className = "button"; del.textContent = "Remove / حذف";
      del.addEventListener("click", function () { tr.remove(); sync(); });
      td.appendChild(del); tr.appendChild(td); body.appendChild(tr); sync();
    }
    var rows = [];
    try { rows = JSON.parse(raw.value || "[]"); } catch (e) { raw.style.display = ""; return; }
    if (!Array.isArray(rows)) { raw.style.display = ""; return; }
    rows.forEach(addRow);
    if (!rows.length) addRow(null);
    add.addEventListener("click", function () { addRow(null); });
    sync();
  }
  function all() { document.querySelectorAll(".json-rows").forEach(init); }
  document.addEventListener("DOMContentLoaded", all);
  document.addEventListener("formset:added", all);
  if (window.django && django.jQuery) django.jQuery(document).on("formset:added", all);
  all();
})();
</script>
"""
