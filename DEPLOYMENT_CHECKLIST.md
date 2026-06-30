# DEPLOYMENT_CHECKLIST.md — Capimax BRX testnet soft-launch deploy

**Purpose:** the ordered, checkable, who-does-what plan to take the **bare VPS** to a working
**testnet** API at `https://api.capimaxbrx.com` (prod Django settings, sandbox/test provider keys,
BSC Testnet). Frontend ships on **Netlify** (`capimaxbrx.com`). This is a **clean-slate deploy** — the
VPS readiness audit found only OS + SSH present (no repo, venv, Postgres, nginx, certs).

> **Scope:** TESTNET soft launch only (sandbox keys, BSC Testnet chain 97, **no real money**).
> **Mainnet items are OUT OF SCOPE** — see the bottom section.

> ## CURRENT PROGRESS (as of this update)
> **We are cleanly paused BEFORE Step 1 — nothing on the VPS has been installed, deployed, or written.**
> The only things that exist so far:
> - ✅ **SSH key access** — dedicated key `~/.ssh/capimax_brx_vps` authorized for `root@148.230.125.240`
>   (the old `capimax_staging` key was unrelated/dead and is not used).
> - ✅ **Step 8 — DNS A record DONE** (Yahia): `api.capimaxbrx.com` → `148.230.125.240`, verified
>   resolving via external resolvers (1.1.1.1 + 8.8.8.8). *(Listed at its dependency position below, but
>   completed early — harmless, it just needs to resolve before Step 9 TLS.)*
> - ✅ **Chain trio already done locally** (factory deployed + deployer funded on BSC Testnet) — the
>   values get **copied into the server `.env` at Step 4, no redeploy**.
>
> **Everything else (Steps 0–7, 9–13) is NOT started.** The VPS is still bare Ubuntu + SSH. Next action
> when we resume = **Step 1 (system packages)** — but only on an explicit "go".

## Roles & ground rules
- **Yahia** = the human operator (panel/DNS/dashboards + **all secrets**).
- **Claude** = runs VPS commands over SSH (key `~/.ssh/capimax_brx_vps`, root), read/confirm per step.
- **SECRETS RULE:** every secret value is **"Yahia pastes, never Claude."** Claude creates the file,
  sets non-secret lines, and tells Yahia exactly which keys to fill — Claude never writes a secret
  value, never echoes one, never commits one. `backend/.env` is gitignored and stays on the server only.
- **OPERATIONAL RULE — never `source` the server `.env`.** Bash `. ./.env` / `source .env` *executes*
  the file, so any value with shell-special chars gets echoed to the terminal (= leaked to the
  transcript). For one-off `manage.py` commands that need the env, use the **systemd EnvironmentFile**
  mechanism (e.g. `systemd-run` with `EnvironmentFile=/opt/capimax-brx/backend/.env`, or
  `systemctl restart capimax-api` for the live process) — NOT `source`.
- **No destructive action without explicit OK.** Each step is non-destructive unless flagged.
- **Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done. **Owner** column = who acts.

## ⚠️ PRE-LAUNCH SECRET ROTATION (REQUIRED before go-live)
- **[ ] Rotate ALL provider sandbox/test secrets + the DB password, then re-merge.** Every secret below
  was exposed in chat at some point (pasted by Yahia early, and one `.env`-source accident during the
  `7aead94` redeploy) — all are **test/sandbox only (no live money)**, but must be rolled once, together,
  before launch:
  - **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  - **Sumsub:** `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_WEBHOOK_SECRET`
  - **NOW Payments:** `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
  - **Postgres:** the `capimax` DB password (in `DATABASE_URL`) — rotate via `\password capimax`.
  - *(Chain trio `WALLET_ENCRYPTION_KEY` / `DEPLOYER_PRIVATE_KEY` / `PROPERTY_TOKEN_FACTORY_ADDRESS`
    were NEVER echoed — do NOT rotate; regenerating the Fernet key orphans all custodial wallets.)*
- **Re-merge after rotating** via the **opaque scp → server-merge → shred** flow (values never pass
  through Claude/chat), then `systemctl restart capimax-api`. Same flow used to set the secrets
  originally. When switching to **live** (non-sandbox) keys at the real cutover, use this same step.

## Facts (from the readiness audit)
- VPS: Ubuntu 24.04.4 LTS, KVM8 (8 vCPU / 32 GB / 400 GB), IPv4 **148.230.125.240**, host `srv1775962`.
- Repo: `https://github.com/Daamah-Digital-Solutions/capimax-brx.git`, branch **main**. Backend deps:
  `backend/requirements.txt`. System Python **3.12.3** (no version pin in repo).
