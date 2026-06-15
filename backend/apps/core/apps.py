from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    label = "core"  # keeps AUTH_USER_MODEL = "core.User" (SPEC §3.13)
    verbose_name = "Core (Users & Profiles)"

    def ready(self):
        # Register the post_save signal that auto-creates a Profile. SPEC §3.0 / §4.3.
        from . import signals  # noqa: F401
