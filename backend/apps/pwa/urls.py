"""PWA settings route — mounted at /api/pwa-settings/ (see config/urls.py)."""
from django.urls import path

from .views import PWASettingsView

app_name = "pwa"

urlpatterns = [
    path("", PWASettingsView.as_view(), name="pwa-settings"),
]
