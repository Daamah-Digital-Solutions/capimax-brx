# Secondary-Market Surface Map (READ-ONLY investigation)

**Purpose:** Map the exact reality of BOTH secondary-market surfaces in Capimax BRX before the
next wave builds the secondary market, and decide **unify vs. keep two** (BACKEND_SPEC §7C.1).
Frontend is the source of truth. Every claim is cited `file:line`. **Nothing was changed.**

**TL;DR:** There are **two genuinely different products**, not a duplicate:
1. **LP Market** — a *working* one-shot-listing flow (Supabase `lp_market_listings` + `lp_holdings`)
   where **investors exit by selling whole listings to approved LPs** for an **instant fill at 1%**.
2. **Investor Secondary Market** — a **100% mock** order-book UI (bids/asks/trades) at **0.5%**, with
   **no backend at all**; the real `secondary_market_listings` table it *should* use is actually
   written only by the LP resale flow, not by this page.

Recommendation (full reasoning in §4): **keep two distinct markets on a shared settlement core**,
build the investor market as **simple one-shot listings first** (matches the real schema + 2 of the
3 pages), and defer the bid/ask **order book / matching engine** to a later phase. The hard,
cross-cutting part for both is **on-chain token settlement, which does not exist yet** (the chain
layer has `mint` but **no transfer** — `apps/chain/service.py:263` mint, `:251` read_balance, no transfer).

---

## 1. THE LP MARKET (real in the old schema)

### 1.1 `useLPMarket.ts` — data operations, shapes, actions
Source: [src/hooks/useLPMarket.ts](src/hooks/useLPMarket.ts)

**Tables:** Supabase `lp_market_listings` (read/insert/update). Realtime subscription on the whole
table ([useLPMarket.ts:59-72](src/hooks/useLPMarket.ts)).

**Shape `LPMarketListing`** ([useLPMarket.ts:7-28](src/hooks/useLPMarket.ts)):
`id, investor_id` (the **seller**), `lp_id` (the **buyer**, nullable until purchased),
`property_id, property_name, token_symbol, token_amount, unit_price, total_value,
platform_fee_percent, platform_fee_amount, net_amount,
status (listed|pending|completed|cancelled|expired), listed_at, purchased_at, completed_at,
cancelled_at, notes, created_at, updated_at`.

**Read model** ([useLPMarket.ts:79-113](src/hooks/useLPMarket.ts)):
- `myListings` = `lp_market_listings WHERE investor_id = me` (a seller sees their own).
- `listings` = `lp_market_listings WHERE status='listed' AND investor_id != me` — **only fetched if
  `isApprovedLP`** ([useLPMarket.ts:97-107](src/hooks/useLPMarket.ts)). So **only approved LPs see the
  buyable inventory**. `isApprovedLP = lpProfile?.status === "approved"` ([useLPMarket.ts:46](src/hooks/useLPMarket.ts)).

**Actions:**
- `listAssetForSale(data)` ([useLPMarket.ts:115-155](src/hooks/useLPMarket.ts)) — **any logged-in user**
  (the seller/investor) inserts a listing. `unit_price` defaults to **100**, `feePercent = 1`,
  `feeAmount = total*1%`, `net = total - fee`, `status='listed'`
  ([useLPMarket.ts:120-141](src/hooks/useLPMarket.ts)).
- `cancelListing(listingId)` ([useLPMarket.ts:157-185](src/hooks/useLPMarket.ts)) — seller-scoped
  update `status='cancelled'`, `eq("investor_id", user.id)`.
- `purchaseAsset(listingId, paymentMethod="lp_balance")` ([useLPMarket.ts:187-249](src/hooks/useLPMarket.ts)):
  - Guard: **must be approved LP** ([useLPMarket.ts:192-194](src/hooks/useLPMarket.ts)).
  - Pays from **LP balance**: rejects if `listing.total_value > lpProfile.current_balance`
    ([useLPMarket.ts:201-204](src/hooks/useLPMarket.ts)).
  - Updates the listing → `status='completed', lp_id, purchased_at, completed_at`, guarded on
    `status='listed'` ([useLPMarket.ts:208-219](src/hooks/useLPMarket.ts)).
  - Inserts a row into **`lp_holdings`** (`status='held'`) ([useLPMarket.ts:222-239](src/hooks/useLPMarket.ts)).

