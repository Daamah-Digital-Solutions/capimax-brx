# OWNER_SURFACE.md — Owner / Developer domain map

**Status:** READ-ONLY investigation. Nothing was built or changed. This document maps
the territory for the upcoming OWNER domain build (the property owner/developer who
submits properties → review → publish, and earns from primary token sales).

**Scope reminder (from the roadmap):** the OWNER domain = *submit → review → publish*
pipeline **+** owner *earnings/ledger*. Investor (KYC) and LP (KYB) roles are fully
built (wallets, investing, on-chain mint, both secondary markets with real on-chain
settlement). Owner is the remaining large role. Investor *distributions* (rental yield
to token holders) is a **separate** mock domain and is **not** part of this build —
see §3.

**Source of truth:** the frontend. This document records what the frontend implements
today and the backend it must reconcile with. Every claim cites `file:line`.

**TL;DR:** The owner domain is almost entirely greenfield. `apps/owner` is an empty
stub (no models, no migrations). `SubmitProperty.tsx` is a 6-step UI shell that
captures **zero** field state and whose submit button is a **no-op**. Every owner
earnings/asset/report number is hardcoded mock. The only genuinely-backed owner
piece is document storage (Supabase `owner_documents`). The good news: the *target*
backend it must flow into is solid — the `Property` model, the marketplace read API
(gated on `is_published=True`), and the `UserBalance`/`Withdrawal` primitives all
exist and are reusable, and the LP KYB flow is a clean template for owner verification.

---

## 1. The owner / developer role today

### 1a. How the role is chosen and gated (backend)

The role machinery is **fully built and generic** — it already knows about owners; it
just has no owner-specific flow hanging off it.

- **Seven roles**, defined as `Profile.Role(TextChoices)` in
  `backend/apps/core/models.py:80-91`: `investor`, `developer`, `owner`, `broker`,
  `lp`, `partner`, `admin`.
- **Six are self-selectable** — `SELF_SELECTABLE_ROLES` frozenset at
  `backend/apps/core/models.py:182-191` (everything except `admin`).
- **Five require verification** — `ROLES_REQUIRING_VERIFICATION` at
  `backend/apps/core/models.py:197-205` = `{developer, owner, broker, lp, partner}`.
  Investor is the only non-privileged self-select role.
- **`role_status`** (`Profile.RoleStatus`, `backend/apps/core/models.py:93-96`):
  `active`, `pending_verification`, `suspended`. Field at
  `backend/apps/core/models.py:118-122`. `Profile.save()` stamps `role_verified_at`
  when status first becomes `active` (`backend/apps/core/models.py:135-142`).
- **Registration is the only place a role is set** (anti-escalation).
  `RegisterSerializer.validate_role` accepts a role only if it's in
  `SELF_SELECTABLE_ROLES` (`backend/apps/core/serializers.py:84-97`), then
  `create()` calls `profile.apply_self_selected_role(...)`
  (`backend/apps/core/serializers.py:115`). That method
  (`backend/apps/core/models.py:162-177`) parks any verification-requiring role at
  `pending_verification`. `role`/`role_status` are read-only on every serializer
  (`backend/apps/core/serializers.py:41`; anti-escalation test
  `backend/apps/core/tests.py:83-92`).
- **`HasActivatedRole`** permission (`backend/apps/core/permissions.py:51-76`) checks
  `profile.is_role_active` (`role_status == active`).

**What this means for an owner *right now*:**

> Selecting "owner" at registration persists `role = owner` and **parks it at
> `pending_verification` forever**. There is **no owner KYC/KYB flow, no service that
> activates an owner, and no endpoint that uses `HasActivatedRole`** — the permission
> is defined but attached to **no view** (it appears only at its definition and in the
> README, `backend/apps/core/permissions.py:51,61`; `backend/README.md:174`). The only
> role-activation path that exists today is LP-specific (`HasActivatedLP` →
> `LiquidityProvider.status == approved`, used at `backend/apps/lp/views.py:384`). So
> an owner account can only be activated by a **manual admin flip** in Django admin
> (`backend/apps/core/admin.py:17-29`).

