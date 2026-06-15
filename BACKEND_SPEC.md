# BACKEND_SPEC.md — Capimax BRX

**Blueprint for a brand-new Django + Django REST Framework backend (with Django admin as the product admin panel), replacing Supabase.**

> **Method & sources of truth.** This spec was produced by a read-only analysis of the Lovable-generated React/Vite/TypeScript frontend (primary source of truth) cross-checked against the Supabase artifacts (`supabase/migrations/*.sql`, `supabase/functions/*`, `src/integrations/supabase/types.ts`) used as a secondary, assumed-incomplete reference.
>
> **Tagging convention** used throughout:
> - `[FROM FRONTEND]` — required by frontend behavior; no Supabase backing (must be built fresh).
> - `[FROM SUPABASE REF]` — present in Supabase schema/functions; reference blueprint.
> - `[BOTH]` — present in both; frontend wins on any disagreement.
>
> **Headline finding.** The Supabase backend is *thin*. Only ~11 of 59 pages touch a real backend, and even those hardcode their headline numbers. The **entire property/marketplace/portfolio/distributions domain is frontend-static** (`src/data/properties.ts`) with **no backend at all** — this is the single biggest build item. Payment is **simulated** (no real PSP integrated anywhere). Several intake flows (Onboarding/KYC, SubmitProperty) **collect data but persist nothing**.

---

## 1. PLATFORM OVERVIEW

### 1.1 What this platform is

Capimax BRX (a.k.a. "Capimax RT" — see `pwa_settings` seed in `supabase/migrations/20260109230218_*.sql`) is a **real-estate tokenization investment platform** for the GCC region (UAE, KSA, Qatar, Bahrain, Oman). Investors buy **$100 tokens** representing fractional ownership in SPV-held properties, earn rental yield / capital appreciation distributions, hold tokens in a custodial blockchain-style wallet, receive ownership **certificates** (with public QR verification), and exit positions via a **secondary market** or **liquidity providers (LPs)**. The platform is **bilingual (English/Arabic)** — every domain string in `src/data/properties.ts` and pages has an `*_ar` / `*Ar` twin (see `src/contexts/LanguageContext.tsx`).

It supports multiple **investment models** (`src/data/properties.ts:5-13`): `ready`, `ready_portfolio`, `installment`, `phasing`, `future`, `option`, `shared`, `construction_portfolio`.

### 1.2 Full route map

Source: `src/App.tsx:76-138`. "Backend status" reflects whether the screen reaches a real Supabase call today.

| Route | Page file | What the screen needs from a backend | Backend status |
|---|---|---|---|
| `/` | `Index.tsx` | Featured properties (static today) | Static / mock |
| `/marketplace` | `Marketplace.tsx` | List + filter properties (country/status/type/exit/yield/category/model) | **MOCK — needs build** |
| `/products` | `Products.tsx` | Product-model catalogue overview | Static / mock |
| `/products/:slug` | `ProductCategory.tsx` | Properties filtered by model/category | **MOCK — needs build** |
| `/funded-properties` | `FundedProperties.tsx` | Closed/funded deals + aggregate stats | **MOCK — needs build** |
| `/property/:id` | `PropertyDetail.tsx` | Full property detail: SPV, token metadata, financials, data-room docs, installment plans | **MOCK — needs build** |
| `/checkout` | `Checkout.tsx` | Process investment (real) + property lookup (mock) | **Partial real** (`process-investment`) |
| `/dashboard` | `Dashboard.tsx` | Investor KPIs, holdings, activity, upcoming distributions, allocation | **MOCK — needs build** |
| `/portfolio` | `Portfolio.tsx` | Holdings + summary (Wallet/Certificates tabs real) | **Partial** (certs/wallet real; holdings mock) |
| `/reinvestment` | `Reinvestment.tsx` | Reinvestment history + available returns | **Partial real** (`reinvestments`; `availableReturns` hardcoded) |
| `/wallet` | `Wallet.tsx` | Balance, transactions, deposit (managers real) | **Partial** (bank/crypto/card/withdraw real; balance mock) |
| `/distributions` | `Distributions.tsx` | Distribution history + per-property breakdown | **MOCK — needs build** |
| `/installments` | `Installments.tsx` | Installment plans + pay-now | **MOCK — needs build** |
| `/secondary-market` | `SecondaryMarket.tsx` | Listings, order book, my listings, trade history, place order | **MOCK — needs build** |
| `/public-reports` | `PublicReports.tsx` | Public project reports (PDF metadata) | **MOCK — needs build** |
| `/public-analytics` | `PublicAnalytics.tsx` | Public project analytics (charts) | **MOCK — needs build** |
| `/reports` | `Reports.tsx` | Investor reports, portfolio metrics, performance | **MOCK — needs build** |
| `/documents` | `Documents.tsx` | Investor document list + signed-URL download | **MOCK — needs build** |
| `/notifications` | `Notifications.tsx` | Notifications list + settings + read/delete | **MOCK — needs build** |
| `/support` | `Support.tsx` | Help/contact (form has no submit) | Static |
| `/auth` | `Auth.tsx` | Register/login/OAuth | **REAL** (Supabase Auth) |
| `/register` | `RegisterRole.tsx` | Role picker (forwards `?role=`, ignored server-side) | Static (navigation only) |
| `/onboarding` | `Onboarding.tsx` | KYC/KYB wizard — **persists nothing today** | **MOCK — needs build** |
| `/my-assets` | `OwnerDashboard.tsx` | Owner asset list, stats, updates, messages | **MOCK — needs build** |
| `/owner-reports` (`/asset-validation`) | `OwnerReports.tsx` | Owner asset performance, distributions, investor analytics | **MOCK — needs build** |
| `/owner-wallet` | `OwnerWallet.tsx` | Owner wallet balance/earnings (managers real) | **Partial** (balance mock) |
| `/owner-documents` | `OwnerDocuments.tsx` | Owner doc upload/list/delete/signed-url | **REAL** (`useOwnerDocuments`) |
| `/cards` | `Cards.tsx` | Visa cards (live section real) | **Partial real** (`useVisaCards`) |
| `/submit-property` | `SubmitProperty.tsx` | 6-step property submission — **no submit handler** | **MOCK — needs build** |
| `/broker-dashboard` | `BrokerDashboard.tsx` | Broker stats, listings, referrals, commissions | **MOCK — needs build** |
| `/listings` | `Listings.tsx` | Broker promotable listings + lead/conversion stats | **MOCK — needs build** |
| `/referrals` | `Referrals.tsx` | Broker referrals CRUD | **MOCK — needs build** |
| `/commissions` | `Commissions.tsx` | Broker commissions + monthly stats + payout method | **MOCK — needs build** |
| `/how-it-works`, `/about`, `/fees`, `/exit-mechanism`, `/compliance`, `/regulation`, `/faq` | resp. pages | Static marketing/info | Static |
| `/settings` | `Settings.tsx` | Profile, KYC status, sessions/devices, PWA settings, admin gate | **Partial** (profile.role + PWA real; rest mock) |
| `/strategic-partners` | `StrategicPartners.tsx` | Service-partner assigned assets + deliverables | **MOCK — needs build** |
| `/partners` | `Partners.tsx` | Partner/vendor directory | **MOCK — needs build** |
| `/privacy-policy`, `/terms-conditions`, `/disclaimer`, `/disclosure`, `/platform-rules`, `/white-paper` | resp. pages | Static legal | Static |
| `/verify/:code` | `VerifyCertificate.tsx` | Public certificate verification by code | **REAL** (`verify_certificate` RPC) |
| `/liquidity-provider` | `LiquidityProvider.tsx` | LP profile, KYB, transactions, documents, withdrawals | **REAL** (`useLiquidityProvider`) |
| `/family-investment` | `FamilyInvestment.tsx` | Family accounts, bank accounts, transfer schedules, transactions | **Partial real** (`useFamilyAccounts`; demo fallbacks) |
| `/lp-market` | `LPMarket.tsx` | LP marketplace, holdings, listings | **REAL** (`useLPMarket` + tables) |
| `/audit-log` | `AuditLog.tsx` | Payment-method audit log | **REAL** (`payment_method_audit_log`) |
| `/exits-hub` | `ExitsHub.tsx` | User's LP + secondary listings, cancel | **REAL** (direct table access) |
| `/institutional` | `InstitutionalPackages.tsx` | Institutional pricing tiers | Mostly static |
| `/developers` | `DeveloperHub.tsx` | API docs for a **future public API** ("private beta") | Static (aspirational) |
| `/investor-relations` | `InvestorRelations.tsx` | IR KPIs + press releases | Mostly static |
| `*` | `NotFound.tsx` | 404 | Static |

