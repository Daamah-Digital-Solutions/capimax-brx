"""Role access routes — mounted at /api/roles/."""
from django.urls import path

from . import views

app_name = "roles"

urlpatterns = [
    path("", views.RolesView.as_view(), name="overview"),
    path("owner/", views.BecomeOwnerView.as_view(), name="become-owner"),
    path("switch/", views.SwitchRoleView.as_view(), name="switch"),
    path("applications/<str:slug>/", views.ApplicationView.as_view(), name="application"),
]
