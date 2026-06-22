# FAMILY_SURFACE.md — read-only surface investigation (refreshed/expanded)

> Scope: read-only, no code changed. Grepped "family" only within `src/pages`, `src/hooks`,
> `backend/apps/family`; plus targeted reads of `FamilyMemberCard.tsx`, `useFamilyAccounts.ts`,
> `wallets/models.py` (UserBalance + Withdrawal), `distributions/services.py`, `chain/service.py`.
> Cited as `file:line`.

---

## 1. What family IS — and are members real users?

A **FEATURE for one primary investor** (not a role): the investor adds **family members**, **allocates a %
of returns** to each, links the members' **bank accounts**, and sets up **transfers** of returns/funds to
them. UI words: *"Invest for your family, allocate returns, and link bank accounts for automatic transfers"*
([FamilyInvestment.tsx:355](src/pages/FamilyInvestment.tsx:355)); *"Set the percentage of returns you want to
allocate to each family member"* ([:811](src/pages/FamilyInvestment.tsx:811)).

**Members are PASSIVE SUB-RECORDS, not separate users.** A `FamilyAccount` is just `{investor_id,
member_name, member_email, relationship, status, access_level, allocated_returns_percent, total_transferred}`
([useFamilyAccounts.ts:6](src/hooks/useFamilyAccounts.ts:6)) — **no FK to a Django `User`**, no auth, no KYC,
no custodial wallet. Adding a member is a plain insert from `member_name/email/relationship`
([:136-165](src/hooks/useFamilyAccounts.ts:136)); no invite/account-creation/consent flow exists.
- `access_level: "view_only" | "authorized"` ([:13](src/hooks/useFamilyAccounts.ts:13)) is just a stored flag
  toggled by `updateAccessLevel` ([:313](src/hooks/useFamilyAccounts.ts:313)) and shown as a badge
  ([FamilyMemberCard.tsx:126-138](src/components/family/FamilyMemberCard.tsx:126)). It **hints** a member could
  log in as "authorized," but **nothing in the code grants a member login or enforces the level** — there is no
  member session, no per-member permission check. So today: passive records under the primary investor.
- It's an **investor feature, not a role**: `Profile.Role` has no `family` value, `RegisterRole.tsx` has no
  family card; the sidebar item is an investor nav entry. (Confirmed prior investigation.)

## 2. The 4 Supabase tables + what's wired vs toast-only

All 4 are **real Supabase tables** read/written by `useFamilyAccounts.ts` (still `import { supabase }`,
[:2](src/hooks/useFamilyAccounts.ts:2) — the **only** remaining un-migrated domain with a live data model):

| Table | Shape (key fields) | Purpose |
|---|---|---|
| `family_accounts` | investor_id, member_name/email, relationship, status (pending\|active\|suspended), access_level (view_only\|authorized), allocated_returns_percent, total_transferred ([:6-19](src/hooks/useFamilyAccounts.ts:6)) | the member record + its allocation % + running transferred total |
| `family_bank_accounts` | family_account_id, bank_name, account_holder_name, **account_number_masked**, iban_masked, currency, is_verified, is_primary ([:21-35](src/hooks/useFamilyAccounts.ts:21)) | the member's linked bank (masked to last-4: [:185-187](src/hooks/useFamilyAccounts.ts:185)) |
| `family_transfer_schedules` | family_account_id, bank_account_id, schedule_type (immediate\|weekly\|monthly\|quarterly\|threshold), threshold_amount, next_transfer_date, is_active ([:37-47](src/hooks/useFamilyAccounts.ts:37)) | auto-transfer cadence config |
| `family_transactions` | family_account_id, bank_account_id, transaction_type, amount, status (pending\|processing\|completed\|failed), reference_number, initiated_by ([:49-62](src/hooks/useFamilyAccounts.ts:49)) | activity/ledger (allocation / bank_linked / schedule_created / transfer_initiated) |

**Wired (real Supabase writes):** `createFamilyAccount`, `addBankAccount`, `createTransferSchedule`,
`initiateTransfer`, `updateAccessLevel` ([:136-328](src/hooks/useFamilyAccounts.ts:136)). BUT every write is
**record-only** — it inserts/updates rows; **none moves money or tokens, none touches `UserBalance`, none
calls a payout or chain**. `initiateTransfer` just inserts a `family_transactions` row `status:"pending"` with
a client-generated `reference_number` ([:289-306](src/hooks/useFamilyAccounts.ts:289)); nothing ever advances
it to `completed`. `total_transferred` and bank `is_verified` are never updated by any code → always 0 / false.

