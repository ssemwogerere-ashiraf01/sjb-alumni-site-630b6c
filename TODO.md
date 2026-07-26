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

