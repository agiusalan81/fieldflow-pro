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
- Payroll uses tested payroll.ts/payroll-statutory.ts rules, office-only tenant RLS, DWR worked hours, versioned rosters and office-approved annual tables; category suggestions require review. Why: prevent disclosure, double-counting and retrospective changes.
- User preview is removable, real-superuser-only, in-memory and actor-scoped with opt-in reads; the root blocks other screens. Why: inspect without changing sessions, offline ownership or audit identity.
- Tenant isolation is enforced by RLS on company_id via current_company_id(); UI never filters by company itself. Why: one source of truth for access.
- Roles live only in public.user_roles; RLS uses has_role/has_company_role/is_company_manager. users.role is a deprecated display mirror. Why: profile roles enable privilege escalation.
- "View As" mode and the per-role module switches (role_permissions, src/lib/permissions.ts) are UI visibility only; data access always comes from user_roles in RLS. Why: a display setting must never grant data access.
- Staff join via single-use invite tokens redeemed in the auth signup trigger. Why: role assignment must happen server-side.
- Sign-off, leave/balance, overtime, checklist and renewal rules live in tested src/lib/jobsheets.ts. Why: separate rules from screens.
- Tenant typography lives in company_settings.theme and is applied as --tenant-* CSS variables by AppShell (applyTypography in src/lib/company.ts). Why: one place styles every screen without touching components.
- Pending works close automatically via the close_pending_on_followup DB trigger when the linked follow-up sheet completes. Why: works even if the technician's app closes mid-submit.
- Client PDF layout, T&Cs and note presets live in company_settings (pdf_template/terms/note_presets) and are parsed only through src/lib/documents.ts. Why: the settings editor and the email PDF must read them identically.
- src/lib/dwr-report.ts files DWR at clock-out; dwr_sheet_entries() matches initials for assisting time. Why: one ledger without duplicate sheets.
- DWR, breaks, sheet search and standby rules live in tested src/lib/dwr.ts. Why: separate rules from screens.
- Clock-in before creating a job sheet is enforced by the job_sheets_require_clock_in DB trigger for every role. Why: UI checks alone can be bypassed.

- Billing pricing rules (estimate > contract > client rate card > company default) live in src/lib/billing.ts; integrations config and message templates are parsed only through src/lib/integrations.ts. Why: review screen, settings and future exports must price and render identically.
- Only office admins may change job-sheet billing review fields, enforced by the job_sheets_guard_billing trigger. Why: UI checks alone can be bypassed.
- WhatsApp template rules (placeholders, samples, naming) live in src/lib/whatsapp-templates.ts with tests; AI drafting and Meta calls run only in whatsapp-templates.functions.ts for managers. Why: drafter UI and submit validate identically.
- Daily time logs store technician_count separately from initials; shared staffing helpers calculate labour while DWR retains elapsed personal time. Why: headcount and named assisting staff serve different purposes.
- Combined job-sheet download/email uses the shared email PDF builder and authenticated RLS reads; only office roles can combine completed sheets for one client. Why: prevent cross-client disclosure and inconsistent client copies.
- Field client notices (no access, left unsigned) are sent only via src/lib/client-notices.functions.ts; approval rules live in src/lib/client-notices.ts with tests, and the guard_departure trigger blocks technicians from approving their own departure. Why: technician accountability can't rely on UI.
- job_sheets has two FKs to users; always embed as users!job_sheets_assigned_technician_id_fkey(...). Why: an unhinted embed fails.
- Monthly signing batches are authenticated, creator-owned records finalized with transactional signing and the shared PDF builder; delivery state is stored before sending. Why: preserves partial sessions and prevents duplicate automatic emails.
- Offline draft snapshots are account-scoped in IndexedDB and sync through an optimistic-locking transactional RPC; registration lives only in the guarded PWA wrapper. Why: avoids cross-account replay, partial saves, stale overwrites and preview caches.

- Payroll leaf routes share src/components/payroll-page.tsx. Why: one private payroll experience.
- Overtime site details use stored DWR activity intervals and their captured rules; historical reports without rules show associated shift sites only. Why: never invent site allocation or recalculate old totals from changed rules.
- Leave opening carry-forward is year-qualified on the shared balance; payslips snapshot leave without consuming it again. Why: approved requests already drive leave usage.

- Payroll/opening leave save via an invoker-rights transaction; a trigger blocks issued-slip edits/deletes and mismatched totals. Why: prevent partial saves and preserve reviewed records.
