# FINAL_STATE.md — Capimax BRX stage-closing handoff

**Latest commit:** `0d15574` (on `origin/main`) · **Backend:** Django 5.2 + DRF + SimpleJWT, ~26 apps,
PostgreSQL · **Chain:** BSC Testnet (chain 97), web3.py, custodial Fernet-encrypted wallets ·
**Frontend:** React/Vite/TS, bilingual EN/AR · **Tests:** full suite **508 green** (last run).
**Authoritative record:** `DECISIONS.md` — this file is an organized index over it, not a
replacement; when in doubt, DECISIONS.md wins.

> **ALL FIVE role-dashboard realness passes are now CLOSED**, same two firm rules throughout — DELETE
> NOTHING (every element stays) and NEVER fake a number:
> - **INVESTOR DASHBOARD** — all 12 investor tabs audited + made real or honest placeholder. See **§0**.
> - **OWNER / DEVELOPER DASHBOARD** — all 7 owner/developer tabs audited + made real or honest placeholder.
>   See **§0B**.
> - **LP (LIQUIDITY PROVIDER) DASHBOARD** — all LP tabs audited; most confirmed real (most real backend of
>   any role), only a fabricated account-manager card + a hash-nav defect fixed. See **§0C**.
> - **BROKER DASHBOARD** — all broker surfaces audited; Commissions/Referrals honesty fixes, Listings
>   Phase 1 + Broker Reports built real on a new stamped `BrokerCommission` ledger. See **§0D**.
> - **PARTNER DASHBOARD** — all partner surfaces audited (non-earning, content already real); fixed the
>   structural orphan (added the partner role + sidebar nav home), wired deliverable-doc download, repointed
>   a dead CTA, disabled two cosmetic buttons. See **§0E**.

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

## 0. INVESTOR DASHBOARD REALNESS PASS — CLOSED (this stage)

Every investor surface was audited tab-by-tab and made **real** or given an **honest placeholder** — no
fabricated arrays, no silent no-op buttons, no mock-fed shared components. Two firm rules held throughout:
**(1) DELETE NOTHING** — every card/chart/row/badge/button stays; an unavailable value shows `—` / empty /
"Coming soon", never removed. **(2) NEVER fake a number** — real data or honest placeholder only.

### (1) The 12 investor tabs — all audited
| Tab | Outcome |
|---|---|
| **Dashboard** | Real (name, balance, holdings, pending distributions, activity, allocation); 3 wrongly-deleted elements restored. |
| **Portfolio** | Real; + token→Property enrichment + cost-basis on all buy paths (return% per holding). |
| **Reinvestment** | Real (balance + history + Pay-from-Balance); bonus/Pronova tab honest "Coming soon". |
| **Installments** | Real plans + cent-exact schedule + gated Pay-Now; **Export Schedule now real** (new adapter). |
| **Distributions** | Real; fixed 2 fabricated visuals → real `vsLastYear` delta + real per-property monthly series. |
| **Live Exits Hub** | Real (cross-market own sell-orders); no mock. |
| **Support** | **Built** the tickets domain (was 100% mock); AI/Live-Chat honest "Coming soon". |
| **Wallet** | Real balance/tx/withdrawals; **built deposit/top-up**; ReinvestCard real-balance fix; per-tx receipt "Coming soon". |
| **Notifications** | Real list/count/mark-read; **built per-type preferences**; channels/digest "Coming soon". |
| **LP Market** | Real feeds; 3 buy/sell-dialog honesty fixes (whole-listing total, real unit price, bank-transfer "Coming soon"). |
| **Secondary Market** | Real (clean — listings/buy/sell/cancel/history/withdraw); no mock. |
| **Reports & Analytics** | Was 100% mock → made real (overview/allocation/monthly-distributions/performance derived; Export Full → real PDFs); value time-series + saved-reports = honest placeholders. |

### (2) Built along the way (reusing existing systems — no new domains beyond these)
- **Support / tickets** (`apps/support`) — self-scoped ticket CRUD + admin status hinge.
- **Deposit / top-up** — gated external pay-in crediting `UserBalance` via the shared payment webhook
  (credit-not-mint branch, idempotent, no tokens), inert until keys.
