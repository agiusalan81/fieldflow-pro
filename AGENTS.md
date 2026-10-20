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
- Travel shares one component/startJobTravel; arrival saves the time log before on-site status. Why: Today/Schedule parity without premature arrival.
- Invitation reads use bounded server functions and Query loaders; timeout includes client middleware. Why: prevent hangs.
- Tenant RLS uses company_id/current_company_id(); never UI company filters. Why: one access boundary.
- Roles live in protected user_roles; users.role is display-only. View As and permissions.ts only hide UI. Why: prevent escalation.
- Protected user_roles registration, central helpers and restrictive tenant policies reject terminated actors; audit access changes. Why: revoke old sessions safely.
- Invite name confirmation uses atomic named redemption; social users never need an app password. Why: save confirmed names without trusting client-supplied company or role.
- Staff redeem single-use invites through signup triggers. Why: server-side role assignment.
- User preview is real-superuser-only, actor-scoped, in-memory and removable; root blocks other screens/writes. Why: preserve sessions/audit identity.
- Payroll uses tested shared gross/Malta engines, office RLS and DWRs; snapshots capture currency/mode; HQ guards Malta compliance. Why: preserve issued pay and separate gross from statutory net.
- Payroll routes share payroll-page.tsx. Opening leave/payslips save transactionally with issued-slip/totals guards; year-qualified carry-forward doesn't consume leave twice. Why: no partial or retrospective changes.
- Sign-off/leave/overtime/checklist/renewals use tested jobsheets.ts. Why: shared rules.
- DWR/breaks/search/standby/clock-out use tested dwr.ts and dwr-report.ts; held shifts and assisting initials share one ledger. Why: retain callout hours.
- Overtime site details use captured DWR intervals/rules; older reports show associated sites only. Why: never invent allocation.
- Tenant typography uses applyTypography/AppShell variables; locale uses locale.ts. Why: company presentation.
- Branding shares theme/template JSON, private tenant files and PDF/font helpers; DB/HQ locks preserve saved values. Why: secure consistent app/PDF customisation.
- Service sheets share a typed safe projection/renderers for preview, print and email. Why: client-safe consistency.
- Pending works close via close_pending_on_followup trigger; sheet creation requires clock-in or standby. Why: enforce without UI.
- Billing uses billing.ts precedence: estimate > contract > client > company default. Integration config uses integrations.ts; job_sheets_guard_billing allows only office review changes. Why: uniform protected prices.
- WhatsApp rules use tested whatsapp-templates.ts; AI/Meta calls use manager-only whatsapp-templates.functions.ts. Why: validate consistently.
- Daily time logs keep technician_count separate from initials; labour uses headcount, DWR personal elapsed time. Why: prevent double-counting.
- Combined PDFs use email PDF builder/RLS; office roles combine completed sheets for one client. Why: prevent disclosure.
- Client notices use client-notices.functions.ts and tested client-notices.ts; guard_departure prevents self-approval. Why: accountability.
- job_sheets embeds use users!job_sheets_assigned_technician_id_fkey. Why: two users FKs.
- Signing batches are creator-owned, authenticated and finalized transactionally; store delivery before sending with shared PDF builder. Why: no partial loss or duplicate email.
- Offline: account-scoped IndexedDB/optimistic RPC/PWA; confirmed discard removes only that account/sheet draft, photos/cache atomically. Why: preserve inaccessible drafts.
- Published document masters are immutable; attachments/agreements/sheets snapshot definitions. Why: preserve history.
- Platform authority is protected separately in user_roles; HQ uses a narrow directory RPC, not tenant reads. Why: isolate companies.
- Plan access: DB write guards + plan-features.ts menu gating; legacy stays on. RFQ rules in lift-rfq.ts. Why: safe rollout.
- Client reports use immutable DB-built safe snapshots and hashed expiring/revocable links; photo paths stay server-only. Why: no internal disclosure.
- Sheet safety/checklist snapshots are checked at completion; safety keys share checklist_values. Why: preserve offline saves.

- Clock-in shares plate/consent helpers. Fleet appends active-shift GPS with module/tenant guards; mileage excludes jitter/gaps. Why: honest isolated tracking.
- Receipt PDFs use a separate account/sheet-scoped IndexedDB queue and private storage, never client document projections. Why: preserve offline attachments without exposing accounting files.
- Technical library uses private storage/RLS; publishing UI checks real and displayed supervisor/superuser roles; AI reads approved pages as caller. Why: secure access and consistent View As.
- Leave/profile/clock-out handover rules use tested field-rules.ts plus guard_leave_decision. Why: UI and DB agree.

- HQ uses single-active fallback, app_url, PLAN_FEATURES and NativeSelect/Cancel; owner-only row-locked toggle RPCs refresh access. Why: isolation; preserve prices/seats.
