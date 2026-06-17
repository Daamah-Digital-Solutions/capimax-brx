# PARTNERS_SURFACE.md — read-only investigation

**Scope:** READ-ONLY, nothing changed. Map the existing partner surface (frontend + backend stub + role) so a partners domain can be designed to match the frontend (source of truth).

**Headline:** "Partner" here is **NOT a referral/affiliate that earns commission for referring investors.** There is **no referral link, no commission, no earnings/tier/payout anywhere.** Across three distinct frontend surfaces, "partner" means a **strategic / B2B service-vendor partner** (integration/white-label/co-marketing, or a valuation/management/insurance firm doing assigned work).

---

## 1. WHAT IS A PARTNER (three distinct notions, none is affiliate/referral)

**(a) The registration role — strategic/tech/channel partner.** [RegisterRole.tsx:161-178](src/pages/RegisterRole.tsx#L161): id `"partner"`, icon `Handshake`, label **"Partner" / "شريك"**, tagline **"Integrate, distribute, or co-build"**, bullets: **"Strategic & technology partners", "API & white-label access", "Co-marketing programs"**, verification badge **"By Application"** ([:178](src/pages/RegisterRole.tsx#L178)). → an integration/white-label/co-marketing partner, joined by application.

**(b) Public directory — business/service partners showcase.** [Partners.tsx](src/pages/Partners.tsx) "Our Partners": *"We work with trusted and verified partners to ensure the highest standards of quality and security"* ([:224-225](src/pages/Partners.tsx#L224)). A filterable grid of **vendor companies** in 6 categories — developers, hotels, property-management, insurance, valuation, digital-finance ([:177-185](src/pages/Partners.tsx#L177)) — each with a verified badge + external website link. CTA = **"Become a Partner → Contact Us"** ([:342-356](src/pages/Partners.tsx#L342)). No login, no money.

**(c) Service-vendor WORK PORTAL.** [StrategicPartners.tsx](src/pages/StrategicPartners.tsx): the logged-in partner is a **service firm** (badge: *"United Real Estate Valuation Co."* [:144](src/pages/StrategicPartners.tsx#L144)) that receives **assigned properties** to deliver professional work on — valuation reports, market analysis, management plans, insurance policies, risk assessments. → a B2B deliverables workflow, **not** earnings.

**None of the three is a referral/affiliate program.** No "refer an investor → earn commission" anywhere.

---

## 2. FRONTEND — what partner UI exists, and its data shape

| Surface | file | What it renders | Wiring |
|---|---|---|---|
| **Partners directory** | [Partners.tsx](src/pages/Partners.tsx) | Grid of 10 hardcoded vendor cards (name/category/country/website/verified) + search + category/country filters + "Become a Partner" CTA | **Static mock** |
| **Strategic partner portal** | [StrategicPartners.tsx](src/pages/StrategicPartners.tsx) | Assigned-assets list (status/progress/due-date), deliverables, document upload dropzone, activity log, 4 summary stats | **Static mock** |
| **Sidebar / register** | [AppSidebar.tsx](src/components/layout/AppSidebar.tsx), [RegisterRole.tsx](src/pages/RegisterRole.tsx) | Partner nav section + the "Partner" registration card | role-gated nav |

**No `usePartners` hook** (grep of `src/hooks` → nothing). Both pages own their mock in local state.

**Mock shapes:**
- Directory ([Partners.tsx:24-36](src/pages/Partners.tsx#L24)): `Partner { id, name/nameAr, category, description/descriptionAr, logo, country/countryAr, website, verified }` — categories: developers/hotels/property-management/insurance/valuation/digital-finance.
- Portal ([StrategicPartners.tsx:28-47](src/pages/StrategicPartners.tsx#L28)): `AssignedAsset { id, name/nameEn, type, location, assignedDate, dueDate, status (pending|in-progress|submitted|approved|revision), progress, deliverables[] }` + `Deliverable { id, name/nameEn, status, dueDate }` + an `activityLog`. **NO money/commission/payout fields** — it's a work-tracking shape.

**Status: 100% static mock, NOT Supabase, NOT wired.** (Like distributions/notifications were — nothing to repoint *from*.)

---

## 3. BACKEND — empty stub; role exists; no partner logic

`apps/partners` is an **empty stub**: [models.py](backend/apps/partners/models.py) is a 3-line comment (no models), [admin.py] a 1-line comment, [apps.py](backend/apps/partners/apps.py) registers `PartnersConfig`, `migrations/` holds only `__init__.py`. **No views/urls/serializers/services.** (Registered in `INSTALLED_APPS`, mounts no routes.)

**The role DOES exist in core:** [core/models.py:90](backend/apps/core/models.py#L90) `Profile.Role.PARTNER = "partner"`; it is **self-selectable** ([SELF_SELECTABLE_ROLES:189](backend/apps/core/models.py#L189)) **and requires verification** ([ROLES_REQUIRING_VERIFICATION:203](backend/apps/core/models.py#L203)) — so a partner registrant is parked at `role_status = pending_verification` until activated ([:71-77](backend/apps/core/models.py#L71)), exactly like owner/developer/LP/broker. **But nothing activates it** — there is no partner KYB/approval path (no `apps/partner` profile, no webhook routing, no `HasActivatedPartner`). A `role=partner` registrant is **stranded** today (same state the developer role was in before Phase 8).

**Partner logic anywhere today: NONE.**

---

## 4. RELATIONSHIP to existing domains

- **Standalone money-wise — NO earnings seam.** Unlike owner/LP/developer (which credit `UserBalance` and withdraw via `Withdrawal`), **no partner surface has any money flow** — no commission, no balance, no payout. The portal tracks *deliverables*, not earnings. So a v1 partner domain would **not** reuse the UserBalance/Withdrawal stack (nothing in the frontend asks for it).
- **Conceptual tie to the property/submission pipeline.** The portal's deliverables — **valuation report, insurance policy, management plan, risk assessment** — mirror the owner submission's required document types (`valuation`, `insurance`, `legal`; [owner/models.py SubmissionDocument.DocType]). A "partner" is plausibly the **producer** of those property artifacts (a valuation firm uploads the valuation an owner submission needs). The seam is the **`PropertySubmission` + `SubmissionDocument`** machinery (Phase 7/8) and the `Property` catalog — an admin would **assign** a property to a partner, the partner **uploads deliverables**, mirroring the owner submission upload/review flow.
- **Verification reuse.** "By Application" + `ROLES_REQUIRING_VERIFICATION` strongly parallels owner/developer KYB — a partner domain could reuse the **`OwnerProfile`/`DeveloperProfile` KYB pattern** (separate `PartnerProfile`, shared Sumsub webhook → 5-way) for activation. (No money, so no LP-style balance.)
- **Directory is fully standalone.** [Partners.tsx](src/pages/Partners.tsx) is a public CMS-like showcase (vendor name/logo/website/verified) — a simple read model, unrelated to investing/auth.

---

## 5. KEY QUESTIONS (don't decide)

1. **Which "partner" is v1?** Three different things share the name: (a) the **public directory** (a CMS list of vendors — simplest, read-only, no auth), (b) the **registration role + service-vendor portal** (assigned-assets/deliverables workflow — needs auth + an admin assignment step + uploads), (c) the **strategic/API/white-label** partner the register card pitches (a different, integrations-flavoured thing). These have very different builds.
2. **Is there a verification/KYB step?** The role requires verification + "By Application" badge → implies an apply→approve gate. Reuse the owner/developer KYB pattern (separate `PartnerProfile`, shared webhook), or a lighter admin-approval?
3. **How is a partner↔property relationship tracked?** The portal shows *assigned* assets — who assigns (admin?), and is an assignment a new model linking `Partner` ↔ `Property` with deliverables + status?
4. **Any money at all?** No commission/payout exists in the mock — confirm partners are **non-earning** in v1 (no UserBalance), unlike every other privileged role.
5. **Mock vs real:** both pages are pure mock; the directory could be admin-seeded read data, the portal a real assignment/deliverable workflow reusing the submission-document upload machinery. Confirm scope.

---

### Open questions to carry into the design prompt
- **Q5.1 — which surface is in scope** (directory vs vendor-portal vs strategic/API partner)? Biggest fork; they're three different builds.
- **Q5.4 — confirm partners are NON-earning v1** (no UserBalance/Withdrawal — the mock has zero money fields).
- **Q5.2 — verification: reuse owner/developer KYB (separate `PartnerProfile` + 5-way webhook) or lighter admin approval?**
- **Q5.3 — assignment model: admin assigns a `Property` to a partner with deliverables; partner uploads via the existing `SubmissionDocument`-style machinery?**
- Note: a `role=partner` registrant is currently **stranded** (no activation path) — same gap the developer role had pre-Phase-8.

---

# Wave detail — service-vendor assignment build (decided scope)

**Decision (locked):** the partner is a **SERVICE VENDOR**. An admin **assigns** a specific property to a partner requesting a service (e.g. "valuation for Marina"); the partner **uploads the deliverable** against that assignment. Reuses the owner/developer **KYB** pattern. **NON-earning** (no money). This section pins the exact frontend shape ([StrategicPartners.tsx](src/pages/StrategicPartners.tsx) is the source of truth).

## 1. The ASSIGNMENT model the frontend implies

`AssignedAsset` ([StrategicPartners.tsx:28-39](src/pages/StrategicPartners.tsx#L28)) — every rendered field:
```ts
interface AssignedAsset {
  id: string;
  name: string; nameEn: string;     // the PROPERTY (Arabic + English) — ties to a Property
  type: string;                     // SERVICE TYPE (see enum below) — e.g. "تقييم عقاري"
  location: string;                 // property location (denormalized)
  assignedDate: string;             // when the admin assigned it
  dueDate: string;                  // delivery deadline
  status: "pending" | "in-progress" | "submitted" | "approved" | "revision";
  progress: number;                 // 0–100 (derived/illustrative)
  deliverables: Deliverable[];      // the required outputs (see §3)
}
```
**Service-type enum (the `type` values in the mock data):** valuation `"تقييم عقاري"` ([:55](src/pages/StrategicPartners.tsx#L55)), property-management `"إدارة عقارية"` ([:71](src/pages/StrategicPartners.tsx#L71)), insurance `"تأمين عقاري"` ([:86](src/pages/StrategicPartners.tsx#L86)). These align with the directory categories (valuation / property-management / insurance) and the owner `SubmissionDocument.DocType` (`valuation` / `insurance` / `legal`).

**Status lifecycle** ([:36](src/pages/StrategicPartners.tsx#L36), badges [:110-123](src/pages/StrategicPartners.tsx#L110)): `pending → in-progress → submitted → approved`, with `revision` as the admin-requests-changes side state. Mirrors the owner submission lifecycle (`draft/submitted/under_review/approved/rejected`) — the admin is the reviewer here too. Summary stats ([:150-203](src/pages/StrategicPartners.tsx#L150)): total assigned, in-progress (= in-progress + pending), completed (= approved), needs-revision (= revision).

**→ New `Assignment` model:** `partner (FK)`, `property (FK to Property)`, `property_name`/`location` (denormalized like OwnershipToken), `service_type` (enum), `status`, `assigned_at`, `due_date`, optional `notes`, `assigned_by` (admin). Created by an **admin assign action** (the genuinely new piece).

## 2. COMMUNICATION shape — one-way, NO back-and-forth

There is **no messaging/chat thread**. The "activity" tab renders a **read-only one-way activity log** ([:98-103](src/pages/StrategicPartners.tsx#L98), [:398-418](src/pages/StrategicPartners.tsx#L398)):
```ts
const activityLog = [
  { id, action: "تم رفع تقرير التقييم", asset: "برج المارينا", time: "منذ ساعتين" },  // "valuation report uploaded"
  { ... action: "تمت الموافقة على تحليل السوق" },   // "market analysis approved"
  { ... action: "طلب مراجعة من المنصة" },           // "revision request from the platform"
  { ... action: "تم إكمال جميع التسليمات" },        // "all deliverables completed"
];  // shape: { id, action, asset, time }
```
It's a **feed of state-change events** (upload / approve / revision-requested / completed) — exactly what a status transition + an upload would emit. (`MessageSquare` is imported at [:20](src/pages/StrategicPartners.tsx#L20) but **not used** in the JSX — no composer, no reply.) → v1 = a derived activity feed (or simple append-only `AssignmentEvent` rows), **not** a two-way messaging domain. The `revision` status + an optional admin `review_notes` is the only admin→partner channel.

## 3. DELIVERABLE / upload shape

`Deliverable` ([:41-47](src/pages/StrategicPartners.tsx#L41)): `{ id, name, nameEn, status: "pending"|"submitted"|"approved"|"revision", dueDate }` — the named outputs an assignment expects (e.g. "Valuation Report", "Market Analysis", "Property Photos" [:60-64](src/pages/StrategicPartners.tsx#L60)). Each carries its own status + due date.

**Upload UI:** per-asset **"Upload Files"** button ([:282-285](src/pages/StrategicPartners.tsx#L282)) + a **Documents tab dropzone** ([:388-392](src/pages/StrategicPartners.tsx#L388)) ("drop files here" + a file-types hint + "Upload Document"). Uploads are **per-assignment** (against the assigned property/service). → reuse the owner `SubmissionDocument` file pattern: a `DeliverableDocument { assignment (FK), deliverable_type, document_name, file (FileField upload_to), file_size, uploaded_at }`, partner-scoped download.

## 4. Public DIRECTORY ([Partners.tsx](src/pages/Partners.tsx))

`Partner` ([:24-36](src/pages/Partners.tsx#L24)): `{ id, name, nameAr, category, description, descriptionAr, logo, country, countryAr, website, verified }`. Categories ([:177-185](src/pages/Partners.tsx#L177)): developers / hotels / property-management / insurance / valuation / digital-finance. **`verified`** is a boolean → a check badge ([:299-301](src/pages/Partners.tsx#L299)); all mock rows are `verified: true`. **Plausible KYB tie:** `verified` could surface `PartnerProfile.status == "approved"` — but the directory lists *companies* (logo/website/category/bilingual copy, possibly non-users), which is richer than a KYB profile, so it may be **admin-curated** content rather than auto-derived. (Open question Q6.1.)

## 5. REUSE map (owner/developer → partner)

| Reuse | Owner/developer source | Partner target |
|---|---|---|
| KYB profile + state machine | `OwnerProfile` + `OwnerStatus`/`OwnerKYBStatus` + `sumsub_applicant_id` + `mark_kyb_submitted`/`mark_approved` ([owner/models.py:31-150](backend/apps/owner/models.py#L31)) | **`PartnerProfile`** (separate, mirror exactly; non-earning — no balance) |
| Activation gate | `HasActivatedOwner`/`HasActivatedDeveloper` ([core/permissions.py](backend/apps/core/permissions.py)) | **`HasActivatedPartner`** |
| Activation hinge + webhook | `approve_kyb` + shared **4-way** Sumsub webhook (developer/owner/LP/investor) | add partner level → **5-way** webhook; `dev_grant_partner_kyb` (DEBUG) |
| Document upload + storage | `SubmissionDocument` (`DocType`, `FileField upload_to`, `file_size`, scoped download) ([owner/models.py:234-281](backend/apps/owner/models.py#L234)) | **`DeliverableDocument`** (per-assignment) |
| Admin review lifecycle | owner submission approve/reject admin actions + status machine | admin **approve / request-revision** on an assignment |
| Notifications | Phase 10 `notify()` at event points | emit on assign / deliverable-submitted / approved / revision-requested |

**Genuinely NEW (no existing analogue):** the **`Assignment` model** (partner ↔ Property + service_type + status + due_date + deliverables) and the **admin "assign property to partner" action** (the owner pipeline is owner-initiated; here the admin initiates). The directory is also new but trivial (a read model / admin-curated list).

## 6. KEY QUESTIONS (don't decide)

1. **Directory — admin-curated or auto from approved partners?** It carries logo/website/category/bilingual copy (richer than a KYB profile) and may list firms that aren't platform users → likely **admin-curated content**, with `verified` *optionally* reflecting KYB. Confirm whether the directory is in v1 scope at all, or just the vendor portal.
2. **Activity log — real or decorative?** Recommend deriving it from real status transitions + uploads (or a small append-only event table), not a hand-written feed. Confirm it's needed in v1 vs a thin status-history view.
3. **Assignment fields — due date + notes?** The mock shows `dueDate` + a `revision` state. Confirm the admin sets a due date and can attach `review_notes`/instructions at assign time or when requesting a revision (the only admin→partner channel, since there's no messaging).
4. **Deliverables — admin-defined per assignment, or a fixed checklist per `service_type`?** The mock lists named deliverables per asset; decide if the admin specifies them at assign time or they default from the service type.
5. **Is `progress` stored or derived?** Likely derived from deliverable statuses (approved/total) — confirm it's computed, not a stored field.
