// Session Auth Guard
fetch('/api/admin/check', { credentials: 'include' })
  .then(r => r.json())
  .then(d => { if (!d.isAdmin) window.location = '/admin/login.html'; })
  .catch(() => { window.location = '/admin/login.html'; });

// Helpers
const $ = id => document.getElementById(id);
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
const api = async (url, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const r = await fetch(url, { ...opts, headers, credentials: 'include' });
  if (r.status === 401) { window.location = '/admin/login.html'; return {}; }
  return r.json();
};