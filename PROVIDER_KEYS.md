# PROVIDER_KEYS.md — external-provider configuration guide

**Configuration guide only — NO key values here (none exist yet; the integrations are code-complete
but INERT until keys are set).** All four providers (Stripe, NOW Payments, Sumsub, OAuth) read their
credentials from environment variables loaded out of **`backend/.env`** (loaded at
[base.py:24](backend/config/settings/base.py:24); env helper at [base.py:16](backend/config/settings/base.py:16)).

**`backend/.env` is gitignored** — confirmed via `git check-ignore` (matched by `/backend/.env` in the
root `.gitignore` + `/media/`-style rules). **Never commit it.**

**Inert-when-blank pattern:** each integration exposes an `is_configured()` that returns `False` when
its key is blank, and the views **degrade to 503** instead of breaking. So the app runs today with no
keys; setting the env vars "turns on" each provider. Signature verification on every inbound
webhook/IPN is **mandatory** and refuses to act (no mint, no activation) when the secret is unset or
the signature is invalid.

URLs below use `{API}` = your backend base (dev: `http://localhost:8000`) and `{FRONTEND_URL}`
(default `http://localhost:8080`, [base.py:258](backend/config/settings/base.py:258)).

---

## 1. Stripe (card payments → mint)

| Env var | Read at | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | [base.py:335](backend/config/settings/base.py:335) | Server API key — creates PaymentIntents. `is_configured()` ([stripe_service.py:41](backend/apps/payments/stripe_service.py:41)). |
| `STRIPE_PUBLISHABLE_KEY` | [base.py:336](backend/config/settings/base.py:336) | Public key sent to the browser (Stripe Elements) via `GET /api/payments/stripe/config/`. |
| `STRIPE_WEBHOOK_SECRET` | [base.py:337](backend/config/settings/base.py:337) | **Webhook signing secret** — verifies inbound events. `webhook_configured()` ([stripe_service.py:45](backend/apps/payments/stripe_service.py:45)). |
| `STRIPE_CURRENCY` | [base.py:339](backend/config/settings/base.py:339) | Charge currency (default `usd`). |

- **Webhook URL to register in the Stripe dashboard:** `{API}/api/payments/stripe/webhook/`
  ([payments/urls.py:19](backend/apps/payments/urls.py:19)). Signature verification is **mandatory**
  ([stripe_service.py:12](backend/apps/payments/stripe_service.py:12)) — the handler refuses to act on
  an unverified event, so no mint happens without a valid signature.
- **Test vs live:** Stripe's own key prefixes (`sk_test_…`/`pk_test_…` vs `sk_live_…`/`pk_live_…`) +
  a separate test-mode webhook signing secret. Start with **test-mode** keys.

## 2. NOW Payments (crypto payments → mint)

| Env var | Read at | Purpose |
|---|---|---|
| `NOWPAYMENTS_API_KEY` | [base.py:348](backend/config/settings/base.py:348) | Server API key — creates crypto payments. `is_configured()` ([nowpayments_service.py:45](backend/apps/payments/nowpayments_service.py:45)). |
| `NOWPAYMENTS_IPN_SECRET` | [base.py:349](backend/config/settings/base.py:349) | **IPN signing secret** — HMAC-SHA512 verification of callbacks. `ipn_configured()` ([nowpayments_service.py:52](backend/apps/payments/nowpayments_service.py:52)). |
| `NOWPAYMENTS_BASE_URL` | [base.py:350](backend/config/settings/base.py:350) | API base (default `https://api.nowpayments.io/v1`). |
| `NOWPAYMENTS_PRICE_CURRENCY` | [base.py:352](backend/config/settings/base.py:352) | Price currency (default `usd`). |

