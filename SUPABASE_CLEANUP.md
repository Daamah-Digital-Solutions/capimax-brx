# SUPABASE_CLEANUP.md — the remaining Supabase-backed surfaces

> ## ✅ FINAL STATUS — SUPABASE FULLY REMOVED (deploy prep, testnet soft-launch)
> **Decision (owner): no external datastore ships. Supabase is gone entirely — the project is 100% Django-backed.**
> The last 5 Supabase-only surfaces had **no Django backend**, so removing Supabase removed those UI surfaces
> too (accepted for the soft launch; they become a **future Django build** — a production gate, NOT a Supabase
> dependency): **investor bank accounts, investor crypto wallets, saved cards, visa cards, payment-method audit log**.
>
> **Deleted:** `src/integrations/supabase/*` (client + types), `src/integrations/lovable/*` (dead Supabase-auth
> shim), the 4 hooks + `AuditLog.tsx` + `Cards.tsx`, the 6 wrapper components (Bank/Crypto/Saved/Visa managers +
> CreateCardDialog + CreateVirtualCardButton), the root `supabase/` dir (config + 6 edge functions + 28 SQL
> migrations), `bun.lockb`, and the deps `@supabase/supabase-js` + `@lovable.dev/cloud-auth-js`. Routes `/cards`
> + `/audit-log` and their nav entries removed; the Supabase Payment-Methods mounts removed from `/wallet`,
> `/owner-wallet`, `/lp`, broker, and portfolio — **every Django-backed wallet feature (balance, deposit,
> withdraw, totals, ledger, reinvest, earnings) kept fully working.** Frontend now reads **only**
> `VITE_API_BASE_URL` (no `VITE_SUPABASE_*`). Verified: 0 functional `supabase` refs in `src/`, `tsc` clean,
> `npm run build` clean (no `VITE_SUPABASE` in bundle), backend suite **523 green**.
>
> The survey below is retained as the historical record of how these surfaces were classified.

---

READ-ONLY survey (no fixes). Covers the 8 hooks/pages still importing
`@/integrations/supabase/client`. For each: what it does, whether a Django backend
already exists, and a classification — **(A) repointable now**, **(B) needs a backend
(defer)**, **(C) dead/unused (delete)**.

**Verified facts (greps):**
- Supabase imports remain in exactly these 7 hooks + 1 page (grep `supabase` in `src/hooks`, `src/pages`).
- Django has NO model for `visa_cards`, `card_transactions`, `wallet_balances`, `payment_methods`
  (saved cards), `pwa_settings`, `owner_documents`, `investor_bank_accounts`,
  `investor_crypto_wallets`, `payment_method_audit_log` (grep over `backend/apps/*/models.py` → NONE).
- Django HAS `apps.wallets.Withdrawal` + a wired endpoint `GET/POST /api/wallets/withdrawals/`
  (`walletsApi.withdrawals` / `requestWithdrawal`, [client.ts:519](src/integrations/api/client.ts:519)).
- The empty `apps/withdrawals/` app is a Phase-1 stub — models intentionally empty
  ([backend/apps/withdrawals/models.py](backend/apps/withdrawals/models.py)).

---

## 1. useWithdrawalRequests → **(C) DEAD / DELETE**

- **What:** investor withdrawal requests with OTP. Reads/writes Supabase `withdrawal_requests`
  ([useWithdrawalRequests.ts:66](src/hooks/useWithdrawalRequests.ts:66), [:102](src/hooks/useWithdrawalRequests.ts:102),
  [:149](src/hooks/useWithdrawalRequests.ts:149)); writes `payment_method_audit_log`
  ([:120](src/hooks/useWithdrawalRequests.ts:120)); calls Supabase edge functions
  `send-withdrawal-otp` / `verify-withdrawal-otp` ([:177](src/hooks/useWithdrawalRequests.ts:177), [:197](src/hooks/useWithdrawalRequests.ts:197)).
- **Existing Django?** YES — `apps.wallets.Withdrawal` + `WithdrawalsView`
  ([backend/apps/wallets/views.py:142](backend/apps/wallets/views.py:142)), debit-at-request, operator-advanced.
  The functional replacement is already **live**: [OwnerWithdrawDialog.tsx:62](src/components/owner/OwnerWithdrawDialog.tsx:62)
  calls `walletsApi.requestWithdrawal`, and `Wallet.tsx` uses that dialog.
- **Used by any live page?** NO. Grep `useWithdrawalRequests` across `src/` returns ONLY its own file —
  zero importers. It is a superseded duplicate of the already-repointed withdrawal flow.
- **Classify: (C) DEAD.** Delete the hook. (The OTP edge functions have no Django equivalent, but
  they die with the dead hook; OTP-on-withdrawal is a deferred enhancement, not a repoint.)

