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
