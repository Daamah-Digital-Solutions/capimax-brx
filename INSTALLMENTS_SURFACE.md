# INSTALLMENTS_SURFACE.md — read-only survey of the installment investment model

> READ-ONLY. No code changed. Scope: `src/pages/Installments.tsx`, the two calculators
> (`InstallmentCalculator.tsx`, `DynamicInstallmentPlanner.tsx`), `Checkout.tsx`, `backend/apps/installments/`
> (does not exist), `backend/apps/investments/services.py` (the real mint path), and the property-level
> `InstallmentSchedule`. Cited file:line. Goal: surface what an installment investment IS and the
> money/on-chain questions a real build must answer — **not** to decide them.

---

## 0. TL;DR
- **No `backend/apps/installments` exists** — not a stub, not registered (no dir; nothing in `backend/config/`). The Installments **domain is entirely unbuilt**.
- The **only** installment backend is `properties.InstallmentSchedule` — a per-**property** OneToOne *display/marketing* row ([models.py:288](backend/apps/properties/models.py:288)), serialized into property detail. It is **not** a per-investor plan and has **no** down-payment % / duration options.
- `Investment` model + `investments/services.py` have **zero** installment awareness (grep: 0 matches). A purchase is **one-shot**: full amount → **all** tokens minted at once.
- **Checkout silently drops the installment intent** — it never reads the `type`/`duration` params the calculator sends and hardcodes `isInstallment: false`. An "installment" click today becomes a normal **full-price** purchase + full mint.
- Frontend is **inconsistent on the core mechanic**: the planners *visualise* ownership growing `down% → 100%` across the schedule (progressive), while every real money path mints 100% up front.

---

## 1. WHAT the frontend implies an installment investment IS

Three distinct surfaces, all mock/decorative today:

### (a) `InstallmentCalculator.tsx` — PropertyDetail sidebar (under-construction properties)
Inputs: **units**, **duration in months** (from `property.installmentOptions.durations`), down-payment % (from `property.installmentOptions.downPaymentPercent`). The calc ([InstallmentCalculator.tsx:55-101](src/components/property/InstallmentCalculator.tsx:55)):
```ts
const totalInvestment   = units * unitPrice;
const downPayment       = Math.round(totalInvestment * (downPaymentPercent / 100));
const remainingBalance  = totalInvestment - downPayment;
const installmentAmount = Math.round(remainingBalance / selectedDuration);   // per month
const platformFee       = Math.round(totalInvestment * 0.015);               // 1.5%
const downPaymentWithFee= Math.round(downPayment + platformFee * (downPaymentPercent/100));
// schedule: [down_payment @ today] + selectedDuration × [installment @ +i months]
```
→ **"Pay at checkout" = `downPaymentWithFee`** ([:259-261](src/components/property/InstallmentCalculator.tsx:259)). So an installment investment = **down-payment now + N equal monthly installments** of the financed remainder.

### (b) `DynamicInstallmentPlanner.tsx` — PropertyDataRoom "Construction" tab
A richer "design your own plan": down % ∈ {20,30,40}, duration ∈ {1,2,3} yr, frequency ∈ {monthly, quarterly}. The calc ([DynamicInstallmentPlanner.tsx:66-89](src/components/property/DynamicInstallmentPlanner.tsx:66)):
```ts
const down        = (total * downPct) / 100;
const remaining   = total - down;
const periods     = freq === "monthly" ? years * 12 : years * 4;
const installment = remaining / periods;
// per row: cumulativePaid = down + installment*(i+1);  ownership = cumulativePaid/total*100
```
→ Explicitly frames **ownership as progressive**: *"Your ownership starts at `downPct`% and reaches 100% on the final installment."* ([:379-380](src/components/property/DynamicInstallmentPlanner.tsx:379)). Both planners' CSV/print are **real client-side** (no backend); the **"Invest with Installments"** CTA is the only thing that leaves the page.

### (c) `Installments.tsx` — portfolio "my installment plans" page (fully mock)
Hardcoded `installmentStats` + `installmentPlans` ([Installments.tsx:36-108](src/pages/Installments.tsx:36)). Each plan = `{ downPayment, installmentAmount, totalInstallments, paidInstallments, payments[] }` where each payment is `{type: down_payment|installment, status: paid|pending|upcoming}` ([:67-77](src/pages/Installments.tsx:67)). **Pay Now** ([:227](src/pages/Installments.tsx:227),[:368](src/pages/Installments.tsx:368)) → a **2s fake confirm dialog** (`confirmPayment` just sets a flag, [:122-129](src/pages/Installments.tsx:122)). Export/Filter are local-only over the mock.

