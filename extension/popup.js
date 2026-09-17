/**
 * popup.js — Frield Chrome Extension Popup Logic
 * Handles login state, threat stats, scan-this-page, and navigation.
 */

const API_BASE = 'http://localhost:3000';

// ── Storage helpers (chrome.storage.local is async) ──────────────
const Store = {
  get: (key) => new Promise(res => chrome.storage.local.get(key, d => res(d[key] ?? null))),
  set: (key, val) => new Promise(res => chrome.storage.local.set({ [key]: val }, res)),
  remove: (key) => new Promise(res => chrome.storage.local.remove(key, res)),
};

// ── Page open helper ──────────────────────────────────────────────
function openPage(page) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`pages/${page}`) });
  window.close();
}

function openLoginPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/index.html') });
  window.close();
}

// ── Core fetch (no redirect loops in popup) ───────────────────────
async function apiFetch(path, options = {}) {
  const token = await Store.get('frield_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Health check ──────────────────────────────────────────────────
async function checkServer() {
  const el = document.getElementById('serverStatus');
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      el.textContent = '🟢 Server online';
      el.className = 'server-status ok';
      return true;
    }
  } catch {}
  el.textContent = '🔴 Server offline';
  el.className = 'server-status err';

  const statusPill = document.getElementById('statusPill');
  if (statusPill) {
    statusPill.textContent = '🔴 OFFLINE';
    statusPill.classList.add('offline');
  }
  return false;
}

// ── Populate user card ────────────────────────────────────────────
async function populateUser() {
  const user = await Store.get('frield_user');
  if (!user) return;
  const avatar = document.getElementById('popupAvatar');
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=00FF7F&color=0D1117`;
  if (avatar) {
    avatar.src = user.avatar || fallbackUrl;
    avatar.onerror = () => { avatar.src = fallbackUrl; };
  }
  const nameEl = document.getElementById('popupName');
  const emailEl = document.getElementById('popupEmail');
  const planEl = document.getElementById('popupPlan');
  if (nameEl) nameEl.textContent = user.name || 'User';
  if (emailEl) emailEl.textContent = user.email || '';
  if (planEl) {
    planEl.textContent = (user.plan === 'pro') ? 'PRO ⚡' : 'FREE';
    if (user.plan === 'pro') planEl.style.background = 'rgba(255,211,42,0.15)';
  }
}

// ── Load threat stats ─────────────────────────────────────────────
async function loadStats() {
  try {
    const { emails } = await apiFetch('/emails');
    const all = emails || [];

    const safe      = all.filter(e => e.category === 'SAFE').length;
    const susp      = all.filter(e => e.category === 'SUSPICIOUS').length;
    const dangerous = all.filter(e => e.category === 'DANGEROUS').length;

    setEl('statSafe',   safe);
    setEl('statSusp',   susp);
    setEl('statDanger', dangerous);

    // Danger badge in nav
    const badge = document.getElementById('dangerBadge');
    if (badge) {
      if (dangerous > 0) {
        badge.textContent = dangerous;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    // Recent threats section (top 3 dangerous)
    const dangerList = all
      .filter(e => e.category === 'DANGEROUS')
      .slice(0, 3);

    if (dangerList.length > 0) {
      const listEl = document.getElementById('recentList');
      const section = document.getElementById('recentThreats');
      if (listEl && section) {
        section.style.display = 'block';
        listEl.innerHTML = dangerList.map(e => `
          <div class="threat-item">
            <span class="ti-icon">🚨</span>
            <div class="ti-info">
              <div class="ti-subject">${escHtml(e.subject || '(no subject)')}</div>
              <div class="ti-sender">${escHtml(e.sender || '')}</div>
            </div>
            <span class="ti-score">${e.score || '—'}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('[Frield Popup] stats error:', err.message);
  }
}

// ── Scan current page ─────────────────────────────────────────────
async function scanCurrentPage() {
  const btn = document.getElementById('scanBtn');
  const resultEl = document.getElementById('scanResult');
  if (!btn || !resultEl) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="mini-spinner"></span> Scanning...';
  resultEl.style.display = 'none';

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');

    // Get links from content script
    let links = [];
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => Array.from(document.querySelectorAll('a[href]'))
                         .map(a => a.href)
                         .filter(h => h.startsWith('http'))
                         .slice(0, 20)
      });
      links = results?.[0]?.result || [];
    } catch {
      links = [tab.url];
    }

    const url = tab.url || '';
    const domain = url ? new URL(url).hostname : 'unknown';

    // Score via backend
    const result = await apiFetch('/emails/score-text', {
      method: 'POST',
      body: JSON.stringify({
        sender: `page@${domain}`,
        subject: tab.title || url,
        body: '',
        links
      })
    });

    const cat = result.category || 'UNKNOWN';
    const score = result.score ?? '—';
    const emoji = cat === 'SAFE' ? '✅' : cat === 'SUSPICIOUS' ? '⚠️' : '🚨';
    const color = cat === 'SAFE' ? 'var(--safe)' : cat === 'SUSPICIOUS' ? 'var(--warning)' : 'var(--danger)';

    resultEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:16px;">${emoji}</span>
        <span style="font-weight:700;color:${color};">${cat}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${color};margin-left:auto;">Score: ${score}</span>
      </div>
      <div style="font-size:10px;color:var(--text-muted);">${links.length} links scanned on <strong>${domain}</strong></div>
    `;
    resultEl.style.display = 'block';
  } catch (err) {
    resultEl.innerHTML = `<span style="color:var(--danger)">❌ ${escHtml(err.message)}</span>`;
    resultEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🧠 Scan This Page';
  }
}

// ── Logout ────────────────────────────────────────────────────────
async function doLogout() {
  await Store.remove('frield_token');
  await Store.remove('frield_user');
  chrome.action.setBadgeText({ text: '' });
  window.location.reload();
}

// ── Helpers ───────────────────────────────────────────────────────
function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  const loading  = document.getElementById('loadingState');
  const loginDiv = document.getElementById('loginState');
  const mainDiv  = document.getElementById('mainState');

  const serverOk = await checkServer();
  const token    = await Store.get('frield_token');

  if (loading) loading.style.display = 'none';

  if (!token || !serverOk) {
    if (loginDiv) loginDiv.style.display = 'block';
    return;
  }

  if (mainDiv) mainDiv.style.display = 'block';
  await Promise.all([populateUser(), loadStats()]);
}

document.addEventListener('DOMContentLoaded', init);
