"""
Reusable permission foundation.

Mirrors the Supabase RLS default — "users see only their own rows" — as DRF
object-level permissions. Every later domain extends these. SPEC §5.2.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwner(BasePermission):
    """
    Object-level: the requesting user must own the object.

    Default owner attribute is `user`; override `owner_field` on a subclass for
    models that name it differently (e.g. `investor`, `seller`). SPEC §5.2.

    SECURITY-FIRST: this is object-level only — always pair it with
    IsAuthenticated and a queryset filtered to request.user so list endpoints
    never leak other users' rows.
    """

    owner_field = "user"

    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, getattr(view, "owner_field", self.owner_field), None)
        return owner == request.user


class IsOwnerOrReadOnly(IsOwner):
    """Owner may write; anyone authenticated may read. For mixed public/owned data."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return super().has_object_permission(request, view, obj)


class IsAdminRole(BasePermission):
    """Allow staff or users whose profile role is 'admin'. SPEC §7C.2."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_staff:
            return True
        profile = getattr(user, "profile", None)
        return bool(profile and profile.role == "admin")


class HasActivatedRole(BasePermission):
    """
    Object-/view-level gate for PRIVILEGED-ROLE capabilities.

    A user may SELECT a privileged role at signup (owner/developer/broker/lp/
    partner), but that role's powers — submitting properties, earning commissions,
    LP-market access, partner tooling — stay gated until verification flips
    `profile.role_status` to ACTIVE (SECURITY guardrail, Part A #4; DECISIONS.md
    "Role policy"). Later domains attach this to their privileged endpoints, e.g.:

        permission_classes = [IsAuthenticated, HasActivatedRole]

    Investors (the non-privileged baseline) are always active, so this never blocks
    ordinary investor flows. Verification is automated via KYC/KYB webhooks in a
    later phase (DECISIONS.md: provider-driven, no manual approval); admin can also
    flip the gate manually as the exception handler.
    """

    message = "Your role is pending verification. Complete KYC/KYB to activate it."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        profile = getattr(user, "profile", None)
        return bool(profile and profile.is_role_active)


class HasActivatedLP(BasePermission):
    """
    Gate requiring an APPROVED Liquidity Provider profile before privileged LP
    capabilities (the next wave's LP-market actions). Mirrors KYCApprovedPermission:
    LP activation is automatic via the signed Sumsub KYB webhook (business level) —
    no admin in the normal path (Phase 6 Wave 1; SPEC §3.8 / §5.2).

    The authoritative check is the LiquidityProvider record (status == 'approved'),
    since LP is a related entity, not an auth role (SPEC §3.13). Pair with
    IsAuthenticated so an anonymous request is rejected by auth, not a missing `.lp`.
    """

    message = "Approved LP (KYB) status is required for this action."

    def has_permission(self, request, view):
        lp = getattr(request.user, "liquidity_provider", None)
        return bool(lp and lp.status == "approved")


class HasActivatedOwner(BasePermission):
    """
    Gate requiring an APPROVED property-owner profile before privileged owner
    capabilities (the next wave's property submission). Mirrors HasActivatedLP:
    owner activation is automatic via the signed Sumsub KYB webhook (owner business
    level) — no admin in the normal path (Phase 7 Wave A; OWNER_SURFACE.md).

    The authoritative check is the OwnerProfile record (status == 'approved'), since
    owner verification is a related entity, not just an auth role. Pair with
    IsAuthenticated so an anonymous request is rejected by auth, not a missing
    `.owner_profile`.
    """

    message = "Approved property-owner (KYB) status is required for this action."

    def has_permission(self, request, view):
        owner = getattr(request.user, "owner_profile", None)
        return bool(owner and owner.status == "approved")


class KYCApprovedPermission(BasePermission):
    """
    Gate requiring an APPROVED KYC record before sensitive actions (wallet creation,
    investing). SPEC §4.1 / §5.2; DECISIONS.md "Phase 4" #1.

    Phase 4 (apps/kyc) implements the real check: the user must have a `UserKYC`
    with status == 'approved' (related_name="kyc"). Pair with IsAuthenticated so an
    anonymous request is rejected by auth, not by a missing `.kyc`.

    Approval is automatic via the signed Sumsub webhook (or dev_grant_kyc /
    KYC_AUTO_APPROVE in DEBUG) — no admin in the normal path.
    """

    message = "KYC approval is required for this action."

    def has_permission(self, request, view):
        kyc = getattr(request.user, "kyc", None)
        return bool(kyc and kyc.status == "approved")
