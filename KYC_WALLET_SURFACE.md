# KYC + Wallet/Holdings Surface — Analysis (next-wave map)

> READ-ONLY analysis. Nothing built/changed. Maps the gap between the frontend's
> Supabase-era KYC/wallet/holdings layer and the Django API we built in Phase 3, and
> proposes the build plan (investor KYC via Sumsub, wallet wiring, holdings repoint,
> post-investment CTA fix). Source of truth = the frontend. Cite file:line throughout.

---

## 0. TL;DR

- The frontend's **wallet, KYC, transactions, and holdings** still read/write **Supabase**,
  not our Django API. Our `POST /api/wallets/`, `GET /api/wallets/me/`,
  `GET /api/wallets/{id}/tokens/`, `POST /api/investments/{id}/mint/` are **never called**.
- In-app KYC is a **status-flip with no approval path**: `submitKyc()` sets
  `user_kyc.status = "submitted"`; nothing in the UI ever sets `"approved"`, so the user is
  structurally stuck at "Under Review" and the **Create Wallet** button never appears.
- `Onboarding.tsx` is a **standalone mock wizard** that collects rich KYC data but
  **persists nothing** (on submit it just shows a local "pending" screen).
- Backend has the **gate** (`KYCApprovedPermission`, always-deny) and wallet endpoints, but
  **no `UserKYC` / `KYCDocument` models, no KYC endpoints, no provider webhook** yet.
- No KYC provider SDK (Sumsub/Onfido/etc.) is referenced anywhere — it's all custom forms.
- `useCertificates` was already repointed to Django in Phase 3 Wave 3 (the certificates
  list/download/verify are NOT part of this gap).

---

## 1. CURRENT FRONTEND KYC + WALLET LAYER (what talks to Supabase today)

### 1.1 `src/hooks/useUserWallet.ts` — the wallet/KYC/transactions hub (all Supabase)

Shapes the UI consumes (TS interfaces):
- `Wallet` ([useUserWallet.ts:5-11](src/hooks/useUserWallet.ts:5)): `id, wallet_address, network, wallet_type, created_at`.
- `KycStatus` ([useUserWallet.ts:13-17](src/hooks/useUserWallet.ts:13)): `status: "pending" | "submitted" | "approved" | "rejected"`, `submitted_at`, `approved_at`.
- `WalletTransaction` ([useUserWallet.ts:19-28](src/hooks/useUserWallet.ts:19)): `id, tx_hash, tx_type, amount, token_symbol, status, block_number, created_at`.

Supabase calls:
- **Read KYC**: `supabase.from("user_kyc").select("status, submitted_at, approved_at").eq("user_id", user.id).maybeSingle()` ([useUserWallet.ts:58-62](src/hooks/useUserWallet.ts:58)).
- **Read wallet**: `supabase.from("user_wallets").select("*").eq("user_id", user.id).maybeSingle()` ([useUserWallet.ts:68-72](src/hooks/useUserWallet.ts:68)).
- **Read transactions**: `supabase.from("wallet_transactions").select("*").eq("wallet_id", walletData.id).order("created_at", desc).limit(50)` ([useUserWallet.ts:79-84](src/hooks/useUserWallet.ts:79)).
- **Create wallet**: `supabase.functions.invoke("create-wallet", { headers: Bearer })` ([useUserWallet.ts:110-114](src/hooks/useUserWallet.ts:110)); expects `{ success, wallet }` ([useUserWallet.ts:118](src/hooks/useUserWallet.ts:118)). **This is the old edge function, NOT our `POST /api/wallets/`.**
- **Submit KYC**: `submitKyc()` checks for an existing `user_kyc` row ([useUserWallet.ts:140-144](src/hooks/useUserWallet.ts:140)), then **UPDATE** `status="submitted", submitted_at=now` ([useUserWallet.ts:148-151](src/hooks/useUserWallet.ts:148)) or **INSERT** `{ user_id, status:"submitted", submitted_at }` ([useUserWallet.ts:156-162](src/hooks/useUserWallet.ts:156)).
- **Explorer helpers**: `getExplorerUrl(address, network="ethereum")` maps `ethereum/polygon/bsc` ([useUserWallet.ts:176-183](src/hooks/useUserWallet.ts:176)); `getTxExplorerUrl` similarly ([useUserWallet.ts:185-192](src/hooks/useUserWallet.ts:185)). ⚠️ The map has key **`bsc`** but our wallets store **`bsc-testnet`**, so the link falls back to the Ethereum explorer (wiring bug to fix).

