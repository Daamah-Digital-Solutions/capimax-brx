"""
Auth foundation routes, mounted at /api/auth/ . SPEC §5.2.

OAuth note: Google/Apple social login is scaffolded via django-allauth (see
config/urls.py `accounts/` include and SOCIALACCOUNT_PROVIDERS in settings).
Provider keys are env-driven and inert until supplied; the dedicated
/api/auth/oauth/<provider>/ DRF endpoints are completed in a later phase when
keys exist. SPEC §6.
"""
from django.urls import path

from . import account, views

app_name = "core"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("token/refresh/", views.ThrottledTokenRefreshView.as_view(), name="token_refresh"),
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
    path("email/resend/", views.EmailVerifyResendView.as_view(), name="email_resend"),
    path("oauth/google/", views.GoogleOAuthView.as_view(), name="oauth_google"),
    # Settings — account (apps/core/account.py)
    path("me/profile/", account.ProfileUpdateView.as_view(), name="me_profile"),
    path("me/avatar/", account.AvatarView.as_view(), name="me_avatar"),
    path("password/change/", account.PasswordChangeView.as_view(), name="password_change"),
    path("2fa/", account.TwoFactorStatusView.as_view(), name="2fa_status"),
    path("2fa/setup/", account.TwoFactorSetupView.as_view(), name="2fa_setup"),
    path("2fa/enable/", account.TwoFactorEnableView.as_view(), name="2fa_enable"),
    path("2fa/disable/", account.TwoFactorDisableView.as_view(), name="2fa_disable"),
    path("sessions/", account.SessionsView.as_view(), name="sessions"),
    path("sessions/end-others/", account.EndOtherSessionsView.as_view(), name="sessions_end_others"),
    path("sessions/<uuid:pk>/", account.SessionDetailView.as_view(), name="session_detail"),
    path("account/deactivate/", account.DeactivateAccountView.as_view(), name="account_deactivate"),
    path("account/delete/", account.DeleteAccountView.as_view(), name="account_delete"),
]
