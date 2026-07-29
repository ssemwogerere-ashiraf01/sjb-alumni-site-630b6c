// Single source of truth for site root and public links.
export const BASE_URL = window.location.origin;

export const SOCIAL_LINKS = {
  facebook: 'https://facebook.com/',
  instagram: 'https://instagram.com/',
  tiktok: 'https://www.tiktok.com/',
  x: 'https://x.com/',
  whatsapp: 'https://wa.me/',
  telegram: 'https://t.me/',
  email: 'mailto:admin@sjbassociation.org',
};

/** Theme: 'light' | 'dark' | 'system' — stored in localStorage as sjb-theme */
export const THEME_STORAGE_KEY = 'sjb-theme';
