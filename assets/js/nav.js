import { supabase } from './supabase-client.js';
import { BASE_URL, SOCIAL_LINKS } from './site-config.js';
import { logout } from './auth.js';
import { applyTheme, cycleTheme, getStoredTheme, themeLabel } from './theme.js';
import { initUiChrome } from './ui-chrome.js';

applyTheme();

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

function avatarHtml(profile) {
  if (profile?.profile_photo_url) {
    return `<img src="${profile.profile_photo_url}" alt="${initials(profile.full_name)}" class="nav-avatar-img" />`;
  }
  return `<span class="nav-avatar-fallback">${initials(profile?.full_name)}</span>`;
}

const ICONS = {
  home: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
  about: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
  activities: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>',
  rules: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  leadership: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  contact: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  dashboard: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>',
  savings: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>',
  elections: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 13h-.68l-2 2h1.91L19 17H5l1.78-2h2.05l-2-2H6l-3 3v4c0 1.1.9 2 2 2h14c1.11 0 2-.9 2-2v-4l-3-3z"/></svg>',
  feedback: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>',
  admin: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
  posts: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>',
  news: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 3H2v16h6l4 4 4-4h6V3z"/></svg>',
  forum: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/></svg>',
  events: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>',
  jobs: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>',
  profile: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  chapters: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
  password: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>',
  join: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  chat: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>',
  theme: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>',
  facebook: '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>',
  instagram: '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm.2 2A3.6 3.6 0 0 0 4.4 7.6v8.8A3.6 3.6 0 0 0 8 20h8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16 4.4H8zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  tiktok: '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .56.04.82.12v-3.4a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.16 8.16 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>',
  x: '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.227-8.26L1.99 2.25h7.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  whatsapp: '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>',
  telegram: '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.697.064-1.226-.461-1.901-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
  email: '<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
};

function iconLabel(iconKey, label) {
  return `${ICONS[iconKey] || ''}<span class="nav-label">${label}</span>`;
}

function themeToggleBtn() {
  const mode = getStoredTheme();
  return `<button type="button" class="theme-toggle-btn" id="theme-toggle-btn" title="Theme: ${themeLabel(mode)} (click to cycle)" aria-label="Toggle color theme">
    ${ICONS.theme}<span class="theme-toggle-label">${themeLabel(mode)}</span>
  </button>`;
}

function wireThemeToggle() {
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    const next = cycleTheme();
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.title = `Theme: ${themeLabel(next)} (click to cycle)`;
      const lab = btn.querySelector('.theme-toggle-label');
      if (lab) lab.textContent = themeLabel(next);
    }
  });
}

function afterNavMount() {
  wireThemeToggle();
  initUiChrome({
    clockEl: document.getElementById('digital-clock'),
    marqueeEl: document.getElementById('live-marquee'),
    supabase,
  });
}

