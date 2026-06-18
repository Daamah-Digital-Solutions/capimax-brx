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

### A — BLOCKED
- `src/pages/Distributions.tsx:73` — **Export Statement** — no-handler — A:reports-export.
- `src/pages/Distributions.tsx:77` — **Tax Report** — no-handler — A:reports-export.
- `src/pages/Wallet.tsx:225` — **Export** (transactions) — no-handler — A:reports-export.
- `src/pages/PropertyDetail.tsx:1122` — **Add to Favorites** — no-handler — A:favorites (no favorites domain).

### B — CLEANUP
- **`src/pages/Wallet.tsx:432` — `WithdrawalDialog` (investor withdraw) — LEGACY SUPABASE-OTP — B.** ⚠️ The marquee item: the owner wallet already moved to the Django `OwnerWithdrawDialog`; the **investor** withdraw still uses the old Supabase OTP dialog. Repoint to `walletsApi.requestWithdrawal`.
- `src/pages/PropertyDetail.tsx:880` — **Add to Wallet** (SPV tab) — toast-only (3s "added"), informational MetaMask-add dialog, no real action — B (decorative/misleading).
- `src/pages/Dashboard.tsx:206` — **View All** (holdings) — no-handler — B (decorative).
- `src/pages/Dashboard.tsx:254` — **By Region** (allocation filter) — no-handler — B (decorative).
- `src/pages/Dashboard.tsx:346` — **View All Activity** — no-handler — B (decorative).
- `src/pages/Notifications.tsx:108` — **Settings** gear — no-handler — B (no prefs backend; local only).

### C — QUICK-WIN (existing endpoint)
- `src/pages/Wallet.tsx:160` — **Refresh balance** — no-handler — C (refetch `walletsApi.balance`/`useUserWallet`).
- `src/pages/Dashboard.tsx:369` — **Deposit** (quick action) — no-handler — C (route to wallet / top-up).
- `src/pages/Dashboard.tsx:385` — **Documents** (quick action) — no-handler — C (route to portfolio certificates).

**Verified-wired (no gap):** SecondaryMarket buy/sell/withdraw (`useSecondaryMarket`); VerifyCertificate (`certificatesApi.verify`); CertificatesSection refresh; Portfolio token-details.

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
- `src/pages/Commissions.tsx` (whole page) — **still MOCK** — not repointed to `brokerApi.commissions` — A/B (BrokerDashboard was repointed; this older standalone page wasn't).

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
1. **Investor `Wallet.tsx:432` legacy Supabase-OTP `WithdrawalDialog`** → repoint to `walletsApi.requestWithdrawal` (the Django owner flow already exists to copy).
2. **`Settings.tsx` + `AuditLog.tsx` still import Supabase** → repoint or gate.
3. **`VerifyCertificate.tsx`** TS/wiring errors (confirm current state).
4. Decorative "View All" / duplicate theme buttons → wire or remove.

### Cheapest QUICK-WINS (existing endpoints, no new domain)
Settings profile-save / change-password / logout-all (`/auth/*`); Wallet & OwnerReports **Refresh** (refetch hooks); Referrals **Copy/Share** link; Dashboard **Deposit/Documents** routing; Partners **Contact Us**; Header **Search**.