**Does an owner need KYB like an LP?** Undecided in code. The role *machinery* implies
verification is required (owner ∈ `ROLES_REQUIRING_VERIFICATION`), but **no verification
flow is wired**. This is open question **Q1**.

**`developer` vs `owner` naming tension:** `Profile.Role` defines **both** `developer`
and `owner` as separate values (`backend/apps/core/models.py:86-87`), and
`RegisterRole.tsx` offers both. But `BACKEND_SPEC.md:258` lists the legacy enum as only
`{investor, owner, broker, admin}`. The frontend treats the persona as a single
"Owner / Developer" (`src/components/layout/AppSidebar.tsx:82`). Unresolved — open
question **Q7**.

### 1b. What an owner sees / does in the frontend today

Routes (all in `src/App.tsx`, **none guarded** — any user can visit any of them):

| Path | Component | `src/App.tsx` | Data source today |
|---|---|---|---|
| `/my-assets` | `OwnerDashboard` | `:98` | **Pure mock** |
| `/owner-reports` and `/asset-validation` | `OwnerReports` | `:99`, `:103` | **Pure mock** |
| `/owner-wallet` | `OwnerWallet` | `:100` | **Mixed** (mock stats + Supabase managers) |
| `/owner-documents` | `OwnerDocuments` | `:101` | **Supabase** (real) |
| `/submit-property` | `SubmitProperty` | `:104` | **No data source / no-op** |
| `/developers` | `DeveloperHub` | `:132` | Marketing page (not owner data) |

- **Nav** lives in `src/components/layout/AppSidebar.tsx` — owner section
  (`roles: ["owner"]`) at `:124-139` with items My Assets, Submit Property, Asset
  Validation, Owner Wallet, Owner Reports, Owner Documents, Messages. **Role gating
  is purely cosmetic**: the "current role" is a manual "View as Role" dropdown backed
  by `localStorage` key `capimax_sidebar_role` (`:225-238`, `:309-330`), **not** the
  authenticated user's profile role. The `nav.messages → /messages` item is a **dead
  link** (no such route; falls to `NotFound`).
- The sidebar footer identity is hardcoded ("Mohamed Ahmed", `:743`), not from auth.

---

## 2. Property submission (submit → review → publish)

### 2a. The submission form today

`src/pages/SubmitProperty.tsx` is a **6-step wizard shell** (`:24-31`). Critical:
its only state is `currentStep`, `selectedType`, `selectedStatus` (`:57-59`) — **every
text/number input is uncontrolled with no `value`/`onChange`/`name`, so no field data
is captured.** Field inventory:

- **Step 1 — Basic Info** (`:146-196`): Property Name (`:150`); Property Type button
  group → `selectedType` (options `residential, commercial, mixed, industrial, land`,
  `:33-39`); Construction Status button group → `selectedStatus` (`ready,
  under-construction, off-plan`, `:41-45`); Description (`:192`).
- **Step 2 — Location** (`:199-242`): Country `<select>` (`:204-211`), City `<select>`
  (`:215-222`), District (`:227`), Full Address (`:232`), non-functional map (`:235`).
- **Step 3 — Financial Details** (`:245-292`): Property Value USD (`:250`), Minimum
  Investment default 1000 (`:254`), Expected Yield % (`:263`), Duration years (`:267`),
  Distribution Model `<select>` (`quarterly, semi-annual, annual`, `:273-277`).
- **Step 4 — Documents** (`:295-330`): required-doc checklist (`requiredDocuments`
  `:47-54`: Title Deed*, Valuation Report*, Insurance Policy*, NOC, Financial
  Statements, Legal Documents*) — **upload buttons are non-functional** (no file
  input/handler).
- **Step 5 — Media** (`:333-369`): image tiles, video, virtual-tour URL — all
  non-functional placeholders.
- **Step 6 — Review & Submit** (`:372-408`): three confirm checkboxes, **none wired**.

