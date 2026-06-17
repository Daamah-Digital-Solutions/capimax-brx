# NOTIFICATIONS_SURFACE.md — read-only investigation

**Scope:** READ-ONLY, nothing changed. Map the existing notifications surface (frontend mock + backend stub + the real event points a notification would fire from) so a notifications domain can be designed to match the frontend and reuse the established patterns.

---

## 1. FRONTEND — what notification UI exists

| Surface | file:line | What it is |
|---|---|---|
| **`/notifications` page** | [Notifications.tsx](src/pages/Notifications.tsx) | The real notification centre — **100% static mock** (hardcoded array, client-side state). |
| **Header bell** | [Header.tsx:170-174](src/components/layout/Header.tsx#L170) | A `Bell` button with a **static unread dot** — no count, no dropdown, **not wired** to anything. |
| **Sidebar nav item** | [AppSidebar.tsx:120](src/components/layout/AppSidebar.tsx#L120) | `nav.notifications → /notifications` with a **hardcoded `badge: "5"`**. |
| **Home "Announcements"** | [NotificationsSection.tsx](src/components/home/NotificationsSection.tsx) | **NOT user notifications** — a static marketing/features card grid ("Latest Announcements & Features"). Out of scope; named "notifications" but unrelated. |

**There is NO `useNotifications` hook** (grep of `src/hooks` found nothing). The page owns the mock in local `useState`.

**The notification shape the UI renders** ([Notifications.tsx:27-39](src/pages/Notifications.tsx#L27)):
```ts
interface Notification {
  id: string;
  type: "financial" | "investment" | "report" | "system" | "alert";
  title: string; titleAr: string;            // bilingual EN/AR
  description: string; descriptionAr: string; // bilingual EN/AR
  timestamp: string;                          // RELATIVE string e.g. "2h ago" (hardcoded)
  read: boolean;
  actionUrl?: string; actionLabel?: string; actionLabelEn?: string;  // optional deep-link
}
```
Mock rows ([Notifications.tsx:41-117](src/pages/Notifications.tsx#L41)) map 1:1 to real platform events: **Distribution Received** (`/distributions`), New Property Listed, Installment Due, Q4 Report, **KYC Verification Complete**, **Secondary Market Trade Executed** (`/secondary-market`).

**Behaviours (all client-side `useState`, no persistence):** `markAsRead` / `markAllRead` / `deleteNotification` ([:167-177](src/pages/Notifications.tsx#L167)); `unreadCount` ([:135](src/pages/Notifications.tsx#L135)); tabs **all / unread / financial / investment / alert** ([:179-183](src/pages/Notifications.tsx#L179)). A **settings panel** ([:317-383](src/pages/Notifications.tsx#L317)) has 7 per-type toggles + channel switches (**email / in-app / sms**) + daily/weekly **digest** — all local state, nothing saved.

**Status: mock, NOT Supabase, NOT wired** (unlike the pre-Django screens that were Supabase — this one is purely hardcoded; it has nothing to repoint *from*, only *to* a new API).

---

## 2. BACKEND — empty stub, zero notification creation

`apps/notifications` is an **empty stub**: [models.py](backend/apps/notifications/models.py) is a 3-line comment (**no models**), [admin.py] is a 1-line comment, [apps.py](backend/apps/notifications/apps.py) registers `NotificationsConfig` (label `notifications`), `migrations/` holds only `__init__.py`. **No `views.py`, `urls.py`, `serializers.py`, `services.py`.** (App IS in `INSTALLED_APPS` but mounts no routes.)

**Notification creation today: NONE.** Grep across `backend/apps` for `Notification.objects` / `notify(` / `create_notification` / `send_notification` → **no matches**. No code path emits any notification (no in-app, no email, no push). The only "Notification" symbols in the repo are the frontend mock + the unrelated home announcements grid.

---

## 3. THE EVENTS that should generate a notification (real points that already fire)

Every user-facing event below already runs through a single service function — the natural emit point:

| Event | Service function (file:line) |
|---|---|
| **Investor KYC approved / rejected** | [kyc/services.py:42 `approve_kyc`](backend/apps/kyc/services.py#L42) (+ `mark_approved` [kyc/models.py:99](backend/apps/kyc/models.py#L99)) |
| **KYB approved / rejected — LP** | [lp/services.py:53 `approve_kyb`](backend/apps/lp/services.py#L53) / [:69 `reject_kyb`](backend/apps/lp/services.py#L69) |
| **KYB approved / rejected — Owner** | [owner/services.py:72 `approve_kyb`](backend/apps/owner/services.py#L72) / [:88 `reject_kyb`](backend/apps/owner/services.py#L88) |
| **KYB approved / rejected — Developer** | [developer/services.py:55 `approve_kyb`](backend/apps/developer/services.py#L55) / [:72 `reject_kyb`](backend/apps/developer/services.py#L72) |
| **Custodial wallet auto-created** | [wallets/services.py:30 `get_or_create_custodial_wallet`](backend/apps/wallets/services.py#L30) (returns `created` bool — emit only when `True`) |
| **Investment completed → tokens minted** | [investments/services.py:243 `mint_investment`](backend/apps/investments/services.py#L243) (payment confirmation flows into this; the mint is the user-facing moment) |
| **Owner/Developer primary-sale earnings credited** | [investments/services.py:187 `_credit_owner_for_primary_sale`](backend/apps/investments/services.py#L187) |
| **Distribution credited (per holder)** | [distributions/services.py:38 `declare_distribution`](backend/apps/distributions/services.py#L38) → per-payout `credit_user_balance` |
| **Secondary-market sale (buyer + seller)** | [secondary_market/services.py:158 `purchase_listing`](backend/apps/secondary_market/services.py#L158); LP market [lp/market_services.py:209 `purchase_listing`](backend/apps/lp/market_services.py#L209) |
| **Withdrawal requested / status** | [wallets/services.py:133 `request_withdrawal`](backend/apps/wallets/services.py#L133) |
| **Property submission published / rejected** | [owner/services.py:281 `publish_submission`](backend/apps/owner/services.py#L281) / [:375 `reject_submission`](backend/apps/owner/services.py#L375) |

All of these already run inside `transaction.atomic()` blocks (mint, distribution, settlement), so a notification insert can ride the same transaction — emitted exactly when the event durably commits, mirroring how `credit_user_balance` is called.

---

## 4. MODEL implied + does the frontend match?

**Implied model:** `Notification(user FK, type, title, body, read, action_url, created_at)` — written server-side at the §3 event points, **self-scoped** read (a user sees only their own, like every other domain), the bell/list reads **unread count** + the page **marks read**.

**Frontend match: YES, with extras.** The page's core (typed, titled, read/unread, timestamped, optional deep-link, mark-read/mark-all-read) maps cleanly to that model. **Beyond the minimal model**, the frontend also shows: per-type **preference toggles**, **email/SMS/digest channels**, and **delete** — none of which a minimal in-app v1 needs (they're aspirational UI). Two shape notes: the mock is **bilingual** (`title`/`titleAr`) and uses a **relative timestamp string** (the backend should send `created_at` ISO and let the frontend format it).

---

## 5. KEY QUESTIONS (not deciding)

1. **In-app only for v1?** The UI shows email / SMS / digest channels, but no mailer/push exists. Recommend **in-app only** v1 (channels = future), emitted at the §3 points.
2. **Read/unread + delete:** read/unread is clearly in (model `read` + mark-read endpoints). Is **delete** in scope (hard vs soft), or defer it (the mock has a trash button)?
3. **Real-time vs poll:** Supabase realtime was dropped platform-wide; the established pattern is **refetch-on-mount + on-focus** ([useOwnershipTokens.ts](src/hooks/useOwnershipTokens.ts), [useDistributions.ts](src/hooks/useDistributions.ts)). The bell badge would poll the unread count the same way.
4. **Bilingual storage:** store both `title_en`/`title_ar` + `body_en`/`body_ar` (matches Property `name`/`name_ar`), **or** store a `type` + structured `params` and render copy from the frontend i18n layer (the approach used when repointing Distributions — keeps Arabic in `t()`)? This decides the model shape.
5. **Which events in v1 scope?** All §3 events, or a first slice (KYC/KYB approved, mint complete, distribution credited, secondary-market sale, withdrawal, submission published/rejected)?
6. **Preference toggles:** persist the 7 per-type switches + digest (a `NotificationPreference` model), or **defer** and emit all events in v1 (toggles stay local-only UI for now)?

---

### Open questions to carry into the design prompt
- **Q5.4 — bilingual stored copy vs type+params+i18n** (biggest shape decision).
- **Q5.1 — confirm in-app-only v1** (no email/SMS/push/digest).
- **Q5.6 — preferences persisted or deferred** (emit-all v1).
- **Q5.2 — is delete in scope.**
- Emit pattern: **server-side at the existing service event points, inside their atomic blocks** (like `credit_user_balance`); read = self-scoped `GET /api/notifications/` + `unread-count` + mark-read, polled on mount/focus (no realtime).
