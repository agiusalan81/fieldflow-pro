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
- Assigned-job travel actions share one component and startJobTravel helper; sheet arrival saves its time log before changing to on-site status. Why: keep Today and Schedule consistent without treating travel as arrival.
- Public invitation reads use a bounded server-function lookup and Query-backed route loading; timeout covers client middleware too. Why: stalls must not hang invitations.
- Tenant RLS uses company_id/current_company_id(); never UI company filters. Why: one access boundary.
- Roles live in protected user_roles; users.role is display-only. View As and permissions.ts only hide UI. Why: prevent escalation.
- Registration state lives in protected user_roles; central helpers and restrictive tenant policies reject terminated actors, and access changes retain audited history. Why: old sessions cannot bypass revocation.
- Invite name confirmation uses atomic named redemption; social users never need an app password. Why: save confirmed names without trusting client-supplied company or role.
- Staff redeem single-use invites through signup triggers. Why: server-side role assignment.
- User preview is real-superuser-only, actor-scoped, in-memory and removable; root blocks other screens/writes. Why: preserve sessions/audit identity.
- Payroll uses tested payroll.ts/payroll-statutory.ts, office RLS, DWR hours, versioned rosters and reviewed annual tables/categories. Why: preserve reviewed payroll.
- Payroll routes share payroll-page.tsx. Opening leave/payslips save transactionally with issued-slip/totals guards; year-qualified carry-forward doesn't consume leave twice. Why: no partial or retrospective changes.
- Sign-off/leave/overtime/checklist/renewals use tested jobsheets.ts. Why: shared rules.
- DWR/breaks/search/standby/clock-out use tested dwr.ts and dwr-report.ts; held shifts and assisting initials share one ledger. Why: retain callout hours.
- Overtime site details use captured DWR intervals/rules; older reports show associated sites only. Why: never invent allocation.
- Tenant typography uses company_settings.theme via applyTypography/AppShell CSS variables; locale uses locale.ts. Why: tenant-configured presentation.
- Documents/styles/labels/terms/presets use company_settings and documents.ts across forms/PDFs. Why: consistent client wording.
- Standard Service Sheet shares a typed safe document projection and service renderers across previews, print and email PDFs. Why: consistent client-safe output.
- Pending works close via close_pending_on_followup trigger; sheet creation requires clock-in or standby. Why: enforce without UI.
- Billing uses billing.ts precedence: estimate > contract > client > company default. Integration config uses integrations.ts; job_sheets_guard_billing allows only office review changes. Why: uniform protected prices.
- WhatsApp rules use tested whatsapp-templates.ts; AI/Meta calls use manager-only whatsapp-templates.functions.ts. Why: validate consistently.
- Daily time logs keep technician_count separate from initials; labour uses headcount, DWR personal elapsed time. Why: prevent double-counting.
- Combined PDFs use email PDF builder/RLS; office roles combine completed sheets for one client. Why: prevent disclosure.
- Client notices use client-notices.functions.ts and tested client-notices.ts; guard_departure prevents self-approval. Why: accountability.
- job_sheets embeds use users!job_sheets_assigned_technician_id_fkey. Why: two users FKs.
- Signing batches are creator-owned, authenticated and finalized transactionally; store delivery before sending with shared PDF builder. Why: preserve partial work and prevent duplicate email.
- Offline drafts use account-scoped IndexedDB, transactional optimistic RPC and guarded PWA registration. Why: no cross-account replay/stale writes.
- Published document masters are immutable; attachments/agreements/sheets snapshot definitions. Why: preserve history.
- Platform authority is protected separately in user_roles; HQ uses a narrow directory RPC, not tenant reads. Why: isolate companies.
- Subscription/pack/promotion access uses DB write guards; missing legacy subscriptions stay writable. Why: safe rollout.
- Client reports use immutable DB-built safe snapshots and hashed expiring/revocable links; photo paths stay server-only. Why: no internal disclosure.
- Sheet safety/checklist snapshots are checked at completion; safety keys share checklist_values. Why: preserve offline saves.

- Shift locations require active-shift RLS and account-scoped consent; stale map points are labelled. Why: no off-shift visibility or fabricated GPS.
- Receipt PDFs use a separate account/sheet-scoped IndexedDB queue and private storage, never client document projections. Why: preserve offline attachments without exposing accounting files.
- Technical documents use private storage and active-member RLS; only supervisors/superusers publish, and AI retrieves readable approved pages through the caller client. Why: restrictions apply equally to search, files and citations.
- Leave/profile/clock-out handover rules use tested field-rules.ts plus guard_leave_decision. Why: UI and DB agree.