### 1.3 User roles / personas

Derived from UI flows and `RegisterRole.tsx:45-184` + `profiles.role` CHECK (`supabase/migrations/20260104010243_*.sql:7`):

| Persona | Evidence | Backend reality today |
|---|---|---|
| **Investor** | Dashboard/Portfolio/Wallet/Checkout; default role | The only role the backend ever assigns (server-forced to `investor`, see §5) |
| **Property Owner / Developer** | `OwnerDashboard`, `OwnerReports`, `OwnerWallet`, `OwnerDocuments`, `SubmitProperty` | `profiles.role='owner'`; UI exists, mostly mock |
| **Broker** | `BrokerDashboard`, `Listings`, `Referrals`, `Commissions` | `profiles.role='broker'`; fully mock |
| **Liquidity Provider (LP)** | `LiquidityProvider`, `LPMarket`, `lp_*` tables | Real schema + hooks; *not* in `profiles.role` CHECK — modeled via `liquidity_providers` table keyed by `user_id` |
| **Strategic / Service Partner** (valuation, insurance, mgmt) | `StrategicPartners`, `Partners` | Fully mock; not in role enum |
| **Admin** | `Settings.tsx` admin gate (`profiles.role='admin'`), `pwa_settings` RLS | Referenced in RLS but **absent from `profiles.role` CHECK** — latent inconsistency (see §7C). Will become Django `is_staff`/admin. |
| **Public / Anonymous** | Marketing, legal, marketplace browse, `/verify/:code` | Public reads |
| **Family member** (sub-account of an investor) | `FamilyInvestment`, `family_accounts` | Real schema; a delegated sub-entity, not a login role |

> **Note:** `RegisterRole.tsx` offers 6 roles (investor/developer/owner/broker/lp/partner) but the chosen role is **discarded** — `Auth.tsx` never sends it to `signUp`. The real role set the DB enforces is `{investor, owner, broker}` + the out-of-band `admin`. The new backend must decide which personas are self-selectable at signup vs. admin-granted (see §8 Open Questions).

---

## 2. API SURFACE (derived from the FRONTEND — primary)

Every backend interaction found in the frontend, grouped by domain. Proposed REST paths assume a `/api/` prefix and DRF ViewSets. **Realtime** (Supabase `postgres_changes` channels) is noted where present — in DRF these become WebSocket/SSE streams or client polling (see §8).

> Supabase client: `src/integrations/supabase/client.ts`. All `.from()/.rpc()/.functions.invoke()/.storage/.auth` calls below were enumerated from `src/hooks/*` and the 5 pages that call Supabase directly.

### 2.1 Auth (`src/contexts/AuthContext.tsx`, `src/integrations/lovable/index.ts`)

| Frontend call | File:line | Proposed endpoint |
|---|---|---|
| `supabase.auth.signUp({ email, password, options:{ data:{ full_name, phone, is_us_citizen }, emailRedirectTo }})` | `AuthContext.tsx:52` | `POST /api/auth/register/` |
| `supabase.auth.signInWithPassword({ email, password })` | `AuthContext.tsx:68` | `POST /api/auth/login/` |
| `lovable.auth.signInWithOAuth("google", { redirect_uri })` | `AuthContext.tsx:77` | `GET /api/auth/oauth/google/` |
| `lovable.auth.signInWithOAuth("apple", { redirect_uri })` | `AuthContext.tsx:85` | `GET /api/auth/oauth/apple/` |
| `supabase.auth.signOut()` | `AuthContext.tsx:93` | `POST /api/auth/logout/` |
| `supabase.auth.getSession()` / `onAuthStateChange` | `AuthContext.tsx:26,35` | `GET /api/auth/session/` (+ token refresh) |
| `supabase.auth.getUser()` (6 hooks) | e.g. `useSavedCards.ts:24` | `GET /api/auth/me/` |

**Register request payload:** `{ email, password, full_name, phone, is_us_citizen: boolean }`.
**Session response the UI consumes:** `{ user: { id, email }, session: { access_token } }`. Role is read separately from `profiles`.

### 2.2 Investments & tokens

| Op | File:line | Method + path | Request | Response consumed |
|---|---|---|---|---|
| `functions.invoke("process-investment")` | `useInvestment.ts:44` | `POST /api/investments/` | `{ property_id, property_name, amount, token_amount, token_symbol, price_per_token, ownership_percentage, payment_method }` | `{ success, investment_id, tokens_minted, certificate_generated, error? }` |
| `functions.invoke("mint-tokens")` | `useInvestment.ts:93` | `POST /api/investments/{investment_id}/mint/` | `{ investment_id }` | `{ success, error? }` |
| `.from("ownership_tokens").select("*").eq("wallet_id",…).order("token_value_usd",desc)` | `useOwnershipTokens.ts:91` | `GET /api/wallets/{wallet_id}/tokens/` | filter `wallet_id` | array of `OwnershipToken` (see §3) |
| realtime `ownership_tokens` (filter `wallet_id`) | `useOwnershipTokens.ts:40` | `GET /api/wallets/{wallet_id}/tokens/stream` | — | INSERT/UPDATE/DELETE events |

### 2.3 Certificates

| Op | File:line | Method + path | Request | Response |
|---|---|---|---|---|
| `.from("certificates").select("*").eq("user_id",…).order("issue_date",desc)` | `useCertificates.ts:88` | `GET /api/certificates/` | — | array of `Certificate` |
| `functions.invoke("generate-certificate")` | `useCertificates.ts:113` | `POST /api/certificates/generate/` | `{ investment_id, status: "provisional"\|"final" }` | `{ success, certificate, error? }` |
| `.storage.from("certificates").download(pdf_path)` | `useCertificates.ts:141` | `GET /api/certificates/{id}/pdf/` | `pdf_path` | binary PDF blob |
| `.rpc("verify_certificate", { p_code })` | `VerifyCertificate.tsx:32` | `GET /api/certificates/verify/{code}/` (public) | `code` | curated public projection (see §4) |
| realtime `certificates` (filter `user_id`) | `useCertificates.ts:45` | `GET /api/certificates/stream` | — | change events |

### 2.4 Wallet, KYC, balances, visa cards

| Op | File:line | Method + path | Notes |
|---|---|---|---|
| `.from("user_kyc").select("status,submitted_at,approved_at").maybeSingle()` | `useUserWallet.ts:58` | `GET /api/kyc/` | KYC status |
| upsert `user_kyc` → status `submitted` | `useUserWallet.ts:148,156` | `POST /api/kyc/submit/` | insert or update branch |
| `.from("user_wallets").select("*").maybeSingle()` | `useUserWallet.ts:69` | `GET /api/wallets/me/` | custodial wallet |
| `functions.invoke("create-wallet")` (no body) | `useUserWallet.ts:110` | `POST /api/wallets/` | **KYC-gated** (see §4) |
| `.from("wallet_transactions").select("*").eq("wallet_id",…).limit(50)` | `useUserWallet.ts:79` | `GET /api/wallets/{id}/transactions/` | last 50 |
| `.from("visa_cards").select("*").eq("user_id",…)` | `useVisaCards.ts:75` | `GET /api/visa-cards/` | card list |
| `.from("card_transactions").select("*").eq("user_id",…).limit(50)` | `useVisaCards.ts:76` | `GET /api/visa-cards/transactions/` | |
| `.from("wallet_balances").select("*").maybeSingle()` | `useVisaCards.ts:77` | `GET /api/wallet-balances/me/` | |
| `.from("visa_cards").insert(…)` | `useVisaCards.ts:151` | `POST /api/visa-cards/` | issue card |
| `.from("visa_cards").update({ status })` | `useVisaCards.ts:160` | `PATCH /api/visa-cards/{id}/` | freeze/activate |
| `.from("visa_cards").update({ spending_limit })` | `useVisaCards.ts:167` | `PATCH /api/visa-cards/{id}/` | |
| `.rpc("spend_with_card", { _card_id, _amount, _merchant, _category })` | `useVisaCards.ts:174` | `POST /api/visa-cards/{id}/spend/` | atomic debit (see §4) |
| `.rpc("topup_wallet", { _amount })` | `useVisaCards.ts:187` | `POST /api/wallet/topup/` | demo funding |
| realtime channel on `wallet_balances`,`card_transactions`,`visa_cards` | `useVisaCards.ts:108` | `GET /api/visa-cards/stream` | 3-table change feed |

### 2.5 Payment methods (bank, crypto, saved cards) + audit log

