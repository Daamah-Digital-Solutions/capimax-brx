# FAMILY_SURFACE.md — read-only surface investigation

> Scope: read-only. No code changed. Grepped only within `backend/apps/family`, `src/pages`,
> `src/hooks`, `src/components`, plus targeted reads of `core/models.py`, `RegisterRole.tsx`,
> `AppSidebar.tsx`, `DECISIONS.md`. Cited as `file:line`.

---

## 1. What IS "family" on this platform?

A **FEATURE for an existing investor** (not a role): a primary investor adds **family members**,
**allocates a % of their investment RETURNS** to each, links the members' **bank accounts**, and
sets up **automatic transfers/payouts** of those returns to the banks. It's investor→family
returns-sharing + payout automation, with view/authorized access control. The UI's own words:

- Hero: **"Invest for your family, allocate returns, and link bank accounts for automatic transfers.
  Complete management with full transaction history."** ([FamilyInvestment.tsx:355-358](src/pages/FamilyInvestment.tsx:355))
- Feature cards: **"Transfer investments or returns to family members with zero transfer fees"**;
  **"Link bank accounts for automatic returns transfers"** ([:200-211](src/pages/FamilyInvestment.tsx:200)).
- Allocations tab: **"Set the percentage of returns you want to allocate to each family member"** +
  a **"Remaining for You"** figure ([:811-863](src/pages/FamilyInvestment.tsx:811)).
- Add-member dialog: **"Add a family member to link their account and allocate returns"**
  ([:374-378](src/pages/FamilyInvestment.tsx:374)).

NOT inheritance/beneficiary management, NOT a shared single portfolio. It is **member designation +
returns allocation + bank-payout automation**, scoped under one primary investor.

## 2. Frontend surface (what exists)

One large page + a hook + 4 components + a sidebar entry. **Dual-mode:** demo data for
unauthenticated/empty users; **real data when `user && familyAccounts.length > 0`**
([:330](src/pages/FamilyInvestment.tsx:330)). 5 tabs: Members / Banking / Allocations / Transfers /
History ([:481-503](src/pages/FamilyInvestment.tsx:481)).

⚠️ **The hook is still wired to SUPABASE — NOT migrated to Django** ([useFamilyAccounts.ts:2](src/hooks/useFamilyAccounts.ts:2)
`import { supabase } ...`). This is unlike the already-migrated domains; family is the only remaining
mock domain that ships a **real (Supabase) data model + working mutations**, not just local mock arrays.

Data shapes (`useFamilyAccounts.ts` interfaces, all Supabase-backed):
- **`FamilyAccount`** ([:6-19](src/hooks/useFamilyAccounts.ts:6)): `investor_id, member_name, member_email,
  relationship, status (pending|active|suspended), access_level (view_only|authorized),
  allocated_returns_percent, total_transferred, linked_at`.
- **`FamilyBankAccount`** ([:21-35](src/hooks/useFamilyAccounts.ts:21)): `bank_name, account_holder_name,
  account_number_masked, iban_masked, currency, is_verified, is_primary` (masks to last 4 —
  [:185-187](src/hooks/useFamilyAccounts.ts:185)).
- **`TransferSchedule`** ([:37-47](src/hooks/useFamilyAccounts.ts:37)): `schedule_type
  (immediate|weekly|monthly|quarterly|threshold), threshold_amount, next_transfer_date, is_active`.
- **`FamilyTransaction`** ([:49-62](src/hooks/useFamilyAccounts.ts:49)): `transaction_type, amount,
  currency, status (pending|processing|completed|failed), reference_number, initiated_by` — the
  ledger (allocation / bank_linked / schedule_created / transfer_initiated / transfer_completed).

Mutations (Supabase writes): `createFamilyAccount`, `addBankAccount`, `createTransferSchedule`,
`initiateTransfer` (amount), `updateAccessLevel` ([:136-328](src/hooks/useFamilyAccounts.ts:136)).
The real wired transfer lives in `FamilyMemberCard.handleTransfer → onInitiateTransfer({amount})`
([FamilyMemberCard.tsx:80-88](src/components/family/FamilyMemberCard.tsx:80)); the page's own hero/tab
buttons (`handleTransfer`, `handleAllocateReturns`, `handleAddBankAccount`) are **toast-only stubs**
([FamilyInvestment.tsx:287-327](src/pages/FamilyInvestment.tsx:287)). The Transfers tab offers a type
picker: **Returns / Ownership Tokens / Wallet Balance** ([:907-909](src/pages/FamilyInvestment.tsx:907)).
Components: `FamilyMemberCard`, `TransferScheduleForm`, `BankAccountForm`, `TransactionHistory`.
Sidebar: an INVESTOR nav item `nav.familyInvestment → /family-investment`
([AppSidebar.tsx:111](src/components/layout/AppSidebar.tsx:111)) — confirming it's an investor feature.

## 3. Backend (the stub) + role check

`backend/apps/family/` is an **empty Phase-1 stub** — like distributions/notifications/partners/broker
were pre-build: `models.py` comment-only, **no models** ([family/models.py:1-3](backend/apps/family/models.py:1));
`admin.py` comment-only; `apps.py` (`label="family"`) only; `migrations/` = `__init__.py` only, **no
migration files**. **No** `views.py`, `urls.py`, `services.py`, `tests.py`. **No family logic anywhere
in the backend.**

