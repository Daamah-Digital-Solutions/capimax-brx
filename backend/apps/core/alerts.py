"""
Error alerts without a third-party service. Kept free of DRF imports: logging is configured
while Django starts, before the apps are loaded.

- `AlertEmailHandler` (wired in settings.LOGGING): every ERROR logged by Django's request
  handling, by our apps ("apps.*") or reported by browsers ("client") is emailed to
  settings.ADMINS — but each distinct error only once per ALERT_DEDUPE_SECONDS, so a failure
  that repeats on every request doesn't flood the inbox. Counters live in the "alerts" cache
  (a file cache in prod shared by gunicorn workers and the cron jobs).
- Browsers report their uncaught errors to `apps.core.monitoring.ClientErrorView`, which logs
  them to the "client" logger (and so through the handler below).
- `alert_on_failure`: decorator for management commands run by cron — an exception is logged
  (and so emailed) before it propagates.
"""
from __future__ import annotations

import functools
import hashlib
import logging
import traceback

from django.conf import settings
from django.core.cache import caches
from django.utils.log import AdminEmailHandler
from django.utils.html import escape
from django.views.debug import ExceptionReporter


def _signature(record: logging.LogRecord) -> str:
    """What makes two log records "the same error": where it was logged, the message
    template, and the exception type + the line that raised it."""
    parts = [record.name, str(record.msg)]
    if record.exc_info and record.exc_info[1] is not None:
        exc = record.exc_info[1]
        parts.append(type(exc).__name__)
        tb = traceback.extract_tb(record.exc_info[2])
        if tb:
            last = tb[-1]
            parts.append(f"{last.filename}:{last.lineno}")
    sig = getattr(record, "alert_signature", None)
    if sig:
        parts.append(str(sig))
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


class NoLocalsExceptionReporter(ExceptionReporter):
    """
    A compact error report for alert emails: the request line, the user id and the traceback
    — no stack-frame locals, no request body and no settings dump (they can hold anything: a
    signer, a token, card data in transit).
    """

    def get_traceback_text(self):
        lines = []
        if self.request is not None:
            lines.append(f"Request: {self.request.method} {self.request.path}")
            user = getattr(self.request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                lines.append(f"User id: {user.pk}")
        if self.exc_type is not None:
            lines.append("")
            lines.append("".join(traceback.format_exception(self.exc_type, self.exc_value, self.tb)))
        return "\n".join(lines)

    def get_traceback_html(self):
        return f"<pre>{escape(self.get_traceback_text())}</pre>"


class AlertEmailHandler(AdminEmailHandler):
    """AdminEmailHandler that sends each distinct error at most once per dedupe window."""

    def emit(self, record):
        if not settings.ADMINS:
            return
        window = int(getattr(settings, "ALERT_DEDUPE_SECONDS", 900))
        try:
            fresh = caches["alerts"].add(f"alert:{_signature(record)}", 1, timeout=window)
        except Exception:  # noqa: BLE001 — a cache problem must never hide the alert
            fresh = True
        if fresh:
            super().emit(record)


def alert_on_failure(handle):
    """Wrap a management command's handle(): log any exception (→ alert email), then re-raise."""

    @functools.wraps(handle)
    def wrapper(self, *args, **kwargs):
        try:
            return handle(self, *args, **kwargs)
        except Exception:
            logging.getLogger(f"apps.commands.{self.__module__.rsplit('.', 1)[-1]}").exception(
                "Scheduled command failed: %s", self.__module__.rsplit(".", 1)[-1]
            )
            raise

    return wrapper