| Op | File:line | Method + path |
|---|---|---|
| `.from("investor_bank_accounts").select/insert/update/delete` (+ set-default = 2 updates) | `useInvestorBankAccounts.ts:74,110,169,205,240,245` | `GET/POST/PATCH/DELETE /api/bank-accounts/`, `PATCH …/{id}/set-default/` |
| `.from("investor_crypto_wallets").select/insert/update/delete` | `useInvestorCryptoWallets.ts:54,90,133,177,212,217` | `GET/POST/PATCH/DELETE /api/crypto-wallets/`, `…/set-default/` |
| `.from("payment_methods").select/insert/delete` (+ set-default) | `useSavedCards.ts:46,90,122,150,156` | `GET/POST/DELETE /api/payment-methods/cards/`, `…/set-default/` |
| `.from("payment_method_audit_log").insert([...])` (from bank/crypto/withdrawal hooks) | `useInvestorBankAccounts.ts:130` etc. | server-side side-effect of each mutation; read via `GET /api/audit-log/` |
| `.from("payment_method_audit_log").select("*").limit(200)` | `AuditLog.tsx:29` | `GET /api/audit-log/` |

**Audit log actions** observed: `add`, `edit`, `delete`, `withdrawal_request`, `withdrawal_otp_sent`, `withdrawal_otp_verified`. `method_type ∈ {bank, crypto, card, withdrawal}`.

### 2.6 Withdrawals + OTP

| Op | File:line | Method + path | Request |
|---|---|---|---|
| `.from("withdrawal_requests").select("*").eq("user_id",…)` | `useWithdrawalRequests.ts:67` | `GET /api/withdrawal-requests/` | — |
| `.from("withdrawal_requests").insert(…)` | `useWithdrawalRequests.ts:102` | `POST /api/withdrawal-requests/` | `{ amount, currency, withdrawal_method:'bank'\|'crypto'\|'card', bank_account_id?, crypto_wallet_id?, card_id?, notes? }` |
| `.update({ status:"cancelled" }).eq("status","pending")` | `useWithdrawalRequests.ts:149` | `POST /api/withdrawal-requests/{id}/cancel/` | — |
| `functions.invoke("send-withdrawal-otp")` | `useWithdrawalRequests.ts:177` | `POST /api/withdrawal-requests/{id}/send-otp/` | `{ withdrawal_request_id }` |
| `functions.invoke("verify-withdrawal-otp")` | `useWithdrawalRequests.ts:197` | `POST /api/withdrawal-requests/{id}/verify-otp/` | `{ withdrawal_request_id, code }` |

### 2.7 Liquidity Provider (LP)

| Op | File:line | Method + path |
|---|---|---|
| `.from("liquidity_providers").select("*").maybeSingle()` | `useLiquidityProvider.ts:128` | `GET /api/lp/profile/` |
| `.from("liquidity_providers").insert(…)` (apply) | `useLiquidityProvider.ts:171` | `POST /api/lp/profile/` |
| `.update({ bank_* })` / `.update({ crypto_* })` | `useLiquidityProvider.ts:209,234` | `PATCH /api/lp/profile/bank-details/` , `…/crypto-details/` |
| `.from("lp_transactions").select("*")` | `useLiquidityProvider.ts:139` | `GET /api/lp/transactions/` |
| `.from("lp_transactions").insert(withdrawal)` | `useLiquidityProvider.ts:261` | `POST /api/lp/withdrawals/` |
| `.from("lp_documents").select(...or template)` | `useLiquidityProvider.ts:150` | `GET /api/lp/documents/` |
| `.storage.from("lp-documents").upload/download/remove` + `.from("lp_documents").insert/delete` | `useLiquidityProvider.ts:294,328,356,300,363` | `POST/GET/DELETE /api/lp/documents/` |
| `.update({ kyb_* , kyb_status:"under_review" })` | `useLiquidityProvider.ts:385` | `POST /api/lp/kyb/submit/` |
| `.storage.from("lp-documents").upload(kyb)` + `.from("lp_kyb_documents").insert` | `useLiquidityProvider.ts:425,431` | `POST /api/lp/kyb/documents/` |
| `.from("lp_holdings").select/insert/update` | `useLPHoldings.ts:72,100,135` | `GET/POST/PATCH /api/lp/holdings/` |
| `.from("lp_market_listings").select(mine)/select(listed)/insert/update(cancel)/update(purchase)` | `useLPMarket.ts:87,98,127,163,208` | `GET/POST /api/lp/market/`, `…/{id}/cancel/`, `…/{id}/purchase/` |
| realtime `lp_holdings`, `lp_market_listings` | `useLPHoldings.ts:44`, `useLPMarket.ts:59` | `…/stream` |

### 2.8 Secondary market + Exits hub

| Op | File:line | Method + path |
|---|---|---|
| `.from("lp_market_listings").select().eq("investor_id",user.id)` | `ExitsHub.tsx:46` | `GET /api/lp/market/?investor_id=me` |
| `.from("secondary_market_listings").select().eq("seller_id",user.id)` | `ExitsHub.tsx:47` | `GET /api/secondary-market/?seller_id=me` |
| `.from("lp_market_listings"/"secondary_market_listings").update(cancel)` | `ExitsHub.tsx:57,63` | `POST …/{id}/cancel/` |
| `.from("lp_market_listings").insert` / `.from("secondary_market_listings").insert` | `LPMarket.tsx:94,117` | `POST /api/lp/market/`, `POST /api/secondary-market/` |

> ⚠️ **Discrepancy:** the **investor-facing** `SecondaryMarket.tsx` page is 100% mock (order book, listings, trades) and does **not** use `secondary_market_listings`. Only the LP flow does. See §7C.

### 2.9 Family accounts

| Op | File:line | Method + path |
|---|---|---|
| `.from("family_accounts").select/insert/update` | `useFamilyAccounts.ts:73,143,317` | `GET/POST/PATCH /api/family-accounts/` |
| `.from("family_bank_accounts").select/insert` | `useFamilyAccounts.ts:90,189` | `GET/POST /api/family-accounts/bank-accounts/` |
| `.from("family_transfer_schedules").select/insert` | `useFamilyAccounts.ts:107,248` | `GET/POST /api/family-accounts/transfer-schedules/` |
| `.from("family_transactions").select/insert` (audit + transfers) | `useFamilyAccounts.ts:124,157,207,263,289` | `GET/POST /api/family-accounts/transactions/` |

### 2.10 Reinvestments, Owner documents, PWA settings, Profile

| Op | File:line | Method + path |
|---|---|---|
| `.from("reinvestments").select/insert` | `useReinvestments.ts:38,57` | `GET/POST /api/reinvestments/` |
| `.from("owner_documents").select/insert/delete` + storage upload/remove/createSignedUrl | `useOwnerDocuments.ts:36,75,118,68,115,143` | `GET/POST/DELETE /api/owner-documents/`, `…/{id}/signed-url/` |
| `.from("pwa_settings").select().single()` | `usePWASettings.ts:20` | `GET /api/pwa-settings/` (public read) |
| `.from("pwa_settings").update().eq("id",…)` | `usePWASettings.ts:44` | `PATCH /api/pwa-settings/{id}/` (admin only) |
| `.from("profiles").select("role")` (admin gate) | `Settings.tsx:53` | `GET /api/profile/me/` |

### 2.11 Storage buckets

Three private buckets (`supabase/migrations` seed): `certificates` (10 MB, pdf), `lp-documents` (20 MB, pdf/doc/docx/jpeg/png), `owner-documents`. In Django → a configured storage backend (S3/MinIO or `FileField` to disk) with **authenticated download views** or short-lived signed URLs (mirror `createSignedUrl(…, 3600)` for owner docs, 1-year for certificates).

### 2.12 The MOCK surface (no backend exists — must be designed; see §3 & §7A)

Endpoints implied by mock-data pages (full entity shapes in §3 and §7A):