## 2. useVisaCards → **(B) NEEDS BACKEND** — mini-domain `visa-cards`

- **What:** issue/freeze virtual+physical Visa cards, card transactions, a separate card wallet
  balance, card spend + top-up. Reads Supabase `visa_cards`, `card_transactions`, `wallet_balances`
  ([useVisaCards.ts:75-77](src/hooks/useVisaCards.ts:75)); realtime channels ([:108](src/hooks/useVisaCards.ts:108));
  RPCs `spend_with_card` + `topup_wallet` ([:174](src/hooks/useVisaCards.ts:174), [:187](src/hooks/useVisaCards.ts:187)).
- **Existing Django?** NO. No card model; `wallet_balances` here is a card-spend wallet distinct from
  `apps.wallets.UserBalance`.
- **Used by:** [CreateCardDialog.tsx](src/components/wallet/CreateCardDialog.tsx), [VisaCardsSection.tsx](src/components/wallet/VisaCardsSection.tsx).
- **Classify: (B).** Largest of the set — real card issuing + spend rail + a second balance ledger.
  Defer (needs an issuing provider; out of scope for a cleanup batch).

## 3. useSavedCards → **(B) NEEDS BACKEND** — mini-domain `saved-cards`

- **What:** saved card brand/last-4/expiry for checkout convenience + default selection. Reads/writes
  Supabase `payment_methods` ([useSavedCards.ts:47](src/hooks/useSavedCards.ts:47), [:90](src/hooks/useSavedCards.ts:90),
  [:122](src/hooks/useSavedCards.ts:122), [:150](src/hooks/useSavedCards.ts:150)).
- **Existing Django?** NO `payment_methods` model. (Stripe handles live card charges via
  `apps.payments`, but there is no saved-card vault.)
- **Used by:** [SavedCardsManager.tsx](src/components/wallet/SavedCardsManager.tsx).
- **Classify: (B).** Defer; ideally back with Stripe SetupIntent / customer payment-methods rather
  than storing card data ourselves.

## 4. usePWASettings → **(B) NEEDS BACKEND** — mini-domain `pwa-settings`

- **What:** single global PWA config row (app name, theme/background color, install-prompt toggle).
  Reads `.single()` and updates Supabase `pwa_settings` ([usePWASettings.ts:20](src/hooks/usePWASettings.ts:20),
  [:44](src/hooks/usePWASettings.ts:44)).
- **Existing Django?** NO.
- **Used by:** [PWASettingsSection.tsx](src/components/settings/PWASettingsSection.tsx).
- **Classify: (B).** Trivial singleton config model + admin-gated GET/PATCH. Smallest backend of the set.

## 5. useOwnerDocuments → **(B) NEEDS BACKEND** — mini-domain `owner-documents`

- **What:** owner uploads property documents to Supabase **storage** bucket `owner-documents` +
  metadata row, signed-URL download, delete. Reads/writes `owner_documents`
  ([useOwnerDocuments.ts:35](src/hooks/useOwnerDocuments.ts:35), [:75](src/hooks/useOwnerDocuments.ts:75),
  [:118](src/hooks/useOwnerDocuments.ts:118)); storage `.upload`/`.remove`/`.createSignedUrl`
  ([:68](src/hooks/useOwnerDocuments.ts:68), [:115](src/hooks/useOwnerDocuments.ts:115), [:143](src/hooks/useOwnerDocuments.ts:143)).
- **Existing Django?** NO. (Other domains store PII docs under `backend/media/`; this would follow that
  pattern but no model/endpoint exists yet.)
- **Used by:** [OwnerDocuments.tsx](src/pages/OwnerDocuments.tsx).
- **Classify: (B).** Needs a model + file storage (media/) + self-scoped download. Matches the
  "property-documents" satellite already noted in DECISIONS.md.

## 6. useInvestorCryptoWallets → **(B) NEEDS BACKEND** — mini-domain `crypto-wallets`

- **What:** investor's **external** payout crypto wallets (address/label/network, verify, default).
  Reads/writes Supabase `investor_crypto_wallets` ([useInvestorCryptoWallets.ts:53](src/hooks/useInvestorCryptoWallets.ts:53),
  [:90](src/hooks/useInvestorCryptoWallets.ts:90)); writes `payment_method_audit_log` ([:104](src/hooks/useInvestorCryptoWallets.ts:104)).
- **Existing Django?** NO. (Distinct from the **custodial** `apps.wallets.UserWallet` — these are
  user-supplied payout destinations.)
- **Used by:** [CryptoWalletsManager.tsx](src/components/wallet/CryptoWalletsManager.tsx).
- **Classify: (B).** Defer; payout-destination registry (pairs with withdrawal `method=crypto`).

