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
- "View As" mode is UI-only (localStorage); real permissions always come from the users.role column checked in RLS. Why: a simulation switch must never grant data access.
- Job sheet business rules (sign-off validation, leave hours, balance) live in src/lib/jobsheets.ts with tests beside it. Why: keeps rules testable apart from screens.
