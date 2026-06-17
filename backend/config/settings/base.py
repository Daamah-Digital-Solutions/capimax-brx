"""
Base settings shared by all environments.

Phase 1 (FOUNDATION) only — see BACKEND_SPEC.md.
Environment-specific overrides live in dev.py / prod.py.
All secrets come from environment variables (see .env.example). SPEC §1.
"""
from datetime import timedelta
from pathlib import Path

import environ

# backend/ root (two parents up from this file: settings/ -> config/ -> backend/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    # Vite dev server runs on :8080 (see frontend vite.config.ts). SPEC §1.
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:8080", "http://127.0.0.1:8080"]),
)

# Read a local .env if present (never committed). SPEC §1: secrets via env vars.
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-key-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# --------------------------------------------------------------------------- #
# Applications
# --------------------------------------------------------------------------- #
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",  # required by allauth (social auth scaffolding)
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # /logout/ blacklists refresh tokens
    "corsheaders",
    "django_filters",  # property read-API filtering (Phase 2). SPEC §3.3.
    # OAuth scaffolding (Google + Apple). Provider keys come from env; with no
    # keys the endpoints exist but the social flow is inert. SPEC §5.2 / §6.
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.apple",
]

# The foundation app (custom user + profile + auth). SPEC §3.0 / §3.13.
LOCAL_APPS = [
    "apps.core",
    # Blockchain chain-interaction layer (Phase 3 Wave 1). No models of its own;
    # houses the web3 service + deploy management commands. SPEC §3.2.
    "apps.chain",
]

# Empty domain stubs — structure for later phases ONLY. No models implemented yet.
# (properties, investments, wallets, certificates, payments, withdrawals, lp,
#  secondary_market, family, distributions, notifications, reports, broker,
#  owner, partners, onboarding, kyc) — SPEC §2 (project setup) / §3 / §7A.
DOMAIN_STUB_APPS = [
    "apps.properties",
    "apps.investments",
    "apps.wallets",
    "apps.certificates",
    "apps.payments",
    "apps.withdrawals",
    "apps.lp",
    "apps.secondary_market",
    "apps.family",
    "apps.distributions",
    "apps.notifications",
    "apps.reports",
    "apps.broker",
    "apps.owner",
    "apps.developer",
    "apps.partners",
    "apps.onboarding",
    "apps.kyc",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS + DOMAIN_STUB_APPS

# --------------------------------------------------------------------------- #
# Middleware
# --------------------------------------------------------------------------- #
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # must precede CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",  # required by allauth
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --------------------------------------------------------------------------- #
# Database — Postgres (Docker locally, Hostinger VPS later). SPEC §1.
# --------------------------------------------------------------------------- #
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://capimax:capimax@localhost:5432/capimax",
    )
}

# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
# SPEC §3.13: custom user model — email login, UUID pk. Must be set before the
# first migration.
AUTH_USER_MODEL = "core.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",  # social auth
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

SITE_ID = 1

# allauth: email-centric, no username (mirrors Supabase email-as-login). SPEC §5.
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "optional"

# OAuth providers — keys injected via env (empty = inert stub). SPEC §6.
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": env("GOOGLE_OAUTH_CLIENT_ID", default=""),
            "secret": env("GOOGLE_OAUTH_CLIENT_SECRET", default=""),
            "key": "",
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    },
    "apple": {
        "APP": {
            "client_id": env("APPLE_OAUTH_CLIENT_ID", default=""),
            "secret": env("APPLE_OAUTH_CLIENT_SECRET", default=""),
            "key": env("APPLE_OAUTH_KEY_ID", default=""),
            "settings": {
                "certificate_key": env("APPLE_OAUTH_PRIVATE_KEY", default=""),
            },
        },
    },
}

# --------------------------------------------------------------------------- #
# DRF + SimpleJWT. SPEC §5.2: JWT access + refresh, IsAuthenticated by default.
# --------------------------------------------------------------------------- #
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # SECURITY-FIRST: deny by default; public endpoints opt in with AllowAny.
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    # Phase 2: emit Decimals as JSON numbers (not strings). The property frontend
    # uses them numerically (e.g. totalValue.toLocaleString(), `${fee}%`). SPEC §3.3.
    "COERCE_DECIMAL_TO_STRING": False,
}

SIMPLE_JWT = {
    # Short-lived access + long-lived refresh (mirrors Supabase autoRefresh). SPEC §5.2.
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=14)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