- Chain layer ALREADY done locally (factory deployed + deployer funded on BSC Testnet) — the chain trio
  values get copied into the server `.env`; **no redeploy**.
- DNS today: `capimaxbrx.com` → `2.57.91.91` (not the VPS); `api.capimaxbrx.com` → **no record yet**.

---

## STEP 0 — Pre-flight (no changes)
- **Owner:** Claude · **Depends on:** SSH key access (done).
- Confirm `ssh -i ~/.ssh/capimax_brx_vps root@148.230.125.240` connects; snapshot/confirm the weekly
  Hostinger backup is enabled before any change.
- **Verify:** `whoami` → `root`; backup schedule visible in panel.

## STEP 1 — System packages
- **Owner:** Claude · **Depends on:** 0.
- `apt update` then install: `python3-venv python3-dev build-essential libpq-dev`, **PostgreSQL**
  (`postgresql postgresql-contrib`), **nginx**, **certbot python3-certbot-nginx**, `git`, `ufw`.
  (No Node — frontend builds on Netlify.)
- **Verify:** `psql --version`, `nginx -v`, `certbot --version`, `git --version` all resolve;
  `systemctl is-active postgresql nginx` → `active`.

## STEP 2 — PostgreSQL database + role
- **Owner:** Claude runs SQL · **Yahia** supplies the DB password (paste) · **Depends on:** 1.
- Create role `capimax` + database `capimax_brx` (owner `capimax`, UTF8). **DB password = Yahia pastes,
  never Claude.**
- **Verify:** `sudo -u postgres psql -c "\l"` lists `capimax_brx`; a `psql` connect as `capimax` succeeds.

## STEP 3 — Clone repo + venv + deps
- **Owner:** Claude · **Depends on:** 1.
- Clone to `/opt/capimax-brx` (branch `main`); create `/opt/capimax-brx/backend/.venv`;
  `pip install -r backend/requirements.txt` + `gunicorn`.
- **Verify:** `git -C /opt/capimax-brx rev-parse --abbrev-ref HEAD` → `main`, up to date with origin;
  `.venv/bin/python -c "import django; print(django.get_version())"` works.

## STEP 4 — Server `.env` (SECRETS: Yahia pastes, never Claude)
- **Owner:** Claude scaffolds non-secret lines + lists required keys · **Yahia pastes every secret** ·
  **Depends on:** 3.
- Create `/opt/capimax-brx/backend/.env` (gitignored). Claude sets the **non-secret** lines:
  - `DJANGO_SETTINGS_MODULE=config.settings.prod`
  - `DJANGO_DEBUG=false`
  - `DJANGO_ALLOWED_HOSTS=api.capimaxbrx.com`
  - `CORS_ALLOWED_ORIGINS=https://capimaxbrx.com,https://www.capimaxbrx.com`
  - `FRONTEND_URL=https://capimaxbrx.com`
  - `WALLET_NETWORK=bsc-testnet`, `CHAIN_ID=97`, `BSC_TESTNET_RPC_URL=...`, `KEY_MANAGER_BACKEND=fernet-db`
  - `NOWPAYMENTS_BASE_URL=` → **sandbox** URL (if NOW is used)
