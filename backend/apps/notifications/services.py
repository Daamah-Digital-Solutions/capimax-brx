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

from .models import Notification

log = logging.getLogger(__name__)

# Re-export so host services need a single import: `from apps.notifications.services
# import notify, NotificationType`.
NotificationType = Notification.Type


def notify(user, notif_type, *, params: dict | None = None, action_url: str = "") -> Notification | None:
    """
    Create one in-app Notification for `user`. Returns the row, or None on no-user /
    failure. SAFE inside another atomic block: the inner `atomic()` is a savepoint, so
    a failure here rolls back ONLY the notification and is logged — the caller's
    transaction continues unaffected.
    """
    if user is None:
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
