"""
Brute-force protection for authentication.

- `AuthIPThrottle`: per client IP, scope from the view's `throttle_scope`.
- `AuthAccountThrottle`: per submitted email, scope from the view's `throttle_account_scope`
  (stops slow guessing on one account spread over many IPs, and reset-email bombing).
- `AdminLoginRateLimitMiddleware`: the Django admin login form (not a DRF view).

Rates live in settings.AUTH_THROTTLE_RATES and are read on every request, so they can be
tuned per environment. Counters use the "throttle" cache (shared by all gunicorn workers in
prod). Everything is a no-op unless settings.AUTH_THROTTLE_ENABLED (on in prod, off in dev
so local work and the general test suite aren't throttled).
"""
from __future__ import annotations

import hashlib

from django.conf import settings
from django.core.cache import caches
from django.http import HttpResponse
from rest_framework.throttling import SimpleRateThrottle


def _enabled() -> bool:
    return bool(getattr(settings, "AUTH_THROTTLE_ENABLED", False))


def client_ip(request) -> str:
    """
    The real client IP behind nginx: nginx APPENDS the peer address to X-Forwarded-For, so
    with N trusted proxies the client is the N-th entry from the end (a value the client
    sent itself can't take that slot). Mirrors DRF's get_ident for NUM_PROXIES.
    """
    num_proxies = settings.REST_FRAMEWORK.get("NUM_PROXIES") or 0
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if num_proxies and xff:
        addrs = [a.strip() for a in xff.split(",") if a.strip()]
        if addrs:
            return addrs[-min(num_proxies, len(addrs))]
    return request.META.get("REMOTE_ADDR", "")


class _AuthThrottle(SimpleRateThrottle):
    scope_attr = "throttle_scope"

    def __init__(self):  # rate is resolved per view in allow_request
        pass

    @property
    def cache(self):
        return caches["throttle"]

    def get_rate(self):
        return getattr(settings, "AUTH_THROTTLE_RATES", {}).get(self.scope)

    def allow_request(self, request, view):
        if not _enabled():
            return True
        self.scope = getattr(view, self.scope_attr, None)
        if not self.scope:
            return True
        self.rate = self.get_rate()
        if not self.rate:
            return True
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return super().allow_request(request, view)


class AuthIPThrottle(_AuthThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": client_ip(request)}


class AuthAccountThrottle(_AuthThrottle):
    scope_attr = "throttle_account_scope"

    def get_cache_key(self, request, view):
        try:
            email = str(request.data.get("email") or "").strip().lower()
        except Exception:  # noqa: BLE001 — unparsable body: nothing to key on
            return None
        if not email:
            return None
        ident = hashlib.sha256(email.encode()).hexdigest()  # never store raw emails as keys
        return self.cache_format % {"scope": self.scope, "ident": ident}


class AdminLoginRateLimitMiddleware:
    """Limit POSTs to the Django admin login form per client IP (AUTH_THROTTLE_RATES["admin_login"])."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and _enabled() and request.path.rstrip("/").endswith("/admin/login"):
            rate = getattr(settings, "AUTH_THROTTLE_RATES", {}).get("admin_login")
            if rate:
                limit, period = SimpleRateThrottle.parse_rate(None, rate)
                key = f"throttle_admin_login_{client_ip(request)}"
                cache = caches["throttle"]
                cache.add(key, 0, period)
                try:
                    attempts = cache.incr(key)
                except ValueError:  # expired between add and incr
                    cache.set(key, 1, period)
                    attempts = 1
                if attempts > limit:
                    return HttpResponse(
                        "Too many login attempts. Please wait and try again later.",
                        status=429, content_type="text/plain; charset=utf-8",
                    )
        return self.get_response(request)
