# Capimax BRX — Locked Decisions

> Source of truth for all build agents. Frontend = primary spec. See BACKEND_SPEC.md.

## Architecture
- Backend: Python + Django + Django REST Framework. Greenfield (no data migration).
- Admin: Django admin is the sole back-office surface.
- DB: Postgres. Local via Docker; production on Hostinger VPS.
- Auth: SimpleJWT (access+refresh). OAuth: Google + Apple. Custom user model (email login, UUID pk).

## Governing principle (client mandate)
- AUTOMATION-FIRST: no human/admin intervention in approvals/verification/withdrawals
  EXCEPT where explicitly required. Admin is an exception handler.
- Full scope: every page/feature must be real and complete. Nothing dropped or deferred.
- SECURITY-FIRST: fintech with real money; enforce auth + object permissions server-side always.

## Role policy (CORRECTED — frontend is the source of truth)
Phase 1 wrongly assumed "everyone registers as investor; other roles admin-granted."
The product owner corrected this: the frontend genuinely lets users pick a role at
signup, and we follow it.

Frontend evidence:
- `src/pages/RegisterRole.tsx:21-27,45-184` — the role picker offers SIX roles:
  `investor, developer, owner, broker, lp, partner`. On continue it navigates to
  `/auth?mode=register&role=<id>` (`RegisterRole.tsx:194`).
- `src/pages/Auth.tsx:27,35,38` — reads `?role=`, keeps it in `selectedRole`, and
  shows a "Selected role" pill (`Auth.tsx:342-367`).
- The frontend frames verification as a REQUIRED step AFTER role choice:
  `RegisterRole.tsx:271-303` stepper ("Step 3 — Verify (KYC / KYB)"), per-role
  badges (`KYB Required`, `License Verified`, `KYC + Accreditation`, `By Application`),
  and the note "Verification requirements apply per Reg D / Reg S" (`RegisterRole.tsx:398-401`).
- PRE-EXISTING CONFLICT in the frontend: `Auth.tsx` (old line 85) and
  `AuthContext.tsx` (old line 44) deliberately did NOT send the role to `signUp`,
  with a comment "server always defaults to 'investor'." This was a Supabase-era
  constraint (the DB trigger hard-forced investor). The product owner has overruled it.

Implemented policy (backend `apps/core`):
- `Profile.role` now covers all six selectable roles + `admin`. Registration ACCEPTS
  and PERSISTS the user's selected role (`RegisterSerializer.role`, validated against
  `SELF_SELECTABLE_ROLES`). `admin` and unknown values are REJECTED (400), never
  silently granted.
- SECURITY guardrail (does not change frontend UX): `Profile.role_status` gates
  privileged-role CAPABILITIES. Selecting a privileged role
  (`developer/owner/broker/lp/partner`) stores the role but parks it at
  `pending_verification`; the role's powers go live only when verification flips it to
  `active`. Baseline `investor` is `active` immediately. Enforced for later domains via
  `core.permissions.HasActivatedRole`.
- Anti-escalation: `role` and `role_status` are read-only on every API serializer, so
  an EXISTING account can never self-elevate; only registration sets role (once) and
  only admin/staff change it afterwards (Django admin). Frontend change in Part C
  forwards `selectedRole` to the backend (`Auth.tsx`, `AuthContext.tsx`).
- Automation-first: `role_status` activation is intended to be driven by the KYC/KYB
  provider webhooks (see "KYC / KYB" below); admin flipping it is the exception path.

FLAGGED for product owner (security): if you want a selected privileged role to be
FULLY live immediately at signup (no verification gate), say so — but that would let
anyone self-grant owner/broker/developer/lp/partner powers (property submission,
commissions, LP-market access) with zero checks, which is unsafe for a fintech. The
gate above keeps the exact frontend UX while deferring powers until KYC/KYB.

## Payments
- Cards / fiat: Stripe. (FLAG: Stripe payout coverage weak in KSA — confirm fallback if audience is Saudi.)
- Crypto: NOW Payments (API + IPN webhooks).
- Automatic withdrawals: yes, but behind an AUTOMATED risk/limits layer (velocity, holds, screening) — not zero-control.

## Nova / Pronova
- Pronova (PRN): pegged 1 PRN = 1 USD. Issued by Nova Digital Finance (sister company, Capimax Group).
- Pronova checkout = user pays with Nova-issued Sukuk certificate.
- Flow: MANUAL — user uploads signed Sukuk cert + reference number → ADMIN reviews/approves → tokens minted.
  (Client-confirmed manual via the "Nova Sukuk — submit document" screen, overriding automation default for this path only.)
- BLOCKING for payment phase: need Nova integration/API docs OR confirmation manual review is final.

## Blockchain (Phase 3+)
- REAL on-chain tokenization. Network: BSC (BNB Chain).
- Smart contracts: developed from scratch (security-token style, fractional property ownership).
- Custody: CUSTODIAL (platform generates/holds wallets on behalf of users), mirroring the frontend.
- RISK FLAGS: (1) custodial private-key management needs KMS/HSM + hot/cold separation, not DB storage.
  (2) Contracts MUST be audited before handling real funds. This is a separate workstream + budget line.

### Phase 3 — Wave 1 (Blockchain infrastructure / secure foundation) — LOCKED
Scope of this wave: the foundation only. NO user-money flows, NO minting on user
action, NO checkout/investments/certificates (those are Waves 2–3). Everything is
TESTNET-ONLY and UNAUDITED. Locked decisions:

- **One contract per property, via a factory (LOCKED).** `PropertyTokenFactory`
  deploys one `PropertyToken` per property — mirroring the per-property SPV so every
  property's contract comes from a single audited template and deployment is
  automated, not hand-rolled. (`backend/blockchain/contracts/`.)
- **Token model (LOCKED).** `PropertyToken` is an OpenZeppelin **ERC20 with
  `decimals() == 0`** (whole, indivisible $100 shares), a **fixed cap** = the
  property's `token_supply`, and mint restricted to **`MINTER_ROLE`** (the platform
  signer). 0 decimals chosen to match the platform's integer token economics
  (supply = total_value / 100; SPEC §7C.6) rather than 18-decimal divisibility.
- **Toolchain: Hardhat (LOCKED).** Node/npm are already used for the frontend, so no
  new runtime; Hardhat has first-class BSC support, a Mocha/Chai test suite (16 tests
  passing), and emits JSON artifacts (ABI+bytecode) that web3.py loads directly.
  Foundry would add a Rust toolchain used nowhere else. Solidity 0.8.24, optimizer on.
- **Custodial keys: encrypted at rest behind a KeyManager abstraction (LOCKED).**
  Private keys are NEVER stored in plaintext. `apps/wallets/keys.py` defines a
  `KeyManager` interface (`encrypt`/`decrypt` + `backend_id`); today's concrete
  backend is `FernetKeyManager` (authenticated encryption). The encryption key lives
  in the env (`WALLET_ENCRYPTION_KEY`), SEPARATE from the DB — a DB dump alone is
  useless. Backend is env-selected (`KEY_MANAGER_BACKEND`) so swapping to AWS KMS /
  HashiCorp Vault is a config change, not a caller rewrite (closes RISK FLAG (1)'s
  "not DB storage" path: DB holds only ciphertext; the secret is external).
- **Key material isolation (LOCKED).** `UserWallet` (public address, network,
  type) is a separate table from `WalletKeyMaterial` (ciphertext only). No serializer
  exposes key material; the admin shows wallet addresses + key METADATA only (never
  the ciphertext). Tests assert the private key never appears in API output, logs,
  `__str__`, or the DB as plaintext, and that ciphertext is unrecoverable without the
  env key.