- `GET /api/properties/` (+ filters), `GET /api/properties/{id}/`, `GET /api/properties/{id}/data-room/`, `GET /api/properties/funded/`
- `GET /api/dashboard/`, `GET /api/portfolio/holdings/`, `GET /api/portfolio/summary/`, `GET /api/portfolio/metrics/`, `GET /api/portfolio/performance/`
- `GET /api/distributions/` (+ summary, per-property)
- `GET /api/installment-plans/`, `POST /api/installments/{id}/pay/`
- `GET /api/secondary-market/listings/`, `…/orderbook/{property}/`, `POST /api/secondary-market/orders/`
- `GET /api/reports/`, `GET /api/documents/` (investor), `GET/PATCH/DELETE /api/notifications/` + settings
- Broker: `GET /api/broker/{stats,listings,referrals,commissions}/`, `POST /api/broker/referrals/`
- Owner: `GET /api/owner/{assets,stats,updates,messages,performance,distributions,investors}/`, `GET /api/owner/wallet/`, `POST /api/owner/property-submissions/`
- Public: `GET /api/public/projects/`, `…/{id}/reports/`, `…/{id}/analytics/`
- Partners: `GET /api/partners/`, `GET /api/partner/assigned-assets/`, deliverable submissions
- Onboarding: `POST /api/onboarding/`
- IR / Institutional: `GET /api/ir/{kpis,press}/`, `GET /api/institutional/tiers/`

---

## 3. DATA MODELS (Django-oriented)

Conventions: all models use `id = UUIDField(primary_key=True, default=uuid4)` to match Supabase UUIDs. Timestamps use `auto_now_add`/`auto_now` (replacing the `update_updated_at_column` triggers — see §4). Money/decimals → `DecimalField(max_digits=…, decimal_places=2)` (frontend treats them as `number`). FKs reference `settings.AUTH_USER_MODEL` unless noted. Status fields → `TextChoices`.

### 3.0 User & Profile

**`User`** — **Custom user model required.** Supabase identifies users by UUID and uses email as login (no username). Use a custom `AbstractBaseUser` with email login + UUID pk. `[BOTH]`

**`Profile`** `[BOTH]` (Supabase `profiles`) — 1:1 with User, auto-created on registration (replacing the unwired `handle_new_user` trigger).
- `user` OneToOne, `full_name` (nullable), `phone` (nullable), `avatar_url` (nullable), `role` choices `{investor, owner, broker, admin}` default `investor` **(server-set, immutable by user)**, `is_us_citizen` (bool — collected at signup, not in current schema → `[FROM FRONTEND]`), timestamps.
- Admin: `list_display=(user, full_name, role, phone)`, `list_filter=(role,)`, `search_fields=(full_name, user__email, phone)`.

### 3.1 Properties domain `[FROM FRONTEND]` — **biggest gap; no Supabase backing**

Shape is fully specified by `src/data/properties.ts:107-163`. This is the catalogue powering Marketplace, ProductCategory, FundedProperties, PropertyDetail, Checkout, Index featured.

**`Property`**
- Identity: `slug/id` (string ids like "1","10"), `name`, `name_ar`, `location`, `location_ar`, `country` (`uae|ksa|qatar|bahrain|oman`), `city`, `image` (URL), `images` (JSON/array, optional).
- Classification: `model` (`ready|ready_portfolio|installment|phasing|future|option|shared|construction_portfolio`), `category` (`ready|construction|ready_portfolio|construction_portfolio`), `asset_type` (`residential|commercial|industrial|mixed|hospitality|land`), `status` (`ready|construction|sold-out`), `yield_type` (`rental|appreciation|hybrid`), `risk_level` (`low|medium|high`).
- Economics: `total_value` (Decimal), `token_price` (default 100), `future_token_price` (optional), `expected_yield` (optional %), `expected_growth` (optional %), `funded` (0–100), `investors` (int), `min_investment` (default 100), `duration`, `duration_ar`.
- Exit/liquidity: `exit_eligible` (bool), `exit_availability` (`lp|secondary|both|none`), `insurance_active` (bool).
- Narrative: `description`, `description_ar`, `construction_progress` (optional %).
- Admin: `list_display=(name, country, model, status, funded, expected_yield)`, `list_filter=(country, model, category, asset_type, status, risk_level)`, `search_fields=(name, name_ar, location)`. **This is where admins create/manage listings.**

**`PropertyPhase`** (for `phasing` model; `PhaseInfo` `src/data/properties.ts:43-52`) — FK Property; `number, name, name_ar, token_price, start_date, end_date, status(completed|current|upcoming), progress`. Inline in Property admin.

**`PortfolioAsset`** (for portfolio models; `src/data/properties.ts:83-90`) — FK Property; `name, name_ar, city, weight(%), asset_type`. Inline.

**`InstallmentSchedule`** (model `installment`; `src/data/properties.ts:34-41`) — OneToOne Property; `total_installments, paid_installments, monthly_amount, next_payment_date, activation_date, completion_percent`.

**`FutureContract`** (model `future`; `:54-61`) — OneToOne Property; `reservation_date, activation_date, settlement_date, reservation_price, estimated_future_value, estimated_roi`.

**`OptionContract`** (model `option`; `:63-71`) — OneToOne Property; `option_premium, strike_price, expiry_date, validity_months, estimated_future_value, exercise_conditions, exercise_conditions_ar`.

**`SharedOwnership`** (model `shared`; `:73-81`) — OneToOne Property; `investor_share, owner_share, owner_name, profit_split, revenue_distribution(monthly|quarterly|annual), transfer_process, transfer_process_ar`.

**`DeveloperReport`** (`:93-98`) — FK Property; `date, title, title_ar, progress`.
**`ValuationReport`** (`:100-104`) — FK Property; `date, valuation, appraiser`.

**`SPVRecord` / `TokenMetadata` / `PropertyDocument`** `[FROM FRONTEND]` — `PropertyDetail.tsx` renders SPV details, on-chain token metadata (contract address/supply/explorer URL), a financials block (purchase price, NOI, cap rate, occupancy), and a data-room document list. These exist only inline for IDs "1"/"2" today; model as related tables on Property.

### 3.2 Investments, tokens, wallet `[BOTH]`

**`Investment`** (Supabase `investments`, types.ts:378) — `user` FK, `property_id`, `property_name`, `amount_invested`, `token_amount`, `token_symbol`, `price_per_token`, `ownership_percentage`, `payment_method`, `payment_status` (default `pending`), `tokens_minted` (bool), `minted_at`, `wallet` FK→UserWallet (nullable), timestamps. **Constraint:** partial unique on `(user, property_id)` where `payment_status in (pending, processing)` — replicate as `UniqueConstraint(condition=Q(payment_status__in=[...]))` (from `…034538` idx). Admin: `list_display=(user, property_name, amount_invested, payment_status, tokens_minted)`, filters on `payment_status, tokens_minted`.

**`UserWallet`** (`user_wallets`) — `user` FK (unique), `wallet_address`, `network` (default `ethereum`), `wallet_type` (default `custodial`), timestamps. Custodial; address is generated server-side.

**`WalletTransaction`** (`wallet_transactions`) — `wallet` FK, `tx_hash`, `tx_type`, `amount` (nullable), `token_symbol` (nullable), `status` (default `confirmed`), `block_number` (nullable), `created_at`. Read-only to user.

**`OwnershipToken`** (`ownership_tokens`) — `wallet` FK, `property_id`, `property_name`, `token_symbol`, `token_amount`, `token_value_usd`, `ownership_percentage`, `acquisition_date`, `last_distribution_date` (nullable), `total_distributions`, `status` (default `active`), timestamps. Mutated only by mint service.

**`WalletBalance`** (`wallet_balances`) — `user` OneToOne, `available_balance`, `pending_balance`, `currency` (default USD). Mutated only via spend/topup services.

### 3.3 Certificates `[BOTH]`

**`Certificate`** (`certificates`, types.ts:56) — `user` FK, `investment` FK (nullable), `certificate_id` (human ref e.g. `CERT-2026-XXX-######`), `status` (`provisional|final|revoked`), `issue_date`, `subscription_date`, `finalized_at`, `investor_name`, `investor_id_masked`, `spv_name`, `spv_registration_ref`, `property_name`, `property_location`, `listing_id`, `investment_amount`, `units_purchased`, `unit_price`, `ownership_percentage`, `platform_fee`, `authorized_signatory`, `digital_signature_hash`, `qr_code_data`, `verification_code` (unique, indexed), `verification_url`, `pdf_url`, `pdf_path`, `revoked_at`, `revocation_reason`, timestamps. Admin: `list_display=(certificate_id, investor_name, property_name, status, issue_date)`, filters `status`, search `certificate_id, verification_code, investor_name`. Admin action: **revoke**.

### 3.4 KYC / KYB `[BOTH]`

**`UserKYC`** (`user_kyc`) — `user` OneToOne, `status` (`pending|submitted|approved|rejected`), `submitted_at`, `approved_at`, `rejected_at`, `rejection_reason`, timestamps. Admin: approve/reject actions, `list_filter=(status,)`. **KYC approval gates wallet creation** (see §4).

