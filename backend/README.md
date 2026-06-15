# Capimax BRX — Backend (Django + DRF)

Backend for the Capimax BRX real-estate tokenization platform, replacing the
original Supabase backend. This repository is the **Phase 1 (Foundation)** build:
project setup, a custom user model, profiles, and full JWT authentication. Domain
features (properties, investments, payments, …) arrive in later phases.

> Design reference: [`../BACKEND_SPEC.md`](../BACKEND_SPEC.md). Non-obvious
> modeling choices cite the relevant SPEC section in code comments.

## Governing principles

- **Automation-first** — admin is an *exception handler*, never a required step in
  any flow. Approvals/verification/withdrawals will be driven by webhooks and
  automated state machines in later phases.
- **Security-first** — fintech with real money. The API never trusts the client:
  every non-public endpoint enforces auth + object-level permissions server-side.
  DRF defaults to `IsAuthenticated` (deny-by-default).
- **Django admin** is the product's sole back-office surface.

## Tech stack

- Django 5.2 (LTS) · Django REST Framework · djangorestframework-simplejwt
- PostgreSQL — installed **directly** on the machine for local dev (Docker optional); Hostinger VPS later
- django-cors-headers · django-environ · django-allauth (OAuth scaffolding)

## Project layout

```
backend/
├── config/                 # project package
│   ├── settings/           # base / dev / prod split (env-driven)
│   ├── urls.py · wsgi.py · asgi.py
├── apps/
│   ├── core/               # ← Phase 1: User, Profile, auth, permissions
│   └── <17 domain stubs>   # properties, investments, wallets, certificates,
│                           # payments, withdrawals, lp, secondary_market,
│                           # family, distributions, notifications, reports,
│                           # broker, owner, partners, onboarding, kyc
│                           #   (empty — implemented in later phases)
├── docker-compose.yml      # OPTIONAL Postgres container (not required)
├── requirements.txt · .env.example · manage.py
```

## Local setup (Windows — direct PostgreSQL, no Docker)

### 1. Install PostgreSQL

1. Download the **PostgreSQL Windows installer** from
   <https://www.postgresql.org/download/windows/> (EDB installer) and run it.
2. During setup, set and **remember the password** for the `postgres` superuser.
3. Finish the install. PostgreSQL runs as a Windows service that starts
   automatically (e.g. service `postgresql-x64-18`).

> **Which port?** Default installs use **5432**; if 5432 was already taken the
> installer may pick **5433**. To check, open **SQL Shell (psql)** or pgAdmin and run:
> ```sql
> SHOW port;
> ```
> Use that port in `DATABASE_URL` below.

### 2. Create the database and role

Open **SQL Shell (psql)** (log in as `postgres` with the password from step 1), then:

```sql
CREATE ROLE capimax WITH LOGIN PASSWORD 'capimax';
ALTER ROLE capimax CREATEDB;          -- lets the test runner create test_capimax
CREATE DATABASE capimax OWNER capimax;
GRANT ALL PRIVILEGES ON DATABASE capimax TO capimax;
```

(You may choose any name/password — just mirror them in `DATABASE_URL`. The
`CREATEDB` grant is required for `python manage.py test`.)

### 3. Create a virtualenv and install deps

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure environment

```powershell
copy .env.example .env        # then edit DJANGO_SECRET_KEY etc.
```

Set `DATABASE_URL` to match YOUR install (note the port):

```
DATABASE_URL=postgres://capimax:capimax@localhost:5432/capimax
# …or :5433 if your PostgreSQL listens there.
```

### 5. Migrate, create an admin, run

```powershell
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver        # serves on http://localhost:8000
```

- API root:   `http://localhost:8000/api/auth/`
- Admin:      `http://localhost:8000/admin/`

### 6. Tests

```powershell
python manage.py test apps.core
```

> **Docker alternative (optional).** Prefer a containerised Postgres? Run
> `docker compose up -d` (publishes 5432) and set `DATABASE_URL`'s port to 5432.
> Docker is **not** required for local dev.

