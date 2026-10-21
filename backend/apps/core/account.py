"""
Self-service account settings (Settings page).

  PATCH  /api/auth/me/profile/            name, phone, country, city
  POST   /api/auth/me/avatar/             upload a profile photo (DELETE removes it)
  POST   /api/auth/password/change/       current + new password; signs out the other devices
  GET    /api/auth/2fa/                   two-factor status
  POST   /api/auth/2fa/setup/             a new authenticator secret (not active yet)
  POST   /api/auth/2fa/enable/            {code} — turn two-factor on
  POST   /api/auth/2fa/disable/           {code} — turn it off
  GET    /api/auth/sessions/              signed-in devices (no location)
  DELETE /api/auth/sessions/<id>/         end one device's session
  POST   /api/auth/sessions/end-others/   sign out every other device
  POST   /api/auth/account/deactivate/    {password} — disable the account (support re-enables)
  POST   /api/auth/account/delete/        {password, confirm:"DELETE"} — close it (only when
                                          nothing is held: no balance, units, plans or payouts)
"""
from __future__ import annotations

import os
import uuid

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import totp
from .models import LoginSession, Profile
from .sessions import describe_device, end_all_sessions, end_session


def _err(code: str, detail: str, http=status.HTTP_400_BAD_REQUEST):
    return Response({"code": code, "detail": detail}, status=http)


def _current_sid(request) -> str | None:
    auth = getattr(request, "auth", None)
    try:
        return str(auth.get("sid")) if auth is not None and auth.get("sid") else None
    except Exception:
        return None


def _notify(user, type_name: str, params=None):
    from apps.notifications.services import NotificationType, notify

    notify(user, getattr(NotificationType, type_name), params=params or {}, action_url="/settings?tab=security")


# --------------------------------------------------------------------------- #
# Profile
# --------------------------------------------------------------------------- #
class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        from .serializers import UserSerializer

        profile = request.user.profile
        data = request.data
        first = (data.get("first_name") or "").strip()
        last = (data.get("last_name") or "").strip()
        if "first_name" in data or "last_name" in data:
            full = " ".join(p for p in (first, last) if p)
            if not full:
                return _err("name_required", "Enter your name.")
            profile.full_name = full[:255]
        for field, limit in (("phone", 32), ("country", 120), ("city", 120)):
            if field in data:
                setattr(profile, field, (data.get(field) or "").strip()[:limit])
        profile.save()
        request.user.refresh_from_db()
        return Response(UserSerializer(request.user).data)


class AvatarView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("avatar")
        if upload is None:
            return _err("avatar_required", "Choose a photo.")
        if upload.size and upload.size > 5 * 1024 * 1024:
            return _err("avatar_too_large", "The photo must be 5 MB or less.")
        ext = os.path.splitext(upload.name or "")[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            return _err("avatar_type", "Upload a JPG, PNG or WebP image.")
        profile = request.user.profile
        if profile.avatar:
            profile.avatar.delete(save=False)
        upload.name = f"{uuid.uuid4().hex}{ext}"
        profile.avatar = upload
        profile.save()
        profile.avatar_url = request.build_absolute_uri(profile.avatar.url)
        profile.save(update_fields=["avatar_url"])
        return Response({"avatar_url": profile.avatar_url})

    def delete(self, request):
        profile = request.user.profile
        if profile.avatar:
            profile.avatar.delete(save=False)
        profile.avatar = None
        profile.avatar_url = None
        profile.save(update_fields=["avatar", "avatar_url"])
        return Response({"avatar_url": None})


# --------------------------------------------------------------------------- #
# Password
# --------------------------------------------------------------------------- #
class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current = request.data.get("current_password") or ""
        new = request.data.get("new_password") or ""
        if user.has_usable_password() and not user.check_password(current):
            return _err("wrong_password", "The current password is incorrect.")
        try:
            validate_password(new, user)
        except DjangoValidationError as exc:
            return _err("weak_password", " ".join(exc.messages))
        user.set_password(new)
        user.save(update_fields=["password"])
        end_all_sessions(user, keep_sid=_current_sid(request))
        _notify(user, "PASSWORD_CHANGED")
        return Response({"detail": "Password changed. Other devices were signed out."})


# --------------------------------------------------------------------------- #
# Two-factor (authenticator app)
# --------------------------------------------------------------------------- #
def _secret(profile: Profile) -> str:
    if not profile.totp_secret:
        return ""
    from apps.wallets.keys import get_key_manager

    return get_key_manager().decrypt(profile.totp_secret)


def check_second_factor(user, code: str | None) -> str | None:
    """None when the user may sign in; otherwise the error code (otp_required / otp_invalid)."""
    profile = getattr(user, "profile", None)
    if not profile or not profile.totp_enabled:
        return None
    if not (code or "").strip():
        return "otp_required"
    return None if totp.verify(_secret(profile), code) else "otp_invalid"


class TwoFactorStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"enabled": request.user.profile.totp_enabled})


class TwoFactorSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.wallets.keys import get_key_manager

        profile = request.user.profile
        if profile.totp_enabled:
            return _err("already_enabled", "Two-factor authentication is already on.")
        secret = totp.new_secret()
        profile.totp_secret = get_key_manager().encrypt(secret)
        profile.save(update_fields=["totp_secret"])
        return Response({"secret": secret, "otpauth_uri": totp.provisioning_uri(secret, request.user.email)})


class TwoFactorEnableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if not profile.totp_secret:
            return _err("setup_first", "Start the setup first.")
        if not totp.verify(_secret(profile), request.data.get("code") or ""):
            return _err("otp_invalid", "The code is incorrect or expired.")
        profile.totp_enabled = True
        profile.save(update_fields=["totp_enabled"])
        _notify(request.user, "TWO_FACTOR_CHANGED", {"state": "on"})
        return Response({"enabled": True})


class TwoFactorDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if not profile.totp_enabled:
            return Response({"enabled": False})
        if not totp.verify(_secret(profile), request.data.get("code") or ""):
            return _err("otp_invalid", "The code is incorrect or expired.")
        profile.totp_enabled = False
        profile.totp_secret = ""
        profile.save(update_fields=["totp_enabled", "totp_secret"])
        _notify(request.user, "TWO_FACTOR_CHANGED", {"state": "off"})
        return Response({"enabled": False})


# --------------------------------------------------------------------------- #
# Signed-in devices
# --------------------------------------------------------------------------- #
class SessionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current = _current_sid(request)
        rows = []
        for s in LoginSession.objects.filter(user=request.user, revoked_at__isnull=True)[:30]:
            rows.append({
                "id": str(s.id),
                "device": describe_device(s.user_agent),
                "created_at": s.created_at,
                "last_seen_at": s.last_seen_at,
                "current": str(s.id) == current,
            })
        rows.sort(key=lambda r: (not r["current"], -r["last_seen_at"].timestamp()))
        return Response(rows)


class SessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        s = LoginSession.objects.filter(pk=pk, user=request.user).first()
        if s is None:
            return _err("not_found", "Session not found.", status.HTTP_404_NOT_FOUND)
        end_session(s)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EndOtherSessionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        n = end_all_sessions(request.user, keep_sid=_current_sid(request))
        return Response({"ended": n})


# --------------------------------------------------------------------------- #
# Deactivate / delete
# --------------------------------------------------------------------------- #
def _delete_blockers(user) -> list[str]:
    from decimal import Decimal

    from apps.installments.models import InstallmentPlan
    from apps.wallets.models import OwnershipToken, UserBalance, Withdrawal

    out = []
    bal = UserBalance.objects.filter(user=user).first()
    if bal and Decimal(bal.current_balance or 0) > 0:
        out.append("wallet_balance")
    if OwnershipToken.objects.filter(wallet__user=user, token_amount__gt=0).exists():
        out.append("property_units")
    if InstallmentPlan.objects.filter(investor=user, status="active").exists():
        out.append("installment_plan")
    if Withdrawal.objects.filter(user=user, status__in=["pending", "processing"]).exists():
        out.append("pending_withdrawal")
    return out


class DeactivateAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.has_usable_password() and not user.check_password(request.data.get("password") or ""):
            return _err("wrong_password", "The password is incorrect.")
        _notify(user, "ACCOUNT_DEACTIVATED")
        with transaction.atomic():
            user.is_active = False
            user.save(update_fields=["is_active"])
            Profile.objects.filter(user=user).update(deactivated_at=timezone.now())
            end_all_sessions(user)
        return Response({"detail": "Your account is deactivated. Contact support to reactivate it."})


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if (request.data.get("confirm") or "").strip().upper() != "DELETE":
            return _err("confirm_required", 'Type DELETE to confirm.')
        if user.has_usable_password() and not user.check_password(request.data.get("password") or ""):
            return _err("wrong_password", "The password is incorrect.")
        blockers = _delete_blockers(user)
        if blockers:
            return Response({"code": "account_not_empty", "blockers": blockers,
                             "detail": "Withdraw your balance and close your holdings and plans first."},
                            status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            profile = user.profile
            if profile.avatar:
                profile.avatar.delete(save=False)
            # Records (investments, ledger) are kept for the law; the personal data is removed.
            user.email = f"deleted-{uuid.uuid4().hex[:12]}@deleted.invalid"
            user.is_active = False
            user.set_unusable_password()
            user.save()
            Profile.objects.filter(user=user).update(
                full_name="", phone="", country="", city="", avatar=None, avatar_url=None,
                totp_secret="", totp_enabled=False, deleted_at=timezone.now(),
            )
            end_all_sessions(user)
        return Response({"detail": "Your account was deleted."})
