// ── JWT Auth Guard ──────────────────────────────────────────
const TOKEN_KEY = 'ks_admin_token';
function getToken() { return localStorage.getItem(TOKEN_KEY); }

// Verify token on load
fetch('/api/admin/check', { headers: { 'Authorization': 'Bearer ' + (getToken() || '') } })
  .then(r => r.json())
  .then(d => { if (!d.isAdmin) window.location = '/admin/login.html'; })
  .catch(() => { window.location = '/admin/login.html'; });

// ── Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
const api = async (url, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (getToken() || ''), ...(opts.headers || {}) };
  const r = await fetch(url, { ...opts, headers });
  if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); window.location = '/admin/login.html'; return {}; }
  return r.json();
};

let allItems = [];
let currentFilter = 'all';
let settingsCache = {};

// ── Live Clock ─────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  $('topbar-time').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000); updateClock();

// ── Sidebar Navigation ─────────────────────────────────────
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  $('panel-' + name).classList.add('active');
  document.querySelector('[data-panel="' + name + '"]')?.classList.add('active');
  $('topbar-title').textContent = { dashboard: 'Dashboard', publish: 'Publish Content', manage: 'Manage Content', customize: 'Customize', settings: 'Settings' }[name] || name;
  if (name === 'dashboard') loadDashboard();
  if (name === 'manage')    loadManage();
  if (name === 'customize') loadCustomize();
  if (name === 'settings')  loadSettings();
}
document.querySelectorAll('.sidebar-link[data-panel]').forEach(btn => {
  btn.addEventListener('click', () => { switchPanel(btn.dataset.panel); $('sidebar').classList.remove('open'); });
});
$('sidebar-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));

// ── Logout ─────────────────────────────────────────────────
$('logout-btn').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' });
  localStorage.removeItem(TOKEN_KEY);
  window.location = '/admin/login.html';
});

// ── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await api('/api/admin/stats');
    $('s-research').textContent = stats.research;
    $('s-articles').textContent = stats.articles;
    $('s-news').textContent = stats.news;
    $('s-total').textContent = stats.total;
    const typeMap = { Research: 'tb-research', Article: 'tb-article', News: 'tb-news' };
    $('recent-list').innerHTML = stats.recent && stats.recent.length
      ? stats.recent.map(i => `<div class="recent-item">
          <span class="type-badge ${typeMap[i.type] || 'tb-article'}">${i.type}</span>
          <span class="recent-title">${i.title || i.headline || 'Untitled'}</span>
          <span class="recent-date">${fmtDate(i.date || i.createdAt)}</span>
        </div>`).join('')
      : '<div style="color:var(--muted);padding:1rem;text-align:center">No content yet. Start publishing!</div>';
  } catch (e) { $('recent-list').innerHTML = '<div style="color:var(--muted);padding:1rem">Failed to load stats.</div>'; }
}

// ── Publish Forms ──────────────────────────────────────────
document.querySelectorAll('.pub-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pub-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    $('form-' + tab.dataset.tab).classList.add('active');
  });
});
document.querySelectorAll('input[type=date]').forEach(el => { el.value = new Date().toISOString().split('T')[0]; });

async function handlePublish(e) {
  e.preventDefault();
  const form = e.target;
  const type = form.dataset.type;
  const btn  = form.querySelector('button[type=submit]');
  const res  = form.querySelector('.form-result');
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (k === 'keywords' || k === 'tags') data[k] = v.split(',').map(s => s.trim()).filter(Boolean);
    else data[k] = v;
  });
  btn.disabled = true; btn.textContent = '⏳ Publishing...';
  res.textContent = ''; res.style.color = '';
  try {
    const result = await api('/api/admin/' + type, { method: 'POST', body: JSON.stringify(data) });
    if (result.id) {
      res.textContent = '✅ Published successfully!'; res.style.color = '#64dc82';
      form.reset();
      document.querySelectorAll('input[type=date]').forEach(el => { el.value = new Date().toISOString().split('T')[0]; });
    } else { res.textContent = '❌ ' + (result.error || 'Failed'); res.style.color = '#ff6464'; }
  } catch { res.textContent = '❌ Network error'; res.style.color = '#ff6464'; }
  btn.disabled = false; btn.textContent = '📤 Publish';
}
['form-research', 'form-article', 'form-news'].forEach(id => $(id)?.addEventListener('submit', handlePublish));

