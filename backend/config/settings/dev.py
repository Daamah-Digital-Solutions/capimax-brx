"""Development settings. SPEC §1 (base/dev/prod split).

LOCAL DATABASE — DIRECT POSTGRES (no Docker required).
Local dev connects to a PostgreSQL server installed directly on the machine
(Windows: the official EDB installer). Configure it with a single DATABASE_URL in
backend/.env, e.g.:

    DATABASE_URL=postgres://capimax:capimax@localhost:5432/capimax

Note: a default PostgreSQL install usually listens on 5432, but some installs
(e.g. PostgreSQL 18 via the EDB installer on this machine) use 5433 — set the port
in DATABASE_URL to match your install. See backend/README.md for Windows setup.

docker-compose.yml is kept ONLY as an optional convenience; it is NOT required.
"""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

# Console email backend so verification / reset / OTP emails are printed to the
# terminal until a real provider is wired in a later phase. SPEC §6.
EMAIL_BACKEND = env(
    "DJANGO_EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)

# Convenience for local frontend dev.
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=False)
