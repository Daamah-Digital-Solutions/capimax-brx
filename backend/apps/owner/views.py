"""
Owner API — Phase 7 Wave A (OWNER_SURFACE.md). Backs the owner KYB onboarding entry
(src/hooks/useOwnerProfile.ts).

  GET   /api/owner/profile/            Own owner profile (404 → frontend treats as null).
  POST  /api/owner/profile/            Apply as owner (create; idempotent).
  POST  /api/owner/kyb/submit/         Persist business info → KYB under_review.
  POST  /api/owner/kyb/access-token/   Sumsub WebSDK token (owner business level; 503
                                       when keys deferred).

Everything is OWNER-SCOPED: a caller only ever sees/edits their own owner row.
KYB approval is AUTOMATIC via the shared signed Sumsub webhook (owner business
level) — no admin in the normal path. Mirrors apps/lp/views.py.
"""
import logging

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasActivatedPropertySubmitter
from apps.kyc import sumsub

from .models import (
    OwnerKYBDocument,
    OwnerProfile,
    PropertySubmission,
    SubmissionDocument,
    SubmissionStatus,
)
from .serializers import (
    OwnerApplySerializer,
    OwnerKYBDocumentSerializer,
    OwnerKYBSubmitSerializer,
    OwnerProfileSerializer,
    PropertySubmissionSerializer,
    PropertySubmissionWriteSerializer,
    SubmissionDocumentSerializer,
)
from .services import (
    MissingRequiredDocuments,
    mark_documents_pending,
    submit_kyb,
    submit_submission,
)

log = logging.getLogger(__name__)


def _get_owner(user):
    return OwnerProfile.objects.filter(user=user).first()