**KYC status state machine the UI expects** (the canonical 4 values, = Supabase `kyc_status` enum
[types.ts:1753,1891](src/integrations/supabase/types.ts:1753)): `pending → submitted → approved | rejected`. `submitKyc` only ever produces `submitted`. No transition to `approved` exists client-side.

### 1.2 `src/hooks/useOwnershipTokens.ts` — holdings (Supabase + realtime)

- `OwnershipToken` shape ([useOwnershipTokens.ts:5-20](src/hooks/useOwnershipTokens.ts:5)): `id, wallet_id, property_id, property_name, token_symbol, token_amount, token_value_usd, ownership_percentage, acquisition_date, last_distribution_date, total_distributions, status, created_at, updated_at`. **Identical to our `apps/wallets.OwnershipToken` + `OwnershipTokenSerializer`** — so repointing is a drop-in.
- **Read**: `supabase.from("ownership_tokens").select("*").eq("wallet_id", walletId).order("token_value_usd", desc)` ([useOwnershipTokens.ts:91-95](src/hooks/useOwnershipTokens.ts:91)).
- **Realtime**: `supabase.channel('ownership-tokens-changes').on('postgres_changes', { table:'ownership_tokens', filter:'wallet_id=eq.{walletId}' }, …)` handling INSERT/UPDATE/DELETE ([useOwnershipTokens.ts:40-69](src/hooks/useOwnershipTokens.ts:40)). **Django has no realtime channel** — repoint = fetch on mount + on action (or poll); realtime is a deliberate downgrade to a refresh model.
- Totals: `totalValue` (Σ token_value_usd), `totalTokens` (Σ token_amount) ([useOwnershipTokens.ts:77-82](src/hooks/useOwnershipTokens.ts:77)).

Rendered by `TokenHoldings.tsx`: `property_name`, `token_symbol`, `token_amount`, `token_value_usd`, `ownership_percentage.toFixed(4)%` (the CORRECTED figure), `total_distributions`, status badge ([TokenHoldings.tsx:204-238](src/components/portfolio/TokenHoldings.tsx:204)). ⚠️ Status badge handles `active | locked | pending` ([TokenHoldings.tsx:170-188](src/components/portfolio/TokenHoldings.tsx:170)) but our model's `OwnershipToken.status` choices are `active | sold` — `sold/locked/pending` mismatch (cosmetic; default → no badge).

### 1.3 `src/components/portfolio/WalletSection.tsx` — the full wallet/KYC UI flow

Reached via **Portfolio → "Wallet" tab** ([Portfolio.tsx:214](src/pages/Portfolio.tsx:214), [Portfolio.tsx:370-372](src/pages/Portfolio.tsx:370)). Consumes `useUserWallet` ([WalletSection.tsx:33-44](src/components/portfolio/WalletSection.tsx:33)).

- **KYC card** ([WalletSection.tsx:155-186](src/components/portfolio/WalletSection.tsx:155)): subtitle *"Verification required before wallet creation"* ([:166-170](src/components/portfolio/WalletSection.tsx:166)); badge via `getKycStatusBadge` (approved/submitted="Under Review"/rejected/default="Not Verified") ([:80-120](src/components/portfolio/WalletSection.tsx:80)). **"Submit KYC"** button only when `!kycStatus || status==="pending"` ([:176-185](src/components/portfolio/WalletSection.tsx:176)) → `handleSubmitKyc` → `submitKyc()` ([:67-74](src/components/portfolio/WalletSection.tsx:67)).
- **Wallet card** ([WalletSection.tsx:188-292](src/components/portfolio/WalletSection.tsx:188)):
  - If `wallet` exists → show `wallet_address` (masked), `network`, `wallet_type`, explorer links ([:208-260](src/components/portfolio/WalletSection.tsx:208)).
  - Else if `kycStatus?.status === "approved"` → **"Create Wallet"** button ([:264-277](src/components/portfolio/WalletSection.tsx:264)) → `handleCreateWallet` → `createWallet()`.
  - Else → *"Please complete KYC verification first to create your wallet"* ([:279-287](src/components/portfolio/WalletSection.tsx:279)).
- **Token holdings**: `<TokenHoldings walletId={wallet.id} />` when wallet exists ([:295-297](src/components/portfolio/WalletSection.tsx:295)).
- **Transactions card** ([:304-364](src/components/portfolio/WalletSection.tsx:304)): renders `tx_type` (receive/send), `tx_hash`, `amount`, `token_symbol`, explorer link.

**Structural dead-end:** Create Wallet requires `status==="approved"`, but the only KYC action sets `"submitted"`. So through the UI alone, the user can never create a wallet.

### 1.4 `src/pages/Onboarding.tsx` — standalone mock wizard (persists NOTHING)