- **Notification preferences** (`NotificationPreference`) — per-type in-app toggles persist (self-scoped
  singleton) + `notify()` respects them (fail-open, unmapped types always deliver, no emit-point regression).
- **Cost-basis on all buy paths** — `record_acquisition_cost()` writes an Investment cost row on
  secondary/LP buys too (primary always did) → real average cost + return% (no money-flow change).
- **token→Property enrichment** — `WalletTokensView` joins Property metadata (location/type/image/
  construction/exit) **+ `expected_yield`** by slug; powers Portfolio + Reports analytics.
- **Installments export adapter** — added an `installments` context to the Phase-13 reports framework
  (plan + schedule + paid/remaining over real plan data); no new domain.

### (3) Remaining "Coming soon" / deferred on the investor dashboard — grouped by BLOCKER
- **(A) External provider (no rail/service exists yet):** Support **AI Assistant** + **Live Chat** (AI/chat);
  Notifications **Email/SMS channels** + **digest** (mailer/SMS/scheduler); LP **bank-transfer** pay option,
  Wallet **bank / Apple Pay / Google Pay** deposit methods (pay-in rails); **payout destinations**
  (bank/crypto withdrawal rails). Card-issuer for the deferred cards domain.
- **(B) Deferred domain we chose not to build now:** **portfolio-value snapshot history** (unblocks the
  Reports value time-series chart + period-over-period deltas); **saved-reports catalog** (our model is
  on-demand export, not stored reports — so Reports category counts `—` + Recent Reports empty); **per-tx
  receipt endpoint** (Wallet receipt button — small separate build); **bid/ask order book** (peer market
  ships one-shot listings today).
- **(C) User / product decision:** **Reinvestment bonuses / Pronova token** + **Wallet Pronova/Sukuk**
  deposit methods (undefined product); **cards** mini-domains (`visa-cards`, `saved-cards`).
- **Family + Inheritance (awaiting client / your decision):** **Family Waves B/C/D** gated on (i) are members
  real KYC'd users with wallets vs passive sub-records, and (ii) the bank-payout provider (Wave A built +
  safe). **Inheritance / Estate + Gifting** deferred — PropShare port package held, spec captured; itself
  100% mock in PropShare, so a from-scratch build when greenlit.

### (4) Governance gates — UNCHANGED by this pass (full detail in §3)
This pass touched **read-side derivation + UI honesty only** — no money/mint/settlement logic changed. All
deploy gates stand exactly as before: **live provider keys** (Stripe/NOW/Sumsub/OAuth — code-complete,
inert) + a required live-key end-to-end test; **mainnet gates** (contract audit, KMS/HSM key custody,
gas-station seam, on-chain forfeit burn-back); the **`check_installment_defaults` daily scheduler** (built,
not yet cron-wired); and the **Fable 5 + Dynamic Workflows pre-delivery security review**.

---

## 0B. OWNER / DEVELOPER DASHBOARD REALNESS PASS — CLOSED (this stage)

The same tab-by-tab audit, applied to the **one combined "Owner / Developer" role** (`AppSidebar` role key
`owner`; owner and developer are separate KYB entities sharing this dashboard). The off-limits `/developers`
(DeveloperHub) is a **separate public marketing page, NOT this dashboard**. Both firm rules held throughout:
**(1) DELETE NOTHING** and **(2) NEVER fake a number** — and **verified-nothing-deleted after each tab**
(every fix diffed before commit).