**Model = one-shot listings.** The entire `token_amount` is sold as a single unit; the buyer takes
the whole listing. **No partial fills, no bids, no price matching.** Who lists: **any investor**
(their own ownership tokens) or an LP reselling a holding. Who buys: **approved LPs only**.

### 1.2 `useLPHoldings.ts` — where `lp_holdings` comes from
Source: [src/hooks/useLPHoldings.ts](src/hooks/useLPHoldings.ts)

**Shape `LPHolding`** ([useLPHoldings.ts:7-23](src/hooks/useLPHoldings.ts)):
`lp_id, listing_id (nullable), property_id, property_name, token_symbol, token_amount,
purchase_price, current_value, purchase_date, status (held|listed_lp|listed_secondary|sold),
listed_at, sold_at`.

**Lifecycle of a holding:** an LP **acquires** a holding by calling `purchaseAsset` — that insert is
the only producer of `lp_holdings` rows ([useLPMarket.ts:222-234](src/hooks/useLPMarket.ts)). The hook
also exposes `recordPurchase` ([useLPHoldings.ts:87-123](src/hooks/useLPHoldings.ts)) and
`updateHoldingStatus` ([useLPHoldings.ts:125-149](src/hooks/useLPHoldings.ts)) to flip a holding to
`listed_lp` / `listed_secondary` / `sold`. Realtime on `lp_holdings`
([useLPHoldings.ts:44-58](src/hooks/useLPHoldings.ts)).

So the lifecycle is: **investor mints ownership tokens (Phase 3, on-chain) → investor lists on LP
Market → approved LP buys → LP gets an `lp_holdings` row → LP may resell** (to LP market or secondary).

### 1.3 `LPMarket.tsx` — the UI
Source: [src/pages/LPMarket.tsx](src/pages/LPMarket.tsx)

Three view modes ([LPMarket.tsx:32-63](src/pages/LPMarket.tsx)):
- **investor — "Sell My Assets"** ([LPMarket.tsx:293-302](src/pages/LPMarket.tsx)): lists the user's
  **on-chain ownership tokens** (`tokens` from `useOwnershipTokens(wallet?.id)`,
  [LPMarket.tsx:47-48](src/pages/LPMarket.tsx)) via `InvestorAssetsView` → `onListAsset=listAssetForSale`.
  Banner: **"Platform Fee: Only 1%"**, *"available to approved LPs for instant purchase. Execution
  guaranteed!"* ([LPMarket.tsx:263-269](src/pages/LPMarket.tsx)).
- **marketplace — "LP Marketplace"** (approved-LP only) ([LPMarket.tsx:304-313](src/pages/LPMarket.tsx)):
  `LPMarketplaceView` lists buyable inventory → `onPurchase=purchaseAsset`, shows **LP Balance**.
- **holdings — "My Holdings"** (approved-LP only) ([LPMarket.tsx:315-322](src/pages/LPMarket.tsx)):
  `LPHoldingsView` → `onResale=handleResale`.

**`handleResale(holdingId, target, price)`** ([LPMarket.tsx:76-153](src/pages/LPMarket.tsx)) is the only
place that **bridges the two markets**: `target==="lp"` inserts into `lp_market_listings` with
**`feePercent = 1`** ([LPMarket.tsx:89-109](src/pages/LPMarket.tsx)); `target==="secondary"` inserts into
**`secondary_market_listings`** with **`seller_type:"lp"`** and **`feePercent = 0.5`**
([LPMarket.tsx:111-134](src/pages/LPMarket.tsx)), then flips the holding to `listed_lp`/`listed_secondary`.

**It is a simple listings UI, not an order book.** Post an offer → someone buys it whole.

### 1.4 `ExitsHub.tsx` — the seller's cross-market dashboard
Source: [src/pages/ExitsHub.tsx](src/pages/ExitsHub.tsx)

