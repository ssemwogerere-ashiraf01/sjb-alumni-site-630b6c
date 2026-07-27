import { BASE_URL } from './site-config.js';

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  join: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
  contribute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  withdraw: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
};

// activeKey: which link to highlight. groupId: appended to links that need
// it (contribute/history/withdraw) so the sidebar stays on the same group
// the member is currently looking at.
export function mountSavingsSidebar(activeKey, groupId) {
  const mount = document.getElementById('savings-sidebar');
  if (!mount) return;

  const gid = groupId ? `?group=${groupId}` : '';
  const links = [
    { key: 'dashboard', href: `${BASE_URL}/savings/dashboard.html`, label: 'My Savings', icon: ICONS.dashboard },
    { key: 'register', href: `${BASE_URL}/savings/register.html`, label: 'Join a Group', icon: ICONS.join },
    { key: 'contribute', href: `${BASE_URL}/savings/contribute.html${gid}`, label: 'Contribute', icon: ICONS.contribute },
    { key: 'history', href: `${BASE_URL}/savings/history.html${gid}`, label: 'History', icon: ICONS.history },
    { key: 'withdraw', href: `${BASE_URL}/savings/withdraw.html${gid}`, label: 'Withdraw', icon: ICONS.withdraw },
  ];

  mount.innerHTML = `
    <button type="button" class="savings-rail-toggle" id="savings-rail-toggle" aria-label="Toggle savings menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
    <aside class="savings-rail" id="savings-rail">
      <div class="savings-rail-header">
        <span class="seal" style="width:30px;height:30px;flex-shrink:0;">SJB</span>
        <span class="savings-rail-title">Savings Portal</span>
      </div>
      <nav class="savings-rail-nav">
        ${links.map(l => `
          <a href="${l.href}" class="savings-rail-link ${activeKey === l.key ? 'active' : ''}" title="${l.label}" ${activeKey === l.key ? 'aria-current="page"' : ''}>
            <span class="savings-rail-icon">${l.icon}</span>
            <span class="savings-rail-label">${l.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="savings-rail-footer">
        <a href="${BASE_URL}/dashboard.html" class="savings-rail-link" title="Main Dashboard">
          <span class="savings-rail-icon">${ICONS.back}</span>
          <span class="savings-rail-label">Main Dashboard</span>
        </a>
      </div>
    </aside>
  `;

  const rail = document.getElementById('savings-rail');
  const toggleBtn = document.getElementById('savings-rail-toggle');
  const mobileMq = window.matchMedia('(max-width: 720px)');

  function applyMode() {
    if (mobileMq.matches) {
      rail.classList.add('expanded');
      rail.classList.remove('hover-enabled');
      return;
    }

    rail.classList.remove('expanded');
    rail.classList.add('hover-enabled');
  }

  applyMode();
  mobileMq.addEventListener('change', applyMode);

  // Desktop: hover to expand/collapse.
  rail.addEventListener('mouseenter', () => {
    if (!mobileMq.matches) rail.classList.add('expanded');
  });
  rail.addEventListener('mouseleave', () => {
    if (!mobileMq.matches) rail.classList.remove('expanded');
  });

  // Small screens: hover doesn't fire on touch at all, so tapping this
  // button is the only way in to open the menu there.
  toggleBtn.addEventListener('click', (e) => {
    if (mobileMq.matches) return;
    e.stopPropagation();
    rail.classList.toggle('expanded');
  });
  // Tapping anywhere outside the open menu closes it again on mobile.
  document.addEventListener('click', (e) => {
    if (!mobileMq.matches && rail.classList.contains('expanded') && !rail.contains(e.target) && e.target !== toggleBtn) {
      rail.classList.remove('expanded');
    }
  });

  // Collapse immediately on selection, even though the page navigation
  // that follows would reset it anyway — feels more responsive.
  rail.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    if (!mobileMq.matches) rail.classList.remove('expanded');
  }));
}
