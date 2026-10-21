"""
/api/transfers/ — gifts, family transfers and inheritance (apps/transfers/services.py).

  GET  /                          my transfers (sent and received)
  GET  giftable/                  what I can give: free units per property + wallet balance
  POST gifts/                     give units or an amount to anyone, now or on a date
  POST family/                    move units or an amount to one of my family members
  POST <id>/cancel/               cancel an open gift / family transfer (everything returns)
  GET|PUT estate/beneficiaries/   my beneficiaries (+ certificate number)
  GET  estate/certificate/pdf/    my beneficiary certificate (PDF)
  GET|POST estate/claims/         claims I submitted / submit one (multipart, death certificate)
"""
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import EMAIL_UNVERIFIED, needs_email_verification

from . import services
from .models import Beneficiary, EstateCertificate, EstateClaim, UnitTransfer

_CLAIM_MAX_BYTES = 10 * 1024 * 1024
_CLAIM_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


class TransferSerializer(serializers.ModelSerializer):
    direction = serializers.SerializerMethodField()
    counterparty = serializers.SerializerMethodField()
    property_name_ar = serializers.SerializerMethodField()
    amount = serializers.FloatField(read_only=True)
    fee_amount = serializers.FloatField(read_only=True)

    class Meta:
        model = UnitTransfer
        fields = (
            "id", "reference", "kind", "asset", "status", "direction", "counterparty",
            "recipient_email", "recipient_name", "property_slug", "property_name", "property_name_ar", "units",
            "amount", "fee_amount", "message", "occasion", "deliver_on", "expires_at",
            "delivered_at", "closed_reason", "created_at",
        )

    def get_direction(self, obj):
        return "sent" if obj.sender_id == self.context["user"].pk else "received"

    def get_property_name_ar(self, obj):
        """The property's Arabic name (the Arabic site shows it); cached per slug."""
        if not obj.property_slug:
            return ""
        cache = self.context.setdefault("_ar_names", {})
        if obj.property_slug not in cache:
            from apps.properties.models import Property

            cache[obj.property_slug] = (
                Property.objects.filter(slug=obj.property_slug).values_list("name_ar", flat=True).first() or ""
            )
        return cache[obj.property_slug]

    def get_counterparty(self, obj):
        if obj.sender_id == self.context["user"].pk:
            return obj.recipient_name or obj.recipient_email
        return services.display_name(obj.sender)


class _CreateBase(serializers.Serializer):
    asset = serializers.ChoiceField(choices=["units", "cash"])
    property_slug = serializers.CharField(required=False, allow_blank=True, default="")
    units = serializers.IntegerField(required=False, min_value=0, default=0)
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, required=False, default=0)
    message = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")


class GiftCreateSerializer(_CreateBase):
    recipient_email = serializers.EmailField()
    recipient_name = serializers.CharField(required=False, allow_blank=True, max_length=120, default="")
    deliver_on = serializers.DateField(required=False, allow_null=True, default=None)
    occasion = serializers.CharField(required=False, allow_blank=True, max_length=40, default="")


class FamilyCreateSerializer(_CreateBase):
    family_account_id = serializers.UUIDField()


def _ctx(request):
    return {"user": request.user}


class TransferListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = UnitTransfer.objects.filter(
            Q(sender=request.user) | Q(recipient=request.user, status=UnitTransfer.Status.DELIVERED)
        ).select_related("sender", "sender__profile")[:200]
        return Response(TransferSerializer(qs, many=True, context=_ctx(request)).data)


class GiftableView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.wallets.models import OwnershipToken, UserBalance

        from apps.properties.models import Property

        rows = []
        positions = list(OwnershipToken.objects.filter(
            wallet__user=request.user, status=OwnershipToken.Status.ACTIVE, token_amount__gt=0,
        ))
        ar_names = dict(Property.objects.filter(slug__in=[p.property_id for p in positions])
                        .values_list("slug", "name_ar"))
        for pos in positions:
            free = services.free_units(request.user, pos.property_id, pos)
            if free > 0:
                rows.append({
                    "property_slug": pos.property_id, "property_name": pos.property_name,
                    "property_name_ar": ar_names.get(pos.property_id) or "",
                    "free_units": free,
                    "unit_value": float(services.average_cost(request.user, pos.property_id)),
                })
        bal = UserBalance.objects.filter(user=request.user).first()
        from django.conf import settings

        return Response({
            "positions": rows,
            "balance": float(bal.current_balance) if bal else 0.0,
            "gift_fee_percent": settings.GIFT_FEE_PERCENT,
            "family_fee_percent": settings.FAMILY_TRANSFER_FEE_PERCENT,
            "claim_days": settings.TRANSFER_CLAIM_DAYS,
        })


