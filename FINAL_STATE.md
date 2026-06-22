# FINAL_STATE.md — Capimax BRX stage-closing handoff

**Latest commit:** `790a975` (on `origin/main`) · **Backend:** Django 5.2 + DRF + SimpleJWT, 23 apps,
PostgreSQL · **Chain:** BSC Testnet (chain 97), web3.py, custodial Fernet-encrypted wallets ·
**Frontend:** React/Vite/TS, bilingual EN/AR · **Tests:** full suite **443 green** (last run).
**Authoritative record:** `DECISIONS.md` (1932 lines) — this file is an organized index over it, not a
replacement; when in doubt, DECISIONS.md wins.

## What a new engineer / the client should know

Capimax BRX is a **real-estate tokenization platform handling REAL MONEY and REAL on-chain tokens**, so
every money/mint path is built to minting-grade safety: **settlement-gated, idempotent, server-side,
never minted before payment settles.** The **frontend was the source of truth** throughout — the backend
was built to serve the existing UI without changing its behaviour/UX. All six user roles and the full
investor lifecycle are **functionally complete and tested on BSC Testnet**. What remains is **not
half-built features** — it is (1) work the **client must make product decisions on**, (2) work
**explicitly deferred out of this stage by user decision**, (3) work **blocked on an external payout
provider**, and (4) a known set of **deploy/governance gates** (live provider keys, mainnet custody/audit,
a cron scheduler). The platform runs end-to-end today on testnet with dev/test payment paths; going to
production is a **governed cutover**, not more feature-building. Do not touch `/developers` (out of scope).

---

## 1. DELIVERED

### The 6 roles
- **Investor** — KYC (Sumsub-wired, dev approval path), custodial wallet auto-created on approval, buy
  tokens (card via Stripe / crypto via NOW Payments / **balance** via reinvestment), real on-chain mint,
  receive distributions, reinvest, sell on the secondary market, withdraw proceeds.
- **Liquidity Provider (LP)** — KYB (business-level Sumsub, automatic via signed webhook; form dev-path),
  bank/crypto payout details, LP market listings + holdings, withdrawals, document vault.
- **Owner** — property submission (draft → required-docs → submit), publish, primary-sale **earnings**
  (net proceeds credited on each completed sale), withdrawals, owner dashboard.
- **Developer** — entity KYB (4-way webhook routing), shares the property-submission gate with owners
  (`HasActivatedPropertySubmitter`), publish + earnings as-is.
- **Partner** — verification, **admin-assigned** property work, deliverable upload → admin review →
  approve/revision, derived progress + activity feed, per-transition notifications.
- **Broker** — hybrid verification (UserKYC + license admin-hinge), set-once referral attribution, and a
  **platform-borne 5% additive commission** on referred investors' completed primary sales
  (settlement-gated, idempotent), commission ledger + dashboard.

### Investor lifecycle (end-to-end, on testnet)
invest → **pay** (Stripe card / NOW crypto / internal balance) → **settlement-gated real on-chain mint**
(`mint_investment`, idempotent via `tokens_minted` guard; credits owner-net + broker commission in the
same atomic block) → **distributions** (declared by admin, split by earning tokens) → **reinvest** (buy
from internal balance) → **secondary sale** (peer market, real on-chain token transfer + atomic
balance settlement) → **withdraw** (debits `UserBalance`, operator-fulfilled request).

### Payments & rails
- **Stripe** (card) + **NOW Payments** (crypto) — both resolve to the single gated hook
  `_complete_payment` → `mint_investment`. Signed webhook / IPN verified. **Code-complete; inert until
  live keys** (dev-simulate paths used for testing).
- **`apps/chain`** — web3 deploy + mint + ERC-20 transfer; custodial wallet signer; gas-top-up seam.
- Shared ledger: `UserBalance` / `BalanceTransaction` / `Withdrawal`, reused by every role.

### Both secondary markets
- **LP market** (`apps/lp`) — listings, escrow, internal balances, real on-chain settlement.
- **Peer secondary market** (`apps/secondary_market`) — mirrors LP; real one-shot listings, on-chain
  transfer + atomic debit/credit, KYC-gated, investor withdrawal. (Bid/ask order book deferred — see §2b.)

### Distributions
`apps/distributions` — admin declares a distribution; payouts split by **earning tokens** = token_amount
− installment-locked tokens (computed from authoritative plan rows, so market-listing escrow still earns).

### Notifications
`apps/notifications` — `Notification` model + `notify()` helper wired at all emit points across roles
(KYC, sales, assignments, installments, commissions…), bell + sidebar + bilingual i18n.

### Installments (Waves A–D, complete)
**FULL-MINT-THEN-LOCK:** on a confirmed down-payment the full token_amount is minted **once but LOCKED**;
each per-installment gated payment **progressively releases** `floor(paid/total × tokens)` (no progressive
minting). Per-installment owner + broker credit. **Distributions accrue on released tokens only.** Wave D:
scheduled-command default detection (30-day grace) + forfeiture (keep released / forfeit locked / no refund
/ void pending). Locked tokens earn nothing until released.

### Reinvestments
Balance-funded buy (`payment_method="balance"`): debit `UserBalance` → real mint, **same price + owner/
broker credit as a normal buy**, idempotent, no PSP. History via an Investment marker. Checkout "Pay from
Balance". *(Bonuses/Pronova deferred — see §2a.)*

### Family (Wave A)
4 Django models (members are **passive sub-records** — no User/KYC/wallet), self-scoped API, **masked
last-4 bank storage** (server-side `mask_tail`, full number never persisted), allocation-persist (≤100%),
**record-only** transactions (no money/tokens move this wave).

