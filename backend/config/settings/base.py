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
    "apps.installments",
    "apps.wallets",
    "apps.certificates",
    "apps.payments",
    "apps.withdrawals",
    "apps.lp",
    "apps.secondary_market",
    "apps.family",
    "apps.owner_documents",
    "apps.pwa",
    "apps.support",
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
    "apps.core.throttling.AdminLoginRateLimitMiddleware",  # admin login brute-force limit
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

# Google OAuth web client id — shared by the allauth provider below AND the DRF
# POST /api/auth/oauth/google/ endpoint, which verifies the audience of the GIS
# id_token against it. Public value; the secret is only needed for the (unused)
# authorization-code flow. SPEC §6.
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default="")

# OAuth providers — keys injected via env (empty = inert stub). SPEC §6.
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": GOOGLE_OAUTH_CLIENT_ID,
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
    # Trusted reverse proxies in front of Django (prod: nginx → 1). Lets throttles key on
    # the real client IP from X-Forwarded-For instead of nginx's 127.0.0.1.
    "NUM_PROXIES": env.int("DRF_NUM_PROXIES", default=0),
}

# --------------------------------------------------------------------------- #
# Brute-force protection for auth (apps/core/throttling.py). Per client IP and, where
# an email is submitted, per account. Off unless AUTH_THROTTLE_ENABLED (prod: on).
# --------------------------------------------------------------------------- #
# Off-plan model §4: late installments carry no penalty and are never forfeited. The old
# default-and-forfeit sweep stays in the code but is OFF unless deliberately re-enabled.
INSTALLMENT_FORFEIT_ENABLED = env.bool("INSTALLMENT_FORFEIT_ENABLED", default=False)

AUTH_THROTTLE_ENABLED = env.bool("AUTH_THROTTLE_ENABLED", default=True)
AUTH_THROTTLE_RATES = {
    "auth_login": "10/min",
    "auth_login_account": "20/hour",
    "auth_register": "10/hour",
    "auth_password_reset": "5/hour",
    "auth_password_reset_account": "5/hour",
    "auth_password_reset_confirm": "20/hour",
    "auth_token_refresh": "120/min",
    "auth_oauth": "30/min",
    "auth_email_verify": "30/hour",
    "admin_login": "10/min",
    "client_errors": "30/hour",  # browser error reports (apps/core/monitoring.py)
    "auth_email_resend": "5/hour",
}
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    # Error-alert dedupe counters (prod: a file cache shared by workers and cron jobs).
    "alerts": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "alerts"},
    # Throttle counters (prod overrides with a cache shared by all gunicorn workers).
    "throttle": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "auth-throttle",
        "TIMEOUT": 900,
    },
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
    # Official BNB Chain testnet dataseed — supports eth_call/estimateGas/sendRawTransaction
    # reliably. (The old publicnode default went dead: "no available nodes"; several free RPCs
    # rate-limit eth_call. The VPS .env overrides this if a keyed endpoint is preferred.)
    "BSC_TESTNET_RPC_URL", default="https://bsc-testnet-dataseed.bnbchain.org"
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
# SMTP transport (read from env; inert until EMAIL_HOST is set — Django's default is
# localhost:25, which silently fails). Provide these in the prod .env to send real mail.
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
# Swallow send errors in dev; env-controlled. Prod overrides the default to loud.
EMAIL_FAIL_SILENTLY = env.bool("EMAIL_FAIL_SILENTLY", default=True)
# Fail fast on a stalled SMTP connect instead of tying up a gunicorn worker.
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=15)
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
LP_MARKET_FEE_PERCENT = env.float("LP_MARKET_FEE_PERCENT", default=2.0)
# Off-plan decision 6 — the LP exit is PLATFORM-PRICED: the seller gets a quote at the
# current unit price minus this discount, the liquidity fee above is deducted from it, and
# the request stays open this long; a unit price change closes it (never funded at an old
# price).
LP_EXIT_DISCOUNT_PERCENT = env.float("LP_EXIT_DISCOUNT_PERCENT", default=3.0)
LP_EXIT_TTL_MINUTES = env.int("LP_EXIT_TTL_MINUTES", default=1440)

# Investor PEER secondary market (Phase 6 Wave 3). Separate, backend-configurable resale
# fee, computed server-side. Off-plan decision 5: the BUYER pays it on top of the price and
# the seller receives the full price (was 0.5% taken from the seller).
SECONDARY_MARKET_FEE_PERCENT = env.float("SECONDARY_MARKET_FEE_PERCENT", default=1.0)