**Toast-only stubs (not even record-writes):** the page-level `handleTransfer`, `handleAllocateReturns`,
`handleAddBankAccount`, `handleSaveMemberEdit` ([FamilyInvestment.tsx:287-327](src/pages/FamilyInvestment.tsx:287)).
The **Allocations tab** Select + ✓ button → `handleAllocateReturns()` = toast only ([:849](src/pages/FamilyInvestment.tsx:849));
allocation % is **never persisted from the UI**. The **Transfers tab** "Confirm Transfer" → `handleTransfer()`
= toast only ([:930](src/pages/FamilyInvestment.tsx:930)); its "Recent Transfer History" is a **hardcoded array**
([:946-949](src/pages/FamilyInvestment.tsx:946)). The only path that writes a transfer row is
`FamilyMemberCard.handleTransfer → onInitiateTransfer({amount})`
([FamilyMemberCard.tsx:80-89](src/components/family/FamilyMemberCard.tsx:80)) — and that's still record-only,
**bank-account-targeted only** (`primaryBank.id`), with no type picker.

## 3. The THREE transfer types — what each MOVES (today: nothing; what they'd reuse)

The type picker (Returns / Ownership Tokens / Wallet Balance) lives ONLY in the Transfers-tab "New Transfer"
form ([FamilyInvestment.tsx:907-909](src/pages/FamilyInvestment.tsx:907)) whose Confirm is **toast-only** — so
**all three are cosmetic today**. What each WOULD move if built:

1. **Returns** / **Wallet Balance** → **internal `UserBalance` movement.** Returns/proceeds already land in the
   investor's `UserBalance` via `credit_user_balance(..., source="distribution")`
   ([distributions/services.py:152](backend/apps/distributions/services.py:152)); `debit_user_balance` (row-locked,
   raises `InsufficientBalance`, ledgered) already exists ([wallets/services.py:170](backend/apps/wallets/services.py:170)).
   A family transfer of returns/balance = **debit investor balance → credit member's balance** — but a member has
   **no `UserBalance`** today (no User), so this needs a member-balance target first (see §5/§6).
2. **Ownership Tokens** → **REAL on-chain token transfer.** The rail EXISTS:
   `chain.service.transfer(token_address, from_account, to_address, amount)` — a direct custodial-signed ERC-20
   `transfer()` (we custody both wallets; no approval/transferFrom), returning a real tx
   ([chain/service.py:336-366](backend/apps/chain/service.py:336)); it's what LP/secondary settlement uses. Moving
   tokens to a member requires the member to have a **custodial wallet + `OwnershipToken` position** — which they
   don't (no User/wallet). Minting-grade discipline (gated, idempotent, server-side) required.
3. **Bank transfer** → **money OUT to an external bank — NO execution rail exists.** This is the **biggest gap.**
   The closest analogue, `Withdrawal` ([wallets/models.py:248-289](backend/apps/wallets/models.py:248)), is a
   **REQUEST, not a payout**: it debits `UserBalance` at request time and an **operator manually advances the
   status** (`processed_at`); the model's own docstring says *"the actual off-platform payout/rail is an
   ops/back-office step"* ([:250-256](backend/apps/wallets/models.py:250)). There is **no payment-out provider
   integration anywhere** (Stripe/NOW are pay-IN only). So a family **bank transfer** is entirely new — at best a
   record/Withdrawal-style request that a human fulfills; a real automated bank payout is **blocked on a missing
   payout provider**.

## 4. "Allocate % of returns" — auto-skim or manual?

**Neither is implemented; the design is undefined.** `declare_distribution` only credits the **holder's** own
`UserBalance` ([distributions/services.py:88-183](backend/apps/distributions/services.py:88)) — there is **no
family hook**, no skim, no member credit. The UI's `allocated_returns_percent` is **display-only** (the
Allocations Select doesn't persist; [FamilyInvestment.tsx:835-852](src/pages/FamilyInvestment.tsx:835)) and the
labels conflict: "Automatic Returns Allocation" ([:809](src/pages/FamilyInvestment.tsx:809)) vs manual per-row
✓ buttons and a manual Transfers form. So whether allocation should **auto-skim a % of each distribution credit
to a member at credit time** (a hook on `_build_and_credit_payouts`) or be a **manual transfer** the investor
triggers is an **open product decision** — nothing constrains it today.

## 5. KEY QUESTIONS (surfaced, not decided)

