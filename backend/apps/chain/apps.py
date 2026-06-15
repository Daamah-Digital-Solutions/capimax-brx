from django.apps import AppConfig


class ChainConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.chain"
    label = "chain"
    verbose_name = "Blockchain (chain layer)"
