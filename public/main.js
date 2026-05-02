// ── Apply Theme from Settings ──────────────────────────────
async function applyTheme() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    if (s.colors) {
      const r = document.documentElement.style;
      r.setProperty('--bg',      s.colors.bg);
      r.setProperty('--surface', s.colors.surface);
      r.setProperty('--sidebar', s.colors.sidebar);
      r.setProperty('--gold',    s.colors.gold);
      r.setProperty('--orange',  s.colors.orange);
      r.setProperty('--text',    s.colors.text);
      r.setProperty('--text-sec',s.colors.textSec);
      r.setProperty('--muted',   s.colors.muted);
      r.setProperty('--border',  hexAlpha(s.colors.gold, 0.15));
      r.setProperty('--glow',    hexAlpha(s.colors.gold, 0.08));
    }
    if (s.seo) {
      if (s.seo.title && !document.title.startsWith('Admin')) document.title = s.seo.title + (document.title.includes('|') ? ' | ' + document.title.split('|')[1].trim() : '');
    }
    return s;
  } catch(e) { return null; }
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Navbar ─────────────────────────────────────────────────
function initNavbar() {
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) navLinks.classList.remove('open');
    });
  }
  // Active link
  const path = window.location.pathname.replace(/\/$/, '') || '/index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href').replace(/\/$/, '') || '/index.html';
    if (path === href || path.endsWith(href)) a.classList.add('active');
  });
}

// ── Format Date ────────────────────────────────────────────
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });
}
function fmtDateShort(d) {
  return new Date(d).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' });
}

// ── Badge HTML ─────────────────────────────────────────────
function badgeHtml(type, text) {
  const cls = {
    research:'badge-research', articles:'badge-article', news:'badge-news',
    Research:'badge-research', Article:'badge-article', News:'badge-news',
    Policy:'badge-policy', Economics:'badge-economics', Commentary:'badge-commentary',
    Event:'badge-event', Publication:'badge-publication', Media:'badge-media',
    'Macroeconomics':'badge-research', 'Policy Analysis':'badge-policy',
    'Comparative Economics':'badge-economics',
  };
  const c = cls[type] || 'badge-article';
  return `<span class="card-badge ${c}">${text || type}</span>`;
}

// ── Render Research Card ───────────────────────────────────
function researchCard(item) {
  const keywords = (item.keywords || []).slice(0,3).map(k => `<span class="keyword-chip">${k}</span>`).join('');
  return `<div class="card fade-in">
    ${badgeHtml(item.area || 'Research', item.area || 'Research')}
    <h3 class="card-title">${item.title}</h3>
    <p class="card-excerpt">${(item.abstract||'').substring(0,160)}…</p>
    <div class="card-keywords">${keywords}</div>
    <div class="card-meta"><span class="card-date">📅 ${fmtDateShort(item.date)}</span></div>
    <a href="/post.html?type=research&id=${item.id}" class="card-link">Read Paper →</a>
  </div>`;
}

// ── Render Article Card ────────────────────────────────────
function articleCard(item) {
  const tags = (item.tags || []).slice(0,3).map(t => `<span class="tag-chip">${t}</span>`).join('');
  return `<div class="card fade-in">
    ${badgeHtml(item.category || 'Article', item.category || 'Article')}
    <h3 class="card-title">${item.title}</h3>
    <p class="card-excerpt">${(item.excerpt||'').substring(0,160)}…</p>
    <div class="card-tags">${tags}</div>
    <div class="card-meta"><span class="card-date">📅 ${fmtDateShort(item.date)}</span></div>
    <a href="/post.html?type=articles&id=${item.id}" class="card-link">Read Article →</a>
  </div>`;
}

// ── Render News Card ───────────────────────────────────────
function newsCard(item) {
  return `<div class="card fade-in">
    ${badgeHtml(item.category || 'News', item.category || 'News')}
    <h3 class="card-title">${item.headline || item.title}</h3>
    <p class="card-excerpt">${(item.content||'').substring(0,160)}…</p>
    <div class="card-meta"><span class="card-date">📅 ${fmtDateShort(item.date)}</span></div>
    <a href="/post.html?type=news&id=${item.id}" class="card-link">Read More →</a>
  </div>`;
}

// ── Loader HTML ────────────────────────────────────────────
const loaderHtml = `<div class="loader"><div class="spinner"></div></div>`;
const emptyHtml  = (msg='No content yet.') => `<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">${msg}</div></div>`;

// ── Init on DOM Ready ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  initNavbar();
});
