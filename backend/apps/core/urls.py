"""
Auth foundation routes, mounted at /api/auth/ . SPEC §5.2.

OAuth note: Google/Apple social login is scaffolded via django-allauth (see
config/urls.py `accounts/` include and SOCIALACCOUNT_PROVIDERS in settings).
Provider keys are env-driven and inert until supplied; the dedicated
/api/auth/oauth/<provider>/ DRF endpoints are completed in a later phase when
keys exist. SPEC §6.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "core"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("session/", views.SessionView.as_view(), name="session"),
    path("me/", views.MeView.as_view(), name="me"),
    path("password/reset/", views.PasswordResetRequestView.as_view(), name="password_reset"),
    path(
        "password/reset/confirm/",
        views.PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("email/verify/", views.EmailVerifyConfirmView.as_view(), name="email_verify"),
    path("oauth/google/", views.GoogleOAuthView.as_view(), name="oauth_google"),
]