Reads **both** tables for the current seller and shows them in two tabs:
`lp_market_listings WHERE investor_id=me` and `secondary_market_listings WHERE seller_id=me`
([ExitsHub.tsx:45-48](src/pages/ExitsHub.tsx)). Can **cancel** either
([ExitsHub.tsx:56-67](src/pages/ExitsHub.tsx)). The two products are explicitly framed:
- **"Instant LP Exit"** — *"Instant fill · 1% fee · settlement in minutes"* ([ExitsHub.tsx:122-129](src/pages/ExitsHub.tsx)).
- **"Peer Secondary Market"** — *"Higher net proceeds · 0.5% fee · awaits a buyer"* ([ExitsHub.tsx:131-141](src/pages/ExitsHub.tsx)).

This is the clearest product statement in the codebase: **two deliberately different exit lanes** —
pay 1% for instant LP liquidity, or 0.5% but wait for a peer buyer.

---

## 2. THE INVESTOR SECONDARY MARKET (mock)

### 2.1 `SecondaryMarket.tsx` — what it renders
Source: [src/pages/SecondaryMarket.tsx](src/pages/SecondaryMarket.tsx). Route `/secondary-market`
([src/App.tsx:89](src/App.tsx)).

**It is a full ORDER BOOK UI, and it is 100% local mock.** Every data structure is an inline `const`:
- `marketListings` ([SecondaryMarket.tsx:32-78](src/pages/SecondaryMarket.tsx)) — browse cards
  (`units, askingPrice, originalPrice, change, holdingPeriod, distributions, seller, status`).
- `myListings` ([SecondaryMarket.tsx:80-92](src/pages/SecondaryMarket.tsx)) — `views, offers, createdAt`.
- `tradeHistory` ([SecondaryMarket.tsx:94-98](src/pages/SecondaryMarket.tsx)) — `units, price, type
  (buy|sell), date, status`.
- **`orderBook`** ([SecondaryMarket.tsx:100-113](src/pages/SecondaryMarket.tsx)) — `bids: [{price, units}…]`
  and `asks: [{price, units}…]` — **explicit bid/ask depth levels**.
- `userHoldings` ([SecondaryMarket.tsx:116-120](src/pages/SecondaryMarket.tsx)) — for the sell modal.

**Rendered features:** market stats (24h volume, total listings, avg/high/low price)
([SecondaryMarket.tsx:208-213](src/pages/SecondaryMarket.tsx)); browse listings with **"Buy Now"**
([SecondaryMarket.tsx:322-324](src/pages/SecondaryMarket.tsx)); a **Create Order** panel with buy/sell
toggle, units, price-per-unit, fee preview, **Confirm Buy/Confirm Sell**
([SecondaryMarket.tsx:334-417](src/pages/SecondaryMarket.tsx)); an **Order Book** with asks, a **mid-price/
spread**, and bids ([SecondaryMarket.tsx:420-469](src/pages/SecondaryMarket.tsx)); a trade-history table
([SecondaryMarket.tsx:504-543](src/pages/SecondaryMarket.tsx)); a **Sell My Units** modal.

**Backend calls: NONE.** The only "action" is `handleSubmitSellOrder`
([SecondaryMarket.tsx:154-171](src/pages/SecondaryMarket.tsx)) which does
`await new Promise(resolve => setTimeout(resolve, 1500))` then a success toast — a pure simulation.
"Buy Now", "Confirm Buy/Sell", filters, and search have **no handlers**. **No Supabase, no Django.**

**Fee here is 0.5%** ([SecondaryMarket.tsx:173](src/pages/SecondaryMarket.tsx): `sellUnits * sellPrice *
0.005`; preview text "Platform Fee (0.5%)" [SecondaryMarket.tsx:405](src/pages/SecondaryMarket.tsx)).

