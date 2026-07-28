# Task Progress

## Navigation Update — Group forum, news, events, jobs under "Posts" dropdown
- [x] nav.js: Remove news and forum from top-level links array
- [x] nav.js: Add "Posts" dropdown with News, Forum, Events, Jobs
- [x] style.css: Add dropdown CSS for `.nav-child-dropdown`

## session-guard.js — Add `requireLoggedIn` export
- [x] Added `requireLoggedIn()` function for pages that need login but not approval/fee status

## Fix news.html — Use requireLoggedIn
- [x] news.html already imports `requireLoggedIn` correctly (verified)

## Remove vote.html requireLoggedIn issue
- [x] vote.html already uses `requireLoggedIn` correctly (verified)

## Create events.html — Event listing with registration
- [x] Created `events.html` with event listing, date badges, registration modal

## Create jobs.html — Job board with posting
- [x] Created `jobs.html` with job listing and post-a-job form

## Create send-newsletter Edge Function
- [x] Created `supabase/functions/send-newsletter/index.ts` with SendGrid integration


## Super Admin scope expansion — posts, savings, elections, approvals, financials, feedback
- [x] sql/014_super_admin_critical_actions.sql: RLS now restricts update/delete on news, events, jobs, forum topics/replies, savings announcements, savings groups, savings_group_members (approvals), savings_transactions (financials), elections, candidates, and feedback_forms/questions to is_super_admin(); admins keep insert-only (create)
- [x] promote_election_winners() now requires is_super_admin() (closing an election)
- [x] admin/index.html: Content Management, Savings Groups, Elections tabs are create + read-only for regular admins; removed the Approvals & Financials tab (linked to Super Admin Dashboard instead); wired up previously-dead Create Group / Create Election buttons
- [x] admin/feedback.html: Deactivate/Delete-form and Remove-question buttons now gated to is_super_admin
- [x] admin/super-admin.html: added Content, Savings Groups, Elections, Approvals & Financials, and Feedback Forms tabs alongside the existing Members tab, with full edit/delete/approve logic