- **Yahia pastes (never Claude):** `DJANGO_SECRET_KEY`, `DATABASE_URL` (incl. the step-2 password),
  the **chain trio** (`WALLET_ENCRYPTION_KEY`, `DEPLOYER_PRIVATE_KEY`, `PROPERTY_TOKEN_FACTORY_ADDRESS`
  — the working values already in the local `.env`), and the **provider keys/webhook-secrets**
  (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUMSUB_APP_TOKEN`,
  `SUMSUB_SECRET_KEY`, `SUMSUB_WEBHOOK_SECRET`, the 5 `SUMSUB_*_LEVEL_NAME`, and NOW keys if used).
- **Verify (no secret printed):** `python manage.py check --deploy` passes; a masked present/blank
  audit shows the required keys `set`. **Gate:** the app must NOT mint/activate until the webhook
  secrets are set (signature verification is mandatory).

## STEP 5 — Migrate + collectstatic + persistent `/media`
- **Owner:** Claude · **Depends on:** 2, 3, 4.
- `manage.py migrate` (creates schema — **first write to the DB**, confirm before running);
  `manage.py collectstatic --noinput` (→ `STATIC_ROOT=backend/staticfiles`); create a persistent
  **`/var/capimax/media`** dir (or repo `backend/media`) for KYB/deliverable uploads and confirm it is
  inside the **weekly backup** path.
- **Verify:** migrate reports no pending; `staticfiles/` populated; media dir writable by the service
  user + covered by backup. (Optionally `manage.py seed_properties` for demo catalogue — confirm first.)

## STEP 6 — gunicorn under systemd
- **Owner:** Claude · **Depends on:** 5.
- Create a `capimax-api.service` systemd unit running gunicorn (`config.wsgi`) bound to a local socket /
  `127.0.0.1:8000`, `EnvironmentFile=/opt/capimax-brx/backend/.env`, non-root service user, auto-restart.
- **Verify:** `systemctl enable --now capimax-api` → `active`; `curl 127.0.0.1:8000/...` returns a
  Django response (not connection-refused).

## STEP 7 — nginx reverse-proxy for `api.capimaxbrx.com`
- **Owner:** Claude · **Depends on:** 6.
- nginx site: `server_name api.capimaxbrx.com;` → proxy_pass to gunicorn; serve `/static/` from
  `staticfiles/` and `/media/` from the media dir; client_max_body_size for doc uploads. (HTTP only at
  this point — TLS added in step 9.)
- **Verify:** `nginx -t` OK; `systemctl reload nginx`; `curl -H "Host: api.capimaxbrx.com"
  http://148.230.125.240/` reaches Django.

## STEP 8 — DNS A record for `api.` (Yahia) — ✅ DONE
- **Owner:** **Yahia** (DNS registrar/panel) · **Depends on:** 7 (so it answers when it resolves).
- Add **A record: `api.capimaxbrx.com` → 148.230.125.240** (TTL low for launch).
- **Verify:** `nslookup api.capimaxbrx.com` → `148.230.125.240` from an external resolver (propagation).
- **STATUS: ✅ DONE** — record added by Yahia; confirmed resolving to `148.230.125.240` via 1.1.1.1 and
  8.8.8.8. (Completed ahead of its position; only needs to be live before Step 9 TLS issuance.)

## STEP 9 — TLS (certbot) for `api.capimaxbrx.com`
- **Owner:** Claude · **Depends on:** 8 (cert issuance needs DNS resolving to this box).
- `certbot --nginx -d api.capimaxbrx.com` (HTTP-01); enable auto-renew; redirect 80→443.
- **Verify:** `https://api.capimaxbrx.com/` serves with a valid LE cert; `certbot renew --dry-run` OK.

## STEP 10 — Firewall (ufw)
- **Owner:** Claude · **Depends on:** 1 (ufw installed); do AFTER 9 so we don't lock out mid-setup.
- `ufw allow OpenSSH` (22), `allow 80`, `allow 443`; `ufw enable`. **Caution:** confirm SSH (22) is
  allowed *before* enabling, or risk lockout.
- **Verify:** `ufw status` shows 22/80/443 allow; SSH session stays alive; Postgres 5432 NOT exposed.

> **KYB for the 4 business roles (LP / Owner / Developer / Partner) can be approved MANUALLY by an
> admin** — Sumsub KYB is deferred (paid tier). Each role now has an **entity-KYB document vault**
> (upload registration cert / trade licence; admin reviews it inline before `exception_approve_kyb`
> activates the role). So a full soft launch can run on **investor KYC (individual Sumsub level) +
> manual admin KYB** without the paid Company-KYB tier. The 5 `SUMSUB_*_LEVEL_NAME` levels below only
> matter if/when automated Sumsub KYB is turned on. See DECISIONS.md "Entity-KYB document vault".

## STEP 11 — Provider webhooks (Yahia, in dashboards)
- **Owner:** **Yahia** (Stripe/Sumsub dashboards) · **Depends on:** 9 (public HTTPS URL exists).
- Stripe → webhook endpoint `https://api.capimaxbrx.com/api/payments/stripe/webhook/`
  (event `payment_intent.succeeded`) → paste its `whsec_` into server `.env` (`STRIPE_WEBHOOK_SECRET`).
- Sumsub → webhook `https://api.capimaxbrx.com/api/kyc/webhook/sumsub/` → paste its secret into
  `SUMSUB_WEBHOOK_SECRET`; create the 5 sandbox levels matching the `SUMSUB_*_LEVEL_NAME` values.
- (Optional) NOW Payments IPN `https://api.capimaxbrx.com/api/payments/nowpayments/ipn/`.
- **Verify:** after pasting, `systemctl restart capimax-api`; a dashboard "send test event" reaches the
  endpoint (200) and is signature-verified.

## STEP 12 — Netlify frontend (Yahia)
- **Owner:** **Yahia** (Netlify + DNS) · **Depends on:** apex DNS to Netlify + the API live.
- Point `capimaxbrx.com` (+ `www`) at Netlify; redeploy. Build/publish/Node are pinned in `netlify.toml`
  (`npm run build` → `dist`, Node 20, SPA catch-all) — no manual UI build config needed.
- **Env var — only ONE now:** `VITE_API_BASE_URL = https://api.capimaxbrx.com/api` (include `/api`, no
  trailing slash). **Supabase was fully removed** (see DECISIONS.md "Supabase fully removed") — there are
  **NO `VITE_SUPABASE_*` vars anymore**; do not set them.
- **Verify:** the live site loads and its API calls hit `api.capimaxbrx.com` (CORS allows the origin
  set in step 4); login/marketplace render against the real backend. Test via the real
  `https://capimaxbrx.com` (not the `*.netlify.app` preview) to avoid a CORS-origin mismatch.

## STEP 13 — Sandbox end-to-end gate (the launch acceptance test)
- **Owner:** Claude drives / observes · **Yahia** does dashboard side · **Depends on:** 11, 12.
- **Card → mint:** Stripe **test** card through checkout → signed webhook → confirm `mint_investment`
  fires (idempotent) and tokens show on-chain (BSC Testnet).
- **KYC/KYB → activation:** run a Sumsub **sandbox** KYC (investor) + one KYB (e.g. LP) → signed webhook
  flips status and **activates** the role.
- **(Optional) Crypto → mint:** NOW sandbox payment → signed IPN → mint.
- **Verify:** each path completes through the **real signed webhook** (not a dev shortcut); no errors in
  `journalctl -u capimax-api`. **This passing = testnet soft launch is live.**

---

## OUT OF SCOPE (mainnet gates — do NOT do in this launch)
- Mainnet chain cutover: smart-contract audit, **KMS/HSM** key custody (replaces Fernet `fernet-db`),
  gas-station/relayer at scale, on-chain burn-back of forfeited installment tokens.
- **Live** (non-sandbox) provider keys + the live-key cutover e2e.
- Real-money handling of any kind.
- `check_installment_defaults` daily scheduler (cron/systemd-timer) — a deploy nicety, **not** launch-
  blocking; can be wired after the gate passes.

## Dependency summary
`0 → 1 → {2,3} → 4 → 5 → 6 → 7 → 8(Yahia ✅) → 9 → 10 → 11(Yahia) → 12(Yahia) → 13`.
Steps owned by **Yahia**: 2 (DB password), 4 (all secrets), **8 (DNS A — ✅ DONE)**, 11 (webhooks),
12 (Netlify/DNS). **Done so far: SSH access + Step 8 (DNS). Not started: everything else (still pre-Step 1).**
Everything else: **Claude**, read/confirm per step, nothing destructive without explicit OK.