### Reports-export
Reusable CSV + ReportLab PDF statement service over existing self-scoped data; **8 export surfaces** wired.

### Finishing work
Investor `Wallet.tsx` repointed mock→real (real `UserBalance` + self-scoped transaction ledger +
withdrawals); legacy Supabase-OTP `WithdrawalDialog` removed (dead component deleted); Marketplace filters;
PropertyDetail trap-neutralization; broker Commissions table repointed to the real ledger; batch quick-wins.

### Supabase-cleanup mini-domains (this stage)
- **owner-documents** — repointed to Django `apps.owner_documents` (mirrors `LPDocument`: self-scoped
  vault, `FileField` under gitignored `backend/media/`, owner-only `FileResponse` blob download) **+
  server-side type/size validation** (pdf/doc/docx/jpg/jpeg/png, 10 MB).
- **pwa-settings** — repointed to Django `apps.pwa`: a **singleton** config (pk-pinned, no duplicates),
  **public GET** (branding + install gate), **admin-only PATCH/PUT** (`IsAdminRole`).
- Net: **dead `useWithdrawalRequests` deleted** + these two built → **Supabase surfaces down to 5**
  (survey in `SUPABASE_CLEANUP.md`; owner-docs detail in `OWNER_DOCUMENTS.md`).

---

## 2. DEFERRED — grouped by REASON (the key handoff section)

### (a) Pending CLIENT product decisions
- **Family Waves B/C/D** — gated on **two client decisions**: (1) are members **real KYC'd users with
  custodial wallets**, or passive sub-records? — gates Wave B (internal balance→balance transfer + optional
  distribution skim) and Wave C (on-chain Ownership-Token transfer via `chain.service.transfer`); (2) the
  **bank-payout provider** for Wave D (also see §2c). Wave A foundation is built and safe.
- **Reinvestment bonuses / Pronova token** — no backend, no defined Pronova token; flagged as an
  **undefined product decision**. The "Bonuses" tab is an honest "Coming soon"; reinvestment itself works.

### (b) Deferred by USER decision (explicitly out of this stage)
- **Bid/ask ORDER BOOK + matching engine** — the peer market ships **real one-shot listings** today;
  order-book i18n is preserved so it can return. Out of this stage by user decision.
- **Cards mini-domains** — **`visa-cards`** (card issuing + spend rail + a second balance ledger) and
  **`saved-cards`** (Stripe SetupIntent-backed vault). Out of this stage by user decision; both keep their
  current Supabase behaviour until a future stage. *(2 of the 5 remaining Supabase surfaces.)*

### (c) Blocked on an external provider (no rail exists yet)
- **Payout destinations** — **`bank-accounts`** + **`crypto-wallets`** (investor external payout
  destinations) + **`audit-log`** (the reader of the `payment_method_audit_log` those two write). Need a
  real bank/crypto **payout rail**; `bank-accounts` must also adopt **server-side masking** (copy Family's
  `mask_tail`) when built. *(3 of the 5 remaining Supabase surfaces.)*
- **Family Wave D bank payout** — same external-payout-provider gap (Stripe/NOW are pay-in only;
  `Withdrawal` is operator-fulfilled).
- → **The 5 remaining Supabase surfaces map entirely onto (b) + (c):** `useVisaCards`, `useSavedCards`
  [b]; `useInvestorBankAccounts`, `useInvestorCryptoWallets`, `AuditLog` [c].

### (d) Remaining satellite mini-domains (no backend yet; small, independent)
- **GlobalStats** — Marketplace's hardcoded platform stats → needs a stats-aggregation endpoint.
- **property-documents** — the PropertyDetail **data-room + "Verify Documents" buttons** (currently a
  hardcoded static array). **Distinct from owner-documents** (that is a private owner vault) — confirmed in
  `OWNER_DOCUMENTS.md`; building one does not wire the other.
- **favorites** — saved properties.
- **deposit / top-up** — funding the internal balance directly (+ a broker payment-method surface).

---

## 3. PRE-DELIVERY / DEPLOY GATES (governance)

- **Live provider keys (REQUIRED pre-delivery test).** Stripe / NOW Payments / Sumsub (KYC+KYB) / OAuth are
  **code-complete and inert** until keys are configured. A **live-key end-to-end test** (real charge →
  signed webhook → mint; real KYC/KYB review → activation) is a **required pre-delivery gate** — the
  dev-simulate paths must be exercised against real keys before go-live.
- **Mainnet gates** (testnet → mainnet is a separate, audited cutover):
  - **Smart-contract audit** + **production key custody (KMS/HSM)** — replace the dev Fernet `KeyManager`.
  - **Gas-station / relayer seam** — fund custodial gas at scale.
  - **On-chain burn-back of FORFEITED installment tokens** — Wave D currently frees forfeited supply in the
    DB; a real on-chain burn / return-to-treasury is deferred to mainnet/ops.
- **`check_installment_defaults` scheduler** — the management command is **built and idempotent**
  (`--grace-days`/`--today`/`--dry-run`); **scheduling it daily (cron / Celery beat) is a deploy step** not
  yet wired.
- **Fable 5 + Dynamic Workflows pre-delivery security review** — reserved as a final review pass before
  delivery.

---

*Companion docs: `DECISIONS.md` (authoritative), `SUPABASE_CLEANUP.md` (the 5 remaining surfaces),
`OWNER_DOCUMENTS.md`, `FAMILY_SURFACE.md`, `REINVESTMENTS_SURFACE.md`, `DASHBOARD_GAPS.md`.*
