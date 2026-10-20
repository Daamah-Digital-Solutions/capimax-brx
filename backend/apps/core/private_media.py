"""
Private uploads (KYC / KYB documents, deposit receipts, certificates, death certificates…).

Two protections:

  names   `PrivateUpload(prefix)` stores each file as <prefix>/<random 64 hex><ext> — the
          original file name is never part of the path, so a link can't be guessed.
  access  nginx serves only public media (property images / documents) itself; requests for
          a PRIVATE_PREFIXES folder are passed to Django, where `private_media` serves the
          file to a signed-in admin only (the Django admin links to it). Investors, owners and
          partners get their own files through the authenticated download endpoints of each
          app, never through /media/.

Keep PRIVATE_PREFIXES in sync with the nginx `location ~ ^/media/(…)/` of the API site.
"""
from __future__ import annotations

import mimetypes
import os
import uuid

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils.deconstruct import deconstructible

PRIVATE_PREFIXES = (
    "broker_licenses",
    "certificates",
    "deliverable_documents",
    "deposit_proofs",
    "developer_kyb_documents",
    "estate_claims",
    "kyc_documents",
    "lp_documents",
    "lp_kyb_documents",
    "owner_documents",
    "owner_kyb_documents",
    "partner_kyb_documents",
    "role_applications",
    "submission_documents",
    "sukuk_certificates",
)


@deconstructible
class PrivateUpload:
    """upload_to for private files: <prefix>/<YYYY>/<MM>/<random><ext>."""

    def __init__(self, prefix: str):
        assert prefix in PRIVATE_PREFIXES, prefix
        self.prefix = prefix

    def __call__(self, instance, filename):
        from django.utils import timezone

        ext = os.path.splitext(filename or "")[1].lower()[:8]
        now = timezone.now()
        return f"{self.prefix}/{now:%Y/%m}/{uuid.uuid4().hex}{uuid.uuid4().hex}{ext}"

    def __eq__(self, other):
        return isinstance(other, PrivateUpload) and other.prefix == self.prefix


def private_media(request, path: str):
    """Serve a private upload to a signed-in admin (Django admin session) — 404 otherwise."""
    user = getattr(request, "user", None)
    if not (user and user.is_authenticated and user.is_active and user.is_staff):
        raise Http404()
    root = os.path.realpath(settings.MEDIA_ROOT)
    full = os.path.realpath(os.path.join(root, path))
    if not full.startswith(root + os.sep) or path.split("/", 1)[0] not in PRIVATE_PREFIXES:
        raise Http404()
    if not os.path.isfile(full):
        raise Http404()
    ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
    resp = FileResponse(open(full, "rb"), content_type=ctype)
    resp["X-Content-Type-Options"] = "nosniff"
    resp["Cache-Control"] = "private, no-store"
    return resp
