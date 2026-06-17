# DISTRIBUTIONS_SURFACE.md — read-only investigation

**Scope:** READ-ONLY. Nothing changed. Goal: map the existing distributions surface (frontend mock + backend seams) so the distributions engine can be designed to match the frontend (source of truth) and reuse the existing balance stack.

---

## 1. FRONTEND — what `Distributions.tsx` shows the investor

File: [Distributions.tsx](src/pages/Distributions.tsx). **100% static mock — no API, no hook, no fetch.** Two hardcoded arrays (`distributions`, `propertyDistributions`) + a `distributionStats` literal drive the whole page; the only state is two client-side filters. There is **no `useDistributions*` hook** (grep of `src/hooks` found only [useOwnershipTokens.ts](src/hooks/useOwnershipTokens.ts), which is unrelated — it lists holdings, never distributions).

**The shape the UI implies a distribution IS** — a periodic cash yield paid to a token holder, per property:

| Field (mock) | file:line | Meaning |
|---|---|---|
| `amount` | [Distributions.tsx:37](src/pages/Distributions.tsx#L37) | USD paid to this investor for this period (rendered `+$X`, success-green — a credit) |
| `property` / `propertyId` | [Distributions.tsx:37](src/pages/Distributions.tsx#L37) | which property generated it |
| `type` | [Distributions.tsx:37](src/pages/Distributions.tsx#L37) | cadence: `"monthly"` \| `"quarterly"` |
| `period` (Ar/En) | [Distributions.tsx:37](src/pages/Distributions.tsx#L37) | human label, e.g. "Q4 2024" |
| `date` | [Distributions.tsx:37](src/pages/Distributions.tsx#L37) | pay date |
| `status` | [Distributions.tsx:37](src/pages/Distributions.tsx#L37) | `"paid"` \| `"pending"` \| `"scheduled"` |
| `yield` | [Distributions.tsx:37](src/pages/Distributions.tsx#L37) | annual % yield for the property |

**Totals** ([Distributions.tsx:27-34](src/pages/Distributions.tsx#L27)): `totalReceived`, `pendingAmount`, `nextPaymentDate`, `yearToDate`, `averageMonthly`, `propertiesDistributing`.

**Per-property roll-up** ([Distributions.tsx:44-49](src/pages/Distributions.tsx#L44)): `totalDistributed`, `annualYield`, `frequency`, `nextPayment`, `status` — three tabs: History / By Property / Upcoming Schedule.

**Implied model = rental/appreciation yield distributed periodically to holders, per property, as a cash credit.** Type is rental-style cadence (monthly/quarterly) — NOT a token transfer. The mock has no "appreciation" type; only periodic yield. (Note: `expected_yield` / `distribution_model` already exist on the Property model per [DECISIONS.md:749](DECISIONS.md#L749).)

---

## 2. BACKEND today

**`apps/distributions` is an empty stub** (confirmed):
- [models.py](backend/apps/distributions/models.py) — comment only, **zero models**.
- [admin.py](backend/apps/distributions/admin.py) — comment only.
- [apps.py](backend/apps/distributions/apps.py) — `DistributionsConfig`, label `"distributions"` (app is registered).
- `migrations/` — only `__init__.py`. No `views.py`, no `urls.py`, no `serializers.py`, no `services.py`.

**`OwnershipToken` has the two distribution fields but nothing writes them** — [wallets/models.py:129-130](backend/apps/wallets/models.py#L129):
```python
last_distribution_date = models.DateTimeField(null=True, blank=True)
total_distributions    = models.DecimalField(max_digits=16, decimal_places=2, default=0)
```
(grep across the repo: these names appear only in the model definition + DECISIONS.md narration — no service assigns them.)

**Holder ↔ property linkage** (how to compute pro-rata shares) — [wallets/models.py:111-130](backend/apps/wallets/models.py#L111):
- `OwnershipToken.wallet` → FK to `UserWallet`; `UserWallet.user` is a `OneToOneField` ([wallets/models.py:38](backend/apps/wallets/models.py#L38)) → **token → wallet → user**.
- `OwnershipToken.property_id` = **`Property.slug`** (CharField, [wallets/models.py:115](backend/apps/wallets/models.py#L115)).
- `token_amount` (whole shares) and `ownership_percentage` (computed from real `token_supply`, [wallets/models.py:127](backend/apps/wallets/models.py#L127)) are already maintained by the mint/settlement services.
- `UniqueConstraint(wallet, property_id)` ([wallets/models.py:141](backend/apps/wallets/models.py#L141)) → **one position row per holder per property** — so "current holders of property X" = `OwnershipToken.objects.filter(property_id=slug, status=ACTIVE)`, and each holder's pro-rata weight = `token_amount / Σ token_amount` (or the stored `ownership_percentage`).

---

## 3. THE MODEL of a distribution — does the proposed mental model match?

**Proposed:** owner/admin declares a distribution for a property (a money pool) → split **pro-rata** across current ACTIVE holders by ownership → each share **credits `UserBalance`** (reuse `credit_user_balance`) and bumps `total_distributions` + `last_distribution_date` on the holding.

**Match: YES.** The frontend renders each row as a per-investor, per-property, per-period **`+$amount` credit** with a status lifecycle — exactly what pro-rata-split-into-`UserBalance` produces. The seams line up:
- `credit_user_balance(user, amount, *, source, reference, memo)` ([wallets/services.py:105](backend/apps/wallets/services.py#L105)) is the exact tool — row-locked, appends a `BalanceTransaction`, takes a `source` discriminator and a `reference` (use for idempotency). Returns the `UserBalance`. **Same pattern as `_credit_owner_for_primary_sale`.**
- `total_distributions` / `last_distribution_date` are pre-built sinks for the per-holder roll-up the "By Property" tab shows.

**Mismatches / gaps to flag (not blockers):**
- **(a) `status` lifecycle.** Frontend has `paid` / `pending` / `scheduled`. A pure "declare → credit immediately" engine only produces `paid`. To honor the frontend, the Distribution should carry a status and a pay-date; `pending`/`scheduled` = declared-but-not-yet-credited. Decide whether v1 credits instantly (all `paid`) or supports scheduled declaration.
- **(b) `type` / cadence + `yield`.** Frontend shows `monthly`/`quarterly` and an annual `yield` %. These are presentation metadata; the engine can store `type`/`period_label` on the Distribution and leave `yield` derived or owner-entered. Not behavior-gating.
- **(c) `nextPaymentDate` / schedule tab.** Implies recurring/scheduled distributions. v1 can omit recurrence (declare each period manually) and simply leave "next payment" blank — but the UI has a Schedule tab, so confirm whether scheduling is in-scope for v1.
- **(d) Snapshot timing.** Pro-rata "by current holdings" must snapshot holders **at declaration time** (holdings change via mint + LP/secondary trades). The payout rows must record the share each holder held then — don't recompute later.

---

## 4. KEY QUESTIONS to surface (not deciding)

1. **Who funds/declares?** Admin only (platform as exception handler), or the property owner/developer from their own `UserBalance` (debit submitter → credit holders)? This is the biggest open decision — it determines whether a distribution is funded money (debit a source) or an admin-seeded credit. The owner-primary-sale precedent credits the submitter; distributions flow the *other* way (submitter/admin → holders).
2. **Pro-rata basis:** snapshot `token_amount` at declaration time (recommended, per §3d) vs. stored `ownership_percentage`. Rounding policy for the last cent (sum of rounded shares must equal the pool).
3. **Internal-balance only?** Confirm distributions are **cash yield credited to `UserBalance` with NO on-chain movement** (no token transfer, no PropertyToken call). The mock shows `+$` credits, never share changes — strongly implies pure ledger. This is the key contrast with the LP/secondary settlement (which DOES move tokens on-chain).
4. **vs. owner primary-sale earnings (already built):** primary-sale = one-time, submitter-credited, triggered by mint ([investments/services.py](backend/apps/investments/services.py) `_credit_owner_for_primary_sale`, `source="primary_sale"`). Distributions = recurring, **holder**-credited, triggered by a declare action. Use a **distinct `source`** (e.g. `"distribution"`) on the `BalanceTransaction` so the two never conflate in the ledger.
5. **Eligibility:** only ACTIVE holdings (`status=ACTIVE`)? Exclude `locked_amount` (escrowed by a live listing) or distribute on full `token_amount`? (Recommend full `token_amount` — escrow is about tradability, not ownership.)
6. **Idempotency / replay:** one declaration must not double-credit. Reuse the `BalanceTransaction(source, reference)` idempotency pattern (reference = `f"{distribution_id}:{holder_id}"` or payout PK).

---

## 5. PROPOSED PLAN (brief — for the design prompt, not built here)

Mirror the owner/LP/secondary build pattern (model + service + KYC/role-gated endpoints + frontend repoint):

**Backend `apps/distributions`:**
- **`Distribution`** model — `property_id` (slug), `declared_by` (user/admin FK), `pool_amount_usd`, `type`/`period_label`, `pay_date`, `status` (draft/declared/paid), `created_at`. One per property per period.
- **`DistributionPayout`** model — FK `distribution`, `user`, `holding` (OwnershipToken) snapshot, `share_amount_usd`, `tokens_at_snapshot`, `credited` flag. Records the frozen pro-rata split (§3d).
- **`services.declare_distribution(property, pool_amount, ...)`** — inside `transaction.atomic()`: snapshot ACTIVE holders of `property_id`, split `pool_amount` pro-rata by `token_amount` (cent-exact remainder to largest holder), create `DistributionPayout` rows, and for each call `credit_user_balance(user, share, source="distribution", reference=payout_pk, memo=...)` + bump `OwnershipToken.total_distributions` / `last_distribution_date`. Idempotent per payout.
- **Endpoints:** investor **read** (`GET /api/distributions/` — own payouts, mirrors the mock's history/by-property shapes; KYC/`IsAuthenticated` + self-scoped queryset); admin/owner **declare** action (role-gated — pending Q4.1 on who declares). Optional `urls.py` + `serializers.py`.
- **Settings/wiring:** register routes in `config/urls.py`; admin action on `Distribution` for the exception handler.

**Frontend:** add `useDistributions` hook + `distributionsApi`, repoint [Distributions.tsx](src/pages/Distributions.tsx) from the two mock arrays to real payouts — preserving the exact rendered shape (amount/property/period/date/status/yield + the three tabs).

**Reuse:** `credit_user_balance` + `UserBalance`/`BalanceTransaction` (a `"distribution"` source), the OwnershipToken snapshot seam, and the existing role/KYC permission classes — **no new payment rail, no on-chain movement.**

---

### Open questions (carry into the design prompt)
- **Q4.1 — who funds/declares (admin vs owner-from-balance)?** ← biggest unknown; gates the whole money-flow direction.
- **Q3a — does v1 support `scheduled`/`pending` status + the Schedule tab, or credit-immediately (`paid`-only) for now?**
- **Q4.5 — distribute on full `token_amount` or net of `locked_amount`?**
- **Confirm internal-balance-only (no token transfer)** — strongly implied by the mock, but worth an explicit lock.
