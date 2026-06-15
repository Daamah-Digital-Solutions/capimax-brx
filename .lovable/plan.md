## Marketplace v2 — Categories, Property Models & Templates

This is a large restructure of the marketplace. I'll do it as a single coordinated build, frontend-only (uses static data so it ships immediately; can be wired to Supabase later).

### 1. New Marketplace structure (`/marketplace`)

Top-level **4 category tabs** with counts:
- **A) Ready Properties (with Yield)**
- **B) Under Construction Properties** → sub-filter for the 5 sub-models below
- **C) Ready Property Portfolios**
- **D) Under Construction Property Portfolios**

Under (B), a secondary chip-bar to filter by sub-model:
1. Installment Property
2. Phasing Property (replaces "Joualat")
3. Future Property
4. Option Property
5. Shared Property (with Owner)

### 2. Advanced filtering (sidebar / sheet)

- Property type (residential / commercial / industrial / mixed / hospitality / land)
- Portfolio type (single / portfolio)
- Country, City (cascading)
- ROI / Yield range slider
- Property stage (ready / under construction)
- Exit type (LP, secondary, both)
- Yield type (rental / appreciation / hybrid)
- Sort: newest, ROI, funded %, completion date

Persisted in URL query params.

### 3. Data layer

Create `src/data/properties.ts` exporting a typed `Property[]` with new fields:

```
type PropertyModel =
  | "ready"
  | "ready_portfolio"
  | "installment"
  | "phasing"
  | "future"
  | "option"
  | "shared"
  | "construction_portfolio";
```

Each entry includes the model-specific fields (installment schedule, phase pricing, option expiry, co-ownership split, etc.) plus shared fields (overview, ROI, ownership, timeline, progress, valuation reports, exit availability, insurance, legal disclosures, market analysis, risk).

Replace inline `properties` arrays in `Marketplace.tsx`, `Listings.tsx`, `FundedProperties.tsx`, `PropertyDetail.tsx` with this single source of truth.

### 4. Per-model templates

Create dedicated template components under `src/components/property/templates/`:

- `ReadyPropertyTemplate.tsx`
- `ReadyPortfolioTemplate.tsx`
- `InstallmentPropertyTemplate.tsx` — installment schedule, payment milestones, completion %, activation date, ROI projection, construction progress
- `PhasingPropertyTemplate.tsx` — current phase, current/next token price, phase timeline, valuation reports, milestone %
- `FuturePropertyTemplate.tsx` — activation timeline, settlement, future ownership conditions, contract execution date, future ROI
- `OptionPropertyTemplate.tsx` — option validity, expiry date, locked strike price, exercise conditions, future valuation
- `SharedPropertyTemplate.tsx` — co-ownership split, profit sharing, revenue distribution, exit structure, transfer process
- `ConstructionPortfolioTemplate.tsx` — multi-asset under-construction view

Each template shares a common **`PropertyShell`** layout providing the standard sections (overview, ROI, ownership, timeline, progress, developer/valuation reports, token & future token pricing, exit mechanisms incl. LP/secondary availability, insurance, financing & legal disclosures, market analysis, risk notices, smart-ownership info).

### 5. Property detail page redesign (`/properties/:id`)

`PropertyDetail.tsx` becomes a router that picks the correct template by `model`. Layout order:

```text
[Hero / overview]
[Model-specific section — installment schedule | phase pricing | option terms | etc.]
[ROI & ownership]
[Timeline & construction progress]
[Reports — developer, valuation, market analysis]
[Exit options — LP / Secondary / Insurance]
[Risk & legal disclosures]
─────────────────────────────────
[Payment methods + Wallet integration]   ← moved BELOW property details
[CTA: Invest now]
```

Clean institutional styling using existing semantic tokens; consistent typography and spacing.

### 6. Educational copy

Each template ships with bilingual EN/AR sections for: Educational explanation, Workflow, Timeline, Returns, Ownership, Exit. Sourced from a single `src/data/propertyModelCopy.ts` so wording stays consistent.

### 7. Out of scope (this pass)

- Supabase tables for dynamic properties — keeping current static-data pattern; can migrate later.
- Real developer / valuation report uploads — placeholders shown.
- Filtering persistence in DB — URL params only.

### Files to create
- `src/data/properties.ts`
- `src/data/propertyModelCopy.ts`
- `src/components/property/PropertyShell.tsx`
- `src/components/property/templates/ReadyPropertyTemplate.tsx`
- `src/components/property/templates/ReadyPortfolioTemplate.tsx`
- `src/components/property/templates/InstallmentPropertyTemplate.tsx`
- `src/components/property/templates/PhasingPropertyTemplate.tsx`
- `src/components/property/templates/FuturePropertyTemplate.tsx`
- `src/components/property/templates/OptionPropertyTemplate.tsx`
- `src/components/property/templates/SharedPropertyTemplate.tsx`
- `src/components/property/templates/ConstructionPortfolioTemplate.tsx`
- `src/components/marketplace/CategoryTabs.tsx`
- `src/components/marketplace/ModelChips.tsx`

### Files to edit
- `src/pages/Marketplace.tsx` — categories, sub-model chips, advanced filters
- `src/pages/PropertyDetail.tsx` — route by model to template
- `src/components/marketplace/MarketplaceFilters.tsx` — new filter set
- `src/components/marketplace/PropertyCard.tsx` — model badge + per-model summary metrics

Confirm and I'll implement.