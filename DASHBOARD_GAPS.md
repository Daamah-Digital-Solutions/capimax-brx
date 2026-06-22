# DASHBOARD_GAPS.md — non-functional / mock / stub control inventory

> Read-only audit (no code changed). Sweep of `src/pages` + `src/components` via 4 parallel
> Explore passes + targeted spot-verification. Goal: every interactive control NOT fully wired to
> the Django backend, classified for planning.

**Buckets:** **(A) BLOCKED** — needs an unbuilt domain (family / reinvestments / installments /
reports-export / broker-listings / cards / order-book / favorites). **(B) CLEANUP** — known
tech-debt (legacy Supabase, decorative leftovers). **(C) QUICK-WIN** — small wire-up to an
**existing** Django endpoint, finishable now.

**Classification rule applied consistently:** any **Export / Download-PDF / CSV / statement / tax /
generate-report** button → **A-BLOCKED:reports-export** (no document-generation backend exists),
even where an agent first guessed "quick-win".

**Caveat:** "no-handler" findings are from static reads; a few may have handlers on a parent — confirm
at implementation. Line numbers are from the audit pass.

---

## INVESTOR

### ✅ Portfolio.tsx — full mock→real repoint + small backend enrichment (NOTHING deleted, NOTHING faked)
The "My Portfolio" page was mock (`portfolioStats`, `holdings[]` with Unsplash images, placeholder
Tokens tab, mock ReinvestCard). Now real — every card/badge/column/dropdown item/section KEPT in place:
- **Backend enrichment (no migration):** the tokens endpoint (`WalletTokensView`) now batches a
  `Property.objects.filter(slug__in=…)` lookup (token.property_id == Property.slug) and exposes the
  metadata the model didn't carry but Property already has — `city`/`location`/`location_ar`/`country`,
  `asset_type`/`category`, `image`/`images`, **`construction_progress`**, **`exit_eligible`** — plus a
  derived **average cost basis** (`avg_cost_per_token`, `invested_usd`). One query, no N+1, self-scoped.
- **Backend cost-basis (no migration):** secondary-market + LP-market buyer settlement now call a shared
  `record_acquisition_cost()` (a completed `Investment` row) so return% is correct for ALL holdings, not
  only primary buys. **No money-flow change** — it only records the price already paid; idempotent via the
  listing's completed-status guard. Avg cost = Σ(amount_invested)/Σ(token_amount), invariant to partial sells.
- **Summary cards:** Total Value + Tokens ← `useOwnershipTokens`; Properties ← distinct count; Pending
  Distributions ← `useDistributions`; **totalInvested + return% ← real cost basis** (show "—" only when a
  holding has no cost record yet — never a fake number).
- **Holdings list ← enriched tokens:** real name, units, current value, ownership%, real `/property/:property_id`,
  real location/type, real image (placeholder block when none), **construction-status badge w/ real %**,
  **exit-eligible badge** (real flag). `exitableAssets` count ← real `exit_eligible`.
- **Tokens tab** (was empty placeholder) → real `<TokenHoldings>`. **Filter** Select wires over real
  holdings (active/construction/exitable now have real data). **Export Report** + the **Reports** dropdown
  item → `reportsApi.export("wallet","pdf")`. **Token Details** dropdown → switches to the (real) Tokens tab.
  **ReinvestReturnsCard** `availableReturns` ← real `useReinvestments().availableBalance`.
- **CreateVirtualCardButton — KEPT as-is** (deferred visa-cards; still Supabase-functional — not mock, so
  not disabled; disabling would regress a working feature). Flagged.
- Loading spinner + existing empty state ("No assets") driven by real data; bilingual EN/AR preserved.
- **Wallet + Certificates tabs already real — untouched.** tsc clean; +2 cost-basis tests; suite green.
- **Honest edge flagged:** for **installment** holdings, `Investment.amount_invested` is the full committed
  price, so cost basis reflects *committed* (not yet fully *paid*) cost — a minor average-cost nuance.

