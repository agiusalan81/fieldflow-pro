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
- Tenant isolation is enforced by RLS on company_id via current_company_id(); UI never filters by company itself. Why: one source of truth for access.
- Roles live only in public.user_roles (superuser/admin/supervisor/technician), read by has_role/has_company_role/is_company_manager in RLS; users.role is a deprecated display mirror. Why: roles on the profile table enable privilege escalation.
- "View As" mode and the per-role module switches (role_permissions, src/lib/permissions.ts) are UI visibility only; data access always comes from user_roles in RLS. Why: a display setting must never grant data access.
- Staff join via single-use invite tokens redeemed in the auth signup trigger. Why: role assignment must happen server-side.
- Job sheet business rules (sign-off validation, leave hours, balance, overtime split, checklist, renewal window) live in src/lib/jobsheets.ts with tests beside it. Why: keeps rules testable apart from screens.
- Tenant typography lives in company_settings.theme and is applied as --tenant-* CSS variables by AppShell (applyTypography in src/lib/company.ts). Why: one place styles every screen without touching components.
- Pending works close automatically via the close_pending_on_followup DB trigger when the linked follow-up sheet completes. Why: works even if the technician's app closes mid-submit.
- Client PDF layout, T&Cs and note presets live in company_settings (pdf_template/terms/note_presets) and are parsed only through src/lib/documents.ts. Why: the settings editor and the email PDF must read them identically.
- Daily works reports are filed client-side at clock-out (src/lib/dwr-report.ts) into daily_work_reports; assisting-tech time comes from dwr_sheet_entries() matching time-log initials. Why: one ledger managers can filter, no second job sheet needed.
- DWR, mandatory-break, sheet-search and standby-rotation rules live in src/lib/dwr.ts with tests beside it. Why: keeps rules testable apart from screens.
- Clock-in before creating a job sheet is enforced by the job_sheets_require_clock_in DB trigger for every role. Why: UI checks alone can be bypassed.

- Billing pricing rules (estimate > contract > client rate card > company default) live in src/lib/billing.ts; integrations config and message templates are parsed only through src/lib/integrations.ts. Why: review screen, settings and future exports must price and render identically.
- Only office admins may change job-sheet billing review fields, enforced by the job_sheets_guard_billing trigger. Why: UI checks alone can be bypassed.
- WhatsApp template rules (placeholders, samples, naming) live in src/lib/whatsapp-templates.ts with tests; AI drafting and Meta calls run only in whatsapp-templates.functions.ts for managers. Why: drafter UI and submit validate identically.
