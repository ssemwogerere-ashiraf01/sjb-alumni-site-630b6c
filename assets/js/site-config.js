// Single source of truth for "where is the site root". Every redirect in
// the app should build its URL from this instead of a relative string like
// 'login.html' — relative paths silently break once a page lives inside a
// subfolder (e.g. /savings/), because 'login.html' from there resolves to
// /savings/login.html, which doesn't exist.
//
// Assumes the association-site is deployed at your domain's root
// (e.g. https://yourdomain.org/login.html). If you instead deploy it under
// a subpath (e.g. https://yourdomain.org/association/), change BASE_URL to
// `${window.location.origin}/association` and every page will still work.
export const BASE_URL = window.location.origin;