export async function mountNav(activeKey = '') {
  const mount = document.getElementById('app-nav');
  if (!mount) return;

  const { data: { session } } = await supabase.auth.getSession();

  const chromeBar = `
    <div class="site-chrome">
      <div class="digital-clock" id="digital-clock" aria-live="polite"></div>
      ${themeToggleBtn()}
    </div>
    <div class="live-marquee" id="live-marquee" role="marquee" aria-label="Live updates"></div>`;

  const mobileToggle = `
    <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>`;
  const mobileMenuStart = `<div class="nav-menu" id="nav-menu">`;
  const mobileMenuEnd = `</div>`;

  if (!session) {
    mount.innerHTML = `
      ${chromeBar}
      <nav class="site-nav">
        <a href="${BASE_URL}/index.html" class="brand"><span class="seal">SJB</span> SJB Association</a>
        <div class="nav-header-actions">${mobileToggle}</div>
        ${mobileMenuStart}
          <ul>
            <li><a href="${BASE_URL}/index.html" class="nav-link ${activeKey === 'home' ? 'nav-active' : ''}">${iconLabel('home', 'Home')}</a></li>
            <li><a href="${BASE_URL}/about.html" class="nav-link ${activeKey === 'about' ? 'nav-active' : ''}">${iconLabel('about', 'About')}</a></li>
            <li><a href="${BASE_URL}/index.html#activities" class="nav-link">${iconLabel('activities', 'Activities')}</a></li>
            <li><a href="${BASE_URL}/rules.html" class="nav-link ${activeKey === 'rules' ? 'nav-active' : ''}">${iconLabel('rules', 'Rules')}</a></li>
            <li><a href="${BASE_URL}/leadership.html" class="nav-link ${activeKey === 'leadership' ? 'nav-active' : ''}">${iconLabel('leadership', 'Leadership')}</a></li>
            <li><a href="${BASE_URL}/contact.html" class="nav-link ${activeKey === 'contact' ? 'nav-active' : ''}">${iconLabel('contact', 'Contact')}</a></li>
          </ul>
          <div class="nav-actions">
            <a href="${BASE_URL}/login.html" class="btn btn-outline-light">Sign In</a>
            <a href="${BASE_URL}/register.html" class="btn btn-nav-cta">Become a Member</a>
          </div>
        ${mobileMenuEnd}
      </nav>`;
    wireMobileNav(mount);
    afterNavMount();
    return;
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role, profile_photo_url, status, is_super_admin').eq('id', session.user.id).single();
  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;
  const isSuperAdmin = !!profile?.is_super_admin;

  // Slim top nav: Home, Dashboard, Savings, Chat, Leadership▾, Posts▾
  // Elections lives under Leadership; Feedback under Posts; Admin only in avatar menu.
  const links = [
    { key: 'home', href: `${BASE_URL}/index.html`, label: 'Home', icon: 'home' },
    { key: 'dashboard', href: `${BASE_URL}/dashboard.html`, label: 'Dashboard', icon: 'dashboard' },
    { key: 'savings', href: `${BASE_URL}/savings/dashboard.html`, label: 'Savings', icon: 'savings' },
    { key: 'chat', href: `${BASE_URL}/chat.html`, label: 'Chat', icon: 'chat' },
  ];

  mount.innerHTML = `
    ${chromeBar}
    <nav class="site-nav">
      <a href="${BASE_URL}/index.html" class="brand"><span class="seal">SJB</span> SJB Association</a>
      <div class="nav-header-actions">
        ${mobileToggle}
        <div class="nav-avatar-wrap" id="nav-avatar-wrap">
          <button type="button" class="nav-avatar-btn" id="nav-avatar-btn" aria-haspopup="true" aria-expanded="false">
            ${avatarHtml(profile)}
          </button>
          <div class="nav-dropdown" id="nav-dropdown">
            <div class="nav-dropdown-name">${escapeHtml(profile?.full_name || session.user.email)}</div>
            <a href="${BASE_URL}/profile.html">${iconLabel('profile', 'My Profile')}</a>
            <a href="${BASE_URL}/chat.html">${iconLabel('chat', 'Member Chat')}</a>
            <a href="${BASE_URL}/savings/dashboard.html">${iconLabel('savings', 'My Savings')}</a>
            ${isAdmin ? `<a href="${BASE_URL}/admin/index.html">${iconLabel('admin', 'Admin Panel')}</a>` : ''}
            ${isSuperAdmin ? `<a href="${BASE_URL}/admin/super-admin.html">${iconLabel('admin', 'Super Admin')}</a>` : ''}
            <button type="button" id="nav-signout-btn">Sign Out</button>
          </div>
        </div>
      </div>
      ${mobileMenuStart}
        <ul>
          ${links.map(l => `<li><a href="${l.href}" class="nav-link ${activeKey === l.key ? 'nav-active' : ''}">${iconLabel(l.icon, l.label)}</a></li>`).join('')}
          <li class="nav-dropdown-parent" data-dropdown="leadership">
            <a href="#" class="nav-dropdown-trigger nav-link ${['leadership','elections'].includes(activeKey) ? 'nav-active' : ''}">${iconLabel('leadership', 'Leadership')}</a>
            <div class="nav-child-dropdown">
              <a href="${BASE_URL}/leadership.html" class="${activeKey === 'leadership' ? 'nav-active' : ''}">${iconLabel('leadership', 'Current Leaders')}</a>
              <a href="${BASE_URL}/elections/index.html" class="${activeKey === 'elections' ? 'nav-active' : ''}">${iconLabel('elections', 'Elections')}</a>
            </div>
          </li>
          <li class="nav-dropdown-parent" data-dropdown="posts">
            <a href="#" class="nav-dropdown-trigger nav-link ${['news','forum','events','jobs','feedback'].includes(activeKey) ? 'nav-active' : ''}">${iconLabel('posts', 'Posts')}</a>
            <div class="nav-child-dropdown">
              <a href="${BASE_URL}/news.html" class="${activeKey === 'news' ? 'nav-active' : ''}">${iconLabel('news', 'News')}</a>
              <a href="${BASE_URL}/forum/index.html" class="${activeKey === 'forum' ? 'nav-active' : ''}">${iconLabel('forum', 'Forum')}</a>
              <a href="${BASE_URL}/feedback.html" class="${activeKey === 'feedback' ? 'nav-active' : ''}">${iconLabel('feedback', 'Feedback')}</a>
              <a href="${BASE_URL}/events.html" class="${activeKey === 'events' ? 'nav-active' : ''}">${iconLabel('events', 'Events')}</a>
              <a href="${BASE_URL}/jobs.html" class="${activeKey === 'jobs' ? 'nav-active' : ''}">${iconLabel('jobs', 'Jobs')}</a>
            </div>
          </li>
        </ul>
      ${mobileMenuEnd}
    </nav>`;

  wireMobileNav(mount);

  const avatarBtn = document.getElementById('nav-avatar-btn');
  const dropdown = document.getElementById('nav-dropdown');
  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      avatarBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById('nav-avatar-wrap')?.contains(e.target)) {
        dropdown.classList.remove('open');
        avatarBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.getElementById('nav-signout-btn')?.addEventListener('click', logout);
  afterNavMount();
}

function wireMobileNav(mount) {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  const parents = [...mount.querySelectorAll('.nav-dropdown-parent')];

  const closeMenu = () => {
    mount.querySelector('.site-nav')?.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    parents.forEach((p) => p.classList.remove('nav-open-mobile'));
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const nav = mount.querySelector('.site-nav');
    const open = nav?.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
    if (!open) parents.forEach((p) => p.classList.remove('nav-open-mobile'));
  });

  parents.forEach((parent) => {
    const trigger = parent.querySelector('.nav-dropdown-trigger');
    trigger?.addEventListener('click', (e) => {
      if (!window.matchMedia('(max-width: 900px)').matches) return;
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !parent.classList.contains('nav-open-mobile');
      parents.forEach((p) => p.classList.remove('nav-open-mobile'));
      if (willOpen) parent.classList.add('nav-open-mobile');
    });
  });

  menu.querySelectorAll('a').forEach((link) => {
    if (link.classList.contains('nav-dropdown-trigger')) return;
    link.addEventListener('click', closeMenu);
  });
}

