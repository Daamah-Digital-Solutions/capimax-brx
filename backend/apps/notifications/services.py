"""
Notification emit helper — Phase 10.

`notify()` is called at each existing user-facing event point, INSIDE that service's
own `transaction.atomic()` block, so the notification commits together with the event
(the same way `credit_user_balance` is called inline). It is wrapped in a SAVEPOINT and
swallows any error: a notification is purely informational — a notify failure must NEVER
roll back or break the host event (mint, distribution, settlement, …).
"""
from __future__ import annotations

import logging

from django.db import transaction

from .models import Notification, NotificationPreference

log = logging.getLogger(__name__)

# Re-export so host services need a single import: `from apps.notifications.services
# import notify, NotificationType`.
NotificationType = Notification.Type

# Map each notification TYPE → the frontend preference key (a NotificationPreference
# field) that gates it. Only the categories the UI exposes as toggles are listed; every
# OTHER type (money-in earnings/commission/secondary-sale/withdrawal, mint, partner
# workflow, …) is intentionally ABSENT → always delivered, never silently dropped.
#
# `security` covers identity/account events (KYC/KYB/broker-licence/wallet-created). It
# is HONORED like any other toggle (not force-on) to match the UI, where it is a normal
# user-controllable switch defaulting ON.
TYPE_PREF_KEY: dict[str, str] = {
    "distribution_credited": "distributions",
    "installment_paid": "installments",
    "installment_defaulted": "installments",
    "kyc_approved": "security",
    "kyc_rejected": "security",
    "kyb_approved": "security",
    "kyb_rejected": "security",
    "broker_license_approved": "security",
    "broker_license_rejected": "security",
    "wallet_created": "security",
}


def _delivery_enabled(user, notif_type) -> bool:
    """
    Whether `user` wants in-app notifications of this type. Unmapped types always
    deliver. FAIL-OPEN: any error resolving the preference defaults to delivering, so a
    pref-system hiccup can never silently swallow a notification.
    """
    key = TYPE_PREF_KEY.get(str(notif_type))
    if key is None:
        return True  # not a user-controllable category → always deliver
    try:
        return bool(getattr(NotificationPreference.get_for(user), key, True))
    except Exception:  # noqa: BLE001 — never drop a notification on a pref lookup error
        log.exception("notification pref lookup failed (type=%s user=%s)", notif_type, getattr(user, "pk", None))
        return True


def notify(user, notif_type, *, params: dict | None = None, action_url: str = "") -> Notification | None:
    """
    Create one in-app Notification for `user`. Returns the row, or None on no-user /
    user-disabled-category / failure. SAFE inside another atomic block: the inner
    `atomic()` is a savepoint, so a failure here rolls back ONLY the notification and is
    logged — the caller's transaction continues unaffected.
    """
    if user is None:
        return None
    # Respect the user's per-type preference (in-app gate). Unmapped types always pass.
    if not _delivery_enabled(user, notif_type):
        return None
    try:
        with transaction.atomic():
            return Notification.objects.create(
                user=user,
                type=notif_type,
                params=params or {},
                action_url=action_url or "",
            )
    except Exception:  # noqa: BLE001 — informational only; never break the host event
        log.exception(
            "notify failed (type=%s user=%s)", notif_type, getattr(user, "pk", None)
        )
        return None