// ── Manage ─────────────────────────────────────────────────
async function loadManage() {
  try {
    const [research, articles, news] = await Promise.all([
      api('/api/research'), api('/api/articles'), api('/api/news')
    ]);
    allItems = [
      ...(research || []).map(i => ({ ...i, _type: 'research' })),
      ...(articles || []).map(i => ({ ...i, _type: 'articles' })),
      ...(news || []).map(i => ({ ...i, _type: 'news' })),
    ].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    renderManageTable();
  } catch (e) { $('manage-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">Failed to load content.</td></tr>'; }
}

function renderManageTable() {
  const filtered = currentFilter === 'all' ? allItems : allItems.filter(i => i._type === currentFilter);
  if (!filtered.length) {
    $('manage-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No content in this category.</td></tr>';
    return;
  }
  const typeMap   = { research: 'tb-research', articles: 'tb-article', news: 'tb-news' };
  const typeLabel = { research: 'Research', articles: 'Article', news: 'News' };
  $('manage-tbody').innerHTML = filtered.map((item, idx) => `
    <tr>
      <td style="color:var(--muted)">${idx + 1}</td>
      <td class="title-cell">${item.title || item.headline || 'Untitled'}</td>
      <td class="hide-sm"><span class="type-badge ${typeMap[item._type]}">${typeLabel[item._type]}</span></td>
      <td class="hide-sm" style="color:var(--muted)">${fmtDate(item.date || item.createdAt)}</td>
      <td><div class="actions">
        <button class="btn btn-ghost btn-sm" onclick="openEdit('${item._type}','${item.id}')">✏ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('${item._type}','${item.id}',this)">🗑</button>
      </div></td>
    </tr>`).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderManageTable();
  });
});

async function deleteItem(type, id, btn) {
  if (!confirm('Are you sure you want to permanently delete this item?')) return;
  btn.textContent = '⏳'; btn.disabled = true;
  try {
    const r = await api('/api/admin/' + type + '/' + id, { method: 'DELETE' });
    if (r.success) { allItems = allItems.filter(i => i.id !== id); renderManageTable(); }
    else { alert('Delete failed: ' + (r.error || 'Unknown error')); btn.textContent = '🗑'; btn.disabled = false; }
  } catch { alert('Network error'); btn.textContent = '🗑'; btn.disabled = false; }
}

// ── Edit Modal ─────────────────────────────────────────────
async function openEdit(type, id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  $('modal-title').textContent = { research: 'Edit Research Paper', articles: 'Edit Article', news: 'Edit News' }[type] || 'Edit';
  $('edit-fields').innerHTML = buildEditFields(type, item);
  $('edit-modal').classList.add('open');
  $('edit-form').onsubmit = (e) => submitEdit(e, type, id);
}

function buildEditFields(type, item) {
  const g = (label, name, val, tag = 'input', extra = '') =>
    `<div class="form-group"><label class="form-label">${label}</label>${tag === 'textarea' ? `<textarea name="${name}" class="form-textarea" style="min-height:120px">${val || ''}</textarea>` : `<input type="${extra || 'text'}" name="${name}" class="form-input" value="${(val || '').toString().replace(/"/g, '&quot;')}">`}</div>`;
  if (type === 'research') return `
    <div class="form-row">${g('Title *', 'title', item.title)}${g('Research Area *', 'area', item.area)}</div>
    ${g('Abstract', 'abstract', item.abstract, 'textarea')}
    <div class="form-row"><div class="form-group"><label class="form-label">Keywords (comma)</label><input name="keywords" class="form-input" value="${(item.keywords || []).join(', ')}"></div>${g('Date', 'date', item.date, 'input', 'date')}</div>
    ${g('Full Body (HTML)', 'body', item.body, 'textarea')}
    ${g('External Link', 'link', item.link, 'input', 'url')}`;
  if (type === 'articles') return `
    <div class="form-row">${g('Title *', 'title', item.title)}<div class="form-group"><label class="form-label">Category</label><input name="category" class="form-input" value="${item.category || ''}"></div></div>
    ${g('Excerpt', 'excerpt', item.excerpt, 'textarea')}
    ${g('Full Body (HTML)', 'body', item.body, 'textarea')}
    <div class="form-row"><div class="form-group"><label class="form-label">Tags (comma)</label><input name="tags" class="form-input" value="${(item.tags || []).join(', ')}"></div>${g('Date', 'date', item.date, 'input', 'date')}</div>`;
  if (type === 'news') return `
    <div class="form-row">${g('Headline *', 'headline', item.headline)}<div class="form-group"><label class="form-label">Category</label><input name="category" class="form-input" value="${item.category || ''}"></div></div>
    ${g('Content', 'content', item.content, 'textarea')}
    <div class="form-row">${g('Date', 'date', item.date, 'input', 'date')}${g('External Link', 'link', item.link, 'input', 'url')}</div>`;
  return '';
}

