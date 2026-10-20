"""
Multi-role accounts.

  Every account is an Investor from sign-up. More roles are added from Settings → Role Access:
    owner                         granted instantly ("Become")
    broker / lp / developer /     requested with a short form + documents; an admin approves or
    partner                       rejects it (Django admin → Role applications). A rejected
                                  applicant can edit and resubmit; documents not replaced stay.

  A role is HELD when its own record is approved (OwnerProfile, BrokerProfile,
  LiquidityProvider, DeveloperProfile, PartnerProfile) — exactly what every role's API already
  checks, so permissions don't change. `Profile.role` is now the CURRENT role, chosen with the
  role switcher among the roles held.
"""
from __future__ import annotations

import os

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .models import RoleApplication, RoleApplicationDocument

# role -> label / how it's granted / where its dashboard is / URL slug
ROLES = {
    "investor": {"label": "Investor", "approval": "none", "dashboard": "/dashboard", "slug": "investor"},
    "owner": {"label": "Property Owner", "approval": "instant", "dashboard": "/my-assets", "slug": "owner"},
    "broker": {"label": "Broker", "approval": "admin", "dashboard": "/broker-dashboard", "slug": "broker"},
    "lp": {"label": "Liquidity Provider", "approval": "admin", "dashboard": "/liquidity-dashboard",
           "slug": "liquidity_provider"},
    "developer": {"label": "Developer", "approval": "admin", "dashboard": "/my-assets", "slug": "developer"},
    "partner": {"label": "Strategic Partner", "approval": "admin", "dashboard": "/strategic-partners",
                "slug": "partner"},
}
SLUG_TO_ROLE = {v["slug"]: k for k, v in ROLES.items()}
SLUG_TO_ROLE.update({k: k for k in ROLES})  # "lp" works too

# Application forms: required fields, choice fields, documents (required, optional).
ROLE_FORMS = {
    "broker": {
        "fields": ["name", "license_number", "phone", "country"],
        "choices": {},
        "docs": ["id_document", "license"],
        "optional_docs": [],
    },
    "lp": {
        "fields": ["name", "entity_type", "country", "commitment", "investor_status",
                   "source_of_funds", "phone"],
        "choices": {
            "entity_type": ["individual", "institution"],
            "commitment": ["10k_50k", "50k_250k", "250k_1m", "1m_plus"],
            "investor_status": ["retail", "accredited", "qualified", "institutional"],
        },
        "docs": ["proof_of_funds", "id_document"],
        "optional_docs": ["entity_registration"],
    },
    "developer": {
        "fields": ["company_name", "registration_number", "phone", "country"],
        "choices": {},
        "docs": ["id_document", "company_registration"],
        "optional_docs": [],
    },
    "partner": {
        "fields": ["company_name", "registration_number", "phone", "country"],
        "choices": {},
        "docs": ["id_document", "company_registration"],
        "optional_docs": [],
    },
}
COMMITMENT_FLOOR = {"10k_50k": 10_000, "50k_250k": 50_000, "250k_1m": 250_000, "1m_plus": 1_000_000}
DOC_MAX_BYTES = 10 * 1024 * 1024
DOC_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


def role_for_slug(slug: str) -> str:
    role = SLUG_TO_ROLE.get((slug or "").strip().lower())
    if role is None or role == "investor":
        raise NotFound("Unknown role.")
    return role


def _record_model(role):
    from apps.broker.models import BrokerProfile
    from apps.developer.models import DeveloperProfile
    from apps.lp.models import LiquidityProvider
    from apps.owner.models import OwnerProfile
    from apps.partners.models import PartnerProfile

    return {"owner": OwnerProfile, "broker": BrokerProfile, "lp": LiquidityProvider,
            "developer": DeveloperProfile, "partner": PartnerProfile}[role]


def _record(user, role):
    """The role's own record (or None) — read fresh, never from a cached relation."""
    return _record_model(role).objects.filter(user=user).only("status").first()


def role_status(user, role) -> str:
    """active | pending | rejected | available"""
    if role == "investor":
        return "active"
    rec = _record(user, role)
    if rec is not None and rec.status == "approved":
        return "active"
    app = RoleApplication.objects.filter(user=user, role=role).first() if role in ROLE_FORMS else None
    if app is not None:
        return {"pending": "pending", "rejected": "rejected"}.get(app.status, "available")
    if rec is not None and rec.status in ("pending",):
        return "pending"  # an application made through the earlier verification pages
    return "available"