# --------------------------------------------------------------------------- #
# CORS — React/Vite frontend origin. SPEC §1.
# --------------------------------------------------------------------------- #
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# --------------------------------------------------------------------------- #
# Blockchain / custodial wallets (Phase 3 Wave 1). TESTNET ONLY.
# All values are env-driven so a later, separate, AUDITED mainnet cutover is a
# config change — nothing here hardcodes mainnet. See DECISIONS.md "Blockchain".
# --------------------------------------------------------------------------- #
# Authenticated-encryption key for custodial private keys. Lives in the env only,
# SEPARATE from the DB. Generate with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
WALLET_ENCRYPTION_KEY = env("WALLET_ENCRYPTION_KEY", default="")
# Which KeyManager backend protects key material (fernet-db today; aws-kms/vault later).
KEY_MANAGER_BACKEND = env("KEY_MANAGER_BACKEND", default="fernet-db")
# Network label stored on generated wallets.
WALLET_NETWORK = env("WALLET_NETWORK", default="bsc-testnet")

# BSC Testnet chain connection (chain id 97). Free public RPC by default.
BSC_TESTNET_RPC_URL = env(
    "BSC_TESTNET_RPC_URL", default="https://bsc-testnet-rpc.publicnode.com"
)
CHAIN_ID = env.int("CHAIN_ID", default=97)
# Platform deployer/signer key — env only, NEVER hardcoded or stored in the DB.
DEPLOYER_PRIVATE_KEY = env("DEPLOYER_PRIVATE_KEY", default="")
# Address of the deployed PropertyTokenFactory (set after the JS deploy script runs).
PROPERTY_TOKEN_FACTORY_ADDRESS = env("PROPERTY_TOKEN_FACTORY_ADDRESS", default="")
# Compiled-contract artifacts produced by Hardhat (ABI + bytecode).
BLOCKCHAIN_ARTIFACTS_DIR = BASE_DIR / "blockchain" / "artifacts" / "contracts"

# --------------------------------------------------------------------------- #
# Email — stub backend in dev; real provider (SES/SendGrid) wired in a later
# phase for verification, password reset, withdrawal OTP, notifications. SPEC §6.
# --------------------------------------------------------------------------- #
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@capimax.local")
# Public base URL of the React app — used for email links AND the certificate QR /
# verification URL ({FRONTEND_URL}/verify/{code}). The Vite dev server is on :8080.
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:8080")

# Certificates (Phase 3 Wave 3). The signatory printed on the PDF; configurable per
# deployment. SPEC §7C.5.
CERTIFICATE_AUTHORIZED_SIGNATORY = env(
    "CERTIFICATE_AUTHORIZED_SIGNATORY", default="Capimax BRX - Authorized Signatory"
)

# --------------------------------------------------------------------------- #
# Investor KYC — Sumsub (Phase 4). DEFERRED, env-driven, INERT when blank.
# Mirrors the OAuth-keys pattern: the integration layer + webhook are built now,
# but with no keys the provider calls are inert and the gate is driven by the
# webhook (production) / dev_grant_kyc + KYC_AUTO_APPROVE (DEBUG testing).
# Approval is AUTOMATIC via the signed webhook — NO admin in the normal path
# (DECISIONS.md "Phase 4" #5; KYC_WALLET_SURFACE.md §4). Nothing here ever logs a key.
# --------------------------------------------------------------------------- #
SUMSUB_APP_TOKEN = env("SUMSUB_APP_TOKEN", default="")
SUMSUB_SECRET_KEY = env("SUMSUB_SECRET_KEY", default="")
SUMSUB_WEBHOOK_SECRET = env("SUMSUB_WEBHOOK_SECRET", default="")
SUMSUB_LEVEL_NAME = env("SUMSUB_LEVEL_NAME", default="basic-kyc-level")
# Business-verification (KYB) level for Liquidity Providers (Phase 6 Wave 1). The
# shared webhook distinguishes KYB applicants from investor KYC by this level name.
SUMSUB_KYB_LEVEL_NAME = env("SUMSUB_KYB_LEVEL_NAME", default="basic-kyb-level")
# Owner business-verification (KYB) level for Property Owners (Phase 7 Wave A). A
# SEPARATE level from the LP's so the shared webhook routes owner applicants to the
# owner domain (apps/owner) vs LP (apps/lp) vs investor KYC by this level name.
SUMSUB_OWNER_KYB_LEVEL_NAME = env("SUMSUB_OWNER_KYB_LEVEL_NAME", default="owner-kyb-level")
# Developer business-verification (KYB) level for Property Developers (Phase 8 Wave A).
# A SEPARATE level from the owner's and LP's so the shared webhook routes developer
# applicants to the developer domain (apps/developer) by this distinct level name.
SUMSUB_DEVELOPER_KYB_LEVEL_NAME = env("SUMSUB_DEVELOPER_KYB_LEVEL_NAME", default="developer-kyb-level")
# Partner business-verification (KYB) level for Strategic Partners (Phase 11 Wave A). A
# SEPARATE level from owner/developer/LP so the shared webhook routes partner applicants
# to the partner domain (apps/partners) by this distinct level name.
SUMSUB_PARTNER_KYB_LEVEL_NAME = env("SUMSUB_PARTNER_KYB_LEVEL_NAME", default="partner-kyb-level")
SUMSUB_BASE_URL = env("SUMSUB_BASE_URL", default="https://api.sumsub.com")
# DEV-ONLY: when True AND DEBUG, POST /api/kyc/submit/ auto-approves immediately so
# the gate can be exercised before Sumsub keys exist. Default OFF; production is
# strictly webhook-driven and ignores this flag (it is read only under DEBUG).
KYC_AUTO_APPROVE = env.bool("KYC_AUTO_APPROVE", default=False)