- Multi-step (5 steps non-investor / **6 steps investor**) ([Onboarding.tsx:107-117](src/pages/Onboarding.tsx:107)): role → (investor) tier → personal info → documents → agreements → security/2FA.
- On final "إرسال الطلب" (Submit): `handleNext` just `setVerificationStatus("pending")` ([Onboarding.tsx:154-161](src/pages/Onboarding.tsx:154)) — **no Supabase, no API, no upload**. Documents are `File` objects held in local state ([:88-94](src/pages/Onboarding.tsx:88)), never sent anywhere.
- Local-only verification screen states: `pending | approved | rejected | info_required` ([:105](src/pages/Onboarding.tsx:105), [:170-249](src/pages/Onboarding.tsx:170)) — note `info_required` is an extra state NOT in the Supabase `kyc_status` enum.
- Hardcoded Arabic strings (not i18n) — a self-contained flow disconnected from `user_kyc` and from `WalletSection`'s KYC.

### 1.5 Already migrated (NOT part of this gap)

- `useCertificates.ts` + `VerifyCertificate.tsx` were repointed Supabase→Django in Wave 3
  (`certificatesApi`). Listed only to scope it out.

---

## 2. WHAT KYC DATA THE FRONTEND COLLECTS / EXPECTS

From `Onboarding.tsx` (the richest KYC surface, even though it persists nothing):

**Personal info** ([Onboarding.tsx:76-86](src/pages/Onboarding.tsx:76)): `firstName, lastName, email, phone, dateOfBirth, nationality, country, city, address`.

**Investor tier** ([Onboarding.tsx:48-52](src/pages/Onboarding.tsx:48)): `individual` ($1k–50k), `qualified` ($50k–500k), `institutional` ($500k+).

**Documents** ([Onboarding.tsx:88-94](src/pages/Onboarding.tsx:88)): `idFront` (req), `idBack` (opt), `selfie` (req), `proofOfAddress` (opt), `companyDocs` (owner/developer only). Accept `image/*` (+ `.pdf` for proof/company); selfie uses `capture="user"`.

**Agreements** ([Onboarding.tsx:96-102](src/pages/Onboarding.tsx:96)): `terms, privacy, aml` (req), `riskDisclosure` (req for investor), `investorDeclaration` (optional).

**Security**: 2FA toggle ([Onboarding.tsx:104](src/pages/Onboarding.tsx:104)) — UI only.

**Per-status UI** (the screens the user expects, [Onboarding.tsx:170-249](src/pages/Onboarding.tsx:170)):
- `pending` → "طلبك قيد المراجعة" / "Under review", ETA "1–3 business days".
- `approved` → "تم التحقق بنجاح" → CTA to Marketplace.
- `rejected` → "لم يتم قبول الطلب" → re-submit.
- `info_required` → lists missing docs (clearer ID, recent proof of address) → re-upload.

`WalletSection` shows a simpler KYC badge set (Not Verified / Under Review / Approved / Rejected).

**Provider references:** none. Grep for `sumsub|onfido|jumio|veriff|websdk|applicant` → **no matches**. All KYC UI is custom forms; there is no provider SDK or hosted-flow embed to preserve.

---

## 3. OUR BACKEND SIDE (what exists to connect to)

### 3.1 The gate
- `apps/core/permissions.py` **`KYCApprovedPermission`** ([permissions.py:79-95](backend/apps/core/permissions.py:79)) — `has_permission` returns **`False`** (always-deny). TODO in-code: replace with `kyc = getattr(request.user, "kyc", None); return bool(kyc and kyc.status == "approved")` ([permissions.py:87-89](backend/apps/core/permissions.py:87)). Applied to wallet creation via `permission_classes = [IsAuthenticated, KYCApprovedPermission]` ([apps/wallets/views.py](backend/apps/wallets/views.py) `WalletCreateView`).

### 3.2 Endpoints we built (shapes)
- `POST /api/wallets/` (KYC-gated, idempotent) → `UserWalletSerializer`: `{ id, wallet_address, network, wallet_type, created_at }`. 403 today.
- `GET /api/wallets/me/` → same shape, or 404 if none.
- `GET /api/wallets/{wallet_id}/tokens/` (owner-only) → `OwnershipTokenSerializer` list (matches §1.2 shape exactly).
- `POST /api/investments/{id}/mint/` (owner, idempotent) → `{ success, investment_id, tokens_minted, tx_hash?, pending_reason? }`.
- `manage.py dev_grant_wallet --email <e> [--revoke]` — DEBUG-only wallet provisioning bypass (the testing pattern to mirror for KYC).

