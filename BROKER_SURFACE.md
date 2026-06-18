# BROKER_SURFACE.md — read-only surface investigation

> Scope: read-only. No code changed. Grepped only within `backend/apps/broker`, `src/pages`,
> `src/hooks`, `src/components`, plus targeted reads of `core/models.py`, `RegisterRole.tsx`,
> `AppSidebar.tsx`, `DECISIONS.md`. Cited as `file:line`.

---

## 1. What IS a broker on this platform?

A **referral / commission agent** — earns a commission for bringing investors (and owners) who
then invest. Not a deal facilitator, not a token reseller. The UI says so in its own words:

- Role card tagline: **"Earn commissions on referrals & listings"** / "اكسب عمولات من الإحالات والإدراج"
  (`src/pages/RegisterRole.tsx:120-121`).
- Role card bullets: **"Refer investors & owners", "Tiered commission structure", "Real-time
  dashboard & payouts"** (`RegisterRole.tsx:122-126`).
- Dashboard referral-link card: **"شارك هذا الرابط للحصول على عمولة 5% على كل استثمار"**
  ("share this link to earn 5% commission on every investment") (`src/pages/BrokerDashboard.tsx:352`).
- Mechanism is a **referral link**: `https://capimax.io/ref/BROKER123`
  (`BrokerDashboard.tsx:98`; same in `src/pages/Referrals.tsx:90` as `capimax.com/ref/BROKER123`).

So: broker shares a referral link → referred user registers → invests → broker earns a % commission.

---

## 2. Frontend surface (what exists)

Two pages + a sidebar section. **All data is hard-coded local mock — no Supabase, no Django, no
hook.** (`grep "broker" src/hooks` → **no files**; there is no `useBroker`.)

**`src/pages/BrokerDashboard.tsx`** — header with copyable referral link + `CreateVirtualCardButton`
(`:120`); 4 stat cards; 5 tabs (Referrals / Commissions / Listings / Performance / Wallet).
Mock structures:
- `brokerStats` (`:36-45`): `totalListings, activeListings, totalReferrals, convertedReferrals,
  totalCommission: 35000, pendingCommission: 8500, thisMonthCommission: 5200, conversionRate: 62`.
- `listings[]` (`:47-78`): `{id, name, location, status: active|sold_out, referrals, converted,
  commission, image}`.
- `referrals[]` (`:80-86`): `{id, name, email, property, status: converted|pending|lost, amount,
  commission, date}`.
- `commissions[]` (`:88-93`): `{id, referral, property, amount, status: paid|pending, date}`.
- Wallet tab feeds `VisaCardsSection walletBalance={brokerStats.totalCommission}` (`:455-457`).

**`src/pages/Referrals.tsx`** — separate referral CRM page. Mock `referrals: Referral[]` (`:38-85`)
with `{id, name, email, phone, status: pending|registered|invested|rejected, date, property?,
investmentAmount?, commission?}`; stats derived client-side (`:92-95`); same `BROKER123` link
(`:90`); "Add referral" button is inert.

**`src/components/layout/AppSidebar.tsx`** — `broker` IS a real sidebar `UserRole` (`:61,85`) with
its own nav section `section.broker` (`:141-153`): **`/listings`, `/referrals`, `/commissions`,
`/broker-reports`**; path-detection for those routes (`:210,214`); section expanded by default
(`:224`).

⚠️ **Commission-rate inconsistency in the mock:** dashboard copy says **5%** flat
(`BrokerDashboard.tsx:352`; its referral rows are all 5%, e.g. 5000→250, 10000→500). But
`Referrals.tsx` rows imply **2.5–3%** (25000→625, 50000→1500). The real rate/tier policy is
undefined — must be decided at build.

---

## 3. Backend (the stub)

`backend/apps/broker/` is an **empty Phase-1 stub** — identical to how distributions /
notifications / partners looked before they were built:
- `models.py` — comment only, **no models** (`backend/apps/broker/models.py:1-3`).
- `admin.py` — comment only (`backend/apps/broker/admin.py:1`).
- `apps.py` — `BrokerConfig` (`label = "broker"`) only.
- `migrations/` — **`__init__.py` only**, no migration files.
- **No** `views.py`, `urls.py`, `services.py`, `serializers.py`, `permissions`, `tests.py`.

**The role exists but is stranded** — exactly the developer/partner pre-build situation:
- `Profile.Role.BROKER = "broker"` (`backend/apps/core/models.py:88`).
- In `SELF_SELECTABLE_ROLES` (`core/models.py:187`) AND `ROLES_REQUIRING_VERIFICATION`
  (`core/models.py:201`).
- So `apply_self_selected_role` parks a broker at `role_status = PENDING_VERIFICATION`
  (`core/models.py:172-173`) — and **nothing ever flips it back**: there is no `BrokerProfile`,
  no KYB/KYC-for-broker machine, no `approve_kyb` hinge, no `HasActivatedBroker` permission. A
  self-selected broker is permanently parked. **No broker logic exists anywhere in the backend.**

