/** Shared chrome: digital clock, marquee, scroll-top, smooth scroll */

export function formatDigitalClock(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hr = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return { date: `${dd}/${mm}/${yy}`, time: `${hr}:${min}:${sec}` };
}

export function startDigitalClock(el) {
  if (!el) return;
  const tick = () => {
    const { date, time } = formatDigitalClock();
    el.innerHTML = `<span class="clock-date">${date}</span><span class="clock-sep">·</span><span class="clock-time">${time}</span>`;
  };
  tick();
  return setInterval(tick, 1000);
}

export function ensureScrollTopButton() {
  if (document.getElementById('scroll-top-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.type = 'button';
  btn.className = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body.appendChild(btn);

  const onScroll = () => {
    if (window.scrollY > 320) btn.classList.add('visible');
    else btn.classList.remove('visible');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function enableSmoothAnchors() {
  document.documentElement.style.scrollBehavior = 'smooth';
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.startsWith('http')) return;
    const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
    if (!hash || hash === '#') return;
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', hash);
    }
  });
}

const DEFAULT_MARQUEE = [
  'Welcome to SJB Association — save together, vote together, show up for one another.',
  'Membership is by approval. Complete registration, admin review, then pay your membership fee.',
  'Join savings groups, stand in elections, use the job board and member forums.',
  'Questions? Visit Contact or message admins from your dashboard.',
];

export async function loadMarqueeItems(supabase) {
  try {
    if (!supabase) return DEFAULT_MARQUEE;
    const { data } = await supabase
      .from('site_announcements')
      .select('message')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(20);
    if (data?.length) return data.map((r) => r.message).filter(Boolean);
  } catch {
    /* table may not exist yet */
  }
  return DEFAULT_MARQUEE;
}

export function renderMarquee(container, items) {
  if (!container) return;
  const list = (items?.length ? items : DEFAULT_MARQUEE).join('   ·   ');
  // Duplicate content for seamless loop
  container.innerHTML = `
    <div class="marquee-track" aria-hidden="false">
      <span class="marquee-text">${escapeHtml(list)}   ·   ${escapeHtml(list)}</span>
    </div>`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

export function initUiChrome({ clockEl, marqueeEl, supabase } = {}) {
  enableSmoothAnchors();
  ensureScrollTopButton();
  if (clockEl) startDigitalClock(clockEl);
  if (marqueeEl) {
    loadMarqueeItems(supabase).then((items) => renderMarquee(marqueeEl, items));
  }
}