async function submitEdit(e, type, id) {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('button[type=submit]');
  const res  = $('edit-result');
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (k === 'keywords' || k === 'tags') data[k] = v.split(',').map(s => s.trim()).filter(Boolean);
    else data[k] = v;
  });
  btn.disabled = true; btn.textContent = '⏳ Saving...';
  try {
    const result = await api('/api/admin/' + type + '/' + id, { method: 'PUT', body: JSON.stringify(data) });
    if (result.id || result.headline) {
      res.textContent = '✅ Saved!'; res.style.color = '#64dc82';
      const idx = allItems.findIndex(i => i.id === id);
      if (idx > -1) allItems[idx] = { ...allItems[idx], ...result, _type: type };
      renderManageTable();
      setTimeout(() => { $('edit-modal').classList.remove('open'); res.textContent = ''; }, 1200);
    } else { res.textContent = '❌ ' + (result.error || 'Failed'); res.style.color = '#ff6464'; }
  } catch { res.textContent = '❌ Network error'; res.style.color = '#ff6464'; }
  btn.disabled = false; btn.textContent = '💾 Save Changes';
}

$('modal-close').addEventListener('click', () => $('edit-modal').classList.remove('open'));
$('modal-cancel').addEventListener('click', () => $('edit-modal').classList.remove('open'));
$('edit-modal').addEventListener('click', e => { if (e.target === $('edit-modal')) $('edit-modal').classList.remove('open'); });

// ── Customize ──────────────────────────────────────────────
const PRESETS = {
  'dark-gold':   { bg: '#0f0f0f', surface: '#1a1a1a', sidebar: '#141414', gold: '#c9a84c', orange: '#e07b39', text: '#e8e8e8', textSec: '#a0a0a0', muted: '#555555' },
  'cream-brown': { bg: '#faf6f0', surface: '#ffffff',  sidebar: '#f0ebe3', gold: '#8B4513', orange: '#D2691E', text: '#2d1e0f', textSec: '#6b4c2e', muted: '#a08060' },
  'navy-white':  { bg: '#0a192f', surface: '#112240',  sidebar: '#0a192f', gold: '#64ffda', orange: '#f57c00', text: '#ccd6f6', textSec: '#8892b0', muted: '#495670' },
  'deep-green':  { bg: '#0a1a12', surface: '#112214',  sidebar: '#081510', gold: '#4caf50', orange: '#ff9800', text: '#e8f5e9', textSec: '#a5d6a7', muted: '#4a7550' },
};

async function loadCustomize() {
  try {
    const s = await api('/api/admin/settings');
    settingsCache = s;
    const h = s.hero || {}; const a = s.about || {}; const sc = s.social || {}; const c = s.colors || {};
    ['siteTitle','tagline','kicker','heading','subtitle','metaLine','cta1Text','cta1Link','cta2Text','cta2Link','footerText','stat1Value','stat1Label','stat2Value','stat2Label','stat3Value','stat3Label','stat4Value','stat4Label'].forEach(f => { const el = $('c-' + f); if (el) el.value = h[f] || ''; });
    ['name','titleLine','bio1','bio2','bio3','photoUrl','interests'].forEach(f => { const el = $('c-' + f); if (el) el.value = a[f] || ''; });
    ['email','linkedin','twitter','github','researchgate','ssrn'].forEach(f => { const el = $('c-' + f); if (el) el.value = sc[f] || ''; });
    Object.entries(c).forEach(([k, v]) => { const el = $('c-' + k); if (el) el.value = v; });
    if (s.about?.name) $('info-author').textContent = s.about.name;
  } catch (e) { console.error('Failed to load settings', e); }
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    Object.entries(p).forEach(([k, v]) => { const el = $('c-' + k); if (el) el.value = v; });
  });
});

