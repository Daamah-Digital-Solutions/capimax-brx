"""
Root URL configuration.

Phase 1 wires only the admin and the auth foundation. Domain routers
(properties, investments, wallets, …) are added in later phases. SPEC §2.
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth foundation: register / login / refresh / logout / session / me + OAuth.
    # SPEC §5.2.
    path("api/auth/", include("apps.core.urls")),
    # Property read API (Phase 2): list / detail / featured / funded / stats. SPEC §2.12.
    path("api/", include("apps.properties.urls")),
    # Custodial wallets (Phase 3 Wave 1): create (KYC-gated) + me + tokens. SPEC §3.2.
    path("api/wallets/", include("apps.wallets.urls")),
    # Investments (Phase 3 Wave 2): create + mint. SPEC §4.1.
    path("api/investments/", include("apps.investments.urls")),
    # Certificates (Phase 3 Wave 3): generate PDF + list + download + public verify. SPEC §4.1/§4.2.
    path("api/certificates/", include("apps.certificates.urls")),
    # Investor KYC (Phase 4): status + submit + WebSDK access-token + signed webhook. SPEC §3.4.
    path("api/kyc/", include("apps.kyc.urls")),
    # Real payments (Phase 5 Wave 1): Stripe create-intent + config + signed webhook. SPEC §6.
    path("api/payments/", include("apps.payments.urls")),
    # Liquidity Provider onboarding (Phase 6 Wave 1): profile/KYB/wallet/docs. SPEC §2.7/§3.8.
    path("api/lp/", include("apps.lp.urls")),
    # Investor peer secondary market (Phase 6 Wave 3): one-shot listings + on-chain settle. SPEC §2.8/§3.9.
    path("api/secondary-market/", include("apps.secondary_market.urls")),
    # Property Owner onboarding (Phase 7 Wave A): owner profile + entity KYB (Sumsub). OWNER_SURFACE.md.
    path("api/owner/", include("apps.owner.urls")),
    # Property Developer onboarding (Phase 8 Wave A): developer profile + entity KYB (Sumsub). DEVELOPER_SURFACE.md.
    path("api/developer/", include("apps.developer.urls")),
    # Investor distributions (Phase 9): admin-declared pro-rata cash yield → holders' balances. DISTRIBUTIONS_SURFACE.md.
    path("api/distributions/", include("apps.distributions.urls")),
    # In-app notifications (Phase 10): self-scoped list + unread-count + mark-read + soft-delete. NOTIFICATIONS_SURFACE.md.
    path("api/notifications/", include("apps.notifications.urls")),
    # allauth routes (OAuth callback handling) — scaffolding for social login.
    path("accounts/", include("allauth.urls")),
]