class _MoneyView(APIView):
    permission_classes = [IsAuthenticated]

    def _gate(self, request):
        if needs_email_verification(request.user):
            return Response(EMAIL_UNVERIFIED, status=status.HTTP_403_FORBIDDEN)
        return None


class GiftCreateView(_MoneyView):
    def post(self, request):
        if (resp := self._gate(request)) is not None:
            return resp
        s = GiftCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        t = services.create_gift(request.user, **s.validated_data)
        t.refresh_from_db()
        return Response(TransferSerializer(t, context=_ctx(request)).data, status=status.HTTP_201_CREATED)


class FamilyTransferCreateView(_MoneyView):
    def post(self, request):
        if (resp := self._gate(request)) is not None:
            return resp
        s = FamilyCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        t = services.create_family_transfer(request.user, **s.validated_data)
        t.refresh_from_db()
        return Response(TransferSerializer(t, context=_ctx(request)).data, status=status.HTTP_201_CREATED)


class TransferCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        t = services.cancel(pk, request.user)
        return Response(TransferSerializer(t, context=_ctx(request)).data)


class BeneficiarySerializer(serializers.ModelSerializer):
    percent = serializers.FloatField()

    class Meta:
        model = Beneficiary
        fields = ("id", "full_name", "email", "relationship", "percent")


class BeneficiariesView(APIView):
    permission_classes = [IsAuthenticated]

    def _payload(self, user):
        cert = EstateCertificate.objects.filter(holder=user).first()
        return {
            "beneficiaries": BeneficiarySerializer(Beneficiary.objects.filter(holder=user), many=True).data,
            "certificate_number": cert.number if cert else None,
            "certificate_updated_at": cert.updated_at if cert else None,
        }

    def get(self, request):
        return Response(self._payload(request.user))

    def put(self, request):
        if needs_email_verification(request.user):
            return Response(EMAIL_UNVERIFIED, status=status.HTTP_403_FORBIDDEN)
        rows = request.data.get("beneficiaries")
        if not isinstance(rows, list) or len(rows) > 20:
            return Response({"beneficiaries": "Send a list of up to 20 beneficiaries."},
                            status=status.HTTP_400_BAD_REQUEST)
        services.set_beneficiaries(request.user, rows)
        return Response(self._payload(request.user))


class CertificatePdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        number, pdf = services.certificate_pdf(request.user)
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{number}.pdf"'
        return resp


class EstateClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstateClaim
        fields = ("id", "certificate_number", "date_of_death", "status", "decision_note",
                  "created_at", "decided_at")


class EstateClaimsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = EstateClaim.objects.filter(claimant=request.user)
        return Response(EstateClaimSerializer(qs, many=True).data)

    def post(self, request):
        import os

        upload = request.FILES.get("death_certificate")
        if upload is None:
            return Response({"death_certificate": "Attach the death certificate."},
                            status=status.HTTP_400_BAD_REQUEST)
        if upload.size and upload.size > _CLAIM_MAX_BYTES:
            return Response({"death_certificate": "The file is larger than 10 MB."},
                            status=status.HTTP_400_BAD_REQUEST)
        if os.path.splitext(upload.name or "")[1].lower() not in _CLAIM_EXT:
            return Response({"death_certificate": "Upload a PDF or an image."},
                            status=status.HTTP_400_BAD_REQUEST)
        date_of_death = serializers.DateField(required=False, allow_null=True).run_validation(
            request.data.get("date_of_death") or None
        )
        claim = services.submit_claim(
            request.user, certificate_number=request.data.get("certificate_number", ""),
            death_certificate=upload, date_of_death=date_of_death,
            notes=request.data.get("notes", ""),
        )
        return Response(EstateClaimSerializer(claim).data, status=status.HTTP_201_CREATED)