> KYC **document uploads** are collected by `Onboarding.tsx` but **persisted nowhere** → add **`KYCDocument`** `[FROM FRONTEND]` (FK UserKYC, `document_type, file, status, uploaded_at`).

### 3.5 Payment methods `[BOTH]`

**`PaymentMethodCard`** (`payment_methods`) — `user` FK, `card_brand`, `card_last_four`, `card_expiry_month`, `card_expiry_year`, `cardholder_name`, `is_default`, timestamps. **Metadata only** (no PAN/CVV) — implies an external vault token in production.

**`InvestorBankAccount`** (`investor_bank_accounts`) — `user` FK, `bank_name`, `bank_code`, `account_holder_name`, `account_number_masked`, `iban_masked`, `swift_code`, `country`, `currency`, `is_verified`, `is_default`, `verified_at`, timestamps. (Masking currently client-side → move server-side.)

**`InvestorCryptoWallet`** (`investor_crypto_wallets`) — `user` FK, `wallet_address`, `wallet_label`, `network`, `is_verified`, `is_default`, `verified_at`, timestamps.

**`PaymentMethodAuditLog`** (`payment_method_audit_log`) — `user` FK, `action`, `method_type`, `method_id` (nullable), `details` (JSON), `ip_address`, `user_agent`, `created_at`. Append-only. Admin: read-only, `list_filter=(action, method_type)`.

### 3.6 Withdrawals + OTP `[BOTH]`

**`WithdrawalRequest`** (`withdrawal_requests`) — `user` FK, `amount`, `currency`, `withdrawal_method` (`bank|crypto|card`), `bank_account` FK, `crypto_wallet` FK, `card` FK (all nullable), `status` (`pending|processing|completed|failed|cancelled`), `otp_verified`, `otp_verified_at`, `reference_number`, `notes`, `processed_at`, `completed_at`, `failed_at`, `failure_reason`, timestamps. Admin: process/complete/fail actions.

**`WithdrawalOTP`** (`withdrawal_otps`) — `user` FK, `withdrawal_request` FK, `code_hash` (SHA-256), `expires_at`, `verified`, `attempts` (default 0), `created_at`. Hashes never exposed.

### 3.7 Visa cards `[BOTH]`

**`VisaCard`** (`visa_cards`) — `user` FK, `card_type` (`virtual|physical`), `card_brand`, `card_category` (`personal|family|dependent`), `card_last_four`, `card_number_masked`, `cardholder_name`, `status` (`active|frozen|pending|cancelled`), `spending_limit`, `spent_this_month`, `expiry_month`, `expiry_year`, `role_at_issue`, `shipping_status`, `nickname`, `family_account` FK (nullable), `relationship`, timestamps.

**`CardTransaction`** (`card_transactions`) — `card` FK, `user` FK, `amount`, `currency`, `tx_type` (`purchase|refund|topup|fee`), `merchant`, `category`, `status` (`completed|pending|declined|reversed`), `created_at`. Written only by spend service.

### 3.8 Liquidity Provider `[BOTH]`

**`LiquidityProvider`** (`liquidity_providers`, types.ts:536) — `user` FK, contact (`company_name, contact_name, email, phone, country`), `investment_amount`, `status` (`pending|approved|rejected|suspended`), `applied_at/approved_at/rejected_at/rejection_reason`, bank (`bank_name, bank_account_number, bank_iban, bank_swift`), crypto (`crypto_wallet_address, crypto_network`), balances (`total_deposited, total_withdrawn, total_earnings, current_balance`), KYB block (`kyb_status` enum `not_started|documents_pending|under_review|approved|rejected`, `business_type, business_registration_number, tax_id, business_address, business_description, annual_revenue, source_of_funds, kyb_submitted_at/approved_at/rejected_at/rejection_reason`), timestamps. Admin: approve/reject LP + KYB actions, `list_filter=(status, kyb_status)`.

**`LPTransaction`** (`lp_transactions`) — `lp` FK, `tx_type`, `amount`, `currency`, `status` (`pending|processing|completed|failed`), `withdrawal_method`, `bank_reference`, `crypto_tx_hash`, `notes`, `processed_at`, `created_at`.

**`LPDocument`** (`lp_documents`) — `lp` FK (nullable), `user` FK, `document_name, document_type, file_path, file_size, is_template` (bool), `uploaded_by`, `created_at`.

**`LPKYBDocument`** (`lp_kyb_documents`) — `lp` FK, `user` FK, `document_name, document_type, file_path, file_size, status, rejection_reason, reviewed_at, created_at`.

**`LPHolding`** (`lp_holdings`) — `lp` FK, `listing` FK (nullable), `property_id, property_name, token_symbol, token_amount, purchase_price, current_value, purchase_date, status(held|listed_lp|listed_secondary|sold), listed_at, sold_at`, timestamps.

**`LPMarketListing`** (`lp_market_listings`) — `investor` FK, `lp` FK (nullable buyer), `property_id, property_name, token_symbol, token_amount, unit_price(default 100), total_value, platform_fee_percent(default 1), platform_fee_amount, net_amount, status(listed|pending|completed|cancelled|expired), listed_at, purchased_at, completed_at, cancelled_at, notes`, timestamps.

### 3.9 Secondary market `[BOTH]` (schema) / `[FROM FRONTEND]` (investor UI)

**`SecondaryMarketListing`** (`secondary_market_listings`) — `seller` FK, `seller_type`, `buyer` FK (nullable), `buyer_type`, `property_id, property_name, token_symbol, token_amount, unit_price, total_value, platform_fee_percent, platform_fee_amount, net_amount, status, listed_at, purchased_at, completed_at, cancelled_at, notes`, timestamps.
> The investor `SecondaryMarket.tsx` additionally implies an **order book** (bids/asks) and **trade history** that have **no schema** → `[FROM FRONTEND]` `Order` / `Trade` models needed (see §7A/§7C).

### 3.10 Family accounts `[BOTH]`

**`FamilyAccount`** (`family_accounts`) — `investor` FK, `member_name, member_email, relationship, status(pending|active|suspended), access_level(view_only|authorized), allocated_returns_percent, total_transferred, linked_at`, timestamps.
**`FamilyBankAccount`** (`family_bank_accounts`) — `family_account` FK, bank fields + `is_primary, is_verified, verified_at`.
**`FamilyTransferSchedule`** (`family_transfer_schedules`) — `family_account` FK, `bank_account` FK, `schedule_type(immediate|weekly|monthly|quarterly|threshold), threshold_amount, next_transfer_date, is_active`.
**`FamilyTransaction`** (`family_transactions`) — `family_account` FK, `bank_account` FK (nullable), `transaction_type, amount, currency, status, reference_number, description, metadata(JSON), initiated_by` FK, `created_at`.

### 3.11 Reinvestments, Owner documents, PWA, misc `[BOTH]`

**`Reinvestment`** (`reinvestments`) — `user` FK, `source_amount, discount_percentage(default 5), discount_amount, net_investment_value, investment` FK (nullable), `property_id, property_name, status`, timestamps.
**`OwnerDocument`** (`owner_documents`) — `user` FK, `property_id, property_name, document_name, document_type, file_path, file_size, file_type, description, status(default active), uploaded_at`, timestamps.
**`PWASetting`** (`pwa_settings`) — singleton; `app_name, app_short_name, app_description, theme_color, background_color, install_prompt_enabled`, timestamps. Public read; admin write. Seed: `Capimax RT / Capimax / Real Estate Tokenization Platform`.

### 3.12 Models required by MOCK pages `[FROM FRONTEND]` (no Supabase backing)

These come from inline arrays in pages (shapes per the page survey). Each needs a model + admin + read API:

- **`Distribution`** — `user` FK, `property` FK, `amount, distribution_type(rental|appreciation|dividend), period, date, status(paid|pending), yield_percent`. (`Distributions.tsx`)
- **`InvestmentInstallmentPlan`** + **`InstallmentPayment`** — per-investor schedule: plan (`property, total, paid, remaining, next_due`) with payments (`amount, due_date, status(paid|pending|upcoming), kind(down_payment|monthly)`). `POST pay`. (`Installments.tsx`)
- **`Notification`** + **`NotificationSetting`** — `user` FK, `type, title, title_ar, description, timestamp, read(bool), action_url`; settings per channel/category. (`Notifications.tsx`)
- **`Report`** / **`ReportFile`** — investor + public reports (category, property, date, size, file, status `signed|pending|expired`). (`Reports.tsx`, `Documents.tsx`, `PublicReports.tsx`)
- **`InvestorDocument`** — investor-facing documents (mirror `OwnerDocument`). (`Documents.tsx`)
- **Broker domain:** **`BrokerProfile`** (referral_code), **`BrokerListing`** (target_raise, raised, investors, yield, commission, leads, conversions), **`Referral`** (name, email, phone, status, investment_amount, commission), **`Commission`** (+ monthly aggregates, payout method). (`BrokerDashboard/Listings/Referrals/Commissions`)
- **Owner domain:** **`OwnerAsset`** (units_sold, investors, raised, distributed, status `active|construction|under_review`, review_notes), **`OwnerUpdate`**, **`PlatformMessage`**, **`PropertySubmission`** (the 6-step `SubmitProperty` intake: basic info, location, financials, documents, media, draft/submitted). (`OwnerDashboard/OwnerReports/SubmitProperty`)
- **Partner domain:** **`Partner`** (directory: name, category `developer|legal|valuation|insurance|finance`, country, website, verified, logo), **`AssignedAsset`** + **`Deliverable`** (service-partner work items with due dates, progress, activity log). (`Partners`, `StrategicPartners`)
- **`OnboardingSubmission`** — personal info + role/tier + agreements + KYC docs (the currently-no-op `Onboarding` wizard). (`Onboarding.tsx`)
- **Marketing-config (optional, admin-editable):** **`InstitutionalTier`**, **`IRKpi`**, **`PressRelease`**. (`InstitutionalPackages`, `InvestorRelations`)

### 3.13 Custom user model decision

A **custom user model is required** (email-as-login, UUID pk). `Profile` (1:1) holds `role`. Personas owner/broker/admin are `Profile.role` values; **LP**, **Family member**, **Partner** are *related entities* keyed to a user, not auth roles. Use Django Groups/permissions + DRF object permissions to mirror Supabase RLS (see §5).

---

## 4. BUSINESS LOGIC / SERVER-SIDE OPERATIONS

### 4.1 The 6 Supabase edge functions → Django services

**(1) `process-investment`** (`supabase/functions/process-investment/index.ts`) → `POST /api/investments/` `[BOTH]`
Auth: `IsAuthenticated`. Logic to replicate inside `transaction.atomic()`:
1. Validate payload ranges (amount $1–$10M, ownership 0–100, lengths). 
2. **Dedup guard:** reject (409) a second `pending|processing` investment for same `(user, property_id)` within 60s — back with the partial unique constraint.
3. Create `Investment(payment_status=pending)`.
4. **Simulated payment** → set `payment_status=completed` (⚠️ no real charge today; this is where a real PSP integrates — see §6).
5. If user has a wallet: **auto-mint** — upsert `OwnershipToken` (additive merge on `wallet+property`, use `select_for_update()` to fix the read-modify-write race in the original), insert a `WalletTransaction` (random `tx_hash`, random `block_number` — mock chain), set `tokens_minted=true`.
6. Create **provisional `Certificate`** (generate `certificate_id`, `verification_code`, masked investor id; `property_location` hardcoded "Dubai, UAE" today; `platform_fee=0`). No PDF here.
Response: `{ success, investment_id, tokens_minted, certificate_generated }`.

**(2) `mint-tokens`** (`mint-tokens/index.ts`) → `POST /api/investments/{id}/mint/` `[BOTH]`
The auto-mint branch extracted standalone (used when wallet is created *after* investing). Guards: object owner, idempotent (already minted → 200), `payment_status=completed`, wallet exists. Upsert token + write tx + flag minted.

**(3) `generate-certificate`** (`generate-certificate/index.ts`) → `POST /api/certificates/generate/` `[BOTH]`
Auth + investment ownership. Idempotent (return existing). **Render PDF** (replace `pdf-lib` with **ReportLab/WeasyPrint**): single Letter page — header band "CAPIMAX RT", status badge, investor/SPV/property/investment/verification sections, QR code (original only drew a placeholder box → render a real QR), signatory, footer. Upload to `certificates` storage (`<user_id>/<cert_id>.pdf`), create signed URL (1-year), persist `Certificate` with `pdf_url`/`pdf_path`.

**(4) `create-wallet`** (`create-wallet/index.ts`) → `POST /api/wallets/` `[BOTH]`
Auth + **custom `KYCApprovedPermission`** (`UserKYC.status == 'approved'`, else **403 "KYC approval required"**). Idempotent (return existing). Generate random 20-byte `0x…` address (mock, not a real keypair), create custodial `UserWallet(network=ethereum, wallet_type=custodial)`.

**(5) `send-withdrawal-otp`** (`send-withdrawal-otp/index.ts`) → `POST /api/withdrawal-requests/{id}/send-otp/` `[BOTH]`
Auth + owner; request must be `pending`. Generate 6-digit code, store **SHA-256 hash** + 10-min expiry in `WithdrawalOTP`, write audit log (`withdrawal_otp_sent`). ⚠️ **Email/SMS not implemented** — original returns the raw code as `dev_code`. Production must integrate a real provider (Django `send_mail`/Celery + SES/Twilio) and **never return the code**.

**(6) `verify-withdrawal-otp`** (`verify-withdrawal-otp/index.ts`) → `POST /api/withdrawal-requests/{id}/verify-otp/` `[BOTH]`
Auth + owner. Fetch latest unverified OTP; check expiry (400), **max 5 attempts** (429), hash-compare (increment attempts on miss). On match: mark OTP `verified`, advance `WithdrawalRequest.status → processing`, set `otp_verified`, audit log (`withdrawal_otp_verified`). Wrap in transaction.

### 4.2 Postgres RPCs → Django services `[FROM SUPABASE REF]`

- **`spend_with_card(_card_id,_amount,_merchant,_category)`** (`…024928`) → `POST /api/visa-cards/{id}/spend/`. Atomic: `select_for_update()` on card + `WalletBalance`; card must be `active`; enforce `spent_this_month + amount ≤ spending_limit`; if balance < amount → record **declined** `CardTransaction` and error; else debit balance, increment `spent_this_month`, insert **completed** `CardTransaction`. Return the tx.
- **`topup_wallet(_amount)`** (`…024928`) → `POST /api/wallet/topup/`. Demo funding: positive-amount guard, atomic increment of `WalletBalance.available_balance` (upsert).
- **`verify_certificate(p_code)`** (`…034538`, redefined `…034759`) → `GET /api/certificates/verify/{code}/` (`AllowAny`). Returns a **curated public projection** of a certificate by `verification_code` (LIMIT 1): cert id/status, investor_name, investor_id_masked, spv/property, amounts, dates, verification url, revocation_reason — **never the full row / PII**.

### 4.3 Database triggers → Django mechanisms

- **`update_updated_at_column`** (every table) → `auto_now=True` on `updated_at` fields. No trigger needed.
- **`handle_new_user`** (`…194051`) — **currently NOT wired to a trigger** (dropped in `…175730`, re-created as a function only). Replicate as a **`post_save` signal / registration-serializer step** that creates `Profile(role='investor')` — **role always server-forced, never client-supplied** (anti-privilege-escalation; see §5).
- **No balance-computation triggers exist** — balance math lives in `spend_with_card`/`topup_wallet` and token math in the edge functions.

### 4.4 Server-side logic the frontend implies but that has NO backend yet `[FROM FRONTEND]`

1. **Real payment processing** for every method — none exists (see §6). `process-investment` marks everything paid.
2. **Property catalogue service** — Marketplace/PropertyDetail/Checkout all read static `src/data/properties.ts`. Needs full CRUD + filter API + admin management.
3. **Distributions engine** — compute/record periodic rental & appreciation distributions to token holders (`Distributions.tsx`, `ownership_tokens.total_distributions`/`last_distribution_date` imply it but nothing writes them).
4. **Installment payment processing** — `Installments.tsx` "Pay Now" is local-only; needs a schedule + payment endpoint that advances ownership.
5. **Secondary-market order matching / order book** — investor `SecondaryMarket.tsx` implies bid/ask matching + trade settlement; only LP one-shot listings exist.
6. **Reinvestment execution** — `reinvestments` rows are created `pending` but nothing processes them into investments; `availableReturns` is hardcoded.
7. **Notifications service** — generate + deliver + mark-read; nothing exists.
8. **Onboarding/KYC intake + document storage + review workflow** — `Onboarding.tsx` persists nothing.
9. **Property submission intake + review** — `SubmitProperty.tsx` has no submit handler.
10. **Broker referral/commission engine** — referral code generation, attribution, commission accrual/payout.
11. **Owner earnings/distribution ledger** — owner wallet balances/earnings are hardcoded.
12. **Family transfer execution** — schedules + transfers are recorded but nothing executes scheduled transfers.