def held_roles(user) -> list[str]:
    return [r for r in ROLES if role_status(user, r) == "active"]


def overview(user) -> dict:
    profile = user.profile
    rows = []
    for role, meta in ROLES.items():
        st = role_status(user, role)
        app = RoleApplication.objects.filter(user=user, role=role).first() if role in ROLE_FORMS else None
        rows.append({
            "role": role, "slug": meta["slug"], "label": meta["label"], "approval": meta["approval"],
            "status": st, "dashboard": meta["dashboard"],
            "review_note": app.review_note if app and st == "rejected" else "",
        })
    return {"current": profile.role, "is_admin": profile.role == "admin", "roles": rows}


# --------------------------------------------------------------------------- #
# Instant role
# --------------------------------------------------------------------------- #
def become_owner(user):
    from apps.owner.models import OwnerProfile

    profile = user.profile
    with transaction.atomic():
        owner, _c = OwnerProfile.objects.select_for_update().get_or_create(
            user=user, defaults={"contact_name": profile.full_name or user.email, "email": user.email,
                                 "phone": profile.phone},
        )
        if owner.status != "approved":
            owner.status = "approved"
            owner.approved_at = owner.approved_at or timezone.now()
            owner.rejected_at = None
            owner.rejection_reason = None
            owner.save()
    return owner


def switch_role(user, role: str) -> str:
    profile = user.profile
    if profile.role == "admin":
        raise PermissionDenied("Admin accounts don't switch roles.")
    if role not in ROLES or role_status(user, role) != "active":
        raise ValidationError({"code": "role_not_held", "detail": "You don't hold this role yet."})
    profile.role = role
    profile.role_status = "active"
    profile.save(update_fields=["role", "role_status"])
    return role


# --------------------------------------------------------------------------- #
# Applications
# --------------------------------------------------------------------------- #
def _clean(role, data: dict) -> dict:
    form = ROLE_FORMS[role]
    out, errors = {}, {}
    for f in form["fields"]:
        v = str(data.get(f) or "").strip()[:255]
        if not v:
            errors[f] = "This field is required."
        elif f in form["choices"] and v not in form["choices"][f]:
            errors[f] = "Choose one of the options."
        out[f] = v
    if errors:
        raise ValidationError(errors)
    return out


def submit_application(user, slug: str, data: dict, files: dict) -> RoleApplication:
    """Create or resubmit (edit) an application. Documents not re-uploaded are kept."""
    from apps.notifications.admin_alerts import notify_admins

    role = role_for_slug(slug)
    if role not in ROLE_FORMS:
        raise ValidationError({"code": "instant_role", "detail": "This role is granted instantly."})
    if role_status(user, role) == "active":
        raise ValidationError({"code": "role_held", "detail": "You already hold this role."})
    form = ROLE_FORMS[role]
    clean = _clean(role, data)
    allowed = set(form["docs"]) | set(form["optional_docs"])
    for kind, upload in files.items():
        if kind not in allowed:
            raise ValidationError({kind: "Unexpected document."})
        if upload.size and upload.size > DOC_MAX_BYTES:
            raise ValidationError({kind: "The file is larger than 10 MB."})
        if os.path.splitext(upload.name or "")[1].lower() not in DOC_EXT:
            raise ValidationError({kind: "Upload a PDF or an image."})

    with transaction.atomic():
        app, _c = RoleApplication.objects.select_for_update().get_or_create(user=user, role=role)
        have = set(app.documents.values_list("kind", flat=True)) | set(files)
        missing = [k for k in form["docs"] if k not in have]
        if missing:
            raise ValidationError({k: "This document is required." for k in missing})
        for kind, upload in files.items():
            old = app.documents.filter(kind=kind).first()
            if old is not None:
                old.file.delete(save=False)
                old.delete()
            RoleApplicationDocument.objects.create(
                application=app, kind=kind, file=upload,
                original_name=(upload.name or "")[:255], size=upload.size or 0,
            )
        app.data = clean
        app.status = RoleApplication.Status.PENDING
        app.review_note = ""
        app.submitted_at = timezone.now()
        app.decided_at = None
        app.decided_by = None
        app.save()
        notify_admins("role_application", obj=app,
                      summary=f"{user.email} applied for the {ROLES[role]['label']} role.")
    return app


