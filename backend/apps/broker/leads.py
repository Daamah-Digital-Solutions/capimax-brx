"""
Broker referrals made by hand — a client invitation, or a property brought with its owner's
authorization (client review §20). Approved brokers only.

  GET  /api/broker/leads/                                   the broker's referrals
  POST /api/broker/leads/clients/                           {name, email, phone?, notes?}
  POST /api/broker/leads/properties/                        multipart: fields + files[] (+ authorization)
  POST /api/broker/leads/<id>/authorization/upload/         multipart: file (the signed authorization)
  POST /api/broker/leads/<id>/authorization/request/        email the owner a confirmation link
  POST /api/broker/leads/<id>/cancel/
  GET  /api/broker/leads/<id>/documents/<doc>/download/
  GET  /api/broker/authorize/<token>/                       PUBLIC — what the owner is asked to confirm
  POST /api/broker/authorize/<token>/                       PUBLIC — {name, confirm: true}

Staff review property referrals in the Django admin (contacted / listed / declined); a
referral can only be marked listed once the owner's authorization is complete.
"""
from __future__ import annotations

import os
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasActivatedBroker

from .models import BrokerLead, BrokerLeadDocument, BrokerProfile

MAX_FILES = 8
MAX_BYTES = 15 * 1024 * 1024
FILE_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"}
DAILY_INVITES = 20
PROPERTY_FIELDS = ("location", "city", "country", "property_type", "estimated_value",
                   "expected_completion", "owner_name", "owner_role", "notes")


def _err(code: str, detail: str, http=status.HTTP_400_BAD_REQUEST):
    return Response({"code": code, "detail": detail}, status=http)