- **IPN callback URL to register in the NOW dashboard:** `{API}/api/payments/nowpayments/ipn/`
  ([payments/urls.py:23](backend/apps/payments/urls.py:23)). Verification is **mandatory**: HMAC-SHA512
  over the key-sorted JSON body, header `x-nowpayments-sig`, constant-time compare
  ([nowpayments_service.py:113-131](backend/apps/payments/nowpayments_service.py:113)) — invalid/absent
  signature ⇒ no mint.
- **Test vs live:** NOW Payments offers a **sandbox** (separate base URL + sandbox API/IPN keys). Point
  `NOWPAYMENTS_BASE_URL` at the sandbox while testing.

## 3. Sumsub (KYC for investors + KYB for LP/owner/developer/partner → activation)

| Env var | Read at | Purpose |
|---|---|---|
| `SUMSUB_APP_TOKEN` | [base.py:274](backend/config/settings/base.py:274) | App token — `X-App-Token` header for API calls ([sumsub.py:70](backend/apps/kyc/sumsub.py:70)). |
| `SUMSUB_SECRET_KEY` | [base.py:275](backend/config/settings/base.py:275) | Request-signing secret (HMAC-SHA256 of ts+method+path+body, [sumsub.py:62](backend/apps/kyc/sumsub.py:62)). With APP_TOKEN → `is_configured()` ([sumsub.py:50](backend/apps/kyc/sumsub.py:50)). |
| `SUMSUB_WEBHOOK_SECRET` | [base.py:276](backend/config/settings/base.py:276) | **Webhook signing secret** — verifies inbound review callbacks ([sumsub.py:138](backend/apps/kyc/sumsub.py:138)); `webhook_configured()` ([sumsub.py:55](backend/apps/kyc/sumsub.py:55)). |
| `SUMSUB_BASE_URL` | [base.py:293](backend/config/settings/base.py:293) | API base (default `https://api.sumsub.com`). |
| `SUMSUB_LEVEL_NAME` | [base.py:277](backend/config/settings/base.py:277) | Investor KYC level name. |
| `SUMSUB_KYB_LEVEL_NAME` | [base.py:280](backend/config/settings/base.py:280) | LP (business) KYB level. |
| `SUMSUB_OWNER_KYB_LEVEL_NAME` | [base.py:284](backend/config/settings/base.py:284) | Owner KYB level. |
| `SUMSUB_DEVELOPER_KYB_LEVEL_NAME` | [base.py:288](backend/config/settings/base.py:288) | Developer KYB level. |
| `SUMSUB_PARTNER_KYB_LEVEL_NAME` | [base.py:292](backend/config/settings/base.py:292) | Partner KYB level. |

- **Webhook URL to register in the Sumsub dashboard:** `{API}/api/kyc/webhook/sumsub/`
  ([kyc/urls.py:13](backend/apps/kyc/urls.py:13)). Verification is **mandatory**: HMAC of the **raw**
  body, headers `x-payload-digest` (+ `x-payload-digest-alg`: SHA1/256/512), constant-time
  ([sumsub.py:29-34](backend/apps/kyc/sumsub.py:29), [:138](backend/apps/kyc/sumsub.py:138)) — invalid
  signature ⇒ no activation. One signed webhook routes KYC **and** all four KYB levels.
- **Level names** must match exactly what you create in the Sumsub dashboard (the defaults are
  placeholders). **Test vs live:** Sumsub has sandbox vs production app tokens; start in **sandbox**.

## 4. OAuth — Google + Apple (social login; via django-allauth)

| Env var | Read at | Purpose |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | [base.py:171](backend/config/settings/base.py:171) | Google OAuth client id. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | [base.py:172](backend/config/settings/base.py:172) | Google OAuth client secret. |
| `APPLE_OAUTH_CLIENT_ID` | [base.py:180](backend/config/settings/base.py:180) | Apple Services ID (client id). |
| `APPLE_OAUTH_CLIENT_SECRET` | [base.py:181](backend/config/settings/base.py:181) | Apple client secret / team-scoped secret. |
| `APPLE_OAUTH_KEY_ID` | [base.py:182](backend/config/settings/base.py:182) | Apple key id. |
| `APPLE_OAUTH_PRIVATE_KEY` | [base.py:184](backend/config/settings/base.py:184) | Apple `.p8` private key (certificate key). |

