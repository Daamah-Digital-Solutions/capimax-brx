# Capimax BRX

**Capimax BRX** is a real-estate tokenization platform for the GCC market. Investors
complete KYC, fund an investment, and receive on-chain **PropertyToken** units that
represent fractional ownership of a property. Liquidity Providers (LPs) complete KYB
and provide instant exit liquidity. A peer secondary market lets investors trade their
units directly. The platform is bilingual (English / Arabic, with RTL support).

> **Status:** Active development. The on-chain layer runs on **BSC Testnet only**
> (chain id 97). Third-party provider keys (Stripe, NOW Payments, Sumsub KYC/KYB,
> OAuth) are **deferred** — the code paths are complete and gated, but they run inert
> until real keys are supplied. Do **not** treat this as production / mainnet-ready;
> a security audit and a custody/KMS + gas-relayer hardening pass are required before
> any mainnet cutover.

---

## Architecture

```
┌─────────────────────────┐        HTTPS / JWT        ┌──────────────────────────┐
│  Frontend (React+Vite)  │  ───────────────────────► │  Backend (Django + DRF)  │
│  TypeScript, shadcn-ui  │                           │  SimpleJWT auth          │
│  Tailwind, EN/AR (RTL)  │  ◄─────────────────────── │  PostgreSQL              │
│  :8080                  │         JSON API          │  :8000                   │
└─────────────────────────┘                           └────────────┬─────────────┘
                                                                    │ web3.py
                                                       custodial signing (Fernet
                                                       key manager) + gas funding
                                                                    ▼
                                                       ┌──────────────────────────┐
                                                       │   BSC Testnet (chain 97) │
                                                       │   PropertyToken (ERC20)  │
                                                       └──────────────────────────┘
```

- **Custodial wallets.** Each user gets a custodial wallet. Private keys are
  encrypted at rest with an authenticated-encryption key (`WALLET_ENCRYPTION_KEY`)
  held in the environment, **separate from the database** — a DB dump alone is
  useless. The key-manager abstraction (`apps/wallets/keys.py`) can be swapped for a
  KMS/HSM backend without changing callers.
- **On-chain mint + transfer.** Minting is gated on a **signature-verified**
  payment webhook/IPN (raw card data never touches the server). Secondary-market
  sales transfer the real ERC20 token from the seller's custodial wallet to the
  buyer's, signed with the seller's custodial key — never ledger-only, never a
  fabricated tx hash.
- **Secondary markets.** Two real, on-chain-settled surfaces share one escrow lock
  (a token amount can be listed on only one market at a time):
  - **LP Market** — investor sells to an approved LP for instant fill (1% fee).
  - **Peer Secondary Market** — investor-to-investor one-shot listings (0.5% fee),
    KYC-gated. (A bid/ask order book is intentionally deferred.)
  Fees are computed server-side and are configurable via environment variables.

---

## Tech stack

**Frontend**
- React + Vite + TypeScript
- shadcn-ui + Tailwind CSS
- React Router, bilingual EN/AR (RTL)

**Backend**
- Django 5 + Django REST Framework
- SimpleJWT (email login, UUID primary keys)
- PostgreSQL
- web3.py + eth-account (BSC Testnet)
- `cryptography` (Fernet) for custodial-key encryption at rest

**Smart contracts** (`backend/blockchain/`)
- Solidity 0.8.24, Hardhat
- OpenZeppelin ERC20 `PropertyToken` (0 decimals) + factory

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.12+ (developed against 3.14)
- **PostgreSQL** (this project's local install listens on **port 5433** — adjust
  `DATABASE_URL` to match your install; default Postgres is 5432)
- A funded **BSC Testnet** deployer key (only needed to exercise the on-chain paths;
  fund it from the [BNB testnet faucet](https://testnet.bnbchain.org/faucet-smart))

---

## Setup

### 1. Clone & configure environment

```sh
git clone https://github.com/Daamah-Digital-Solutions/capimax-brx.git
cd capimax-brx

# Frontend env (public VITE_* vars)
cp .env.example .env

# Backend env (real secrets live here — never committed)
cp backend/.env.example backend/.env
```

Then edit `backend/.env` and set, at minimum:

- `DJANGO_SECRET_KEY` — a long random string
- `DATABASE_URL` — your Postgres role/password/host/**port**/db
- `WALLET_ENCRYPTION_KEY` — generate with:
  `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `DEPLOYER_PRIVATE_KEY` / `PROPERTY_TOKEN_FACTORY_ADDRESS` — only if running the
  on-chain paths (testnet)

Provider keys (Stripe / NOW Payments / Sumsub / OAuth) may be left **blank** — those
features stay inert but the rest of the app runs. See `backend/README.md` for the
full backend guide.

### 2. Backend (`:8000`)

```sh
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate     macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### 3. Frontend (`:8080`)

```sh
# from the repository root
npm install
npm run dev
```

The Vite dev server runs on **http://localhost:8080** and talks to the Django API at
`VITE_API_BASE_URL` (default `http://localhost:8000/api`).

---

## Security notes

- **Never commit `.env` files or keys.** `.gitignore` excludes all `.env*` (except
  the `.env.example` templates), key files, uploaded media (real KYC/KYB documents),
  virtualenvs, `node_modules`, and build artifacts.
- **Secrets come only from the environment.** Nothing sensitive is hardcoded; the
  Hardhat config and Django settings read keys from env vars exclusively.
- **Testnet only.** The blockchain config intentionally defines no mainnet network.
- **Webhook-gated minting.** Token minting only happens after a signature-verified
  payment callback; idempotency is enforced.

---

## Repository layout

```
.
├── src/                  # React/Vite frontend
├── public/               # Static assets
├── supabase/             # Legacy Supabase functions/migrations (being migrated)
├── backend/              # Django + DRF backend
│   ├── apps/             #   domain apps (auth, kyc, wallets, properties,
│   │                     #   investments, payments, lp, secondary_market, chain, ...)
│   ├── config/           #   settings (base/dev/prod), urls
│   ├── blockchain/       #   Hardhat project (PropertyToken contracts + scripts)
│   └── .env.example      #   backend env template
├── .env.example          # frontend env template
├── DECISIONS.md          # running design-decision log
└── README.md
```

For backend-specific details (apps, endpoints, dev/management commands, on-chain
cycle commands), see [`backend/README.md`](backend/README.md).