def _frontend(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _send(to: str, subject: str, heading: str, intro: str, cta_label: str, cta_url: str, outro: str = ""):
    from apps.core.email_templates import render_branded_email

    html, text = render_branded_email(preheader=heading, heading=heading, intro=intro,
                                      cta_label=cta_label, cta_url=cta_url, outro=outro)
    send_mail(subject=subject, message=text, from_email=settings.DEFAULT_FROM_EMAIL,
              recipient_list=[to], html_message=html, fail_silently=True)


def _broker_name(broker: BrokerProfile) -> str:
    p = getattr(broker.user, "profile", None)
    return (getattr(p, "full_name", "") or "").strip() or broker.user.email.split("@")[0]


def lead_dict(lead: BrokerLead) -> dict:
    return {
        "id": str(lead.id), "kind": lead.kind, "status": lead.status, "name": lead.name,
        "email": lead.email, "phone": lead.phone, "details": lead.details,
        "authorization": lead.authorization,
        "auth_confirmed_at": lead.auth_confirmed_at, "auth_requested_at": lead.auth_requested_at,
        "admin_note": lead.admin_note if lead.status == BrokerLead.Status.DECLINED else "",
        "property_slug": lead.property.slug if lead.property_id else None,
        "documents": [{"id": str(d.id), "kind": d.kind, "name": d.original_name} for d in lead.documents.all()],
        "created_at": lead.created_at, "updated_at": lead.updated_at,
    }


def _save_file(lead: BrokerLead, upload, kind: str) -> BrokerLeadDocument | None:
    ext = os.path.splitext(upload.name or "")[1].lower()
    if ext not in FILE_EXT or (upload.size or 0) > MAX_BYTES:
        return None
    return BrokerLeadDocument.objects.create(lead=lead, kind=kind, file=upload, original_name=(upload.name or "")[:255])


def notify_broker(lead: BrokerLead):
    from apps.notifications.models import Notification
    from apps.notifications.services import notify

    notify(lead.broker.user, Notification.Type.BROKER_LEAD_UPDATE,
           params={"title": lead.name, "status": lead.get_status_display(), "note": lead.admin_note},
           action_url="/referrals")


def _admins(lead: BrokerLead, what: str):
    from apps.notifications.admin_alerts import notify_admins

    notify_admins("broker_lead", obj=lead, summary=f"Broker {lead.broker.user.email} — {what}: {lead.name}")


# --------------------------------------------------------------------------- #
# Client invitation
# --------------------------------------------------------------------------- #
def mark_joined(broker: BrokerProfile, user) -> None:
    """Called when a user signs up through `broker`'s link: their invitation is now joined."""
    BrokerLead.objects.filter(
        broker=broker, kind=BrokerLead.Kind.CLIENT, email__iexact=user.email, status=BrokerLead.Status.INVITED,
    ).update(status=BrokerLead.Status.JOINED, updated_at=timezone.now())


class LeadsView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def get(self, request):
        qs = BrokerLead.objects.filter(broker=request.user.broker_profile).prefetch_related("documents")
        return Response([lead_dict(x) for x in qs.select_related("property")])


class ClientLeadView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def post(self, request):
        broker = request.user.broker_profile
        name = (request.data.get("name") or "").strip()[:200]
        email = (request.data.get("email") or "").strip().lower()
        if not name or "@" not in email or "." not in email.split("@")[-1]:
            return _err("invalid", "Enter the client's name and a valid email.")
        if email == request.user.email.lower():
            return _err("self", "You can't invite yourself.")
        if get_user_model().objects.filter(email__iexact=email).exists():
            return _err("already_registered", "This person already has a Capimax BRX account.")
        if BrokerLead.objects.filter(broker=broker, kind="client", email__iexact=email, status="invited").exists():
            return _err("already_invited", "You already invited this person.", status.HTTP_409_CONFLICT)
        since = timezone.now() - timedelta(days=1)
        if BrokerLead.objects.filter(broker=broker, kind="client", created_at__gte=since).count() >= DAILY_INVITES:
            return _err("limit", "You reached today's invitation limit.", status.HTTP_429_TOO_MANY_REQUESTS)
        lead = BrokerLead.objects.create(
            broker=broker, kind=BrokerLead.Kind.CLIENT, status=BrokerLead.Status.INVITED, name=name, email=email,
            phone=(request.data.get("phone") or "").strip()[:40],
            details={"notes": (request.data.get("notes") or "").strip()[:2000]},
        )
        who = _broker_name(broker)
        _send(email, f"{who} invited you to Capimax BRX", "You're invited to Capimax BRX",
              f"Hello {name}, {who} invited you to invest in tokenised real estate on Capimax BRX — "
              "fractional ownership from $100, rental income and a secondary market.",
              "Create your account", _frontend(f"/ref/{broker.referral_code}"),
              "You received this email because a Capimax BRX broker entered your address.")
        return Response(lead_dict(lead), status=status.HTTP_201_CREATED)


# --------------------------------------------------------------------------- #
# Property referral + owner authorization
# --------------------------------------------------------------------------- #
class PropertyLeadView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedBroker]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        broker = request.user.broker_profile
        d = request.data
        title = (d.get("title") or "").strip()[:200]
        details = {k: (str(d.get(k) or "")).strip()[:2000] for k in PROPERTY_FIELDS}
        if not title or not details["location"] or not details["owner_name"]:
            return _err("invalid", "Enter the property name, its location and the owner's name.")
        if details["owner_role"] not in ("owner", "developer"):
            details["owner_role"] = "owner"
        files = request.FILES.getlist("files")
        if len(files) > MAX_FILES:
            return _err("too_many_files", f"Attach up to {MAX_FILES} files.")
        with transaction.atomic():
            lead = BrokerLead.objects.create(
                broker=broker, kind=BrokerLead.Kind.PROPERTY, status=BrokerLead.Status.AWAITING_AUTHORIZATION,
                name=title, email=(d.get("owner_email") or "").strip().lower()[:254],
                phone=(d.get("owner_phone") or "").strip()[:40], details=details,
            )
            for f in files:
                _save_file(lead, f, BrokerLeadDocument.Kind.DOCUMENT)
            auth = request.FILES.get("authorization")
            if auth is not None and _save_file(lead, auth, BrokerLeadDocument.Kind.AUTHORIZATION):
                lead.authorization = BrokerLead.Authorization.UPLOADED
                lead.status = BrokerLead.Status.UNDER_REVIEW
                lead.save(update_fields=["authorization", "status", "updated_at"])
        _admins(lead, "new property referral")
        return Response(lead_dict(lead), status=status.HTTP_201_CREATED)


def _own_lead(request, pk) -> BrokerLead:
    return get_object_or_404(BrokerLead, pk=pk, broker=request.user.broker_profile)


def _authorized(lead: BrokerLead):
    if lead.status == BrokerLead.Status.AWAITING_AUTHORIZATION:
        lead.status = BrokerLead.Status.UNDER_REVIEW
    lead.save()


class AuthorizationUploadView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedBroker]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        lead = _own_lead(request, pk)
        if lead.kind != BrokerLead.Kind.PROPERTY or lead.status in ("listed", "declined", "withdrawn"):
            return _err("closed", "This referral is closed.")
        f = request.FILES.get("file")
        if f is None or _save_file(lead, f, BrokerLeadDocument.Kind.AUTHORIZATION) is None:
            return _err("bad_file", "Upload the signed authorization as PDF, image or Word (15 MB max).")
        if lead.authorization != BrokerLead.Authorization.CONFIRMED:
            lead.authorization = BrokerLead.Authorization.UPLOADED
        _authorized(lead)
        _admins(lead, "owner authorization uploaded")
        return Response(lead_dict(lead))


