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
- Analytics stores coarse subscription/day feature counts and lifetime usage totals; owner-only reporting and server-derived tenant identity prevent cross-company tracking, and actual work counts come from insert triggers rather than page visits. Outreach templates and feedback are product-scoped; no automated offers or emails are implied by a saved follow-up.
- HQ uses product-scoped workspaces, owner-authorized narrow directory/effective-access RPCs, and separate platform legal profiles; audited test resets allow only unused/unsent records and retain operational, financial, identity, storage and offline evidence.
- App chrome uses neutral card surfaces (no gradients) with token-coloured controls; phone theme metadata matches the neutral bar colour because browser chrome cannot render gradients.
- Travel shares one component/startJobTravel; arrival saves the time log before on-site status.: consistent travel/arrival.
- Invite server functions/Query loaders have timeouts, middleware included.: prevent hangs.
- Tenant RLS uses company_id/current_company_id(); never UI company filters.: one access boundary.
- Roles live in protected user_roles; users.role is display-only; View As/permissions.ts hide UI only. Shared MemberSkills permits active technician/supervisor assignments with HQ skills_dispatch read/write guards.
- user_roles helpers/restrictive tenant policies reject terminated actors; audit access changes.: session revocation.
- Invites redeem names atomically via single-use signup triggers; social users need no password.: verified names; no client-assigned tenant/role.
- Preview: real-superuser-only, actor-scoped, removable memory state; root blocks other screens/writes.: preserve identity.
- Payroll uses tested gross/Malta engines, office RLS, snapshots, HQ guards; roster RPC updates existing settings only.: preserve pay and roster access.
- Payroll routes share payroll-page.tsx. Opening leave/payslips save atomically with issued-slip/totals guards; year-qualified carry-forward prevents double consumption.: immutable issued pay.
- Sign-off/leave/overtime/checklist/renewals use tested jobsheets.ts.: shared rules.
- DWR: one canonical report/shift; retain corrected/superseded originals; filing clears held flags.: retry-safe hours/pay.
- Dispatch: lead plus optional assistant both read one sheet; only lead starts/edits; daily logs seed both initials.: one journey/labour ledger.
- Overtime uses captured DWR intervals/rules; old reports show associated sites only.: factual allocation.
- Typography uses applyTypography/AppShell; locale uses locale.ts.: tenant presentation.
- Branding shares theme/template JSON, private tenant files and PDF/font helpers; DB/HQ locks preserve saved values.: secure app/PDF consistency.
- Company Settings retains visited sections while navigating; shared document-preview tabs power desktop and mobile previews.: preserve drafts without implicit saves and keep previews consistent.
- Independent settings editors use settingsSectionPatch to write only owned columns; JSON styling saves merge current stored keys.: prevent stale hidden editors overwriting other sections.
- Controlled number inputs retain raw editing text until blur; optional previous-entry suggestions read bounded RLS-scoped history with account/company cache keys.: easy replacement without changing access boundaries.
- Service sheets share a typed safe projection/renderers for preview, print and email.: client-safe consistency.
- Pending works close via close_pending_on_followup trigger; sheet creation requires clock-in or standby.: enforce without UI.
- Billing precedence in billing.ts; config in integrations.ts; job_sheets_guard_billing allows only office review; completed rows in the office Job sheets list open the shared BillingReview and saves refresh list/attention queries.: protected prices and reachable review without dashboard tables.
- WhatsApp rules use tested whatsapp-templates.ts; AI/Meta calls use manager-only whatsapp-templates.functions.ts.: validate consistently.
- Daily time logs keep technician_count separate from initials; labour uses headcount, DWR personal elapsed time.: correct hours.
- Combined PDFs use email builder/RLS; office combines completed sheets for one client.: client isolation.
- Client notices use client-notices.functions.ts and tested client-notices.ts; guard_departure prevents self-approval.: accountability.
- job_sheets embeds use users!job_sheets_assigned_technician_id_fkey.: two users FKs.
- Signing batches: creator-owned, finalized transactionally; store delivery before sending via shared PDF builder.: atomic, retry-safe delivery.
- Offline: account-scoped IndexedDB/optimistic RPC/PWA; confirmed discard atomically removes only that account/sheet draft/photos/cache.: retain inaccessible drafts.
- Published document masters are immutable; attachments/agreements/sheets snapshot definitions.: preserve history.
- Platform authority is protected separately in user_roles; HQ uses a narrow directory RPC, not tenant reads.: isolate companies.
- Plan access: DB write guards + plan-features.ts menu gating; legacy stays on. RFQ rules in lift-rfq.ts.: safe rollout.
- Client reports use immutable DB-built safe snapshots and hashed expiring/revocable links; photo paths stay server-only.: no internal disclosure.
- Sheet safety/checklist snapshots are checked at completion; safety keys share checklist_values.: offline safety.
- Clock-in shares plate/consent helpers. Fleet appends active-shift GPS with module/tenant guards; mileage excludes jitter/gaps.: honest isolated tracking.
- Receipt PDFs: separate account/sheet IndexedDB queue/private storage; exclude from client projections.: private offline receipts.
- Technical library: private storage/RLS; publish checks real/displayed supervisor/superuser; AI reads approved pages as caller.: secure View As.
- Leave/profile/clock-out handover rules use tested field-rules.ts plus guard_leave_decision.: UI and DB agree.
- HQ uses single-active fallback, app_url, PLAN_FEATURES and NativeSelect/Cancel; owner-only row-locked toggle RPCs refresh access.: isolated prices/seats.
- Attention: guarded atomic pending RPCs/separate actions; never edit signed content.: immutable evidence; no duplicate dispatch.
- Dual-track on-call uses separate supervisor config without changing technician payroll history; rota.ts scopes swaps, is_on_standby covers both, audited saves and role-matched swaps require independent approval; leave impact/blackouts remain DB-validated.
- Equipment QR: authenticated/RLS-scoped technical routes; public reports use hashed revocable capabilities, bounded payloads/throttling; no public reads.: private technical/client data.
- QR dispatch closes only the matching equipment report after a successful visit insert, refreshes all attention queries and clears dispatch search parameters; a failed report close warns without inviting duplicate dispatch.
- Chat files use private tenant/uploader keys and message-authorized downloads; validated attachments/contact cards stay internal. Web Push encrypts previews (RFC8291, WEB_PUSH_SEED, push-sw.js); attachment alerts reveal only type.
- FieldBridge subscription invoices live in platform_invoices (frozen once issued by trigger) with rules in tested saas-billing.ts; storage usage via company_storage_usage RPC.: immutable billing history.
- FieldBridge payments: invoice checkout in payments.functions.ts (superuser via RLS), signed webhook at api/public/payments/webhook settles only exact-amount matches idempotently; daily cron api/public/jobs/billing-daily runs saas-billing.server.ts (renewals, overdue, saved-card charges, reminder emails); company_invoice_lapsed() drives read-only access.: server-verified payment state and one entitlement source.

- Landing page reads pricing live: anon SELECT policy `catalog_public_read` (state=active only) on platform_catalog + listPublicCatalog server fn (publishable client); index.tsx falls back to static copy if the fetch fails.
