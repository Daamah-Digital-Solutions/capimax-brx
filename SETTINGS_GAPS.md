# SETTINGS_GAPS.md — what the Settings page needs vs what the backend has

> Read-only. Targets: `src/pages/Settings.tsx`, `backend/apps/core/`, `authApi` in `client.ts`. Cited file:line.

---

## 1. The Settings form — fields + buttons (all from [Settings.tsx](src/pages/Settings.tsx))

6 tabs (profile / security / notifications / preferences / billing / admin-if-admin) — [:61-89](src/pages/Settings.tsx:61).
**Almost everything is unbound mock UI** (`defaultValue` placeholders, `defaultChecked` switches, no `onClick`).

**Profile tab** ([:92-154](src/pages/Settings.tsx:92)):
- Avatar + camera button — display/no-handler ([:106](src/pages/Settings.tsx:106)).
- Inputs: **First name, Last name, Email, Phone, Country, City** — all **hardcoded `defaultValue`** ("Mohammed", "mohammed@example.com", "+971 50 XXX XXXX", "Dubai"…), **NOT bound to the real user** ([:124-148](src/pages/Settings.tsx:124)).
- **Save Changes** button — no onClick ([:151](src/pages/Settings.tsx:151)).
- KYC status card — display-only, hardcoded date ([:157-174](src/pages/Settings.tsx:157)).

**Security tab** ([:178-288](src/pages/Settings.tsx:178)):
- Current / New / Confirm **password** Inputs (unbound) + **Change Password** button (no onClick) ([:188-216](src/pages/Settings.tsx:188)).
- **2FA** Switch `defaultChecked` — no handler, no backend ([:235](src/pages/Settings.tsx:235)).
- **Active devices** = hardcoded `devices` mock array ([:34-38](src/pages/Settings.tsx:34)); **Logout All** button ([:245](src/pages/Settings.tsx:245)) + per-device **End Session** button ([:280](src/pages/Settings.tsx:280)) — all no-handler.

**Notifications tab** ([:291-345](src/pages/Settings.tsx:291)): 7 event toggles (distributions/installments/properties/reports/market/security/marketing) + 3 delivery channels (email/in-app/sms) — **all `Switch defaultChecked`, no handler** ([:298-340](src/pages/Settings.tsx:298)).

**Preferences tab** ([:348-419](src/pages/Settings.tsx:348)):
- **Language** select — ✅ **WIRED** to local i18n (`value={language}` / `onChange={setLanguage}`) ([:356-363](src/pages/Settings.tsx:356)). Local-only, not persisted server-side.
- **Appearance** Dark/Light/Auto buttons — no handler; decorative dupes (the real theme toggle lives in Header) ([:369-380](src/pages/Settings.tsx:369)).
- **Default currency** select — no handler, no consumer ([:386-391](src/pages/Settings.tsx:386)).
- **Danger Zone**: Deactivate Account + Delete Account buttons — no handler ([:409-416](src/pages/Settings.tsx:409)).

**Billing tab**: empty placeholder card. **Admin tab**: `PWASettingsSection`, gated by `isAdmin = user?.profile?.role === 'admin'` (✅ wired via `useAuth`) ([:48,434](src/pages/Settings.tsx:48)).

---

## 2. What EXISTS in `backend/apps/core/`

**User** ([models.py:19](backend/apps/core/models.py:19)): `email` (unique, [:24](backend/apps/core/models.py:24)), `is_staff`, `is_active`, `is_email_verified` ([:34](backend/apps/core/models.py:34)), `date_joined`, UUID pk. **No first/last name, no country/city.**
**Profile** ([models.py:52](backend/apps/core/models.py:52)): `full_name` ([:105](backend/apps/core/models.py:105)), `phone` ([:106](backend/apps/core/models.py:106)), `avatar_url` ([:107](backend/apps/core/models.py:107)), `is_us_citizen` ([:108](backend/apps/core/models.py:108)), `role` ([:110](backend/apps/core/models.py:110)), `role_status` ([:118](backend/apps/core/models.py:118)), `role_verified_at`. **No country/city, no currency, no notif prefs, no 2FA fields.**

**Auth endpoints** ([views.py](backend/apps/core/views.py) / urls):
- `register`, `login` (JWT), `token/refresh`, **`logout` — blacklists the ONE supplied refresh token** ([views.py:93-112](backend/apps/core/views.py:93)), `session`, **`MeView` — `RetrieveAPIView`, GET-ONLY** ([views.py:115-122](backend/apps/core/views.py:115)), `password/reset` (emailed) + `password/reset/confirm` (token→new password, **no old-password check**), `email/verify`.
- **MISSING:** any PATCH/update on `me`; authenticated change-password; logout-all.

