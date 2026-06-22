# Reinvestments — Surface Map (READ-ONLY investigation)

Scope: `src/pages/Reinvestment.tsx`, `src/hooks/useReinvestments.ts`, the would-be
`backend/apps/reinvestments/` (confirmed absent), and the backend seams reinvestment
would reuse (distributions credit → `UserBalance`; the invest+mint path). No code changed.

---

## 1. What the frontend implies reinvestment IS

A **MANUAL, bonus-incentivised re-deploy of accrued returns into more property tokens** —
NOT auto-reinvest, NOT tied to a specific property.

- The pitch: *"Reinvesting your returns allows you to benefit from exclusive bonuses and
  discounts not available for regular purchases"* ([Reinvestment.tsx:131-133](src/pages/Reinvestment.tsx#L131)).
- The action is a **manual hand-off to the Marketplace**, not an in-page reinvest button:
  every CTA links to `/marketplace?reinvest=true` ([Reinvestment.tsx:201](src/pages/Reinvestment.tsx#L201),
  [:396](src/pages/Reinvestment.tsx#L396), [:492](src/pages/Reinvestment.tsx#L492)) — *"Go to Marketplace to Invest"*.
  So the user reinvests into **ANY property** they pick, via the normal buy flow.
- The promised incentives (UI only — see §3, none exist in backend):
  - **5% reinvestment discount**, *"Automatically applied to all reinvestment transactions"* ([:288-296](src/pages/Reinvestment.tsx#L288)).
  - **+2% Pronova bonus** when paying with the Pronova token ([:300-311](src/pages/Reinvestment.tsx#L300)).
  - **Reduced fees: 1% standard / 0% with Pronova** ([:339-369](src/pages/Reinvestment.tsx#L339)); headline "Total Potential Bonus 7%" ([:319](src/pages/Reinvestment.tsx#L319)).
- "Compound Growth — multiply your returns through continuous reinvestment" ([:73-79](src/pages/Reinvestment.tsx#L73))
  frames the SOURCE of funds as prior **returns/yield**.

## 2. Frontend state

`Reinvestment.tsx` is a **3-tab page** (Overview / Bonuses / History) — informational +
a Supabase-backed history list. It is **partly mock, partly Supabase, and the write path
is unwired on this page**:

- **Available returns = hardcoded mock** `availableReturns = 5000`, with an inline TODO:
  *"Mock available returns - in production this would come from user's account"*
  ([Reinvestment.tsx:31-32](src/pages/Reinvestment.tsx#L31)). Bonus math (5%/2%, fees) is
  computed client-side from constants ([:35-42](src/pages/Reinvestment.tsx#L35)).
- **Stats** (`totalReinvested`, `totalBonus`, count, pending) come from the hook
  ([:29](src/pages/Reinvestment.tsx#L29), rendered [:225-251](src/pages/Reinvestment.tsx#L225)).
- **History tab** renders `reinvestments[]` rows: `property_name`, `source_amount`,
  `discount_amount`, `net_investment_value`, `status` ([:432-477](src/pages/Reinvestment.tsx#L432)).
- **No toggle, no auto/manual switch, no in-page "reinvest now" action.** The only actions
  are `<Link>`s to the Marketplace. `useReinvestments().createReinvestment` is **defined but
  NOT called anywhere on this page** (the page never imports/uses it).

### Data shape & wiring — `useReinvestments.ts` (still Supabase / mock)

- Reads `supabase.from("reinvestments")` self-scoped by `user_id`
  ([useReinvestments.ts:37-46](src/hooks/useReinvestments.ts#L37)). **Still on Supabase**, like
  family accounts — NOT repointed to Django.
- `Reinvestment` row shape: `{ id, user_id, source_amount, discount_percentage,
  discount_amount, net_investment_value, investment_id, property_id, property_name, status,
  created_at, updated_at }` ([:6-19](src/hooks/useReinvestments.ts#L6)).
- `createReinvestment` mutation **only inserts a Supabase row** with `status:"pending"` and
  client-computed `discount_amount = source_amount × 5%`, `net_investment_value =
  source_amount + discount` ([:49-74](src/hooks/useReinvestments.ts#L49)). It does **NOT**
  debit any balance, does **NOT** create an investment, does **NOT** mint, and `investment_id`
  is left null. It is a bookkeeping record only — and, again, unused by the page.
- **`?reinvest=true` is a dead query param**: `grep reinvest src/pages/Marketplace.tsx` →
  no matches; the Marketplace (and Checkout) ignore it. So the "reinvest" CTAs land on a
  normal marketplace browse with no reinvest context, discount, or pre-filled balance.

## 3. Backend — is `apps/reinvestments` a stub?

**There is NO backend reinvestments app at all** — not even a stub.

- `glob backend/apps/reinvestments/**` → no files; `grep -ri reinvest backend/apps` → **zero
  matches**. No model, service, endpoint, migration, or URL mount.
- **No reinvestment logic exists today** anywhere in Django. No "discount", "bonus", or
  "Pronova" concept in `investments`, `distributions`, or `wallets`. The 5%/2%/fee numbers
  live ONLY in the React page as constants.

## 4. Money mechanics — the seam (partly present, the key link MISSING)

Reinvestment's intended flow is **take yield already sitting in `UserBalance` → buy more
tokens (real on-chain mint), funded internally (NO new PSP charge)**. Status of each link:

- **Yield lands in `UserBalance`** ✅ — distributions credit it:
  `declare_distribution` → `_build_and_credit_payouts` → `credit_user_balance(user, share,
  source="distribution", …)` ([distributions/services.py:152-161](backend/apps/distributions/services.py#L152)).
  Owner primary-sale + broker credits also land here. So "available returns" = the caller's
  `UserBalance.current_balance` (the page's mock $5000 → should read this).
- **A debit primitive EXISTS** ✅ — `debit_user_balance(user, amount, source, …)` row-locks,
  raises `InsufficientBalance` (rolls back), and ledgers a DEBIT
  ([wallets/services.py:170-193](backend/apps/wallets/services.py#L170)). Used today by the
  peer-market buyer + investor withdrawal.
- **Real on-chain mint EXISTS** ✅ — `mint_investment` mints regardless of how the buy was
  funded (idempotent, gated on `payment_status == COMPLETED`).
- **The connecting seam is MISSING** ❌ — `create_investment(…, payment_method)` has **no
  internal-balance funding path**. `payment_method` only ever drives
  `WEBHOOK_PAID_METHODS = {"card","crypto"}` (gated/deferred) vs everything-else
  (simulated auto-complete + auto-mint) ([investments/services.py:34](backend/apps/investments/services.py#L34),
  [:199-227](backend/apps/investments/services.py#L199)). It **never calls
  `debit_user_balance`** and there is no `"balance"`/`"internal"` method. So **funding a buy
  from internal balance does not exist** — the primitive is there, but nothing wires
  `debit UserBalance → create_investment → mint`.

**Auto vs manual today:** neither is implemented. The frontend *implies* manual (click →
Marketplace). There is **no auto-reinvest hook on distribution** (`declare_distribution`
only credits balance; it never re-buys).

**On-chain mint from internal balance:** the mint half is real; the "spend my balance to
buy" half is the gap to build.

## 5. Key questions (NOT decided here)

1. **Auto vs manual?** UI implies manual ("go to Marketplace"); the "auto-applied 5%
   discount" copy hints at a system rule. Decide: a manual "reinvest $X of my balance into
   property Y" action, and/or an opt-in auto-reinvest-on-distribution setting.
2. **Same-property vs choose-any?** UI routes to the whole Marketplace (choose any). Confirm
   whether reinvest is property-agnostic or scoped to the property that paid the yield.
3. **The 5% / 2% Pronova / fee incentives** — are these REAL product rules to implement
   (discounted token price? bonus tokens? fee waiver?), or aspirational marketing copy? None
   exist in backend; the existing buy flow has no discount/bonus/fee-by-method concept, and
   **there is no Pronova token integration anywhere**. This is the biggest scoping decision.
4. **Minimum reinvest amount?** None specified anywhere.
5. **KYC** — already required by the invest path (`create_investment` is KYC-gated upstream);
   a balance-funded buy inherits that. No new gate needed.
6. **Funding path to build** — add an internal-balance funding method to `create_investment`
   (debit `UserBalance` via `debit_user_balance` instead of a PSP charge → mark completed →
   `mint_investment`), settlement-gated by the successful debit (money is already in-ledger,
   so NO webhook/PSP). Confirm whether reinvest reuses `create_investment` directly or a thin
   `apps/reinvestments` wrapper that records the discount/bonus + links `investment_id`.

---

### One-line state
Frontend: a polished but **mock + Supabase, write-unwired** page promising 5%/2%/Pronova
bonuses that **don't exist in backend**, with CTAs to a **dead `?reinvest=true`** Marketplace
link. Backend: **no reinvestments app**; yield sits in `UserBalance` and a `debit_user_balance`
primitive + real mint exist, but **`create_investment` has no internal-balance funding seam** —
that link, plus any discount/bonus/Pronova rules, is the whole build.