**The investment-model picker (the 8 models) is NOT in the submission form.** The form
only offers the 5-option "Property Type" and 3-option "Construction Status" pickers
above. The **8 investment models** (`ready, ready_portfolio, installment, phasing,
future, option, shared, construction_portfolio`) exist only as read-only catalogue
metadata in `src/data/properties.ts:886-901` and the educational
`src/components/property/PropertyModelSection.tsx`. **An owner cannot select an
investment model anywhere.** This is a real gap to design (open question **Q8**).

**What submit does today: NOTHING.** The "Submit for Review" button has **no
`onClick`** (`src/pages/SubmitProperty.tsx:419-423`); "Save as Draft" also has no
handler (`:82-85`). The only handlers are `nextStep`/`prevStep` (`:63-69`). No Supabase
call, no Django call, no mock mutation. There is no owner/property-create API surface
in `src/integrations/api/client.ts` (`propertiesApi` is read-only: list/detail/featured/
funded, `:214-223`).

### 2b. The review/approval lifecycle the UI implies

There is **no canonical state machine** named in the docs. The fragments that exist:

- `OwnerDashboard` shows per-asset statuses `active | construction | under_review`
  with a `reviewNotes` field for under-review assets (`src/pages/OwnerDashboard.tsx:42-100`),
  and asset cards carry `submittedDate` / `listedDate` (`:96-97`) — implying a
  *submitted → under_review → listed* progression.
