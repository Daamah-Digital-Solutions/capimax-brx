"""
Serializers for the auth foundation. SPEC §5.2.

ROLE POLICY (frontend = source of truth): registration ACCEPTS the role the user
selected in the UI and persists it (see DECISIONS.md "Role policy"). But:
  - `role` / `role_status` are READ-ONLY on every profile serializer, so an existing
    account can never self-elevate (anti-privilege-escalation, SPEC §5).
  - the registration serializer validates the selected role against
    SELF_SELECTABLE_ROLES — 'admin' (and any unknown value) is rejected, never
    silently granted.
  - privileged roles are stored but parked at PENDING_VERIFICATION by the model
    (`apply_self_selected_role`); the API never lets a client flip that gate.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import SELF_SELECTABLE_ROLES, Profile

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    """Read-mostly profile. `role`/`role_status` are read-only — never settable by the client. SPEC §5."""

    class Meta:
        model = Profile
        fields = (
            "id",
            "full_name",
            "phone",
            "avatar_url",
            "is_us_citizen",
            "role",
            "role_status",
            "created_at",
            "updated_at",
        )
        # SPEC §5: anti-privilege-escalation — role & its gate can never be written
        # via the API. Only registration sets role (once), only admin changes it after.
        read_only_fields = ("id", "role", "role_status", "created_at", "updated_at")


class UserSerializer(serializers.ModelSerializer):
    """The `user` object the frontend AuthContext consumes. SPEC §5.2."""

    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "is_email_verified", "date_joined", "profile")
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    """
    Registration input: { email, password, full_name, phone, is_us_citizen, role? }.
    SPEC §4 / §5.2. Creates user + profile, applying the user's SELECTED role.

    `role` is optional and defaults to 'investor' (the frontend's default and the
    value sent when the user never visits the role picker). Privileged selections
    are persisted but gated — see Profile.apply_self_selected_role.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    is_us_citizen = serializers.BooleanField(required=False, default=False)
    # Frontend role choice (RegisterRole.tsx -> Auth.tsx -> signUp). Optional;
    # absent/blank => investor.
    role = serializers.CharField(required=False, allow_blank=True)
    # Broker referral code (Phase 12 Wave A). Optional; carried from a `/ref/<code>` link
    # through the signup flow. If valid, the new user is linked SET-ONCE to that broker
    # (broker.services.attribute_referral). Unknown/blank/own codes are silently ignored.
    ref = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_role(self, value):
        """
        Anti-privilege-escalation: only self-selectable roles are accepted. 'admin'
        (and any unknown value) is REJECTED, never silently granted. SPEC §5.
        Blank/absent normalises to 'investor'.
        """
        value = (value or "").strip().lower()
        if not value:
            return Profile.Role.INVESTOR
        if value not in SELF_SELECTABLE_ROLES:
            raise serializers.ValidationError(
                "Invalid role. This role cannot be self-assigned at registration."
            )
        return value

    def create(self, validated_data):
        profile_fields = {
            "full_name": validated_data.get("full_name") or None,
            "phone": validated_data.get("phone") or None,
            "is_us_citizen": validated_data.get("is_us_citizen", False),
        }
        # Default applied in validate_role; fall back defensively if `role` absent.
        selected_role = validated_data.get("role") or Profile.Role.INVESTOR
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
        )
        # Profile already created by the post_save signal — update its details, then
        # apply the selected role (privileged roles get parked at PENDING_VERIFICATION).
        Profile.objects.filter(user=user).update(**profile_fields)
        profile = Profile.objects.get(user=user)
        profile.apply_self_selected_role(selected_role)
        # Broker referral attribution — set-once (first broker wins). Lazy import keeps
        # apps.core decoupled from apps.broker at module load. A bad/own/unknown code is
        # silently ignored inside attribute_referral; it never blocks registration.
        ref = (validated_data.get("ref") or "").strip()
        if ref:
            from apps.broker.services import attribute_referral

            attribute_referral(profile, ref)
        user.refresh_from_db()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_new_password(self, value):
        validate_password(value)
        return value


class EmailVerificationConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
