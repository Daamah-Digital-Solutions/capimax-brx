"""
Core foundation models: User + Profile.

SPEC §3.0 / §3.13:
- Custom user: email-as-login, no username, UUID primary key (matches Supabase
  which keys users by UUID and logs in by email).
- Profile: 1:1 with User, holds the server-controlled `role`.
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user. SPEC §3.13: AbstractBaseUser + PermissionsMixin, email login, UUID pk."""

    # UUID pk so ids line up with the Supabase model and are non-enumerable. SPEC §3.13.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_("email address"), unique=True)

    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into the admin site."),
    )
    is_active = models.BooleanField(_("active"), default=True)
    # Email-verification scaffolding. The flag flips when the verification token
    # is confirmed; a real provider sends the email in a later phase. SPEC §5.2 / §6.
    is_email_verified = models.BooleanField(_("email verified"), default=False)

    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # email + password only; profile fields collected separately

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ("-date_joined",)

    def __str__(self):
        return self.email


class Profile(models.Model):
    """
    1:1 profile holding the user's role and contact details. SPEC §3.0.

    Auto-created via a post_save signal on User creation (replaces the Supabase
    `handle_new_user` trigger, which was left unwired — SPEC §4.3).

    ROLE POLICY (corrected — frontend is the source of truth):
    The frontend (`RegisterRole.tsx` -> `Auth.tsx`) genuinely lets a user CHOOSE a
    role at signup from six options. We follow that: the chosen role is accepted and
    PERSISTED in `role`. See DECISIONS.md "Role policy" for the full rationale and the
    frontend evidence.

    SECURITY — two-layer model (anti-privilege-escalation, SPEC §5 / §5.2):
      1. `role` is set ONCE, at registration, from the user's selection. It may NEVER
         be changed afterwards through any user-facing serializer (both `role` and
         `role_status` are read-only on every API serializer). Only admin/staff change
         them via the Django admin. So an existing account cannot self-elevate.
      2. `role_status` gates PRIVILEGED CAPABILITIES. Selecting a privileged role
         (owner/developer/broker/lp/partner) stores the role but parks it at
         PENDING_VERIFICATION — the user does NOT gain privileged powers (submitting
         properties, earning commissions, LP market access, …) until verification
         flips it to ACTIVE. This matches the frontend's own flow, which frames
         KYC/KYB as a required "Step 3" AFTER role choice (RegisterRole.tsx stepper +
         per-role verification badges + the "Verification requirements apply per
         Reg D / Reg S" note). 'admin' is NOT self-selectable (see SELF_SELECTABLE_ROLES).
    """

    class Role(models.TextChoices):
        # Full set offered by the frontend role picker (RegisterRole.tsx ROLES[],
        # mirrored in Auth.tsx UserRole). Frontend wins over the older Supabase
        # CHECK (investor/owner/broker) and SPEC §3.0 enum — we add developer/lp/
        # partner, plus admin (SPEC §7C.2: the UI gates on role='admin').
        INVESTOR = "investor", _("Investor")
        DEVELOPER = "developer", _("Developer")
        OWNER = "owner", _("Owner")
        BROKER = "broker", _("Broker")
        LP = "lp", _("Liquidity Provider")
        PARTNER = "partner", _("Partner")
        ADMIN = "admin", _("Admin")

    class RoleStatus(models.TextChoices):
        ACTIVE = "active", _("Active")
        PENDING_VERIFICATION = "pending_verification", _("Pending verification")
        SUSPENDED = "suspended", _("Suspended")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        "core.User",
        on_delete=models.CASCADE,
        related_name="profile",
    )

    full_name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=32, blank=True, null=True)
    avatar_url = models.URLField(blank=True, null=True)
    is_us_citizen = models.BooleanField(default=False)  # collected at signup. SPEC §3.0

    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.INVESTOR,  # selection applied at registration; investor is the baseline
    )
    # Capability gate for privileged roles. Default ACTIVE so the baseline investor
    # (and the signal-created profile) is immediately usable; privileged selections
    # are parked at PENDING_VERIFICATION by `apply_self_selected_role`.
    role_status = models.CharField(
        max_length=24,
        choices=RoleStatus.choices,
        default=RoleStatus.ACTIVE,
    )
    role_verified_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)  # replaces update_updated_at trigger

    class Meta:
        verbose_name = _("profile")
        verbose_name_plural = _("profiles")

    def __str__(self):
        return f"{self.full_name or self.user.email} ({self.role})"

    def save(self, *args, **kwargs):
        # Stamp the verification time the moment a role goes ACTIVE (covers the
        # admin manually flipping the gate AND the automated KYC/KYB webhook path).
        if self.role_status == self.RoleStatus.ACTIVE and self.role_verified_at is None:
            self.role_verified_at = timezone.now()
            if "update_fields" in kwargs and kwargs["update_fields"] is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {"role_verified_at"}
        super().save(*args, **kwargs)

    # ----------------------------------------------------------------------- #
    # Role helpers
    # ----------------------------------------------------------------------- #
    @property
    def requires_verification(self) -> bool:
        """Privileged roles must pass verification before their powers go live."""
        return self.role in ROLES_REQUIRING_VERIFICATION

    @property
    def is_role_active(self) -> bool:
        """
        True when the user's role capabilities are live. Investor (and any non-
        privileged role) is active by default; privileged roles are active only
        once verification has flipped `role_status` to ACTIVE. Used by later
        domains' permission checks (see core.permissions.HasActivatedRole).
        """
        return self.role_status == self.RoleStatus.ACTIVE

    def apply_self_selected_role(self, role: str) -> None:
        """
        Apply a role the user selected at registration.

        Privileged roles are stored but parked at PENDING_VERIFICATION (capabilities
        gated until verification). Non-privileged roles go straight to ACTIVE.
        Does NOT touch already-existing accounts beyond registration — registration
        is the only caller (anti-escalation, SPEC §5).
        """
        self.role = role
        if role in ROLES_REQUIRING_VERIFICATION:
            self.role_status = self.RoleStatus.PENDING_VERIFICATION
            self.role_verified_at = None
        else:
            self.role_status = self.RoleStatus.ACTIVE
        self.save(update_fields=["role", "role_status", "role_verified_at", "updated_at"])


# Roles a user may pick for themselves at signup. 'admin' is deliberately excluded:
# it can never be self-assigned and is granted only by staff in the Django admin.
SELF_SELECTABLE_ROLES = frozenset(
    {
        Profile.Role.INVESTOR,
        Profile.Role.DEVELOPER,
        Profile.Role.OWNER,
        Profile.Role.BROKER,
        Profile.Role.LP,
        Profile.Role.PARTNER,
    }
)

# Privileged roles whose capabilities (submit properties, earn commissions, LP
# market, partner tooling) stay gated behind a verification/approval state rather
# than going live the instant someone self-selects them. SECURITY guardrail (Part A
# #4). DECISIONS.md "Role policy".
ROLES_REQUIRING_VERIFICATION = frozenset(
    {
        Profile.Role.DEVELOPER,
        Profile.Role.OWNER,
        Profile.Role.BROKER,
        Profile.Role.LP,
        Profile.Role.PARTNER,
    }
)
