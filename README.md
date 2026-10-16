# FieldFlow Pro

Create a multi-tenant PostgreSQL/Supabase database schema for a customizable field service management SaaS platform. Include Row Level Security (RLS) policies on company_id for all tables:

1. companies: id, name, created_at.

2. users: id, company_id, full_name, email, role (admin, technician, supervisor), created_at.

3. clients: id, company_id, name, billing_address, created_at.

4. client_contacts: id, company_id, client_id, first_name, last_name, role_title, email, phone, is_primary_contact.

5. assets: id, company_id, client_id, reference_number, asset_category (e.g., Lift, HVAC, Generator), location_details, custom_attributes (JSONB for dynamic fields).

6. lookup_options: id, industry_type, category, label_value, is_global (boolean), company_id (nullable), usage_count, created_by_user_id.

7. custom_field_definitions: id, company_id, target_entity (asset, job_sheet, client), field_label, field_type (text, number, dropdown, date, checkbox), options_list (JSONB array).

8. job_sheets: id, company_id, client_id, asset_id, assigned_technician_id, status (pending, in_transit, in_progress, completed), travel_start_time, work_start_time, work_end_time, is_overtime, overtime_rate, custom_values (JSONB for dynamic form data), notes, created_at.

9. inventory_items: id, company_id, part_name, sku, min_stock_level, current_stock, requires_approval.

10. internal_messages: id, company_id, sender_id, receiver_id, job_sheet_id (optional foreign key for job-specific chat threads), message_text, created_at.

11. leave_requests: id, company_id, user_id, start_date, end_date, status (pending, approved, rejected).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/053a061d-eac5-4847-aa88-88163ce1e1c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