$('save-customize-btn').addEventListener('click', async () => {
  const btn = $('save-customize-btn'); const msg = $('customize-msg');
  btn.disabled = true; btn.textContent = '⏳ Saving...';
  const hero = {}, about = {}, social = {}, colors = {};
  ['siteTitle','tagline','kicker','heading','subtitle','metaLine','cta1Text','cta1Link','cta2Text','cta2Link','footerText','stat1Value','stat1Label','stat2Value','stat2Label','stat3Value','stat3Label','stat4Value','stat4Label'].forEach(f => { const el = $('c-' + f); if (el) hero[f] = el.value; });
  ['name','titleLine','bio1','bio2','bio3','photoUrl','interests'].forEach(f => { const el = $('c-' + f); if (el) about[f] = el.value; });
  ['email','linkedin','twitter','github','researchgate','ssrn'].forEach(f => { const el = $('c-' + f); if (el) social[f] = el.value; });
  ['bg','surface','sidebar','gold','orange','text','textSec','muted'].forEach(f => { const el = $('c-' + f); if (el) colors[f] = el.value; });
  try {
    const r = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ hero, about, social, colors }) });
    if (r.success) { msg.textContent = '✅ All changes saved!'; msg.className = 'alert alert-success'; msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); }
    else { msg.textContent = '❌ ' + (r.error || 'Save failed'); msg.className = 'alert alert-error'; msg.style.display = 'block'; }
  } catch { msg.textContent = '❌ Network error'; msg.className = 'alert alert-error'; msg.style.display = 'block'; }
  btn.disabled = false; btn.textContent = '💾 Save All Changes';
});

// ── Settings ───────────────────────────────────────────────
async function loadSettings() {
  try {
    const s = await api('/api/admin/settings');
    if (s.seo) { $('seo-title').value = s.seo.title || ''; $('seo-desc').value = s.seo.description || ''; }
    if (s.about?.name) $('info-author').textContent = s.about.name;
  } catch {}
}

$('pw-form').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('pw-msg'); const btn = e.target.querySelector('button[type=submit]');
  const np = $('pw-new').value; const cp = $('pw-confirm').value;
  if (np !== cp) { msg.textContent = '❌ New passwords do not match'; msg.className = 'alert alert-error'; msg.style.display = 'block'; return; }
  btn.disabled = true;
  try {
    const r = await api('/api/admin/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: $('pw-old').value, newPassword: np }) });
    if (r.success) { msg.textContent = '✅ Password updated!'; msg.className = 'alert alert-success'; e.target.reset(); }
    else { msg.textContent = '❌ ' + (r.error || 'Failed'); msg.className = 'alert alert-error'; }
    msg.style.display = 'block';
  } catch { msg.textContent = '❌ Network error'; msg.className = 'alert alert-error'; msg.style.display = 'block'; }
  btn.disabled = false;
});

$('save-seo-btn').addEventListener('click', async () => {
  const msg = $('seo-msg'); const btn = $('save-seo-btn');
  btn.disabled = true;
  try {
    const current = await api('/api/admin/settings');
    const r = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ ...current, seo: { title: $('seo-title').value, description: $('seo-desc').value } }) });
    msg.textContent = r.success ? '✅ SEO settings saved!' : '❌ ' + (r.error || 'Failed');
    msg.className = r.success ? 'alert alert-success' : 'alert alert-error';
    msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000);
  } catch { msg.textContent = '❌ Network error'; msg.className = 'alert alert-error'; msg.style.display = 'block'; }
  btn.disabled = false;
});

$('clear-all-btn').addEventListener('click', async () => {
  if (!confirm('This will PERMANENTLY delete ALL research, articles, and news.\n\nAre you absolutely sure?')) return;
  if (!confirm('Second confirmation: Delete everything? This cannot be undone.')) return;
  const msg = $('clear-msg'); const btn = $('clear-all-btn');
  btn.disabled = true;
  try {
    const r = await api('/api/admin/clear-all', { method: 'DELETE' });
    if (r.success) { msg.textContent = '✅ All content cleared.'; msg.className = 'alert alert-success'; }
    else { msg.textContent = '❌ ' + (r.error || 'Failed'); msg.className = 'alert alert-error'; }
    msg.style.display = 'block';
  } catch { msg.textContent = '❌ Network error'; msg.className = 'alert alert-error'; msg.style.display = 'block'; }
  btn.disabled = false;
});

// ── Init ───────────────────────────────────────────────────
loadDashboard();
