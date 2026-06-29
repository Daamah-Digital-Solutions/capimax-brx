"""
Partner serializers — Phase 11 Wave A. Mirrors the developer serializers' approach: a
full profile serializer (server-controlled status/KYB/directory-status fields read-only)
+ thin apply / directory-update / KYB-submit input serializers. Only ever used for the
caller's OWN profile.

The public directory uses its own lean serializer (PublicPartnerSerializer) shaped to
Partners.tsx — it never exposes KYB/contact/Sumsub internals.

No Sumsub ids are exposed.
"""
from rest_framework import serializers

from .models import (
    Assignment,
    AssignmentEvent,
    Deliverable,
    PartnerCategory,
    PartnerKYBDocument,
    PartnerProfile,
)

# Directory fields the partner may write (decision #3).
_DIRECTORY_INPUT = (
    "company_name", "company_name_ar", "category", "description", "description_ar",
    "logo_url", "country", "country_ar", "website",
)


class PartnerProfileSerializer(serializers.ModelSerializer):
    """Full self-scoped read of the caller's partner profile (KYB + directory state)."""

    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = PartnerProfile
        fields = (
            "id", "user_id",
            "contact_name", "email", "phone",
            "status",
            "applied_at", "approved_at", "rejected_at", "rejection_reason",
            "kyb_status", "business_type", "business_registration_number", "tax_id",
            "business_address", "business_description",
            "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
            "kyb_rejection_reason",
            # Partner-entered directory fields + the INDEPENDENT directory state.
            "company_name", "company_name_ar", "category", "description",
            "description_ar", "logo_url", "country", "country_ar", "website",
            "directory_status", "directory_reviewed_at", "directory_review_notes",
            "created_at", "updated_at",
        )
        # Status/approval/KYB-state AND directory_status are server-/admin-controlled.
        # The partner edits the directory DATA fields (via the update serializer), never
        # the directory STATUS — that is the admin's separate approve/reject decision.
        read_only_fields = (
            "id", "user_id", "status", "applied_at", "approved_at", "rejected_at",
            "rejection_reason", "kyb_status", "kyb_submitted_at", "kyb_approved_at",
            "kyb_rejected_at", "kyb_rejection_reason",
            "directory_status", "directory_reviewed_at", "directory_review_notes",
            "created_at", "updated_at",
        )


class _DirectoryFieldsMixin(serializers.Serializer):
    """The partner-entered public-directory fields (all optional)."""

    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    company_name_ar = serializers.CharField(required=False, allow_blank=True, max_length=255)
    category = serializers.ChoiceField(
        choices=PartnerCategory.choices, required=False, allow_blank=True
    )
    description = serializers.CharField(required=False, allow_blank=True)
    description_ar = serializers.CharField(required=False, allow_blank=True)
    logo_url = serializers.URLField(required=False, allow_blank=True, max_length=500)
    country = serializers.CharField(required=False, allow_blank=True, max_length=120)
    country_ar = serializers.CharField(required=False, allow_blank=True, max_length=120)
    website = serializers.URLField(required=False, allow_blank=True, max_length=500)


class PartnerApplySerializer(_DirectoryFieldsMixin):
    """
    Apply as a partner. Creates the pending profile (entity contact details), and may
    carry the directory fields in the same payload (all optional).
    """

    contact_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)


class PartnerDirectorySerializer(_DirectoryFieldsMixin):
    """The partner updates their own public-directory fields (no status change)."""


class PartnerKYBSubmitSerializer(serializers.Serializer):
    """Business info the partner KYB form sends (mirrors developer KYB submit)."""

    business_type = serializers.CharField(max_length=64)
    business_registration_number = serializers.CharField(max_length=120)
    tax_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    business_address = serializers.CharField(max_length=500)
    business_description = serializers.CharField(required=False, allow_blank=True)