---

## 5. AUTH MODEL

### 5.1 Current behavior (frontend)

- **Provider:** Supabase Auth (`src/integrations/supabase/client.ts`), tokens in `localStorage`, `persistSession + autoRefreshToken`. JWT attached as `Authorization: Bearer` to edge-function calls (`useInvestment.ts:48`).
- **Register:** `signUp({ email, password, options:{ data:{ full_name, phone, is_us_citizen }}})` + email verification (`AuthContext.tsx:52`, `Auth.tsx:271-304`).
- **Login:** `signInWithPassword` → redirect `/dashboard` (`Auth.tsx:130`).
- **OAuth:** Google + Apple via Lovable wrapper (`lovable.auth.signInWithOAuth`, `AuthContext.tsx:76-90`) which hands tokens back via `supabase.auth.setSession` (`src/integrations/lovable/index.ts:31`). Wrapper also supports Microsoft (not wired in UI).
- **Roles:** `Profile.role`, **server-forced to `investor`** and immutable by users (`handle_new_user` `…194051:10-16`; RLS WITH CHECK on insert/update `…034538:78-92`). The `RegisterRole` picker is **cosmetic** — the chosen role is dropped (`Auth.tsx` never forwards it).
- **Route protection:** **None at the router.** `App.tsx` renders every route unconditionally; `MainLayout.tsx` has no guard; no `ProtectedRoute`/`RequireAuth` exists. Protection is *in-component* (`Auth.tsx` redirects logged-in users away; `Checkout.tsx` blocks confirm without user) and *server-side* (edge functions reject unauth; RLS scopes rows).

### 5.2 What the Django + DRF backend must provide

- **Token strategy:** `djangorestframework-simplejwt` — `POST /api/auth/token/` + `/token/refresh/` (short-lived access + long-lived refresh). Consider httpOnly cookie refresh (more secure than current localStorage). Provide `GET /api/auth/session/` & `/me/` for the `getSession`/`onAuthStateChange` bootstrap.
- **Endpoints:** `register` (create user + send verification + create `Profile(role=investor)` server-forced; accept `full_name, phone, is_us_citizen`), `login`, `logout` (blacklist refresh), `verify-email`, `password-reset`.
- **OAuth:** Google + Apple (+ Microsoft if desired) via `django-allauth`/`dj-rest-auth` social login returning the same JWT pair; `redirect_uri = <origin>/dashboard`.
- **Role model & permissions:** `Profile.role ∈ {investor, owner, broker, admin}`. Role **cannot be self-assigned or self-escalated** (lock the field in the serializer; only admin/staff may change). Auto-create profile via `post_save` signal.
- **RLS → DRF:** reimplement Supabase RLS as queryset filtering + object-level permissions. Default rule: users see/edit only their own rows (`obj.user == request.user`). Specific cross-access rules to port (from migration analysis):
  - `pwa_settings`: **public read**, admin write.
  - `certificates`: owner read only; public access only through `verify_certificate` by high-entropy code.
  - `lp_market_listings`: owner investor sees own; **approved LPs** can see `status=listed` and purchase.
  - `secondary_market_listings`: `status=listed` public-ish read + own; seller-only updates.
  - `withdrawal_requests`: user may update only while `status=pending`; status transitions to `processing/completed` are **service-role only**.
  - Service-role inserts (wallets, tokens, transactions, certificates, OTPs, card transactions) → **trusted service-layer**, never user-writable serializers.
  - `realtime.messages`/private channels → per-user topic isolation (relevant if implementing WebSockets).
- **KYC gate:** custom permission so wallet creation requires `UserKYC.status='approved'`.
- **Protected routes:** the frontend currently guards nothing at the router — the backend must not assume the client enforces auth. Every non-public endpoint must enforce `IsAuthenticated` + object permissions server-side. Public endpoints: marketing/legal content, property browse, `certificates/verify`, `pwa-settings` read.

---

## 6. PAYMENTS & THIRD-PARTY

### 6.1 Payment methods in the checkout UI

All method panels in `PaymentMethodSelector.tsx` are **cosmetic** — `Checkout.handleConfirmPayment` only sends `payment_method: <label string>` to `process-investment`; **no method-specific data is transmitted, and nothing is ever charged** (`process-investment/index.ts:227-232` marks the investment paid immediately).

| Method | File | Collects | Real? | Provider implied / needed |
|---|---|---|---|---|
| **Card** | `methods/CardPaymentForm.tsx` | PAN, expiry, CVV, name (Zod-validated, brand auto-detect); **"Demo Mode" banner** | No (stays local) | **Stripe / Checkout.com / Adyen** with PCI tokenization — none present |
| **Apple Pay** | `methods/ApplePayButton.tsx` | nothing; UA sniff | No (no onClick) | Apple Pay JS / PaymentRequest API + PSP |
| **Google Pay** | `methods/GooglePayButton.tsx` | nothing; UA sniff | No (no onClick) | Google Pay API + PSP |
| **Crypto** | `methods/CryptoPayment.tsx` | BTC/ETH/USDT/USDC choice; **hardcoded rates** + **static wallet address** `0x7a23…f3a4`; placeholder QR | No (clipboard only) | Coinbase Commerce / BitPay, or per-order address generation + chain monitoring |
| **Pronova** | `methods/PronovaPayment.tsx` | nothing; **mock 10,000 PNOVA balance** + fake wallet; mandatory pledge notice; **real 5% discount** applied to `finalAmount` | No (balance mocked) | Pronova/Nova Finance token-balance ledger + custodial transfer; legal pledge/mortgage workflow |
| **Sukuk** | `methods/SukukPayment.tsx` | Sukuk id/issuer/value/validity + file upload (**faked filename**) | No (local state machine) | Document-upload + Sharia-compliance review workflow |
| **Saved cards** | `methods/SavedCards.tsx` + `useSavedCards.ts` | selects stored card metadata | **Partial real** (CRUD on `payment_methods`) — **not shown in checkout** | External card vault holds real token; DB stores only brand/last4/expiry |

**Implication:** every payment path requires a real PSP integration that does not exist. Card/wallet methods need PCI-compliant tokenization (raw PAN must never hit the Django server). Pronova and Sukuk are **bespoke**: a token-ledger transfer and a compliance-review intake respectively. The **5% Pronova discount** is real business logic (`Checkout.tsx:153-154`) and must be enforced server-side.

### 6.2 Other external integrations

- **Object storage** (3 private buckets: `certificates`, `lp-documents`, `owner-documents`) → S3/MinIO or Django storage + signed/authenticated downloads.
- **Email** — required for: auth verification & password reset (Supabase did this), withdrawal OTP delivery (**TODO in edge function**), notifications. Needs SES/SendGrid/SMTP + Celery.
- **SMS / OTP** — withdrawal OTP currently email-less and returns `dev_code`; production needs Twilio/SNS.
- **PDF generation** — certificate rendering (was `pdf-lib`; Django → ReportLab/WeasyPrint) + real **QR code** generation.
- **Blockchain** — entirely **mocked** (random addresses, random `tx_hash`/`block_number`). If real tokenization is intended, an actual chain/custody integration is a major net-new workstream; otherwise keep the custodial-ledger simulation but make it consistent.
- **OAuth providers** — Google, Apple (Microsoft available via the Lovable wrapper).
- **PWA** — `manifest`/install prompt driven by `pwa_settings` (admin-editable); `public/` assets + service worker (frontend concern, backend just serves settings).

---

## 7. GAP ANALYSIS

### 7A. Features present in FRONTEND but MISSING any backend → must be built fresh