1. **Members: users or sub-records?** Today = passive sub-records (no User/KYC/wallet). To move **tokens** or
   give a member a spendable **balance**, a member must become (or link to) a real KYC'd user with a custodial
   wallet — otherwise there's no on-chain `to_address` and no `UserBalance` to credit. This is THE gating decision.
2. **Bank transfer with no payout provider:** record-only intent (like `Withdrawal`, operator-fulfilled) vs out
   of scope until a real payout rail (bank/ACH/SWIFT provider) is integrated. No provider exists → real automated
   bank payout is **not buildable now**.
3. **Allocation: auto vs manual** — skim-at-distribution-time vs investor-triggered transfer; and from which
   source (distribution credits only, or any `UserBalance`).
4. **Which transfer types are realistically buildable now:** **internal balance** (returns/wallet) — YES once a
   member has a balance target; **on-chain tokens** — YES once a member has a wallet (rail exists); **real bank
   payout** — NO (no provider).
5. **Access control:** does `authorized` ever grant a member login/permissions, or is it cosmetic? If real, it
   implies member-as-user (ties back to #1).

## 6. Recommended WAVE BREAKDOWN (most complex remaining domain)

**Wave A — repoint + model, NO money (safe first wave).** Mirror the 4 Supabase tables as Django models in the
empty `apps/family` stub (`FamilyAccount` / `FamilyBankAccount` / `FamilyTransferSchedule` / `FamilyTransaction`),
self-scoped to `investor_id == request.user`; repoint `useFamilyAccounts.ts` Supabase→Django (a `familyApi` like
every prior repoint). **PERSIST the allocation %** (wire the Allocations tab + member edit — currently toast-only)
and member CRUD + bank-link (masked, last-4 only — PII: store no full account numbers) + schedule config. **No
money, no tokens, no payout** — records + allocation config only. Mirrors the Reinvestments-history/Installments
Wave-A pattern; lowest risk, removes the last Supabase dependency.

**Wave B — internal-balance transfer (reuses existing rails), gated by the member-identity decision.** Decide #1
(members as users). If a member is a real KYC'd user with a `UserBalance`, build a **balance→balance family
transfer**: `debit_user_balance(investor, amt, source="family_transfer")` → `credit_user_balance(member, amt, …)`
in one atomic block, idempotent, self-scoped — the Returns/Wallet-Balance types. Optionally a **distribution
skim**: an opt-in hook that routes `allocated_returns_percent` of each distribution credit to the member at
credit time (a thin add to `_build_and_credit_payouts`). Reuses proven primitives; no new provider.

**Wave C — on-chain Ownership-Token transfer (minting-grade), needs member wallet.** Once a member has a
custodial wallet, move shares via the existing `chain.service.transfer` + gas-top-up machinery (mirror
LP/secondary settlement): debit the position, real on-chain `transfer()`, record the tx, update both
`OwnershipToken` rows. Settlement-gated, idempotent, server-side.

**Wave D — bank payout: BLOCKED / record-only.** A real automated bank transfer needs an **external payout
provider that does not exist** (Stripe/NOW are pay-in only; `Withdrawal` is operator-fulfilled). Best buildable
now = a **`Withdrawal`-style request** (debit balance, status `pending`, operator advances) surfaced as a family
bank transfer — flag clearly as "requested, fulfilled off-platform," not an executed payout. Defer real
automated bank payout to a future payout-provider integration (a deploy/provider item, like the mainnet/KMS gates).

**Defer the marketing claims:** "0% fees," "instant," and "blockchain-secured" ([FamilyInvestment.tsx:200-228,992](src/pages/FamilyInvestment.tsx:200))
are aspirational — only the token path is on-chain, and only once built; the bank/internal paths are not
"blockchain-secured." Soften or scope these during the build.

---

### Bottom line
Backend `apps/family` is an **empty stub** ([family/models.py:1-3](backend/apps/family/models.py:1)). The
frontend is a full page **still on Supabase** (4 tables + working but **record-only** mutations; the page's own
buttons are toast stubs). Members are **passive sub-records** (no user/KYC/wallet). Of the 3 transfer types, the
**internal-balance** and **on-chain token** rails EXIST and are buildable; the **bank payout** is the real gap
(no provider — only the operator-fulfilled `Withdrawal` analogue). Allocation is undefined (auto-skim vs manual).
Recommended path: **Wave A repoint + allocation model (no money)** → **Wave B internal-balance transfer** →
**Wave C on-chain token transfer** → **Wave D bank payout deferred/record-only**, gated throughout by the
**member-identity decision** (sub-record vs real KYC'd user).