### ✅ Dashboard.tsx — full mock→real repoint (frontend-only, existing endpoints)
The investor home page was **100% mock** (no API calls; hardcoded `portfolioStats`, `holdings`,
`recentActivity`, `upcomingPayments`, fake user name). Now wired to real Django data:
- **User name** → `useAuth().user.profile.full_name || email` (was "Mohamed Ahmed").
- **Total Value** → sum of real `useOwnershipTokens` `token_value_usd`; **Properties** → distinct property count.
- **Total Returns** + **ReinvestmentBanner** + **ReinvestReturnsCard** `availableReturns` → real internal
  balance via `useReinvestments().availableBalance` (= `walletsApi.balance`). One real value, 3 spots.
- **Pending Distributions** → `useDistributions().stats.pendingAmount`.
- **Holdings list** → real ownership tokens grouped by property (name, units, ownership%, current value,
  real `/property/:property_id` link); loading spinner + empty state ("No investments yet" → marketplace).
- **Recent Activity** → real `useNotifications` (`renderNotificationCopy` + `relativeTime`); **"X new"** =
  real `unreadCount`; **View all activity** → `/notifications`. **View All** (holdings) → `/portfolio`.
- **Allocation donut** → derived from **real per-property VALUE SHARE** (`token_value_usd / total`), center
  = real property count. *(Decision: the token model carries NO type/category, so the fake
  Commercial/Residential/Industrial 40/35/25 split was NOT invented — replaced with real per-property
  shares. The By-Type/By-Region toggles were removed.)*
- **Quick action Reinvest** → `/reinvestment` (was `/marketplace`).

**Removed / deferred-and-handled honestly (no fake numbers shown):**
- **"+12%" KPI trend badge** — REMOVED (no portfolio time-series endpoint).
- **Upcoming Payments** section — REMOVED (distributions are ad-hoc; no scheduled-distributions endpoint).
- Per-holding **construction status / progress bar** — DROPPED (no build-progress field on tokens).
- Per-holding **"invested" + returnPercent / `+9.4%`** — DROPPED: ownership tokens carry **no cost-basis**,
  so a truthful return % isn't computable (would be invented). Holdings show units + ownership% + current value.
- **ReinvestReturnsCard** 5% bonus + 2% Pronova math, `Progress=75`, `totalReinvested`/`totalBonus`, and
  **ReinvestmentBanner** bonus figure — REMOVED; bonuses shown as honest **"Coming soon"** (deferred product,
  no backend/Pronova). The card/banner now use the real balance + CTA → `/reinvestment`. *(`totalReinvested`/
  `totalBonus` props kept optional-but-ignored so Portfolio.tsx/Wallet.tsx still compile — those pages still
  feed the card their OWN mock `availableReturns`, a separate audit.)*
- **ExitOptionsCard fees** (0.5% / 1%) — left as static nav config (no fee-config endpoint) — flagged, minor.

tsc clean; loading/empty states added (a new investor sees clean zeros/empty, not mock).

### A — BLOCKED
- `src/pages/Distributions.tsx:73` — **Export Statement** — no-handler — A:reports-export.
- `src/pages/Distributions.tsx:77` — **Tax Report** — no-handler — A:reports-export.
- `src/pages/Wallet.tsx:225` — **Export** (transactions) — no-handler — A:reports-export.
- `src/pages/PropertyDetail.tsx:1122` — **Add to Favorites** — no-handler — A:favorites (no favorites domain).

### B — CLEANUP
- ~~`src/pages/Wallet.tsx:432` — `WithdrawalDialog` (investor withdraw) — LEGACY SUPABASE-OTP — B.~~ ✅ **CLOSED** — investor Wallet repointed to the shared Django `OwnerWithdrawDialog`; the dead `WithdrawalDialog.tsx` component was deleted.
- ~~`src/pages/PropertyDetail.tsx:880` — **Add to Wallet** (SPV tab) — toast-only (3s "added"), informational MetaMask-add dialog, no real action — B.~~ ✅ **CLOSED** — button + dialog **removed** (PropertyDetail finishing).
- ~~`Dashboard.tsx` — **View All** (holdings) / **By Region** (allocation) / **View All Activity** — decorative~~ ✅ **CLOSED** (Dashboard repoint): View All → `/portfolio`, View All Activity → `/notifications`, By-Type/By-Region toggles removed.
- `src/pages/Notifications.tsx:108` — **Settings** gear — no-handler — B (no prefs backend; local only).

