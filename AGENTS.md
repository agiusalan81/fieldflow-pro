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
- Navigation consumes authorized menu items; flyouts/touch shortcuts share workspace-shortcuts.ts with URL-selected tabs — why: tier/Coming soon guards stay authoritative without duplicate screens.
- Company settings use four workspace tabs and retain visited editors mounted; related client records are bounded, RLS-scoped read-only lists with existing detail links — why: reorganization preserves unsaved edits and record history.
- Email identity resolves server-side via company_email_branding plus HQ override; managed sends keep verified From, Gmail keeps its mailbox From — why: no forced-identity bypass or spoofing.
- Quote photos use private immutable storage metadata and frozen snapshot IDs/captions, with customer URLs resolved only after token or portal authorization — why: previews and PDFs must share evidence without exposing unrelated file paths.
- Navigation-only role exclusions use role-menu.ts for sidebar/mobile shortcuts; they never change page authorization. Legacy quote drafts default missing editor fields on read, leaving issued snapshots and write validation unchanged.
- Analytics: owner-only coarse counts; server-derived tenant. Product-scoped outreach/feedback; saved follow-ups send nothing.
- HQ: product-scoped workspaces, owner-only RPCs, separate legal profiles.
- Chrome: neutral surfaces/token controls; phone theme matches neutral bar, never gradients.
- Travel shares startJobTravel; arrival saves time before on-site status.
- Invite functions/loaders use timeouts and middleware.
- Tenant RLS uses company_id/current_company_id(); never UI company filters; 
- Roles: protected user_roles; users.role is display-only. Manager-only MemberSkills uses module guards; additions never assign; removal archives for history.
- Atomic handover reviews jobs/rotas/shifts, preserving history; active-only rota choices share day validation. Snooze is recipient-only; alerts target each request.
- Invites redeem names atomically via single-use signup triggers; social users need no password; verified names; no client-assigned tenant/role.
- Preview: real-superuser-only, actor-scoped, removable memory state; root blocks other screens/writes; 
- Payroll uses tested gross/Malta engines, office RLS, snapshots, HQ guards; roster RPC updates existing settings only; 
- Payroll routes share payroll-page.tsx. Opening leave/payslips save atomically with issued-slip/totals guards; year-qualified carry-forward prevents double consumption; 
- Sign-off/leave/overtime/checklist/renewals use tested jobsheets.ts; shared rules.
- DWR: one canonical report/shift; retain corrected/superseded originals; filing clears held flags; 
- Dispatch: lead/assistant share one sheet; lead edits, logs seed both. Null dates use Unscheduled queue; atomic quote conversion retains frozen billing prices — why: scheduling can wait. 
- Overtime uses captured DWR intervals/rules; old reports show associated sites only; factual allocation.
- Typography: applyTypography/AppShell; locale: locale.ts.
- Branding shares asset-backed font IDs and preview/PDF decorations; DB/HQ locks protect saved values.
- Auth emails share auth-brand.tsx; the managed handler owns verification and dispatch for reliable account recovery.
- Shared document-preview tabs serve desktop/mobile; no implicit draft saves.
- Independent settings editors use settingsSectionPatch to write only owned columns; JSON styling saves merge current stored keys; 
- Numbers keep raw text until blur; UnitSelect shares trade-aware presets/bounded RLS history — why: no cross-trade defaults.
- Service sheets share a typed safe projection/renderers for preview, print and email; 
- Pending works close via close_pending_on_followup trigger; sheet creation requires clock-in or standby; enforce without UI.
- Billing precedence in billing.ts, config in integrations.ts; job_sheets_guard_billing allows office review only; completed office list rows open shared BillingReview.
- WhatsApp rules use tested whatsapp-templates.ts; AI/Meta calls use manager-only whatsapp-templates.functions.ts; validate consistently.
- Daily time logs keep technician_count separate from initials; labour uses headcount, DWR personal elapsed time; correct hours.
- Combined PDFs use email builder/RLS; office combines completed sheets for one client; 
- Client notices use client-notices.functions.ts and tested client-notices.ts; guard_departure prevents self-approval; 
- job_sheets embeds use users!job_sheets_assigned_technician_id_fkey; two users FKs.
- Signing batches: creator-owned, finalized transactionally; store delivery before sending via shared PDF builder; atomic, retry-safe delivery.
- Offline: account-scoped IndexedDB/optimistic RPC/PWA; confirmed discard atomically removes only that account/sheet draft/photos/cache; retain inaccessible drafts.
- Masters immutable except names; shared document-blocks pricing/tags/copies; compact site actions reuse DocumentMasters with client/site preselected and existing office/DB guards — why: no duplicated attachment workflow.
- Platform authority is protected separately in user_roles; HQ uses a narrow directory RPC, not tenant reads; 
- Plan access: DB write guards + plan-features.ts menu gating; legacy stays on. RFQ rules in lift-rfq.ts; 
- Client reports use immutable DB-built safe snapshots and hashed expiring/revocable links; photo paths stay server-only; 
- Sheet safety/checklist snapshots are checked at completion; safety keys share checklist_values; offline safety.
- Clock-in shares plate/consent helpers. Fleet appends active-shift GPS with module/tenant guards; mileage excludes jitter/gaps; 
- ExpenseCapture shares date/amount/category across stash/sheets; private receipts stay HQ-gated and immutable; post-signature notes never reach clients.
- Technical library: private storage/RLS; publish checks real/displayed supervisor/superuser; AI reads approved pages as caller; 
- Leave/profile/clock-out handover rules use tested field-rules.ts plus guard_leave_decision; UI and DB agree.
- HQ merges registry/product/catalog module keys; catalog writes register keys atomically. Owner-only toggles; isStorageAddon separates storage packs.
- Attention: guarded atomic pending RPCs/separate actions; never edit signed content; 
- Rota: supervisor config separate from payroll; swaps apply atomically with audit.
- Equipment QR: private routes/RLS; hashed revocable public lookup exposes only reference/category; reports stay bounded/throttled; private technical/client data.
- Deletion shares record-deletion/DeleteVisit; office sheet and manager visit RLS apply; visit deletion keeps sheets, client-report FKs retain shared evidence.
- QR dispatch closes only its matching report after visit insert, refreshes attention and clears URL state; failures warn against duplicate dispatch.
- Chat compresses photos only. Push: dedicated /push/ worker, encrypted previews; acceptance is not delivery proof. Audio unlocks on gestures.
- FieldBridge subscription invoices live in platform_invoices (frozen once issued by trigger) with rules in tested saas-billing.ts; storage usage via company_storage_usage RPC; 
- Payments: superuser RLS checkout; signed webhook settles exact amounts idempotently; billing-daily runs renewals/charges/reminders; company_invoice_lapsed drives read-only.
- Public catalog/legal use narrow reads; HQ stays private. Trust pages share renderers; sitemap uses explicit route decisions, no generated lastmod.
- Staff signatures share staff-signature editors and own-user RPC; protected real roles govern eligibility and profile guards retain identity protection.
- Sheet sync serializes per account/sheet, rebasing local versions only. Autosave uses dirty fingerprints; failures retain newer drafts.
- PDF.js uses v4/canvasContext; newer Map APIs break field devices.
- PPM: per-agreement asset plans; manager RPC generates unique anchored jobs transactionally; SLA derived on read; component events append-only.
- StaffContacts/contact-editor own contact writes; portal scope is staff-only. HQ setup options save atomically; staff/portal access stays independent.
- Delivery uses client_message_recipients; preferences choose recipients, not unsupported channel delivery.
- Own-shift RPC captures one-time GPS; failure never blocks clock-out; history distinguishes action fixes from breadcrumbs.
- Bespoke requests freeze on submit, stay private, never charge/activate; immediate setup is owner-only.
- Surveys: guard_site_survey protects manager pricing/trade_review; field_details snapshots contacts/sites atomically; supplier quotes stay internal.
- Sites render via site-display.ts; portal edits only store_code. Approvals use category/object links; completed field-sheet history is company-controlled restrictive RLS.
- Asset limits: platform_catalog.asset_limit (plan NULL=unlimited, pack=extra) enforced by assets_guard_limit trigger; trials/legacy unlimited.
- Core quotes use safe frozen snapshots and atomic RPCs; phone acceptance permits token confirmation without portal access — why: require written confirmation without blocking Core jobs.
- HQ module composition uses shared layer/domain taxonomy and one tier-or-pack matrix; customer_quotes inherits Core entitlement so the display split never creates a new paid gate.
- Per-member CRM access: user_roles.crm_access (null = role default) via my_crm_access()/crm_can(), enforced by RLS/RPCs, mirrored in crm.ts — why: CRM powers vary without changing primary role.
- Protected per-member RPCs/RLS govern estimates, contracts and dispatch; field eligibility is separate, CRM levels persist — why: primary roles still drive payroll/rota.
- CRM rules in tested src/lib/crm.ts; manager-only RLS guarded by guard_module_write_additional('crm_pipeline'); crm_mark_won/lost RPCs keep conversions atomic.
- Lift costing templates (lift_costing_templates) only seed sheet defaults; sheets copy values so editing/deleting a template never changes saved sheets or issued quotes. Proposal branding follows company_module_access('branding_documents') — why: vertical customisation is pack-gated, branding is tier-gated.
