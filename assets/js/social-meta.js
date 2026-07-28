// Client-side social meta updater. Crawlers that execute little/no JS still
// rely on the static tags in each HTML file; this keeps in-app navigation
// and copy-link previews consistent with the current page content.
import { BASE_URL, SITE_NAME, SITE_DESCRIPTION, DEFAULT_OG_IMAGE_PATH } from './site-config.js';

function ensureMeta(attr, key, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return `${BASE_URL}${DEFAULT_OG_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${BASE_URL}${path}`;
}

/**
 * @param {{ title?: string, description?: string, image?: string, url?: string, type?: string }} opts
 */
export function applySocialMeta(opts = {}) {
  const title = opts.title ? `${opts.title} | ${SITE_NAME}` : SITE_NAME;
  const description = opts.description || SITE_DESCRIPTION;
  const image = absoluteUrl(opts.image || DEFAULT_OG_IMAGE_PATH);
  const url = opts.url || window.location.href.split('#')[0];
  const type = opts.type || 'website';

  document.title = title;

  ensureMeta('name', 'description', description);

  ensureMeta('property', 'og:site_name', SITE_NAME);
  ensureMeta('property', 'og:type', type);
  ensureMeta('property', 'og:title', title);
  ensureMeta('property', 'og:description', description);
  ensureMeta('property', 'og:image', image);
  ensureMeta('property', 'og:image:width', '1200');
  ensureMeta('property', 'og:image:height', '630');
  ensureMeta('property', 'og:url', url);

  ensureMeta('name', 'twitter:card', 'summary_large_image');
  ensureMeta('name', 'twitter:title', title);
  ensureMeta('name', 'twitter:description', description);
  ensureMeta('name', 'twitter:image', image);
}

export function defaultSocialMeta() {
  applySocialMeta({});
}
