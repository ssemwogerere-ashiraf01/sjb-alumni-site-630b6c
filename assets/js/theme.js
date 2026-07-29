import { THEME_STORAGE_KEY } from './site-config.js';

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(mode = getStoredTheme()) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return systemPrefersDark() ? 'dark' : 'light';
}

export function applyTheme(mode = getStoredTheme()) {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-mode', mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch { /* ignore */ }
  return resolved;
}

export function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const cur = getStoredTheme();
  const next = order[(order.indexOf(cur) + 1) % order.length];
  applyTheme(next);
  return next;
}

export function themeLabel(mode = getStoredTheme()) {
  if (mode === 'light') return 'Light';
  if (mode === 'dark') return 'Dark';
  return 'Auto';
}

// Apply as early as possible when this module loads
applyTheme();

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  });
}
