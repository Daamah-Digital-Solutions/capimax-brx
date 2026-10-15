"""
Tell the admins that something is waiting for their review.

Every active staff account gets an in-app notification and an email with a direct link to the
item in the Django admin (e.g. a broker licence, a Nova certificate, a bank-transfer proof).
Sent after the submission commits, so a rolled-back request alerts no one; a failure here is
logged and never affects the user's request.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction

log = logging.getLogger(__name__)

# kind → what the admin sees as the item type.
KINDS = {
    "lp_kyb": "Liquidity provider verification",
    "owner_kyb": "Property owner verification",
    "developer_kyb": "Developer verification",
    "partner_kyb": "Partner verification",
    "broker_license": "Broker licence",
    "property_submission": "Property submission",
    "sukuk_certificate": "Nova certificate payment",
    "bank_deposit": "Bank transfer deposit",
    "withdrawal": "Withdrawal request",
    "lp_withdrawal": "Liquidity provider withdrawal",
    "support_ticket": "Support ticket",
    "partner_deliverable": "Partner deliverable",
}


def admin_change_url(obj) -> str:
    origin = (getattr(settings, "PUBLIC_API_ORIGIN", "") or "").rstrip("/")
    path = f"/admin/{obj._meta.app_label}/{obj._meta.model_name}/{obj.pk}/change/"
    return f"{origin}{path}"


def notify_admins(kind: str, *, obj, summary: str) -> None:
    """Queue the "review needed" alert for `obj` to every active admin (after commit)."""
    label = KINDS.get(kind, kind)
    url = admin_change_url(obj)

    def _send():
        from apps.core.models import User
        from apps.notifications.models import Notification
        from apps.notifications.services import notify

        try:
            for admin in User.objects.filter(is_staff=True, is_active=True):
                notify(
                    admin, Notification.Type.ADMIN_REVIEW_NEEDED,
                    params={"kind": label, "summary": summary, "admin_url": url},
                    action_url=url,
                )
        except Exception:  # noqa: BLE001 — never break the user's request
            log.exception("Admin review alert failed (%s %s)", kind, obj.pk)

    transaction.on_commit(_send)