---

## 4. MONEY — the key question

**YES — a broker EARNS.** This is a **MONEY domain**, not a partner-style non-earning role.

Money/commission fields shown verbatim by the frontend:
- `brokerStats.totalCommission: 35000, pendingCommission: 8500, thisMonthCommission: 5200`
  (`BrokerDashboard.tsx:40-42`).
- Per-referral payout: `referral.commission` (`BrokerDashboard.tsx:248`); `Referral.commission?:
  number` + `investmentAmount?` (`Referrals.tsx:35,34`).
- Commission ledger with paid/pending lifecycle: `commissions[].{amount, status: "paid"|"pending"}`
  (`BrokerDashboard.tsx:88-93`); summary "إجمالي مستحق / تم الدفع / معلق" (total due / paid /
  pending) (`BrokerDashboard.tsx:328-341`).
- `Download / تصدير` commission statement button (`BrokerDashboard.tsx:286-289`).
- Wallet tab renders `VisaCardsSection walletBalance={brokerStats.totalCommission}` + a
  `CreateVirtualCardButton roleLabel="Broker"` (`BrokerDashboard.tsx:120,455-457`) — i.e. the broker
  treats commission as a spendable wallet balance, same UI owner/LP use.

**Implication:** like owner/LP, a real broker domain would reuse the
`UserBalance` / `BalanceTransaction` / `Withdrawal` ledger (commission credited as balance →
withdrawable), with **minting-grade safety + idempotent crediting** (a commission must be credited
exactly once per qualifying investment, never double-paid, never on a reversed/failed purchase).

---

## 5. Relationship to existing domains (seams)

- **Investments (referred investor → purchase):** the commission is earned on a referred investor's
  investment. A broker↔investor referral link must be recorded (referral code/attribution at
  signup), and commission computed when that investor's purchase **settles**. The natural hook is
  the **investment-completion / mint path** — the same webhook/IPN-gated point where the investor's
  tokens are minted and earnings are credited (the existing payments→mint flow). Commission should
  credit only *after* that on-chain settlement confirms, mirroring how owner/developer earnings are
  credited — never ledger-only, never pre-settlement.
- **Properties (listings / deals):** dashboard `listings[]` and per-listing referral/conversion/
  commission stats (`BrokerDashboard.tsx:47-78`) tie a broker to specific properties they promote.
- **Verification:** broker is gated (`ROLES_REQUIRING_VERIFICATION`, `core/models.py:201`). The
  role card labels it **KYC + "License Verified" / "ترخيص موثّق"** (`RegisterRole.tsx:132-133,136`)
  — note this is **KYC-flavored + a broker-license check**, distinct from the KYB used by
  owner/developer/lp/partner. Whether to build a BrokerProfile KYB-style machine (reusing the 5-way
  Sumsub webhook → 6-way) or a lighter KYC+license path is an open question.
- **Secondary market:** no current seam in the mock (commission copy is "on every investment" =
  primary purchases). Whether broker earns on secondary-market trades is undefined.

---

## 6. Open questions (NOT decided here)

1. **Verification path:** BrokerProfile + KYB (extend Sumsub webhook 5-way → 6-way + a
   `broker-kyb-level`, add `HasActivatedBroker`)? Or a lighter KYC + license-number capture? Card
   says "KYC / License Verified", which differs from every other privileged role's KYB.
2. **Referral attribution:** how is a referred user tied to a broker — a `ref/BROKER123` code
   captured at registration? A per-broker code/link persisted on the broker profile? An explicit
   admin assignment? The `BROKER123` link is currently a hard-coded string.
3. **Commission computation:** flat 5% (dashboard) vs tiered 2.5–3% (Referrals.tsx) — what's the
   real rate/tier rule? On which base (gross investment? net?)? On primary purchases only, or also
   distributions/secondary trades?
4. **Crediting + safety:** exactly-once, idempotent crediting hooked to the settled/minted
   investment; behavior on refunds/failed payments; pending→paid lifecycle; does it land in
   `UserBalance` and become withdrawable via the existing `Withdrawal` stack (admin-sanctioned)?
5. **Admin role:** is there a sanctioned admin step (approve broker license, approve/release
   commission payouts), or is crediting fully automatic on settlement?
6. **Scope of the wallet/cards:** dashboard shows a Visa-cards wallet tab for brokers — is that in
   scope for the broker build or just inherited mock UI?

---

## Bottom line

Broker = **referral-commission agent**. Backend is an **empty stub**; the `broker` role exists in
core but is **stranded with no activation path** (like developer/partner were pre-build). Frontend
is **two unwired mock pages + a sidebar section**. It **EARNS commission**, so this is a **MONEY
domain** — it should reuse the `UserBalance`/`BalanceTransaction`/`Withdrawal` ledger with
minting-grade, idempotent, settlement-gated crediting, hooking into the existing
investment-completion/mint path for referred investors. Verification flavor (KYC+license vs KYB) and
referral-attribution mechanism are the two biggest undecided design seams.