# --------------------------------------------------------------------------- #
# LP secondary market (Phase 6 Wave 2). The platform fee is BACKEND-CONFIGURABLE
# (not hardcoded in the frontend): platform_fee_amount + net_amount are computed
# server-side from this percent. Frontend default was 1% (useLPMarket.ts) — kept,
# but now changeable here without a frontend deploy. SPEC §3.8; SECONDARY_MARKET_SURFACE.md.
# --------------------------------------------------------------------------- #
LP_MARKET_FEE_PERCENT = env.float("LP_MARKET_FEE_PERCENT", default=1.0)

# Investor PEER secondary market (Phase 6 Wave 3). Separate, backend-configurable
# fee — the frontend used 0.5% for the peer market (vs 1% for the LP exit). Computed
# server-side. SECONDARY_MARKET_SURFACE.md §3.3.
SECONDARY_MARKET_FEE_PERCENT = env.float("SECONDARY_MARKET_FEE_PERCENT", default=0.5)

# --------------------------------------------------------------------------- #
# Real payments — Stripe (Phase 5 Wave 1). DEFERRED, env-driven, INERT when blank
# (same pattern as Sumsub/OAuth). Build + test against Stripe TEST MODE (test keys
# + test cards); production keys land later. SPEC §6; DECISIONS.md "Payments".
#
# SAFETY (real money, non-negotiable):
#   * RAW CARD DATA NEVER touches this server — the frontend uses Stripe Elements so
#     the PAN/CVV go browser→Stripe directly; we only ever see a PaymentIntent id.
#   * MINTING is gated on the SIGNATURE-VERIFIED webhook, never a frontend "success".
# The publishable key is safe to expose to the browser; the secret + webhook secret
# are server-only and never logged.
# --------------------------------------------------------------------------- #
STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", default="")
STRIPE_PUBLISHABLE_KEY = env("STRIPE_PUBLISHABLE_KEY", default="")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET", default="")
# Settlement currency for card charges (the property economics are USD-denominated).
STRIPE_CURRENCY = env("STRIPE_CURRENCY", default="usd")

# --------------------------------------------------------------------------- #
# Real payments — NOW Payments (crypto, Phase 5 Wave 2). DEFERRED, env-driven,
# INERT when blank (same pattern as Stripe). Funds settle to the CLIENT's NOW
# Payments account directly (we don't custody). Minting is gated on the
# SIGNATURE-VERIFIED IPN callback, never a frontend success. SPEC §6; DECISIONS.md.
# `NOWPAYMENTS_IPN_SECRET` is server-only and never logged.
# --------------------------------------------------------------------------- #
NOWPAYMENTS_API_KEY = env("NOWPAYMENTS_API_KEY", default="")
NOWPAYMENTS_IPN_SECRET = env("NOWPAYMENTS_IPN_SECRET", default="")
NOWPAYMENTS_BASE_URL = env("NOWPAYMENTS_BASE_URL", default="https://api.nowpayments.io/v1")
# Fiat currency our prices are denominated in (NOW converts to the crypto chosen).
NOWPAYMENTS_PRICE_CURRENCY = env("NOWPAYMENTS_PRICE_CURRENCY", default="usd")

# --------------------------------------------------------------------------- #
# I18N / static / misc
# --------------------------------------------------------------------------- #
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