class OwnerProfileView(APIView):
    """GET the caller's owner profile (404 if none); POST to apply (idempotent)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "No owner profile for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(OwnerProfileSerializer(owner).data)

    def post(self, request):
        existing = _get_owner(request.user)
        if existing is not None:
            # Idempotent: applying again just returns the current profile.
            return Response(OwnerProfileSerializer(existing).data)

        serializer = OwnerApplySerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        owner = OwnerProfile.objects.create(
            user=request.user,
            company_name=data.get("company_name") or None,
            contact_name=data["contact_name"],
            email=data["email"],
            phone=data.get("phone") or None,
            country=data.get("country") or None,
        )
        return Response(
            OwnerProfileSerializer(owner).data, status=status.HTTP_201_CREATED
        )


class OwnerKYBSubmitView(APIView):
    """Persist business info + advance KYB to `under_review` (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "Apply as an owner before submitting KYB."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = OwnerKYBSubmitSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        owner = submit_kyb(owner, business_info=serializer.validated_data)
        return Response(OwnerProfileSerializer(owner).data)


class OwnerKYBDocumentsView(APIView):
    """List the caller's own entity-KYB documents; upload one (multipart).

    Gated on "applied first" (an owner profile must exist) — NOT on Sumsub, so the
    doc vault works while the provider is deferred and an admin reviews manually.
    Mirrors apps/lp/views.py LPKYBDocumentsView.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "Apply as an owner before uploading KYB documents."},
                status=status.HTTP_404_NOT_FOUND,
            )
        docs = OwnerKYBDocument.objects.filter(owner=owner)
        return Response(OwnerKYBDocumentSerializer(docs, many=True).data)

    def post(self, request):
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "Apply as an owner before uploading KYB documents."},
                status=status.HTTP_404_NOT_FOUND,
            )
        upload = request.FILES.get("file")
        document_type = request.data.get("document_type") or "other"
        document_name = request.data.get("document_name") or (
            upload.name if upload else "document"
        )
        doc = OwnerKYBDocument.objects.create(
            owner=owner,
            user=request.user,
            document_name=document_name,
            document_type=document_type,
            file=upload,
            file_size=getattr(upload, "size", None),
        )
        mark_documents_pending(owner)
        return Response(
            OwnerKYBDocumentSerializer(doc).data, status=status.HTTP_201_CREATED
        )


class OwnerKYBDocumentDownloadView(APIView):
    """Owner-scoped download of one of their OWN entity-KYB documents (blob).

    Cross-user / cross-role → 404 (the queryset is filtered to the caller's own
    owner profile). Mirrors the partner DeliverableDocumentDownloadView self-scoping.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "No owner profile for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        doc = get_object_or_404(OwnerKYBDocument, pk=doc_id, owner=owner)
        if not doc.file:
            return Response({"detail": "No file."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            doc.file.open("rb"), as_attachment=True, filename=doc.document_name
        )


class OwnerKYBAccessTokenView(APIView):
    """
    Issue a Sumsub WebSDK access token for owner KYB (owner business level). When
    Sumsub is unconfigured (deferred keys) returns 503 + a machine code so the
    frontend degrades to the form/dev path rather than breaking — mirrors LP KYB.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.conf import settings

        if not sumsub.is_configured():
            return Response(
                {"configured": False, "code": "kyb_provider_unconfigured",
                 "detail": "KYB provider is not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "Apply as an owner first."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            if not owner.sumsub_applicant_id:
                owner.sumsub_applicant_id = sumsub.create_applicant(
                    request.user.pk, level_name=settings.SUMSUB_OWNER_KYB_LEVEL_NAME
                )
                owner.mark_kyb_submitted()
                owner.save()
            token = sumsub.issue_access_token(
                request.user.pk, level_name=settings.SUMSUB_OWNER_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Sumsub owner-KYB access-token issue failed for user %s", request.user.pk)
            return Response(
                {"configured": True, "code": "kyb_provider_error",
                 "detail": "Could not start verification. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"configured": True, "token": token})


# --------------------------------------------------------------------------- #
# Property submission intake — Phase 7 Wave B (owner) + Phase 8 Wave B (developer).
# ALL gated [IsAuthenticated, HasActivatedPropertySubmitter] — an approved property
# OWNER **or** an approved property DEVELOPER (KYB-gated, like investing requires
# approved KYC) — and SUBMITTER-SCOPED (a caller only ever sees/edits their OWN
# submissions/documents, regardless of role). The submission records `submitter`
# generically; nothing here assumes the submitter is specifically an owner. NO Property
# row is created or published in this wave (that is Wave C).
# --------------------------------------------------------------------------- #
def _get_submission(user, submission_id):
    """Submitter-scoped lookup: only the submitter's own submission (else 404)."""
    return get_object_or_404(PropertySubmission, pk=submission_id, submitter=user)


class SubmissionsView(APIView):
    """GET the caller's submissions; POST to create a new DRAFT."""

    permission_classes = [IsAuthenticated, HasActivatedPropertySubmitter]

    def get(self, request):
        subs = PropertySubmission.objects.filter(submitter=request.user)
        return Response(PropertySubmissionSerializer(subs, many=True).data)

    def post(self, request):
        serializer = PropertySubmissionWriteSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        sub = PropertySubmission.objects.create(
            submitter=request.user, **serializer.validated_data
        )
        return Response(
            PropertySubmissionSerializer(sub).data, status=status.HTTP_201_CREATED
        )


class SubmissionDetailView(APIView):
    """GET one own submission; PATCH content (only while DRAFT)."""

    permission_classes = [IsAuthenticated, HasActivatedPropertySubmitter]

    def get(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        return Response(PropertySubmissionSerializer(sub).data)

    def patch(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        if sub.status != SubmissionStatus.DRAFT:
            return Response(
                {"detail": "Only a draft submission can be edited.",
                 "code": "not_a_draft"},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = PropertySubmissionWriteSerializer(
            data=request.data or {}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(sub, field, value)
        sub.save()
        return Response(PropertySubmissionSerializer(sub).data)


class SubmissionSubmitView(APIView):
    """POST: transition a DRAFT → SUBMITTED (validates required documents present)."""

    permission_classes = [IsAuthenticated, HasActivatedPropertySubmitter]

    def post(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        try:
            sub = submit_submission(sub)
        except MissingRequiredDocuments as exc:
            return Response(
                {"detail": "Upload the required documents before submitting.",
                 "code": "missing_required_documents", "missing": exc.missing},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(PropertySubmissionSerializer(sub).data)


class SubmissionDocumentsView(APIView):
    """GET the submission's documents; POST to upload one (multipart)."""

    permission_classes = [IsAuthenticated, HasActivatedPropertySubmitter]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        docs = SubmissionDocument.objects.filter(submission=sub)
        return Response(SubmissionDocumentSerializer(docs, many=True).data)

    def post(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        if sub.status != SubmissionStatus.DRAFT:
            return Response(
                {"detail": "Documents can only be added while the submission is a draft.",
                 "code": "not_a_draft"},
                status=status.HTTP_409_CONFLICT,
            )
        upload = request.FILES.get("file")
        document_type = request.data.get("document_type") or "other"
        document_name = request.data.get("document_name") or (
            upload.name if upload else "document"
        )
        doc = SubmissionDocument.objects.create(
            submission=sub,
            document_type=document_type,
            document_name=document_name,
            file=upload,
            file_size=getattr(upload, "size", None),
        )
        return Response(
            SubmissionDocumentSerializer(doc).data, status=status.HTTP_201_CREATED
        )


class SubmissionDocumentDetailView(APIView):
    """DELETE one of the caller's own submission documents (draft only)."""

    permission_classes = [IsAuthenticated, HasActivatedPropertySubmitter]

    def delete(self, request, submission_id, doc_id):
        sub = _get_submission(request.user, submission_id)
        doc = get_object_or_404(SubmissionDocument, pk=doc_id, submission=sub)
        if sub.status != SubmissionStatus.DRAFT:
            return Response(
                {"detail": "Documents can only be removed while the submission is a draft.",
                 "code": "not_a_draft"},
                status=status.HTTP_409_CONFLICT,
            )
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubmissionDocumentDownloadView(APIView):
    """Owner-scoped download of a submission document (blob)."""

    permission_classes = [IsAuthenticated, HasActivatedPropertySubmitter]

    def get(self, request, submission_id, doc_id):
        sub = _get_submission(request.user, submission_id)
        doc = get_object_or_404(SubmissionDocument, pk=doc_id, submission=sub)
        if not doc.file:
            return Response({"detail": "No file."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            doc.file.open("rb"), as_attachment=True, filename=doc.document_name
        )


# --------------------------------------------------------------------------- #
# Owner analytics — Phase 7 Wave D + the OwnerReports realness pass. Owner-scoped,
# read-side ONLY (no money/mint, no migration). Three surfaces, all period-aware:
#   * earnings      — primary-sale proceeds (gross − fees) per property + totals.
#   * distributions — the owner's properties' rental-yield distribution history/totals
#                     (aggregated from the distributions domain; the owner does NOT
#                     receive these — they're the cash their properties paid HOLDERS).
#   * investors     — the distinct investor base across the owner's properties.
# Balance + payout still reuse GET /api/wallets/balance/ and /api/wallets/withdrawals/.
# --------------------------------------------------------------------------- #
def _period_start(period):
    """
    The inclusive start date for a period window, or None for "all"/unknown (read-side
    filter only — no schema change). Windows are relative to today: this calendar month,
    quarter, or year.
    """
    from django.utils import timezone

    today = timezone.now().date()
    if period == "month":
        return today.replace(day=1)
    if period == "quarter":
        quarter_first_month = 3 * ((today.month - 1) // 3) + 1
        return today.replace(month=quarter_first_month, day=1)
    if period == "year":
        return today.replace(month=1, day=1)
    return None  # "all" (or anything unrecognized) → no time filter


def _owner_properties(user):
    """The caller's owned (submitted_by) properties — the self-scoping anchor for analytics."""
    from apps.properties.models import Property

    return list(Property.objects.filter(submitted_by=user))


def _mask_investor(email):
    """
    A privacy-preserving label for an investor shown to the property owner: first char of
    the local part + the domain (e.g. 'a***@gmail.com'). The owner sees a distinct,
    stable-ish handle without the full PII address. Never exposes the full email.
    """
    if not email or "@" not in email:
        return "Investor"
    local, _, domain = email.partition("@")
    head = local[0] if local else "?"
    return f"{head}***@{domain}"


class OwnerEarningsView(APIView):
    """
    Summary of the caller's primary-sale earnings, per owned property + totals.
    Optional `?period=month|quarter|year|all` narrows the underlying investments by date.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from decimal import Decimal, ROUND_HALF_UP

        from django.db.models import Count, Sum

        from apps.investments.models import Investment, PaymentStatus

        start = _period_start(request.query_params.get("period") or "all")

        rows = []
        total_net = Decimal("0")
        total_units = 0
        total_investors = 0
        # Only the caller's owned (submitted_by) properties.
        for prop in _owner_properties(request.user):
            inv_qs = Investment.objects.filter(
                property=prop, payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
            )
            if start is not None:
                inv_qs = inv_qs.filter(created_at__date__gte=start)
            agg = inv_qs.aggregate(
                gross=Sum("amount_invested"),
                units=Sum("token_amount"),
                investors=Count("user", distinct=True),
            )
            gross = Decimal(agg["gross"] or 0)
            units = int(agg["units"] or 0)
            investors = int(agg["investors"] or 0)
            fee_percent = (prop.fee_platform or Decimal("0")) + (prop.fee_management or Decimal("0"))
            fees = (gross * fee_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            net = (gross - fees).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total_net += net
            total_units += units
            total_investors += investors
            rows.append({
                "property_id": prop.slug,
                "property_name": prop.name,
                "is_published": prop.is_published,
                "token_supply": int(prop.token_supply or 0),
                "units_sold": units,
                "investors": investors,
                "gross_proceeds": float(gross),
                "fees": float(fees),
                "net_proceeds": float(net),
            })

        return Response({
            "total_net_proceeds": float(total_net),
            "total_units_sold": total_units,
            "total_investors": total_investors,
            "properties": rows,
        })


class OwnerDistributionsView(APIView):
    """
    The caller's properties' rental-yield DISTRIBUTION history + totals (read-side
    aggregation over the distributions domain, self-scoped to the owner's properties).
    `?period=` narrows by the distribution pay-date. An owner with no distributions gets
    an honest empty payload (zeros + []), never a fabricated figure.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from decimal import Decimal

        from apps.distributions.models import Distribution

        start = _period_start(request.query_params.get("period") or "all")
        slug_to_name = {p.slug: p.name for p in _owner_properties(request.user)}

        dist_qs = Distribution.objects.filter(
            property_id__in=list(slug_to_name.keys()),
            status=Distribution.Status.PAID,
        )
        if start is not None:
            dist_qs = dist_qs.filter(pay_date__gte=start)

        per_prop: dict = {}
        total = Decimal("0")
        count = 0
        # Newest first within each property.
        for d in dist_qs.order_by("property_id", "-pay_date", "-created_at"):
            amount = Decimal(d.pool_amount_usd or 0)
            total += amount
            count += 1
            slot = per_prop.setdefault(d.property_id, {
                "property_id": d.property_id,
                "property_name": slug_to_name.get(d.property_id) or d.property_name or d.property_id,
                "_total": Decimal("0"),
                "distribution_count": 0,
                "last_pay_date": None,
                "distributions": [],
            })
            slot["_total"] += amount
            slot["distribution_count"] += 1
            iso = d.pay_date.isoformat()
            if slot["last_pay_date"] is None or iso > slot["last_pay_date"]:
                slot["last_pay_date"] = iso
            slot["distributions"].append({
                "period_label": d.period_label or None,
                "dist_type": d.dist_type or None,
                "pay_date": iso,
                "amount": float(amount),
            })

        properties = []
        for slot in per_prop.values():
            slot["total_distributed"] = float(slot.pop("_total"))
            properties.append(slot)
        properties.sort(key=lambda s: s["total_distributed"], reverse=True)

        return Response({
            "total_distributed": float(total),
            "distribution_count": count,
            "properties": properties,
        })


class OwnerInvestorsView(APIView):
    """
    The distinct INVESTOR base across the caller's properties (read-side aggregation over
    completed+minted investments, self-scoped). Returns a per-property breakdown and a
    per-investor list (investor PII MASKED to a privacy-preserving handle). `?period=`
    narrows by investment date. `total_investors` is the TRUE distinct count across all
    of the owner's properties (an investor in two properties counts once). Honest empty
    when the owner has no investors yet.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from decimal import Decimal

        from django.db.models import Count, Sum

        from apps.investments.models import Investment, PaymentStatus

        start = _period_start(request.query_params.get("period") or "all")

        by_property = []
        investor_map: dict = {}  # user_id -> aggregated position across the owner's props
        for prop in _owner_properties(request.user):
            inv_qs = Investment.objects.filter(
                property=prop, payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
            )
            if start is not None:
                inv_qs = inv_qs.filter(created_at__date__gte=start)

            agg = inv_qs.aggregate(
                investors=Count("user", distinct=True),
                units=Sum("token_amount"),
                value=Sum("amount_invested"),
            )
            by_property.append({
                "property_id": prop.slug,
                "property_name": prop.name,
                "investors": int(agg["investors"] or 0),
                "units": int(agg["units"] or 0),
                "value": float(Decimal(agg["value"] or 0)),
            })

            per = inv_qs.values("user_id", "user__email").annotate(
                units=Sum("token_amount"), value=Sum("amount_invested"),
            )
            for r in per:
                slot = investor_map.setdefault(r["user_id"], {
                    "label": _mask_investor(r["user__email"]),
                    "units": 0,
                    "value": Decimal("0"),
                    "properties": set(),
                })
                slot["units"] += int(r["units"] or 0)
                slot["value"] += Decimal(r["value"] or 0)
                slot["properties"].add(prop.name)

        investors = [{
            "label": slot["label"],
            "units": slot["units"],
            "value": float(slot["value"]),
            "properties": sorted(slot["properties"]),
            "property_count": len(slot["properties"]),
        } for slot in investor_map.values()]
        investors.sort(key=lambda s: s["value"], reverse=True)

        total_units = sum(s["units"] for s in investors)
        total_value = float(sum((Decimal(str(s["value"])) for s in investors), Decimal("0")))

        return Response({
            "total_investors": len(investors),  # TRUE distinct across all owner properties
            "total_units": total_units,
            "total_value": total_value,
            "investors": investors,
            "by_property": by_property,
        })
