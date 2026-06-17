# DEVELOPER_SURFACE.md — Developer-vs-Owner map (READ-ONLY investigation)

**Date:** 2026-06-16
**Scope:** Map exactly how the **Developer** role differs from the **Owner** role in the
frontend, before building it. Frontend is the source of truth. Nothing was changed.

**Headline finding:** In the frontend, the property **Developer is a thin variant of the
Owner** — same KYB, same submit wizard (which *already* captures construction status), no
distinct staged-funding/milestone surface. The only structural separation is two role
cards on the registration page. Everywhere past registration, owner and developer are
merged or share the owner surfaces. There is **no developer portal, no developer pages, no
developer earnings model, and no `apps/developer` backend stub.**

> ⚠️ **Naming collision to keep straight:** `DeveloperHub.tsx` / the `/developers` route /
> the sidebar "Developers / API" item are an **API integration hub for software
> developers & partners** — NOT the real-estate property-developer portal. See §1.3.

---

## 1. THE DEVELOPER ROLE IN THE FRONTEND

### 1.1 The registration card (the one place developer is a first-class, distinct role)

`RegisterRole.tsx` defines six role cards. Developer and Owner are **separate cards** with
deliberately different copy:

**Developer card** — [RegisterRole.tsx:69-91](src/pages/RegisterRole.tsx#L69):
- `id: "developer"`, icon `HardHat`, `kyc: "KYB"`, badge **"KYB Required"** (`badgeEn`, L86).
- Tagline: **"Tokenize and finance your projects"** (L74).
- Bullets (L76-80): **"Submit under-construction assets"**, **"Phased / installment
  funding"**, **"Direct access to global capital"**.

**Owner card** — [RegisterRole.tsx:92-114](src/pages/RegisterRole.tsx#L92):
- `id: "owner"`, icon `Building2`, `kyc: "KYB"`, badge **"KYB + Title Docs"** (L109).
- Tagline: **"Unlock liquidity from existing assets"** (L97).
- Bullets (L99-103): **"List ready, yield-bearing properties"**, "Keep operating, raise
  instantly", "Transparent ownership ledger".

**The UI's distinction, in its own words:**
| | Owner | Developer |
|---|---|---|
| Asset state | **Ready**, yield-bearing, existing | **Under-construction** projects |
| Funding shape | Instant liquidity (lump) | **Phased / installment** funding |
| Verification badge | KYB **+ Title Docs** | KYB only |
| Motive | Unlock liquidity from what they own | Finance projects they're building |

Selecting a card routes to `/auth?mode=register&role=<id>` —
[RegisterRole.tsx:192-195](src/pages/RegisterRole.tsx#L192) — so `role=developer` *is* a
real value carried into signup. Footer reaffirms verification "per Reg D / Reg S"
([RegisterRole.tsx:398-401](src/pages/RegisterRole.tsx#L398)).

### 1.2 Does the developer have its own dashboard / pages? **No.**

- **App routing** ([App.tsx:75-135](src/App.tsx#L75)): there is **no developer route**.
  No `/developer-dashboard`, no developer submit, no developer wallet/reports. The only
  thing named "developer" is `/developers → DeveloperHub` ([App.tsx:132](src/App.tsx#L132)),
  which is the API hub (§1.3).
- **Sidebar role gating** ([AppSidebar.tsx:60](src/components/layout/AppSidebar.tsx#L60)):
  the `UserRole` union is `"guest" | "investor" | "owner" | "liquidity_provider" |
  "broker"` — **developer is not a sidebar role at all.**
- **Owner and developer are explicitly merged** in the sidebar persona:
  `roleLabels.owner = { en: "Owner / Developer", ... }`
  ([AppSidebar.tsx:82](src/components/layout/AppSidebar.tsx#L82)). The single "Owner"
  section (`my-assets`, `submit-property`, `asset-validation`, `owner-wallet`,
  `owner-reports`, `owner-documents`) is the developer's surface too —
  [AppSidebar.tsx:124-139](src/components/layout/AppSidebar.tsx#L124).
- `detectRoleFromPath` ([AppSidebar.tsx:206-217](src/components/layout/AppSidebar.tsx#L206))
  has investor/owner/broker/lp buckets — **no developer bucket.**
- **Home page** `OwnerDeveloperSection` renders an Owner card *and* a Developer card, but
  **both CTAs navigate to the same `/submit-property`** — owner button
  [OwnerDeveloperSection.tsx:53](src/components/home/OwnerDeveloperSection.tsx#L53),
  developer button
  [OwnerDeveloperSection.tsx:82](src/components/home/OwnerDeveloperSection.tsx#L82).
  Developer pitch copy: "Fund Your Projects Innovatively"
  ([LanguageContext.tsx:2122](src/contexts/LanguageContext.tsx#L2122)).

**Conclusion:** every developer-specific surface past the registration card either does not
exist or is the owner surface.

### 1.3 The `/developers` red herring

`DeveloperHub.tsx` ([src/pages/DeveloperHub.tsx](src/pages/DeveloperHub.tsx)) is a
**REST/API hub** — "Integrate the Capimax BRX exchange directly into your treasury,
analytics, and trading systems" (L42-44), OAuth2/HMAC webhooks, endpoint catalog (L11-20),
`curl` example (L88). Sidebar links it as **"Developers / API"** under the *platform*
section, visible to all
([AppSidebar.tsx:176](src/components/layout/AppSidebar.tsx#L176)). **This is software
developers, not property developers.** Do not wire the property-developer role to it.

---

## 2. PROPERTY SUBMISSION FOR A DEVELOPER

### 2.1 Same wizard. It already captures construction status.

There is one submit flow: `SubmitProperty.tsx`. The developer uses the **identical**
6-step wizard the owner uses (Basic Info → Location → Financial → Documents → Media →
Review). Crucially, **Step 1 already collects construction status** —
[SubmitProperty.tsx:48-52](src/pages/SubmitProperty.tsx#L48):
```
constructionStatus = [ "ready", "under-construction", "off-plan" ]
```
rendered at [SubmitProperty.tsx:354-371](src/pages/SubmitProperty.tsx#L354) and sent as
`construction_status` in the payload
([SubmitProperty.tsx:131](src/pages/SubmitProperty.tsx#L131)). So the "under-construction"
nature a developer needs is **already a first-class field** — captured the same way for
both roles.

### 2.2 No under-construction-specific data is collected.

The wizard collects (state at [SubmitProperty.tsx:82-96](src/pages/SubmitProperty.tsx#L82)):
`name, property_type, construction_status, description, country, city, district, address,
property_value_usd, min_investment, expected_yield, duration_years, distribution_model`.

It does **NOT** collect any developer/under-construction specifics:
- ❌ No construction phases / milestone schedule
- ❌ No installment / draw-down funding schedule
- ❌ No funding stages or tranche definitions
- ❌ No expected completion date (the field at
  [SubmitProperty.tsx:614-617](src/pages/SubmitProperty.tsx#L614) is a *Media* "virtual
  tour URL", and Step 5 Media is a non-persisted placeholder — see comment
  [SubmitProperty.tsx:581-582](src/pages/SubmitProperty.tsx#L581))
- `distribution_model` is only `quarterly / semi-annual / annual`
  ([SubmitProperty.tsx:502-504](src/pages/SubmitProperty.tsx#L502)) — a *yield* cadence,
  not a construction/funding schedule.

Required documents are **identical** regardless of role — Title Deed, Valuation, Legal
required; NOC, Financials optional
([SubmitProperty.tsx:54-66](src/pages/SubmitProperty.tsx#L54)). Note this slightly
contradicts the registration badges (owner = "KYB + **Title Docs**", developer = KYB only),
but the form makes Title Deed required for everyone.

### 2.3 Is the developer tied to specific investment models in the frontend? **No.**

The 8 models split conceptually in the sidebar Products tree —
[AppSidebar.tsx:520-560](src/components/layout/AppSidebar.tsx#L520):
- **Ready** group: `ready-yield`, `portfolios-ready` (owner-leaning)
- **Under Construction** group: `installment`, `phasing`, `future`, `option`, `shared`,
  `portfolios-under-construction` (developer-leaning)

But this is a **catalog/marketing taxonomy**, not a submitter binding. Nowhere does the
submit flow let the submitter pick an investment model, and nothing ties `role=developer`
to the UC models. Exactly like the owner, **the investment model is admin-assigned at
review** (Wave C `publish_submission(..., model=...)`). The frontend leaves model selection
entirely to the admin.

---

## 3. DEVELOPER EARNINGS / FUNDING

**No developer-specific earnings or funding UI exists.** The earnings surfaces are
owner-scoped and read the owner's primary-sale ledger:
- `OwnerWallet.tsx` — balance + `ownerApi.earnings()` + `OwnerWithdrawDialog`
  ([OwnerWallet.tsx:34-51](src/pages/OwnerWallet.tsx#L34)).
- `OwnerReports.tsx` — `ownerApi.earnings()` per-property net primary-sale proceeds
  ([OwnerReports.tsx:57-73](src/pages/OwnerReports.tsx#L57)).
- `OwnerDashboard.tsx` — same earnings stat cards
  ([OwnerDashboard.tsx:151-176](src/pages/OwnerDashboard.tsx#L151)).

There is **no staged-funding / milestone-release UI anywhere.** The only "milestone" string
is a hard-coded mock activity row
([OwnerDashboard.tsx:127](src/pages/OwnerDashboard.tsx#L127): "اكتمال مرحلة الهيكل
الخارجي"), which is decorative mock data, not a funding mechanism. So the frontend models
developer proceeds **identically to owner proceeds** — a lump primary-sale credit
(net-of-fees), the Wave-D `credit_user_balance` path. Nothing in the UI implies funds are
released in tranches as construction milestones complete.

---

## 4. MOCK vs REAL vs SHARED-WITH-OWNER (inventory)

| Piece | File | Status for "developer" |
|---|---|---|
| Developer registration card | [RegisterRole.tsx:69-91](src/pages/RegisterRole.tsx#L69) | **Real & developer-specific** (only distinct developer UI); passes `role=developer` |
| Home Owner/Developer section | [OwnerDeveloperSection.tsx](src/components/home/OwnerDeveloperSection.tsx) | Real copy, but **both CTAs → `/submit-property`** (shared with owner) |
| `DeveloperHub` / `/developers` | [DeveloperHub.tsx](src/pages/DeveloperHub.tsx) | **Unrelated** — API hub for software devs (not the property-developer role) |
| Submit wizard | [SubmitProperty.tsx](src/pages/SubmitProperty.tsx) | **Shared with owner**; gated on `ownerProfile.status === "approved"` (L108, L222) |
| Dashboard / Wallet / Reports / Documents | `Owner*.tsx` | **Shared with owner** — sidebar persona literally "Owner / Developer" |
| Sidebar developer section | [AppSidebar.tsx](src/components/layout/AppSidebar.tsx) | **Does not exist** — no `developer` UserRole; merged into owner |

**Backend reality:**
- The `developer` role **exists** in the enum:
  `Profile.Role.DEVELOPER = "developer"`
  ([apps/core/models.py:86](backend/apps/core/models.py#L86)), and is in **both**
  `SELF_SELECTABLE_ROLES` ([models.py:185](backend/apps/core/models.py#L185)) and
  `ROLES_REQUIRING_VERIFICATION` ([models.py:199](backend/apps/core/models.py#L199)). So a
  user *can* register as developer; `apply_self_selected_role` parks them at
  `pending_verification`.
- **There is NO `apps/developer`.** Backend apps present: broker, certificates, chain,
  core, distributions, family, investments, kyc, lp, notifications, onboarding, owner,
  partners, payments, properties, reports, secondary_market, wallets, withdrawals.
- **The entire owner stack is keyed to `role == OWNER` specifically:** owner-role
  activation only flips `role_status` ACTIVE when `profile.role == Profile.Role.OWNER`
  ([apps/owner/services.py:66](backend/apps/owner/services.py#L66)); the capability gate
  `HasActivatedOwner` reads `owner_profile.status == "approved"`. **A `role=developer`
  registrant today is stranded:** the role is stored, but there is no developer KYB, no
  developer onboarding card path, and the owner submit/earnings gates won't recognize them.

---

## 5. RECOMMENDATION

### Developer is a **thin variant of the Owner**, not a distinct staged-funding domain.

Every frontend signal says so: merged sidebar persona ("Owner / Developer"), shared submit
wizard that already carries `construction_status`, shared earnings surfaces, no
milestone/tranche UI, admin-assigned models. Building a genuinely-distinct
staged-funding/milestone engine would be **inventing scope the frontend does not show** —
a violation of "frontend is the source of truth." The faithful build reuses the
`apps/owner` machinery for a second entity type keyed to `role == developer`.

### Proposed wave breakdown (small, reuses apps/owner end-to-end)

- **Wave A — Developer KYB:** mirror owner KYB exactly. Reuse `OwnerProfile`/KYB
  (preferably parameterize the existing entity by an `entity_kind = owner|developer`, or a
  thin `DeveloperProfile` that reuses the same Sumsub-level + shared-webhook plumbing). Add
  `HasActivatedDeveloper` (or generalize `HasActivatedOwner`), activate on `role ==
  DEVELOPER`. Add a dev grant command mirroring `dev_grant_owner_kyb`.
- **Wave B — Submission intake:** reuse `PropertySubmission` + the **same**
  `SubmitProperty.tsx` (it already collects `construction_status`). Gate it so an approved
  developer can submit too (today it gates strictly on the owner profile). Likely the only
  real change: let the gate accept *either* an approved owner *or* an approved developer.
- **Wave C — Review → publish:** unchanged pipeline. Admin assigns one of the
  under-construction models (`installment/phasing/future/option/...`) at review; `Property.
  submitted_by` links the developer. No new code beyond letting a developer be the
  `submitted_by`.
- **Wave D — Earnings:** reuse the Wave-D primary-sale credit verbatim — net-of-fees lump
  credit on each completed primary sale. Surface in the same Owner wallet/reports (the
  persona is shared) or developer-labeled clones if product wants separation.

This is mostly **wiring + gate generalization**, not a new domain.

### Open questions for the product owner

1. **Funding shape (most important):** the registration card promises developers
   "**Phased / installment funding**", but the frontend has **no** staged-funding /
   milestone-release UI and the earnings model is a lump primary-sale credit. Confirm:
   does developer funding release in stages tied to construction milestones (genuinely new
   build), **or** is "phased/installment" just describing the *investor-facing* UC
   investment models (installment/phasing) while the developer is still paid the same
   primary-sale proceeds as the owner? **Frontend-faithful default: the latter (same
   credit as owner).**
2. **One entity or two?** The sidebar merges them ("Owner / Developer"), but RegisterRole
   presents two distinct cards with different badges. Should developer and owner be **one
   shared verified entity** (a user can list both ready and UC assets), or **two separate
   verifications/profiles**? This decides whether we parameterize `OwnerProfile` vs. add a
   sibling `DeveloperProfile`.
3. **Required documents.** Owner badge = "KYB **+ Title Docs**"; developer badge = "KYB"
   only — yet `SubmitProperty.tsx` makes Title Deed required for everyone. Does a developer
   need a **different required-doc set** (e.g. building permit / master plan / escrow
   account proof instead of a title deed)? Or keep the shared set?
4. **Surfaces & labels.** Should a `role=developer` user see the **same** owner pages
   (`/my-assets`, `/submit-property`, `/owner-wallet`, `/owner-reports`) and sidebar
   section as-is (the merged persona), or do you want **developer-labeled** routes/section
   for clarity? The frontend currently implies "reuse as-is."
5. **Naming.** Confirm we keep `/developers` (the API hub) untouched and do **not** route
   the property-developer role there — the names collide and must stay separate.

---

*Investigation only — no files were modified besides creating this document.*