---

## Run the WHOLE platform locally (backend + frontend)

The React frontend's **auth** now talks to this Django backend; other (not-yet-built)
domains still use their existing Supabase/mock calls until their phase lands.

**Terminal 1 — backend** (from `backend/`, venv active, PostgreSQL running):

```powershell
python manage.py migrate
python manage.py runserver        # http://localhost:8000
```

**Terminal 2 — frontend** (from the repo root):

```powershell
npm install                       # or: bun install
# Ensure the repo-root .env has:  VITE_API_BASE_URL=http://localhost:8000/api
npm run dev                       # http://localhost:8080
```

**Test path (in the browser):**

1. Open <http://localhost:8080/register>, pick a role, click **Continue**, fill the
   form on `/auth`, and submit. You'll see the "check your email" screen.
2. Confirm it landed in Django: open <http://localhost:8000/admin/> → **Users**
   (new email present) and **Profiles** (the chosen `role`; privileged roles show
   `role_status = pending_verification`, investor shows `active`).
3. Back in the app, log in with the same credentials → you reach `/dashboard`, and
   the header shows your email. Log out and log back in to confirm the round-trip.

> CORS for `http://localhost:8080` (and `127.0.0.1:8080`) is already allowed in
> `config/settings/base.py` (`CORS_ALLOWED_ORIGINS`).

## Auth API (Phase 1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register/` | public | Create user + profile with the user's **selected role** (validated; `admin`/unknown rejected). Privileged roles are stored but gated at `pending_verification`. |
| POST | `/api/auth/login/` | public | Email/password → `{ user, session: { access_token, refresh_token } }`. |
| POST | `/api/auth/token/refresh/` | public | Rotate the access token (refresh rotation + blacklist enabled). |
| POST | `/api/auth/logout/` | auth | Blacklist the supplied refresh token. |
| GET  | `/api/auth/session/` | auth | `{ user, session: { access_token }, profile }` — the shape the frontend `AuthContext` expects. |
| GET  | `/api/auth/me/` | auth | Current user + profile. |
| POST | `/api/auth/password/reset/` | public | Request a reset link (no account enumeration). |
| POST | `/api/auth/password/reset/confirm/` | public | Set a new password from a token. |
| POST | `/api/auth/email/verify/` | public | Confirm an email-verification token. |

### Security notes

- **Role policy (frontend = source of truth).** Registration accepts the user's
  selected role and persists it. `role`/`role_status` are read-only on every API
  serializer, so an existing account can never self-elevate; `admin` can never be
  self-assigned. Privileged roles (`owner/developer/broker/lp/partner`) are stored
  but their capabilities stay gated (`role_status = pending_verification`) until
  KYC/KYB verification activates them — `core.permissions.HasActivatedRole` enforces
  this for later domains. Full rationale + frontend evidence in
  [`../DECISIONS.md`](../DECISIONS.md) "Role policy".
- Email is the login identifier; the user model has a **UUID primary key**
  (SPEC §3.13) so ids line up with the old Supabase data and are non-enumerable.
- DRF is **deny-by-default** (`IsAuthenticated`); public endpoints opt in explicitly.

### OAuth (Google / Apple) — scaffolding only

Social login is scaffolded via `django-allauth`. Provider keys are read from env
(`GOOGLE_OAUTH_*`, `APPLE_OAUTH_*`) and are **inert until supplied**, so Phase 1
runs without them. The allauth routes are mounted at `/accounts/`. Wiring the
dedicated DRF social-login endpoints (and, optionally, `dj-rest-auth`) is a
later-phase task once real keys exist (SPEC §6).

## Email in development

Verification / reset / (later) OTP emails print to the **console** in dev. A real
transactional provider (SES/SendGrid) is configured in `prod.py` in a later
phase — the call sites in `apps/core/emails.py` won't change (SPEC §6).

