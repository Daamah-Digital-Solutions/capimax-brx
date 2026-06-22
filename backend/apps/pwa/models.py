"""
PWA settings — a SINGLETON global-config row (app branding + install-prompt toggle),
repointed off Supabase. The smallest mini-domain: NO PII, NO secrets, NO money/chain.

Fields mirror what the frontend reads (src/hooks/usePWASettings.ts): app_name,
app_short_name, app_description, theme_color, background_color, install_prompt_enabled.

GET is readable app-wide (branding + the install-prompt gate in usePWAInstall.ts);
the WRITE is admin-only (it's GLOBAL app config). A single row is enforced via `load()`
(get-or-create pk=1) + a save() that pins pk=1, so duplicates can't exist.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _


class PWASettings(models.Model):
    """The one-and-only PWA config row (singleton, pk=1)."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    app_name = models.CharField(max_length=120, default="Capimax BRX")
    app_short_name = models.CharField(max_length=12, default="Capimax")
    app_description = models.CharField(
        max_length=255, default="Real Estate Tokenization Platform"
    )
    theme_color = models.CharField(max_length=9, default="#0f172a")
    background_color = models.CharField(max_length=9, default="#ffffff")
    install_prompt_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pwa_settings"
        verbose_name = _("PWA settings")
        verbose_name_plural = _("PWA settings")

    def save(self, *args, **kwargs):
        # Pin the singleton: every row IS row 1, so a second row can never be created
        # (pk is fixed; access is always via load()). No duplicates possible.
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        """Return the singleton, creating it (with defaults) on first access."""
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"PWA settings: {self.app_name}"