function socialRowHtml() {
  const items = [
    { key: 'facebook', label: 'Facebook', href: SOCIAL_LINKS.facebook },
    { key: 'instagram', label: 'Instagram', href: SOCIAL_LINKS.instagram },
    { key: 'tiktok', label: 'TikTok', href: SOCIAL_LINKS.tiktok },
    { key: 'x', label: 'X', href: SOCIAL_LINKS.x },
    { key: 'whatsapp', label: 'WhatsApp', href: SOCIAL_LINKS.whatsapp },
    { key: 'telegram', label: 'Telegram', href: SOCIAL_LINKS.telegram },
    { key: 'email', label: 'Email', href: SOCIAL_LINKS.email },
  ];
  return `<div class="footer-social" role="list" aria-label="Social media">
    ${items.map((item) => `
      <a role="listitem" href="${item.href}" class="footer-social-link" target="${item.key === 'email' ? '_self' : '_blank'}" rel="noopener noreferrer" aria-label="${item.label}" title="${item.label}">
        ${ICONS[item.key]}
      </a>`).join('')}
  </div>`;
}

export function mountFooter() {
  const mount = document.getElementById('app-footer');
  if (!mount) return;
  mount.innerHTML = `
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <div class="brand" style="color:#fff;justify-content:flex-start;"><span class="seal">SJB</span> SJB Association</div>
          <p style="margin-top:0.6rem;color:#9aa4b2;font-size:0.85rem;max-width:280px;">A community that saves together, votes together, and shows up for each other.</p>
          ${socialRowHtml()}
        </div>
        <div>
          <h4 class="footer-heading">Members</h4>
          <a href="${BASE_URL}/index.html" class="footer-link">${iconLabel('home', 'Home')}</a>
          <a href="${BASE_URL}/dashboard.html" class="footer-link">${iconLabel('dashboard', 'Dashboard')}</a>
          <a href="${BASE_URL}/chat.html" class="footer-link">${iconLabel('chat', 'Member Chat')}</a>
          <a href="${BASE_URL}/savings/register.html" class="footer-link">${iconLabel('join', 'Join Savings')}</a>
          <a href="${BASE_URL}/profile.html" class="footer-link">${iconLabel('profile', 'My Profile')}</a>
        </div>
        <div>
          <h4 class="footer-heading">Association</h4>
          <a href="${BASE_URL}/about.html" class="footer-link">${iconLabel('about', 'About Us')}</a>
          <a href="${BASE_URL}/rules.html" class="footer-link">${iconLabel('rules', 'Members’ Code')}</a>
          <a href="${BASE_URL}/chapters.html" class="footer-link">${iconLabel('chapters', 'Chapters')}</a>
          <a href="${BASE_URL}/leadership.html" class="footer-link">${iconLabel('leadership', 'Leadership')}</a>
          <a href="${BASE_URL}/contact.html" class="footer-link">${iconLabel('contact', 'Contact')}</a>
        </div>
        <div>
          <h4 class="footer-heading">Support</h4>
          <a href="${BASE_URL}/reset-password.html" class="footer-link">${iconLabel('password', 'Reset Password')}</a>
          <a href="mailto:admin@sjbassociation.org" class="footer-link">${iconLabel('email', 'Contact Admin')}</a>
        </div>
      </div>
      <p style="text-align:center;color:#7d8798;font-size:0.8rem;margin-top:2rem;">&copy; ${new Date().getFullYear()} SJB Association. Membership is by approval.</p>
    </footer>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