### C — QUICK-WIN (existing endpoint)
- `src/pages/Wallet.tsx:160` — **Refresh balance** — no-handler — C (refetch `walletsApi.balance`/`useUserWallet`).
- `Dashboard.tsx` Quick Actions (**Deposit**→/wallet, **Secondary Market**→/secondary-market, **Reinvest**→/reinvestment, **Documents**→/documents) — all real nav links (verified post-repoint).

**Verified-wired (no gap):** SecondaryMarket buy/sell/withdraw (`useSecondaryMarket`); VerifyCertificate (`certificatesApi.verify`); CertificatesSection refresh; Portfolio token-details.

### MARKETPLACE filters — ✅ ALL CLOSED (frontend-only, over the already-fetched `properties[]`)
Wired the five dead/decorative filter controls; no new endpoints. Verified live in-browser
(catalogue served by Django): Risk `low` 7→3, City `Dubai` 7→2, reset→7, no console errors.
- ~~`MarketplaceFilters.tsx:273` — **Min Investment** buttons — wrote a local state never read by the parent filter (dead).~~ ✅ **CLOSED** — lifted to `selectedMinInvestment` in `Marketplace.tsx`; predicate keeps `p.minInvestment ≤ selection`. (Wired & correct; won't visibly narrow the current seed — every property's `minInvestment` is $100 — but narrows once entry minimums vary.)
- ~~`MarketplaceFilters.tsx:293` — **Risk Level** buttons — no `onClick` (decorative).~~ ✅ **CLOSED** — `selectedRisk[]` multi-toggle + predicate on `p.riskLevel`.
- ~~`MarketplaceFilters.tsx:184` — **City** checkboxes — no `checked`/`onChange` (mock).~~ ✅ **CLOSED** — `selectedCities[]` + predicate on the normalized `p.city` id; **options + counts now derived from the live catalogue** (the old hardcoded list had wrong ids). Unknown cities fall back to their raw id label.
- ~~Country / asset / city **count badges** — hardcoded (24/18/8…).~~ ✅ **CLOSED** — derived live from `properties` scoped to the active category (mirrors the category-tab convention).
- ~~`MarketplaceFilters.tsx:348` — **"Apply Filters"** button — no-op (filters are reactive).~~ ✅ **DELETED**.
- Active-filter chip bar extended with removable City / Risk / `≤ $min` chips for parity.

**Still deferred (Marketplace):** `GlobalStats.tsx` — all 8 stat cards are hardcoded mock (32 / $127M / 9.8% …) with a no-op `cursor-pointer`. **A:platform-stats** — needs a stats-aggregation endpoint; out of scope for a frontend-only pass.

### PROPERTYDETAIL finishing — ✅ fake traps neutralized (frontend-only)
The invest flow ("Invest Now" → real Checkout: payment + on-chain mint) is confirmed real and was **NOT touched**. The whole **installment flow** (the "Invest with Installments" button + `InstallmentCalculator`) was **deliberately left as-is** — see the installments note below.
- ~~Ready-sidebar **units stepper** + hardcoded **"$1,000" total** ([:1100](src/pages/PropertyDetail.tsx)) — dead fake quantity selector.~~ ✅ **CLOSED** — replaced with an informational unit-price row + "choose quantity at checkout" note (the real selector lives on Checkout). Verified live: no number input, no `$1,000`.
- ~~**Add to Wallet** + confirm dialog ([:880](src/pages/PropertyDetail.tsx)/[:1215](src/pages/PropertyDetail.tsx)) — toast-only.~~ ✅ **REMOVED** (button + dialog + dead state/handler/imports).
- ~~**Verify on Blockchain** ([:867](src/pages/PropertyDetail.tsx)) — linked to a MOCK contract address.~~ ✅ **GATED** — now renders only when the Django catalogue carries a **verified** `tokenMetadata.contractAddress`, opening that `explorerUrl`; hidden otherwise. ⚠️ Caveat: the authoritative on-chain field `Property.deployed_contract_address` ([models.py:480](backend/apps/properties/models.py:480)) is **not serialized** by the detail endpoint, so the gate currently keys on the (dev-seeded) `tokenMetadata`. When the on-chain deploy pipeline is finalized, expose + switch the gate to `deployed_contract_address`.
- **Document "Verify" buttons** ([PropertyDetail.tsx:985](src/pages/PropertyDetail.tsx), [PropertyDataRoom.tsx:638](src/components/property/PropertyDataRoom.tsx)) — **reclassified from C → A:property-documents.** The only verify route is `/verify/:code` ([App.tsx:128](src/App.tsx)), which verifies **investor ownership certificates by code**; property documents carry no such code, so routing there would 404 / error. Needs a document-verify surface (part of a property-documents domain). Left untouched pending decision.