**Family is a FEATURE, not a ROLE:** `Profile.Role` has **no `family` value** (grep in
[core/models.py](backend/apps/core/models.py) → no matches), and `RegisterRole.tsx` has **no family
card** (grep → no matches). It's a capability available to a logged-in investor, not a self-selectable
role with a verification gate.

## 4. MONEY — the key question

**YES — family is a MONEY domain.** It moves real value: it **allocates a % of an investor's returns**
to members and **transfers/pays out** funds to members' external bank accounts.

Money/allocation fields shown verbatim:
- `allocated_returns_percent` + `total_transferred` ([useFamilyAccounts.ts:15-16](src/hooks/useFamilyAccounts.ts:15));
  UI: "Allocated Returns %" + "Total Transferred $" ([FamilyInvestment.tsx:572-581](src/pages/FamilyInvestment.tsx:572)).
- `initiateTransfer({ amount })` → a `FamilyTransaction` with `amount`/`status`/`reference_number`
  ([useFamilyAccounts.ts:279-306](src/hooks/useFamilyAccounts.ts:279)).
- `TransferSchedule.threshold_amount` + auto-transfer cadences ([TransferScheduleForm.tsx:56,124-142](src/components/family/TransferScheduleForm.tsx:56)).
- Transfer types: **Returns / Ownership Tokens / Wallet Balance** ([FamilyInvestment.tsx:907-909](src/pages/FamilyInvestment.tsx:907)).
- Hero claims **"All transfers are blockchain-secured"** ([:227,992](src/pages/FamilyInvestment.tsx:227)) —
  implying on-chain movement for the tokens path (would need minting-grade discipline).

So this is **NOT view-only**; it requires the same money rigor as owner/broker/distributions
(settlement-gated, idempotent, server-side) — especially the "Ownership Tokens" path (real on-chain
transfer) and any actual bank payout.

## 5. Relationship to existing domains (seams)

- **Distributions / returns:** "allocate a % of returns" implies family allocation hooks into where an
  investor's returns are credited — the **`UserBalance` / distribution** flow (Phase 9) and/or
  primary-sale earnings. An allocation would skim a % of credited returns toward members.
- **Wallet / balance:** the "Wallet Balance" transfer type draws on the investor's `UserBalance`
  (apps/wallets). Payouts to a member's bank resemble the existing **`Withdrawal`** rail (off-platform).
- **Holdings (`OwnershipToken`):** the "Ownership Tokens" transfer type would move on-chain shares —
  the same `apps/chain` transfer + escrow machinery the LP/secondary markets use (custodial signer +
  gas top-up).
- **KYC / identity:** OPEN — family members have `member_email` + bank accounts but it's unclear whether
  each member is a **separate KYC'd user** or just a **record under the primary investor**. The page
  treats them as records (name/email/relationship), not logged-in users; `access_level` (view_only |
  authorized) hints some members may log in. Bank `is_verified` is a separate per-account check.
- **Single primary investor:** every `FamilyAccount` is scoped by `investor_id` (the owner). No shared
  pooled portfolio — it's one investor distributing to dependents.

## 6. Open questions (NOT decided here)

1. **Migration baseline:** family is the only remaining domain still on **Supabase** with a live data
   model (4 tables) + working mutations. Wave 1 is likely a **straight repoint to Django** (mirror the
   4 tables: `FamilyAccount` / `FamilyBankAccount` / `TransferSchedule` / `FamilyTransaction`), self-
   scoped to `investor_id == request.user`.
2. **Are members users or sub-records?** Separate KYC'd accounts (with `access_level` granting login) or
   passive payout records under the primary investor? This decides auth/permission scope.
3. **What does "allocate returns" actually move, and when?** A % skim off credited returns
   (distribution/earnings) into a member ledger? Auto at credit time, or on a schedule? Settlement-gated
   + idempotent like the other money credits?
4. **"Transfer" scope:** Returns vs **Ownership Tokens** (real on-chain transfer — minting-grade) vs
   **Wallet Balance** (internal). Which are in scope for Wave 1; which defer?
5. **Bank payout rail:** is the bank transfer a real off-platform payout (like `Withdrawal`, operator-
   advanced) or just a recorded intent? Who executes it?
6. **Permissions / formation:** members added by invite (email) vs admin; `view_only` vs `authorized`
   capabilities; whether a member consents/accepts.

---

## Bottom line

"Family" = an **investor FEATURE** (not a role; no `family` in core, no register card) to designate
family members, **allocate a % of returns** to them, link their banks, and **auto-transfer/pay out**
those returns. Backend is an **empty stub**. The frontend is a full page **still wired to Supabase**
(4 tables + working mutations) — the only remaining mock domain with a real data model, so Wave 1 is
primarily a **Supabase→Django repoint**. It **moves real money** (returns allocation + bank payouts +
optional on-chain token transfers) → a **MONEY domain** demanding settlement-gated, idempotent,
server-side rigor. The biggest undecided seams are **member identity/KYC** (separate users vs sub-
records) and **what "allocate returns" credits, when, and from which source**.