### 2.2 Order book or simpler? — **Full order book (implied), but unbacked**
The UI implies bid/ask **price discovery** (`orderBook.bids/asks` at multiple price levels), a
**mid-price/spread** ([SecondaryMarket.tsx:444-448](src/pages/SecondaryMarket.tsx)), buy **and** sell
order entry, and **trade history** — i.e. an exchange. But there is **no matching engine, no partial
fills logic, no persistence** anywhere; it's a visual mock of an order book. Confirmed by SPEC:
> "the investor `SecondaryMarket.tsx` additionally implies an **order book** (bids/asks) and **trade
> history** that have **no schema**" ([BACKEND_SPEC.md:351](BACKEND_SPEC.md)); "Secondary-market order
> matching / order book … only LP one-shot listings exist" ([BACKEND_SPEC.md:434](BACKEND_SPEC.md)).

### 2.3 Endpoints/shapes it would need if made real
None today. To make `SecondaryMarket.tsx` real you would need (new, from scratch):
`POST /api/secondary-market/orders/` (place bid/ask), `GET …/orderbook/?property=` (aggregated
depth), `GET …/orders/?me` (my open orders), `DELETE …/orders/{id}/` (cancel),
`GET …/trades/?property=` (trade history), plus a **matching engine** producing `Trade` rows and a
settlement step. SPEC calls out the missing `Order` / `Trade` models
([BACKEND_SPEC.md:351](BACKEND_SPEC.md), §7A.5 [BACKEND_SPEC.md:434](BACKEND_SPEC.md)).

### 2.4 Is `secondary_market_listings` used by the frontend?
**Yes — but NOT by `SecondaryMarket.tsx`.** It is written by the **LP resale** flow
([LPMarket.tsx:116-133](src/pages/LPMarket.tsx)) and read/cancelled by **ExitsHub**
([ExitsHub.tsx:47,63](src/pages/ExitsHub.tsx)). Grep confirms only three references in `src/`:
`LPMarket.tsx`, `ExitsHub.tsx`, and `types.ts` (the type defs). SPEC confirms:
> "`secondary_market_listings` *is* used, but only by the LP flow … **not** by the investor
> `SecondaryMarket.tsx`" ([BACKEND_SPEC.md:530](BACKEND_SPEC.md)).

So the **real `secondary_market_listings` table is a one-shot listing model** (exactly like
`lp_market_listings`), while the **investor page that bears the "secondary market" name implements an
order book that doesn't touch it**. That gap *is* the §7C.1 discrepancy.

---

## 3. THE RELATIONSHIP / OVERLAP

### 3.1 Same asset, different counterparties
Both markets trade the **same thing**: **ownership tokens of a property** (`property_id,
token_symbol, token_amount`) — the BSC `PropertyToken` minted in Phase 3. They differ by **who trades
with whom** and **execution model**:

| | **LP Market** | **Investor Secondary Market** |
|---|---|---|
| Schema (real) | `lp_market_listings` + `lp_holdings` | `secondary_market_listings` (used by LP resale only) |
| Investor page | `LPMarket.tsx` (real) | `SecondaryMarket.tsx` (**mock**) |
| Seller | any investor; or LP reselling | investor (UI); `seller_type` ∈ investor\|lp (schema) |
| Buyer | **approved LP only** ([useLPMarket.ts:192](src/hooks/useLPMarket.ts)) | peer investor (UI); `buyer_type` (schema, nullable) |
| Execution | **one-shot listing, instant fill** | **order book / bid-ask** (implied, mock) |
| Settlement of cash | from **LP balance** ([useLPMarket.ts:201](src/hooks/useLPMarket.ts)) | none (mock) |
| **Fee** | **1%** ([useLPMarket.ts:122](src/hooks/useLPMarket.ts), [ExitsHub.tsx:128](src/pages/ExitsHub.tsx)) | **0.5%** ([SecondaryMarket.tsx:173](src/pages/SecondaryMarket.tsx), [LPMarket.tsx:112](src/pages/LPMarket.tsx), [ExitsHub.tsx:139](src/pages/ExitsHub.tsx)) |
| Liquidity promise | "instant · guaranteed execution" | "higher net · awaits a buyer" |

### 3.2 Is it "investor→LP exits" vs "investor↔investor"? — **Yes, and they don't duplicate**
- **LP Market = investors exit by selling to LPs** (and LPs provide instant liquidity from their
  balance). The LP is a market-maker/principal buyer.