## 7. useInvestorBankAccounts → **(B) NEEDS BACKEND** — mini-domain `bank-accounts`

- **What:** investor's **external** payout bank accounts, stored masked, verify/default.
  Reads/writes Supabase `investor_bank_accounts` ([useInvestorBankAccounts.ts:73](src/hooks/useInvestorBankAccounts.ts:73),
  [:110](src/hooks/useInvestorBankAccounts.ts:110)); client-side masking ([:34](src/hooks/useInvestorBankAccounts.ts:34));
  writes `payment_method_audit_log` ([:130](src/hooks/useInvestorBankAccounts.ts:130)).
- **Existing Django?** NO investor-scoped model. `apps.family.FamilyBankAccount` exists but is
  family-member-scoped — **not** reusable here. Note the masking pattern (server-side `mask_tail`,
  last-4) from Family Wave A is the right template to copy.
- **Used by:** [BankAccountsManager.tsx](src/components/wallet/BankAccountsManager.tsx).
- **Classify: (B).** Defer; payout-destination registry (pairs with withdrawal `method=bank`).
  Should mask **server-side** (current hook masks in the browser — sends full number to Supabase).

## 8. AuditLog (page) → **(B) NEEDS BACKEND** — mini-domain `audit-log`

- **What:** read-only "last 200" security/audit feed. Reads Supabase `payment_method_audit_log`
  ([AuditLog.tsx:28](src/pages/AuditLog.tsx:28)). Route `/audit-log` ([App.tsx:132](src/App.tsx:132)).
- **Existing Django?** NO audit-log domain. (`apps.partners.AssignmentEvent` is a per-assignment log,
  not this cross-cutting payment-method audit trail.)
- **Used by:** live route `/audit-log`.
- **Classify: (B).** Defer. **Coupled** to #1/#6/#7 — those hooks are the *writers* of
  `payment_method_audit_log`; this page is the *reader*. The audit-log backend should land **with**
  the bank/crypto mini-domains (write rows on add/edit/delete) or the page shows an empty feed.

---

## Classification table

| # | Hook / Page | Supabase table(s) | Existing Django? | Used live? | Class | Mini-domain |
|---|---|---|---|---|---|---|
| 1 | useWithdrawalRequests | withdrawal_requests, audit_log, OTP fns | YES (wallets.Withdrawal, wired) | **NO** | **C dead** | — |
| 2 | useVisaCards | visa_cards, card_transactions, wallet_balances | NO | YES | **B** | visa-cards |
| 3 | useSavedCards | payment_methods | NO | YES | **B** | saved-cards |
| 4 | usePWASettings | pwa_settings | NO | YES | **B** | pwa-settings |
| 5 | useOwnerDocuments | owner_documents + storage | NO | YES | **B** | owner-documents |
| 6 | useInvestorCryptoWallets | investor_crypto_wallets, audit_log | NO | YES | **B** | crypto-wallets |
| 7 | useInvestorBankAccounts | investor_bank_accounts, audit_log | NO | YES | **B** | bank-accounts |
| 8 | AuditLog (page) | payment_method_audit_log | NO | YES | **B** | audit-log |

**Counts:** (A) repointable now = **0** · (B) needs backend = **7** · (C) dead = **1**.

## Recommended order

1. **(A) cleanup batch — NONE.** No surface has an existing Django backend to swap onto, so there is
   no zero-backend cleanup batch. (Withdrawal already has its backend, but its hook is dead, not
   repointable — see step 3.)
2. **(C) delete now — `useWithdrawalRequests`.** Zero importers; the withdrawal flow already runs on
   `walletsApi` via `OwnerWithdrawDialog`. Safe one-file deletion, no backend work. **Do this first.**
3. **(B) deferred mini-domains — 7, build later, grouped by affinity:**
   - **Payout-destinations + audit (build together):** `bank-accounts` + `crypto-wallets` +
     `audit-log` — the first two write audit rows the third reads; bank masking server-side (copy
     Family `mask_tail`). These pair with the existing withdrawal `method` field.
   - **Cards:** `saved-cards` (Stripe SetupIntent-backed) and `visa-cards` (issuing provider — largest,
     real money + second balance ledger; lowest priority).
   - **Config/docs (independent, small):** `pwa-settings` (singleton config) and `owner-documents`
     (model + media/ storage; = the DECISIONS.md "property-documents" satellite).

**Net:** Supabase cannot be fully removed by a cleanup-only pass. Exactly **1** hook is deletable today;
the other **7** are genuine deferred mini-domains, each needing a Django model/endpoint (and for
cards/docs, an external provider or file storage). None is a pure swap.
