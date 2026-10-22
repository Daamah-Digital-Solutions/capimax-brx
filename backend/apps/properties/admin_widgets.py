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
        if self.kind == "image":
            attrs.setdefault("accept", "image/*")
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
