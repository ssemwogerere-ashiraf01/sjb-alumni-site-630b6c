# SJB Alumni & Members Association

A full‑featured membership management platform for the **SJB Alumni & Members Association** — built with static HTML, Supabase (backend as a service), Flutterwave (payments), and deployed on Netlify.

> **Live site:** [https://sjb-association.netlify.app](https://sjb-association.netlify.app) (hosted on Netlify)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
- [Deployment](#deployment)
- [Authentication Flow](#authentication-flow)
- [Database & RLS](#database--rls)
- [Payments](#payments)
- [Admin Panel](#admin-panel)
- [Savings Groups](#savings-groups)
- [Elections](#elections)
- [Security](#security)
- [License](#license)

---

## Overview

The SJB Association website serves as the digital home for the association's community. It manages the full member lifecycle — from application submission and admin approval, through onboarding and membership fee payment, to active participation in savings groups and leadership elections.

Key workflows:

1. **Membership Application** → **Admin Review** → **Onboarding** → **Fee Payment** → **Active Member**
2. **Savings Groups** → **Join Fee** → **Monthly Contributions** → **Withdrawals**
3. **Leadership Elections** → **Voting Window** → **Vote** → **Results Published** → **Winners Promoted to Leaders**

---

## Features

### Public Pages (indexed by search engines)
- **Home page** — Hero section, activity overview, member benefits, leadership preview
- **Sign In** — Email/password + Google OAuth with OTP (one-time password) verification
- **Membership Application** — Google OAuth or email/password registration

### Member Pages (require authentication, noindex)
- **Dashboard** — Quick-access cards (Savings, Elections, Profile), upcoming events, latest news
- **My Profile** — View/update personal details, change password, upload profile photo
- **Onboarding** — First-time profile setup (membership class, phone, profession, photo)
- **Membership Fee Payment** — One-time fee via Flutterwave (UGX or USD)

### Savings Portal
- **Join a Group** — Browse active savings groups and register
- **Savings Dashboard** — View group balances, monthly contribution status
- **Contribute** — Make monthly savings contributions via Flutterwave
- **History** — View transaction history per group
- **Withdraw** — Request withdrawals (requires admin approval)

### Elections Portal
- **Elections Listing** — View active, upcoming, and past elections
- **Candidates** — Browse candidates per election
- **Vote** — Cast votes during open voting windows (one vote per position per member)
- **Results** — View results after an election closes

### Leadership Page
- **Current Term** — Active executive committee display
- **Previous Terms** — Historical leadership teams grouped by term

### Admin Panel (role-restricted)
- **Members** — Approve/reject/suspend/kick members, manage roles, mark fees paid
- **Savings Groups** — Create/manage savings groups, approve join requests
- **Withdrawal Requests** — Approve/reject withdrawal requests
- **Elections** — Manage elections, add candidates, approve/unapprove candidates, close elections and auto-promote winners

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (ES Modules, no framework) |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **Payments** | Flutterwave (card & mobile money in UGX, USD) |
| **Hosting** | Netlify |
| **Fonts** | Fraunces (headings), Inter (body) via Google Fonts |
| **Auth** | Supabase Auth (email/password + Google OAuth + OTP) |

### Supabase Services Used
- **Database** — PostgreSQL with Row-Level Security (RLS)
- **Auth** — Built-in auth with email/password, Google OAuth, and OTP
- **Storage** — Avatar image storage in `avatars` bucket
- **Edge Functions** — `login-guard` (rate-limiting, brute-force protection), `verify-flutterwave` (payment verification webhook)

---

## Project Structure

```
├── index.html                 # Public landing page (marketing)
├── login.html                 # Sign in (email/password + Google + OTP)
├── register.html              # Membership application
├── dashboard.html             # Member dashboard (authenticated)
├── onboarding.html            # First-time profile setup
├── pending-approval.html      # "Under review" page after registration
├── membership-payment.html    # One-time membership fee payment
├── profile.html               # Edit profile & change password
├── leadership.html            # Current & past leadership display
├── reset-password.html        # Password reset request
├── reset-password-confirm.html# Password reset confirmation
│
├── admin/
│   └── index.html             # Admin panel (role-restricted)
│
├── savings/
│   ├── index.html             # Savings portal entry (auto-redirect)
│   ├── dashboard.html         # My savings groups & balances
│   ├── register.html          # Join a savings group
│   ├── contribute.html        # Make a monthly contribution
│   ├── history.html           # Transaction history
│   └── withdraw.html          # Withdrawal request
│
├── elections/
│   ├── index.html             # Elections listing
│   ├── candidates.html        # Candidate profiles
│   ├── vote.html              # Cast votes
│   └── results.html           # Election results
│
├── assets/
│   ├── css/
│   │   └── style.css          # Global styles (design tokens, components)
│   └── js/
│       ├── auth.js            # Auth functions (login, register, OTP, logout, routeAfterLogin)
│       ├── supabase-client.js # Supabase client initialization
│       ├── site-config.js     # BASE_URL configuration for all redirects
│       ├── nav.js             # Navigation bar & footer (public/member variants)
│       ├── session-guard.js   # Auth guard, idle timeout, periodic refresh
│       ├── admin-guard.js     # Admin role check
│       ├── flutterwave.js     # Flutterwave payment integration
│       ├── fee-prompt.js      # Membership fee payment overlay
│       ├── savings-guard.js   # Active savings group guard
│       └── savings-sidebar.js # Savings portal collapsible sidebar
│
├── sql/
│   ├── 001_schema.sql         # Core schema (profiles, payments, savings, elections, leaders)
│   ├── 002_rls_policies.sql   # Row-Level Security policies
│   ├── 003_storage.sql        # Storage bucket configuration
│   ├── 004_voting_window.sql  # Voting window triggers/functions
│   ├── 005_promote_winners.sql# Election winner promotion logic
│   ├── 006_fix_recursive_policy.sql  # RLS policy fix
│   ├── 007_onboarding.sql     # Onboarding workflow schema
│   └── 008_public_leader_profiles.sql # Public leader profile views
│
├── supabase/functions/
│   ├── login-guard/
│   │   └── index.ts           # Edge function: rate-limiting, account lockout
│   └── verify-flutterwave/
│       └── index.ts           # Edge function: verify Flutterwave transactions
│
├── netlify.toml               # Netlify build configuration
├── _headers                   # HTTP security headers (HSTS, CSP, etc.)
├── robots.txt                 # Search engine crawl directives
└── README.md                  # This file
```

---

## Getting Started

### Prerequisites

- A Supabase project ([supabase.com](https://supabase.com))
- A Flutterwave account ([flutterwave.com](https://flutterwave.com)) with test/live API keys
- A Netlify account ([netlify.com](https://netlify.com)) for hosting
- (Optional) A Google OAuth client ID for "Sign in with Google"

### Local Development

This is a static HTML/JS site with no build step — you can serve it locally with any HTTP server.

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .

# Using VS Code Live Server extension
```

> **Important:** Supabase Auth requires a proper redirect URL for OAuth. For local development, add `http://localhost:8000` (or your local server URL) to your Supabase project's **Authentication > URL Configuration > Redirect URLs**.

### Supabase Configuration

1. Run the SQL migration files in order from the `sql/` directory against your Supabase project's SQL editor.
2. Configure **Authentication > URL Configuration**:
   - Add your production URL (e.g. `https://yourdomain.org`)
   - Add `http://localhost:8000` (or your local dev server URL) for local testing
   - Set the site URL to your production domain
3. Enable the **Email** provider and (optionally) **Google** provider under Authentication > Providers
4. Create a `avatars` storage bucket (public) for profile photo uploads
5. Deploy the Edge Functions from `supabase/functions/` to your Supabase project:
   ```bash
   supabase functions deploy login-guard --no-verify-jwt
   supabase functions deploy verify-flutterwave --no-verify-jwt
   ```
6. Copy your Supabase project URL and anon/publishable key into `assets/js/supabase-client.js`

### Flutterwave Configuration

1. Sign up at [Flutterwave](https://flutterwave.com) and get your API keys
2. Set your public key in `assets/js/flutterwave.js`:
   ```js
   const FLW_PUBLIC_KEY = 'FLWPUBK-xxxxxxxxxx';
   ```
   - Use `FLWPUBK_TEST-*` keys for development/testing
   - Use `FLWPUBK-*` (live) keys for production
3. Configure your Flutterwave webhook URL to point to your deployed `verify-flutterwave` Edge Function

### Netlify Deployment

1. Push your repository to GitHub/GitLab
2. Connect the repo to Netlify via **Add new site > Import an existing project**
3. Netlify will automatically detect the `netlify.toml` configuration:
   - **Publish directory:** `.` (root)
   - **Build command:** none (static site)
4. Set any required environment variables in Netlify > Site settings > Environment
5. Deploy — your site will be live at `https://your-site-name.netlify.app`
6. Configure a custom domain in Netlify > Domain management (optional)

---

## Deployment

The site is deployed on **Netlify** with the following configuration:

| Setting | Value |
|---------|-------|
| **Publish directory** | `.` (root) |
| **Build command** | None (static site) |
| **Pretty URLs** | Enabled (`/about` → `/about.html`) |
| **Security headers** | Managed via `_headers` file |

### _headers Configuration

The `_headers` file applies strict security headers globally:

- **Strict-Transport-Security** — Enforce HTTPS for 2 years
- **X-Content-Type-Options** — Prevent MIME type sniffing
- **X-Frame-Options** — DENY (prevents clickjacking)
- **Referrer-Policy** — Strict origin-only referrer
- **Permissions-Policy** — Block geolocation, mic, camera
- **Content-Security-Policy** — Restrict script/style/connect sources to trusted origins (Supabase, Flutterwave, Google Fonts)

Admin, Savings, and Elections paths are also marked `noindex, nofollow`.

### robots.txt

Search engines are allowed to index only the public marketing pages:

```
Allow: /index.html
Allow: /login.html
Allow: /register.html
Disallow: /admin/
Disallow: /savings/
Disallow: /elections/
Disallow: /dashboard.html
Disallow: /profile.html
Disallow: /membership-payment.html
Disallow: /pending-approval.html
Disallow: /onboarding.html
Disallow: /reset-password.html
Disallow: /reset-password-confirm.html
```

---

## Authentication Flow

The site uses a **multi-step authentication** process for security:

```
Application → Admin Approval → Onboarding → Fee Payment → Active Session
```

### 1. Registration
- User signs up via **email/password** or **Google OAuth**
- Account is created with `status = 'pending'`
- User is directed to `pending-approval.html` and automatically signed out

### 2. Login (with OTP)
- User enters email + password
- Edge function (`login-guard`) validates credentials and checks:
  - Account is approved (`status = 'approved'`)
  - Account is not locked (excessive failed attempts)
  - Account is not suspended/kicked
- If valid, an **OTP (one-time password)** is sent to the user's email
- User must enter the 6-digit code to complete login
- OTP expires after 60 seconds; user can request a resend

### 3. Password Reset (with OTP)
- User requests a reset from `reset-password.html`
- The app sends an email OTP instead of a reset link
- User is redirected to `reset-password-confirm.html`
- User enters the email, code, and new password to complete the reset

### 4. Session Management
- **Idle timeout:** 10 minutes of inactivity → automatic logout
- **Token refresh:** Every 10 minutes, session is refreshed automatically
- **Route guard:** `session-guard.js` protects all authenticated pages — redirects to login, pending-approval, onboarding, or membership-payment as needed

### 5. Role-Based Access
- **Member** — Access to dashboard, savings, elections, profile
- **Admin** — Access to admin panel (member management, elections, savings groups, withdrawals)

---

## Database & RLS

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Member profiles (name, email, status, role, membership_class, fee status) |
| `payments` | Payment records (membership fees, tx_ref, status) |
| `savings_groups` | Savings group definitions (name, monthly contribution, join fee, capacity) |
| `savings_group_members` | Member-group affiliations (status, join fee paid, approved by) |
| `savings_transactions` | Contributions and withdrawals (type, amount, month_year, status) |
| `elections` | Election definitions (title, start/end date, status) |
| `candidates` | Election candidates (user_id, position, approved) |
| `votes` | Cast votes (election_id, voter_id, candidate_id) |
| `leaders` | Published leaders (position, bio, term, is_current, display_order) |
| `events` | Association events (title, date, location) |
| `news` | News articles (title, content, published_at) |
| `app_settings` | Key-value settings store (fee amounts, configuration) |

### Row-Level Security (RLS)

All tables have RLS enabled. Key policies include:

- **Profiles:** Users can read/update their own row only. Admins can read/update all rows. A trigger prevents users from elevating their own role.
- **Payments:** Users can insert rows with `status = 'pending'` and `user_id = own_id`. Admins can see all rows.
- **Savings Groups:** Anyone can read active groups. Only admins can create/update/delete.
- **Savings Group Members:** Users see only their own memberships. Admins view/manage all.
- **Votes:** Users can insert one vote per election per position. Votes are anonymized — RLS prevents reading who voted for whom after submission.
- **Leaders:** Public read for `is_current = true`. Admins manage all rows.

### SQL Migrations

The `sql/` directory contains ordered migration files:

| File | Contents |
|------|----------|
| `001_schema.sql` | Core table definitions, triggers, functions |
| `002_rls_policies.sql` | All Row-Level Security policies |
| `003_storage.sql` | Storage bucket setup for avatars |
| `004_voting_window.sql` | Voting window validation logic |
| `005_promote_winners.sql` | Function to promote election winners to leaders |
| `006_fix_recursive_policy.sql` | Policy correction for recursive lookups |
| `007_onboarding.sql` | Onboarding workflow schema updates |
| `008_public_leader_profiles.sql` | Public leader profile RPC function |
| `013_super_admin.sql` | Adds the exclusive super-admin tier: role changes and permanent account deletion |
| `014_super_admin_critical_actions.sql` | Restricts edit/delete on posts, savings groups, savings approvals, withdrawals, elections/candidates, and feedback forms to the super admin; regular admins keep create-only access |

---

## Payments

Payments are handled entirely through **Flutterwave** with server-side verification via a Supabase Edge Function.

### Payment Types

| Type | Amount (UGX) | Description |
|------|-------------|-------------|
| **Membership Fee (Alumni)** | 3,000 | One-time fee for verified alumni |
| **Membership Fee (Non-Alumni)** | 15,000 | One-time fee for non-alumni members |
| **Savings Group Join Fee** | Varies per group | One-time registration fee per group |
| **Monthly Contribution** | Varies per group | Monthly savings contribution amount |

### Payment Flow

1. User initiates payment (button click)
2. A `payments` or `savings_transactions` row is inserted with `status = 'pending'`
3. Flutterwave checkout modal opens (card or mobile money)
4. After payment, the callback triggers the Edge Function to verify with Flutterwave's API
5. If verified, the status is updated to `completed`
6. User is redirected to the appropriate page with a success indicator

### Currency Support

- Primary: **UGX** (Ugandan Shillings)
- Optional: **USD** — converts at live exchange rate from `open.er-api.com`

---

## Admin Panel

There are two admin surfaces, split by how consequential the action is:

- **`/admin/index.html`** — accessible to any user with `role = 'admin'`. Handles day-to-day, non-critical work: member approvals, and *creating* new posts, savings groups, and elections.
- **`/admin/super-admin.html`** — accessible only to the one account with `is_super_admin = true`. Handles every critical **edit/update** and **delete** across posts, savings groups, savings approvals, withdrawals (financials), elections/candidates, and feedback forms, plus role changes and permanent account deletion. Both the UI and the database RLS policies (see `sql/013_super_admin.sql` and `sql/014_super_admin_critical_actions.sql`) enforce this — a regular admin cannot bypass the UI to edit or delete these records directly.

### Members Tab *(regular admin)*

| Feature | Description |
|---------|-------------|
| **Search** | Filter members by name or email |
| **Status filter** | Filter by pending/approved/rejected/suspended/kicked |
| **Approve/Reject** | Process new membership applications |
| **Suspend/Kick** | Temporarily or permanently remove members |
| **Reactivate** | Restore suspended/kicked/rejected members |
| **Mark Fee Paid** | Manually mark membership fee as paid |
| **Unlock** | Clear account lockout from failed login attempts |
| **Detail view** | Expand rows to see phone, profession, location, graduation year, login attempts |

Changing a member's role (member ⇄ leader ⇄ admin) and permanently deleting an account are Super Admin Dashboard actions — see below.

### Content Management, Savings Groups & Elections Tabs *(regular admin)*

Regular admins can **create** news, events, jobs, forum posts, savings announcements, savings groups, and elections (draft status). Publishing/hiding or deleting an existing post, editing or deactivating/deleting a savings group, and editing/closing an election or managing its candidates all require the Super Admin Dashboard — these tabs show existing records read-only with a note pointing there.

### Feedback Forms

Any admin can create a feedback form and add questions, and can view results. Deactivating a form, deleting a form, and removing a question are Super Admin actions (the buttons only appear when signed in as the super admin).

### Super Admin Dashboard (`/admin/super-admin.html`)

| Tab | Feature |
|-----|---------|
| **Members** | Change any member's role (member ⇄ leader ⇄ admin); permanently delete an account |
| **Content** | Publish/hide or delete news, events, jobs, forum topics/replies, savings announcements |
| **Savings Groups** | Edit contribution/join-fee amounts and max members; activate/deactivate; delete a group |
| **Elections** | Add/approve/unapprove/remove candidates; change election status (Draft → Upcoming → Active → Closed); closing an election auto-promotes winners via `promote_election_winners()`; delete an election |
| **Approvals & Financials** | Activate or reject pending savings-group registrations; approve or reject withdrawal requests |
| **Feedback Forms** | Summary stats, with a link through to the full feedback builder where destructive actions unlock for the super admin |

---

## Savings Groups

### Member Flow

1. **Browse & Join** — View active savings groups, see member count and contribution amounts
2. **Pay Join Fee** — One-time payment via Flutterwave to register for a group
3. **Admin Approval** — Admin activates the membership after join fee is confirmed
4. **Monthly Contributions** — Make monthly payments via Flutterwave (card or mobile money)
5. **Track Progress** — View contribution history and current balance per group
6. **Withdraw** — Request a withdrawal (subject to admin approval and disbursement)

### Guard Logic

- `savings-guard.js` ensures only members with active group memberships can access savings pages
- Members without active groups are redirected to `register.html`
- Members who haven't paid their membership fee get an overlay prompt

---

## Elections

### Member Flow

1. **Browse Elections** — View all elections with status indicators (upcoming/active/closed)
2. **View Candidates** — See candidate profiles, positions, and manifestos
3. **Cast Vote** — During active voting windows, vote for candidates per position (one vote per position per member)
4. **View Results** — After an election is closed, see the winners

### Election Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Being set up, not visible for voting |
| `upcoming` | Scheduled, shows countdown to opening |
| `active` | Voting window is open (respects start/end dates) |
| `closed` | Voting ended, results published, winners promoted to leaders |

### Winner Promotion

When an admin sets an election status to `closed`, the system automatically:
1. Tallies votes per candidate per position
2. Determines winners (most votes per position)
3. Creates `leaders` rows for winners with `is_current = true`
4. Sets previous leaders to `is_current = false`
5. The updated leadership appears on both the home page and `leadership.html`

---

## Security

### HTTP Security Headers

The `_headers` file enforces a robust Content Security Policy:

```
Content-Security-Policy: default-src 'self';
  script-src 'self' https://checkout.flutterwave.com https://esm.sh;
  connect-src 'self' https://*.supabase.co https://api.flutterwave.com https://open.er-api.com;
  img-src 'self' https: data:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  frame-src https://checkout.flutterwave.com;
```

### Authentication Security

- **OTP verification** — Password alone is never enough; a one-time code sent via email is required to complete login
- **Account lockout** — Edge function (`login-guard`) tracks failed attempts and locks accounts temporarily
- **Idle timeout** — 10 minutes of inactivity triggers automatic sign-out
- **Session refresh** — Tokens are refreshed every 10 minutes to prevent session hijacking

### Database Security

- **Row-Level Security (RLS)** — Every table has RLS policies preventing unauthorized access
- **Trigger protection** — Database triggers prevent users from self-elevating to admin or modifying sensitive fields
- **Prepared statements** — All queries use Supabase's parameterized client, preventing SQL injection

### Deployment Security

- **HTTPS enforcement** — HSTS header forces secure connections
- **X-Frame-Options: DENY** — Prevents clickjacking
- **Permissions Policy** — Blocks unnecessary browser features (geolocation, camera, microphone)
- **Noindex** — Admin, savings, and elections pages are hidden from search engines

---

## License

This project is proprietary software developed for the **SJB Alumni & Members Association**. All rights reserved.

---

*Built with ❤️ by the St Josephine Bakhita Association team. For questions or support, contact [admin@sjbassociation.org](mailto:ssemwogerere.ashiraf@stud.umu.ac.ug).*
