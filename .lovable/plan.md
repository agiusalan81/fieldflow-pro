# Batch 2: CRM Pipeline (horizontal module)

## What you will get
- A new "CRM pipeline" menu entry under Clients & commercial, for office staff and supervisors only (technicians never see it).
- A board of leads moving through stages: New lead, Contacted, Site visit, Quote sent, Negotiation, Won, Lost. You can switch to a list view and filter by owner, stage, client and due follow-ups.
- "+ New lead" for phone calls: choose an existing client or add one inline (same picker as Batch 1), deal type, estimated value, source (phone, email, walk-in, referral, portal) and the first follow-up action with a due date.
- Voice intake: dictate the call into a review box, edit, then save it as the first note on the lead.
- Lead page: timeline of calls, notes, WhatsApp/email logs and status changes, plus linked client, site, estimates, jobs and contracts.
- Customisable follow-up actions: defaults (Phone call, WhatsApp message, Site inspection, Send quote, Revise quote, In-person meeting, Tender submission) and your own types in Company Settings, each with a label, icon and default due time. Saved follow-ups never send anything automatically.
- Bell alerts for due and overdue follow-ups, opening the exact lead.
- Won: one click creates a customer estimate, a dispatch job or a contract, prefilled from the lead. Lost: a required reason plus an optional re-contact reminder.
- Creating an estimate for a client moves an open lead to "Quote sent"; accepting it suggests "Won".

## Packaging (HQ)
- New horizontal module `crm_pipeline` in the Clients & Commercial domain.
- Not included in Basic; included in Plus, Pro and Enterprise and sellable as a pack. Basic sees a greyed menu with preview and upgrade link, no alerts or counts.
- Database blocks all CRM writes when the module is not active. Trials and legacy accounts get access.
- HQ analytics: owner-only lead counts per tenant, no client details.

## Not in this batch
- Lift-specific CRM fields (competitor contract expiry, equipment specs, tender categories) — the next vertical batch.
- AI smart extraction from dictation.

## Technical details
- Tables (company_id + RLS via current_company_id(), office/supervisor roles from user_roles, GRANTs): `crm_stages` (per-company, seeded defaults, ordered), `crm_opportunities` (client_id, site_id, contact, title, deal_type, value, source, stage_id, owner_id, status open/won/lost, lost_reason, linked quote/job/contract ids), `crm_activities` (append-only timeline), `crm_action_types` (defaults + custom), `crm_followups` (opportunity, action type, due_at, assignee, done_at, snoozed_until).
- Guard trigger on all CRM writes using plan entitlement for `crm_pipeline`; seed catalog key in plan rows Plus/Pro/Enterprise, not Basic.
- Atomic RPCs: `crm_create_lead` (lead + first note + first follow-up), `crm_move_stage` (logs activity), `crm_mark_won` (creates draft quote/job/contract and links), `crm_mark_lost`.
- Trigger on customer_quotes insert/status to advance matching open lead.
- Rules in tested `src/lib/crm.ts` (stage order, overdue logic, due offsets, conversion payloads); routes `/crm` and `/crm/$id`; menu gated through plan-features + module-preview; settings section in Company Settings via settingsSectionPatch; bell items via existing attention RPC.
- Tests: crm.ts unit tests, module-categories layer/domain, SQL regression for entitlement guard and tenant isolation; signed-in create → follow-up → won → estimate read-back.
