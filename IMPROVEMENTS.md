# Improvements (this package)

## Security
- Removed `.env` / `.env.local` with live API keys from the distribution.
- Added `.env.example` with placeholders. **Rotate** any keys that were previously committed or shared in a zip.

## Savings portal
- Dashboard cards show balance, monthly amount, paid/unpaid status, and clearer actions.
- Contribution page highlights amount due and handles checkout button state more cleanly.
- History uses shared data-table styles and an empty state.
- Withdrawal form shows a balance banner, caps amount, and clearer request list with status pills.
- Register page no longer hard-codes “UGX 10,000”; it reads each group’s fees and avoids putting full group JSON in HTML attributes.

## Shared CSS (`assets/css/style.css`)
- Data tables, status pills, empty states, savings card layout, balance banner, and admin hint styles for consistency across pages.

## Admin
- “Leader” role option when creating users.
- Clearer page intro and Super Admin action hints.
- Title aligned with the rest of the site.

## Not changed
- Supabase schema, RLS, Edge Functions, and core auth flows — left intact.
- Business rules (fee tiers, approval gates, super-admin-only updates) unchanged.