**Serializers** ([serializers.py](backend/apps/core/serializers.py)): `ProfileSerializer` exposes `full_name/phone/avatar_url/is_us_citizen/role/role_status`, with **`read_only_fields = (id, role, role_status, created_at, updated_at)`** ([:41](backend/apps/core/serializers.py:41)) — **`role`/`role_status` already locked**; `full_name`/`phone`/`avatar_url`/`is_us_citizen` are serializer-writable but **MeView never writes them**. `UserSerializer` fully read-only ([:52](backend/apps/core/serializers.py:52)).

**`authApi`** ([client.ts:158-197](src/integrations/api/client.ts:158)): `register`, `login`, `me` (GET `/auth/me/`), `logout` (single refresh). **No update / changePassword / logoutAll.**

**Field safety for a profile-update:**
- ✅ **SAFE to let the user edit:** `full_name`, `phone`, `avatar_url`.
- ⛔ **LOCKED:** `role`, `role_status` (already read-only — anti-privilege-escalation, [serializers.py:41](backend/apps/core/serializers.py:41)); `email` (login identity + PII — change needs re-verification; defer); `is_us_citizen` (compliance, set at signup); `is_email_verified` (system).
- ⚠️ **Form/model mismatch:** the form has **First name + Last name** but Profile has only `full_name`; the form has **Country + City** which **don't exist on any model**. → reconcile (split vs combined name; add country/city or drop them).

---

## 3. The gaps to build (small, no money)

1. **`PATCH /api/auth/me/`** (add a `patch()` to MeView, or a `ProfileUpdateView`) — update the caller's OWN editable fields only: **`full_name`, `phone`, `avatar_url`** via a dedicated write serializer that excludes everything else. Never `role`/`role_status`/`email`/`is_us_citizen`. (Also bind the form to the real user first — `GET /auth/me` already returns it; today the inputs are hardcoded.)
2. **`POST /api/auth/password/change/`** (authenticated) — `{current_password, new_password}`: verify `user.check_password(current)`, run Django `validate_password(new)` (already used in `RegisterSerializer` + `PasswordResetConfirmSerializer`), `set_password` + save. Optionally rotate tokens after.
3. **`POST /api/auth/logout-all/`** — blacklist ALL the user's outstanding refresh tokens (the `token_blacklist` app is installed; `LogoutView` already calls `RefreshToken(...).blacklist()`). Iterate `OutstandingToken` for the user → write `BlacklistedToken`.

---

## 4. Toggles — real feature or aspirational UI?

| Control | Backend today | Recommendation |
|---|---|---|
| **Language** ([:356](src/pages/Settings.tsx:356)) | local i18n only (works) | Keep local; persist to a `UserPreference` ONLY if cross-device sync is wanted. |
| **Appearance (theme)** ([:369](src/pages/Settings.tsx:369)) | real toggle is in Header; these are dupes | **Defer / wire to the existing theme** — no new backend. |
| **Currency** ([:386](src/pages/Settings.tsx:386)) | none; nothing consumes it (USD everywhere) | **Defer** (local-only) until a feature reads it. |
| **Notification prefs (7) + channels (3)** ([:298](src/pages/Settings.tsx:298)) | Phase 10 notifications are **in-app only; prefs explicitly NOT modelled** (notify() emits ALL events) | **Defer as local-only UI.** Persisting prefs is cosmetic until `notify()` actually reads them. If wanted later: a small `UserPreference(notif JSON)` + a gate in `notify()`. |
| **2FA** ([:235](src/pages/Settings.tsx:235)) | no TOTP/2FA backend at all | **Defer** — out of scope for a small build. |
| **Avatar upload** ([:106](src/pages/Settings.tsx:106)) | `avatar_url` field exists, no upload endpoint | Defer, or accept a URL in the profile PATCH. |
| **Deactivate / Delete account** ([:409](src/pages/Settings.tsx:409)) | no endpoint | **Defer.** Account deletion is a destructive action — confirm scope before building. |

**Recommendation:** build the **3 endpoints above + bind the form to real data**. Do NOT build a `UserPreference` model yet — notif/currency/theme prefs have no backend consumer, so persisting them is cosmetic; keep them local-only and flagged.

---

## 5. Open questions (decide before the build)

1. **Name:** the form splits First/Last but Profile has only `full_name` — split into two new fields, or store combined ("First Last")?
2. **Country + City:** not on any model — add `country`/`city` to Profile (migration), or drop them from the form?
3. **Email:** keep locked (recommended — changing login identity needs re-verification), or build an email-change-with-verification flow?
4. **`is_us_citizen`:** user-editable or locked (compliance, set at signup)?
5. **Notification prefs / currency / theme:** persist (small `UserPreference`) or local-only/deferred? (Recommend deferred — no consumer.)
6. **2FA:** confirm out of scope (no TOTP backend).
7. **Account deactivate/delete:** in scope (soft `is_active=False`?) or deferred?