---

## 2. CHECKOUT — exactly how the installment intent is DROPPED
- The calculator navigates with the intent encoded: `navigate(`/checkout?property=${propertyId}&units=${units}&type=installment&duration=${selectedDuration}`)` ([InstallmentCalculator.tsx:108-110](src/components/property/InstallmentCalculator.tsx:108)).
- **Checkout only reads `property` and `units`** ([Checkout.tsx:54-55](src/pages/Checkout.tsx:54)). It **never reads `type` or `duration`.**
- `investment.isInstallment` is **hardcoded `false`** ([Checkout.tsx:181](src/pages/Checkout.tsx:181)). (Ironically, the `InvestmentData` interface already *declares* `isInstallment / downPayment / installmentAmount / installmentDuration` at [Checkout.tsx:35-38](src/pages/Checkout.tsx:35) — defined, never populated.)
- Result: `totalPayable = units*unitPrice + platform + management fees` ([:163-167](src/pages/Checkout.tsx:163)) and it calls `processInvestment({ property_id, token_amount: units, payment_method })` ([:217](src/pages/Checkout.tsx:217)) → a **normal full purchase → full mint**. The down-payment is never charged as such.
- **What it WOULD need:** read `type=installment` + `duration`, branch into an installment path that (i) charges the **down-payment** (not the full amount) via the existing gated PSP flow, (ii) persists a per-investor **plan + schedule**, (iii) decides token-mint timing (see §5), and (iv) routes follow-on installments to the same gated PSP.

---

## 3. BACKEND — the full-purchase path, and where installments diverge
**`apps/installments` does not exist** (no dir; absent from `backend/config/`). The only installment model is property-level (§4).

**Normal (full) purchase — `investments/services.py`:**
1. `create_investment()` ([services.py:67](backend/apps/investments/services.py:67)): `select_for_update` the property → validate supply / min-1-token / over-purchase → `amount = token_amount × token_price`, `ownership = token_amount / token_supply × 100` ([:99-110](backend/apps/investments/services.py:99)) → create `Investment(PENDING)`.
2. **Payment gate** ([:146-149](backend/apps/investments/services.py:146)): `card`/`crypto` stay `PENDING` (a **signature-verified PSP webhook** in `apps/payments` drives completion+mint); other methods are marked `COMPLETED` (interim simulated).
3. `mint_investment()` ([:313](backend/apps/investments/services.py:313)): row-locked, idempotent, **REAL on-chain** mint of the **entire `token_amount` at once** ([:350-351](backend/apps/investments/services.py:350)) to the custodial wallet → upserts `OwnershipToken` (full amount, ownership %) → credits **owner net** (`gross − fees`, [:400](backend/apps/investments/services.py:400)) + **broker commission** (gross × rate, [:406](backend/apps/investments/services.py:406)) in the same atomic block → `notify()`.