**Still BLOCKED on PropertyDetail (flagged, not built):** Add to Favorites (`A:favorites`); document **Eye/Download** + Insurance **View Cert/Download Policy** + DataRoom Eye/Download (`A:property-documents` — no doc storage/serving); **Reports-tab** downloads (`A:property-reports`). The SPV/financials/token tabs for ids `"1"`/`"2"` remain inline mock (structural; not in this pass).

> **Installments is a PLANNED DOMAIN, not a gap to hide.** The `Installments.tsx` items below (Pay Now, Export Schedule, Filter) and the PropertyDetail installment calculator/button are the surface of the **next full domain build** (a core investment model, like KYC/payments/LP were). They are intentionally left intact — do **not** neutralize or stub them as "fake traps." They get real backing in their own phase.

---

## OWNER / DEVELOPER

### A — BLOCKED
- `src/pages/OwnerDashboard.tsx:220` — **Download comprehensive report** — no-handler — A:reports-export.
- `src/pages/OwnerReports.tsx:97` — **Export Report** — no-handler — A:reports-export.
- `src/pages/OwnerDashboard.tsx:535` — **Send update** (stakeholder broadcast) — no-handler — A:messaging (no domain).

### B — CLEANUP
- `src/pages/OwnerDashboard.tsx:531` — **Upload documents** (quick action) — no-handler — B (route stub; OwnerDocuments exists).
- Submission **media** (SubmitProperty images/docs) not persisted server-side — B (known; per prior DECISIONS).

### C — QUICK-WIN
- `src/pages/OwnerReports.tsx:93` — **Refresh** — no-handler — C (refetch earnings hook).
- `src/pages/OwnerDashboard.tsx:539` — **View reports** (quick action) — no-handler — C (navigate to OwnerReports).
- `src/pages/OwnerDashboard.tsx:493` — **View all messages** — no-handler — C (route, if messages exist) / else A:messaging.

**Verified-wired:** OwnerWallet uses Django `OwnerWithdrawDialog`; SubmitProperty wizard → owner submission API; KYB/earnings flows.

---

## LP

### B — CLEANUP / A — BLOCKED
- `src/components/liquidity/LPReports.tsx:92-107` — **Monthly / Quarterly / Annual / Export Data** (4 buttons) — no-handler — A:reports-export (report generation + export).

**Verified-wired:** LP KYB (`PartnerVerificationCard`-style), LP market buy/sell/withdraw (`useLPMarket`/`lpApi`).

---

## PARTNER

### C — QUICK-WIN
- `src/pages/Partners.tsx:256` — **Contact Us** (Become a Partner CTA) — no-handler — C (route / mailto).

**Verified-wired:** StrategicPartners upload/submit (`useAssignments`); PartnerVerificationCard apply/KYB/directory; public directory (`partnerApi.directory`).

---

## BROKER