- **Wallet creation is KYC-gated (LOCKED).** `POST /api/wallets/` requires
  `core.permissions.KYCApprovedPermission`, which stays always-deny (403 "KYC
  approval is required") until the KYC phase flips it — the endpoint is fully built
  and correct now, matching the frontend's create-wallet expectation (SPEC §4.1).
  Wallet generation is idempotent (max one custodial wallet per user).
- **Property ↔ contract link without changing the data room (LOCKED, FLAG).** The
  real deployment is recorded in NEW `TokenMetadata.deployment_*` fields
  (`deployed_contract_address`, `deployment_tx`, `deployed_at`, `deployment_chain_id`,
  `deployment_network`, `factory_address`). The existing data-room DISPLAY fields
  (`contract_address`, `network="Ethereum"`, `standard="ERC-1155"`, `explorer_url`)
  are deliberately LEFT UNCHANGED so a deployment never alters displayed UX silently.
  **FLAG for product owner:** surfacing the live BSC-testnet deployment in the data
  room (and reconciling the network/standard labels) is a separate, owner-approved
  step — endpoints/data are ready when you say go.
- **Mint is built but not wired (LOCKED).** `apps/chain/service.mint()` exists and is
  proven on-chain, but is NOT called from any user-facing flow in Wave 1; Wave 2
  wires it to a confirmed investment.
- **Python 3.14 compatibility (verified).** `web3`, `eth-account`, `cryptography`
  install with prebuilt cp314 wheels (no source builds). Node v24 runs Hardhat fine.
- **Standing RISK FLAGS (carried forward, unchanged): (1)** before mainnet, custodial
  keys must move to KMS/HSM with hot/cold separation — the KeyManager abstraction is
  the seam that makes this a backend swap. **(2)** the contracts MUST be professionally
  audited before any real funds. Both are separate workstreams/budget lines.

### Phase 3 — Wave 2 (Investment processing + minting) — LOCKED
Builds on Wave 1. Money flow is SIMULATED (real PSPs are the Payments phase);
token MINTING is REAL on-chain. Runs against the local EVM until the testnet deploy
lands. Locked decisions:

- **Token-economics policy (LOCKED, product-owner decided — fixes the old bug).**
  1. `token_price` is PER-PROPERTY (admin-set `Property.token_price`), never a hardcoded
     100. 2. `token_supply = total_value / token_price`, derived server-side
     (`Property._sync_derived`) — the SINGLE SOURCE OF TRUTH for a property's token count.
  3. Ownership % = `tokens_bought / token_supply * 100` — NEVER the old hardcoded
     `/1000`. 4. `TokenMetadata.total_supply` (+`tokenized_units`) is force-synced to
     `token_supply` on save and via a data migration (fixes the 5,000-vs-50,000 mismatch).
  5. Min = 1 token; max = the property's AVAILABLE tokens (supply − sold); over-purchase
     rejected (422). The old `MAX_UNITS=100` cap is removed. 6. `price_per_token` = the
     property's `token_price` at purchase time.
  - Worked example (proven live): a $10,000 buy (100 tokens) in a $5M / $100-token
    property now records **0.2%** ownership, not the old **10%** (a 50× correction).
- **Investment processing (LOCKED).** `apps/investments` ports process-investment:
  `POST /api/investments/` (IsAuthenticated) inside `transaction.atomic()` with a
  per-property `select_for_update` lock (prevents overselling the fixed supply), the
  partial-unique `(user, property)` in-flight constraint, the 60s dedup guard, and a
  provisional `Certificate` with REAL property/SPV/fee data (NOT the old hardcoded
  "Dubai, UAE"/fee=0). Response: `{success, investment_id, tokens_minted,
  certificate_generated}`.
- **⚠️ Payment is SIMULATED (FLAG).** `create_investment` marks payment completed with
  NO real charge — a real PSP (Stripe / NOW Payments) integrates in the Payments phase
  (clearly marked with a TODO in `apps/investments/services.py`). We never pretend money
  moved.
- **Minting is REAL on-chain (LOCKED).** `apps/investments.mint_investment` uses the
  Wave 1 chain layer to mint `token_amount` shares (1 token = 1 share) to the user's
  custodial wallet on the property's deployed PropertyToken. It records `OwnershipToken`
  (race-safe additive upsert via `select_for_update`) + a `WalletTransaction` with the
  REAL tx hash/block, and sets `tokens_minted`/`minted_at` only AFTER a confirmed receipt,
  inside `transaction.atomic()`. `POST /api/investments/{id}/mint/` is owner-only +
  idempotent. `GET /api/wallets/{id}/tokens/` lists positions (owner-only).
- **Never a fabricated tx (LOCKED).** If the property's contract isn't deployed on the
  connected chain (testnet deploy still pending), mint returns a clear PENDING state and
  writes NOTHING — no fake hash, no phantom OwnershipToken. The dev/local-EVM path mints
  for real on a local node; the chain is selected purely by env.
- **Frontend (the approved exception, smallest change set).** `Checkout.tsx` now reads
  the REAL property via the Phase-2 API (`token_price`, `token_supply`, fees), computes
  `amount = tokens × token_price`, caps the selector at `token_supply` (authoritative
  available-check is server-side → 422), and POSTs to `/api/investments/`. The inline
  2-property table, the `/1000` ownership, and `MAX_UNITS=100` are gone. `useInvestment`
  + `investmentsApi` repointed from Supabase to Django. UI/UX unchanged.
  - `TokenHoldings.tsx` / `CertificatesSection.tsx` render the persisted
    `ownership_percentage` verbatim (no client-side math) → they show the corrected
    figure by construction. FLAG: they still read via the Supabase client; migrating the
    portfolio READ path to `GET /api/wallets/{id}/tokens/` is a small follow-up (gated
    behind KYC-wallet + on-chain mint anyway).
- **FLAG — installment checkout deferred.** `Checkout.tsx` now performs a full token
  purchase; the installment down-payment SPLIT at checkout is a LATER flow (out of Wave 2
  scope) and the real per-property installment terms aren't in the API yet. The
  `DynamicInstallmentPlanner` payment-progress metric is untouched (a correct, separate
  concept). Recommend the owner decide whether to hide the installment checkout entry
  until that flow is built.
- **FLAG — `tokenized_units` semantics.** Forced equal to `token_supply` (data-room shows
  "fully tokenized"). If the owner later wants it to mean "minted so far", that's a
  separate, easy change.
- **DEV-ONLY wallet provisioning (testing aid, does NOT weaken the KYC gate).**
  `manage.py dev_grant_wallet --email <e> [--revoke]` creates/revokes a custodial wallet
  by calling the wallet SERVICE directly, bypassing the (not-yet-built) KYC gate so the
  team can test invest→mint before KYC ships. **Refuses to run unless `DEBUG=True`** and
  is clearly labelled DEV-ONLY; the production `KYCApprovedPermission` (always-deny) is
  untouched. Used to prove a real on-chain mint on BSC Testnet for property "1": invest
  via card → auto-mint → `PropertyToken(0xb033Fa0ab2393F6e336B98e67DB24F86f0310dBF)`
  `totalSupply` went 0 → 2 (tx
  `0x538a91da1823aed6203090ce3e019d2be6890903c596f4fea080fc9abdb043bf`, chain 97).
  Diagnosis of the owner's "Payment Failed": the `/api/investments/` API is healthy
  (201 for card/pronova when authenticated; 401 when not). The failure was a client-side
  AUTH/session issue (no valid Django JWT) — NOT the KYC gate (that returns success with
  `tokens_minted=false`) and NOT a backend bug. Separately, the Pronova MANUAL Sukuk
  flow (upload cert → admin approve) is not yet wired — Pronova currently routes through
  the standard simulated payment; building the manual flow is a later (Payments-phase) item.

### Phase 3 — Wave 3 (Certificates: PDF + QR + public verification) — LOCKED
Makes the Wave-2 provisional certificate records real. Ports generate-certificate
(SPEC §4.1) and verify_certificate (SPEC §4.2). **This CLOSES Phase 3 (investor core:
investments, wallets, tokens, certificates).**

- **PDF engine: ReportLab (LOCKED).** Pure-Python, no system libraries — chosen over
  WeasyPrint (needs cairo/pango, painful on Windows). Single-page canvas layout in
  `apps/certificates/pdf.py`. Installs with prebuilt cp314 wheels on Python 3.14.
- **Real QR (LOCKED).** `qrcode` + Pillow render a real scannable QR encoding the public
  verify URL `{FRONTEND_URL}/verify/{verification_code}` (the old edge function only drew
  a placeholder box). `FRONTEND_URL` now defaults to the Vite origin `:8080`.
- **All data from REAL records (LOCKED).** Certificate fields come from the actual
  Property/Investment/SPVRecord — real location, SPV name + registration, and platform
  fee (= `Property.fee_platform` × amount). NEVER the old hardcoded "Dubai, UAE" /
  fee=0 / "<name> SPV Ltd". Header uses the real platform name **CAPIMAX BRX** (matches
  the frontend), not the legacy "CAPIMAX RT". Ownership on the certificate is the
  CORRECTED figure from `token_supply` (e.g. 0.2% / 0.004%, never /1000).
- **Endpoints (LOCKED).** `POST /api/certificates/generate/` (owner, idempotent — returns
  existing PDF if present), `GET /api/certificates/` (owner list, SPEC §2.3),
  `GET /api/certificates/{id}/pdf/` (owner-only authenticated download — never another
  user's), `GET /api/certificates/verify/{code}/` (**PUBLIC**, `AllowAny`,
  `authentication_classes=[]`).
- **Public projection is curated (LOCKED, security).** `CertificatePublicSerializer`
  exposes ONLY non-sensitive fields (cert id/status, investor name + masked id, SPV,
  property, amounts, dates, ownership, signatory, signature hash, verification
  code/url, revocation reason). It deliberately OMITS the internal UUID `id`, the owning
  user/email, `pdf_path`/`pdf_url`/`pdf_file`, `qr_code_data`, and the investment FK —
  asserted absent by tests. SPEC §4.2.
- **Storage / download (LOCKED + FLAG).** PDFs persist via a `FileField`
  (`certificates/%Y/%m/`); downloads go through an AUTHENTICATED endpoint (owner-checked)
  rather than signed URLs — effectively long-lived for the owner, no expiry to manage.
  S3/MinIO can back the same `FileField` later (config-only). The old signed-URL expiry
  is intentionally replaced by the auth-gated endpoint.
- **Tamper-evidence (LOCKED).** `digital_signature_hash` = SHA-256 over the certificate's
  material fields, printed on the PDF and shown on the verify page.
- **finalize transition (wired, FLAG).** `Certificate.mark_final()`
  (provisional→final + `finalized_at`) is wired; the trigger is a CONFIRMED real payment,
  which lands in the Payments phase. Admin has a **revoke** action (SPEC §3.3).
- **Frontend (smallest change set).** `certificatesApi` added to the api client;
  `useCertificates` (list/generate/download) and `VerifyCertificate.tsx` (public verify)
  repointed from Supabase to Django. `CertificatesSection` unchanged (renders the hook).
  UI visually unchanged; ownership shows the corrected figure. Verified live: generate →
  download PDF (valid `%PDF`) → public `/verify/{code}` page resolves and shows the cert.
- **FLAG — portfolio token holdings read path** (`TokenHoldings`/`useOwnershipTokens`,
  `useUserWallet`) still uses the Supabase client; migrating those reads to the Django
  wallet/token endpoints is the remaining small follow-up (gated behind KYC-wallet anyway).

> **Phase 3 is COMPLETE** — investor core delivered end-to-end: blockchain infra
> (Wave 1, live on BSC Testnet), investment processing + real on-chain minting + corrected
> token economics (Wave 2), and certificates with PDF/QR/public verification (Wave 3).
> Standing flags carried forward: simulated payment (Payments phase), contract audit +
> KMS/HSM before mainnet, and the portfolio-read + installment-checkout follow-ups.

#### DONE — Live BSC-Testnet deployment proof (closed 2026-06-10)
- **[x] Live BSC-Testnet deployment proof — COMPLETE.** The deployer
  (`0xd442bEbCF95726295651107D6E86e7CBF626e320`) was funded with testnet BNB and the
  pipeline was proven on **real BSC Testnet (chain id 97)**:
  - **PropertyTokenFactory:** `0xff92855263344C6Bb808fDCBb67D9Af39ed14bAc`
    (tx `0x02415d6decc322c6d9a2d033b97efe778a434295486bfbeea0d9740c237efa99`) —
    <https://testnet.bscscan.com/address/0xff92855263344C6Bb808fDCBb67D9Af39ed14bAc>
  - **PropertyToken for slug "1" (Marina Bay Tower), maxSupply 50,000:**
    `0xb033Fa0ab2393F6e336B98e67DB24F86f0310dBF`
    (tx `0x6c1c37055a6f0a9a7e28b8def307b3d9e3a6ea3fba240334b426d700e368e037`) —
    <https://testnet.bscscan.com/address/0xb033Fa0ab2393F6e336B98e67DB24F86f0310dBF>
  - On-chain verified: `maxSupply == 50000`, `totalSupply == 0` (foundation; no mint on
    user action). Recorded on `Property("1").TokenMetadata` deployment_* fields
    (chain_id 97, network bsc-testnet); the data-room DISPLAY fields were left
    untouched. The factory address is in `backend/.env` (`PROPERTY_TOKEN_FACTORY_ADDRESS`).
  - **Only the factory + ONE property are deployed (pipeline proof).** Remaining
    properties are deployed on demand via `manage.py deploy_property_contract --slug <id>`
    or the Property admin action.
  - Mainnet remains gated on a professional contract audit + KMS/HSM key custody
    (standing RISK FLAGS above), unchanged.

## Phase 4 — Investor KYC + Wallet/Holdings Wiring (LOCKED — 2026-06-10)
Product-owner decisions for the next build wave. Territory map (with file:line citations)
in `KYC_WALLET_SURFACE.md`. NOT yet built — these lock the design. The gap being closed:
the frontend's wallet/KYC/holdings layer still talks to Supabase, not our Django API; in-app
KYC is a status-flip with no approval path (user stuck at "Under Review").

1. **KYC is a PREREQUISITE for investing (LOCKED).** A user cannot invest before KYC is
   approved. `POST /api/investments/` REJECTS non-approved users with a machine-readable
   error; the frontend routes them to the KYC flow gracefully. This **eliminates the
   pre-wallet pending-investment case** (no more `tokens_minted=false` backlog from investing
   before having a wallet). [Supersedes the Phase-2 note that "Checkout assumes 1000
   tokens"; and tightens Phase 3, where investing was allowed without KYC/wallet.]
2. **KYC is ONE-TIME (LOCKED).** No expiry / no periodic re-KYC for now.
3. **Sumsub via WebSDK (LOCKED).** Sumsub-hosted capture/liveness → minimal PII on our
   servers. Build the integration layer + webhook NOW; keys are env-driven and **DEFERRED**
   (blank = inert, exactly like the OAuth keys): `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`,
   `SUMSUB_WEBHOOK_SECRET`, `SUMSUB_LEVEL_NAME`, `SUMSUB_BASE_URL`.
4. **Documents handled by the Sumsub level (LOCKED).** ID + selfie/liveness; **proof-of-address
   NOT required.** Our `KYCDocument` storage is optional/secondary (Sumsub holds the docs).
5. **Approval is AUTOMATIC via the Sumsub webhook (LOCKED).** `applicantReviewed` →
   GREEN → `UserKYC.status=approved`; RED → `rejected` (reason from reject labels). Signature-
   verified (HMAC, `X-Payload-Digest`). **No admin in the normal path** (automation mandate).
   For testing before keys exist: a **DEBUG-only `dev_grant_kyc`** management command
   (mirrors `dev_grant_wallet`) + an optional **`KYC_AUTO_APPROVE`** dev flag (default off).
   Production is strictly webhook-driven.
6. **On KYC approval: AUTO-CREATE the custodial wallet (LOCKED).** No manual "Create Wallet"
   press. Minting stays at PURCHASE time into the existing wallet (as in Phase 3) — combined
   with decision #1, every investment mints immediately (no pending-mint state in the happy path).
7. **UNIFY the KYC entry point (LOCKED).** Merge `Onboarding.tsx` and the `WalletSection`
   KYC card into one flow (today they use different status vocabularies — `info_required`
   exists only in Onboarding; canonical enum is `pending|submitted|approved|rejected`).
8. **NO investor tiers / investment limits (LOCKED).** Not built, not enforced, not surfaced
   (tiers aren't shown in the live frontend). Max investment stays **"available tokens in the
   property"** (Phase 3). *Open client question, NON-BLOCKING:* whether any legal tier-based
   limits are required in their market — recorded for later; **building limit-free now.**
9. **Network stays `bsc-testnet` (LOCKED).** Fix the explorer-mapping bug in
   `useUserWallet.getExplorerUrl` (map keys on `bsc` but wallets store `bsc-testnet` → links
   currently fall back to Etherscan).

To build (per `KYC_WALLET_SURFACE.md` §6): `apps/kyc` → `UserKYC` + `KYCDocument` (SPEC §3.4),
`GET /api/kyc/me/`, `POST /api/kyc/submit/`, `POST /api/kyc/webhook/sumsub/`; flip
`KYCApprovedPermission` to check `request.user.kyc.status=="approved"`; repoint `useUserWallet`
/ `useOwnershipTokens` Supabase→Django; auto-create wallet on approval; KYC-gate the investment
endpoint; fix the post-investment CTA.

### Phase 4 — DELIVERED (2026-06-14)
**Backend (`apps/kyc`):** `UserKYC` (OneToOne `related_name="kyc"`, status
`pending|submitted|approved|rejected`, timestamps, `sumsub_applicant_id`, optional personal
info) + `KYCDocument` (secondary). Endpoints: `GET /api/kyc/me/`, `POST /api/kyc/submit/`,
`POST /api/kyc/access-token/` (WebSDK token; **503 + `kyc_provider_unconfigured`** when keys
blank), `POST /api/kyc/webhook/sumsub/` (PUBLIC, **HMAC-signature-verified**; GREEN→approved,
RED→rejected). `apps/kyc/sumsub.py` = applicant-create / access-token / request-signing /
webhook-verify, **inert when blank** (5 env vars). `apps/kyc/services.approve_kyc` is the single
hinge (webhook / dev / auto / admin all converge) and **auto-creates the wallet on approval**
(idempotent, on a `transaction.on_commit`). `KYCApprovedPermission` flipped to
`request.user.kyc.status=="approved"`. `POST /api/investments/` rejects non-approved with
**403 `{code:"kyc_required"}`**. Added `GET /api/wallets/{id}/transactions/` so the UI tx card
shows the REAL mint receipt. DEBUG-only `dev_grant_kyc` (`--reject`/`--revoke`) +
`KYC_AUTO_APPROVE` flag (DEBUG only); admin has labelled **EXCEPTION** approve/reject actions
(no default approve). **No investor tiers/limits built.**

**Frontend (Supabase→Django repoint):** `client.ts` gained `kycApi` + `walletsApi`;
`useUserWallet` / `useOwnershipTokens` now read Django (`/kyc/me/`, `/wallets/me/`,
`/wallets/{id}/tokens|transactions/`), realtime → refresh model, **explorer mapping fixed**
(`bsc-testnet` → `testnet.bscscan.com`). New unified `KycVerification` component (Sumsub WebSDK
loaded lazily from the hosted script — **no npm dep**; dev fallback shows the `dev_grant_kyc`
path) used by BOTH `WalletSection` and `Onboarding` (one entry point). `Checkout` +
`PaymentResultModal`: **KYC-before-invest** gating (proactive notice + route to KYC, backstop on
the `kyc_required` code) and the misleading "Create Wallet & Receive Tokens" CTA replaced with
"View Wallet & Token Status" → `/portfolio?tab=wallet`. `TokenHoldings` reconciled `sold` badge.

**Verified:** 102 backend tests green (17 new KYC). Live BSC-Testnet journey via the dev path:
register → `dev_grant_kyc` → wallet auto-created (`0xB78e…608D`) → invest property "1" → REAL
on-chain mint (tx `0x9f557ef6…`, block 113334284, chain 97) → holdings 1 BRX1 @ 0.0020% shown in
the Portfolio Wallet tab from Django; non-approved invest blocked (`kyc_required`). Once Sumsub
keys land, the investor journey is fully self-serve (no dev bypass).

**Flagged / follow-ups (non-blocking):** (1) ~~`Onboarding.tsx` legacy investor **tier** step~~
and (2) ~~Onboarding's redundant manual document-upload step~~ — **RESOLVED 2026-06-14: the whole
`Onboarding.tsx` page was deleted** (see "Onboarding removed" below). (3) Pre-existing
`VerifyCertificate.tsx` TS `unknown` typing (Phase 3) is untouched.

### Onboarding removed + investor-tier concept eliminated (2026-06-14, LOCKED)
Product-owner decision: the `Onboarding` page is redundant (role is chosen at registration —
RegisterRole/Auth — and determines KYC vs KYB; identity verification runs through the Phase 4
Sumsub WebSDK flow, not Onboarding). **Removed entirely:** deleted `src/pages/Onboarding.tsx`,
removed its import + `/onboarding` route from `src/App.tsx`, tidied the `KycVerification.tsx`
doc comment. `/onboarding` now falls through to the SPA `NotFound` (404) route.
**Investor tiers/levels (individual / qualified / institutional + $ bands) are removed entirely**
— that concept lived ONLY in Onboarding; there are **no tiers, no tier-based limits** anywhere
(frontend, API client, or backend). Max investment stays **"available tokens in the property"**
(Phase 3). NOTE: the separate `/institutional` *InstitutionalPackages* marketing page is a
different concept (fee-discount packages) and is **intentionally kept as-is** (out of scope). The
empty backend `apps.onboarding` domain stub is unrelated and untouched.

## Phase 5 Wave 1 — Real payments: STRIPE (card) — DELIVERED (2026-06-14, LOCKED)
Replaces the SIMULATED payment for the **card** method with real Stripe processing. Money
flows to the CLIENT's Stripe account directly (we don't custody funds). NOW Payments (crypto)
is **Wave 2**; Pronova/Sukuk keep their manual flows; Apple/Google Pay untouched.

**Non-negotiable safety (real money) — all enforced:**
1. **Raw card data NEVER touches our server.** The browser uses **Stripe Elements** (`CardElement`)
   so PAN/CVV go browser→Stripe directly; the backend only ever sees a PaymentIntent id. The old
   demo PAN/CVV form was deleted. (Verified: no `cc-number`/`cc-csc` inputs anywhere.)
2. **Minting is gated on the SIGNATURE-VERIFIED webhook, never a frontend success.** Card
   investments are created **PENDING** (no auto-mint); only `payment_intent.succeeded` (verified)
   completes the investment + triggers the Phase-3 on-chain mint.
3. **Webhook signature verification mandatory** — HMAC-SHA256 over `${t}.${raw_body}` vs the
   webhook secret (implemented manually in `stripe_service`, so it's testable without the lib).
   Bad/absent signature → 400, no state change.
4. **Idempotent** — unique `stripe_payment_intent_id` + Payment status guard + the already-
   idempotent `mint_investment`; a re-delivered webhook mints EXACTLY once.
5. **Keys DEFERRED** (inert when blank, like Sumsub/OAuth): `STRIPE_SECRET_KEY`,
   `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`. Built + tested against
   Stripe TEST MODE; create-intent/config return 503 / `configured:false` when unset and the UI
   degrades cleanly.

**Backend (`apps/payments`):** `Payment` model (investment FK, `stripe_payment_intent_id` unique,
amount/currency/status/provider — NO card fields). `stripe_service` (lazy-import intent creation,
manual webhook verify, `sign_payload` for tests/dev). Endpoints: `POST /api/payments/stripe/
create-intent/` (auth + KYC-approved), `GET /api/payments/stripe/config/`, `POST /api/payments/
stripe/webhook/` (PUBLIC, signed → complete + mint). `create_investment` branches: **card defers**
(`WEBHOOK_PAID_METHODS={"card"}`); other methods keep the interim simulated-complete this wave.
Added `GET /api/investments/{id}/` (owner) for status polling. DEBUG-only **`dev_confirm_payment`**
(mirrors `dev_grant_kyc`) simulates the succeeded/failed webhook so the cycle works before keys.

**Frontend:** chose **Stripe Elements (in-page)** over hosted-Checkout redirect to PRESERVE the
existing checkout UX. New `StripeCardCheckout` (Elements + `CardElement` + create-intent → confirm
→ poll until webhook completes); `CardPaymentForm` is now a secure notice (no inputs); `Checkout`
branches the card method only; `client.ts` gained `paymentsApi` + `investmentsApi.get`. Pronova/
Sukuk/crypto/Apple/Google UIs untouched (verified).

**Verified:** 115 backend tests green (13 new payments: create-intent auth+KYC, webhook
valid/failed/bad-sig/unconfigured, idempotency mints-once, no-card-data, card-defers). Full cycle
proven via the DEBUG webhook-simulate on **real BSC Testnet**: card invest → PENDING (no mint) →
`dev_confirm_payment` → payment succeeded + investment completed → REAL on-chain mint (tx
`0xae322069…`, block 113361868) → 1 BRX1 in holdings. In-browser: card method shows the secure
Stripe panel with no raw inputs (deferred-keys degrade since no keys), other methods unchanged.

**Flag:** non-card methods (crypto/Pronova/Sukuk) are STILL simulated-complete this wave — crypto
moves to real in **Wave 2 (NOW Payments)**, the same webhook-gated way; Pronova/Sukuk remain
bespoke manual flows.

## Phase 5 Wave 2 — Real payments: NOW PAYMENTS (crypto) — DELIVERED (2026-06-15, LOCKED)
Replaces the SIMULATED payment for the **crypto** method with real NOW Payments processing,
mirroring the Wave-1 Stripe architecture. Funds settle to the CLIENT's NOW Payments account
directly (we don't custody). Stripe/card (Wave 1), Pronova/Sukuk (manual), Apple/Google untouched.

**Non-negotiable safety (real money) — all enforced (identical to Wave 1):**
1. **Minting gated on the SIGNATURE-VERIFIED IPN, never the frontend.** Crypto investments are
   created **PENDING** (no auto-mint); only a terminal-success IPN (finished/confirmed) completes
   the investment + triggers the Phase-3 on-chain mint.
2. **IPN signature verification mandatory** — HMAC-SHA512 over the KEY-SORTED JSON body vs the IPN
   secret (`x-nowpayments-sig`), implemented manually in `nowpayments_service` so it's testable
   without the lib. Bad/absent signature → 400, no state change.
3. **Idempotent across the status sequence** — anchored on the unique `nowpayments_payment_id` +
   the Payment status guard + idempotent `mint_investment`. waiting→confirming→confirmed→finished
   with re-deliveries mints **EXACTLY once**; only terminal success mints.
4. **All terminal states handled** — finished/confirmed → success+mint; failed/expired/refunded →
   mark failed, no mint; partially_paid / in-flight → acknowledged, no mint (do not mint unless
   fully paid).
5. **Keys DEFERRED** (inert when blank): `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`,
   `NOWPAYMENTS_BASE_URL`, `NOWPAYMENTS_PRICE_CURRENCY`. create/IPN return 503 when unset; UI degrades.

**Backend (extended `apps/payments`):** `Payment` gained `provider='nowpayments'`,
`nowpayments_payment_id` (unique, the idempotency anchor) + public crypto fields
(`pay_currency`/`pay_address`/`pay_amount`) — still NO card/secret data. `nowpayments_service`
(lazy-import payment creation, manual HMAC-SHA512 IPN verify, `sign_ipn` for tests/dev). The
Stripe + NOW completion paths were refactored onto a shared `_complete_payment`/`_fail_payment`
core (one place for the Payment+Investment state + mint side-effect). Endpoints: `POST /api/
payments/nowpayments/create/` (auth + KYC-approved) → real deposit address/amount; `POST /api/
payments/nowpayments/ipn/` (PUBLIC, signed → complete + mint). `WEBHOOK_PAID_METHODS` now
`{"card","crypto"}` so crypto defers. DEBUG-only **`dev_confirm_nowpayments`** simulates the IPN.

**Frontend:** new `NowCryptoCheckout` (currency select → create investment pending → NOW create →
shows the REAL deposit address + exact amount + a **real QR** via `qrcode.react` → "waiting to
confirm" + poll `GET /investments/{id}/` until the IPN completes). `CryptoPayment.tsx` reduced to
a secure notice — the **hardcoded rates, static `0x7a23…` address, and placeholder QR are removed**.
`Checkout` branches the crypto method (shared `handlePspResult` with the card path); `client.ts`
gained `paymentsApi.createNowPayment`. Card/Pronova/Sukuk/Apple/Google untouched (verified).

**Verified:** 125 backend tests green (10 new NOW: create auth+KYC+unconfigured, IPN
finished→mint, failed/expired→no mint, bad-sig→400, idempotent-across-statuses mints-once,
partially_paid→no mint, crypto-defers; Stripe path unchanged). Full cycle via the DEBUG
IPN-simulate on **real BSC Testnet**: crypto invest → PENDING (no mint) → `dev_confirm_nowpayments`
(finished IPN) → payment succeeded + investment completed → REAL on-chain mint (tx `0xd0795b7a…`,
block 113365956) → 1 BRX1 in holdings. In-browser: crypto method shows the NOW notice + currency
selector + "Pay with crypto" (fake address/rates gone); the create flow degrades cleanly to the
deferred-keys notice (no keys); card method unaffected.

**Remaining for live:** real **Stripe** (Wave 1) + **NOW Payments** (Wave 2) keys for end-to-end
testing against the providers (test/sandbox then production). Both layers are inert until keys land.

## Phase 6 Wave 1 — Liquidity Provider onboarding (KYB + profile + wallet) — DELIVERED (2026-06-15, LOCKED)
Builds the LP onboarding domain: anyone can self-register as an LP, complete **KYB** (business
verification) automatically via Sumsub — mirroring investor KYC — and get an activated LP profile +
balance "wallet" + transactions + documents. The LP **secondary market** (`lp_holdings` /
`lp_market_listings`) is the NEXT wave and is deliberately NOT built here. Investor KYC, payments,
properties untouched.

**Locked decisions (automation-first):**
1. **LP activation is AUTOMATIC via Sumsub KYB** (business level), exactly like investor KYC — KYB
   GREEN → LP approved, **no manual approval**. Admin is an EXCEPTION handler only.
2. **Reuses the existing Sumsub layer + the SHARED `/api/kyc/webhook/sumsub/`**; KYB is distinguished
   by its business-level name (`SUMSUB_KYB_LEVEL_NAME`, env-driven, default `basic-kyb-level`). Keys
   DEFERRED / inert when blank. DEBUG-only **`dev_grant_kyb`** (`--reject`/`--revoke`) tests the
   journey before keys land (mirrors `dev_grant_kyc`).
3. **Frontend is the source of truth:** the new models + serializers mirror the
   `useLiquidityProvider.ts` interfaces EXACTLY (money fields emitted as JSON **numbers**, not
   decimal strings, so the hook's balance arithmetic works). The page/registration flow render unchanged.

**Backend (`apps/lp`, SPEC §3.8 / §2.7):** models `LiquidityProvider` (OneToOne user; status
pending|approved|rejected|suspended; KYB block not_started|documents_pending|under_review|approved
|rejected; bank+crypto payout; balances), `LPTransaction`, `LPDocument` (FileField + owner-only
download), `LPKYBDocument`. Endpoints: `GET/POST /api/lp/profile/` (apply, idempotent; 404→null),
`PATCH …/bank-details/` + `…/crypto-details/`, `GET …/transactions/`, `POST …/withdrawals/`
(balance-checked), `GET/POST …/documents/` + `…/{id}/` DELETE + `…/{id}/download/`,
`POST …/kyb/submit/` (→ under_review), `POST …/kyb/documents/`, `POST …/kyb/access-token/` (Sumsub
WebSDK; 503 when deferred). The **shared Sumsub webhook** was extended to route business/KYB
applicants → LP approval FIRST (lazy `try_handle_kyb_webhook`; resolves by KYB applicant id, or by
KYB level + externalUserId), falling through to investor KYC otherwise. Approval hinge
`services.approve_kyb` → LP approved + KYB approved + **activates the user's LP role**
(`profile.role_status` → ACTIVE when role==`lp`). New permission **`HasActivatedLP`** (reads the LP
record, status==approved) for the next wave's privileged LP actions. `sumsub.create_applicant`/
`issue_access_token` gained an optional `level_name`; `parse_review` now surfaces `level_name`.
Admin: read views + clearly-labelled EXCEPTION approve/reject (route through the same services),
`list_filter=(status, kyb_status)`. **No raw PII beyond what the form sends; no card/secret data.**

**Frontend (smallest change set):** `client.ts` gained `lpApi` (profile/apply, bank/crypto details,
transactions, withdrawals, documents upload+list+delete+download, kyb submit/documents/access-token)
with authed multipart + blob helpers. `useLiquidityProvider.ts` repointed Supabase → Django with the
**hook interface/shapes identical** (`LiquidityProvider.tsx` + `LPRegistrationFlow` unchanged). The
KYB flow stays the existing multi-step **form** (the active "dev path" until Sumsub KYB keys land);
the WebSDK access-token endpoint is wired and ready to take over when keys arrive. **LP market /
secondary-market UI (`useLPMarket`, `useLPHoldings` market logic) NOT touched** (next wave). Bilingual
EN/AR preserved.

**Verified:** 144 backend tests green (19 new LP: apply→pending + idempotent + 404-null; KYB
submit→under_review; shared webhook business-GREEN→approved+role-activated, RED→rejected, bad-sig→401
no-change, resolve-by-level, **investor KYC unaffected**; `dev_grant_kyb` approve+activate + revoke +
refuses-in-prod; withdrawal creates tx + insufficient→400; documents upload/list/delete owner-scoped
+ cross-LP isolation; KYB access-token→503 unconfigured). Frontend `tsc` clean. **LP dev journey ran
end-to-end** (API + browser): GET profile 404→null → apply → pending/not_started (`investment_amount`
a JSON number) → KYB submit → under_review → `dev_grant_kyb` → **approved + kyb_status approved +
role_status active** → `/liquidity-provider` renders the **approved LP dashboard from Django** (all 6
tabs, "Approved" badge, balances `$0` as numbers), `GET /api/lp/transactions/` 200, **no console errors**.

**Remaining for live:** real **Sumsub KYB** keys (business level) for end-to-end provider testing
(real WebSDK + the real `applicantReviewed` business webhook → LP activation). Layer inert until keys land.

## Phase 6 Wave 2 — LP secondary market (REAL on-chain settlement) — DELIVERED (2026-06-15, LOCKED)
The LP Market, fully on Django with **REAL on-chain token settlement**: investors list ownership
tokens (escrow-locked), approved LPs buy them, and the PropertyToken **transfers on-chain
seller→buyer custodial wallet**, settled against internal balances. Also builds the on-chain
**transfer capability** that did not exist before. Decision reference: SECONDARY_MARKET_SURFACE.md
(keep two markets; build LP market real; peer order book is a later wave). Investor peer market /
order book NOT built; payments/KYC/properties untouched.

**Locked decisions — all implemented:**
1. **REAL on-chain settlement** — `chain_service.transfer(token, from_account, to, amount)` signs
   with the **SELLER's custodial key** (decrypted via the KeyManager), submits, and waits for a
   confirmed receipt; returns the REAL tx hash/block. Never ledger-only, never a fabricated tx
   (mirrors the mint discipline). Custodial wallets start with 0 tBNB, so the deployer **tops up
   exactly the gas** for the one transfer before the seller signs (a 0-BNB sender makes
   `eth_estimate_gas` revert, so gas is funded FIRST, then the tx is built with an explicit gas
   limit). Mainnet would swap this for a funded relayer/gas-station — the seam is one helper.
2. **Escrow/lock on listing** — `OwnershipToken.locked_amount` reserves listed shares;
   available-to-trade = `token_amount − locked_amount`. Listing validates against the unlocked
   balance (can't double-list / over-list / move locked tokens); cancel/expire unlocks; a sale
   consumes the lock.
3. **Backend-configurable fee** — `settings.LP_MARKET_FEE_PERCENT` (default 1%, was hardcoded in
   the frontend). `platform_fee_amount` + `net_amount` computed server-side; changeable without a
   frontend deploy.
4. **Internal-balance settlement** — buyer LP pays from `LiquidityProvider.current_balance`
   (debited); seller's **net proceeds** credited to a new per-user **`UserBalance`** (+ a
   `BalanceTransaction` ledger), the withdrawable investor-side analogue of the LP balance. (The
   investor-withdrawal *endpoint* draws from this and is a later wave — flagged seam.)
5. **Bug fixed** — the old Supabase `purchaseAsset` marked a listing completed + created a holding
   but **never moved tokens on-chain nor debited the seller**. The Django flow really transfers the
   tokens and debits/credits balances **atomically** (proven on testnet below).

**Backend:** `apps/chain/service.py` `transfer()` + `_fund_gas_if_needed()`; `apps/wallets`
`OwnershipToken.locked_amount` + `available_amount`, new `UserBalance`/`BalanceTransaction` +
`credit_user_balance()` + `load_custodial_signer()` (decrypts the seller's key only transiently).
`apps/lp` `LPMarketListing` + `LPHolding` models (`db_table` `lp_market_listings`/`lp_holdings`,
shapes match the frontend); `market_services.py` (`create_listing` escrow-lock, `cancel_listing`
unlock, `purchase_listing` = the atomic on-chain settlement: check+debit LP balance, credit seller,
on-chain transfer under the row lock, consume escrow, **upsert BOTH OwnershipToken positions to
match the chain**, write two `WalletTransaction` "transfer" rows with the REAL hash, create the
`LPHolding`, complete the listing; idempotent — a replay sees `completed` and transfers **once**).
Endpoints: `GET/POST /api/lp/market/` (POST escrow-locks; GET returns `my_listings` always +
`listings` inventory **only for approved LPs**), `POST …/market/{id}/cancel/`,
`POST …/market/{id}/purchase/` (gated `HasActivatedLP`), `GET /api/lp/holdings/`,
`PATCH …/holdings/{id}/`. DEBUG-only **`dev_lp_market_cycle`** runs the real-testnet cycle. Admin
read views for listings/holdings/balances.

**Frontend (smallest change set):** `client.ts` `lpApi.market/listAsset/cancelListing/
purchaseListing/holdings/updateHolding`. `useLPMarket.ts` + `useLPHoldings.ts` repointed
Supabase→Django, **interfaces unchanged** (LPMarket.tsx renders as before); Supabase realtime →
focus/visibility refetch. `LPMarket.tsx` `handleResale` repointed (LP-resale → Django listing; the
**peer-secondary branch is flagged "coming soon"** — that market is the next wave). `ExitsHub.tsx`
LP read/cancel now hit Django (no longer gated on a Supabase session); its secondary tab stays empty
until the peer wave. Bilingual EN/AR preserved.

**Verified:** 157 backend tests green (+13: escrow lock/double-list/over-list/cancel-unlocks,
configurable-fee, purchase HasActivatedLP-only, debit/credit + on-chain transfer (mocked) + escrow
consume + holding + 2 transfer rows, idempotent replay transfers once, insufficient balance→402 no
transfer, can't-buy-own, inventory visible only to approved LPs, + 2 chain transfer guards). Frontend
`tsc` clean. **REAL BSC Testnet cycle run** via `dev_lp_market_cycle`: seller lists 1 token of
property "1" → approved LP buys → **on-chain transfer** tx
[`0xcc34bb5e…ad4e01`](https://testnet.bscscan.com/tx/0xcc34bb5e400852915c02af37bd47bd558e90621a2edfadcaac7bf6e636ad4e01)
(block 113502962): **seller on-chain 14→13, buyer 0→1**, LP balance debited 100, seller credited $99
(net of 1% fee); DB exactly matches chain (seller pos 13/locked 0, buyer pos 1, `UserBalance` $99,
listing completed, 1 holding, 2 transfer wallet-txs). In-browser as the approved LP: `/lp-market`
renders from Django ("Approved LP" badge, Marketplace + Holdings tabs, the real held position), no
console errors. Re-run again (2026-06-15) — tx
[`0x8103a166…993f9`](https://testnet.bscscan.com/tx/0x8103a16624523bbbfd11754a92b91b304cee977ad43635b048fbdae2e4a993f9)
(block 113552138, seller 12→11, buyer 1→2) — DB still matches chain exactly.

**Next waves:** (1) **investor PEER secondary market** — internal-balance settlement, investor↔
investor (the peer-secondary resale branch is flagged in `handleResale`/`ExitsHub` until then); then
(2) the **order book** (bids/asks/matching) the mock `SecondaryMarket.tsx` implies. Also pending: the
investor-withdrawal endpoint drawing down `UserBalance` (aligns with the LP withdrawal flow).

## Phase 6 Wave 3 — Investor PEER secondary market + investor withdrawal — DELIVERED (2026-06-15, LOCKED)
The investor↔investor peer market as REAL one-shot "buy-now" listings (NOT the order book — still
deferred), settled via internal balance + real on-chain token transfer, reusing the Wave-2 LP
foundation; PLUS investor withdrawal so sellers cash out proceeds (closing the Wave-2 gap). Decision
reference: SECONDARY_MARKET_SURFACE.md (keep two markets; build the peer market as listings first).
KYC, payments-for-investment, properties, and the LP market (beyond shared code) untouched.

**Locked decisions — all implemented:**
1. **Peer market = one-shot listings, investor↔investor.** Mirrors the LP market minus the
   approved-LP-only buyer gate: any **KYC-approved** investor can buy a whole listing.
2. **Settlement = internal balance.** Buyer pays from their `UserBalance` (debited); seller's
   `net_amount` credited to their `UserBalance`. Tokens **transfer on-chain seller→buyer** via the
   SAME seller-signed `apps.chain.transfer`. Atomic + idempotent; never ledger-only, never a fake tx.
3. **Escrow reuses `OwnershipToken.locked_amount` — SHARED with the LP market**, so a block listed
   on one market can't be listed on the other (single-market exclusivity falls out of the shared
   available-balance check; explicitly tested). Cancel unlocks; sale consumes.
4. **Fee = 0.5%, configurable** via `settings.SECONDARY_MARKET_FEE_PERCENT` (separate from the LP
   market's 1% `LP_MARKET_FEE_PERCENT`). Computed server-side.
5. **Investor withdrawal** draws down `UserBalance` (mirrors the LP withdrawal): debit + a pending
   `Withdrawal` record. Closes the Wave-2 gap (proceeds were credited but not withdrawable).
6. **KYC gate** on both list and buy (consistent with invest-requires-KYC).

**Backend:** `apps/secondary_market` `SecondaryMarketListing` (`db_table` `secondary_market_listings`,
§3.9 shape incl. `seller_type`/`buyer_type` investor|lp); `services.py` mirrors
`apps/lp/market_services` (create_listing escrow-lock + exclusivity, cancel_listing, purchase_listing
= atomic on-chain transfer + `UserBalance` debit/credit, idempotent) — reusing the LP market's
`_deployed_contract`/`_recompute_position` and the chain transfer. `apps/wallets` gained
`debit_user_balance()`, `request_withdrawal()`, and the `Withdrawal` model; endpoints
`GET /api/wallets/balance/`, `GET/POST /api/wallets/withdrawals/`. Peer endpoints:
`GET/POST /api/secondary-market/` (POST KYC-gated, escrow-locks), `POST …/{id}/cancel/`,
`POST …/{id}/purchase/` (KYC-gated), `GET …/trades/`. DEBUG-only **`dev_secondary_market_cycle`**
(list→buy→on-chain transfer→withdraw). Admin read view for listings + withdrawals.

**Frontend:** `client.ts` `secondaryMarketApi` + `walletsApi.balance/withdrawals/requestWithdrawal`.
`SecondaryMarket.tsx` **rewritten**: the 100% mock **order book + buy/sell "Create Order" panel was
REMOVED** (it had no backend) and replaced with a real one-shot-listings experience — browse real
inventory + **Buy Now**, **Sell My Units** (lists real ownership tokens, escrow-locked server-side),
**My Listings** (cancel), real **trade history**, plus a **proceeds-balance + Withdraw** surface
(new `useSecondaryMarket` hook). i18n keys preserved so the order book can return later. `ExitsHub`
secondary tab now reads/cancels the real `secondary_market_listings` via Django; the
LP-resale→secondary bridge (`handleResale`) now writes the real peer model. The elaborate existing
OTP `WithdrawalDialog` (a separate Supabase flow for a different balance) is intentionally untouched
— flagged. Bilingual EN/AR preserved.

**Verified:** 170 backend tests green (+13: peer escrow + **single-market exclusivity vs the LP
market**, configurable 0.5% fee, KYC-gated list/buy, purchase debit/credit + on-chain transfer
(mocked) + escrow consume + idempotent replay-once + insufficient→402 no-transfer + can't-buy-own,
investor withdrawal debits balance + records + insufficient→400). Frontend `tsc` clean. **REAL BSC
Testnet peer cycle** via `dev_secondary_market_cycle`: investor A listed 1 token of property "1" →
KYC investor B bought → **on-chain transfer** tx
[`0x3262041f…86870a`](https://testnet.bscscan.com/tx/0x3262041f35051820fe2a6c282631c15de5f916cd77b343f4cb5c834e9c86870a)
(block 113548034): **A on-chain 13→12, B 0→1**, B's `UserBalance` debited 100, A credited $99.50 net
(0.5% fee), A then **withdrew** $99.50 (`Withdrawal` WD-…, pending). DB matches chain (A 12/locked 0,
B 1, 2 transfer rows, listing completed buyer_type investor). In-browser: `/secondary-market` renders
real listings from Django (proceeds balance, Buy Now, Sell, Withdraw; **order book gone**), a KYC
buyer sees the inventory, no console errors. Re-run again (2026-06-15) — tx
[`0xd5d19347…3f44`](https://testnet.bscscan.com/tx/0xd5d193470b71c0a7c33ff36b7d257caaef87ca2972241af75273689c8f9f3f44)
(block 113552174, A 11→10, B 1→2, A withdrew $99.50 → `Withdrawal` WD-D95A7BD10E pending) — DB matches chain.

**Still deferred (separately-scoped):** the bid/ask **order book + matching engine** (price discovery,
partial fills) the mock implied — a later wave; the i18n keys + page structure are preserved for it.
The NEXT planned build is the **OWNER domain** (submit→review→publish + earnings/ledger), NOT the
order book.

## Phase 7 Wave A — Property Owner entity verification (owner KYB) — DELIVERED (2026-06-16, LOCKED)
**Scope (THIS wave only):** owner ENTITY verification via Sumsub KYB, mirroring the LP KYB flow
exactly. A user self-registers `role=owner` (RegisterRole.tsx "Property Owner" card → `?role=owner`,
distinct from `?role=developer`), applies, completes business KYB (a SEPARATE Sumsub level), and is
activated automatically — KYB GREEN → owner approved → `role_status` flipped ACTIVE, no admin in the
normal path. **NOT built here (later waves):** property submission intake (SubmitProperty.tsx made
real) + per-property title deeds, review→publish, owner earnings/ledger, the DEVELOPER role.

**LOCKED decisions (product-owner):** (1) owner ≠ developer — built OWNER only; (2) owner needs **KYB**
(the card "KYB + Title Docs" splits into entity-KYB here + a per-PROPERTY title deed at submission next
wave — **no title-doc fields on OwnerProfile**); (3) KYB is **automatic via Sumsub** (owner business
level), keys deferred/inert, `dev_grant_owner_kyb` to test before keys; (4) single role per user for v1;
(5) frontend is the source of truth.

**Backend (apps/owner, mirrors apps/lp):**
- `OwnerProfile` (OneToOne user, `related_name="owner_profile"`, db_table `owner_profiles`): contact +
  KYB block (`status` pending|approved|rejected|suspended; `kyb_status` not_started|documents_pending|
  under_review|approved|rejected; business_type/registration_number/tax_id/address/description;
  `sumsub_applicant_id`; kyb timestamps + reason). NO investor-tier/limit/payout fields; NO title docs.
- `services.py` — `approve_kyb` is the single automation hinge (idempotent; `select_for_update`;
  `transaction.on_commit(_activate_owner_role)` flips `role_status`→ACTIVE when `role==owner`);
  `reject_kyb`; `submit_kyb` (creates owner-level Sumsub applicant when configured, else inert);
  `try_handle_owner_kyb_webhook` + `_resolve_owner` (by applicant id, or owner-level + externalUserId).
- Endpoints (owner-scoped): `GET/POST /api/owner/profile/` (apply, idempotent), `POST /api/owner/kyb/submit/`
  (→ under_review), `POST /api/owner/kyb/access-token/` (Sumsub WebSDK token; **503** when keys deferred).
- **Shared webhook EXTENDED** (`apps/kyc/views.py`): owner routing tried first, then LP, then investor
  KYC fallthrough. Each resolver matches only its own table / Sumsub level name, so order is safe and
  investor KYC + LP KYB are unaffected (proven by regression + cross-claim tests). `SumsubWebhookView`
  now returns `domain: "owner"` for owner events.
- `core.permissions.HasActivatedOwner` (mirrors HasActivatedLP; reads `owner_profile.status=='approved'`)
  — gates the NEXT wave's submission to approved owners.
- `SUMSUB_OWNER_KYB_LEVEL_NAME` (env, default `owner-kyb-level`) — a SEPARATE level from the LP's so the
  shared webhook routes owner vs LP vs investor. `dev_grant_owner_kyb` (DEBUG-only, `--reject`/`--revoke`,
  refuses in prod). Admin `OwnerProfileAdmin` = EXCEPTION approve/reject only (automation-first).

**Frontend (smallest change set; mirrors lpApi/KycVerification):** `ownerApi` in client.ts
(profile/apply/submitKYB/kybAccessToken); `useOwnerProfile` hook; `OwnerVerificationCard` (apply →
business-info form → Start verification → Sumsub WebSDK when configured, else the dev-path notice with
`dev_grant_owner_kyb`), mounted at the top of `OwnerDashboard.tsx` (`/my-assets`). Bilingual EN/AR. The
dashboard's mock stats are untouched (later waves). No visible behavior change beyond the new KYB card.

**Verified:** `makemigrations`/`migrate` clean; **full suite 189 green** (was 170; +19 owner tests incl.
webhook owner-GREEN→approved+role-activated, RED→rejected, bad-signature→401-no-change, resolve-by-level,
owner-can't-see-another's-profile, `HasActivatedOwner` allow/deny, dev_grant approve/revoke/refuse-in-prod,
KYB access-token 503, **investor-KYC + LP-KYB unaffected / no cross-claim**). Frontend `tsc` clean for all
new files (only the pre-existing VerifyCertificate.tsx Phase-3 errors remain — governance (e)). **Dev-path
journey (real Postgres):** register `role=owner` (pending) → apply (201, pending) → `dev_grant_owner_kyb`
→ owner approved + `role_status=active` + `role_verified_at` set → GET profile = approved (then cleaned up).
**In-browser (`/my-assets`, authed owner):** the KYB card renders; filling the business form + Start
verification advanced KYB → under_review and (keys deferred) surfaced the dev-path notice with
`python manage.py dev_grant_owner_kyb --email <your-email>`; no console errors.

**NEXT wave = Owner property submission intake** (SubmitProperty.tsx made real + per-PROPERTY title deed,
gated by `HasActivatedOwner`), then **review→publish** (materialize a `Property` with `is_published=False`
→ flip on approval), then **owner earnings/ledger** (credit the owner on each completed primary sale via
`credit_user_balance`; reuse `UserBalance`/`Withdrawal`). The **DEVELOPER** role is a separate later domain
that will reuse this owner KYB pattern.

## Phase 7 Wave B — Property submission intake — DELIVERED (2026-06-16, LOCKED)
**Scope (THIS wave only):** make property submission real — `SubmitProperty.tsx` captures all fields +
documents (incl. the per-property **title deed**), persisting to Django `PropertySubmission` records gated
to APPROVED owners. **NOT built here:** review→publish (Wave C — NO `Property` is created/published in this
wave), owner earnings (Wave D), the investment-model picker (the form has none; admin assigns the model in
Wave C), the developer role, media persistence (images/video/tour — the form's Step-5 placeholders are
left as-is; the Wave-B model stores the fields + documents only — **flagged**, deferred).

**LOCKED decisions:** (1) only `HasActivatedOwner` (approved KYB) owners can submit — a non-approved owner
is routed to KYB gracefully (no raw 403); (2) NO investment-model field — admin assigns at review; store
only what the form collects; (3) the per-property **title deed** = `document_type=="title"` uploaded at
submission (the Step-4 required doc); (4) lifecycle `draft → submitted → under_review → approved → rejected`
— this wave implements **draft/submitted** only (under_review/approved/rejected are set by Wave-C); NO
Property published.

**Backend (apps/owner):**
- `PropertySubmission` (FK `submitter`, db_table `property_submissions`) — fields mirror SubmitProperty.tsx
  EXACTLY: name, property_type, construction_status, description; country, city, district, address;
  property_value_usd, min_investment, expected_yield, duration_years, distribution_model; `status`
  (draft|submitted|under_review|approved|rejected), `review_notes`, `submitted_at`. All content fields
  blank/nullable so a partial DRAFT saves. **No investment-model field.**
- `SubmissionDocument` (FK submission, db_table `submission_documents`) — `document_type` ∈
  {title, valuation, insurance, noc, financial, legal, other} (mirrors the Step-4 checklist ids), file +
  size. Mirrors the LP KYB document pattern (server-stored, owner-only download).
- `services.submit_submission` — draft→submitted; validates the **required** docs are present
  (`REQUIRED_SUBMISSION_DOC_TYPES` = title + valuation + legal, the form's `required:true` items); raises
  `MissingRequiredDocuments` (→ 400 `missing_required_documents` + the missing list). Idempotent. **Creates
  NO Property.**
- Endpoints — ALL `[IsAuthenticated, HasActivatedOwner]`, owner-scoped: `GET/POST /api/owner/submissions/`
  (list mine / create draft), `GET /api/owner/submissions/{id}/`, `PATCH` (edit **draft only** → 409
  `not_a_draft` otherwise), `POST .../{id}/submit/`, `POST/GET/DELETE .../{id}/documents/[{doc_id}/]` +
  `.../download/` (documents mutable **draft only**). Cross-owner access → 404 (owner-scoped lookup).
- Admin: `PropertySubmission` + `SubmissionDocument` READ views (inline docs) — the Wave-C review surface
  builds on this; **NO publish action yet**, created via API only.

**Frontend:** `ownerApi` extended (submissions CRUD + submit + document upload/list/delete in client.ts).
`SubmitProperty.tsx` made real — controlled state for every field the existing 6-step wizard shows; the
draft is lazily created on first Save/upload (then PATCHed); Step-4 Upload buttons do real
multipart uploads (show ✓ + filename); Save as Draft; Submit for Review (blocked client+server when
required docs missing, with the missing names); Step-6 confirm checkboxes gate submit. **KYB gate:** a
non-approved owner sees a "complete verification first" card → `/my-assets`, never a raw 403. The exact
6-step UI/fields are preserved; **no investment-model picker added**; English page kept (new gate/toasts
bilingual). `OwnerDashboard.tsx` assets list now reads `GET /api/owner/submissions/` (real submissions with
their status badge; the tabs filter the same list) — the mock earnings/stats cards are **left for Wave D
(flagged in-code)**.

**Verified:** `makemigrations`/`migrate` clean; **full suite 199 green** (was 189; +10 Wave-B tests:
gate allows approved / denies pending + non-owner; create draft; submit blocked w/o required docs →
succeeds with them; edit/doc-mutation draft-only; owner-scoped isolation; **NO Property row created**;
no investor/LP regression). Frontend `tsc` clean for all changed files (only pre-existing
VerifyCertificate.tsx errors remain). **In-browser journey (live backend, approved owner):** wizard renders
(KYB gate passed), draft created, submit **blocked** `missing_required_documents` → after uploading
title+valuation+legal **submitted** (submitted_at set), `/my-assets` shows "Browser Marina Tower" with the
**Submitted** badge; DB confirms the submission + 3 docs and **0 Property rows** named for it (catalog
untouched); a **pending** owner on `/submit-property` sees the KYB gate card (not the wizard); no console
errors. (Test data cleaned up after.)

**NEXT = Wave C (review→publish):** admin assigns the investment model + materializes a `Property`
(`is_published=False` → flip True on approval) + deploys the token (existing `deploy_token_contract`);
sets `under_review`/`approved`/`rejected` + `review_notes`. Then **Wave D = owner earnings/ledger**.

## Phase 7 Wave C — Review → publish pipeline — DELIVERED (2026-06-16, LOCKED)
**Scope (THIS wave only):** the ADMIN review pipeline that turns an approved `PropertySubmission` into a
real, **published** `Property` in the catalog the investor marketplace reads. **NOT built:** owner earnings
(Wave D), the developer role. The investor marketplace needed **NO change** — it already reads `Property`
where `is_published=True`.

**LOCKED decisions:** (1) **ADMIN reviews** each submission (no auto-publish — an investment property must
be human-reviewed; admin is the sanctioned reviewer here, not an exception handler); (2) the **admin assigns
the investment model** at review (the owner never picked one — the form has no picker); (3) on approval
materialize a Property with **`is_published=False` FIRST** (never the model's default True), let
`category`/`token_supply` auto-derive + `clean()` validate (0–100), **then flip `is_published=True`**;
(4) **link owner→Property** (for Wave-D crediting); (5) lifecycle `submitted → under_review → approved
(published) | rejected (review_notes)` — surfaced to the owner.

**Backend (apps/owner + apps/properties):**
- **Owner→Property link:** `Property.submitted_by` (FK user, **nullable** → existing admin-seeded catalog
  unaffected) + `PropertySubmission.published_property` (FK Property, null) + `reviewed_at`. Migrations are
  safe for existing rows (nullable). Wave D credits `Property.submitted_by` on primary sales.
- **`services.publish_submission(submission, *, model, overrides, nested, deploy, reviewer)`** — atomic:
  maps submission→Property fields via `_property_defaults_from` (+ admin `overrides`) with the assigned
  `model`; creates the Property **unpublished first** (`is_published=False`, `submitted_by=owner`);
  `_sync_derived()` + `full_clean()` validate economics & derive category/token_supply (raises
  `ValidationError` on bad data → atomic rollback, NO Property); creates the per-model nested record when
  `nested` given (installment/future/option/shared OneToOne); **then flips `is_published=True`**; optionally
  deploys the token (existing `apps/chain.deploy_property_token`); approves + back-links the submission.
  **Idempotent** — a submission already linked to a Property is returned unchanged (never double-publishes).
  `reject_submission(...)` → status rejected + `review_notes`, creates NO Property.
- **Admin review surface** (the sanctioned step) — `PropertySubmissionAdmin` actions **"Approve & publish
  (assign investment model)"** (intermediate form: pick model + refine the catalog fields the 6-step form
  never collected — Arabic copy, hero image, yield/risk/exit, country normalization — + a "deploy token"
  checkbox → runs `publish_submission`) and **"Reject (record notes)"**. Single-submission (each property
  needs its own fields). Template `admin/owner/review_submission.html`. Per-model nested detail beyond the
  simple path is added via the Property admin inlines after publish.
- **Owner-facing read:** `PropertySubmissionSerializer` now exposes `published_property_slug` + `reviewed_at`
  so `GET /api/owner/submissions/{id}/` shows approved (with the live property's slug) / rejected (+ notes).

**Frontend (smallest change set):** `OwnerDashboard.tsx` submission cards now show the outcome — **approved**:
a "Published to the marketplace" banner + **View listing** link to `/property/{published_property_slug}`;
**rejected**: the rejection reason. Reads the existing `GET /api/owner/submissions/`; layout unchanged.
The investor Marketplace/PropertyDetail were **verified, not modified** (they read the same Django catalog).
Bilingual EN/AR. Mock owner earnings/stats remain Wave D.

**Verified:** `makemigrations`/`migrate` clean (nullable links, safe for existing rows); **full suite 211
green** (was 199; +12 Wave-C: approval materializes exactly one Property is_published False→True; category/
token_supply auto-derive from the assigned model; `clean()` rejects bad economics (atomic, no Property);
owner→Property link set; **idempotent** (no double-create); draft can't publish; nested record created;
**published property visible in `GET /api/properties/` only after publish**; rejection creates no Property +
records notes; owner sees approved-slug / rejected-notes; **existing seeded property (no owner link) still
works**; the **admin actions** render the form then publish / reject — all green; no investor/LP/payments
regression). Frontend `tsc` clean for all changed files (only pre-existing VerifyCertificate.tsx errors).
**End-to-end (real Postgres + live marketplace API):** approved submission → `publish_submission` →
Property `wavec-…` (is_published True, category/token_supply derived, owner-linked), present in `GET
/api/properties/` (public, no auth) and the PropertyDetail page (renders the Arabic `name_ar`); a rejected
submission → no Property + notes shown to the owner; OwnerDashboard shows approved (View-listing link) +
rejected (reason); no console errors. (Test data cleaned up.)
- **Token contract DEPLOYED on-chain** to prove the deploy path end-to-end: tx
  [`0x3c8a6159…3916ab`](https://testnet.bscscan.com/tx/0x3c8a6159e48160837fd694a60733b5aeb66ab6b6205c7407d738bdf40a3916ab),
  token `0xDd0bDe3910e1Ff5bdaFc378B6DB8D70BCbe8459C` (same proven `deploy_property_token` path as the admin
  "deploy token" checkbox / existing admin action). That test property was cleaned up afterward (the
  testnet token is harmlessly orphaned under a unique random slug).

**NEXT = Wave D (owner earnings/ledger):** credit `Property.submitted_by` on each COMPLETED primary sale
(net of `fee_platform`/`fee_management`) via `credit_user_balance`; the owner withdraws via the existing
`UserBalance`/`Withdrawal` stack. The **DEVELOPER** role remains a separate later domain reusing Waves A–C.

## Phase 7 Wave D — Owner earnings / ledger + payout — DELIVERED (2026-06-16, LOCKED) → OWNER DOMAIN COMPLETE
**Scope (THIS wave only):** credit the property OWNER on each completed PRIMARY token sale of their
property (net of platform + management fees), reusing the `UserBalance`/`Withdrawal` stack, and wire the
owner wallet/earnings UI to real Django. **CLOSES the owner domain.** **NOT touched:** investor
distributions (separate mock domain — rental yield to token holders is NOT owner earnings), the developer
role, investor/LP/payments settlement (beyond adding the owner-credit hook).

**LOCKED decisions:** (1) **owner earnings = net primary-sale proceeds** = `amount_invested` − (platform +
management fees), credited to the owner's `UserBalance`, computed server-side; (2) credited **on each
COMPLETED primary sale** in the mint completion path, inside the atomic block, only when
`payment_status == COMPLETED`; **idempotent** (one credit per investment, never double on webhook replay);
(3) owner withdraws via the **existing** `UserBalance`/`Withdrawal` stack — no new mechanism; (4) owner
earnings ≠ investor distributions — distributions stay a separate later mock domain; (5) admin-seeded
properties (`submitted_by` null) sell fine and credit no owner (skip safely — **no platform-account routing
this wave; flagged**).

**Backend (apps/investments + apps/owner):**
- **Owner-credit hook** — `_credit_owner_for_primary_sale(inv, prop)` runs inside `mint_investment`'s
  `transaction.atomic()`, right after the REAL on-chain mint sets `tokens_minted=True`, so the credit
  commits with the mint (`apps/investments/services.py`). **NET = gross − (Property.fee_platform% +
  Property.fee_management%)** — the per-property, admin-set rates (`apps/properties/models.py:185-187`),
  computed server-side, never hardcoded. **Idempotency:** a keyed guard — one `BalanceTransaction(source=
  "primary_sale", reference=<investment id>)` per investment (belt-and-suspenders with the mint's own
  `tokens_minted` short-circuit) → a replayed completion never double-credits. **Null-owner safe:** when
  `prop.submitted_by_id` is None (seeded catalog), the credit is skipped (no crash, nobody credited).
- **Owner earnings/ledger read** — `GET /api/owner/earnings/` (owner-scoped): per-owned-property
  `{units_sold, investors, gross_proceeds, fees, net_proceeds, token_supply, is_published}` + totals
  (`total_net_proceeds`, `total_units_sold`, `total_investors`), aggregated from COMPLETED+minted
  Investments on the caller's `submitted_by` properties. Balance + payout reuse the existing
  `GET /api/wallets/balance/` and `GET/POST /api/wallets/withdrawals/`.

**Frontend (smallest change set):** `ownerApi.earnings()` added. **`OwnerWallet.tsx`** — the mock stat
cards now show real `available balance` (wallets/balance), `pending withdrawals` (sum of pending
withdrawals), `Total Primary-Sale Earnings` (earnings.total_net_proceeds), `Units Sold`; the **withdrawal
action now uses the built Django flow** via a new `OwnerWithdrawDialog` (POST /api/wallets/withdrawals/),
**replacing the legacy Supabase OTP `WithdrawalDialog`** on the owner wallet (flagged: the OTP variant
remains only on not-yet-migrated investor pages — reconcile later). **`OwnerDashboard.tsx`** — Capital
Raised / Investors / Units Sold cards now real (raised = net primary-sale proceeds); the 4th card is
**Units Sold**, not a fabricated "distribution". **`OwnerReports.tsx`** — Capital Raised / Investors /
Units Sold / Published metrics + the Asset-Performance list are real per-property earnings; the
**Distributions tab is a "separate, upcoming domain" placeholder** (NO fabricated distribution figures);
the "Distributed" metric shows $0. Bilingual EN/AR; layouts kept.

**Verified:** no new migrations (no model changes). **Full suite 219 green** (was 211; +8 Wave-D: a
completed primary sale credits the owner exactly net once; idempotent on replay; null-owner seeded sale
doesn't crash + credits nobody; no distribution rows written; owner reads earnings + balance + withdraws
via the shared stack; earnings owner-scoped; investor mint/economics unchanged). Frontend `tsc` clean for
all changed files (only pre-existing VerifyCertificate.tsx errors). **End-to-end on REAL BSC Testnet:**
published an owner property (Wave C, deploy=True) → investor bought 10 tokens (primary sale, COMPLETED →
**real on-chain mint** tx
[`0x3b0b12f4…02f41`](https://testnet.bscscan.com/tx/0x3b0b12f444492e59c1eb9c83916635590eff6578c8de8e6a9c4afa9eda402f41))
→ owner `UserBalance` credited **NET = 980.00** (GROSS 1000 − 2% fees 20), `balance == net` ✓, exactly **one**
primary_sale credit; **replay → `already=True`, balance still 980, still one credit** (idempotent); owner
**withdrew** $500 (`WD-CEE522F604` pending) → balance **480.00**. In-browser (owner): OwnerWallet shows
balance $980, Total Primary-Sale Earnings $980, Units Sold 10; OwnerDashboard shows Capital Raised $980 +
Units Sold 10; no console errors. (Test data cleaned up; the testnet token/mint remain harmlessly.)

**Confirmation:** investor/LP/payments settlement untouched except the additive owner-credit hook;
investor distributions NOT built or conflated (placeholder only). **The OWNER DOMAIN is now COMPLETE:
KYB (A) → submit (B) → review/publish (C) → earnings/payout (D).**

**Remaining (post-owner-domain):** the **DEVELOPER** role (separate later domain, reuses the owner
KYB+submit+review+earnings patterns); the **investor distributions engine** (rental-yield to token
holders — `OwnershipToken.total_distributions` exists but nothing writes it); and the other mock domains
(notifications, reports export, broker, partners, family, reinvestments, installments).

## Phase 8 Wave A — Property Developer entity verification (developer KYB) — DELIVERED (2026-06-16, LOCKED)
**Scope (THIS wave only):** a user who self-registers `?role=developer` (RegisterRole.tsx "Developer" card,
distinct from `?role=owner`), applies, completes business KYB (a SEPARATE Sumsub level), and is activated
automatically — KYB GREEN → developer approved → `role_status` ACTIVE, **no admin in the normal path**.
**VERIFICATION ONLY.** **NOT built:** developer submission (next wave — reuses the owner wizard +
`PropertySubmission`), review/publish, earnings, any staged-funding/milestone engine (the frontend has
none — DEVELOPER_SURFACE.md §3/§5). **⚠️ NOT touched:** `/developers` + `DeveloperHub.tsx` (that is the
API hub for SOFTWARE developers — a completely unrelated feature; left entirely alone, re-verified rendering).

**LOCKED decisions (product-owner):** (1) the developer is a **THIN VARIANT of the owner** — reuse
`apps/owner` patterns end-to-end; do NOT invent a staged-funding/milestone engine; developer proceeds will
be the same lump primary-sale credit as the owner (later wave). (2) developer and owner are **SEPARATE
roles** — a **separate `DeveloperProfile`** reusing the owner KYB structure/plumbing (not merged into
`OwnerProfile`); DRY via identical service/serializer/view **patterns** + the shared webhook/level routing.
(3) KYB is **AUTOMATIC** via a Sumsub **business level**, like owner/LP; keys deferred/inert; DEBUG-only
`dev_grant_developer_kyb`. (4) **same required doc set** as the owner (deferred to the submission wave; not
this one). (5) **single role per user** for v1. (6) **DO NOT** wire the property-developer role to
`/developers`.

**Backend — new `apps/developer` (mirrors `apps/owner` KYB subset):**
- **`DeveloperProfile`** (OneToOne user, `related_name="developer_profile"`, table `developer_profiles`):
  same shape as `OwnerProfile`'s KYB block (status + kyb_status machine + business fields + Sumsub linkage +
  timestamps). NO staged-funding fields. `migration 0001`.
- **Services** — `approve_kyb`/`reject_kyb`/`submit_kyb` + `try_handle_developer_kyb_webhook`/
  `_resolve_developer`; `approve_kyb` is the automation hinge (webhook **and** dev command **and** admin all
  converge here) and flips `role_status` ACTIVE only when `role == developer` (`_activate_developer_role`).
- **Endpoints** (`/api/developer/`, developer-scoped): `GET/POST profile/` (apply=create, idempotent),
  `POST kyb/submit/` (→ under_review), `POST kyb/access-token/` (developer business level; **503** when keys
  deferred). **`HasActivatedDeveloper`** permission (reads `developer_profile.status == approved`) gates the
  next wave. **Admin** = clearly-labelled EXCEPTION approve/reject (routes through `approve_kyb`).
  `dev_grant_developer_kyb` (DEBUG-only, `--reject`/`--revoke`, refuses in prod).
- **FOUR-WAY shared webhook** — `/api/kyc/webhook/sumsub/` now tries **developer → owner → LP → investor
  KYC** in turn. Each resolver matches **only its own table OR its own distinct level name**
  (`SUMSUB_DEVELOPER_KYB_LEVEL_NAME` default `developer-kyb-level`, vs owner `owner-kyb-level`, LP
  `basic-kyb-level`, investor `basic-kyc-level`) — applicant ids are globally unique, level names disjoint,
  so the four NEVER collide regardless of order. Bad/absent signature → 401, no change (unchanged).
- Settings `SUMSUB_DEVELOPER_KYB_LEVEL_NAME`; `apps.developer` in INSTALLED_APPS; url mounted;
  `.env.example` updated (NAME only, blank/placeholder).

**Frontend (smallest change set):** `developerApi` (profile/apply/submitKYB/kybAccessToken) added to
`client.ts`; **`useDeveloperProfile`** hook + **`DeveloperVerificationCard`** (mirror the owner versions,
developer copy + HardHat icon, degrade-to-dev-path notice). **`OwnerDashboard.tsx`** (the merged
"Owner / Developer" sidebar persona at `/my-assets`) now renders the **DeveloperVerificationCard when
`user.profile.role === "developer"`, else the OwnerVerificationCard** — everything else on the page is
shared. Bilingual EN/AR. `/developers` + `DeveloperHub.tsx` untouched.

**Verified:** `makemigrations`/`migrate` clean (developer 0001). **Full suite 240 green** (was 219; +21
developer: apply/idempotent/404, KYB submit→under_review, webhook developer-GREEN→approved+role-activated /
RED→rejected / bad-sig→401-no-change / resolve-by-level, **four-way cross-claim isolation** — owner/LP/
investor-KYC events NOT claimed by the developer handler and vice-versa, dev_grant approve/revoke/
refuse-in-prod, HasActivatedDeveloper allow/deny, access-token 503). **Investor KYC + LP KYB + OWNER KYB
all unaffected** (explicit no-regression tests). Frontend `tsc` clean. **Dev-path journey (no Sumsub keys),
in-browser:** registered `?role=developer` → dashboard showed the **Developer** KYB card (owner card
correctly absent) → **Apply** (UI) created the pending profile → card advanced to the business-info form →
`dev_grant_developer_kyb` → reload → card reads **"معتمد / Approved" + "your entity is verified"** from
Django; no console errors. `/developers` API hub re-verified rendering (untouched).

**NEXT waves (all REUSE `apps/owner`):** developer **submission** (the SAME `SubmitProperty.tsx` wizard +
`PropertySubmission`; generalize the submit gate to accept an approved developer OR owner) → **review/
publish** (admin assigns an under-construction model; `submitted_by = developer`) → **earnings** (the SAME
owner primary-sale credit verbatim — no staged funding).

## Phase 8 Wave B — Developer property submission (REUSE owner machinery) — DELIVERED (2026-06-16, LOCKED)
**Scope (THIS wave only):** let an APPROVED developer submit properties through the **same** owner
submission machinery. The ONLY real change is generalizing the submit gate to accept an approved OWNER **or**
DEVELOPER. **NOT built:** review/publish (Wave C), earnings (Wave D), staged funding, any parallel
developer-submission model. **⚠️ NOT touched:** `/developers` / `DeveloperHub.tsx` (the unrelated software-dev
API hub).

**LOCKED decisions:** (1) reuse `apps/owner`'s `PropertySubmission` + `SubmissionDocument` + the same
`SubmitProperty.tsx` wizard **verbatim** — a submission is a submission regardless of submitter role; NO
parallel model, NO new endpoints (developer hits the same `/api/owner/submissions/*`). (2) the submit gate
accepts an approved owner **or** developer; `PropertySubmission.submitter` records who submitted (already
generic). (3) same fields + required docs (Title/Valuation/Legal) — the wizard already collects
`construction_status` (what distinguishes a developer's UC asset). (4) single role per user — the gate
accepts whichever activated role the caller holds.

**Backend (gate generalization only — no model/migration changes):**
- New **`HasActivatedPropertySubmitter`** permission (`apps/core/permissions.py`): passes for an approved
  `owner_profile` OR `developer_profile` (single-role-per-user → at most one). Swapped into **all 6**
  `PropertySubmission` views (`SubmissionsView`, `SubmissionDetailView`, `SubmissionSubmitView`,
  `SubmissionDocumentsView`, `SubmissionDocumentDetailView`, `SubmissionDocumentDownloadView`) in
  `apps/owner/views.py`, replacing the owner-only `HasActivatedOwner`. Endpoints stay **submitter-scoped**
  (`filter(submitter=request.user)` / `_get_submission`), so opening the gate never crosses rows.
- **Confirmed nothing assumes the submitter is an owner:** the whole submission/publish/earnings path reads
  `submission.submitter` / `Property.submitted_by` generically — no code reads `submitter.owner_profile`
  (grep-verified). So the Wave-C publish pipeline (`publish_submission` sets `submitted_by=submission.
  submitter`) and Wave-D earnings (`submitted_by=request.user`) are already submitter-agnostic and will work
  for a developer submitter unchanged — to be VERIFIED when those waves run, but no developer-specific code
  is needed there.

**Frontend (smallest change set):** `SubmitProperty.tsx` gate is now **role-aware** — drives off the
developer profile when `user.profile.role === "developer"`, else the owner profile; an approved owner **or**
developer reaches the **same** wizard, a non-verified user sees a role-appropriate "Complete
owner/developer verification first" card routing to `/my-assets` (which already shows the right KYB card per
role, Wave A). Submission CRUD still uses `ownerApi.*` (the shared machinery — no new client surface).
`OwnerDashboard` lists a developer's submissions via the same `ownerApi.submissions()` (now gate-allowed).
Bilingual EN/AR; layout unchanged. `/developers` untouched.

**Verified:** no new migrations. **Full suite 248 green** (was 240; +8 Wave-B developer-submission tests;
owner+developer focused run 78 green): approved developer creates/uploads/submits with required-doc enforcement; pending
developer 403; approved **owner still works** (no regression); developer↔owner **cross-submitter isolation**
(neither sees the other's submission); **NO Property created** on submit). Frontend `tsc` clean.
**Dev-path journey, in-browser:** approved developer (`devjourney`, from Wave A) → `/submit-property`
**reached the wizard** (not gated) → created a draft + uploaded title/valuation/legal + submitted → `GET
/api/owner/submissions/` shows it **`submitted`**; **`published_property` is null, 0 Properties created**
(intake only); `OwnerDashboard` lists "Dev Journey Tower" with a **Submitted** badge; no console errors.
`/developers` API hub untouched.

**NEXT:** **Wave C = review → publish** — likely already works since the publish pipeline is
submitter-agnostic (admin assigns an under-construction model, `submitted_by=developer`); **verify** the
admin review action + the published property links the developer. **Wave D = earnings** — reuse the owner
primary-sale credit verbatim (`submitted_by` already covers a developer).

## Phase 8 Wave C+D — Developer review→publish + earnings (VERIFICATION) — DELIVERED (2026-06-16, LOCKED) → DEVELOPER DOMAIN COMPLETE
**Scope (THIS wave only):** PROVE the owner review→publish pipeline + primary-sale earnings credit work
for a DEVELOPER submitter, fixing only real owner-specific assumptions. **Result: WORKED AS-IS — ZERO code
changes needed.** **NOT built:** staged funding / milestone release (locked: the frontend has none); no
developer-specific publish/earnings logic. **⚠️ NOT touched:** `/developers` / `DeveloperHub.tsx`; the
investor marketplace (no change — it already reads `is_published=True`).

**Audit — no owner-specific assumption gates behaviour (grep + read-verified):**
- `publish_submission` ([apps/owner/services.py](backend/apps/owner/services.py)) sets
  `submitted_by=submission.submitter` generically — no `owner_profile` read.
- `_credit_owner_for_primary_sale` ([apps/investments/services.py:187](backend/apps/investments/services.py))
  reads `prop.submitted_by_id` and credits `prop.submitted_by`; memo is "Primary sale: …" (no user-facing
  "owner").
- `OwnerEarningsView` ([apps/owner/views.py:297](backend/apps/owner/views.py)) is `[IsAuthenticated]` +
  `filter(submitted_by=request.user)` — returns the caller's properties whatever their role.
- The only "owner" strings (`_credit_owner_for_primary_sale`, `OWNER_PRIMARY_SALE_SOURCE`,
  `OwnerEarningsView`) are **internal names** that don't gate behaviour → left as-is (renaming would churn
  the owner code for no functional gain). **Per locked decision #3, no minimal generalization was required.**

**Verified:** no migrations. **Full suite 256 green** (was 248; +8 Wave-C+D developer tests, chain mocked):
publish a developer's UC submission (`installment` w/ nested schedule, `phasing`) → exactly one Property,
`submitted_by=developer`, `is_published` False→True, `category` auto-derived `construction`, in the
marketplace; developer sees approved+slug / rejected+notes; an investor primary buy credits the
**developer** net-of-fees **once** (idempotent on replay), developer reads `/api/owner/earnings/` (980 net,
10 units), withdraws via the shared `UserBalance`/`Withdrawal` stack (980→480); earnings developer-scoped;
**owner flow unaffected** (no regression). Frontend untouched (the merged Owner/Developer persona already
routes a developer to `/owner-wallet` + `/owner-reports`, which read `submitted_by` generically).

**End-to-end on REAL BSC Testnet (developer submitter, zero code change):** approved developer → SUBMITTED
submission → `publish_submission(model="phasing", deploy=True)` → Property `dev-testnet-uc` published
(`is_published=True`, `submitted_by=developer`, `category=construction`, `token_supply=50000`) + **REAL
token deploy** tx
[`0x4a04c876…1fbf9`](https://testnet.bscscan.com/tx/0x4a04c876d754184c99c17e6cd08bc333c826cf922ab1e29417d77d2515f1fbf9)
(contract `0x6E7A5228A403E3D07c41068Ac670289448FCEce7`, chain 97) → investor bought 10 tokens (primary,
COMPLETED → **REAL on-chain mint** tx
[`0xafa33ef2…80247`](https://testnet.bscscan.com/tx/0xafa33ef2f8b291886284bb658423e270098f3d0d682672db9b8b4ece44880247),
block 113768027) → **DEVELOPER `UserBalance` credited NET = 980.00** (GROSS 1000 − 2% fees 20), exactly one
`primary_sale` credit; **replay → already=True, balance still 980** (idempotent); developer **withdrew** $500
(`WD-D0FAC380A6`) → balance **480.00**. (Test DB rows cleaned up; the on-chain deploy+mint remain on testnet.)

**THE DEVELOPER ROLE IS NOW COMPLETE: KYB (A) → submit (B) → review/publish (C) → earnings (D)** — built
entirely by reusing the owner machinery (separate `DeveloperProfile` + `HasActivatedDeveloper` for KYB; the
generalized `HasActivatedPropertySubmitter` gate; the submitter-agnostic publish + earnings paths unchanged).

**Remaining (post-developer-domain):** the **investor distributions engine** (rental-yield to token holders —
`OwnershipToken.total_distributions` exists but nothing writes it; separate from owner/developer primary-sale
earnings); the **bid/ask order book** (deferred); and the other mock domains (notifications, reports export,
broker, partners, family, reinvestments, installments).

## Platform state snapshot + NEXT (as of 2026-06-17 — Phase 8 complete, commit `eaefd58`)
Consolidated for compact-resilience — the per-phase sections above are authoritative; this is the index.

**DELIVERED — five roles' worth of functionality, all proven on REAL BSC Testnet:**
- **Investor** (Phase 3–4): KYC → custodial wallet → invest → **real on-chain token mint**; certificates (PDF+QR+public verify).
- **Payments** (Phase 5 W1/W2): **Stripe** (card) + **NOW Payments** (crypto), both **signature-verified-webhook/IPN-gated → mint** (no raw card data on server; never mint without a verified callback). Code-complete, inert until keys.
- **Liquidity Provider** (Phase 6 W1/W2): KYB (business Sumsub level) → activated LP; **LP market** with real on-chain settlement + escrow + internal balance.
- **Investor peer secondary market + withdrawal** (Phase 6 W3): real one-shot listings, on-chain peer transfer, custodial gas top-up, `UserBalance` withdrawal.
- **Owner** (Phase 7 A–D): entity **KYB → submit → admin review/publish (Property is_published F→T, model assigned) → earnings** (net-of-fees primary-sale credit, idempotent, withdraw).
- **Developer** (Phase 8 A–D): **COMPLETE, built by reusing owner machinery** — separate `DeveloperProfile` + `HasActivatedDeveloper` (Sumsub developer level; the shared signed webhook is now **4-way**: developer/owner/LP/investor by distinct level name); generalized `HasActivatedPropertySubmitter` gate (owner **or** developer submits the **same** wizard); review/publish + earnings were **submitter-agnostic → ZERO code change**, proven on testnet (developer credited net-of-fees, withdrew). **Committed + pushed: commit `eaefd58`.**
- **Core infra:** custodial `KeyManager` (Fernet; KMS/HSM seam), `apps/chain` (web3 deploy+mint+transfer, gas top-up seam), shared `UserBalance`/`BalanceTransaction`/`Withdrawal` ledger reused by every role.

**➡️ NEXT PLANNED BUILD = the investor DISTRIBUTIONS engine** (rental / appreciation yield paid to **token
holders** — DISTINCT from owner/developer **primary-sale** earnings, which are seller proceeds). Evidence +
seams that already exist: `OwnershipToken.last_distribution_date` + `OwnershipToken.total_distributions`
([apps/wallets/models.py:129-130](backend/apps/wallets/models.py#L129)) are present but **nothing writes
them yet**; **`apps/distributions` exists as an EMPTY STUB** (app registered, `models.py` has no models). The
mock frontend surface is `Distributions.tsx` + the owner/developer reports' "Distributions" placeholder tab
(deliberately $0, never fabricated). The build will be a separate domain that computes/records a distribution
per holding and pays into the same `UserBalance` stack — to be designed in the upcoming distributions
analysis pass. NOT started.

**REMAINING after distributions** (unchanged): the **bid/ask ORDER BOOK + matching engine** (price
discovery / partial fills — DEFERRED, the largest remaining piece; the peer market ships real one-shot
listings, order-book i18n preserved); and the other **mock domains** (notifications, reports export, broker,
partners, family, reinvestments, installments).

## Governance & roadmap (standing — keep across compacts)
- **(a) Mainnet gating (REQUIRED).** Before any mainnet / real funds: (1) a **professional
  smart-contract AUDIT**, and (2) custodial keys moved to **KMS/HSM with hot/cold separation**
  (the KeyManager abstraction is the seam). Separate workstreams + budget lines. Also pending:
  the live BSC-Testnet deploy is DONE; remaining properties deploy on demand. (3) **Custodial gas
  funding seam:** secondary-market transfers are seller-signed, and because custodial wallets hold
  0 native BNB the deployer tops up exactly the gas per transfer (`apps/chain.service._fund_gas_if_needed`).
  For mainnet this must become a proper **funded relayer / gas-station** (the helper is the single seam).
- **(b) Pre-delivery security review (RESERVED).** **Fable 5 + Dynamic Workflows** are
  reserved for the comprehensive pre-delivery security review (multi-agent adversarial pass
  over the whole codebase before handover). Not run yet — scheduled for pre-delivery.
- **(c) Upcoming phases still to build (roadmap):**
  - **Phase 4** — Investor KYC + wallet/holdings wiring (LOCKED above; next).
  - **Real payments** — Wave 1 **Stripe (card) DONE** + Wave 2 **NOW Payments (crypto) DONE**
    (see "Phase 5 Wave 1/2" above). Both inert until provider keys land. (Stripe KSA payout flag stands.)
  - **KYB + LP + secondary markets** — Wave 1 **LP onboarding DONE**; Wave 2 **LP secondary market
    (on-chain) DONE**; Wave 3 **investor PEER secondary market + investor withdrawal DONE** (see
    "Phase 6 Wave 1/2/3"). The on-chain `transfer`, escrow, and `UserBalance` core are reused across
    all of these.
  - **Owner domain — COMPLETE** ✅ (Waves A–D): A **owner entity KYB** + B **property submission intake** +
    C **review→publish** + D **owner earnings/payout** (see "Phase 7 Wave A/B/C/D" above). Owner credited
    net primary-sale proceeds via `credit_user_balance` on COMPLETED+minted sales (idempotent, null-safe);
    withdraws via the existing `UserBalance`/`Withdrawal` stack; wallet/earnings UI wired to real Django.
    Proven end-to-end on BSC Testnet.
  - **Developer domain — COMPLETE** ✅ (thin variant of owner, reuses `apps/owner`): Wave A **developer
    entity KYB** (separate `DeveloperProfile`, four-way shared webhook, `HasActivatedDeveloper`); Wave B
    **property submission** (gate generalized to `HasActivatedPropertySubmitter` = owner OR developer; reuses
    the owner wizard + `PropertySubmission` verbatim); Wave C+D **review→publish + earnings — WORKED AS-IS,
    zero code change** (the publish pipeline + primary-sale credit + earnings read are submitter-agnostic;
    `submitted_by=developer`). Proven end-to-end on BSC Testnet (deploy + mint + net credit + withdraw). NO
    staged funding (the frontend has none). See "Phase 8 Wave A/B/C+D".
  - **Remaining after the developer domain:** the **investor distributions engine** (rental-yield to token
    holders — separate from owner earnings); other mock domains (notifications, reports export, broker,
    partners, family, reinvestments, installments).
  - **Bid/ask ORDER BOOK + matching engine** (price discovery / partial fills) the mock
    `SecondaryMarket.tsx` implied — **DEFERRED, separately-scoped future wave, NOT the immediate
    next** (SPEC §7C.1; SECONDARY_MARKET_SURFACE.md). The peer market now ships real one-shot
    listings; the order-book i18n keys/structure are preserved so it can return.
  - **Remaining mock domains** — distributions, notifications, reports, broker, partners, family,
    reinvestments, installments — each currently frontend-only mock (SPEC §3.12 / §4.4). (The LP +
    investor secondary markets are no longer mock — delivered in Phase 6 Wave 2/3.)
- **(d) REQUIRED pending — live-provider proof + provider keys (NOT dropped; track like the
  testnet deploy was).** Each layer below is CODE-COMPLETE and verified via unit tests + the
  DEBUG-simulate path; only the LIVE end-to-end proof against the real provider awaits keys.
  These are gates before final delivery, not optional:
  - **Stripe (card, Wave 1):** with TEST keys → mount Stripe Elements, pay with test card
    `4242 4242 4242 4242`, receive the REAL `payment_intent.succeeded` webhook → confirm the
    on-chain mint. Then sandbox→production keys. (Layer inert until `STRIPE_*` keys land.)
  - **NOW Payments (crypto, Wave 2):** with keys → create a real payment, send to the REAL
    deposit address, receive the REAL signed IPN (finished) → confirm the on-chain mint.
    (Layer inert until `NOWPAYMENTS_*` keys land.)
  - **Sumsub KYC (Phase 4):** with keys → real WebSDK capture + the REAL `applicantReviewed`
    webhook (GREEN→approved / RED→rejected) → wallet auto-create. (Layer inert until `SUMSUB_*`
    keys land.)
  - **Sumsub KYB (Phase 6 Wave 1, LP):** with the **business-level** keys/level → real WebSDK
    business verification + the REAL `applicantReviewed` business webhook → LP approved + role
    activated. Shares the `SUMSUB_*` keys; needs `SUMSUB_KYB_LEVEL_NAME` set. (Inert until keys land.)
  - **Sumsub owner KYB (Phase 7 Wave A, Property Owner):** with the **owner-business-level** keys/level
    → real WebSDK business verification + the REAL `applicantReviewed` business webhook → owner approved
    + role activated. Shares the `SUMSUB_*` keys; needs the SEPARATE `SUMSUB_OWNER_KYB_LEVEL_NAME` set
    (so the shared webhook routes owner vs LP vs investor). (Inert until keys land.)
  - **Sumsub developer KYB (Phase 8 Wave A, Property Developer):** with the **developer-business-level**
    keys/level → real WebSDK business verification + the REAL `applicantReviewed` business webhook →
    developer approved + role activated. Shares the `SUMSUB_*` keys; needs the SEPARATE
    `SUMSUB_DEVELOPER_KYB_LEVEL_NAME` set (so the **four-way** shared webhook routes developer vs owner vs
    LP vs investor by distinct level name). (Inert until keys land.)
  - **OAuth (Google/Apple):** social login scaffolded, inert until provider keys land (pre-existing).
- **(e) Cleanup / tech-debt (recorded — not lost):**
  - **(a) Duplicate withdrawal flow on INVESTOR pages.** The **Owner wallet now uses the built Django
    flow** (`OwnerWithdrawDialog` → `POST /api/wallets/withdrawals/`, debits `UserBalance`; Phase 7 Wave D).
    The legacy **OTP `WithdrawalDialog`** (Supabase, `useWithdrawalRequests` + bank/crypto/card + email OTP)
    still exists on **investor** pages alongside the new proceeds withdrawal. They cover different balances;
    **needs reconciliation** into one investor-withdrawal flow (decide OTP + rails) in a later pass.
  - **(b) `VerifyCertificate.tsx` TS `unknown` typing** (pre-existing since Phase 3) — untouched; clean up
    when the certificate-verify surface is next revisited.
  - **(c) Property-submission MEDIA not persisted (Phase 7 Wave B).** SubmitProperty.tsx Step 5 (images /
    video / virtual-tour URL) remains visual placeholders — the Wave-B `PropertySubmission` model stores the
    fields + documents (incl. the title deed) only. **Deferred:** add media persistence (image/video uploads
    + tour URL) when the property data-room media surface is built.
  - **(d) Null-owner primary sales credit nobody (Phase 7 Wave D).** Admin-seeded properties have
    `Property.submitted_by = null`; a completed primary sale of one is **safe but credits no owner** (no
    platform-account routing). **Product decision** if the platform later wants to capture those proceeds
    to a platform account.
  - **(e) Internal "owner" naming now also serves developers (Phase 8 Wave C+D).** The primary-sale credit
    + earnings code is submitter-agnostic but keeps owner-era names — `_credit_owner_for_primary_sale`,
    `OWNER_PRIMARY_SALE_SOURCE` ([apps/investments/services.py](backend/apps/investments/services.py)),
    `OwnerEarningsView` + `/api/owner/earnings/` ([apps/owner/views.py](backend/apps/owner/views.py)). These
    correctly serve BOTH owners and developers (they read `Property.submitted_by`). **Cosmetic rename
    (→ "submitter"/"primary-sale") DEFERRED** — renaming would churn verified owner code for no functional
    gain; do it only if a later refactor touches these surfaces anyway.

## KYC / KYB
- Provider-driven, automatic approval via webhooks (Sumsub — WebSDK; see "Phase 4" above).
  No manual approval in the normal path. KYC is a prerequisite for investing (Phase 4 #1).

## Properties
- Owner submits → review pipeline → publish. Admin-managed in Django admin.

### Phase 2 implementation (property READ + admin-manage domain)
- Replaced static `src/data/properties.ts` with `apps/properties` (Postgres, admin-managed).
  Full mapping in PROPERTY_SURFACE.md.
- **String ids preserved:** the frontend's ids ("1","10","p1-a") are stored as
  `Property.slug` (unique) and the API resolves by + serializes them as `id`. The pk is
  a UUID (platform-wide convention). SPEC §3.1.
- **Token economics (SPEC §7C.6):** `Property.token_supply` + `token_price` are stored so
  ownership % is derivable server-side (`ownership_percentage_per_token`). Seed sets
  `token_supply = total_value / token_price (100)` — matching the data-room's own
  `totalValue / tokenPrice` computation (PropertyDataRoom.tsx). NOTE the frontend Checkout
  separately assumes a flat 1000 tokens/property; that path is out of scope (later phase)
  and will be reconciled to `token_supply` when investments are built.
- **All 8 models** are first-class: per-model detail tables
  (installment/future/option/shared 1-1; phases/portfolio_assets/developer_reports/
  valuation_reports/documents FK) + SPV/token_metadata/financials for the data room.
- **API:** public (AllowAny) `GET /api/properties/` (bare array, no pagination — Marketplace
  filters client-side), `/{slug}/`, `/featured/`, `/funded/`, `/stats/`. Decimals serialize
  as JSON numbers (`COERCE_DECIMAL_TO_STRING=False`) since the UI uses them numerically.
- **Seed:** `python manage.py seed_properties` imports the 19 real catalogue entries +
  6 closed deals (FundedProperties) + SPV/token/financials/docs for id "1". 25 rows total.
- **Frontend wired (smallest change set):** Marketplace (list), PropertyDetail (detail,
  catalogue path; inline `propertyDatabase` for ids 1/2 untouched), FundedProperties (funded).
  `propertyModelMeta` + the `Property` TS type are KEPT as display/type helpers.

### Phase 2.1 — Property data-integrity guards (fix: admin-created property invisible)
Root cause of the reported bug: an admin saved a Property with `category` inconsistent
with `model` (ready_portfolio + construction) and `expected_yield=452`, so the marketplace's
client-side filters (category tab + default ROI range 0–60) silently excluded it. The API
returned it correctly (is_published=True) — the problem was invalid data, not code.
Systemic fix in `apps/properties/models.py`:
- `Property._sync_derived()` (runs in `save()`): **`category` is auto-derived from `model`**
  via `MODEL_CATEGORY_MAP` (mirrors propertyModelMeta), and **`token_supply` from
  `total_value / token_price`** (mirrors seed_properties). They can no longer desync; both
  are read-only in the admin.
- `Property.clean()`: **rejects** out-of-range `expected_yield` / `expected_growth` /
  `funded` (must be 0–100) with a clear field-level error in the admin (full_clean), instead
  of silently creating an un-listable property.
- No migration (methods/admin only). Tests in `PropertyValidationTests`.
- The frontend's 60% ROI filter cap (`Marketplace.tsx`) is left as-is per product decision —
  validation allows 0–100, so a 61–100% yield would pass the backend but still be hidden by
  the frontend cap (separate decision).

FLAGGED (left static on purpose — wiring would change displayed content, against the
"never change existing UX silently" rule; endpoints exist for when the owner approves):
- `home/FeaturedProperties.tsx` — homepage carousel uses its own inline ids (incl. id "2"
  not in the catalogue) and a `durationYears` number field. `/api/properties/featured/` ready.
- `marketplace/GlobalStats.tsx` — hardcoded marketing figures (32 ready, 2,847 investors,
  $127M, 9.8%), NOT computed from properties today. `/api/properties/stats/` ready.
- `Products.tsx` / `ProductCategory.tsx` — static ownership-MODEL taxonomy + marketing copy +
  an explicitly-labeled "illustrative" sample (PropertyModelTemplate). Not property records.