## Blockchain & custodial wallets (Phase 3 — Wave 1)

Wave 1 builds the **secure foundation** for on-chain tokenization: smart contracts
(one token contract per property, via a factory), custodial wallet generation with
encrypted-at-rest keys behind a swappable KeyManager, and the chain-interaction
layer. It does **not** wire minting to user actions or touch checkout/investments —
those are Waves 2–3.

> ⚠️ **TESTNET ONLY. UNAUDITED.** Everything targets **BSC Testnet (chain id 97)**.
> The contracts are **not audited** — a professional audit is required before any
> mainnet/real-funds use. Network/RPC/chain-id/keys are all env-driven so a later,
> separate, audited mainnet cutover is a config change (nothing hardcodes mainnet).

### What's here

- **Smart contracts** (`blockchain/`, Hardhat + OpenZeppelin 5):
  `PropertyTokenFactory` deploys one `PropertyToken` (ERC20, 0 decimals = whole
  $100 shares, fixed cap = the property's `token_supply`, `MINTER_ROLE`-gated mint)
  per property — mirroring the per-property SPV.
- **Custodial wallets** (`apps/wallets/`): `UserWallet` (one per user) + a separate
  `WalletKeyMaterial` table holding the **encrypted** private key. Generation creates
  a real BSC keypair and returns only the address. **KYC-gated** (`POST /api/wallets/`
  returns 403 until the KYC phase flips the gate).
- **Chain layer** (`apps/chain/`): web3.py service to deploy via the factory, read
  supply/balances, and mint (mint is built + tested but **not** wired to any user
  action in Wave 1). Management commands `deploy_factory` and
  `deploy_property_contract --slug <id>`, plus a Property admin action.

### Wallet API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/wallets/` | auth + **KYC** | Create the caller's custodial wallet (idempotent). 403 "KYC approval is required" today. |
| GET | `/api/wallets/me/` | auth | The caller's wallet `{ id, wallet_address, network, wallet_type, created_at }` (404 if none). No key material, ever. |

### Set up the chain stack

1. **Python deps** (already in `requirements.txt`): `web3`, `eth-account`,
   `cryptography`. Verified to install with prebuilt wheels on Python 3.14.
2. **Generate + set secrets** in `.env` (see `.env.example`):
   ```powershell
   # Fernet key for encrypting custodial private keys at rest:
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   # A deployer keypair (TESTNET):
   python -c "from eth_account import Account; a=Account.create(); print(a.key.hex(), a.address)"
   ```
   Put the Fernet key in `WALLET_ENCRYPTION_KEY` and the deployer key in
   `DEPLOYER_PRIVATE_KEY`. A free RPC is preset (`BSC_TESTNET_RPC_URL`), `CHAIN_ID=97`.
3. **Fund the deployer** address with testnet BNB from a faucet
   (<https://testnet.bnbchain.org/faucet-smart>) — needed only for real deploys.

### Compile, test, deploy the contracts

```powershell
cd blockchain
npm install
npx hardhat compile
npx hardhat test                     # 16 contract tests
npm run deploy:testnet               # deploy factory (+ a demo token) to BSC Testnet
```

Copy the printed factory address into `.env` as `PROPERTY_TOKEN_FACTORY_ADDRESS`.
Then deploy a property's contract from Django:

```powershell
python manage.py deploy_factory                    # (alternative to the JS script)
python manage.py deploy_property_contract --slug 1 # one PropertyToken for property "1"
```

### Run the Django tests

```powershell
python manage.py test apps.core apps.properties apps.wallets apps.chain
```

Includes tests that the custodial private key is **encrypted, never serialized,
never logged**, that wallet creation is **KYC-gated (403)**, and that the KeyManager
round-trips (and ciphertext is useless without the env key).

## What Phase 1 intentionally defers

See the checklist at the end of the Phase 1 hand-off, and `BACKEND_SPEC.md` §3/§4/§7
for the full domain model and business logic to be built next.
