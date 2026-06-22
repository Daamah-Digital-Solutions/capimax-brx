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
**replacing the legacy Supabase OTP `WithdrawalDialog`** on the owner wallet (the investor wallet was
later migrated the same way — Phase 12 finishing; the OTP dialog is now fully unused, see cleanup (e)(a)).
**`OwnerDashboard.tsx`** — Capital
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

**Remaining (post-notifications-domain):** the **bid/ask order book** (deferred); and the other mock domains
(reports export, broker, partners, family, reinvestments, installments).

## Phase 10 — In-app notifications (COMPLETE ✅)
**What it is:** in-app notifications emitted server-side at every existing user-facing event point, read self-
scoped by the user. Backs the bell + the `Notifications.tsx` page (was a static mock array; the header bell had a
fake dot, the sidebar a hardcoded `badge: "5"`). **In-app ONLY** — no email/SMS/push/digest.

**LOCKED decisions (as built):**
1. **TYPE + PARAMS + i18n** — the backend stores a `type` enum + a small JSON `params` dict + `action_url`,
   **NEVER display strings**. The frontend renders EN/AR copy from its i18n layer keyed by `type`, interpolating
   `params` ([src/lib/notifications.ts](src/lib/notifications.ts) + `notif.*` keys in
   [LanguageContext.tsx](src/contexts/LanguageContext.tsx)). Same philosophy as the Distributions repoint —
   Arabic stays in `t()`.
2. **IN-APP ONLY** (v1). The settings panel's channel/digest/per-type toggles stay **local-only UI** — no backend.
3. **PREFERENCES DEFERRED** — all events emit; no `NotificationPreference` model.
4. **SOFT DELETE** — the trash action sets `deleted=True` (hidden from the list), never a hard delete.
5. **Read/unread** tracked; mark-one + mark-all read.
6. **EMIT inside the host service's existing `transaction.atomic()`** so the notification commits with the event
   (like `credit_user_balance`). A `notify()` failure can **NEVER** break the host — it's wrapped in a SAVEPOINT
   and swallows errors ([services.notify](backend/apps/notifications/services.py)). Replay-safe: emitted only on
   the state-changing path (the `already`/idempotency guards already present at each point).

**Backend (`apps/notifications`, was an empty stub):** `Notification` model (user, `type` 13-value enum, `params`
JSON, `action_url`, `read`, `deleted`, `created_at`; indexes on (user,read) + (user,created_at)) — [models.py]
(backend/apps/notifications/models.py). `notify(user, type, *, params, action_url)` helper. Endpoints (self-
scoped, `IsAuthenticated`): `GET /api/notifications/`, `GET …/unread-count/`, `POST …/<id>/read/`, `POST …/mark-
all-read/`, `POST …/<id>/delete/` (soft). Admin read view. Migration `0001_initial`. **No create endpoint.**