def _grant(app: RoleApplication) -> None:
    """Create / approve the role's own record from the application."""
    user, d, now = app.user, app.data, timezone.now()
    if app.role == "broker":
        from apps.broker.services import get_or_create_broker

        broker, _c = get_or_create_broker(user, defaults={"contact_name": d["name"], "email": user.email})
        broker.contact_name = d["name"]
        broker.phone = d["phone"]
        broker.license_number = d["license_number"]
        broker.license_authority = broker.license_authority or d["country"]
        lic = app.documents.filter(kind="license").first()
        if lic is not None:
            broker.license_document.name = lic.file.name
        broker.license_submitted_at = broker.license_submitted_at or app.submitted_at
        broker.mark_approved()
        broker.save()
    elif app.role == "lp":
        from apps.lp.models import LiquidityProvider

        lp, _c = LiquidityProvider.objects.get_or_create(
            user=user, defaults={"contact_name": d["name"], "email": user.email})
        lp.contact_name = d["name"]
        lp.company_name = d["name"] if d["entity_type"] == "institution" else lp.company_name
        lp.phone, lp.country = d["phone"], d["country"]
        lp.business_type = d["entity_type"]
        lp.source_of_funds = d["source_of_funds"][:64]
        lp.investment_amount = COMMITMENT_FLOOR.get(d["commitment"], 0)
        lp.business_description = f"Commitment: {d['commitment']}; investor status: {d['investor_status']}"
        lp.status, lp.approved_at = "approved", now
        lp.kyb_status, lp.kyb_approved_at = "approved", now
        lp.rejected_at = None
        lp.save()
    else:  # developer / partner
        if app.role == "developer":
            from apps.developer.models import DeveloperProfile as Model
        else:
            from apps.partners.models import PartnerProfile as Model
        rec, _c = Model.objects.get_or_create(
            user=user, defaults={"contact_name": d["company_name"], "email": user.email})
        rec.company_name = d["company_name"]
        rec.phone, rec.country = d["phone"], d["country"]
        rec.business_registration_number = d["registration_number"]
        rec.status, rec.approved_at = "approved", now
        rec.kyb_status, rec.kyb_approved_at = "approved", now
        rec.rejected_at = None
        rec.save()


def approve(app_id, admin) -> RoleApplication:
    from apps.notifications.services import NotificationType, notify

    with transaction.atomic():
        app = RoleApplication.objects.select_for_update().select_related("user").get(pk=app_id)
        if app.status != RoleApplication.Status.PENDING:
            raise ValidationError({"detail": f"This application is already {app.status}."})
        _grant(app)
        app.status = RoleApplication.Status.APPROVED
        app.decided_at, app.decided_by = timezone.now(), admin
        app.save(update_fields=["status", "decided_at", "decided_by", "updated_at"])
        meta = ROLES[app.role]
        notify(app.user, NotificationType.ROLE_APPROVED,
               params={"role": meta["label"], "dashboard": meta["dashboard"]},
               action_url=meta["dashboard"])
    return app


def reject(app_id, admin, note: str = "") -> RoleApplication:
    from apps.notifications.services import NotificationType, notify

    with transaction.atomic():
        app = RoleApplication.objects.select_for_update().select_related("user").get(pk=app_id)
        if app.status != RoleApplication.Status.PENDING:
            raise ValidationError({"detail": f"This application is already {app.status}."})
        app.status = RoleApplication.Status.REJECTED
        app.review_note = (note or app.review_note or "")[:1000]
        app.decided_at, app.decided_by = timezone.now(), admin
        app.save(update_fields=["status", "review_note", "decided_at", "decided_by", "updated_at"])
        meta = ROLES[app.role]
        apply_path = f"/roles/apply/{meta['slug']}"
        notify(app.user, NotificationType.ROLE_REJECTED,
               params={"role": meta["label"], "note": app.review_note, "apply_path": apply_path},
               action_url=apply_path)
    return app