### (1) The 7 owner/developer tabs — all audited
| Tab | Outcome |
|---|---|
| **My Assets** (`/my-assets`) | Real submissions/earnings/stats/verification. **Recent Updates → real notifications feed** (`useNotifications` + i18n copy); **Platform Messages → honest placeholder** (no announcements backend — NOT repointed, would duplicate the feed); **Quick Actions wired** (Upload→owner-documents, Reports→owner-reports, Send-update disabled "Coming soon"); dead mock arrays/state/imports tidied. Commit `9a31b88`. |
| **Submit Property** (`/submit-property`) | Backbone already real (gate→draft→doc upload→server-validated submit). **Step 5 Media** (image/video uploads + virtual-tour URL) made **real** via the existing document multipart pattern; **Step 2 manual lat/lng** captured + **range-validated** + persisted. Interactive **map picker inert-until-maps-key** (honest, like payment providers). +migration `0004`, +8 tests. Commit `ba242fc`. |
| **Asset Validation** (`/asset-validation`) | **Mislabeled duplicate nav** → renders the same `OwnerReports` component (header always reads "Owner Reports"). **Left as-is by user decision** (relabel/build is a separate later call; not removed). |
| **Owner Wallet** (`/owner-wallet`) | **Core real** — `walletsApi.balance`/`withdrawals` + `ownerApi.earnings` + real withdraw dialog → `/api/wallets/withdrawals/`. No no-op deposit (none exists); no ReinvestCard-style mock-prop leak. Deferred-as-before: bank/crypto managers (Supabase mini-domains), Visa cards (CARDS domain). |
| **Owner Reports** (`/owner-reports`) | **Made real** — period filter wired end-to-end; **Distributions** + **Investors** tabs real, **owner-scoped**, **investor PII masked server-side**; honest empty (zeros/`—`) when no data. Commit `ef40b36`. |
| **Owner Documents** (`/owner-documents`) | Audited **already fully real** — `useOwnerDocuments` → Django vault: list / upload (server type+size validation) / owner-only-blob download / delete; 4 stats real-derived. Zero mock. |
| **Messages** (`/messages`) | **Was a broken link** (no route → fell through to NotFound). **Fixed → real route** rendering an **honest "messaging coming soon" placeholder** (no fake inbox; links to the real Notifications feed). Nav item kept. Commit `803e973`. |

### (2) Built / changed along the way (reusing existing systems — no new domains)
- **Owner analytics endpoints** — `GET /api/owner/distributions/` (the owner's properties' rental-yield
  distribution history/totals) + `GET /api/owner/investors/` (distinct investor base + per-property
  breakdown, **PII masked**) + a **`?period=` filter** across earnings/distributions/investors. Read-side,
  owner-scoped, Decimal-exact, honest-empty. Cross-owner no-leak tested.
- **Submit Property media + coordinates** — `SubmissionDocument.DocType.IMAGE|VIDEO` (reusing the existing
  draft-only, submitter-scoped multipart upload — no new endpoint) + `PropertySubmission.virtual_tour_url`
  + `latitude`/`longitude` (Decimal, range-validated −90..90 / −180..180). Migration `0004`; +8 tests;
  required-docs submit gate intact (no regression).
- **Notifications-feed repoint** — My Assets "Recent Updates" now reads the **real** `useNotifications`
  feed (category-icon + i18n copy, mirrors `Notifications.tsx`); no new domain.
- **Messages placeholder route** — `src/pages/Messages.tsx` + `/messages` route (above the NotFound
  catch-all); fixes the broken nav link with an honest page, not a 404.

### (3) Remaining "Coming soon" / deferred on the owner dashboard — grouped by BLOCKER
- **(A) External provider (no key/rail yet):** **maps-provider key** (Google Maps / Mapbox) for the
  Submit-Property **interactive map picker** — manual lat/lng is real NOW, the visual picker is layered
  inert-until-key (same discipline as the AI/chat/mailer/SMS/card-issuer/bank rails in §0(3)A).
- **(B) Deferred domain we chose not to build now:** **announcements / messaging inbox** — backs both the
  **Messages** page and the My-Assets **Platform Messages** card (no admin↔owner messaging backend exists;
  the one-way Notifications feed is the real activity surface today); **heavier video storage/CDN** if
  property media grows beyond the current file-upload store.
- **Nothing else owner-side** — every other owner/developer tab is real today.

