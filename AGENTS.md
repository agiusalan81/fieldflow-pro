<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history: force pushing, or rebasing/amending/squashing commits
> that are already pushed: as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Analytics: owner-only coarse work counts; tenant identity server-derived. Outreach/feedback product-scoped; saved follow-ups send nothing.
- HQ uses product-scoped workspaces, owner-only directory/access RPCs and separate legal profiles; test resets retain operational, financial, identity, storage and offline evidence.
- App chrome uses neutral card surfaces (no gradients) with token-coloured controls; phone theme metadata matches the neutral bar colour because browser chrome cannot render gradients.
- Travel shares one component/startJobTravel; arrival saves the time log before on-site status; 
- Invite server functions/Query loaders have timeouts, middleware included; 
- Tenant RLS uses company_id/current_company_id(); never UI company filters; 
- Roles: protected user_roles; users.role is display-only; preview/permissions hide UI only. MemberSkills allows active tech/supervisor/maintenance under skills_dispatch guards.
- Role helpers/tenant policies reject terminated actors and audit access changes.
- Invites redeem names atomically via single-use signup triggers; social users need no password; verified names; no client-assigned tenant/role.
- Preview: real-superuser-only, actor-scoped, removable memory state; root blocks other screens/writes; 
- Payroll uses tested gross/Malta engines, office RLS, snapshots, HQ guards; roster RPC updates existing settings only; 
- Payroll routes share payroll-page.tsx. Opening leave/payslips save atomically with issued-slip/totals guards; year-qualified carry-forward prevents double consumption; 
- Sign-off/leave/overtime/checklist/renewals use tested jobsheets.ts; shared rules.
- DWR: one canonical report/shift; retain corrected/superseded originals; filing clears held flags; 
- Dispatch: lead plus optional assistant both read one sheet; only lead starts/edits; daily logs seed both initials; 
- Overtime uses captured DWR intervals/rules; old reports show associated sites only; factual allocation.
- Typography uses applyTypography/AppShell; locale uses locale.ts; 
- Branding shares asset-backed font IDs and preview/PDF decorations; DB/HQ locks protect saved values.
- Auth emails share auth-brand.tsx; the managed handler owns verification and dispatch for reliable account recovery.
- Company Settings retains visited sections while navigating; shared document-preview tabs power desktop and mobile previews; preserve drafts without implicit saves and keep previews consistent.
- Independent settings editors use settingsSectionPatch to write only owned columns; JSON styling saves merge current stored keys; 
- Numbers keep raw text until blur; suggestions use bounded RLS history and account/company cache keys.
- Service sheets share a typed safe projection/renderers for preview, print and email; 
- Pending works close via close_pending_on_followup trigger; sheet creation requires clock-in or standby; enforce without UI.
- Billing precedence in billing.ts; config in integrations.ts; job_sheets_guard_billing allows only office review; completed rows in the office Job sheets list open the shared BillingReview and saves refresh list/attention queries; protected prices and reachable review without dashboard tables.
- WhatsApp rules use tested whatsapp-templates.ts; AI/Meta calls use manager-only whatsapp-templates.functions.ts; validate consistently.
- Daily time logs keep technician_count separate from initials; labour uses headcount, DWR personal elapsed time; correct hours.
- Combined PDFs use email builder/RLS; office combines completed sheets for one client; 
- Client notices use client-notices.functions.ts and tested client-notices.ts; guard_departure prevents self-approval; 
- job_sheets embeds use users!job_sheets_assigned_technician_id_fkey; two users FKs.
- Signing batches: creator-owned, finalized transactionally; store delivery before sending via shared PDF builder; atomic, retry-safe delivery.
- Offline: account-scoped IndexedDB/optimistic RPC/PWA; confirmed discard atomically removes only that account/sheet draft/photos/cache; retain inaccessible drafts.
- Published document masters are immutable; attachments/agreements/sheets snapshot definitions; 
- Platform authority is protected separately in user_roles; HQ uses a narrow directory RPC, not tenant reads; 
- Plan access: DB write guards + plan-features.ts menu gating; legacy stays on. RFQ rules in lift-rfq.ts; 
- Client reports use immutable DB-built safe snapshots and hashed expiring/revocable links; photo paths stay server-only; 
- Sheet safety/checklist snapshots are checked at completion; safety keys share checklist_values; offline safety.
- Clock-in shares plate/consent helpers. Fleet appends active-shift GPS with module/tenant guards; mileage excludes jitter/gaps; 
- Receipts: account-scoped offline queues/private storage, HQ-gated writes, immutable attachments and original-page exports. Post-signature notes append privately, excluded from client projections.
- Technical library: private storage/RLS; publish checks real/displayed supervisor/superuser; AI reads approved pages as caller; 
- Leave/profile/clock-out handover rules use tested field-rules.ts plus guard_leave_decision; UI and DB agree.
- HQ uses app_url, PLAN_FEATURES and owner-only toggles; isStorageAddon separates storage-only packs, retaining mixed feature bundles.
- Attention: guarded atomic pending RPCs/separate actions; never edit signed content; 
- Dual-track on-call uses separate supervisor config without changing technician payroll history; rota.ts scopes swaps, is_on_standby covers both, audited saves and role-matched swaps require independent approval; leave impact/blackouts remain DB-validated.
- Equipment QR: private routes/RLS; hashed revocable public lookup exposes only reference/category; reports stay bounded/throttled; private technical/client data.
- Deletion shares record-deletion/DeleteVisit; office sheet and manager visit RLS apply; visit deletion keeps sheets, client-report FKs retain shared evidence.
- QR dispatch closes only its matching report after visit insert, refreshes attention and clears URL state; failures warn against duplicate dispatch.
- Chat compresses photos, not documents. Push uses a dedicated /push/ worker, retains legacy handlers, encrypts previews and tests only the caller's current device; provider acceptance is not delivery proof.
- FieldBridge subscription invoices live in platform_invoices (frozen once issued by trigger) with rules in tested saas-billing.ts; storage usage via company_storage_usage RPC; 
- Payments: superuser RLS checkout; signed webhook settles exact amounts idempotently; billing-daily runs renewals/charges/reminders; company_invoice_lapsed drives read-only.

- Public catalog/legal use narrow reads; HQ stays private. Trust pages share renderers; sitemap uses explicit route decisions, no generated lastmod.
- Staff signatures share staff-signature editors and own-user RPC; protected real roles govern eligibility and profile guards retain identity protection.

- Sheet autosave compares stable editing-state fingerprints and syncs only changed work; failed background sync never resurrects a removed/newer draft. Chat viewport fits the measured header and navigation on every breakpoint.

- PDF.js uses v4/canvasContext; newer Map APIs break field devices.
- PPM uses per-agreement asset plans and anchored, unique job occurrences generated transactionally by a manager RPC; existing jobs/sheets retain manual workflows and HQ module guards. SLA status is derived on read; component events are append-only private evidence.
- Portal accounts have no employee roles; guarded RPCs enforce client/site authority, verified invites and current module access to isolate clients.
- Delivery uses client_message_recipients; preferences choose recipients, not unsupported channel delivery.
- Own-shift RPC captures one-time GPS; failure never blocks clock-out; history distinguishes action fixes from breadcrumbs.
- Tenant cards separate assignments/access; bespoke drafts freeze on submit, HQ reviews per product, samples stay private. Requests never charge/activate. Immediate setup is owner-only; ordinary setup retains timing/trial mode.