- **Investor Secondary Market = investors trade with each other** (peer order book, no LP guarantee).
- They **overlap only on the asset**, not on counterparties or execution. `ExitsHub` deliberately
  presents them as **two lanes of the same decision** ("exit now via LP at 1%" vs "list peer at
  0.5% and wait"). This is a **product feature, not accidental duplication.**

### 3.3 Fees — **two different fee models on purpose**
- LP exit: **1%** (premium for instant, guaranteed fill).
- Peer secondary: **0.5%** (cheaper, but you wait for a buyer).
- The schema default is `platform_fee_percent = 1` ([BACKEND_SPEC.md:346,350](BACKEND_SPEC.md)), but both
  frontends **override** it per-market (1% vs 0.5%). **Frontend wins → the fee is per-market, not a
  single default.**

### 3.4 On-chain settlement vs the tokens — **THE HARD PART; nothing settles on-chain today**
- Ownership tokens are **real on-chain** (Phase 3 mints `PropertyToken` to the buyer's custodial
  wallet on BSC Testnet; `apps/chain/service.py:263` `mint`).
- **The chain layer has NO transfer function** — only `mint` ([apps/chain/service.py:263](backend/apps/chain/service.py))
  and `read_balance` ([apps/chain/service.py:251](backend/apps/chain/service.py)). `WalletTransaction`
  already anticipates a `"transfer"` type ([apps/wallets/models.py:158](backend/apps/wallets/models.py))
  but **no service implements it.**
- **Today both markets are ledger-only, and the LP one is internally inconsistent:** `purchaseAsset`
  marks the listing `completed` and inserts an `lp_holdings` row, but **never moves the seller's
  on-chain tokens to anyone** ([useLPMarket.ts:206-239](src/pages/useLPMarket.ts)) — the seller still
  holds the tokens on-chain, the LP holds a DB row. There is also no debit of the seller's
  `ownership_tokens`. **This is a latent correctness bug that any "make it real" must fix.**
- **A real sale requires a new on-chain settlement service:** transfer `PropertyToken` from the
  seller's custodial wallet → the buyer's custodial wallet on BSC, signed with the **seller's
  custodial key** (we are custodial, so we can sign), **gated on the payment leg**, **idempotent** —
  structurally identical to the Phase-3 mint pattern. Plus the **payment leg** (buyer pays seller:
  LP balance for LP market; a PSP or LP/cash ledger for the peer market) and a **token-supply
  invariant** (don't let a seller list more than they hold; ideally **escrow/lock** the tokens while
  listed). This is the same custodial-key + idempotency + signature discipline already used for
  minting and for the Phase-5 payment webhooks.

### 3.5 Backend state today
`apps/secondary_market/models.py` is an **empty stub**
([backend/apps/secondary_market/models.py](backend/apps/secondary_market/models.py)); the LP market /
holdings models were **not** built in Phase 6 Wave 1 (only LP onboarding) — the LP market is still
Supabase-only on the frontend. So **both markets are unbuilt on Django.**

---

## 4. RECONCILIATION OPTIONS (analysis)

### Option A — UNIFY (one secondary-market service: listings + order book, both audiences)
Build one `apps/secondary_market` service with a single `Listing`/`Order` model serving investors and
LPs, with an order book + matching engine, parameterized by participant type and fee.

- **What it takes:** unified `Order`/`Trade`/`Listing` models; a **matching engine** (price-time
  priority, partial fills, spread/mid); order-book aggregation endpoints; settlement service
  (on-chain transfer + payment); migrate `lp_market_listings`/`lp_holdings`/`secondary_market_listings`
  into the unified model; rewrite `useLPMarket`, `useLPHoldings`, `SecondaryMarket.tsx`, `ExitsHub` to
  one API; reconcile the **1% vs 0.5%** fee and the **LP-balance vs peer-cash** settlement as
  config/branches inside one engine.
- **Frontend changes:** large. `LPMarket.tsx` (one-shot) and `SecondaryMarket.tsx` (order book) have
  **different interaction models**; unifying forces one of them to change shape, which **breaks the
  "frontend is source of truth"** rule for whichever loses.
- **On-chain:** one settlement path (good), but it must serve both instant-fill (LP) and
  matched-trade (order book) — more complex than either alone.
- **Pros:** single codebase, single fee/settlement engine, no duplicate listing logic.
- **Cons:** highest effort and risk; builds a **matching engine before there is any liquidity**;
  conflates two **different products** the frontend deliberately separates (ExitsHub's "1% instant" vs
  "0.5% peer"); the order-book half is **100% greenfield** so there is nothing to "wire", only to
  invent.

### Option B — KEEP TWO (distinct domains, shared settlement core) — *recommended shape*
Keep the **LP Market** (one-shot listings, investor→LP, 1%, LP-balance settlement) and the
**Investor Secondary Market** (peer, 0.5%) as separate domains that **share** a small settlement +
listing core (on-chain transfer service, fee/`net_amount` computation, KYC gate, `ExitsHub` read).

- **What it takes:**
  - **LP Market = mostly *wire existing*.** The Supabase flow already works end-to-end
    (`lp_market_listings` + `lp_holdings`, list/cancel/purchase). Port it to Django `apps/lp` (market
    sub-domain): `LPMarketListing` + `LPHolding` models, `GET/POST /api/lp/market/`, `…/{id}/cancel/`,
    `…/{id}/purchase/` (gated on `HasActivatedLP`, already built in Wave 1), repoint `useLPMarket`/
    `useLPHoldings`. Behavior is known and small.
  - **Investor Secondary Market = build the *real schema* first, defer the order book.** Build
    `apps/secondary_market` `SecondaryMarketListing` (the table already exists in the schema and is
    **already written by LP resale + read by ExitsHub**) as **simple one-shot "buy-now" listings**:
    `GET/POST /api/secondary-market/`, `…/{id}/cancel/`, `…/{id}/purchase/`. Wire `ExitsHub` (which
    only needs list/cancel) immediately. Then make `SecondaryMarket.tsx` real by **starting with a
    buy-now listings view** (the schema supports it) and treating the **bid/ask order book + matching
    engine as a clearly-scoped Phase 2** (it is the only fully-greenfield, high-risk piece).
- **Frontend changes:** small for LP Market (repoint hooks, shapes unchanged) and for ExitsHub.
  `SecondaryMarket.tsx`'s order-book section is the only place that changes materially — and only when
  the order book is actually built; a listings-first version preserves most of the page.
- **On-chain:** one shared transfer/settlement service used by both (build once).
- **Pros:** **honors frontend = source of truth** (ExitsHub explicitly models two lanes); LP Market is
  low-risk "wire existing"; ships investor liquidity **without** a matching engine; matches the real
  schema (2 of 3 pages already use one-shot listings); defers the hardest, unbacked piece behind a
  decision gate.
- **Cons:** two listing models with similar fields (mitigated by a shared base/abstract model + shared
  settlement service); the investor **order book** the mock implies is **postponed**, not delivered in
  the first cut (must be set as an explicit expectation with the product owner).

### On-chain settlement implication (applies to BOTH options)
Either way, a real trade needs **token transfer between custodial wallets** + a **payment leg**:
- **Recommended:** **real on-chain transfer** (consistency with the Phase-3 on-chain mint and the
  custodial model) via a new idempotent `transfer(token, from, to, amount)` chain service signed with
  the seller's custodial key, **gated on payment confirmation**, with the seller's tokens **escrowed/
  locked while listed** to preserve the supply invariant.
- **Pragmatic interim:** a **ledger-first** model (DB ownership move + a `reconciled=false` flag) could
  ship sooner, with on-chain transfer settled asynchronously — *but* it must **fix the current bug**
  where LP purchase moves nothing on-chain and doesn't debit the seller. Flag explicitly which model
  we ship; do **not** silently keep the ledger-only inconsistency.

### RECOMMENDATION
**Keep two distinct markets on a shared settlement core (Option B), and build the investor market as
simple one-shot listings first — defer the bid/ask order book + matching engine to a later phase.**

Reasoning, grounded in what the frontend actually implements:
1. **They are different products, per the frontend itself.** `ExitsHub` explicitly sells "instant LP
   exit @1%" vs "peer secondary @0.5%, awaits a buyer" ([ExitsHub.tsx:122-141](src/pages/ExitsHub.tsx)).
   Unifying contradicts the source of truth.
2. **LP Market is "wire existing"; the investor order book is "build from scratch."** The LP flow is a
   complete, working one-shot model ([useLPMarket.ts](src/hooks/useLPMarket.ts)); `SecondaryMarket.tsx`
   is 100% mock with no backend and no schema for orders/trades. Building a matching engine first is
   high-risk and premature (no liquidity yet).
3. **The real schema is one-shot listings.** `secondary_market_listings` is already written by LP
   resale and read by ExitsHub as a **listing** ([LPMarket.tsx:116](src/pages/LPMarket.tsx),
   [ExitsHub.tsx:47](src/pages/ExitsHub.tsx)); a listings-first investor market matches the data that
   already flows, and makes `ExitsHub` real immediately.
4. **Shared core avoids the only real downside of "two".** One on-chain settlement service + one fee/
   `net_amount` helper + one KYC gate + a shared abstract listing base removes the duplication risk
   while keeping the two products' UX intact.
5. **The order book remains on the roadmap** (frontend wins long-term) but as an explicit, separately-
   scoped phase once there is liquidity and a product decision on matching/price discovery.

---

## 5. OPEN QUESTIONS (product owner decisions before build)

1. **Unify vs two markets?** Recommendation: **keep two** (LP one-shot @1% investor→LP; investor peer
   market @0.5%) on a shared settlement core. Confirm.
2. **Investor market execution model:** **simple one-shot "buy-now" listings first** (matches schema +
   ExitsHub) with the **bid/ask order book + matching engine deferred** to a later phase — or insist on
   the full order book in the first cut? (The order book is 100% greenfield.)
3. **On-chain settlement vs ledger:** Do trades **transfer `PropertyToken` on-chain** between custodial
   wallets (recommended, consistent with Phase-3 mint), or ship a **ledger-only** model first with
   async on-chain reconciliation? Either way, **fix the current bug** where LP purchase moves no tokens
   and doesn't debit the seller ([useLPMarket.ts:206-239](src/pages/useLPMarket.ts)).
4. **Token custody while listed:** **Escrow/lock** the seller's tokens when a listing is created (to
   prevent double-selling / over-listing), or check-balance-at-settlement only?
