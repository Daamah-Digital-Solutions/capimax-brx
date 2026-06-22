# OWNER_DOCUMENTS.md — pre-build survey (READ-ONLY)

The `owner-documents` mini-domain (one of the 7 deferred Supabase surfaces). This note maps what
the page does today + the **exact existing Django media/FileField pattern to mirror** so the build
reuses it rather than inventing storage. No fixes, no decisions — questions surfaced at the end.

---

## 1. What `useOwnerDocuments` does

**Row shape** ([useOwnerDocuments.ts:5-20](src/hooks/useOwnerDocuments.ts:5)):
```ts
OwnerDocument {
  id; user_id;
  property_id: string | null;        // nullable FK-ish
  property_name: string | null;      // free-text label
  document_name; document_type;      // type ∈ ownership|legal|financial|transaction|certificate|contract|other
  file_path;                         // storage key
  file_size: number | null; file_type: string | null;
  description: string | null;
  status;                            // "active" on insert
  uploaded_at; created_at; updated_at;
}
```

- **Read:** Supabase `owner_documents` table, self-scoped `eq("user_id", user.id)`, newest first
  ([useOwnerDocuments.ts:35-39](src/hooks/useOwnerDocuments.ts:35)).
- **Upload (2 steps):** (a) push the file to Supabase **storage bucket `"owner-documents"`** at key
  `${user.id}/${Date.now()}_${file.name}` ([:67-68](src/hooks/useOwnerDocuments.ts:67)); (b) insert the
  metadata row with `file_path`, `file_size`, `file_type`, `status:"active"`
  ([:75-88](src/hooks/useOwnerDocuments.ts:75)).
- **Download / View:** `storage.createSignedUrl(filePath, 3600)` → a 1-hour signed URL
  ([:143-145](src/hooks/useOwnerDocuments.ts:143)); the page opens it in a new tab (View) or anchors a
  download (Download) ([OwnerDocuments.tsx:105-122](src/pages/OwnerDocuments.tsx:105)).
- **Delete (2 steps):** remove the storage object then delete the row
  ([:115-121](src/hooks/useOwnerDocuments.ts:115)).

**Page** ([OwnerDocuments.tsx](src/pages/OwnerDocuments.tsx)): stats cards (total / active / ownership /
legal counts, [:185-247](src/pages/OwnerDocuments.tsx:185)); 7-category sidebar + "all"
([:46-55](src/pages/OwnerDocuments.tsx:46)); search over name + property_name
([:72-78](src/pages/OwnerDocuments.tsx:72)); an upload dialog with **type select + optional property
name (free text) + description** ([:424-466](src/pages/OwnerDocuments.tsx:424)); per-row View / Download /
Delete buttons ([:360-385](src/pages/OwnerDocuments.tsx:360)). File picker `accept`:
`.pdf,.doc,.docx,.jpg,.jpeg,.png` ([:168](src/pages/OwnerDocuments.tsx:168)).

## 2. The existing Django media/FileField pattern to MIRROR

**Best match — `apps.lp.LPDocument`** (self-scoped user file with upload + list + delete + **blob
download**; the `owner_documents` row shape is nearly 1:1 with it):

- **Model** [lp/models.py:207-231](backend/apps/lp/models.py:207): `user` FK, `document_name`,
  `document_type`, `file = FileField(upload_to="lp_documents/%Y/%m/")`, `file_size`, `created_at`.
  → the owner version becomes e.g. `file = FileField(upload_to="owner_documents/%Y/%m/")`.
- **Upload + list view** [lp/views.py:179-207](backend/apps/lp/views.py:179): `GET` filters
  `LPDocument.objects.filter(user=request.user)`; `POST` reads `request.FILES.get("file")` +
  `request.data` fields and `.create(... file=upload, file_size=getattr(upload,"size",None))`.
- **Delete view** [lp/views.py:211-221](backend/apps/lp/views.py:211): `get_object_or_404(..., user=request.user)`.
- **Self-scoped download** [lp/views.py:224-238](backend/apps/lp/views.py:224): re-filters by
  `user=request.user`, then `FileResponse(doc.file.open("rb"), as_attachment=True, filename=...)`.
  **This is the self-scoped blob-download to copy** (no signed URLs — the auth'd endpoint streams the
  file; owner sees only their own rows by the queryset filter).
