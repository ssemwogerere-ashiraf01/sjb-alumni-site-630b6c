import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';
import { logout } from './auth.js';

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

// Mounts into <div id="app-nav"></div>. Works whether the visitor is
// logged out (public marketing nav) or logged in (member nav with avatar).
export async function mountNav(activeKey = '') {
  const mount = document.getElementById('app-nav');
  if (!mount) return;

  const { data: { session } } = await supabase.auth.getSession();

  const mobileToggle = `
    <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>`;
  const mobileMenuStart = `<div class="nav-menu" id="nav-menu">`;
  const mobileMenuEnd = `</div>`;

  if (!session) {
    mount.innerHTML = `
      <nav class="site-nav">
        <a href="${BASE_URL}/index.html" class="brand"><span class="seal">SJB</span> SJB Association</a>
        <div class="nav-header-actions">
          ${mobileToggle}
        </div>
        ${mobileMenuStart}
          <ul>
            <li><a href="${BASE_URL}/index.html#about">About</a></li>
            <li><a href="${BASE_URL}/index.html#activities">Activities</a></li>
            <li><a href="${BASE_URL}/index.html#leaders">Leadership</a></li>
          </ul>
          <div class="nav-actions">
            <a href="${BASE_URL}/login.html" class="btn btn-outline-light">Sign In</a>
            <a href="${BASE_URL}/register.html" class="btn btn-nav-cta">Become a Member</a>
          </div>
        ${mobileMenuEnd}
      </nav>`;

    wireMobileNav(mount);
    return;
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role, profile_photo_url, status').eq('id', session.user.id).single();
  const isAdmin = profile?.role === 'admin';

  const links = [
    { key: 'dashboard', href: `${BASE_URL}/dashboard.html`, label: 'Dashboard' },
    { key: 'savings', href: `${BASE_URL}/savings/dashboard.html`, label: 'Savings' },
    { key: 'elections', href: `${BASE_URL}/elections/index.html`, label: 'Elections' },
    { key: 'leadership', href: `${BASE_URL}/leadership.html`, label: 'Leadership' },
  ];
  if (isAdmin) links.push({ key: 'admin', href: `${BASE_URL}/admin/index.html`, label: 'Admin Panel' });

  mount.innerHTML = `
    <nav class="site-nav">
      <a href="${BASE_URL}/dashboard.html" class="brand"><span class="seal">SJB</span> SJB Association</a>
      <div class="nav-header-actions">
        ${mobileToggle}
        <div class="nav-avatar-wrap" id="nav-avatar-wrap">
          <button type="button" class="nav-avatar-btn" id="nav-avatar-btn" aria-haspopup="true" aria-expanded="false">
            ${avatarHtml(profile)}
          </button>
          <div class="nav-dropdown" id="nav-dropdown">
            <div class="nav-dropdown-name">${escapeHtml(profile?.full_name || session.user.email)}</div>
            <a href="${BASE_URL}/profile.html">My Profile</a>
            <a href="${BASE_URL}/savings/dashboard.html">My Savings</a>
            ${isAdmin ? `<a href="${BASE_URL}/admin/index.html">Admin Panel</a>` : ''}
            <button type="button" id="nav-signout-btn">Sign Out</button>
          </div>
        </div>
      </div>
      ${mobileMenuStart}
        <ul>
          ${links.map(l => `<li><a href="${l.href}" class="${activeKey === l.key ? 'nav-active' : ''}" ${l.soon ? 'title="Coming soon" style="opacity:0.55;pointer-events:none;"' : ''}>${l.label}</a></li>`).join('')}
          <li class="nav-dropdown-parent">
            <a href="#" class="nav-dropdown-trigger ${['news','forum','events','jobs'].includes(activeKey) ? 'nav-active' : ''}">Posts</a>
            <div class="nav-child-dropdown">
              <a href="${BASE_URL}/news.html" class="${activeKey === 'news' ? 'nav-active' : ''}">News</a>
              <a href="${BASE_URL}/forum/index.html" class="${activeKey === 'forum' ? 'nav-active' : ''}">Forum</a>
              <a href="${BASE_URL}/events.html" class="${activeKey === 'events' ? 'nav-active' : ''}">Events</a>
              <a href="${BASE_URL}/jobs.html" class="${activeKey === 'jobs' ? 'nav-active' : ''}">Jobs</a>
            </div>
          </li>
        </ul>
      ${mobileMenuEnd}
    </nav>`;

  wireMobileNav(mount);

  const btn = document.getElementById('nav-avatar-btn');
  const dropdown = document.getElementById('nav-dropdown');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('nav-avatar-wrap').contains(e.target)) dropdown.classList.remove('open');
  });
  document.getElementById('nav-signout-btn').addEventListener('click', logout);
}

function wireMobileNav(mount) {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  const closeMenu = () => {
    mount.querySelector('.site-nav')?.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const nav = mount.querySelector('.site-nav');
    const open = nav?.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
  });

  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
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
        </div>
        <div>
          <h4 class="footer-heading">Members</h4>
          <a href="${BASE_URL}/dashboard.html">Dashboard</a>
          <a href="${BASE_URL}/savings/register.html">Join Savings</a>
          <a href="${BASE_URL}/profile.html">My Profile</a>
        </div>
        <div>
          <h4 class="footer-heading">Association</h4>
          <a href="${BASE_URL}/index.html#about">About Us</a>
          <a href="${BASE_URL}/index.html#activities">Activities</a>
          <a href="${BASE_URL}/index.html#leaders">Leadership</a>
        </div>
        <div>
          <h4 class="footer-heading">Support</h4>
          <a href="${BASE_URL}/reset-password.html">Reset Password</a>
          <a href="mailto:admin@sjbassociation.org">Contact Admin</a>
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
