# Core customer estimates and proposals

## What will change
- Make **Customer estimates** the first view on Estimates. Keep existing supplier requests in a separate **Supplier RFQs** tab with their current records and follow-up history intact.
- Offer **Estimate** or **Proposal** as the document type for the same simple, trade-neutral quoting workflow. Keep detailed technical proposals and site surveys in their existing advanced modules.

## Basic form
- **Details:** automatic reference, document type, title, issue date, valid-until date, client, site/Branch ID, optional equipment and source job sheet.
- **Scope:** customer-visible work description and exclusions; separate private office notes.
- **Items:** description, labour/material/service category, quantity, unit, selling rate, discount and VAT. Show subtotal, discount, VAT and final total live. Use the existing company price list when its module is available; manual items remain usable without it.
- **Terms:** payment terms, expected work timeframe and customer notes. Use company branding and existing locale settings.
- Supplier names, quotes, internal costs and private notes never appear in customer documents.

## Workflow
1. Create and save a draft, including from Pending Works with the client/site and proposed work prefilled. Pending-only photos and private comments will not be copied into customer output automatically.
2. Preview and download a branded PDF. Send a customer email to one authorised contact at a time, with a secure document download link; app emails cannot attach files. Record delivery outcomes accurately rather than treating an opened email draft as a sent message.
3. Track **Draft → Sent → Accepted / Declined**, with expired quotes identified by their validity date. Office staff can record a customer's decision and evidence. Reuse online approval where the existing customer approval module is enabled, without requiring that paid pack for basic office acceptance.
4. Freeze the issued version and decision history. Changes after issue create a revision rather than silently changing what the customer approved.
5. Show **Convert to Job** only for an accepted estimate. Confirm site, optional equipment, schedule and staffing using existing dispatch rules. Create one linked visit atomically; repeat clicks return the existing job rather than creating duplicates.
6. Carry the approved scope and agreed pricing into the linked work without altering payroll, clock-in/out, standby rota, or signed source sheets. Conversion creates a visit, not a completed or pre-started job sheet. Pending work closes only through its existing follow-up completion rules.

## Core and HQ boundaries
- Basic customer estimates and simple proposals belong to **Core**, across all industries; do not change tier prices or activate paid packs.
- Supplier RFQ, advanced quantity surveying, technical site surveys and detailed proposals retain their separate HQ controls. Lift-specific specifications also respect the Lift & Escalator pack and company trade.
- Locked advanced modules do not load their data or generate reminders/alerts. Keep legacy/trial access behaviour and existing records.
- Update HQ descriptions and navigation so basic customer quoting is not presented as a lift-only RFQ feature.

## Technical approach
- Add dedicated tenant-scoped customer quote storage rather than mixing customer line items into `lift_estimates`. Include explicit grants, RLS, protected-role checks, issued-version snapshots and database validation.
- Share tested quote calculation and customer-safe projection helpers across editor, preview, PDF and email. Reuse existing branding and document tooling.
- Use authenticated server functions for email/document access and database transactions for issuing, recording decisions and idempotent job conversion. Download/approval links are hashed, expiring and revocable; expose only frozen customer-safe content.
- Keep existing supplier RFQ implementation separate from the new customer editor. Integrate basic proposals without duplicating the advanced technical proposal engine.

## Verification
- Tests for quantities, discounts, per-item VAT, totals and exclusion of supplier/private information.
- Permission tests for tenant isolation, office-only commercial writes, frozen issued documents, acceptance requirements and single-job conversion under retries.
- Signed-in end-to-end check: create a real test quote, save/reload, preview/download, issue, record acceptance, convert and open the linked job. Inspect customer output and remove temporary fixtures.
- Verify email delivery through service logs when sending is configured; report any unavailable prerequisite instead of claiming delivery.
- Check existing RFQ records still open and advanced-module locks remain effective; inspect desktop and narrow-screen layouts.