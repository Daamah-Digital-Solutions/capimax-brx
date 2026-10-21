"""
Signed-in devices ("Active devices" in Settings).

Every login (password, Google, sign-up) creates a LoginSession and puts its id in the token
pair as the `sid` claim (SimpleJWT copies it into each access token and keeps it across
refresh-token rotation). Ending a session marks it revoked: SessionJWTAuthentication rejects
its access tokens at once and the refresh view refuses to renew it.
"""
from __future__ import annotations

import re

from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import LoginSession


def _client_ip(request) -> str | None:
    if request is None:
        return None
    fwd = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    return fwd or request.META.get("REMOTE_ADDR") or None


def issue_tokens(user, request=None) -> dict:
    """A new signed-in session for `user`: {access_token, refresh_token, session_id}."""
    session = LoginSession.objects.create(
        user=user,
        user_agent=(request.META.get("HTTP_USER_AGENT", "") if request else "")[:400],
        ip_address=_client_ip(request),
    )
    refresh = RefreshToken.for_user(user)
    refresh["sid"] = str(session.id)
    session.refresh_jti = refresh["jti"]
    session.save(update_fields=["refresh_jti"])
    return {"access_token": str(refresh.access_token), "refresh_token": str(refresh),
            "session_id": str(session.id)}


def _session_ok(sid) -> bool:
    if not sid:
        return True  # tokens issued before sessions existed — they expire on their own
    return LoginSession.objects.filter(pk=sid, revoked_at__isnull=True).exists()


class SessionJWTAuthentication(JWTAuthentication):
    """JWT auth that also refuses tokens of an ended session."""

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        if not _session_ok(token.get("sid")):
            raise InvalidToken({"detail": "This session was ended.", "code": "session_ended"})
        return token


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh that refuses an ended session and keeps the session's latest refresh jti."""

    def validate(self, attrs):
        old = RefreshToken(attrs["refresh"], verify=False)
        sid = old.get("sid")
        if not _session_ok(sid):
            raise AuthenticationFailed("This session was ended.", code="session_ended")
        data = super().validate(attrs)
        if sid and data.get("refresh"):
            new_jti = RefreshToken(data["refresh"], verify=False)["jti"]
            LoginSession.objects.filter(pk=sid).update(refresh_jti=new_jti, last_seen_at=timezone.now())
        return data


def end_session(session: LoginSession) -> None:
    """Revoke a session and blacklist its current refresh token."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    if session.revoked_at is None:
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
    if session.refresh_jti:
        for ot in OutstandingToken.objects.filter(jti=session.refresh_jti):
            BlacklistedToken.objects.get_or_create(token=ot)


def end_all_sessions(user, *, keep_sid: str | None = None) -> int:
    """End every session of `user` except `keep_sid`; also blacklists older refresh tokens."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    keep = LoginSession.objects.filter(pk=keep_sid).first() if keep_sid else None
    n = 0
    for s in LoginSession.objects.filter(user=user, revoked_at__isnull=True).exclude(pk=keep_sid):
        end_session(s)
        n += 1
    keep_jti = keep.refresh_jti if keep else None
    for ot in OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now()).exclude(jti=keep_jti):
        BlacklistedToken.objects.get_or_create(token=ot)
    return n


def describe_device(user_agent: str) -> dict:
    """Browser / OS / device type from a user-agent string (no location)."""
    ua = user_agent or ""
    if re.search(r"iPhone|Android.+Mobile|Mobile Safari", ua):
        kind = "mobile"
    elif re.search(r"iPad|Tablet|Android", ua):
        kind = "tablet"
    else:
        kind = "desktop"
    os_name = next((name for pat, name in (
        (r"iPhone|iPad|iOS", "iOS"), (r"Android", "Android"), (r"Windows", "Windows"),
        (r"Mac OS X|Macintosh", "macOS"), (r"Linux", "Linux"),
    ) if re.search(pat, ua)), "")
    browser = next((name for pat, name in (
        (r"Edg/", "Edge"), (r"OPR/|Opera", "Opera"), (r"SamsungBrowser", "Samsung Internet"),
        (r"Chrome/|CriOS", "Chrome"), (r"Firefox/|FxiOS", "Firefox"), (r"Safari/", "Safari"),
    ) if re.search(pat, ua)), "")
    return {"type": kind, "os": os_name, "browser": browser}