**Where installments diverge (all unbuilt):**
- **Payment is one-shot.** Installments need: charge the **down-payment** now, persist a **schedule**, then accept **N follow-on payments** over time — each ideally gated by the same PSP-webhook mechanism as the primary sale.
- **Minting is all-at-once, gated on `COMPLETED`.** Installments force a choice: **(A)** mint the full `token_amount` at down-payment and **lock/pledge** until paid off, or **(B)** mint **progressively** as each installment clears (ownership grows — matches the planners' visual), i.e. many small on-chain mints.
- **Owner credit + broker commission fire once, on the full gross at mint.** A schedule needs a policy: credit on down-payment? per-installment? on completion? (Same question for the **certificate**, which is provisional-at-create today, [:152](backend/apps/investments/services.py:152).)
- `Investment` has **no** installment fields (grep: 0) — no schedule, no paid-to-date, no missed-payment state.

---

## 4. Property-level installment marker / terms
- **Eligibility marker:** `Property.model == "installment"` (`PropertyModelType.INSTALLMENT`, [properties/models.py:45](backend/apps/properties/models.py:45)); such properties are forced into the `construction` category ([:116](backend/apps/properties/models.py:116)).
- **Terms (partial):** `InstallmentSchedule` OneToOne→Property ([properties/models.py:288-302](backend/apps/properties/models.py:288)) carries `total_installments`, `paid_installments`, `monthly_amount`, `next_payment_date`, `activation_date`, `completion_percent`. Serialized into detail as `installment` ([serializers.py:32-49](backend/apps/properties/serializers.py:32),[:376](backend/apps/properties/serializers.py:376)).
- **Gap:** there is **no `down_payment_percent`, no selectable durations, no frequency** on any backend model. The calculators source those from the **frontend mock** (`InstallmentCalculator` reads `property.installmentOptions.{downPaymentPercent,durations}` from PropertyDetail's inline `propertyDatabase`, **not Django**; `DynamicInstallmentPlanner` hardcodes 20/30/40 % and 1/2/3 yr). And `InstallmentSchedule` is a **single shared property row** — it is *not* per-investor (no FK to user/investment).

---

## 5. TOKEN / MONEY mechanics this raises (surfaced, not decided)
- **When does the investor get tokens?** Frontend *visual* implies **progressive** (`ownership = cumulativePaid/total`, grows `down% → 100%`, [DynamicInstallmentPlanner.tsx:78](src/components/property/DynamicInstallmentPlanner.tsx:78),[:379](src/components/property/DynamicInstallmentPlanner.tsx:379)). Current mint mints **100% up front**. These conflict — a real build must pick: **full-mint-then-lock** vs **progressive mint**. REAL ERC-1155 tokens are minted on-chain, so progressive = **N mints = N gas costs**; full-then-lock = 1 mint + a pledge/lock construct.
- **Pledge interaction:** `NovaFinancePledgeNotice` already states financed properties **remain pledged/mortgaged until a Nova Finance clearance** ([NovaFinancePledgeNotice.tsx:24-26](src/components/legal/NovaFinancePledgeNotice.tsx:24)) — directly relevant to a "mint-then-lock-until-paid-off" model.
- **Missed installment:** **no handling anywhere** (mock shows `pending/upcoming` only). A build needs grace/penalty/forfeiture/clawback + plan-cancellation semantics — and clawback of *already-minted* tokens is expensive/irreversible on-chain (argues against early full mint).
- **Is each installment a gated payment?** The down-payment would be one Stripe/NOW charge through the existing webhook-gated path; **each subsequent installment** would need its **own** gated charge (+ partial mint/unlock). Today only the single primary sale is webhook-gated.
- **Owner credit / broker commission timing:** both currently compute off the **full gross at the single mint** ([services.py:400,406](backend/apps/investments/services.py:400)). With a schedule, do they accrue at down-payment, per-installment, or on completion?

---

## 6. KEY QUESTIONS for the build (decide before coding — not decided here)
1. **Schedule model & where terms live.** Add real per-property terms (down-payment %, duration options, frequency, activation rule) + a **per-investor `InstallmentPlan` + `InstallmentPayment` ledger** (the existing `InstallmentSchedule` is property-level display only). Reuse `Investment` or introduce a plan that spawns one settlement at the end?
2. **Mint timing — full-then-lock vs progressive.** Pick one and make the frontend visual honest. If progressive: N on-chain mints + gas. If full-then-lock: a pledge/lock primitive (ties into the Nova Finance pledge) + clawback-on-default.
3. **Per-installment payment.** Reuse `apps/payments` (Stripe/NOW) webhook-gated charges for **every** installment, not just the down-payment; idempotent like the primary sale.
4. **Missed-payment handling.** Grace period, penalties, forfeiture/clawback, plan cancellation, and what happens to any already-minted/locked tokens.
5. **Owner-credit + broker-commission + certificate cadence** across the schedule (down-payment / per-installment / on-completion) — and keep all of it settlement-gated + idempotent, consistent with the primary-sale guarantees.
6. **Checkout carry-through.** Read `type`/`duration` (and a chosen down-payment %), populate the already-declared `InvestmentData.isInstallment/downPayment/...`, and charge the **down-payment** (not full) on the gated path.

---

### Files surveyed
`src/pages/Installments.tsx` (mock) · `src/components/property/InstallmentCalculator.tsx` · `src/components/property/DynamicInstallmentPlanner.tsx` · `src/pages/Checkout.tsx` · `backend/apps/installments/` (absent) · `backend/apps/investments/services.py` · `backend/apps/properties/models.py` (`InstallmentSchedule`) · `backend/apps/investments/models.py` (no installment fields). Grep `installment` scoped to `src/pages` + `src/components` + `backend/apps/installments` + `backend/apps/investments` (the latter: 0 matches).