- **Callbacks are handled by allauth**, mounted at `{API}/accounts/…`
  ([config/urls.py:64](backend/config/urls.py:64)) — the redirect/callback URIs to whitelist in the
  Google/Apple consoles live under that prefix (allauth's provider callback routes). Blank id/secret →
  the provider is simply inert.

---

## 5. SETUP CHECKLIST (ordered)

> All keys go into **`backend/.env`** (create it if absent; it is gitignored). Restart the Django
> server after editing `.env`. **Begin with test/sandbox keys for every provider.**

1. **Stripe** — Dashboard → Developers → API keys: copy the **test** secret + publishable keys →
   `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`. Then Developers → Webhooks → add endpoint
   `{API}/api/payments/stripe/webhook/` (event `payment_intent.succeeded`) → copy its **signing
   secret** → `STRIPE_WEBHOOK_SECRET`.
2. **NOW Payments** — Account → API keys (use **sandbox** first) → `NOWPAYMENTS_API_KEY`; set
   `NOWPAYMENTS_BASE_URL` to the sandbox base while testing. Store Settings → IPN secret →
   `NOWPAYMENTS_IPN_SECRET`; set the IPN callback URL to `{API}/api/payments/nowpayments/ipn/`.
3. **Sumsub** — Dashboard (sandbox) → App tokens → `SUMSUB_APP_TOKEN` + `SUMSUB_SECRET_KEY`. Create the
   KYC + 4 KYB levels and set the five `SUMSUB_*_LEVEL_NAME` vars to match. Webhooks → add
   `{API}/api/kyc/webhook/sumsub/` → copy its secret → `SUMSUB_WEBHOOK_SECRET`.
4. **OAuth (optional for launch)** — Google Cloud Console → OAuth client → id/secret +
   whitelist the allauth callback under `{API}/accounts/…`. Apple Developer → Services ID + key →
   the five `APPLE_OAUTH_*`/`GOOGLE_OAUTH_*` vars.
5. **Verify (the live-key e2e — the pre-delivery gate):**
   - **Stripe:** make a **test charge** through Checkout → Stripe sends a signed event to the webhook →
     confirm the payment completes and the **on-chain mint** fires (idempotent). Repeat for **NOW**
     (sandbox crypto payment → signed IPN → mint).
   - **Sumsub:** run a sandbox **KYC review** (investor) and one **KYB review** (e.g. LP) → confirm the
     signed webhook flips status and **activates** the role.
   - **OAuth:** complete a Google/Apple sign-in round-trip.
   - Then repeat the charge/review flows with **live** keys before go-live.

## 6. SECURITY reminders

- Keys live in **`backend/.env` ONLY** — gitignored, **never committed**. Do not paste real values into
  code, docs, commits, or chat.
- **Start with test/sandbox keys**; switch to live only at the controlled cutover.
- Inbound **webhook/IPN signature verification is enforced** for Stripe, NOW, and Sumsub — an unverified
  call never mints or activates. Register the exact URLs above so the provider signs correctly.
- The **live-key end-to-end test (§5.5) is a required pre-delivery gate** (see `FINAL_STATE.md` §3):
  the dev-simulate paths must be exercised against real keys before delivery.
- Related secrets that are NOT provider keys but also belong only in `.env` (never commit):
  `DJANGO_SECRET_KEY`, `WALLET_ENCRYPTION_KEY` (Fernet), `DEPLOYER_PRIVATE_KEY`, the Postgres password
  ([base.py](backend/config/settings/base.py) — DB config), and `PROPERTY_TOKEN_FACTORY_ADDRESS`.
