/**
 * api.js — Frield Extension Central API Client
 * All API calls go through this module with unified JWT handling.
 * Modified from the web app version: uses chrome.storage.local instead of localStorage
 * and routes all requests to http://localhost:3000 (the local backend).
 */

const API_BASE = 'http://localhost:3000';

// ── Chrome storage helpers (async wrappers) ────────────────────
const CStore = {
  get: (key) => new Promise(res => chrome.storage.local.get(key, d => res(d[key] ?? null))),
  set: (key, val) => new Promise(res => chrome.storage.local.set({ [key]: val }, res)),
  remove: (...keys) => new Promise(res => chrome.storage.local.remove(keys, res)),
};

// ── Token Management ───────────────────────────────────────────
const Auth = {
  getToken:   () => {
    // Synchronous read (available after init) — populated by initAuth()
    return window.__frield_token || null;
  },
  getUser:    () => {
    try { return window.__frield_user || null; } catch { return null; }
  },
  setToken:   async (t) => { window.__frield_token = t; await CStore.set('frield_token', t); },
  setUser:    async (u) => { window.__frield_user = u;  await CStore.set('frield_user', u); },
  clear:      async ()  => {
    window.__frield_token = null;
    window.__frield_user  = null;
    await CStore.remove('frield_token', 'frield_user');
  },
  isLoggedIn: () => !!window.__frield_token
};

// ── Load stored auth into memory sync cache ───────────────────
async function initAuth() {
  window.__frield_token = await CStore.get('frield_token');
  window.__frield_user  = await CStore.get('frield_user');

  // After loading auth, check if we need to redirect to login
  if (!Auth.isLoggedIn()) {
    const path = location.pathname;
    const isLoginPage = path.endsWith('index.html');
    if (!isLoginPage) {
      window.location.href = chrome.runtime.getURL('pages/index.html');
    }
  }
}

// ── Core Fetch Wrapper ─────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    await Auth.clear();
    window.location.href = chrome.runtime.getURL('pages/index.html');
    return Promise.reject(new Error('Unauthorized'));
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── API Namespaces ─────────────────────────────────────────────
const API = {

  auth: {
    googleLogin: (token) => apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),
    getUser: () => apiFetch('/auth/user'),
    logout:  async () => {
      await Auth.clear();
      window.location.href = chrome.runtime.getURL('pages/index.html');
    }
  },

  emails: {
    list:     () => apiFetch('/emails'),
    get:      (id) => apiFetch(`/emails/${id}`),
    classify: (data) => apiFetch('/emails/classify', { method: 'POST', body: JSON.stringify(data) }),
    recheck:  (emailId, category) => apiFetch('/emails/recheck', {
      method: 'POST',
      body: JSON.stringify({ email_id: emailId, category })
    }),
    scoreUrl: (data) => apiFetch('/emails/score-text', { method: 'POST', body: JSON.stringify(data) })
  },

  vault: {
    list:   () => apiFetch('/vault'),
    add:    (data) => apiFetch('/vault/add', { method: 'POST', body: JSON.stringify(data) }),
    verify: () => apiFetch('/vault/verify', { method: 'POST' }),
    delete: (id) => apiFetch(`/vault/${id}`, { method: 'DELETE' })
  },

  subscription: {
    status:  () => apiFetch('/subscription/status'),
    upgrade: (plan) => apiFetch('/subscription/upgrade', {
      method: 'POST',
      body: JSON.stringify({ plan, payment_token: 'mock-tok-' + Date.now() })
    })
  },

  google: {
    getAuthUrl:  () => apiFetch('/google/auth-url'),
    getStatus:   () => apiFetch('/google/status'),
    sync:        () => apiFetch('/google/sync', { method: 'POST' }),
    disconnect:  () => apiFetch('/google/disconnect', { method: 'DELETE' })
  },

  passwords: {
    list:   ()     => apiFetch('/passwords'),
    add:    (data) => apiFetch('/passwords/add', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/passwords/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id)   => apiFetch(`/passwords/${id}`, { method: 'DELETE' })
  }
};

// ── Shared UI Helpers ──────────────────────────────────────────

function populateSidebar() {
  const user = Auth.getUser();
  if (!user) return;

  const avatar = document.getElementById('userAvatar');
  const name   = document.getElementById('userName');
  const email  = document.getElementById('userEmail');
  const badge  = document.getElementById('planBadge');

  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name||'U')}&background=00FF7F&color=0D1117`;
  if (avatar) { avatar.src = user.avatar || fallback; avatar.onerror = () => { avatar.src = fallback; }; }
  if (name)   name.textContent = user.name || 'User';
  if (email)  email.textContent = user.email || '';
  if (badge) {
    badge.textContent = (user.plan === 'pro') ? 'PRO' : 'FREE';
    badge.className = `plan-badge ${user.plan === 'pro' ? 'pro' : 'free'}`;
  }
}

function showToast(message, type = 'info', duration = 3500) {
  const tc = document.getElementById('toastContainer');
  if (!tc) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  tc.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function categoryBadge(cat) {
  const map = {
    'SAFE':       '<span class="badge badge-safe">✓ Safe</span>',
    'SUSPICIOUS': '<span class="badge badge-suspicious">⚠ Suspicious</span>',
    'DANGEROUS':  '<span class="badge badge-dangerous">🚨 Dangerous</span>',
    'PENDING':    '<span class="badge badge-pending">⏳ Pending</span>'
  };
  return map[cat] || `<span class="badge">${cat}</span>`;
}

function authStatusPill(status) {
  return status === 'pass'
    ? '<span style="color:var(--safe);font-size:11px;font-weight:600;">✓ Pass</span>'
    : status === 'fail'
    ? '<span style="color:var(--danger);font-size:11px;font-weight:600;">✕ Fail</span>'
    : '<span style="color:var(--text-muted);font-size:11px;">? Unknown</span>';
}

function scoreBarHTML(score, category) {
  const cls = (category || '').toLowerCase();
  return `
    <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;margin-right:6px;">${score}</span>
    <span class="score-bar">
      <span class="score-fill ${cls}" style="width:${score}%;"></span>
    </span>
  `;
}

// ── Init on every page ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  populateSidebar();
});
