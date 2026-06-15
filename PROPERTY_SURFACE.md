# PROPERTY_SURFACE.md — Phase 2 (Property domain)

Maps the frontend's property data + reading screens (the source of truth) to the new
Django models and read API. Frontend wins on every shape decision.

## 1. Canonical shape & enums (`src/data/properties.ts:107-163`)

The `Property` TS interface is the contract. The API serializes the **exact camelCase
keys** below; Django stores snake_case and maps via serializer `source=`.

| Frontend key | Type | Model field |
|---|---|---|
| id | string ("1","10","p1-a") | `Property.slug` (unique; serialized as `id`) |
| name / nameAr | string | name / name_ar |
| location / locationAr | string | location / location_ar |
| country | uae·ksa·qatar·bahrain·oman | country |
| city | string | city |
| image / images | string / string[] | image / images |
| model | ready·ready_portfolio·installment·phasing·future·option·shared·construction_portfolio | model |
| category | ready·construction·ready_portfolio·construction_portfolio | category |
| assetType | residential·commercial·industrial·mixed·hospitality·land | asset_type |
| status | ready·construction·sold-out | status |
| yieldType | rental·appreciation·hybrid | yield_type |
| riskLevel | low·medium·high | risk_level |
| exitAvailability | lp·secondary·both·none | exit_availability |
| totalValue, tokenPrice, futureTokenPrice | number | total_value, token_price, future_token_price |
| tokenSupply | number | token_supply (SPEC §7C.6, derived = total_value/token_price) |
| expectedYield, expectedGrowth | number? | expected_yield, expected_growth |
| funded, investors, minInvestment | number | funded, investors, min_investment |
| duration / durationAr | string | duration / duration_ar |
| exitEligible, insuranceActive | bool | exit_eligible, insurance_active |
| description / descriptionAr | string | description / description_ar |
| constructionProgress | number? | construction_progress |

**Per-model nested blocks** (only the one matching `model` is populated):
`installment` (InstallmentSchedule, 1-1), `future` (FutureContract, 1-1), `option`
(OptionContract, 1-1), `shared` (SharedOwnership, 1-1), `phases` (PropertyPhase[]),
`portfolioAssets` (PortfolioAsset[]), `developerReports` (DeveloperReport[]),
`valuationReports` (ValuationReport[]). Detail also adds `spv`, `tokenMetadata`,
`financials`, `documents`, `fees` (SPEC §3.1, from PropertyDetail.tsx inline data).

## 2. Reading screens → data source & API

| Screen | File | Reads from `properties.ts`? | Wired to API? | Endpoint |
|---|---|---|---|---|
| **Marketplace** | `Marketplace.tsx` | ✅ `properties` array | ✅ | `GET /api/properties/` (filters client-side, unchanged) |
| **PropertyDetail** (catalogue path) | `PropertyDetail.tsx` | ✅ `propertyById` | ✅ | `GET /api/properties/{id}/` |
| PropertyCard / PropertyModelSection / PropertyDataRoom | components | type + `propertyModelMeta` only | n/a (render the prop they're given) | — |
| **FundedProperties** | `FundedProperties.tsx` | ❌ own inline `fp-1..fp-6` | ✅ | `GET /api/properties/funded/` |
| InsuranceValuationSection / InstallmentCalculator | components | scalar props only | n/a | — |
| **Index / FeaturedProperties** | `home/FeaturedProperties.tsx` | ❌ own inline (ids 1,2,3; `durationYears`) | ❌ (flagged) | `GET /api/properties/featured/` exists |
| **GlobalStats** | `marketplace/GlobalStats.tsx` | ❌ hardcoded marketing numbers | ❌ (flagged) | `GET /api/properties/stats/` exists |
| **Products / ProductCategory** | `Products.tsx`, `ProductCategory.tsx` | ❌ static model taxonomy / "illustrative" sample | ❌ (out of scope) | filters support `?model=&category=` |

## 3. Filters (`MarketplaceFilters.tsx`) — applied client-side today, mirrored server-side

Multi-select: `country` {uae,ksa,qatar,bahrain,oman}, `status` {ready,construction,sold-out},
`assetType` {residential,commercial,industrial,mixed}, `exitAvailability` {lp,secondary,both},
`yieldType` {rental,appreciation,hybrid}. Single: `model`, `category` (URL params).
Yield range 0–60. Server filters: `?country=…&model=…&category=…&search=…&ordering=…&yieldMin=&yieldMax=`.
No sort/pagination in the UI → list returns a **bare array** (no DRF pagination).

GlobalStats aggregation (if ever wired): count by status, Σ investors, Σ total_value,
avg expected_yield — provided by `GET /api/properties/stats/`.

## 4. Scope note (this phase)

IN: Property models (all 8 types) + admin + read API + seed + wiring Marketplace,
PropertyDetail, FundedProperties. OUT (later phases): owner submit→review→publish,
investments/checkout, personal wallet/portfolio numbers, distributions. FeaturedProperties,
GlobalStats, Products/ProductCategory left as-is (see DECISIONS.md "Properties" flags) —
wiring them would change displayed marketing content, which the overriding principle says
not to do silently.
