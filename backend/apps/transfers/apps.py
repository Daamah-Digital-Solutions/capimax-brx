from django.apps import AppConfig


class TransfersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.transfers"
    label = "transfers"
    verbose_name = "Gifts, family transfers and inheritance"