### (4) Rules held throughout
**DELETE NOTHING + NEVER fake**, verified after every tab. No element was removed: the Submit-Property map
region, all three My-Assets sidebar cards (Platform Messages / Recent Updates / Quick Actions), all six
submission-wizard steps, and every sidebar nav item were **kept** — unavailable surfaces became honest
placeholders / disabled "Coming soon", never deletions; no fabricated numbers anywhere. The only removals
were **never-rendered dead mock code** (e.g. My-Assets `ownerStats`/`assets` objects + unused imports).

---

## 0C. LP (LIQUIDITY PROVIDER) DASHBOARD REALNESS PASS — CLOSED (this stage)

The same tab-by-tab audit on the LP dashboard (`roles: ["liquidity_provider"]`). **This domain had the most
real backend of any role** — `apps/lp` (KYB onboarding + LP balance/transactions/documents + bank/crypto
destinations) + the LP exit-liquidity market + the shared reports framework — so nearly every surface
cleared as **"confirm real."** Only **two** real changes were needed in the whole pass: a fabricated
account-manager card and a hash-nav defect. Both firm rules held; verified-nothing-deleted after each fix.

### (1) The LP surfaces — all audited
| Tab / surface | Outcome |
|---|---|
| **LP Market** (`/lp-market`) | **Confirmed clean** — the 3 investor-pass honesty fixes all intact: purchase locked to whole-listing (`PurchaseForm` total = `listing.total_value`), real derived LP-sell unit price (`ResaleForm` from `current_value`, no hardcoded $100), bank-transfer disabled "Coming soon". Feeds all real (`useLPMarket`/`useLPHoldings`/`lpApi`/`secondaryMarketApi`). |
| **Withdrawals** | **Real money path** — withdrawal request → `POST /lp/withdrawals/` (balance-gated twice); bank/crypto destinations → `PATCH /lp/profile/bank-details/` + `/crypto-details/` (real LP-profile fields, NOT Supabase); real history. `VisaCardsSection` = deferred cards domain, `walletBalance` prop correctly **ignored** (no leak). |
| **Documents** | **Real Django vault** — list/upload(multipart)/owner-only-blob download/scoped delete via `lpApi` → `/lp/documents/…`. Mirror of Owner Documents. |
| **Registration / KYB onboarding** (`LPRegistrationFlow`) | **Real** apply → KYB submit → KYB doc upload (`lpApi.apply`/`submitKYB`/`uploadKYBDocument`), **webhook-driven** approval, **server-gated** by `HasActivatedLP`. Status (pending/under-review/rejected/approved) all real from `lpProfile`. |
| **Overview + Operations** (`LPOperationsDashboard`) | **Real** — balance/deposited/earnings/withdrawn stats + investment summary + recent-transactions list, all from `lpProfile`/`transactions`; `showDetails` expands the same real data. |
| **Reports** (`LPReports`) | **Real** — export buttons → `reportsApi.export("lp", …)` (the **`lp` adapter exists** + tested: `LPTransaction.filter(lp__user=user)`); YTD + monthly breakdown derived from real transactions, honest "-" cells. |
| **Analytics** (`LPAnalyticsCharts`) | **Real** — balance-trend / fund-distribution / transaction-breakdown charts all derived from `lpProfile`/`transactions`; honest "No data" / "No transactions yet" empty states; real key metrics. |

### (2) The only two changes (everything else was confirm-real)
- **Fabricated account manager → real support** (commit `806c43d`). `LPAccountManager` hardcoded a fake
  person ("Michael Anderson" + invented phone/email/availability + a fake "Available" badge) shown as the
  LP's *real* dedicated manager — **the one never-fake violation found in the whole LP pass**. Repointed the
  (kept) card to the **real platform support channel**: real published phone (`tel:`) + "Contact Support" →
  `/support` (the real tickets/help domain). No invented identity, no fake status. DELETE NOTHING.
- **Hash→tab navigation fix** (commit `806c43d`). The sidebar's `#operations` / `#reports` / `#withdrawals`
  deep-links were ignored (tabs were `useState`-driven with no hash reader) so every link opened Overview.
  Added a `location.hash` ↔ `activeTab` sync (mount + `hashchange`; invalid/empty → overview; tab clicks
  update the hash). The 3 nav links now open the correct tab. Pure frontend, all 6 tabs kept.