1. **Property catalogue (P0).** Entire marketplace/property domain is static `src/data/properties.ts`. No `properties` table. Drives Marketplace, ProductCategory, FundedProperties, PropertyDetail, Checkout, Index featured. **Largest single build.** (See §3.1 for full shape.)
2. **Investor dashboard & portfolio holdings.** `Dashboard.tsx`/`Portfolio.tsx` hardcode KPIs, holdings, activity, allocation, upcoming distributions, even the user's name ("Mohamed Ahmed").
3. **Distributions.** No distributions engine or table; `Distributions.tsx` fully mock.
4. **Installment plans (investor).** `Installments.tsx` mock; "Pay Now" local-only.
5. **Investor secondary market.** `SecondaryMarket.tsx` mock order book / listings / trades — separate from the LP-only real schema.
6. **Wallet balances & transactions (investor & owner).** Payment-method *primitives* are real, but every wallet/portfolio/owner-wallet **balance & ledger** is hardcoded — the balance/ledger service tying primitives together is missing.
7. **Reports & Documents (investor) + Public reports/analytics.** `Reports.tsx`, `Documents.tsx`, `PublicReports.tsx`, `PublicAnalytics.tsx` all mock; no report/file storage.
8. **Notifications.** `Notifications.tsx` mock; read/delete local; no settings persistence.
9. **Broker domain (entire).** `BrokerDashboard`, `Listings`, `Referrals`, `Commissions` — zero backend (referral codes, leads, conversions, commission accrual/payout).
10. **Owner domain (most).** `OwnerDashboard`, `OwnerReports`, `OwnerWallet` mock; `SubmitProperty` has **no submit handler** (only `OwnerDocuments` is real).
11. **Onboarding / KYC intake.** `Onboarding.tsx` collects role/tier/personal-info/docs/agreements/2FA but **persists nothing** — critical compliance gap. (`user_kyc` status table exists but document upload + review workflow does not.)
12. **Partners.** `Partners` directory and `StrategicPartners` deliverable workflow — no backend.
13. **Reinvestment execution & `availableReturns`.** History table exists; execution + available-returns computation missing (hardcoded `5000`).
14. **Real payments (all methods).** See §6 — nothing charges.
15. **Email/SMS delivery** for OTP, verification, notifications.
16. **Marketing-config (optional):** institutional tiers, IR KPIs/press — currently inline.

### 7B. Supabase tables/functions ORPHANED (never used by frontend) → candidates to drop

Cross-referencing the schema (`types.ts`) against all frontend `.from()/.rpc()` calls:

- **No fully-orphaned application table found** — every table in `types.ts` is referenced by at least one hook/page. (`secondary_market_listings` *is* used, but only by the LP flow `LPMarket.tsx`/`ExitsHub.tsx`, **not** by the investor `SecondaryMarket.tsx` — see 7C.)
- **`profiles.avatar_url`** — defined but no upload path in the UI (Settings profile is mock). Low-value; keep but unused initially.
- **`pwa_settings`** — used (read) but write is admin-only and there's no admin UI beyond `Settings`/`PWASettingsSection`; carries forward into Django admin naturally.
- **The unwired `handle_new_user` function** — exists but attached to no trigger (`…175730` dropped the trigger). Do **not** port as-is; reimplement as registration logic (§4.3).
- **`verify_certificate` early definition** (`…034538`) superseded by `…034759` — port only the **latest** definition.

> Net: there is little to *drop* — the schema is lean. The work is overwhelmingly **net-new** (7A), not cleanup.

### 7C. DISCREPANCIES where frontend and old schema disagree → decision needed

1. **Two secondary markets.** Investor `SecondaryMarket.tsx` is a full order-book/bid-ask UI (mock) while the schema only has one-shot `secondary_market_listings`/`lp_market_listings` (used by LP pages). **Frontend wins** → design a unified secondary-market service with listings **and** order book/trade matching. *Decision:* unify or keep two distinct markets (LP vs investor)?
2. **`admin` role not in `profiles.role` CHECK.** RLS for `pwa_settings` references `role='admin'` but the `profiles.role` CHECK only allows `investor|owner|broker` (`…010243:7`). Frontend `Settings.tsx` gates on `role='admin'`. **Frontend wins** → include `admin` in the role set (or map to Django `is_staff`).
3. **Role selection at signup is discarded.** `RegisterRole` lets users pick developer/lp/partner etc., but signup forces `investor`. *Decision:* which personas are self-selectable vs admin-granted vs application-based (LP already uses an *application* table)? (See §8.)
4. **Property identity.** Frontend properties use short string ids ("1","10","p1-a"); investments store `property_id` as a free string with denormalized `property_name`. **Frontend wins** but the new `Property` model should have a stable pk and investments should FK to it (the current denormalized string is a reference smell to fix).
5. **`property_location` / SPV / fees hardcoded server-side.** `process-investment`/`generate-certificate` hardcode `"Dubai, UAE"`, `platform_fee=0`, `spv_name='<name> SPV Ltd'`. Frontend Checkout computes real fees (1.5% platform + 0.5% mgmt, `Checkout.tsx:39-40`) and PropertyDetail shows real SPV records. **Frontend wins** → fees & SPV must come from the Property/SPV models, not constants.
6. **Token economics.** Frontend assumes **$100/token** and **1000 tokens/property** (`Checkout.tsx:178` ownership = units/1000×100); schema stores `price_per_token`/`ownership_percentage` per-investment without a property-level supply. **Frontend wins** → Property needs `token_supply`/`token_price` so ownership % is derived server-side, not client-assumed.
7. **Family `demo` fallbacks.** `FamilyInvestment.tsx` shows `demoFamilyMembers`/`demoBankAccounts` when logged-out/empty and some handlers are toast-only. **Frontend wins** → real CRUD must back all of it (schema already supports it).
8. **Wallet balance source of truth.** UI shows fake balances while `wallet_balances`/`spend_with_card`/`topup_wallet` are the real ledger. **Frontend wins on what to display**, but the balance must come from the ledger, and distributions/investments must post to it (no such posting exists today).
9. **No route protection vs. protected data.** Frontend renders sensitive pages publicly; only RLS/edge functions protect data. **Backend must enforce auth server-side regardless** — do not trust the client (§5).

---

## 8. OPEN QUESTIONS (human decisions required before build)

1. **Personas & signup:** Which roles are self-selectable at registration (investor only?), which are application-based (LP already is), and which are admin-granted (owner, broker, partner, admin)? Should developer/partner become first-class roles or stay out-of-band?
2. **Real payments:** Which PSP(s) for cards (Stripe/Checkout.com/Adyen)? Are Apple/Google Pay in scope for v1? Who provides crypto settlement (Coinbase Commerce vs. on-chain addresses)? Is the **simulated "always paid"** behavior acceptable for an interim launch, or must real charging land first?
3. **Pronova / Sukuk:** What exactly are these? Pronova ("Nova Finance") appears to be a partner token with a pledge/mortgage legal flow and a 5% discount — confirm the ledger, custody, and legal workflow. Sukuk needs a compliance-review process owner.
4. **Blockchain reality:** Is tokenization **actually on-chain** or a **custodial ledger simulation**? This determines whether wallet/token/tx are real integrations or internal bookkeeping (currently all mocked).
5. **Property model ownership:** Are properties admin-created (Django admin) only, or do owners submit (via `SubmitProperty`) into a review→publish pipeline? Confirm the SPV, token-supply, fee-schedule, and data-room document model per property.
6. **Distributions engine:** How are rental/appreciation distributions computed and scheduled (per property model: rental %, phasing re-pricing, future/option settlement, shared-ownership splits)? Who triggers them (admin/cron)?
7. **Secondary market design:** Order-book with matching (as the investor UI implies) or simple listings (as the LP schema implies)? Unified or two markets? Fee model (schema has `platform_fee_percent` default 1%).
8. **Installments:** Confirm the per-investor installment lifecycle (down payment, monthly schedule, ownership accrual, missed-payment handling) — frontend shows it but no schema backs investor installments.
9. **KYC/KYB provider:** Manual admin review, or integrate a vendor (Onfido/Sumsub/Jumio)? What documents per persona, and what gates (wallet creation is one; what else)?
10. **Realtime:** Supabase used `postgres_changes` channels (certificates, ownership_tokens, lp_holdings, lp_market_listings, visa cards). Replace with WebSockets (Django Channels), SSE, or client polling? Affects infra choice.
11. **Bilingual content:** Domain entities carry `*_ar` fields (properties, phases, etc.). Confirm admins maintain both EN/AR, and whether other entities (reports, notifications, distributions) also need Arabic.
12. **Email/SMS providers:** Which services for transactional email and OTP SMS? Required before withdrawals/notifications/verification work.
13. **Fees & token economics:** Confirm platform fee (1.5%) + management fee (0.5%) + LP/secondary fee (1%), token price ($100), and tokens-per-property (UI assumes 1000) as authoritative business rules to enforce server-side.
14. **Family sub-accounts:** Are family members real logins, delegated access, or pure record-keeping? Affects auth design (currently record-keeping under the investor).
15. **Data migration:** Is there production Supabase data to migrate, or is this a greenfield cutover? (Affects whether models must preserve existing UUIDs/string property_ids.)
16. **Admin scope:** Confirm Django admin is the *sole* admin surface for all personas' back-office needs (LP/KYB approval, certificate revocation, property publishing, withdrawal processing, distribution runs, broker/owner management).

---

*End of BACKEND_SPEC.md — analysis only; no code was written or modified.*
