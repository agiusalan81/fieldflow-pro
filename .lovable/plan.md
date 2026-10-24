# Implement the 12 testing fixes

## Device setup, signup and navigation
1. **Device-aware setup:** distinguish desktop/laptop browsers from phones; allow desktop users to continue when notifications are blocked, with suitable instructions. Keep notification and location choices honest about browser limitations.
2. **Signup passwords:** add confirmation, independent show/hide controls and mismatch validation to company and employee email signup. Preserve email verification and social signup.
3. **Payroll prompts:** stop payroll setup alerts and employee setup actions when the payroll module is disabled.
4. **Universal module controls:** suppress disabled-module alerts, counts and background attention queries. Keep role-permitted menu items visible but greyed out; hover or click opens capabilities and the relevant plan/pack upgrade. Company Superusers can purchase; others request access from their Superuser. Locked pages show the same preview, without weakening existing data protections.
5. **Operations menu:** Overview → Job sheets → Pending Works → Log expense → Inventory. Keep Technical library under Field work.

## Field staff and audit tools
6. **Clock-in and location history:** make the vehicle registration field immediately editable without a private-transport toggle. Extend existing map/fleet screens with staff, date and time-range lookup, shift start/end location evidence, GPS breadcrumbs and job/site comparison after clock-out. Show missing/low-accuracy coverage explicitly; approximate proximity is not proof of attendance. Keep history within its existing module and same-company manager permissions.
7. **On-call handover:** add a weekday choice for weekly/fortnightly rotations, independently for technician and supervisor tracks. Preserve existing assignments, swap approvals and payroll history; warn before changing future anchors.
8. **DWR filter:** show Technicians and Supervisors only, label the field “Field staff” and show each person's role beside their name.
9. **General Maintenance and trades:** add a protected General Maintenance role with field-worker access, not manager authority. Use existing skills for Mechanical, Electrical and IT specialisms, with staff/dispatch filtering rather than additional roles. General Maintenance remains outside the specifically requested Technician/Supervisor DWR filter and existing two-track on-call rota.
10. **Invites and Field work menu:** let Supervisors invite General Maintenance. Order Field work as Today & team → My job sheets → My schedule → Log expense → Technical library.
11. **Leave response links:** supervisor consultation replies link to the exact leave request; office staff see the response and existing approval controls. Preserve private medical details and independent approval rules.

## Site-aware recipients and client portal
12. **Build the recipient matrix and self-service portal together:**
   - Keep one contact identity with explicit client-wide or selected-site assignments. Allow multiple site managers/supervisors and a shared operations manager.
   - Independently select Email and WhatsApp per job sheet, ETA, estimate, proposal, contract and billing-related event where delivery exists.
   - Add role presets, editable preferences and a “Who receives this?” preview for the selected site/document. Do not send to another site's contacts or duplicate destinations.
   - Reuse the matrix across existing delivery paths. Unsupported/unconfigured WhatsApp document delivery must be clearly unavailable, never falsely reported as sent.
   - Give clients individual verified email/password access with password recovery, expiring invitations and revocation. Reuse existing contact details rather than adding unrelated profile fields.
   - Client administrators manage contacts and site assignments within their client; regular contacts edit their own details/preferences within granted scope. Contractor staff control initial access and revocation.
   - Add a visible client-portal link to job sheets and their emails. The link leads to login, not a public exposure of client data.
   - Gate advanced routing and self-service with the existing **Client Experience & Compliance Portal** module, controlled in HQ. Keep standard office contact management and base delivery intact. Do not change pack prices or automatically activate paid packs.

## Technical safeguards and verification
- Implement in three coordinated batches: device/navigation; field roles/history; recipient matrix/portal. Track all twelve items individually in the roadmap.
- Preserve employee authentication, tenant isolation, issued/signed evidence, account-scoped offline work and existing module write guards.
- Client portal accounts use separate protected client memberships, never employee roles or automatically inferred tenant access. Verify company/client/site scope and module entitlement on every protected read/write; expose only allowlisted client-safe information.
- Update protected role helpers, invitation validation, eligibility checks and generated types together for General Maintenance. Do not broaden office/payroll authority.
- Apply schema changes as migrations with explicit grants and row-level policies. Record shared routing/portal architecture rules in project guidance.
- Add focused tests for concrete eligibility, recipient, entitlement, invitation, rota and cross-client/site security rules; run relevant existing tests.
- Verify desktop/mobile menus, signup validation, location filters, leave links and contractor/client save-and-reload flows with authorised accounts. Report device push delivery or external messaging checks separately when they require an actual phone/provider.