### (3) Remaining deferred on the LP dashboard — grouped by BLOCKER
- **(A) External provider:** the **cards domain** (`VisaCardsSection` — KEPT, real `useVisaCards`, no leak;
  card-issuer deferred, same as §0/§0B). No maps-key dependency here (that's Submit-Property, §0B).
- **(B) Deferred domain we chose not to build now:** **per-LP account-manager assignment** (no backend; the
  card now points at real platform support instead of a fabricated manager). Nothing else LP-side.

### (4) Rules held throughout
**DELETE NOTHING + NEVER fake**, verified after each fix. No element removed — the account-manager card,
its contact row + both action buttons, and all six LP tabs (overview/operations/reports/withdrawals/
analytics/documents) + triggers + content were **kept**; the fabricated manager was the single never-fake
violation, fixed by repointing to real support (not by deletion).

---

## 0D. BROKER DASHBOARD REALNESS PASS — CLOSED (this stage)

The same tab-by-tab audit on the broker dashboard (`roles: ["broker"]`). The broker role earns a
**platform-borne additive commission** on referred investors' completed primary sales, so this pass was
both an honesty audit **and** a real backend build: the commission was previously reconstructed by parsing
transaction memos, with no per-property rate and no stamped record. This pass made it a **real append-only
ledger** with the **fee_rate-stamp philosophy** (stamp the rate when earned, never recompute from the
current rate — the same discipline used for every other money path). Both firm rules held; verified-
nothing-deleted after each fix.

### (1) The broker surfaces — all audited
| Tab / surface | Outcome |
|---|---|
| **Commissions** (`/commissions`) | **Real** ledger / stats / export. The one honesty gap — a **fabricated Payment Method card** (fake bank card `•••• 4567` / "Emirates NBD" + a not-wired "Update Payment" button) shown as the broker's *real* payout method — was **the never-fake violation found in this pass**. Repointed the (kept) card to the honest truth: "Commissions are credited to your wallet balance and withdrawn from your Wallet" + a real `/wallet` link. Filter button disabled (cosmetic, not-wired). Commit `9ea9d54`. |
| **Referrals** (`/referrals`) | **Real** referral link / roster / stats / copy-share. The dead **"Add Referral" CTA** (brokers don't manually add referrals — attribution is set-once when an investor registers via the link) → **real Share action** (`Share Referral Link`, native share/copy, disabled when no code). Filter + row chevron disabled (cosmetic). Commit `9ea9d54`. |
| **Listings** (`/listings`, Phase 1) | **Was 100% mock → built real.** Real catalogue (`propertiesApi.list()`, filtered `open_for_promotion`) + real **per-property `broker_commission_rate`** STAMPED at conversion via the new append-only **`BrokerCommission`** ledger (idempotent via `balance_transaction` FK, **$ unchanged** — a mirror of the existing credit, not a new money path; memo backfill `legacy→null`, never invented). **Broker-scoped per-property stats** (`/api/broker/property-stats/` — only *this* broker's attributed conversions/investors/raised, **no property-total leak**). Effective rate = property rate ?? broker fallback. Per-property **leads "—"** (Phase 2). View→`/property/:slug`, Share→real referral link, Inquire disabled "Coming soon". Commit `6232ef9`. |
| **Broker Reports** (`/broker-reports`) | **Was a broken nav link → built real**, mirroring the already-real `OwnerReports` structure/style. Overview cards + Commissions ledger (real **rate column**, legacy rate → "—", never "0%") + By-Property (broker-scoped stats, leads "—") + Monthly (client-derived) tabs all real; client-side period filter; real export → `reportsApi.export("broker-commissions", "pdf", {period})`. Commit `9c7f756`. |
| **`/broker-dashboard`** (orphan) | The old broker hub page is superseded by the real Listings / Referrals / Commissions pages. The orphan route → **`<Navigate to="/listings" replace />`** (page file kept off-nav, no dead route, no 404 for old links/notifications). |

### (2) Built along the way (reusing existing money systems — one new structured record)
- **`Property.broker_commission_rate`** (Decimal 5,2, null, 0–100 validated) **+ `open_for_promotion`**
  (bool) — per-property commission rate with a **broker-level fallback** (`broker.commission_rate`) when
  null. Migration `0005`; serializer exposes `brokerCommissionRate` / `openForPromotion`.
- **`BrokerCommission`** append-only model — `rate_applied` + property **stamped at conversion** (the
  fee_rate-stamp philosophy), `gross` / `commission`, **idempotent via a `balance_transaction` OneToOne**
  (NOT `unique(broker, investment)` — one investment can earn multiple credits: down-payment + each
  installment). **The money path is unchanged** — `credit_broker_share` still credits the identical
  `BalanceTransaction`; this model is a structured mirror beside it. Read-only admin. Migration `0002`.
- **Memo backfill** (`0003`) — reconstructs one stamped row per existing commission tx; parses the rate
  from the memo (`Referral commission (X%)`), **unparseable → `rate_applied=null` + `is_legacy=True`**
  (never invented), preserves original `created_at`, idempotent, defensive non-UUID-reference guard.
- **`commission_ledger()` repointed** to read structured `BrokerCommission` rows (no more memo-parsing);
  **$ totals identical**. **`broker_property_stats()`** — broker-scoped per-property aggregation
  (only `referred_by_broker=broker` investors counted). **`BrokerReports` page** + `/broker-reports` route.
- **fee_rate-stamp philosophy applied to broker commissions** — the rate is frozen on the row when earned;
  a later change to the property/broker rate never rewrites historical commissions (tested:
  `test_rate_stamped_and_frozen`).

### (3) Remaining deferred on the broker dashboard — grouped by BLOCKER
- **(A) Deferred domain we chose not to build now:** **Phase 2 per-property LEAD attribution** — needs a
  property-aware referral link (`/ref/<code>?p=<slug>`) + a `BrokerLead` model + capture; until then every
  per-property **leads** cell is an honest **"—"** (conversions/investors/raised are real now).
- **(B) External / no-backend yet:** **broker↔platform Inquire / chat** (the Listings "Inquire" action is
  disabled "Coming soon" — same class as the AI/chat gap in §0(3)A).
- **(C) User / product decision:** **cards** (`VisaCards`) — same deferred cards domain as §0/§0B/§0C.
- **Nothing else broker-side** — every other broker surface is real today.

### (4) Rules held throughout
**DELETE NOTHING + NEVER fake**, verified after each fix. No element removed — the Commissions Payment-
Method card (repointed, not deleted), the Referrals CTA (repurposed to Share, not deleted), every Listings
catalogue card/stat/column, all Broker Reports cards/tabs, and the orphan `/broker-dashboard` page (kept,
redirected) all stayed. **Two fabricated cards were caught and fixed across this engagement** — the broker
**Payment Method** (fake bank card) and the earlier LP **account-manager** (fake person, §0C) — *the same
pattern both times*: a fake person/account shown as real → **repointed to the real support/wallet**, never
deleted, never re-faked. The only removals were never-rendered dead mock arrays.

---

## 0E. PARTNER DASHBOARD REALNESS PASS — CLOSED (this stage — LAST of the 5 roles)

The same tab-by-tab audit on the partner dashboard (`roles: ["partner"]`). The partner is a **NON-EARNING
service vendor** (valuation / property-management / insurance) — there is **no money / wallet / cards
surface anywhere** in this role. The CONTENT was already fully real from the P11 / P11B builds, so almost
every surface cleared as **"confirm real."** The pass fixed **one structural gap + four small gaps**; both
firm rules held, verified-nothing-deleted after each fix. **This pass closes all five role dashboards.**

### (1) The partner surfaces — all audited
| Tab / surface | Outcome |
|---|---|
| **Public directory** (`/partners`) | **Confirmed real** — `partnerApi.directory()` (AllowAny, only directory-approved partners), real client-side search/country/category filter over real rows, honest empty fallback (`catch → []`). `categories`/`countries` are static **filter taxonomy** (not a demo-partner fallback). The one dead element — a **"Contact Us" CTA** with no handler — was repointed to the real `/support` route (kept, not deleted). |
| **KYB card** (`PartnerVerificationCard`) | **Confirmed real** — `usePartnerProfile` → `partnerApi` apply/submitKYB/updateDirectory; Sumsub mount when configured, else honest dev-path notice (`dev_grant_partner_kyb`); webhook-driven approval; two independent states (KYB + directory). No fabricated person/number. |
| **4 stat cards** | **Confirmed real** — assigned / in-progress / completed / needs-revision, all derived from real `useAssignments()`. |
| **Assets tab** | **Confirmed real** — assignment cards from `/api/partner/assignments/` (no mock fallback; `catch → []`); real progress/status/deliverable chips; real upload + submit-for-review. The dead **Filter** button → honestly `disabled` "Coming soon". |
| **Deliverables tab** | **Confirmed real** — real list + real multipart upload that persists (refetch, not toast-only). The dead row **chevron** → honestly `disabled` "Coming soon". |
| **Documents tab** | **Made real (download wired)** — was a real list of deliverables-with-documents but with **no way to download** (the self-scoped blob endpoint existed; the serializer never exposed the doc id). Added `document_id` + `document_name` to the serializer + a real **Download** button. |
| **Activity tab** | **Confirmed real** — derived from the append-only `AssignmentEvent` feed; honest empty state. |

### (2) The structural fix + what was built (no new domain, no new money)
- **STRUCTURAL — the partner role had a full backend but no sidebar nav home.** Its real dashboard
  (`/strategic-partners`) was reachable by **direct URL only** (the partner equivalent of broker's orphan
  `/broker-dashboard`). Added `partner` to `UserRole` + `roleLabels` ("Partner" / "شريك") + a real
  `menuSections` section (`roles: ["partner"]` → **Partner Dashboard** `/strategic-partners` + **Partners
  Directory** `/partners`) + `detectRoleFromPath` (`/strategic-partners` → partner; `/partners` kept PUBLIC)
  + default-expanded; +4 bilingual i18n keys. A partner now gets a nav home like the other four roles.
- **Deliverable-document download** — the backend `DeliverableDocumentDownloadView` already existed
  (self-scoped: `assignment__partner=partner` → **cross-partner 404**, asserted). Exposed the latest
  document's id/filename on `DeliverableSerializer` (`has_document` stays the gate), added
  `partnerApi.downloadDeliverableDocument` (the LP/Owner doc-vault blob pattern), and a real **Download**
  button. **Read-side only — serves an already-uploaded file, NO migration, NO money.** +2 tests
  (partner downloads own doc; cross-partner 404).

### (3) Remaining deferred on the partner dashboard — grouped by BLOCKER
- **(A) External / no-backend:** broker↔platform-style **Inquire / chat** is N/A here; the only
  external-class gap is the same provider stack as other roles (none partner-specific).
- **(B) Nothing else partner-side** — every partner surface is real today. (Tab deep-links were
  intentionally NOT added — the tabs are local state with no hash contract, so no LP-style hash-nav defect
  was introduced.)

### (4) Rules held throughout
**DELETE NOTHING + NEVER fake**, verified after each fix. No element removed — the "Contact Us" CTA
(repointed to `/support`), the Assets **Filter** + Deliverables **chevron** (kept, honestly disabled), and
all partner surfaces (directory grid + KYB card + 4 stat cards + 4 tabs) stayed. The **Download** button was
**added beside** the kept status badge. Zero fabricated person / number / array (only static filter
taxonomy). The partner pass found **no fabricated person/account** — unlike the LP/broker passes.

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
- ~~**deposit / top-up**~~ — **BUILT this stage** (see §0.2): gated external pay-in crediting `UserBalance`
  via the shared payment webhook, inert until keys. *(A broker payment-method surface remains separate.)*

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