### A — BLOCKED
- `src/pages/Listings.tsx:331` — **View** (per listing) — no-handler + mock — A:broker-listings (no model).
- `src/pages/Listings.tsx:334` — **Share** (per listing) — no-handler + mock — A:broker-listings.
- `src/pages/Listings.tsx:337` — **Message** (per listing) — no-handler + mock — A:broker-listings / messaging.
- `src/pages/Commissions.tsx:131` — **Export Report** — no-handler + mock — A:reports-export.
- `src/pages/Commissions.tsx:295` — **Update Payment** (bank/payout method) — no-handler + hardcoded bank — A:payment-method (no model).
- `src/pages/Commissions.tsx` (table + stats + monthly summary) — ✅ **CLOSED (finishing cleanup)** — repointed off mock to `brokerApi.commissions()` via `useBrokerCommissions` (loading/empty states, bilingual). (The `Update Payment` card + `Filter` button below remain — separate A:payment-method / placeholder items.)

### B — CLEANUP
- `src/pages/Referrals.tsx:203` — **Filter** icon — no-handler — B (placeholder).
- `src/pages/Commissions.tsx:196` — **Filter** icon — no-handler — B (placeholder).
- `src/pages/Listings.tsx:218` — **Filter** icon — no-handler — B (placeholder).
- `src/pages/Referrals.tsx:117` — **Add Referral** (header CTA) — no-handler — B (intent unclear; referrals form via attribution, not manual add).
- BrokerDashboard **Listings / Performance** tabs — mock (no broker-listings model; flagged in code comments) — B/A:broker-listings.

### C — QUICK-WIN
- `src/pages/Referrals.tsx:182` — **Copy** (referral link) — no-handler — C (clipboard; the real link is already available via `brokerProfile.referral_code`).
- `src/pages/Referrals.tsx:185` — **Share** (referral link) — no-handler — C (Web Share API).

**Verified-wired:** BrokerDashboard stats/referrals/commissions (`useBrokerCommissions` → `brokerApi.commissions`); Visa-wallet balance + **Withdraw** ([BrokerDashboard.tsx:389] `walletsApi.requestWithdrawal`); BrokerVerificationCard KYC+licence+referral.

---

## SHARED / GLOBAL

### A — BLOCKED
- `src/pages/Reports.tsx:88` — **Export Full** — no-handler — A:reports-export.
- `src/pages/Installments.tsx:159` — **Export Schedule** — no-handler — A:reports-export.
- `src/pages/Installments.tsx:227` / `:368` — **Pay Now** (×2) — toast-only / 2s mock dialog — A:installments (no domain; payment of an installment).
- `src/pages/Reinvestment.tsx` (`useReinvestments`) — **still Supabase/mock** — A:reinvestments.
- `src/pages/FamilyInvestment.tsx` (`useFamilyAccounts`, line 14) — **still Supabase**; Allocate/Transfer/Add-Bank/Add-Schedule/Confirm-Transfer + advanced (beneficiaries/proxy/gift) all toast-only or Supabase — A:family. (See FAMILY_SURFACE.md.)
- `src/pages/Cards.tsx` + `src/components/wallet/VisaCardsSection.tsx` (`useVisaCards`) — Top-Up / Freeze / Pay / Create — **unverified backend; no Django cards domain known → treat as A:cards** (likely mock/Supabase; confirm `useVisaCards` source).
- `src/pages/AuditLog.tsx:2` — imports Supabase directly — A:audit-log / B (no Django audit endpoint).

### B — CLEANUP
- `src/pages/Settings.tsx:12` — imports **Supabase** directly (admin check + data) — B (repoint to Django auth/me).
- `src/pages/Settings.tsx:382-393` — **Theme buttons** (Dark/Light/Auto) — decorative duplicates of the working Header toggle — B.
- `src/pages/VerifyCertificate.tsx` — known TS/wiring errors (prior DECISIONS cleanup item) — B. *(Investor agent reported it functional; reconcile — prior notes flag TS errors. Confirm.)*