class PartnerKYBDocumentSerializer(serializers.ModelSerializer):
    """A partner entity-KYB document (read shape). Mirrors OwnerKYBDocumentSerializer.
    SEPARATE from DeliverableDocument (Wave-B work product)."""

    partner_id = serializers.UUIDField(read_only=True)
    file_path = serializers.SerializerMethodField()

    class Meta:
        model = PartnerKYBDocument
        fields = (
            "id", "partner_id", "document_name", "document_type",
            "file_path", "file_size", "status", "created_at",
        )
        read_only_fields = fields

    def get_file_path(self, obj) -> str:
        return obj.file.name if obj.file else ""


class PublicPartnerSerializer(serializers.ModelSerializer):
    """
    The PUBLIC directory shape (Partners.tsx). Lists only directory-approved partners;
    exposes ONLY display data + a `verified` badge (KYB-approved). No contact, no KYB
    internals, no Sumsub ids.
    """

    name = serializers.CharField(source="company_name")
    nameAr = serializers.CharField(source="company_name_ar")
    descriptionAr = serializers.CharField(source="description_ar")
    countryAr = serializers.CharField(source="country_ar")
    verified = serializers.SerializerMethodField()

    class Meta:
        model = PartnerProfile
        fields = (
            "id", "name", "nameAr", "category", "description", "descriptionAr",
            "logo_url", "country", "countryAr", "website", "verified",
        )

    def get_verified(self, obj) -> bool:
        # The "verified" badge reflects entity verification (KYB approved).
        return obj.status == "approved"


# --------------------------------------------------------------------------- #
# Wave B — assignment / deliverable workflow (StrategicPartners.tsx). Shaped to the
# frontend AssignedAsset/Deliverable mock so the page maps 1:1 (status strings already
# match the frontend literals). `progress` is DERIVED; `type`/`location` are localized on
# the frontend from `service_type` + the bilingual fields.
# --------------------------------------------------------------------------- #
class DeliverableSerializer(serializers.ModelSerializer):
    nameEn = serializers.CharField(source="name")
    name = serializers.SerializerMethodField()      # Arabic (falls back to English)
    dueDate = serializers.DateField(source="due_date", allow_null=True)
    has_document = serializers.SerializerMethodField()
    # The latest uploaded document (id + filename) so the Documents tab can offer a real
    # self-scoped download. null when nothing uploaded yet — `has_document` stays the gate.
    document_id = serializers.SerializerMethodField()
    document_name = serializers.SerializerMethodField()

    class Meta:
        model = Deliverable
        fields = (
            "id", "name", "nameEn", "status", "dueDate",
            "has_document", "document_id", "document_name",
        )

    def get_name(self, obj) -> str:
        return obj.name_ar or obj.name

    def get_has_document(self, obj) -> bool:
        return obj.documents.exists()

    def _latest_document(self, obj):
        # DeliverableDocument default ordering is ("-uploaded_at",) → first() is newest.
        return obj.documents.first()

    def get_document_id(self, obj):
        doc = self._latest_document(obj)
        return str(doc.id) if doc else None

    def get_document_name(self, obj) -> str:
        doc = self._latest_document(obj)
        return doc.original_filename if doc else ""


class AssignmentSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()       # Arabic (falls back to English)
    nameEn = serializers.CharField(source="property_name")
    assignedDate = serializers.DateTimeField(source="assigned_at")
    dueDate = serializers.DateField(source="due_date", allow_null=True)
    progress = serializers.SerializerMethodField()
    deliverables = DeliverableSerializer(many=True, read_only=True)

    class Meta:
        model = Assignment
        fields = (
            "id", "name", "nameEn", "service_type", "location", "location_ar",
            "assignedDate", "dueDate", "status", "progress", "notes", "review_notes",
            "deliverables",
        )

    def get_name(self, obj) -> str:
        return obj.property_name_ar or obj.property_name

    def get_progress(self, obj) -> int:
        return obj.derived_progress()


class AssignmentEventSerializer(serializers.ModelSerializer):
    """The derived activity-feed row. `event_type` + context → localized on the frontend."""

    property = serializers.CharField(source="assignment.property_name")
    property_ar = serializers.CharField(source="assignment.property_name_ar")
    deliverable = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentEvent
        fields = ("id", "event_type", "property", "property_ar", "deliverable", "created_at")

    def get_deliverable(self, obj) -> str:
        return (obj.meta or {}).get("deliverable", "")