- **Frontend api pattern** [client.ts:638-656](src/integrations/api/client.ts:638): `lpApi.documents`
  (list) / `uploadDocument` (builds `FormData`, calls the **`rawUpload` multipart helper**
  [client.ts:589-592](src/integrations/api/client.ts:589)) / `deleteDocument` / `downloadDocument`
  (authed `fetch` → `res.blob()` → browser download, [client.ts:649-655](src/integrations/api/client.ts:649)).

**Storage is gitignored:** all `FileField`s write under `backend/media/` (`.gitignore` already excludes
`backend/media/` — the PII/KYC/submission/deliverable/licence docs live there). Same convention used by
`kyc.KYCDocument`, `owner.SubmissionDocument`, `partners.DeliverableDocument`, `broker.license_document`,
`certificates.pdf_file` — so the owner-documents build **adds no new storage approach**, just another
`upload_to=` subfolder under `media/`.

**Property-tied variant (if needed):** `apps.owner.SubmissionDocument`
([owner/models.py:253-272](backend/apps/owner/models.py:253)) is the same pattern but keyed to a
`PropertySubmission` FK with a typed `DocType` enum — the template if owner-documents should bind to a
real property/submission rather than a free-text label.

## 3. Is the document tied to a Property?

**Not in practice.** The row HAS `property_id` (nullable) + `property_name` (nullable)
([useOwnerDocuments.ts:8-9](src/hooks/useOwnerDocuments.ts:8)), **but the page never sets `property_id`** —
`handleUpload` passes `undefined` for the property id and only sends `property_name` as a **free-text
string** from the dialog input ([OwnerDocuments.tsx:92-97](src/pages/OwnerDocuments.tsx:92),
[:445-453](src/pages/OwnerDocuments.tsx:445)). So today it is a **personal document vault scoped to the
user**, NOT scoped to "owner's own properties." Whether to upgrade `property_name` (label) → a real
`Property`/submission FK is a **design question, not a current behaviour** (surfaced below).

## 4. Key questions (surfaced, NOT decided)

1. **File-type / size limits.** Frontend only hints via the `accept` attr
   ([OwnerDocuments.tsx:168](src/pages/OwnerDocuments.tsx:168)); there is **no size cap** client-side and
   the LP pattern we'd mirror does **no server-side type/size validation** either. → Decide whether the
   owner build adds a server-side max-size + content-type allowlist (recommended for a PII upload), or
   matches the existing no-validation LP behaviour.
2. **Self-scoped download.** Mirror exactly — `FileResponse` behind `filter(user=request.user)`
   ([lp/views.py:224](backend/apps/lp/views.py:224)) gives "owner sees only their own docs" by
   construction (replaces Supabase signed URLs). Confirm: no `is_template`/shared-doc concept is needed
   here (LP has one; owner-documents appears purely personal).
3. **Does this feed the PropertyDetail doc-Verify buttons (the deferred `property-documents` item)?**
   **NO — separate surface.** PropertyDetail's "Documents" tab renders a **hardcoded static array**
   `currentProperty.documents` ([PropertyDetail.tsx:114-119](src/pages/PropertyDetail.tsx:114)) with a
   non-wired "Verify Documents" button ([:964-967](src/pages/PropertyDetail.tsx:964)) — mock data, no
   `owner_documents`/Supabase read. So `owner-documents` (a private owner vault) and `property-documents`
   (the public property data-room + Verify buttons on PropertyDetail) are **two distinct surfaces**;
   building one does NOT wire the other. Flagged so they aren't conflated in the build.

---

**Summary:** `owner-documents` is a clean repoint — copy `LPDocument` + its 3 views + the
`rawUpload`/blob-download client pattern, swap `upload_to="owner_documents/%Y/%m/"` under the already
gitignored `backend/media/`, self-scope by `user=request.user`, drop the unused `property_id` (or
promote it to a real FK per Q3). It needs a NEW model/endpoint (no existing owner-docs backend) but
**no new storage mechanism**. PropertyDetail's Verify buttons are out of scope (separate satellite).