**Emit points wired (11 services, inside their atomic blocks):** KYC approve/reject ([kyc/services.py:53,64]
(backend/apps/kyc/services.py#L53)); LP/owner/developer KYB approve/reject (lp/owner/developer `services.py`);
wallet auto-create ([wallets/services.py](backend/apps/wallets/services.py)); mint complete + owner/developer
primary-sale earnings ([investments/services.py:330](backend/apps/investments/services.py#L330)); distribution
credited, per holder ([distributions/services.py](backend/apps/distributions/services.py)); secondary-market sale
— **BOTH buyer and seller** (peer [secondary_market/services.py](backend/apps/secondary_market/services.py) + LP
[lp/market_services.py](backend/apps/lp/market_services.py)); withdrawal requested ([wallets/services.py:133]
(backend/apps/wallets/services.py#L133)); submission published/rejected ([owner/services.py:281,374]
(backend/apps/owner/services.py#L281), submitter-agnostic → owner OR developer).

**Frontend (smallest change set):** `notificationsApi` + `useNotifications`/`useUnreadCount`
([src/hooks/useNotifications.ts](src/hooks/useNotifications.ts), refetch on mount + focus, NO realtime).
[Notifications.tsx](src/pages/Notifications.tsx) repointed from the mock array to the API, copy rendered by
type+params, tabs/icons via a type→category map ([src/lib/notifications.ts](src/lib/notifications.ts)), mark-
read/mark-all/soft-delete wired, relative timestamps via `Intl.RelativeTimeFormat`. Header **bell** shows the
real unread count + links to `/notifications`; **sidebar** badge replaced with the live count. EN/AR preserved.

**Verification:** +19 notifications tests (emit at each point for the right user with the right type/params;
secondary sale notifies BOTH parties; replay emits no duplicate; **notify failure never breaks the host event**;
self-scoped read excludes others' + deleted; unread count; mark/mark-all/soft-delete; cross-user 404). **Full
suite 290 green** (was 271; +19, no regressions — the in-service emits broke nothing). Browser journey: 3 real
events (KYC approve → kyc_approved + wallet_created; declare distribution → distribution_credited) → page
rendered all 3 in Arabic with interpolated params, **bell badge = 3** → mark-all-read → unread **0** → soft-
delete → list **3→2** (row retained, hidden). Backend ground truth confirmed.

**Flags (deliberate, v1):** (1) the page's channel (email/SMS) + digest + 7 per-type toggles are **local-only UI,
not persisted** (no preferences backend). (2) In-app only — no email/SMS/push actually sent. (3) `action_url` is a
fixed per-type deep link (e.g. distribution → `/distributions`), not a row-specific target.

## Phase 9 — Investor distributions engine (COMPLETE ✅)
**What it is:** a periodic CASH yield an admin declares for a property — a money pool split PRO-RATA across the
property's current ACTIVE token holders and credited to each holder's internal `UserBalance`. Backs the investor
`Distributions.tsx` page (rental/appreciation yield). **DISTINCT from owner/developer PRIMARY-SALE earnings**
(one-time seller proceeds, `source="primary_sale"`); distributions flow the OTHER way — to holders, recurring,
`source="distribution"`.

**LOCKED decisions (as built):**
1. **ADMIN declares** (sanctioned admin action, like property publication — NOT an exception handler). No
   owner-funded flow in v1 (the frontend has no owner-declare UI). Surface = a "Declare & distribute" button on
   the Distribution admin changelist → intermediate form (property + pool + type + period_label + pay_date) →
   `services.declare_distribution`.
2. **Pro-rata by FULL `token_amount`** of ACTIVE holdings (NOT net of `locked_amount` — escrow is tradability,
   not ownership). Holders **snapshot at declaration time**; each `DistributionPayout` freezes
   `tokens_at_snapshot` + `ownership_pct_at_snapshot` (never recomputed later).
3. **INTERNAL-BALANCE ONLY** — `wallets.credit_user_balance(..., source="distribution")`. **NO PropertyToken
   call, no token transfer, no on-chain movement.** (Cash yield, not a token move — proven by a test asserting
   `token_amount` unchanged + zero new `WalletTransaction`.)
4. **Credited IMMEDIATELY on declare** (status `paid`). `Distribution` carries `status` + `pay_date` so the
   frontend renders, but there is **NO scheduling/recurrence engine** (admin declares each period manually; the
   Schedule tab just shows what's been declared).
5. Each credited holding's **`OwnershipToken.total_distributions += share`** and **`last_distribution_date`** are
   bumped (the pre-existing seams at [apps/wallets/models.py:129-130](backend/apps/wallets/models.py#L129) —
   now written).
6. **Cent-exact + idempotent:** shares floored to the cent, the remainder cent → the **largest** holder, so
   `Σ shares == pool` exactly. One `DistributionPayout` per `(distribution, user)` (DB unique) + a `credited`
   flag → a re-run never double-credits.

**Backend (`apps/distributions`, was an empty stub):** `Distribution` + `DistributionPayout` models
([models.py](backend/apps/distributions/models.py)); `declare_distribution` + `_build_and_credit_payouts`
([services.py](backend/apps/distributions/services.py), atomic snapshot→split→credit→bump); `GET
/api/distributions/` self-scoped read shaped to `Distributions.tsx`
([views.py](backend/apps/distributions/views.py)); admin declare flow
([admin.py](backend/apps/distributions/admin.py) + 2 templates). Migration `0001_initial`. Mounted at
`api/distributions/`. **No write endpoint** — declaring is admin-only.

**Frontend (smallest change set):** `distributionsApi.list()` + `useDistributions` hook;
[Distributions.tsx](src/pages/Distributions.tsx) repointed from the two hardcoded mock arrays to the API,
**preserving the exact rendered shape** (History / By-Property / Schedule tabs, summary cards, EN/AR). Cadence
label moved to the i18n layer (`freqLabel` via `t()`) instead of hardcoded Arabic; period is a single
language-neutral label. Empty state renders zeros (new investor sees no fabricated data). `tsc` clean.

**Verification:** +15 distributions tests (pro-rata cent-exact, `source="distribution"`, token bump, idempotent
no-double-credit, locked NOT subtracted, frozen snapshot, only-active holders, no-eligible-holders rollback, no
token transfer, primary-sale isolation, self-scoped read). **Full suite 271 green** (was 256; +15). End-to-end
dev-DB journey: 3 holders 50/30/20, declare $1000 → **$500 / $300 / $200, Σ = $1000.00 (cent-exact)**; re-run
credit step → balance unchanged, tx count stays 1 (**idempotent**); holder A withdrew $500 via the existing
`UserBalance`/`Withdrawal` stack → balance $0.00, `WD-…`. No on-chain movement (internal balance only).

**Flags (deliberate, v1):** (1) summary "pending" card = $0 and "next payment" = blank — v1 credits immediately
with no scheduling, so nothing is pending/scheduled (honest, not fabricated; the Schedule tab is empty until a
future scheduling wave). (2) `yield` shown is the property's `expected_yield` (catalog figure), not a computed
realized yield. (3) Single-role: a holder gets one payout per distribution (one ACTIVE position per property).

## Phase 11 — Partner role, Wave A: partner KYB + public directory (COMPLETE ✅)
**Scope (Wave A only):** the **STRANDED** `role=partner` (a SERVICE VENDOR — valuation / property-management /
insurance firm) now has an activation path, mirroring developer KYB exactly. A **thin, NON-EARNING variant** of
owner/developer: **NO money — no `UserBalance`, no `Withdrawal`, no earnings, EVER** (a test asserts the partners
app defines only `PartnerProfile` and no money model). Wave B (assignment/deliverable workflow) is NOT built.

**Two INDEPENDENT states (the key decision):**
- `status`/`kyb_status` — the VERIFICATION gate (`HasActivatedPartner`; activates `role_status` when role=partner).
  Driven automatically by the signed Sumsub webhook (partner business level). KYB approval does **NOT** publish.
- `directory_status` (`pending|approved|rejected`, default pending) — whether the partner appears in the PUBLIC
  directory. A **separate admin approve/reject** step, independent of KYB. The PARTNER fills the directory data
  (`company_name`/`_ar`, `category`, `description`/`_ar`, `logo_url`, `country`/`_ar`, `website`); the **admin
  NEVER enters data — only approves/rejects visibility**.

**Backend (`apps/partners`):** `PartnerProfile` (mirrors `DeveloperProfile` KYB block + the directory fields +
the independent `directory_status`/`directory_reviewed_at`/`directory_review_notes`); `services` =
`approve_kyb`/`reject_kyb`/`submit_kyb` + `try_handle_partner_kyb_webhook`/`_resolve_partner` (mirror developer)
**plus** `approve_directory`/`reject_directory` (directory-only, never touches KYB). Endpoints `/api/partner/`
(self-scoped: profile GET/POST [POST = apply when none, else update own directory details], kyb/submit,
kyb/access-token → 503 when keys deferred) + PUBLIC `/api/partners/directory/` (AllowAny, lists `directory_status
== approved` only, lean shape, `verified` = KYB-approved). The shared signed Sumsub webhook is now **5-WAY**
(partner → developer → owner → LP → investor, routed by distinct level name `SUMSUB_PARTNER_KYB_LEVEL_NAME`); each
resolver matches only its own table/level so they never collide. `HasActivatedPartner` gate (KYB-based).
`dev_grant_partner_kyb` (DEBUG-only, --reject/--revoke). Admin has **TWO clearly-separated, independent actions**:
(1) KYB exception approve/reject, (2) approve/reject directory listing. `/developers` API hub UNTOUCHED.

**Frontend (smallest change set):** `partnerApi` (profile/update/kyb/access-token + public `directory()`) +
`usePartnerProfile` + `PartnerVerificationCard` (KYB flow mirroring the developer card + the partner's own
directory-details form + the live `directory_status` badge), surfaced on `StrategicPartners.tsx` for
`role=partner`. `Partners.tsx` repointed off its 10-item mock to `GET /api/partners/directory/`, mapping rows into
the EXACT prior `Partner` card shape (name/category/country/website/verified + search + category/country filters,
bilingual EN/AR preserved). No money UI anywhere.

**Verification:** **+30 partner tests; full suite 320 green** (was 290). Covers: apply→pending + directory data;
directory-details update; KYB submit→under_review; webhook GREEN→approved+role-activated (directory stays
pending), RED→rejected, bad signature→401 no-change, resolve-by-level; **5-way cross-claim isolation explicit**
(investor KYC + LP/owner/developer KYB all unaffected, and a partner event touches none of them);
`dev_grant_partner_kyb` approve/revoke/refuse-in-prod; self-scoped (can't see another's profile);
`HasActivatedPartner` allows approved + denies others (+ directory-approved-alone does NOT open the KYB gate);
**directory INDEPENDENCE** (KYB-approved-but-pending NOT listed; `approve_directory`→appears; reject→stays out;
public AllowAny returns only directory-approved); **no money model created**. Dev-DB journey: partner A
apply→fill directory→KYB grant (role activated, directory still pending)→admin approve directory ⇒ appears in
`/api/partners/directory/`; partner B KYB-approved but directory-pending ⇒ does NOT appear. Browser-verified on
`/partners` (Arabic): "ليستد للتقييم" card renders (category/country/verified/Visit-Website, exact shape), the
directory-pending partner is absent; `StrategicPartners.tsx` portal still renders for a guest (no card shown).

**Flags (deliberate, Wave A):** (1) `directory_status` is reset by neither apply nor a directory edit — only the
admin approve/reject drives it (locked decision); editing an approved listing keeps it approved (no auto re-review
in v1). (2) The directory country filter chips on `Partners.tsx` stay the fixed UAE/UK/USA/all set; a partner
whose country is outside that set still appears under "All". (3) Wave B (assignment/deliverable workflow) deferred.

## Phase 11 — Partner role, Wave B: assignment + deliverable workflow (COMPLETE ✅)
**Scope:** the service-vendor WORK PORTAL (StrategicPartners.tsx) — an admin ASSIGNS a Property to a KYB-approved
partner with a service type + due date + admin-defined deliverables; the partner uploads a document per
deliverable + submits; the admin approves each or requests a revision; a DERIVED activity feed + DERIVED progress;
`notify()` at each transition. This CLOSES the partner domain. Still **NON-EARNING — no money anywhere** (a test
asserts the partners app defines no money model and the workflow credits no balance).

**ADMIN-INITIATED** (unlike the owner-initiated submission): assignment + review are the sanctioned ADMIN actions
(like property publication). Automation-first does not apply — a human assigns work + reviews deliverables.

**Backend (`apps/partners`, appended):**
- `Assignment` (FK partner + FK `Property` SET_NULL + denormalized `property_name`/`_ar`/`location`/`_ar`,
  `service_type` [valuation|property-management|insurance], `status`, `due_date`, `notes`, `assigned_by`,
  `review_notes`, timestamps). `Deliverable` (FK assignment, `name`/`name_ar`, `status`, `due_date`).
  `DeliverableDocument` (FK deliverable + assignment, `file` FileField `upload_to="deliverable_documents/%Y/%m/"`,
  `original_filename`, `file_size` — reuses the owner `SubmissionDocument` storage pattern). `AssignmentEvent`
  (append-only: assigned/uploaded/submitted/approved/revision_requested/completed + `actor` + `meta`) — the
  activity-feed source. **Status string VALUES match the frontend literals EXACTLY** (incl. `in-progress` with a
  hyphen) so the API serializes 1:1. **Progress is DERIVED** (`Assignment.derived_progress()` = approved ÷ total),
  never stored.
- Services: `create_assignment` (admin; requires KYB-approved partner → ASSIGNED event + notify partner),
  `upload_deliverable_document` (partner; deliverable→submitted, assignment pending/revision→in-progress, UPLOADED
  event + notify admin), `submit_assignment` (partner; →submitted, SUBMITTED event), `approve_deliverable` (admin;
  →approved + when ALL approved →assignment approved + COMPLETED event + notify partner), `request_revision`
  (admin; deliverable+assignment→revision, records `review_notes`, REVISION_REQUESTED event + notify partner). All
  transitions are `@transaction.atomic` and `notify()` fires INSIDE the block (savepoint-wrapped → a notify
  failure can NEVER roll back the transition).
- 5 new `Notification.Type`s: `partner_assigned`/`partner_deliverable_approved`/`partner_revision_requested`/
  `partner_assignment_completed` (→ partner) + `partner_deliverable_submitted` (→ admin/assigner).
- Partner endpoints (`HasActivatedPartner`, self-scoped → cross-partner 404): `GET assignments/` (list + derived
  activity), `GET assignments/{id}/`, `POST deliverables/{id}/upload/` (multipart), `POST assignments/{id}/submit/`,
  `GET deliverables/documents/{id}/download/`. Admin: `AssignmentAdmin` add-form + `DeliverableInline` (define
  deliverables at assign time; validates KYB-approved; denormalizes Property + writes ASSIGNED + notify on create)
  and `DeliverableAdmin` with **approve** / **request-revision** (notes form) actions.

**Frontend (smallest change set):** `partnerApi` assignment surface (`assignments`/`assignment`/`submitAssignment`/
`uploadDeliverable`) + `useAssignments` hook (poll on mount + window focus, no realtime). `StrategicPartners.tsx`
repointed off its `assignedAssets`/`activityLog` mocks → the real API, preserving the EXACT rendered shape (4
summary stats, asset cards with status/progress/due-date, deliverable chips, deliverables/documents/activity tabs,
EN/AR). Real upload (per-asset hidden file input → next actionable deliverable) + a conditional **Submit for
review** button. The activity feed renders the derived `AssignmentEvent` list (event_type → localized label +
`relativeTime`). 5 new `notif.*` EN/AR keys + `categoryOf` entries. `/developers` untouched.

**Verification:** **+14 partner Wave-B tests; full suite 334 green** (was 320). Covers admin-assign → pending +
deliverables + partner notified; cannot assign a non-KYB-approved partner; partner lists/sees ONLY own (cross-
partner 404 on detail + upload); upload → deliverable submitted + assignment in-progress + admin notified;
submit → submitted + event; approve-all → completed + completion notify; request-revision → revision + notes +
notify; revision→reupload→in-progress; **progress derives (approved/total)**; **activity feed derives from
events**; portal gated to KYB-approved; **notify-failure never breaks the transition**; **NO balance/ledger entry
anywhere**. Dev-DB journey (assign 2 deliverables → upload+submit → approve d1 + revision d2 [50%] → reupload d2 +
approve → 100%/completed): 8-event derived feed + the exact notification counts (partner assigned×1/approved×2/
revision×1/completed×1, admin submitted×2), no `UserBalance`. Browser-verified: logged-in partner sees the
assignment at 100% with both deliverables + the derived activity feed on `/strategic-partners` (no error boundary).

**Flags (deliberate, Wave B):** (1) the per-asset "Upload Files" button uploads to the NEXT actionable deliverable
(pending→revision); precise per-deliverable upload is a later refinement. (2) `service_type`/`location` are
localized on the frontend from the code + bilingual fields (backend stays language-agnostic, like notifications).
(3) The PARTNER DOMAIN IS NOW COMPLETE (KYB + directory → assignment/deliverable workflow).

## Phase 12 — Broker role, Wave A: HYBRID verification + referral attribution (COMPLETE ✅)
**Source of truth:** BROKER_SURFACE.md (+ the verification analysis). The broker is a **referral-commission agent**
— a **MONEY-earning** role (5% commission per the mock) — but **Wave A builds ONLY verification + attribution; NO
commission/money is computed or credited** (locked decision #5). `role=broker` existed in core (self-selectable,
requires verification) but was **STRANDED** with no activation path — exactly the developer/partner pre-build gap.

**LOCKED decisions, as built:**
1. **HYBRID verification.** IDENTITY reuses the EXISTING investor `UserKYC` (role-agnostic; flows through the shared
   Sumsub webhook's investor FALLBACK resolver). **The webhook is UNTOUCHED — NO 6th KYB resolver** (a test guards
   that `apps.broker.services` adds no `try_handle_*` handler). LICENCE + broker data live on a thin new
   `BrokerProfile` (OneToOne user): `license_number/authority/expiry`, `license_document` (FileField),
   `referral_code` (unique, auto-gen `BRK######`), `status` (pending|approved|rejected|suspended), licence
   timestamps + `review_notes`, **commission accumulators DEFINED but NEVER written this wave** (`commission_rate`
   default 5, `total_commission_earned`/`pending_commission` = 0).
2. **Activation HINGE = admin licence-approval, gated on `user.kyc` approved.** `services.approve_license` REQUIRES
   identity KYC already approved (raises `LicenseNotApprovable` otherwise) → status approved + `role_status` →
   ACTIVE (`on_commit`) + `notify(BROKER_LICENSE_APPROVED)`. KYC approved ALONE does NOT activate the role. Reject →
   `BROKER_LICENSE_REJECTED` + notes, role stays inactive. Mirrors the owner-publish / partner-directory admin
   pattern, layered on personal KYC. `HasActivatedBroker` gates the broker portal (Wave B).
3. **Referral attribution — SET-ONCE.** Each broker owns a unique `referral_code` → `/ref/<code>`. New field
   `core.Profile.referred_by_broker` (FK `BrokerProfile`, `SET_NULL`, nullable). `services.attribute_referral`
   sets it ONCE at registration (first broker wins; ignores unknown/own codes; never overwrites). Wired into
   `RegisterSerializer` via an optional `ref` field. Public `GET /api/broker/referral/resolve/?code=` validates a
   code at signup. This durable link is what Wave B's commission will read.

**Endpoints** (`/api/broker/`, auth-scoped to own profile): `GET/POST profile/` (apply + read; mirrors `kyc_status`
from the shared `UserKYC`), `POST license/submit/`, `POST license/upload/` (multipart), public `GET
referral/resolve/`. **Admin:** `BrokerProfileAdmin` with the licence approve/reject actions (a `kyc_approved` column
so the admin only approves on a KYC-verified broker). **Dev:** `dev_grant_kyc` (identity) + `dev_approve_broker_license`
(the hinge; DEBUG-only, refuses prod, enforces the KYC-first guard). **NO webhook change, NO money model.**

**Frontend (smallest change set):** `brokerApi` + `BrokerProfile`/`ReferralResolveResult` interfaces;
`useBrokerProfile`; `BrokerVerificationCard` (REUSES the investor `<KycVerification/>` for identity + a licence
form/upload + shows the referral code/link once approved); surfaced on `BrokerDashboard.tsx` for `role=broker`
(the mock stats/commission stay untouched — Wave B); **referral capture** = a `/ref/:code` landing route
(`ReferralCapture.tsx`) stashes the code → `/register?ref=`, `Auth.tsx` forwards it through `signUp` → `authApi.register`
(`ref`), cleared on success. Notif i18n (EN/AR) + `TYPE_CATEGORY` for the 2 broker types. **`/developers` untouched.**

**Tests:** +25 broker tests, **full suite 359 green**. Cover: apply→pending + unique auto `referral_code`; licence
submit/upload; **KYC alone does NOT activate the role**; **hinge REQUIRES KYC** (raises otherwise) → approve flips
`role_status` ACTIVE + notifies; reject + notes; **set-once attribution** (2nd code ignored, unknown/own ignored,
never overwritten); register-with-`ref` links once; public resolve; `HasActivatedBroker` allows approved / denies
others; **NO money written** (accumulators stay 0); broker app owns ONLY `BrokerProfile`; **webhook untouched**;
dev command guards (KYC-first + refuses prod). Browser-checked: `/ref/<code>` stashes + redirects to
`/register?ref=`, no console errors.

**Flags (deliberate, Wave A):** (1) `BrokerDashboard`/`Referrals`/`Commissions` still render MOCK commission numbers
— Wave B wires them to real data. (2) Licence document is admin-reviewed (Sumsub doesn't verify licences); approval
is the sanctioned admin step, not automation. (3) Commission accumulator fields exist on `BrokerProfile` but are
inert this wave.

## Phase 12 — Broker role, Wave B: COMMISSION credit + dashboard wiring (COMPLETE ✅ — BROKER DOMAIN COMPLETE)
**Source of truth:** BROKER_SURFACE.md §4 + the owner-earnings pattern. Credits a broker their commission on a
referred investor's completed primary sale — REAL MONEY, same minting-grade discipline as owner earnings /
distributions: settlement-gated, idempotent, server-side, never pre-settlement. **This CLOSES the broker domain.**

**LOCKED decisions, as built:**
1. **Commission = `BrokerProfile.commission_rate`% (default 5) of the investor's GROSS purchase**, server-side,
   per-broker. **PLATFORM-BORNE + ADDITIVE:** a standalone extra credit to the broker — it does NOT reduce the
   investor's tokens or the owner/developer net (computed off gross, independent of the owner's fee math).
2. **Settlement-gated hook:** `_credit_broker_commission(inv)` runs INSIDE `mint_investment`'s atomic block,
   immediately AFTER `_credit_owner_for_primary_sale` ([apps/investments/services.py](backend/apps/investments/services.py)) —
   the same moment the on-chain mint commits. Credited only when (a) the investor has `referred_by_broker`, (b) that
   broker is `APPROVED`, (c) the sale completed + minted.
3. **Idempotent:** one `BalanceTransaction(source="broker_commission", reference=<investment id>)` per investment;
   a replayed mint/webhook never double-credits (mint's `tokens_minted` guard + the keyed-source guard, mirroring
   the owner credit).
4. **Distinct `source="broker_commission"`** (never conflated with `primary_sale`/`distribution`); bumps
   `BrokerProfile.total_commission_earned` in the SAME transaction. `notify(BROKER_COMMISSION_CREDITED)`.
5. **Withdraw via the EXISTING `UserBalance`/`Withdrawal` stack** (broker got a custodial wallet at KYC) — no new
   payout mechanism.
6. **No referring broker / inactive broker → NO commission, safely** (no crash), exactly like the null-owner case.

**Endpoint:** `GET /api/broker/commissions/` (approved-broker only) — the commission ledger + totals (total /
this-month / referrals / conversion) + the referred-investor roster, shaped to BrokerDashboard/Referrals. Derived
from the `broker_commission` ledger (source of truth) so it can't drift. Balance + payout reuse `/api/wallets/
balance/` + `/api/wallets/withdrawals/`.

**Frontend:** `brokerApi.commissions()` + `useBrokerCommissions` (poll on mount/focus, no realtime);
`BrokerDashboard.tsx` + `Referrals.tsx` repointed off their MOCK commission/referral data → real API (stats cards,
referrals table, commissions ledger); the Visa-wallet card shows the **real `UserBalance`**; a **Withdraw** control
in the Commissions tab hits the existing withdrawal endpoint. Notif i18n + category for the commission type.
`/developers` untouched.

**Tests:** +8 commission tests, **full suite 367 green**. Cover: referred sale credits broker exactly `amount*rate%`
once (`source="broker_commission"`); idempotent on replay; non-referred → none; inactive/rejected broker → none;
**owner net + investor tokens UNCHANGED** (additive — same property/amount with vs without a broker → identical
owner_credited, full investor tokens); source isolation `{primary_sale, broker_commission}`; broker reads own
commissions + withdraws; endpoint denies non-brokers.

**End-to-end (real Postgres, production `mint_investment` path; chain receipt mocked — no funded keys this session):**
$1000 referred primary sale → **owner_credited=$980.00 (UNCHANGED), broker_credited=$50.00 (5%)**; replay →
`already=True`, **broker_commission tx count=1** (no double-credit); broker balance $50.00, owner balance $980.00,
investor tokens 10 (full); ledger total/this-month=$50.00, 1 referral/1 converted/100%; **withdraw $50.00 → balance
$0.00** via the existing `Withdrawal`. (The on-chain mint at this exact hook point was proven on real BSC Testnet in
Phase 7 Wave D for owner earnings; broker commission is additive at the same line.)

**Flags (Wave B):** (1) NO platform-account ledger DEBIT models the commission "expense" — it's simply credited to
the broker (like the existing null-owner primary-sale case). (2) Broker `listings`/`performance` tabs stay MOCK (no
broker-listing model). (3) The referred-investor roster exposes the investor's name/email to their referring broker
(the frontend mock's own shape; the referral relationship is consensual) — investor phone is NOT exposed.
(4) `pending_commission`=0 (commission credits immediately at settlement; no pending state).

## Phase 13 — Reports-export (CSV + PDF over EXISTING self-scoped data) (COMPLETE ✅)
**Source of truth:** REPORTS_SURFACE.md. A reusable export service that renders ALREADY-served, self-scoped
data into a downloadable file — **NO new business logic, NO new figures**, just formatting. Unlocks the
Export/Download/Tax buttons that DASHBOARD_GAPS bucketed as `A-BLOCKED:reports-export`.

**Built (`apps/reports`, no models — on-demand, no FileField caching):**
- **Export service:** `export.to_csv(columns, rows)` (stdlib `csv`, UTF-8 **BOM** for Excel/Arabic) +
  `pdf.render_statement_pdf(title, period, columns, rows, meta, disclaimer)` — a generic ReportLab
  "statement" (header band + title/period/meta + paginated table + disclaimer footer), **REUSING the
  certificates' ReportLab + brand stack** ([certificates/pdf.py](backend/apps/certificates/pdf.py)); NO new PDF lib.
- **Per-context adapters** ([adapters.py](backend/apps/reports/adapters.py)) that fetch the caller's OWN data via the
  SAME querysets the page endpoints use: **wallet** (`BalanceTransaction`), **distributions**
  (`DistributionPayout` PAID), **owner-earnings** (mirrors `OwnerEarningsView`), **lp** (`LPTransaction`),
  **broker-commissions** (`commission_ledger()`). Figures match the existing endpoints exactly.
- **Endpoints** (`IsAuthenticated`, self-scoped, `FileResponse`): `GET /api/reports/<context>/export/?fmt=csv|pdf
  [&year=YYYY][&period=...]` + `GET /api/reports/distributions/tax/?year=YYYY` (PDF). **NB: the param is `fmt`,
  NOT `format`** — DRF reserves `?format=` for content negotiation and 404s on an unknown renderer.
- **Tax report = INFORMATIONAL annual distribution-income summary (PDF)**, NOT a legal tax form — carries an
  explicit "not a tax document / not tax advice / unaudited testnet" disclaimer.

**Frontend:** `reportsApi` (blob download from the `FileResponse` + `Content-Disposition` filename) + a shared
`useExport` hook (per-button spinner + EN/AR toast). **Buttons wired:** Wallet **Export** (CSV); Distributions
**Export Statement** (PDF) + **Tax Report** (tax PDF); OwnerReports + OwnerDashboard **Export** (owner-earnings
PDF); LPReports **Monthly/Quarterly/Annual** (LP PDF, period label) + **Export Data** (CSV); broker
**Commissions Export** (CSV — hits the REAL `commission_ledger` even though the Commissions.tsx *table* is still
mock). `/developers` untouched.

**Tests:** +10 reports tests, **full suite 380 green**. Self-scoped (a user can't export another's rows);
content-types (text/csv, application/pdf, `%PDF` magic); `year` filter; tax disclaimer; figures match the
existing data (no fabricated totals); auth required; unknown context → 404. Dev journey (real Postgres, rolled
back): wallet CSV = `distribution +840.00` / `withdrawal −200.00` (caller's real ledger, no other user's
`999.00`); distributions + tax PDFs valid; cross-user self-scope proven.

**Deferred (flagged — need a data layer first, NOT built):** **Reports.tsx "Export Full"** (its
portfolioMetrics/recentReports are all MOCK — needs a real portfolio-analytics source / report catalog) +
**Installments "Export Schedule"** (installments domain unbuilt). Both stay as-is.

**DASHBOARD_GAPS `A-BLOCKED:reports-export` — CLOSED** for: Wallet, Distributions (statement + tax),
OwnerReports, OwnerDashboard, LPReports ×4, broker Commissions. Still open (deferred): Reports.tsx, Installments.

## Platform state snapshot + NEXT (as of 2026-06-21 — all 6 roles COMPLETE; FINISHING phase underway)
Consolidated for compact-resilience — the per-phase sections above are authoritative; this is the index.

**DELIVERED — six full roles + broker onboarding (investor, LP, owner, developer, partner, broker[verification] + the admin reviewer), all proven on REAL BSC Testnet / dev:**
- **Investor** (Phase 3–4): KYC → custodial wallet → invest → **real on-chain token mint**; certificates (PDF+QR+public verify).
- **Payments** (Phase 5 W1/W2): **Stripe** (card) + **NOW Payments** (crypto), both **signature-verified-webhook/IPN-gated → mint** (no raw card data on server; never mint without a verified callback). Code-complete, inert until keys.
- **Liquidity Provider** (Phase 6 W1/W2): KYB (business Sumsub level) → activated LP; **LP market** with real on-chain settlement + escrow + internal balance.
- **Investor peer secondary market + withdrawal** (Phase 6 W3): real one-shot listings, on-chain peer transfer, custodial gas top-up, `UserBalance` withdrawal.
- **Owner** (Phase 7 A–D): entity **KYB → submit → admin review/publish (Property is_published F→T, model assigned) → earnings** (net-of-fees primary-sale credit, idempotent, withdraw).
- **Developer** (Phase 8 A–D): **COMPLETE, built by reusing owner machinery** — separate `DeveloperProfile` + `HasActivatedDeveloper` (Sumsub developer level; the shared signed webhook is now **4-way**: developer/owner/LP/investor by distinct level name); generalized `HasActivatedPropertySubmitter` gate (owner **or** developer submits the **same** wizard); review/publish + earnings were **submitter-agnostic → ZERO code change**, proven on testnet (developer credited net-of-fees, withdrew). **Committed + pushed: commit `eaefd58`.**
- **Distributions** (Phase 9): **COMPLETE** — admin declares a property cash-yield pool → split **pro-rata by full `token_amount`** across current ACTIVE holders (cent-exact, remainder to largest) → each holder's `UserBalance` credited (`source="distribution"`, **internal-balance only, NO on-chain move**), `total_distributions`/`last_distribution_date` bumped; idempotent (one payout per holder/distribution). `Distributions.tsx` repointed to `GET /api/distributions/`. DISTINCT from primary-sale earnings. Proven via the dev-DB journey ($1000 → $500/$300/$200, Σ cent-exact, withdrawn) + 15 tests. See "Phase 9" above.
- **Notifications** (Phase 10 + Phase 11 Wave B): **COMPLETE** — in-app notifications emitted server-side at **19 event points now** (Phase 10's 11: KYC/KYB, wallet, mint + earnings, distribution, secondary sale BOTH parties, withdrawal, submission publish/reject; **+ the 5 partner-workflow ones** from Phase 11 Wave B; **+ the 3 broker ones** from Phase 12: licence approved / rejected + **commission credited**), **inside each host's atomic block** (a `notify()` failure can't break the event — savepoint-wrapped). Stored as **type + params + action_url** (no display strings); the frontend renders EN/AR from i18n by type. Self-scoped read + unread-count + mark-read/mark-all + **soft delete**. Bell + sidebar show the live unread count; `Notifications.tsx` repointed off its mock. In-app only (no email/SMS/push; prefs deferred). See "Phase 10" + "Phase 11" above.
- **Partner (Phase 11 A+B): COMPLETE** ✅ — the SERVICE-VENDOR `role=partner` (thin NON-EARNING variant of
  owner/developer; **no money ever**). **Wave A:** activation path — separate `PartnerProfile` +
  `HasActivatedPartner` (Sumsub partner level; the shared signed webhook is now **5-way**: partner/developer/owner/
  LP/investor) + **two INDEPENDENT states** `kyb_status` (verification) and `directory_status` (public-directory
  visibility, a separate admin approve/reject step; partner self-enters the directory data, admin never does);
  public `GET /api/partners/directory/` + `Partners.tsx` repointed. **Wave B:** the work portal — admin ASSIGNS a
  `Property`→partner (service type + due date + admin-defined deliverables) → partner uploads deliverable docs +
  submits → admin approves / requests revision; DERIVED progress + DERIVED `AssignmentEvent` activity feed;
  `notify()` per transition (failure-safe); `StrategicPartners.tsx` repointed off its mock. +44 partner tests,
  full suite 334 green. See "Phase 11" above.
- **Broker (Phase 12 A+B): COMPLETE** ✅ — the formerly-STRANDED `role=broker` is now a full EARNING role.
  **Wave A:** HYBRID verification — identity reuses the investor `UserKYC` (webhook UNTOUCHED, no 6th resolver); a
  professional **LICENCE** on a thin `BrokerProfile` is approved by an **admin hinge gated on KYC approved** →
  `role_status` ACTIVE + `HasActivatedBroker`; SET-ONCE referral attribution (unique `referral_code` → `/ref/<code>`
  → `core.Profile.referred_by_broker`, first broker wins). **Wave B:** COMMISSION — `_credit_broker_commission`
  inside `mint_investment` credits the referring broker `commission_rate`% (default 5) of GROSS, **PLATFORM-borne +
  ADDITIVE** (owner net + investor tokens UNCHANGED), settlement-gated, idempotent (`source="broker_commission"`,
  one per investment), withdrawn via the existing `UserBalance`/`Withdrawal` stack; `GET /api/broker/commissions/`
  + `BrokerDashboard`/`Referrals` repointed off mock. +33 broker tests, full suite **367 green**. See "Phase 12".
- **Core infra:** custodial `KeyManager` (Fernet; KMS/HSM seam), `apps/chain` (web3 deploy+mint+transfer, gas top-up seam), shared `UserBalance`/`BalanceTransaction`/`Withdrawal` ledger reused by every role.
- **FINISHING phase (post-Phase-12, committed):** (1) **Investor `Wallet.tsx` repointed mock→real Django** — real
  `UserBalance` + new self-scoped `GET /api/wallets/balance/transactions/` ledger + withdrawals; legacy Supabase-OTP
  `WithdrawalDialog` swapped to the shared `OwnerWithdrawDialog` and the dead component **deleted** (cleanup (e)(a)
  CLOSED). (2) **Batch-1 quick-wins** wired to existing endpoints: Settings admin-gate off Supabase → `useAuth`;
  Dashboard Deposit/Documents routing; Referrals Copy/Share; Wallet & OwnerReports Refresh. (3) **Phase 13
  reports-export** — reusable CSV + ReportLab PDF over existing self-scoped data; **8 export surfaces wired**
  (wallet, distributions statement + tax, owner ×2, LP ×4, broker commissions). (4) **Broker `Commissions.tsx`
  table repointed** off mock → `brokerApi.commissions()`. Suite **380 green**, tsc clean. Surface docs:
  DASHBOARD_GAPS.md, FAMILY_SURFACE.md, REPORTS_SURFACE.md, SETTINGS_GAPS.md, INSTALLMENTS_SURFACE.md.
  Finishing also covered **Marketplace filters** (city/risk/min-investment + live facet counts) and
  **PropertyDetail** fake-trap cleanup (dead stepper, Add-to-Wallet, gated Verify-on-Blockchain).

- **INSTALLMENTS domain — STARTED (Wave A: plan + schedule model + read; NO money/mint).** A core investment
  model, now under a full domain build. **LOCKED ARCHITECTURE for later waves: token release = FULL-MINT-THEN-LOCK**
  — on down-payment the FULL `token_amount` is minted ONCE but locked, and a released amount grows as installments
  clear (the investor's "ownership growing" UI = released %, NOT N separate mints; reuses the `OwnershipToken`
  locked/released concept; matches the Nova Finance pledge notice). **NO progressive minting.** A missed installment
  leaves tokens locked (no on-chain clawback) — forfeiture is an internal-ledger concern in a later wave.
  **Wave A delivered** (`apps/installments`, new app): per-INVESTOR `InstallmentPlan` (FK investor + property,
  total/down/percent/n/installment_amount/frequency/duration/status `draft|active|completed|defaulted`) +
  `InstallmentPayment` child per scheduled installment (sequence/due_date/amount/status `pending|paid|missed`/paid_at),
  DISTINCT from the per-PROPERTY `properties.InstallmentSchedule` (advertised terms only). `build_installment_plan()`
  validates installment-eligibility (`Property.model == "installment"`) + computes a **CENT-EXACT** schedule
  (down + N equal installments of the financed remainder; final row absorbs the rounding remainder so
  `down + Σ installments == total` to the cent) → creates the plan `draft` + rows `pending`. **NO money, NO mint,
  NO token movement this wave** (asserted in tests: no BalanceTransaction / OwnershipToken / Investment / chain call).
  Self-scoped `GET /api/installments/plans/` + admin read; frontend `installmentsApi.plans()` + `useInstallmentPlans`
  → `Installments.tsx` repointed off its full mock (schedule view only; **"Pay Now" disabled + flagged "coming soon"**).
  **+9 installments tests, full suite 389 green, tsc clean.** Dev journey: $1000 @ 30% down, 3 monthly → down $300 +
  [$233.33, $233.33, $233.34] = $1000.00 exactly, read back via the API (draft, no money/mint), rolled back.
  **Wave B delivered — REAL money + on-chain mint (down-payment + FULL-MINT-THEN-LOCK):** the installment Checkout
  now charges ONLY the down-payment via the SAME settlement-gated PSP path (Stripe/NOW webhook→IPN), and on the
  CONFIRMED down-payment `mint_investment` mints the FULL `token_amount` in ONE on-chain tx but LOCKED — releasing only
  the down-payment's proportional share (`released = floor(down_paid/total × token_amount)`; FLOOR so never release
  unpaid tokens) and locking the remainder via the SAME `OwnershipToken.locked_amount` the LP/secondary markets honour
  (so locked installment tokens can't be listed/sold — proven). Reuse, not rebuild: `Investment` gained
  `is_installment` + `down_payment_amount` + `installment_plan` FK + a `charge_amount` property (= down for an
  installment, = full price normally) — the gated charge AND the owner/broker credits all scope to `charge_amount`,
  so **a normal buy is byte-identical** (charge_amount == amount_invested) and **owner-net + broker-commission credit
  ONLY on the amount actually paid (the down-payment)** — the CHOSEN cadence (flagged): credits accrue as money
  arrives; later installments credit their share (Wave C). Idempotent: the existing `tokens_minted` guard + keyed
  `BalanceTransaction` guards mean a replayed webhook mints once, credits once, never double-locks. On confirmation the
  plan flips draft→ACTIVE (`down_paid_at`). Frontend: Checkout reads `type`/`down`/`duration`/`frequency`, shows the
  down-payment due-now + schedule, charges via the existing card/crypto components (installments are gated → card/crypto
  only); the InstallmentCalculator button carries the terms; `Installments.tsx` + holdings show the released/locked
  split ("X of Y tokens released"). **+7 Wave B tests (full-mint-then-lock split, owner/broker credit-on-down only +
  idempotent, full-purchase UNCHANGED regression, locked-tokens-unsellable), full suite 396 green, tsc clean.** E2E
  (mocked chain): $1000 @ 30% down → **$300 charged**, full **10 tokens minted once → 3 released / 7 locked**, owner
  credited **$300 (not $1000)**, broker **5%×$300=$15**, replay idempotent.
  **Wave C delivered — per-installment gated payment + PROGRESSIVE release + distributions-on-released:** each
  scheduled installment is now a SEPARATE settlement-gated charge reusing the SAME Stripe/NOW machinery —
  `POST /api/installments/plans/<id>/pay-next/` (KYC-gated, self-scoped, ACTIVE-plan only) starts a Stripe intent / NOW
  payment for the next-due `InstallmentPayment.amount`; the `Payment` carries a new nullable `installment_payment` FK,
  so the SHARED webhook core (`payments.services._complete_payment`) ROUTES an installment payment to
  `installments.services.settle_installment_payment` instead of `mint_investment` — **NO second mint, NO clawback**. On
  confirmation, in ONE atomic block (plan row-locked → serialized per-plan): mark the row `paid`+`paid_at`;
  **progressively release** `released = floor(total_paid/total × token_amount)` by DECREMENTing `OwnershipToken
  .locked_amount` by the incremental tranche (rides ON TOP of any market-listing escrow — that escrow is paid-for and
  stays locked); credit owner-net + broker-commission on THAT installment's amount keyed on the `InstallmentPayment`
  id (its own idempotency, separate from the down-payment); and on the FINAL installment flip the plan `completed`
  (released == full). The Wave-B credit helpers were refactored into reusable `credit_owner_share` / `credit_broker_share`
  `(gross, reference)` cores so the down-payment/full path stays byte-identical. **Distributions-on-released DELIVERED:**
  `apps/distributions` now splits pro-rata by EARNING tokens = `token_amount − installment_locked_tokens(user, slug)`
  (the unpaid installment lock, computed from the authoritative plan rows — NOT the raw `locked_amount`, so market-listing
  escrow still earns); 0 for normal/fully-paid holders ⇒ **no regression** (existing distribution tests green unchanged).
  Frontend: `installmentsApi.payNext()` + a new bilingual `InstallmentPayDialog` (Stripe Elements card + NOW crypto,
  polls the plan until the paid count grows); `Installments.tsx` "Pay Now" is now ENABLED on ACTIVE plans (disabled with a
  hint until the down-payment confirms) and the stale "coming soon" banner is gone; new `installment_paid` notification
  (EN/AR). **+9 Wave C tests, full suite 405 green, tsc clean.** E2E (real service path, mocked chain): $1000 @ 30%, 3×,
  10 tokens — down→**3 released/7 locked**, pay #1 ($233.33)→**5/5** +owner $233.33, pay #2→**7/3**, pay #3 ($233.34)→
  **10/0 + plan completed**; owner credited across down+3 == **$1000.00** (fees 0); broker 5% per tranche == **$50.01**
  (per-tranche cent rounding ≈ 5%×$1000); replayed installment settles ONCE; a distribution declared mid-plan paid the
  30%-holder on 3 released tokens while a normal holder earned on their full position.
  **Wave D delivered — missed-payment DEFAULT + forfeiture → INSTALLMENTS DOMAIN COMPLETE (A→D):** default detection is a
  manually-runnable, idempotent management command `check_installment_defaults`
  ([apps/installments/management/commands](backend/apps/installments/management/commands/check_installment_defaults.py))
  — it marks overdue PENDING rows `missed`, then DEFAULTS any ACTIVE plan whose earliest unpaid installment is overdue by
  MORE than the grace period. **Grace = `settings.INSTALLMENT_DEFAULT_GRACE_DAYS` (default 30 days)** — env-configurable;
  not an instant default on the first late day. `services.default_plan(plan_id)` runs the forfeiture in ONE atomic block
  (plan row-locked, idempotent — an already-defaulted plan is a no-op): the investor **KEEPS the RELEASED (paid) tokens**
  (`kept = floor(total_paid/total × token_amount)`) and **FORFEITS the LOCKED (unpaid)** ones (`forfeited = token_amount −
  kept`); **NO money refund; NO on-chain clawback of kept tokens.** Plan → `defaulted` (+ `defaulted_at`, `forfeited_tokens`);
  remaining non-paid `InstallmentPayment` rows → new `cancelled` status (schedule voided). **Forfeiture representation
  (FLAGGED — ledger/position adjustment, no on-chain burn):** the OwnershipToken is reduced to the kept amount
  (`token_amount −= forfeited`, `locked_amount −= forfeited` so the kept tokens are fully unlocked/tradable) and the linked
  `Investment.token_amount` is reduced to kept, so the forfeited supply RETURNS to the property's pool (`investments
  .sold_tokens`/`available_tokens` recover). The forfeited tokens were already minted on-chain to the custodial wallet and
  PHYSICALLY remain there, but the platform LEDGER no longer credits them (so they can't be listed/sold via the
  platform) — an on-chain burn-back is deferred (mainnet/ops item, consistent with the existing "no on-chain clawback"
  stance). Distributions already accrue on RELEASED only (Wave C) and a defaulted plan is no longer ACTIVE, so a defaulted
  holder simply earns on their KEPT tokens — verified, no change needed. Frontend: `Installments.tsx` shows an honest
  defaulted banner ("plan defaulted; you keep X paid tokens; Y unpaid forfeited; remaining schedule voided"), Pay-Now
  doesn't render on a defaulted plan (no pending due row); new `installment_defaulted` notification (EN/AR); read endpoint
  surfaces `forfeitedTokens`/`defaultedAt`. **+7 Wave D tests, full suite 412 green, tsc clean.** Journey (real service
  path, mocked chain): $1000 @ 30%, down paid (3 released / 7 locked) → installments backdated past grace → run
  `check_installment_defaults` → **plan defaulted, 7 forfeited / 3 kept** (position + investment reduced to 3, 7 freed to
  supply), no refund (investor never credited), 3 schedule rows voided; **re-run → 0 defaulted (idempotent, no
  double-forfeit)**; within-grace → marked missed but NOT defaulted; on-time/completed/full-purchase flows untouched.
  **PRODUCTION-DEPLOY item (NOT built — like provider keys / mainnet audit):** schedule `check_installment_defaults` to run
  DAILY (cron or Celery beat); the command is safe to run repeatedly. **Wave D was the last installments wave.**
  **Open flags to preserve:** (1) installment FEES — installments are charged EX-FEES in v1 (down + each installment;
  mirrors the full flow, where fees come off the owner's net); (2) MERGED OwnershipToken positions — one slug holding a
  full buy + an installment share a single `locked_amount` (the Wave-C release decrements by the plan's computed tranche,
  so it's robust to listing escrow; revisit only if a user runs a full buy AND an active installment on the same slug);
  (3) per-tranche rounding — owner/broker credit each tranche to the cent, so the sum can differ from a single-shot
  computation by a rounding cent (correct for accrue-as-paid).

**➡️ ALL 6 ROLES COMPLETE (investor/LP/owner/developer/partner/broker).** Latest on `origin/main` = **`e58190a`**
(finishing cleanup: dead WithdrawalDialog removed + broker Commissions repoint). Phase 12 A+B, Phase 13, and all
finishing work are committed/pushed.

**NEXT PLANNED BUILD = finish the INVESTOR dashboard, page by page** — sweep each investor-facing page to wire its
remaining stubbed/mock controls to existing endpoints (per DASHBOARD_GAPS.md). The Settings page is scoped next
(SETTINGS_GAPS.md: PATCH /auth/me + authenticated change-password + logout-all; notif/2FA/currency toggles deferred
local-only).

## REINVESTMENTS — DELIVERED (balance-funded buy; bonuses/Pronova DEFERRED) ✅
**Source of truth:** REINVESTMENTS_SURFACE.md. Reinvestment = a MANUAL, balance-funded buy: spend the investor's
accrued internal balance (distribution/sale yield in `UserBalance`) to buy more tokens of ANY property via the
EXISTING invest+mint path — funded from balance, **NO new PSP charge**. Built by adding the missing funding seam, not a
new domain.
- **The seam (`investments/services.py`):** new `payment_method="balance"` (`BALANCE_METHOD`). Inside `create_investment`'s
  atomic block, after the Investment row is created, it `debit_user_balance(user, amount, source="reinvestment",
  reference=inv.id)` — an `InsufficientBalance` is caught and re-raised as a DRF 400, rolling the whole creation back
  (nothing moves). The successful debit IS the settlement (money already in-ledger) → `balance` is NOT in
  `WEBHOOK_PAID_METHODS`, so it takes the same auto-complete + **real on-chain mint** path as a settled buy. Idempotent
  via the existing `tokens_minted` guard (the debit happens once in create, never in mint replay). **Same price/fees/owner
  + broker credit as a normal buy** — it IS a normal buy, balance-funded; no special-casing.
- **History (no new model):** reinvestments are just Investments with `payment_method="balance"` as the marker.
  `GET /api/investments/reinvestments/` (self-scoped) shapes them for the History tab; available balance reuses
  `/api/wallets/balance/`. KYC is enforced upstream by `InvestmentCreateView` (all methods, unchanged).
- **Bonuses DEFERRED (flagged):** the page advertised a **5% reinvest discount + 2% Pronova bonus + reduced fees** with
  NO backend and NO Pronova integration anywhere. All of it is deferred as an **undefined product decision** (needs client
  definition). Reinvestment buys at the SAME price/fees as any purchase (`discount_amount` always 0). Frontend: the
  Reinvestment "Bonuses" tab is replaced with an honest **"Coming soon"** card; the Overview bonus-math block is removed;
  mock `availableReturns=$5000` → the real `UserBalance`; history repointed Supabase→Django.
- **Working flow (faithful to the page's CTA):** Checkout now offers a real **"Pay from Balance"** payment method
  (`PaymentMethodSelector`), shown when the user has a balance and disabled when it's < the buy amount; `?reinvest=true`
  pre-selects it. The Reinvestment CTA → Marketplace → pick property → "Pay from Balance" at checkout → balance-funded
  mint. (The old dead `?reinvest=true` is now consumed at Checkout.)
- **+9 tests, full suite 421 green, tsc clean.** E2E (real service path, mocked chain): investor with $1000 balance →
  reinvest 5 tokens of a $100-token property → balance debited **exactly $500** (→ $500 left, keyed DEBIT ledger entry) →
  **5 tokens minted (real)**, owner credited **$500** (fees 0), broker (if referred) **$25** (5%); a $100-balance attempt
  to buy $500 → **rejected (InsufficientBalance, rolled back — no investment, no debit, no mint)**; replay → no double
  debit/mint; NO PSP `Payment` row; card buys UNCHANGED.
- **Flags:** (1) bonuses/discount/Pronova mechanics undefined — client product decision (the only deferral). (2) The
  Checkout still DISPLAYS fees-inclusive `totalPayable` while the backend debits the base `amount_invested` (units×price) —
  a PRE-EXISTING frontend fee-display nuance affecting all simulated methods (the balance gate + method panel show the
  real debited amount). (3) `availableReturns` reads `UserBalance` (withdrawable proceeds) — a buyer can choose between
  reinvesting and withdrawing the same balance, as intended.

## FAMILY accounts — Wave A DELIVERED (records + allocation, NO money); B/C/D DEFERRED
**Source of truth:** FAMILY_SURFACE.md. A primary investor designates family MEMBERS, allocates a % of returns to each,
links their banks, and configures transfer schedules. **Wave A = the SAFE foundation: records + allocation config ONLY —
NO money, NO token movement, NO bank payout, NO distribution skim.**
- **Backend `apps/family` (was an empty stub) now has the 4 models** mirroring the old Supabase tables: `FamilyAccount`
  (investor FK = PRIMARY investor only; members are **passive SUB-RECORDS** — no User/KYC/wallet), `FamilyBankAccount`
  (**MASKED last-4 only** — full number/IBAN masked server-side via `services.mask_tail`, NEVER persisted),
  `FamilyTransferSchedule` (cadence config), `FamilyTransaction` (**record-only** activity log). Self-scoped CRUD API at
  `/api/family/` (accounts + banks + schedules + transactions), mounted in config/urls. Admin registered (banks show only
  the mask).
- **Allocation persisted + ≤100% rule:** the Allocations tab (toast-only before) now saves `allocated_returns_percent`
  via PATCH; `services.assert_allocation_within_limit` rejects any change that pushes the investor's member total over
  100% (own slice excluded on update). **NO auto-skim hook on distributions** (that's Wave B).
- **Record-only transfer:** POST `/api/family/transactions/` writes a `pending` FamilyTransaction (server-generated
  `FT-…` reference) and moves **NOTHING** — no `BalanceTransaction`, no token transfer, no `Withdrawal`; `total_transferred`
  stays 0. The Transfers tab is honest ("recorded now — execution comes later"); the hardcoded transfer-history array was
  replaced with the real records; the false "blockchain-secured" copy was softened (only the last-4 masking + activity log
  are real).
- **Frontend repoint:** `useFamilyAccounts.ts` dropped the Supabase import → `familyApi` (Django). FamilyMemberCard's
  existing mutations (bank-link, schedule, access-level, transfer) now hit Django unchanged.
- **+9 tests, full suite 430 green, tsc clean.** Journey: investor adds a member → sets allocation (persists; 60+50 → 400
  rejected, 60+40 → ok) → links a bank (`1234567890123456` → stored `****3456`, full number never in response/DB) → records
  a transfer (`pending` FamilyTransaction, **no money/token/Withdrawal moved**, total_transferred stays 0); a second
  investor gets **404** on those rows (self-scoped).
- **⚠️ CORRECTION (honesty):** family was NOT "the last Supabase dependency." Family's data layer is now Django, BUT
  satellite hooks/pages still import Supabase. Surveyed in `SUPABASE_CLEANUP.md` (per-surface: existing-Django? / live? /
  classification). Result: **0 repointable-now (no surface has an existing Django backend to swap onto), 1 dead, 7 deferred
  mini-domains** — Supabase is **not** fully removed (still incl. the `integrations/supabase/client` + `lovable` shims).
  - **DELETED (the 1 dead surface):** `useWithdrawalRequests` — grep-confirmed **zero importers** across `src/` (only its
    own export); the withdrawal flow already runs on `walletsApi.requestWithdrawal` via `OwnerWithdrawDialog` →
    `apps.wallets.Withdrawal`. File **`git rm`'d**, tsc clean, no dangling import. Its Supabase OTP edge-function calls
    (`send/verify-withdrawal-otp`) died with it — **OTP-on-withdrawal is a deferred enhancement, NOT a repoint** (the
    Django withdrawal flow has no OTP step).
  - **7 DEFERRED mini-domains (each needs a NEW Django model/endpoint — no existing backend to repoint to), grouped:**
    - **payout-destinations + audit (build together):** `useInvestorBankAccounts` (`bank-accounts`) + `useInvestorCryptoWallets`
      (`crypto-wallets`) + `AuditLog` (`audit-log`) — the first two are the *writers* of `payment_method_audit_log`, the page
      is the *reader*; they pair with the existing withdrawal `method` field. **⚠️ FIX TO APPLY when `bank-accounts` is built:**
      the current hook masks the account number **in the browser** and sends the FULL number to Supabase — the Django version
      MUST mask **server-side** (copy Family Wave A's `services.mask_tail`; store last-4 only, never persist the full number).
    - **cards:** `useSavedCards` (`saved-cards` — back with Stripe SetupIntent, don't vault card data ourselves) and
      `useVisaCards` (`visa-cards` — largest: real card issuing + spend rail + a second balance ledger; needs an issuing
      provider; lowest priority).
    - **pwa-settings + owner-docs (independent, small):** `usePWASettings` (`pwa-settings` — trivial singleton config model) and
      `useOwnerDocuments` (`owner-documents` — model + `media/` file storage + self-scoped signed download; = the existing
      "property-documents" satellite below).
- **DEFERRED — Waves B/C/D, gated on TWO CLIENT PRODUCT DECISIONS:** (1) **members as real KYC'd users with custodial
  wallets vs passive sub-records** — gates Wave B (internal `UserBalance`→balance transfer + optional distribution skim)
  and Wave C (on-chain Ownership-Token transfer via the existing `chain.service.transfer`); (2) **bank payout** — Wave D
  is **blocked on a missing external-payout provider** (Stripe/NOW are pay-in only; `Withdrawal` is operator-fulfilled), so
  a real automated bank transfer is record-only / deferred to a future provider integration.

**STILL DEFERRED (need their own data layer / scope decision — NOT built):** **family Waves B/C/D** (Wave A BUILT — see
above), **deposit / top-up** + **broker payment-method** (no endpoint), **Reports.tsx "Export Full"** (mock analytics), and
the **bid/ask ORDER BOOK + matching engine** (**DEFERRED BY USER DECISION — explicitly out of this stage**; peer market
ships real one-shot listings today, order-book i18n preserved so it can return), and the **small satellite mini-domains**
(no backend) flagged in DASHBOARD_GAPS.md:
**GlobalStats** (Marketplace's hardcoded platform stats → needs a stats-aggregation endpoint), **property-documents**
(PropertyDetail/DataRoom doc preview/download/verify + the doc "Verify" buttons — no document storage/serving), and
**favorites** (Add-to-Favorites). *(No longer deferred: reports-export — BUILT in Phase 13.)*

## Partner domain — COMPLETE ✅ (Wave A: KYB + directory; Wave B: assignment/deliverable workflow)
**Source of truth:** PARTNERS_SURFACE.md (+ its "Wave detail" section). **BOTH waves are BUILT — see "Phase 11"
above.** The partner is a **SERVICE VENDOR** — a
valuation / property-management / insurance firm the admin assigns work to. It is a **thin, NON-EARNING variant
of owner/developer**: it reuses the KYB + document-upload + activation machinery but has **NO money flow — no
`UserBalance`, no `Withdrawal`, no commission, EVER** (the frontend has zero money fields for partners). `role=
partner` existed in core (`Profile.Role.PARTNER`, self-selectable, requires verification) but was **STRANDED** —
no activation path — exactly the gap the developer role had pre-Phase-8; **Wave A (Phase 11) FIXED it.**

- **Two INDEPENDENT partner states** (key decision): `kyb_status` (gates the Wave-B work portal, mirrors developer
  KYB) **and** `directory_status` (`pending|approved|rejected`, gates appearing in the public `Partners.tsx`
  directory). They are **independent** — a partner can be KYB-verified yet NOT directory-approved, or vice-versa.
- **The partner fills their OWN company details** (`company_name`/`_ar`, `category`, `description`/`_ar`,
  `logo_url`, `country`/`_ar`, `website`). **The admin NEVER enters directory data** — the admin only
  approves/rejects directory visibility (`directory_status`). The public directory endpoint lists ONLY
  `directory_status == approved` partners.

- **Wave A — DONE ✅ (Phase 11):** partner KYB — separate **`PartnerProfile`** (mirrors `DeveloperProfile` KYB
  shape: status + kyb_status machine + `sumsub_applicant_id` + `mark_kyb_submitted`/`mark_approved`), **plus** the
  self-entered directory fields + `directory_status`. **`HasActivatedPartner`** gate. The shared signed Sumsub
  webhook is now **5-WAY** (partner + developer + owner + LP + investor, routed by distinct level name
  `SUMSUB_PARTNER_KYB_LEVEL_NAME`). `dev_grant_partner_kyb` (DEBUG-only). Public directory read endpoint
  (`directory_status==approved` only) + `Partners.tsx` repointed off its mock. Keys deferred/inert. See "Phase 11".
- **Wave B — DONE ✅ (Phase 11):** the **assignment / deliverable workflow** — **`Assignment`** (admin assigns a
  `Property` → partner with a `service_type` (valuation/property-management/insurance) + `due_date` + admin-
  defined deliverables); partner **uploads deliverables** via the `SubmissionDocument`-style **`DeliverableDocument`**;
  admin **approves / requests revision** (status: `pending→in-progress→submitted→approved`, `revision` side-state);
  **activity feed DERIVED from append-only `AssignmentEvent` rows**; **`progress` DERIVED** from deliverable
  statuses (not stored); `notify()` (Phase 10, 5 new types) at each transition (failure-safe). **ONE-WAY — NO
  messaging**; the `revision` status + an admin `review_notes` is the only admin→partner channel. `StrategicPartners.tsx`
  repointed off its mock. NON-EARNING (no money model/credit anywhere). See "Phase 11" above.

## Governance & roadmap (standing — keep across compacts)
- **(a) Mainnet gating (REQUIRED).** Before any mainnet / real funds: (1) a **professional
  smart-contract AUDIT**, and (2) custodial keys moved to **KMS/HSM with hot/cold separation**
  (the KeyManager abstraction is the seam). Separate workstreams + budget lines. Also pending:
  the live BSC-Testnet deploy is DONE; remaining properties deploy on demand. (3) **Custodial gas
  funding seam:** secondary-market transfers are seller-signed, and because custodial wallets hold
  0 native BNB the deployer tops up exactly the gas per transfer (`apps/chain.service._fund_gas_if_needed`).
  For mainnet this must become a proper **funded relayer / gas-station** (the helper is the single seam).
  (4) **On-chain burn-back of FORFEITED installment tokens** (Installments Wave D): a defaulted plan forfeits the
  unpaid/locked tokens as a LEDGER/position adjustment only — the tokens were already minted on-chain to the custodial
  wallet and physically remain there. A real on-chain burn / return-to-treasury is DEFERRED to mainnet/ops (a reconciliation
  seam, consistent with the "no on-chain clawback" decision); the platform ledger already stops crediting them.
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
  - **Distributions domain — COMPLETE** ✅ (Phase 9): admin-declared, pro-rata-by-`token_amount`, cent-exact,
    internal-balance cash credit (`source="distribution"`, NO on-chain move), idempotent; `Distributions.tsx`
    wired to `GET /api/distributions/`. Separate from owner/developer primary-sale earnings. See "Phase 9" above.
  - **Notifications domain — COMPLETE** ✅ (Phase 10): in-app notifications emitted server-side at all event
    points inside their atomic blocks (notify-failure-safe), type+params+i18n, self-scoped read + bell/page wired,
    soft delete. See "Phase 10" above.
  - **Partner domain — COMPLETE** ✅ (Phase 11 A+B): SERVICE-VENDOR role, thin NON-EARNING variant of owner/
    developer (NO money/`UserBalance`/withdrawal). Wave A = partner KYB (`PartnerProfile`, `HasActivatedPartner`,
    5-way webhook) + INDEPENDENT `directory_status` (partner self-enters company details; admin only approves
    directory visibility) + public directory endpoint. Wave B = admin-assigns-`Property`→partner assignment/
    deliverable workflow (`Assignment` + `Deliverable` + `DeliverableDocument` + append-only `AssignmentEvent`,
    admin approve/request-revision, DERIVED activity feed + progress, `notify()` per transition, one-way comms).
    See the "Phase 11" + "Partner domain" sections above.
  - **Broker domain — COMPLETE (Phase 12 A+B)** ✅ — broker IS earning → MONEY domain. **Wave A:** HYBRID
    verification (identity reuses investor `UserKYC`, webhook UNTOUCHED; a LICENCE on a thin `BrokerProfile` approved
    by an admin hinge gated on KYC → `role_status` ACTIVE) + SET-ONCE referral attribution (`referral_code` →
    `/ref/<code>` → `core.Profile.referred_by_broker`). **Wave B:** commission — `_credit_broker_commission` inside
    `mint_investment` credits the referring broker `commission_rate`% (default 5) of GROSS, **PLATFORM-borne +
    ADDITIVE** (owner net + investor tokens unchanged), settlement-gated, idempotent, withdrawn via the existing
    `UserBalance`/`Withdrawal` stack; `GET /api/broker/commissions/` + dashboards repointed off mock.
  - **NEXT — finish the investor dashboard page by page** (wire remaining stubs to existing endpoints; Settings
    scoped next — SETTINGS_GAPS.md). Remaining MOCK domains still deferred: family, reinvestments, installments
    (each needs its own data layer); then the **bid/ask order book** (deferred, below). **reports-export is BUILT
    (Phase 13)** — no longer pending.
  - **Bid/ask ORDER BOOK + matching engine** (price discovery / partial fills) the mock
    `SecondaryMarket.tsx` implied — **DEFERRED, separately-scoped future wave, NOT the immediate
    next** (SPEC §7C.1; SECONDARY_MARKET_SURFACE.md). The peer market now ships real one-shot
    listings; the order-book i18n keys/structure are preserved so it can return.
  - **Remaining mock domains** — family, reinvestments, installments — each currently frontend-only mock
    (SPEC §3.12 / §4.4); plus deposit/top-up + broker payment-method (no endpoint). (No longer mock: LP + investor
    secondary markets — Phase 6 Wave 2/3; **distributions — Phase 9**; **notifications — Phase 10**; **partners —
    Phase 11 A+B**; **broker — Phase 12 A+B** incl. the `BrokerDashboard`/`Referrals`/`Commissions` numbers;
    **investor wallet — finishing repoint**; **reports-export — Phase 13** [8 surfaces].)
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
    `SUMSUB_DEVELOPER_KYB_LEVEL_NAME` set (so the **five-way** shared webhook routes developer vs partner vs
    owner vs LP vs investor by distinct level name). (Inert until keys land.)
  - **Sumsub partner KYB (Phase 11 Wave A, Strategic Partner — BUILT):** the partner business level extends the
    shared webhook to **FIVE-way** (partner vs developer vs owner vs LP vs investor), via the SEPARATE
    `SUMSUB_PARTNER_KYB_LEVEL_NAME`. Same automatic-approval pattern; routing + isolation proven by tests. With
    keys → real WebSDK business verification + the REAL `applicantReviewed` webhook → partner approved + role
    activated. (Inert until keys land. NOTE: directory visibility is a SEPARATE admin step, not provider-driven.)
  - **OAuth (Google/Apple):** social login scaffolded, inert until provider keys land (pre-existing).
- **(e) Cleanup / tech-debt (recorded — not lost):**
  - **(a) Duplicate withdrawal flow on INVESTOR pages — CLOSED ✅ (Phase 12 finishing).** The investor
    `Wallet.tsx` has been **repointed off mock to the real Django wallet backend** and now uses the **same
    `OwnerWithdrawDialog` → `POST /api/wallets/withdrawals/`** flow as the owner wallet. The legacy Supabase-OTP
    `WithdrawalDialog` is **removed from the investor wallet**, and the dead `src/components/wallet/WithdrawalDialog.tsx`
    component was **DELETED** in the finishing cleanup (commit `e58190a`). The investor wallet
    now reads the **real `UserBalance`** (`GET /api/wallets/balance/`), the **real internal-balance ledger**
    (new self-scoped read-only `GET /api/wallets/balance/transactions/` — distribution credits / secondary-sale
    proceeds / broker commission / withdrawals, correct credit/debit signs + bilingual source labels) and the
    **real `Withdrawal` list**; Refresh refetches all three. Investor wallet now MATCHES the owner wallet on
    Django. (Deposit/top-up + Export remain mock — no deposit/report-export endpoint; flagged below.)
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
  - **(e) Internal "owner" naming now also serves developers (Phase 8 Wave C+D).** (Partners are NON-earning, so
    they do NOT touch this earnings code.) The primary-sale credit
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