### 3.3 What's MISSING for investor KYC (must be built — SPEC §3.4)
- **`UserKYC`** model (apps/kyc stub is empty — [backend/apps/kyc/models.py](backend/apps/kyc/models.py)): `user` OneToOne, `status` (`pending|submitted|approved|rejected` — match Supabase enum [types.ts:1753](src/integrations/supabase/types.ts:1753)), `submitted_at, approved_at, rejected_at, rejection_reason`, timestamps. (+ a `related_name="kyc"` so `KYCApprovedPermission` resolves `request.user.kyc`.) Optionally store personal info + provider applicant id.
- **`KYCDocument`** model (SPEC §3.4 / [BACKEND_SPEC.md:310](BACKEND_SPEC.md:310)): FK `UserKYC`, `document_type, file, status, uploaded_at` — backs Onboarding's uploads if we keep self-hosted docs (Sumsub may make these optional).
- **KYC endpoints**: `GET /api/kyc/me/` (status), `POST /api/kyc/submit/` (create/advance to submitted; persist personal info + docs), and the **Sumsub webhook** receiver.
- **Wire `KYCApprovedPermission`** to `UserKYC.status == "approved"` (flip from always-deny).

---

## 4. SUMSUB INTEGRATION SHAPE (standard pattern — research only, do NOT integrate now)

Mirror the OAuth-keys-deferred approach: build the integration layer + webhook now, leave
API keys env-driven/blank so it's inert until provisioned.