- `BACKEND_SPEC.md:376` names a `PropertySubmission` model with steps "basic info,
  location, financials, documents, media, **draft/submitted**" and an `OwnerAsset.status
  {active|construction|under_review}` + `review_notes`.
- **No explicit `rejected` submission state** is named anywhere (flagged by the spec
  reader). The review→publish pipeline is the "NEXT PLANNED BUILD"
  (`DECISIONS.md:692-693`): *"property submission intake → review → publish pipeline +
  owner earnings/ledger."* Admin is the review surface (`DECISIONS.md:731`: "Owner
  submits → review pipeline → publish. Admin-managed in Django admin.").

Who approves is open question **Q2** (admin review vs auto-publish).

### 2c. How this reconciles with the existing Property model (THE GAP)

The submitted property must flow into the **same catalog the investor marketplace
reads**. The target backend is built and read-only today:

- **`Property` model** — `backend/apps/properties/models.py:127`. Full fields incl.
  `model` (8-value enum, `:146`), `category` (**auto-derived** from `model`,
  read-only, `:147` + `_sync_derived()` `:213-224`), `status` (`ready/construction/
  sold-out`, `:148`), economics `total_value`/`token_price`/`token_supply`
  (**auto-derived** `= total_value/token_price`, `:153-156`), fees
  `fee_platform`/`fee_management`/`fee_exit` (`:185-187`), and the visibility flags
  **`is_published`** (default **True**, db_index, `:190`) and `is_featured` (`:191`).
- **No owner linkage exists on Property** — there is **no `owner`/`submitted_by`/
  `created_by` FK**. The only "owner" fields are `SharedOwnership.owner_share/
  owner_name` (`:339-340`), which are property *data*, not the submitting user. **The
  owner domain must add an owner→Property link.**
- **Nested per-model tables** (all FK/OneToOne to Property): `InstallmentSchedule`
  (`:280`), `FutureContract` (`:297`), `OptionContract` (`:314`), `SharedOwnership`
  (`:332`), `PropertyPhase` (`:352`), `PortfolioAsset` (`:374`), plus `SPVRecord`,
  `TokenMetadata`, `PropertyFinancials`, `PropertyDocument`, `DeveloperReport`,
  `ValuationReport`.
- **Creation today is admin-only.** `PropertyAdmin` (`backend/apps/properties/admin.py:104`)
  with inline editors and a `deploy_token_contract` action (`:133-161`); plus a
  `seed_properties` management command. **There is no create/submit API** — the
  viewset is `ReadOnlyModelViewSet` (`backend/apps/properties/views.py:47`); `urls.py`
  registers only the read viewset.
- **The marketplace visibility gate** — `PropertyViewSet.get_queryset` filters
  `Property.objects.filter(is_published=True)` (`backend/apps/properties/views.py:66-70`,
  `AllowAny`, no auth, `:50-51`). Same filter governs `featured`/`funded`/`stats`.

> **THE GAP a submission must cross:** create a `Property` row with
> **`is_published=False`** (the default is `True`, so a naive create would auto-publish
> an unreviewed submission — this is the single most important reconciliation hazard),
> carry it through a review/status field, and flip `is_published=True` only on approval.
> Submissions reconcile automatically with `category`/`token_supply` auto-derivation
> and the `clean()` 0–100 range validation (`:226-245`) — don't hand-set derived fields.

---

## 3. Owner earnings / ledger / distributions

### 3a. What the frontend shows an owner about earnings (all mock)

- **`OwnerDashboard`** — `ownerStats` mock (`src/pages/OwnerDashboard.tsx:32-40`):
  `totalAssets, activeAssets, pendingAssets, totalRaised` ("$2.5M", `:37,167`),
  `totalInvestors` (156), `totalDistributed` ($187.5K), `pendingDistribution` ($62.5K).
  Per-asset `assets[]` shape (`:42-100`) carries `unitsSold, totalUnits, investors,
  raised, distributed, nextDistribution, submittedDate, listedDate, reviewNotes`.
- **`OwnerWallet`** — top stat cards are mock `ownerWalletStats`
  (`src/pages/OwnerWallet.tsx:24-29`): `availableBalance` (187500),
  `pendingWithdrawals` (25000), `totalEarnings` (425000), `lastDistribution`. The
  **child managers are Supabase-backed but investor-scoped tables reused as-is**:
  `BankAccountsManager` (`investor_bank_accounts`), `WithdrawalDialog`
  (`useWithdrawalRequests`), `VisaCardsSection` (`visa_cards`/`card_transactions`/
  `wallet_balances`), `CryptoWalletsManager`. **No owner-specific balance backend.**
- **`OwnerReports`** — `assetPerformance[]`, `recentDistributions[]`, `ownerMetrics`
  (`totalAssetValue, totalInvestors, avgOccupancy, totalDistributed, activeProperties,
  underConstruction`) all mock (`src/pages/OwnerReports.tsx:29-47`); some investor
  analytics hardcoded inline (`:288,294,300`).

### 3b. How money flows to an owner conceptually

- The UI says an owner *receives* capital raised from primary token sales (`raised`)
  and pays out *distributions* (`distributed`) — but **nothing computes either**;
  they're hardcoded.
- **The primary-sale event exists but pays no owner.** `Investment`
  (`backend/apps/investments/models.py:25`) records `amount_invested, token_amount,
  price_per_token, ownership_percentage`, FK→Property (`:34-36`). `create_investment`
  (`backend/apps/investments/services.py:66`) locks the property, computes
  `amount = token_amount * token_price`, creates a PENDING row, and on completion
  `mint_investment` (`:189`) does the real on-chain mint to the buyer. **There is no
  `credit_user_balance` call anywhere in the investment path** — the buyer's money is
  not routed to any owner. The owner-payout hook must be **added** to the completion
  path, gated on `payment_status == COMPLETED`.
- **The payout primitives are built and reusable as-is** (`backend/apps/wallets/`):
  - `UserBalance` (OneToOne user, `current_balance`, `currency`) —
    `backend/apps/wallets/models.py:185`.
  - `BalanceTransaction` (CREDIT/DEBIT, `amount`, `source`, `reference`) — `:217`.
  - `Withdrawal` (PENDING/PROCESSING/COMPLETED/FAILED; BANK/CRYPTO) — `:248`.
  - `credit_user_balance(user, amount, *, source, reference, memo)` —
    `backend/apps/wallets/services.py:105` (row-locks, writes a CREDIT entry). **This
    is exactly the primitive an owner primary-sale credit would call.**
  - `request_withdrawal(user, amount, *, method, notes)` — `:133` (debits + creates a
    pending Withdrawal). `GET /api/wallets/balance/` and `GET/POST
    /api/wallets/withdrawals/` already exist (`backend/apps/wallets/views.py:105-152`).

> So owner earnings/withdrawal can **reuse the investor/LP wallet stack unchanged**; the
> only new backend logic is *crediting the owner on each completed primary sale* and an
> owner-scoped read of the same balance/withdrawal endpoints.

### 3c. Owner earnings vs investor distributions — keep them separate

These are **two distinct domains**; do not conflate them.

- **Owner earnings (IN SCOPE for this build):** capital the owner receives from
  *primary* token sales of their property (the `raised` figure), withdrawable via the
  `UserBalance`/`Withdrawal` stack. Roadmap scopes it inside the owner domain
  (`DECISIONS.md:670-671,692-693`: "owner domain (submit→review→publish + earnings/
  ledger)").
- **Investor distributions (OUT OF SCOPE — separate mock domain):** rental/appreciation
  yield paid *to token holders*. Modeled separately: `OwnershipToken` already has
  `last_distribution_date` + `total_distributions` fields
  (`backend/apps/wallets/models.py:129-130`) that **nothing writes yet**; a separate
  `apps/distributions` and a `Distribution(user, property, amount,
  distribution_type, ...)` model are envisaged (`BACKEND_SPEC.md:370,432`). The
  remaining-mock-domains list names **`distributions`** as its own line item, distinct
  from the owner domain (`DECISIONS.md:698-700`).
- **Caution — the same cash flow appears on both surfaces:** `OwnerReports` shows the
  owner "distributions paid" while `Distributions.tsx` shows investors "distributions
  received." The owner *paying in* and the engine *splitting to holders* is the
  distributions domain; the owner's *primary-sale proceeds* is the owner domain. Build
  owner earnings now; leave the distributions engine for its own wave (open question
  **Q4**).

---

## 4. What's mock vs real (owner-related inventory)

| Frontend piece | File:line | Backing today | Target backend |
|---|---|---|---|
| `OwnerDashboard` (assets, stats, raised, investors) | `src/pages/OwnerDashboard.tsx:32-112` | **Pure mock** | new `ownerApi` + Property/Investment aggregates |
| `OwnerReports` (performance, distributions, metrics) | `src/pages/OwnerReports.tsx:29-47` | **Pure mock** | new owner-reports endpoint (+ distributions domain) |
| `OwnerWallet` top stat cards | `src/pages/OwnerWallet.tsx:24-29` | **Pure mock** | `walletsApi.balance` (owner-scoped) |
| `OwnerWallet` bank/crypto/visa/withdrawal managers | `OwnerWallet.tsx:183-215` + child hooks | **Supabase** (investor-scoped tables, reused) | already-built Django `Withdrawal`/wallet (reconcile w/ legacy OTP flow) |
| `OwnerDocuments` | `src/pages/OwnerDocuments.tsx:25,59`; `src/hooks/useOwnerDocuments.ts` | **Supabase** (`owner-documents` bucket + `owner_documents` table) — REAL | `OwnerDocument` Django model + media upload |
| `SubmitProperty` (6-step wizard) | `src/pages/SubmitProperty.tsx` | **No-op** (no state, no submit handler) | new submit endpoint → `Property(is_published=False)` |
| Owner nav section / "View as Role" | `src/components/layout/AppSidebar.tsx:124-139,309-330` | **localStorage cosmetic** | derive from authenticated profile role |

- **`useOwner*` hooks:** only **one** exists — `useOwnerDocuments` (Supabase). No
  `useOwnerAssets/useOwnerWallet/useOwnerEarnings/useOwnerReports`.
- **Django client** (`src/integrations/api/client.ts`) exposes `authApi, propertiesApi
  (read-only), investmentsApi, paymentsApi, walletsApi, kycApi, lpApi,
  secondaryMarketApi, certificatesApi` — **no owner/property-submission surface**.
- **Backend `apps/owner` is an EMPTY STUB** — confirmed by two independent readers:
  `models.py:1-3` (comment only, no models), `admin.py:1` (comment only),
  `apps.py:1-8` (config, label "owner"), `migrations/` has only `__init__.py` (**no
  migrations, no tables**). Installed in `INSTALLED_APPS`
  (`backend/config/settings/base.py:84`) but no `views/urls/serializers/services`.
  **The owner backend is greenfield.**

---

## 5. Proposed build plan (analysis — NOT built)

### Reuse (don't reinvent)
- **Role machinery** — `Profile.role/role_status`, `apply_self_selected_role`,
  `HasActivatedRole` already exist; owner just needs a *verification flow* to flip it.
- **LP KYB pattern as the template** (`backend/apps/lp/`): a OneToOne side-entity
  (`LiquidityProvider`), Sumsub at a distinct **level name** (`SUMSUB_KYB_LEVEL_NAME`),
  shared webhook routed by level (`try_handle_kyb_webhook`,
  `backend/apps/lp/services.py:119-140`), `approve_kyb` → `_activate_lp_role` flips
  `role_status=active` on commit (`:37-65`), plus a DEBUG `dev_grant_kyb` bypass. The
  owner verification (if required) should mirror this exactly with an owner level name.
- **Property model + 8 investment-model tables + auto-derivation + `clean()`** —
  already built; the submit flow just writes into them with `is_published=False`.
- **`UserBalance`/`BalanceTransaction`/`Withdrawal` + `credit_user_balance` /
  `request_withdrawal` + balance/withdrawal endpoints** — reuse unchanged for owner
  earnings and payout.

### New backend the owner domain needs
- **`apps/owner` models:** an `OwnerProfile` (OneToOne user; optional KYB fields/Sumsub
  applicant id, mirroring `LiquidityProvider`) **if** owners verify; a
  `PropertySubmission` (the intake record with its own lifecycle:
  `draft → submitted → under_review → approved/rejected`, `review_notes`, snapshot of
  the 6-step form incl. selected investment model, links to uploaded docs/media); an
  owner→Property linkage (FK `owner` on Property **or** on the submission that, on
  approval, creates/owns the Property row).
- **Submission endpoints:** `POST /api/owner/property-submissions/` (create draft/
  submit), list/detail/cancel, document upload (mirror the LP KYB document pattern /
  the real Supabase `owner_documents` behavior). Multipart uploads for docs/media.
- **Review pipeline:** admin review surface (Django admin action or staff endpoint)
  that, on approval, **materializes a `Property` with `is_published=True`** (and
  deploys the token contract via the existing `deploy_token_contract` admin action),
  on rejection records `review_notes`. Default-False safety on any owner-created
  Property.
- **Owner earnings hook:** in `mint_investment`/the completion path
  (`backend/apps/investments/services.py`), on `payment_status == COMPLETED`,
  `credit_user_balance(owner, net_primary_proceeds, source="primary_sale",
  reference=<investment id>)` — net of the configured platform/management fees
  (server-side; fees live on `Property.fee_platform/fee_management`,
  `backend/apps/properties/models.py:185-186`). Idempotent, inside the same atomic
  settlement block.
- **Owner read endpoints:** `GET /api/owner/{assets,stats,updates,reports}/` +
  reuse `GET /api/wallets/balance/` and `/withdrawals/` for the owner wallet.

### Reconciliation: submission → existing Property catalog
A submission is a *staging* record. On approval it must produce a real `Property` row
with `is_published=False` initially (avoid the `True` default hazard), the correct
`model` (so `category`/`token_supply` auto-derive), valid 0–100 yield/growth (to pass
`clean()`), and only then flip `is_published=True` to appear in the `AllowAny`
marketplace (`backend/apps/properties/views.py:66-70`). The investor marketplace needs
**no change** — it already reads exactly that catalog.

### Frontend files to repoint (no behavior change)
- `src/pages/SubmitProperty.tsx` — add controlled state for all fields, an
  **investment-model picker** (the 8 models from `src/data/properties.ts:886-901`),
  real document/media upload, and a real submit handler → new `ownerApi.submitProperty`.
- `src/pages/OwnerDashboard.tsx`, `OwnerReports.tsx`, `OwnerWallet.tsx` top cards —
  replace mock constants with `useOwner*` hooks → `ownerApi` / `walletsApi`.
- `src/hooks/` — add `useOwnerSubmissions`, `useOwnerAssets`, `useOwnerEarnings`;
  migrate `useOwnerDocuments` Supabase→Django.
- `src/integrations/api/client.ts` — add an `ownerApi` surface.
- `src/components/layout/AppSidebar.tsx` — (optional, flagged) derive role from the
  authenticated profile instead of the localStorage "View as Role" dropdown; fix the
  dead `/messages` link.

### Suggested wave breakdown (each shippable)
1. **Wave A — Owner verification (if required) + submission intake.** `OwnerProfile`
   (+ KYB mirror of LP if Q1=yes), `PropertySubmission` model + lifecycle, submit/list/
   document endpoints, `SubmitProperty.tsx` made real (state + model picker + uploads +
   submit). Submissions land in `draft/submitted/under_review`. No publish yet.
2. **Wave B — Review → publish.** Admin review that materializes an `is_published=False`
   Property on approval and flips to published (+ token deploy), `review_notes` on
   reject. Owner dashboard shows real submission/asset statuses. Submitted property now
   reaches the investor marketplace.
3. **Wave C — Owner earnings/ledger + payout.** Credit the owner on each completed
   primary sale (net of fees) via `credit_user_balance`; owner wallet/reports read the
   real `UserBalance`/`Withdrawal`; reconcile the legacy Supabase OTP withdrawal UI
   with the built Django withdrawal flow.
4. **(Separate, later) Distributions engine** — rental/appreciation yield to token
   holders (`apps/distributions`, writes `OwnershipToken.total_distributions`). **Not
   part of the owner domain.**

---

## 6. Open questions for the product owner

1. **Owner verification before submitting?** Does an owner/developer need **KYB** (like
   an LP, full Sumsub business flow) before they can submit a property — or a lighter
   identity check, or nothing (just self-select and submit)? The role machinery parks
   owners at `pending_verification` but **no activation flow exists**; we need to know
   whether to build the KYB mirror (Wave A) or activate owners on self-select.
2. **Who approves a submitted property?** Admin manual review (Django admin / staff
   endpoint), or auto-publish on submission? The roadmap says "review pipeline →
   publish, admin-managed" but the AUTOMATION-FIRST principle wants admin as an
   exception handler. What are the auto-publish criteria, if any?
3. **What exactly does an owner earn, and when?** Is it the **net capital raised from
   primary token sales** (gross minus platform 1.5% + management 0.5% fees), credited
   **per completed sale**, on a **schedule**, or at **funding close**? And is it
   withdrawable through the **same** `UserBalance`/`Withdrawal` flow we built for
   investors/LPs (we recommend yes)?
4. **Owner earnings vs investor distributions — confirm the split.** We treat *owner
   primary-sale proceeds* (this build) as distinct from *investor rental/appreciation
   distributions* (a separate later domain). Is that the intended separation, and is
   the owner ever the one funding the investor distributions (which would couple the
   two)?
5. **Submission lifecycle states.** Confirm the state machine:
   `draft → submitted → under_review → approved(published) / rejected(with notes)`.
   Anything else (e.g. "changes requested", resubmission)?
6. **Investment-model selection at submission.** Should the owner pick from all **8**
   investment models at submission (with the per-model fields — phases, installment
   schedule, shared-ownership split, etc.), or only a subset, with admin assigning the
   final model during review? Today the owner cannot select any model.
7. **`owner` vs `developer` — one persona or two?** Both are separate role values, but
   the frontend treats them as one "Owner / Developer." Do we collapse them, or build
   two distinct flows (e.g. developer = multi-project, owner = single-asset)?
8. **Can one user hold multiple roles** (investor + LP + owner) simultaneously? Today
   `Profile.role` is a **single** value set once at registration; an investor who also
   wants to submit a property couldn't without changing role. Do we need multi-role
   support, or is single-role acceptable for v1?
9. **Owner document storage:** migrate the working Supabase `owner_documents` flow to
   Django media (consistent with the rest of the migration), or leave it on Supabase
   for now? (Recommend migrate, to keep one backend.)

---

*End of OWNER_SURFACE.md — mapping only. No code was changed.*
