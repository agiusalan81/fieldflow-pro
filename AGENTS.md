<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Travel shares one component/startJobTravel; arrival saves the time log before on-site status. Why: consistent travel/arrival.
- Invite server functions/Query loaders have timeouts, including middleware. Why: prevent hangs.
- Tenant RLS uses company_id/current_company_id(); never UI company filters. Why: one access boundary.
- Roles live in protected user_roles; users.role is display-only. View As and permissions.ts only hide UI. Why: safe privileges.
- user_roles helpers/restrictive tenant policies reject terminated actors; audit access changes. Why: session revocation.
- Invites redeem names atomically via single-use signup triggers; social users need no password. Why: verified names; no client-assigned tenant/role.
- Preview: real-superuser-only, actor-scoped, removable memory state; root blocks other screens/writes. Why: preserve identity.
- Payroll uses tested gross/Malta engines, office RLS, DWRs, currency/mode snapshots and HQ guards. Roster RPC updates existing settings only. Why: preserve pay and roster access.
- Payroll routes share payroll-page.tsx. Opening leave/payslips save atomically with issued-slip/totals guards; year-qualified carry-forward prevents double consumption. Why: immutable issued pay.
- Sign-off/leave/overtime/checklist/renewals use tested jobsheets.ts. Why: shared rules.
- DWR: one canonical report/shift; retain corrected/superseded originals; filing clears held flags. Why: retry-safe hours/pay.
- Dispatch: lead plus optional assistant both read one sheet; only lead starts/edits; daily logs seed both initials. Why: one journey/labour ledger.
- Overtime uses captured DWR intervals/rules; old reports show associated sites only. Why: factual allocation.
- Typography uses applyTypography/AppShell; locale uses locale.ts. Why: tenant presentation.
- Branding shares theme/template JSON, private tenant files and PDF/font helpers; DB/HQ locks preserve saved values. Why: secure app/PDF consistency.
- Service sheets share a typed safe projection/renderers for preview, print and email. Why: client-safe consistency.
- Pending works close via close_pending_on_followup trigger; sheet creation requires clock-in or standby. Why: enforce without UI.
- Billing uses billing.ts precedence: estimate > contract > client > company default. Integration config uses integrations.ts; job_sheets_guard_billing allows only office review changes. Why: protected prices.
- WhatsApp rules use tested whatsapp-templates.ts; AI/Meta calls use manager-only whatsapp-templates.functions.ts. Why: validate consistently.
- Daily time logs keep technician_count separate from initials; labour uses headcount, DWR personal elapsed time. Why: correct hours.
- Combined PDFs use email builder/RLS; office combines completed sheets for one client. Why: client isolation.
- Client notices use client-notices.functions.ts and tested client-notices.ts; guard_departure prevents self-approval. Why: accountability.
- job_sheets embeds use users!job_sheets_assigned_technician_id_fkey. Why: two users FKs.
- Signing batches are creator-owned, authenticated and finalized transactionally; store delivery before sending with shared PDF builder. Why: atomic, retry-safe delivery.
- Offline: account-scoped IndexedDB/optimistic RPC/PWA; confirmed discard atomically removes only that account/sheet draft/photos/cache. Why: retain inaccessible drafts.
- Published document masters are immutable; attachments/agreements/sheets snapshot definitions. Why: preserve history.
- Platform authority is protected separately in user_roles; HQ uses a narrow directory RPC, not tenant reads. Why: isolate companies.
- Plan access: DB write guards + plan-features.ts menu gating; legacy stays on. RFQ rules in lift-rfq.ts. Why: safe rollout.
- Client reports use immutable DB-built safe snapshots and hashed expiring/revocable links; photo paths stay server-only. Why: no internal disclosure.
- Sheet safety/checklist snapshots are checked at completion; safety keys share checklist_values. Why: offline safety.

- Clock-in shares plate/consent helpers. Fleet appends active-shift GPS with module/tenant guards; mileage excludes jitter/gaps. Why: honest isolated tracking.
- Receipt PDFs: separate account/sheet IndexedDB queue/private storage; exclude from client projections. Why: private offline receipts.
- Technical library: private storage/RLS; publish checks real/displayed supervisor/superuser; AI reads approved pages as caller. Why: secure View As.
- Leave/profile/clock-out handover rules use tested field-rules.ts plus guard_leave_decision. Why: UI and DB agree.

- HQ uses single-active fallback, app_url, PLAN_FEATURES and NativeSelect/Cancel; owner-only row-locked toggle RPCs refresh access. Why: isolated prices/seats.

- Attention: guarded atomic pending RPCs/separate actions; never edit signed content. Why: immutable evidence; no duplicate dispatch.
- Blackouts and leave impact are validated in DB; range swaps use recipient acceptance plus independent manager approval before standby calculations change. Why: enforce for every caller.
- Equipment QR: authenticated/RLS-scoped technical routes; public reports use hashed revocable capabilities, bounded payloads/throttling; no public reads. Why: private technical/client data.
