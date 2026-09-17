/**
 * api.js — Frield Central API Client
 * All API calls go through this module with unified JWT handling.
 */

const API_BASE = window.location.origin;

// ─── Token Management ──────────────────────────────────────────
const Auth = {
  getToken:  () => localStorage.getItem('frield_token'),
  getUser:   () => { try { return JSON.parse(localStorage.getItem('frield_user')); } catch { return null; } },
  setToken:  (t) => localStorage.setItem('frield_token', t),
  setUser:   (u) => localStorage.setItem('frield_user', JSON.stringify(u)),
  clear:     ()  => { localStorage.removeItem('frield_token'); localStorage.removeItem('frield_user'); },
  isLoggedIn: () => !!localStorage.getItem('frield_token')
};

// Redirect to login if not authenticated (except on login page itself)
if (!Auth.isLoggedIn() && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
  window.location.href = '/index.html';
}

// ─── Core Fetch Wrapper ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (res.status === 401) {
    Auth.clear();
    window.location.href = '/index.html';
    return Promise.reject(new Error('Unauthorized'));
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── API Namespaces ────────────────────────────────────────────
const API = {

  auth: {
    googleLogin: (token) => apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),
    getUser: () => apiFetch('/auth/user'),
    logout:  () => {
      Auth.clear();
      window.location.href = '/index.html';
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

// ─── Shared UI Helpers ─────────────────────────────────────────

/** Populate sidebar user info from localStorage */
function populateSidebar() {
  const user = Auth.getUser();
  if (!user) return;

  const avatar = document.getElementById('userAvatar');
  const name   = document.getElementById('userName');
  const email  = document.getElementById('userEmail');
  const badge  = document.getElementById('planBadge');

  if (avatar) { avatar.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00FF7F&color=0D1117`; avatar.onerror = ()=>{ avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name||'U')}&background=00FF7F&color=0D1117`; }; }
  if (name)   name.textContent = user.name || 'User';
  if (email)  email.textContent = user.email || '';
  if (badge) {
    badge.textContent = (user.plan === 'pro') ? 'PRO' : 'FREE';
    badge.className = `plan-badge ${user.plan === 'pro' ? 'pro' : 'free'}`;
  }
}

/** Show/hide toast notification */
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

/** Close any modal by its ID */
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/** Format date string to readable */
function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format datetime */
function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Get category badge HTML */
function categoryBadge(cat) {
  const map = {
    'SAFE':       '<span class="badge badge-safe">✓ Safe</span>',
    'SUSPICIOUS': '<span class="badge badge-suspicious">⚠ Suspicious</span>',
    'DANGEROUS':  '<span class="badge badge-dangerous">🚨 Dangerous</span>',
    'PENDING':    '<span class="badge badge-pending">⏳ Pending</span>'
  };
  return map[cat] || `<span class="badge">${cat}</span>`;
}

/** Get auth status HTML trio */
function authStatusPill(status) {
  return status === 'pass'
    ? '<span style="color:var(--safe);font-size:11px;font-weight:600;">✓ Pass</span>'
    : status === 'fail'
    ? '<span style="color:var(--danger);font-size:11px;font-weight:600;">✕ Fail</span>'
    : '<span style="color:var(--text-muted);font-size:11px;">? Unknown</span>';
}

/** Score bar HTML */
function scoreBarHTML(score, category) {
  const cls = (category || '').toLowerCase();
  return `
    <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;margin-right:6px;">${score}</span>
    <span class="score-bar">
      <span class="score-fill ${cls}" style="width:${score}%;"></span>
    </span>
  `;
}

// Initialize sidebar on all pages
document.addEventListener('DOMContentLoaded', () => {
  populateSidebar();

  // ── Register Service Worker (PWA) ──────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[Frield PWA] Service Worker registered, scope:', reg.scope);
        // When a new SW is waiting, prompt to reload
        reg.onupdatefound = () => {
          const newWorker = reg.installing;
          newWorker.onstatechange = () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[Frield PWA] New version available — reload to update.');
            }
          };
        };
      })
      .catch(err => console.warn('[Frield PWA] SW registration failed:', err));
  }
});

// ── PWA Install Banner ─────────────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show a subtle install toast if the page has a toastContainer
  setTimeout(() => {
    const tc = document.getElementById('toastContainer');
    if (!tc) return;
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.style.cursor = 'pointer';
    toast.innerHTML = '📲 <strong>Install Frield</strong> as an app for offline access';
    toast.onclick = () => {
      deferredInstallPrompt?.prompt();
      deferredInstallPrompt = null;
      toast.remove();
    };
    tc.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
  }, 3000);
});