class AuthorizationRequestView(APIView):
    """Email the owner a link where they read the referral and confirm it themselves."""

    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def post(self, request, pk):
        lead = _own_lead(request, pk)
        if lead.kind != BrokerLead.Kind.PROPERTY or lead.status in ("listed", "declined", "withdrawn"):
            return _err("closed", "This referral is closed.")
        if lead.authorization == BrokerLead.Authorization.CONFIRMED:
            return _err("already_confirmed", "The owner already confirmed.")
        if "@" not in (lead.email or ""):
            return _err("no_owner_email", "Add the owner's email to send them the confirmation link.")
        if lead.auth_requested_at and timezone.now() - lead.auth_requested_at < timedelta(minutes=10):
            return _err("too_soon", "The link was just sent — wait a few minutes before sending it again.",
                        status.HTTP_429_TOO_MANY_REQUESTS)
        if not lead.auth_token:
            lead.auth_token = secrets.token_urlsafe(32)
        lead.auth_requested_at = timezone.now()
        if lead.authorization == BrokerLead.Authorization.NONE:
            lead.authorization = BrokerLead.Authorization.REQUESTED
        lead.save()
        owner = lead.details.get("owner_name") or "there"
        who = _broker_name(lead.broker)
        _send(lead.email, f"Please confirm: {who} is referring your property to Capimax BRX",
              "Confirm the referral of your property",
              f"Hello {owner}, broker {who} asked to refer “{lead.name}” to Capimax BRX, a platform "
              "for tokenised real-estate investment. Open the link to review the details and confirm "
              "that you authorize this referral.",
              "Review and confirm", _frontend(f"/broker-authorization/{lead.auth_token}"),
              "If you don't know this broker or don't agree, ignore this email — nothing happens without your confirmation.")
        return Response(lead_dict(lead))


class LeadCancelView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def post(self, request, pk):
        lead = _own_lead(request, pk)
        if lead.kind == BrokerLead.Kind.CLIENT and lead.status == BrokerLead.Status.INVITED:
            lead.status = BrokerLead.Status.CANCELLED
        elif lead.kind == BrokerLead.Kind.PROPERTY and lead.status in ("awaiting_authorization", "under_review"):
            lead.status = BrokerLead.Status.WITHDRAWN
        else:
            return _err("cannot_cancel", "This referral can't be withdrawn now.")
        lead.auth_token = ""
        lead.save()
        return Response(lead_dict(lead))


class LeadDocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def get(self, request, pk, doc_id):
        doc = get_object_or_404(BrokerLeadDocument, pk=doc_id, lead__pk=pk, lead__broker=request.user.broker_profile)
        if not doc.file:
            raise Http404
        return FileResponse(doc.file.open("rb"), as_attachment=True, filename=doc.original_name or "document")


# --------------------------------------------------------------------------- #
# PUBLIC — the owner confirms from the emailed link
# --------------------------------------------------------------------------- #
def _by_token(token: str) -> BrokerLead:
    if not token or len(token) < 20:
        raise Http404
    lead = BrokerLead.objects.filter(auth_token=token, kind=BrokerLead.Kind.PROPERTY).select_related("broker__user").first()
    if lead is None or lead.status in ("listed", "declined", "withdrawn"):
        raise Http404
    return lead


class OwnerAuthorizationView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "anon"

    def get(self, request, token):
        lead = _by_token(token)
        broker = lead.broker
        return Response({
            "property": lead.name, "location": lead.details.get("location", ""),
            "property_type": lead.details.get("property_type", ""),
            "owner_name": lead.details.get("owner_name", ""),
            "broker_name": _broker_name(broker), "broker_license": broker.license_number or "",
            "confirmed": lead.authorization == BrokerLead.Authorization.CONFIRMED,
            "confirmed_at": lead.auth_confirmed_at,
        })

    def post(self, request, token):
        lead = _by_token(token)
        name = (request.data.get("name") or "").strip()[:200]
        if not request.data.get("confirm") or not name:
            return _err("confirm_required", "Type your full name and tick the box to confirm.")
        if lead.authorization != BrokerLead.Authorization.CONFIRMED:
            lead.authorization = BrokerLead.Authorization.CONFIRMED
            lead.auth_confirmed_at = timezone.now()
            lead.auth_confirmed_name = name
            fwd = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
            lead.auth_confirmed_ip = fwd or request.META.get("REMOTE_ADDR") or None
            _authorized(lead)
            notify_broker(lead)
            _admins(lead, "owner confirmed the referral")
        return Response({"confirmed": True})