5. **Fee model:** Confirm **1% LP exit** vs **0.5% peer secondary** (frontend overrides the schema's 1%
   default). Are these final, and who can waive/override?
6. **Who can trade with whom:** LP Market buyer = **approved LP only** (built gate `HasActivatedLP`) —
   confirm. For the peer market, is it **investor↔investor only**, or may LPs also list/buy there
   (`seller_type`/`buyer_type` allow both)? Any **KYC-approved** gate on peer sellers/buyers?
7. **Payment leg for the peer market:** LP Market settles from **LP balance**; how does a **peer** buyer
   pay the seller — a PSP charge (Stripe/NOW, like Phase 5), an internal cash/wallet ledger, or both?
   And how/when are **seller proceeds** (`net_amount`) credited and withdrawable?
8. **Realtime:** Supabase used `postgres_changes` on `lp_market_listings`/`lp_holdings`
   ([useLPMarket.ts:59](src/hooks/useLPMarket.ts), [useLPHoldings.ts:44](src/hooks/useLPHoldings.ts)).
   Replace with polling, SSE, or Django Channels for live order/listing updates?
9. **Cross-market consistency:** A holding can be flagged `listed_lp` **or** `listed_secondary`
   ([useLPHoldings.ts](src/hooks/useLPHoldings.ts)). Can the same tokens be listed on **both** markets at
   once (double-listing risk), or is a listing **exclusive** until cancelled/sold?

---

*Investigation only — no code changed. Pages: `/secondary-market` ([App.tsx:89](src/App.tsx)),
`/lp-market` ([App.tsx:128](src/App.tsx)), `/exits-hub` ([App.tsx:130](src/App.tsx)). Backend
`apps/secondary_market` and the LP market models are unbuilt stubs.*