# --------------------------------------------------------------------------- #
# Installments — default / forfeiture (Wave D). An installment becomes `missed`
# once its due_date passes unpaid; a plan `defaults` only once its EARLIEST unpaid
# installment is overdue by MORE than this grace period (not on the first late day).
# Default 30 days ≈ one full monthly cycle of leeway past the missed due date.
# Backend-configurable (no frontend deploy). The `check_installment_defaults`
# command reads this; running it daily is a PRODUCTION-DEPLOY concern (cron/Celery
# beat), NOT wired here. INSTALLMENTS_SURFACE.md / DECISIONS.md "Installments".
# --------------------------------------------------------------------------- #
INSTALLMENT_DEFAULT_GRACE_DAYS = env.int("INSTALLMENT_DEFAULT_GRACE_DAYS", default=30)

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
# Manual BANK-transfer deposit — the platform's PUBLIC receiving-account details shown to a
# user so they can wire a top-up (there is no automated bank pay-in rail). NOT secret, but
# blank by default so the feature stays inert (503) until the operator fills them in. The
# deposit is then admin-reviewed (proof upload → approve → credit); no funds move via the app.
# --------------------------------------------------------------------------- #
BANK_DEPOSIT_BANK_NAME = env("BANK_DEPOSIT_BANK_NAME", default="")
BANK_DEPOSIT_ACCOUNT_NAME = env("BANK_DEPOSIT_ACCOUNT_NAME", default="")
BANK_DEPOSIT_ACCOUNT_NUMBER = env("BANK_DEPOSIT_ACCOUNT_NUMBER", default="")
BANK_DEPOSIT_IBAN = env("BANK_DEPOSIT_IBAN", default="")
BANK_DEPOSIT_SWIFT = env("BANK_DEPOSIT_SWIFT", default="")
BANK_DEPOSIT_ADDRESS = env("BANK_DEPOSIT_ADDRESS", default="")

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
# Public origin of THIS API, used to build absolute links to uploaded media when no request
# is at hand (the frontend lives on another origin, so a bare /media/... would break).
PUBLIC_API_ORIGIN = env("PUBLIC_API_ORIGIN", default="")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --------------------------------------------------------------------------- #
# Error monitoring (apps/core/alerts.py, apps/core/monitoring.py). Server errors, failures in our apps and
# scheduled jobs, and browser crashes are logged to stdout (journald) and emailed to
# ERROR_ALERT_EMAILS — each distinct error once per ALERT_DEDUPE_SECONDS. Stack-frame locals
# and request bodies are left out of the emails.
# --------------------------------------------------------------------------- #
ADMINS = [(e, e) for e in env.list("ERROR_ALERT_EMAILS", default=[])]
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_SUBJECT_PREFIX = "[Capimax BRX alert] "
ALERT_DEDUPE_SECONDS = env.int("ALERT_DEDUPE_SECONDS", default=900)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "require_debug_false": {"()": "django.utils.log.RequireDebugFalse"},
    },
    "formatters": {
        "plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "plain"},
        "alert_email": {
            "level": "ERROR",
            "filters": ["require_debug_false"],
            "class": "apps.core.alerts.AlertEmailHandler",
            "reporter_class": "apps.core.alerts.NoLocalsExceptionReporter",
        },
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "django.request": {"handlers": ["console", "alert_email"], "level": "ERROR", "propagate": False},
        "apps": {"handlers": ["console", "alert_email"], "level": "INFO", "propagate": False},
        "client": {"handlers": ["console", "alert_email"], "level": "WARNING", "propagate": False},
    },
}

# A confirmed email address is required before identity verification (KYC) and every money
# action (investing, deposits, withdrawals, markets). Google sign-ins count as confirmed.
# Off by default in dev (like the auth throttles) so local work and the test suite don't need
# the link; the gate's own tests switch it on.
EMAIL_VERIFICATION_REQUIRED = env.bool("EMAIL_VERIFICATION_REQUIRED", default=True)

# Crypto purchases settle on what actually arrived (apps/payments/crypto_amounts.py): a payment
# short by at most max(this %, this many USD) still completes; a bigger shortfall cancels the
# purchase and returns what arrived to the wallet.
CRYPTO_UNDERPAY_TOLERANCE_PERCENT = env.float("CRYPTO_UNDERPAY_TOLERANCE_PERCENT", default=0.5)
CRYPTO_UNDERPAY_TOLERANCE_USD = env.float("CRYPTO_UNDERPAY_TOLERANCE_USD", default=1.0)

# Installments: one reminder this many days before each installment is due.
INSTALLMENT_REMINDER_DAYS = env.int("INSTALLMENT_REMINDER_DAYS", default=3)