### C — QUICK-WIN (existing endpoints)
- `src/pages/Settings.tsx:164` — **Save Changes** (profile) — no-handler — C (`/auth/me` update).
- `src/pages/Settings.tsx:228` — **Change Password** — no-handler — C (password endpoint exists).
- `src/pages/Settings.tsx:258` — **Logout All Sessions** — no-handler — C (`/auth/logout`).
- `src/pages/Settings.tsx:293` — **End Session** (per-device) — no-handler — C.
- `src/pages/Settings.tsx:248` / `:325-352` — **2FA toggle + notification/channel switches** — no-handler — C/A (prefs backend may not exist → if none, A:notification-prefs).
- `src/pages/Settings.tsx:399` — **Currency** select — no-handler — C.
- `src/pages/Settings.tsx:422` / `:426` — **Deactivate / Delete Account** — no-handler — C (account endpoints) / B.
- `src/components/layout/Header.tsx:93` — **Search** bar — no-handler — C (marketplace already filters client-side).
- `src/pages/Documents.tsx:327` / `:330` — **View / Download** (per document) — no-handler — C if certificate/doc download endpoint exists, else A:documents.
- `src/pages/Support.tsx:157-191` / `:262-275` / `:398-404` — **Contact cards / FAQ buttons / Submit Ticket** — no-handler — C (route/mailto) / A:support-tickets (if a tickets backend is intended).
- `src/pages/Reports.tsx:85` — **Refresh** — no-handler — C.
- `src/pages/Reports.tsx` filters (`:141-185`, `:293-317`) — local-only over mock data — C/A:reports (report data itself may be mock).
- `src/pages/Reports.tsx:406` — **View Details** — no-handler — C.
- `src/pages/Installments.tsx:239` — **Filter** (All/Active/Completed) — local-only over mock — A:installments.

**Verified-wired:** Header theme toggle, language switch, notifications bell (`useUnreadCount`), auth menu.

---

## SUMMARY — count per bucket per role

| Role / Area        | A (BLOCKED) | B (CLEANUP) | C (QUICK-WIN) |
|--------------------|:-----------:|:-----------:|:-------------:|
| Investor           | 4           | 6           | 3             |
| Owner / Developer  | 3           | 2           | 3             |
| LP                 | 4*          | —           | —             |
| Partner            | —           | —           | 1             |
| Broker             | 6           | 5           | 2             |
| Shared / Global    | ~9          | 3           | ~16           |
| **TOTAL (approx)** | **~26**     | **~16**     | **~25**       |

\*LP's 4 are the LPReports export/generation buttons (one component).

### Blocking domains (what unlocks the A bucket)
- **reports-export / document generation** — ✅ **BUILT (Phase 13 — `apps/reports`, CSV + ReportLab PDF over self-scoped data).** CLOSED: Wallet Export, Distributions Statement + Tax, OwnerReports, OwnerDashboard, LPReports ×4, broker Commissions. Still deferred (need a data layer first): **Reports.tsx "Export Full"** (mock analytics/catalog) + **Installments "Export Schedule"** (domain unbuilt). See REPORTS_SURFACE.md / DECISIONS.md "Phase 13".
- **family** — entire FamilyInvestment page (still Supabase) — see FAMILY_SURFACE.md.
- **reinvestments**, **installments** (incl. Pay-Now) — still mock/Supabase.
- **broker-listings** (3) + **broker payment-method** (1) — no models; `Commissions.tsx`/`Listings.tsx` still standalone mock.
- **cards / Visa** — `useVisaCards` backend unverified; no Django cards domain known.
- **favorites**, **messaging / stakeholder updates**, **support-tickets**, **notification-prefs**, **audit-log** — small satellite features with no backend.

### Highest-value CLEANUP
1. **Investor `Wallet.tsx` legacy Supabase-OTP `WithdrawalDialog`** → ✅ **CLOSED** — Wallet repointed to the shared Django `OwnerWithdrawDialog`; the dead `src/components/wallet/WithdrawalDialog.tsx` was **deleted** (finishing cleanup).
2. **`Settings.tsx` + `AuditLog.tsx` still import Supabase** → repoint or gate.
3. **`VerifyCertificate.tsx`** TS/wiring errors (confirm current state).
4. Decorative "View All" / duplicate theme buttons → wire or remove.

### Cheapest QUICK-WINS (existing endpoints, no new domain)
Settings profile-save / change-password / logout-all (`/auth/*`); Wallet & OwnerReports **Refresh** (refetch hooks); Referrals **Copy/Share** link; Dashboard **Deposit/Documents** routing; Partners **Contact Us**; Header **Search**.