**Standard Sumsub flow:**
1. **Applicant creation** (server→Sumsub): `POST /resources/applicants?levelName={LEVEL}` with `externalUserId = our user.id` → returns `applicantId`. Persist `applicantId` on `UserKYC`. Auth = `App-Token` header + HMAC request signature (`X-App-Access-Sig`/`-Ts` over `ts+method+path+body` with the secret key).
2. **Verification UX — two options:**
   - **WebSDK** (recommended): server issues a short-lived access token `POST /resources/accessTokens?userId={externalUserId}&levelName={LEVEL}` → frontend mounts the Sumsub WebSDK with it (handles capture/liveness/doc upload on Sumsub's side). Our `Onboarding` doc-capture UI becomes optional/secondary.
   - **API-only**: we keep our forms and upload docs to `POST /resources/applicants/{id}/info/idDoc`. More control, more work, weaker liveness.
3. **Webhook (the automation hinge)**: Sumsub calls our endpoint on `applicantReviewed` with
   `reviewResult.reviewAnswer = GREEN | RED`. We **verify the signature** (`X-Payload-Digest`,
   HMAC-SHA256 of the raw body with the **webhook secret**), then:
   - GREEN → `UserKYC.status = approved`, `approved_at=now` → the wallet gate opens automatically.
   - RED → `status = rejected`, `rejection_reason` from `reviewResult.rejectLabels`.
   - **No admin in the loop** (client's automation mandate; DECISIONS.md "KYC/KYB:
     provider-driven, automatic approval via webhooks. No manual approval.").
4. **Config (env-driven, deferred — blank = inert, like the OAuth keys):**
   `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_WEBHOOK_SECRET`, `SUMSUB_LEVEL_NAME`,
   `SUMSUB_BASE_URL` (`https://api.sumsub.com`).

**Dev / no-keys fallback (so we can test the gate before keys exist):**
- `manage.py dev_grant_kyc --email <e> [--reject|--revoke]` (DEBUG-only) that sets
  `UserKYC.status = approved` — the exact pattern of `dev_grant_wallet`. Lets us prove
  approved-KYC → Create Wallet → mint end-to-end without Sumsub.
- A **`KYC_AUTO_APPROVE` dev flag** (default off) could auto-approve on submit in DEBUG, to
  exercise the happy path in the UI. Production stays webhook-only.

---

## 5. THE POST-INVESTMENT CTA + PENDING MINT

`PaymentResultModal.tsx` on success:
- **"Go to Portfolio"** → `onGoToPortfolio` ([PaymentResultModal.tsx:160-163](src/components/checkout/PaymentResultModal.tsx:160)) = `Checkout.handleGoToPortfolio` → `navigate("/portfolio")`.
- **"Create Wallet & Receive Tokens"** (only when `!tokensMinted`) → plain `<Link to="/portfolio">` ([PaymentResultModal.tsx:164-170](src/components/checkout/PaymentResultModal.tsx:164)). **Just navigation — calls no wallet/mint function.**
- The yellow notice "Create wallet to receive tokens" appears when `tokensMinted === false` ([:97-106](src/components/checkout/PaymentResultModal.tsx:97)).

**Corrected behavior (build wave):** the CTA should be intent-aware —
- If `user.kyc.status === "approved"` and no wallet → call `POST /api/wallets/`, then
  `POST /api/investments/{id}/mint/` for the just-made (and any other `tokens_minted=false`)
  investment, then show minted state.
- If not KYC-approved → route to the **KYC flow** (not silently to /portfolio).
- If wallet already exists but tokens unminted → call the mint endpoint directly.
- The Portfolio "Wallet" tab should surface a **"Mint pending tokens"** action for any
  `tokens_minted=false` investments (today nothing triggers `POST /api/investments/{id}/mint/`).

---

## 6. PROPOSED PLAN (for the build wave — not built now)

**Backend (apps/kyc):**
1. `UserKYC` (OneToOne user, `related_name="kyc"`, status enum, timestamps, `sumsub_applicant_id`, optional personal-info fields) + `KYCDocument` (SPEC §3.4).
2. Endpoints: `GET /api/kyc/me/`, `POST /api/kyc/submit/` (persist info/docs, set `submitted`,
   create Sumsub applicant if configured), `POST /api/kyc/webhook/sumsub/` (signature-verified,
   GREEN/RED → approved/rejected).
3. Flip `KYCApprovedPermission` to check `request.user.kyc.status == "approved"`.
4. Sumsub service module (applicant create, access-token issue, HMAC signing) — env-driven,
   inert without keys. `dev_grant_kyc` management command for testing.
5. Admin: `UserKYC`/`KYCDocument` read views (no manual-approve action by default; automation
   mandate — but keep an admin exception path per the "admin is exception handler" principle).

**Frontend (repoint Supabase→Django, smallest change set):**
6. `useUserWallet.ts` → `walletsApi` (`/wallets/me/`, `/wallets/` create) + `kycApi`
   (`/kyc/me/`, `/kyc/submit/`); drop the `create-wallet` invoke and `user_kyc` writes. Fix the
   `bsc-testnet` explorer mapping.
7. `useOwnershipTokens.ts` → `GET /api/wallets/{id}/tokens/`; replace realtime with
   refresh-on-mount/action (+ optional poll). Reconcile token status vocab (`active|sold`).
8. `WalletSection.tsx` → unchanged structure; now KYC-approved comes from Django, Create
   Wallet hits `POST /api/wallets/`.
9. `Onboarding.tsx` → wire the wizard's final submit to `POST /api/kyc/submit/` (or mount the
   Sumsub WebSDK if WebSDK route chosen), and reconcile its `info_required` state.
10. `PaymentResultModal.tsx` / Checkout → intent-aware CTA + pending-mint wiring (§5).

**Order:** (1-3) models+gate+status endpoints → (4) Sumsub layer + dev approval → (6-8) wallet
+ holdings repoint (provable with `dev_grant_kyc` + `dev_grant_wallet`) → (9) KYC submit wiring
→ (10) CTA/mint fix → verify full journey on testnet.

---

## 7. OPEN QUESTIONS FOR THE PRODUCT OWNER

1. **Sumsub UX**: WebSDK (Sumsub-hosted capture/liveness — recommended, less PII for us) or
   API-only (keep our `Onboarding` forms, we upload docs)? This decides whether `KYCDocument`
   storage is primary or optional.
2. **Required documents per investor**: confirm the set — Onboarding implies ID front (req),
   ID back (opt), selfie (req), proof-of-address (opt). Is proof-of-address required for
   investors? Any accreditation doc for `qualified`/`institutional` tiers?
3. **Investor tiers**: are `individual / qualified / institutional` (with those $ bands) real
   policy that should gate investment limits, or marketing-only? Should KYC level depend on tier?
4. **Dev approval mechanism**: OK to ship a DEBUG-only `dev_grant_kyc` (mirrors
   `dev_grant_wallet`) and an optional `KYC_AUTO_APPROVE` dev flag, with production strictly
   webhook-driven?
5. **Investments made before a wallet exists**: auto-create the wallet + mint on KYC approval,
   or require the user to press "Create Wallet" then mint? (Today they stay `tokens_minted=false`
   until a manual mint.)
6. **`Onboarding.tsx` vs `WalletSection` KYC**: unify into one KYC entry point, or keep
   Onboarding as signup-time and WalletSection as the portfolio re-entry? (They use slightly
   different status vocabularies — `info_required` exists only in Onboarding.)
7. **Re-KYC / expiry**: any periodic re-verification requirement (Sumsub supports it), or
   one-time approval?
8. **Networks/explorer**: confirm wallets stay `bsc-testnet` for now (explorer mapping fix),
   and the mainnet cutover remains a separate audited step.
