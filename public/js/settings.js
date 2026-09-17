/**
 * settings.js — Profile, subscription, preferences, API key, logout
 */
// In a real app, API_KEY would be fetched securely from the backend.
const API_KEY = 'frield_sk_not_implemented_yet';
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
});

async function loadSettings() {
  try {
    const [user, sub] = await Promise.all([API.auth.getUser(), API.subscription.status()]);
    renderProfile(user);
    renderSubscription(sub, user);
    await checkGmailStatus();
  } catch (err) {
    showToast('❌ Failed to load settings: ' + err.message, 'error');
  }
}

// ─── Profile ───────────────────────────────────────────────────
function renderProfile(user) {
  if (!user) return;

  const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00FF7F&color=0D1117`;

  setEl('profileAvatar',  ''); // set via src
  const av = document.getElementById('profileAvatar');
  if (av) { av.src = avatarUrl; av.onerror = () => { av.src = `https://ui-avatars.com/api/?name=User&background=00FF7F&color=0D1117`; }; }

  setEl('profileName',  user.name || 'Unknown User');
  setEl('profileEmail', user.email || '');
  setEl('profileJoined', `Member since ${formatDate(user.created_at)}`);

  // Sidebar
  const ua = document.getElementById('userAvatar');
  if (ua) { ua.src = avatarUrl; }
  setEl('userName', user.name);
  setEl('userEmail', user.email);

  // Plan badge
  const plan = user.plan || 'free';
  const pb = document.getElementById('profilePlanBadge');
  if (pb) {
    pb.textContent = plan.toUpperCase();
    pb.className = `badge badge-${plan}`;
  }

  const sidebarBadge = document.getElementById('planBadge');
  if (sidebarBadge) {
    sidebarBadge.textContent = plan.toUpperCase();
    sidebarBadge.className = `plan-badge ${plan}`;
  }
}

// ─── Subscription ──────────────────────────────────────────────
function renderSubscription(sub, user) {
  if (!sub) return;
  const tier = sub.tier || 'free';
  const isPro = tier === 'pro';

  // Usage bar
  const scanCount = sub.scan_count || 0;
  const limit = isPro ? 999 : 50;
  const usagePct = isPro ? 0 : Math.min(100, (scanCount / limit) * 100);

  setEl('usageText', isPro ? `${scanCount} / Unlimited` : `${scanCount} / 50`);
  const bar = document.getElementById('usageBar');
  if (bar) {
    bar.style.width = `${isPro ? 5 : usagePct}%`;
    bar.style.background = usagePct > 80 ? 'var(--danger)' : 'var(--neon)';
  }
  setEl('usageNote', isPro
    ? '✅ Pro plan — unlimited scans per day'
    : `Free plan — ${Math.max(0, 50 - scanCount)} scans remaining today`);

  // Plan cards highlighting
  const freeCard = document.getElementById('freePlanCard');
  const proCard  = document.getElementById('proPlanCard');
  const freeBadge = document.getElementById('freeBadge');
  const proBadge  = document.getElementById('proBadge');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const freeBtn    = document.getElementById('freeBtn');

  if (isPro) {
    if (proCard)  proCard.classList.add('active-plan');
    if (proBadge) { proBadge.style.display = 'inline-flex'; proBadge.textContent = '✓ CURRENT'; }
    if (freeBadge) freeBadge.style.display = 'none';
    if (upgradeBtn) { upgradeBtn.disabled = true; upgradeBtn.textContent = '✅ Active Plan'; upgradeBtn.className = 'btn btn-ghost'; upgradeBtn.style.width='100%'; }
    if (freeBtn) freeBtn.textContent = 'Downgrade';
  } else {
    if (freeCard)  freeCard.classList.add('active-plan');
    if (freeBadge) { freeBadge.textContent = '✓ CURRENT'; freeBadge.className = 'badge badge-free'; }
    if (proBadge)  proBadge.style.display = 'none';
    if (freeBtn) freeBtn.textContent = 'Current Plan';
  }
}

// ─── Upgrade ───────────────────────────────────────────────────
async function upgradeToPro() {
  const btn = document.getElementById('upgradeBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing...'; }

  try {
    await API.subscription.upgrade('pro');

    // Update local user cache
    const user = Auth.getUser();
    if (user) { user.plan = 'pro'; Auth.setUser(user); }

    showToast('🎉 Upgraded to Pro! Enjoy unlimited scans and Blockchain Vault access.', 'success', 5000);
    setTimeout(() => loadSettings(), 500);
  } catch (err) {
    showToast('❌ Upgrade failed: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '⚡ Upgrade to Pro'; }
  }
}

// ─── Save Preferences ──────────────────────────────────────────
function saveSettings() {
  const prefs = {
    autoFilter:      document.getElementById('autoFilter')?.checked,
    browserMonitor:  document.getElementById('browserMonitor')?.checked,
    notifications:   document.getElementById('notifications')?.checked,
    weeklyReport:    document.getElementById('weeklyReport')?.checked
  };
  localStorage.setItem('frield_prefs', JSON.stringify(prefs));
  showToast('✅ Preferences saved!', 'success');
}

function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem('frield_prefs') || '{}');
    if (prefs.autoFilter     !== undefined) setCheck('autoFilter', prefs.autoFilter);
    if (prefs.browserMonitor !== undefined) setCheck('browserMonitor', prefs.browserMonitor);
    if (prefs.notifications  !== undefined) setCheck('notifications', prefs.notifications);
    if (prefs.weeklyReport   !== undefined) setCheck('weeklyReport', prefs.weeklyReport);
  } catch {}
}

function setCheck(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}

// ─── Gmail Integration ─────────────────────────────────────────
async function checkGmailStatus() {
  try {
    const { connected, settings } = await API.google.getStatus();
    const badge = document.getElementById('gmailStatusBadge');
    const connectedState = document.getElementById('gmailConnectedState');
    const disconnectedState = document.getElementById('gmailDisconnectedState');

    if (connected && settings.is_active) {
      if (badge) { badge.textContent = 'CONNECTED'; badge.className = 'badge badge-safe'; }
      if (connectedState) connectedState.style.display = 'block';
      if (disconnectedState) disconnectedState.style.display = 'none';
    } else {
      if (badge) { badge.textContent = 'DISCONNECTED'; badge.className = 'badge'; }
      if (connectedState) connectedState.style.display = 'none';
      if (disconnectedState) disconnectedState.style.display = 'block';
    }

    // Check for success/error URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === 'success') {
      showToast('🎉 Gmail successfully connected! AI scanning is now active.', 'success', 5000);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('gmail_connected') === 'error') {
      showToast('❌ Gmail connection failed. Please try again.', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (err) {
    console.error('Failed to check Gmail status:', err);
  }
}

async function connectGmail() {
  try {
    const { url } = await API.google.getAuthUrl();
    window.location.href = url;
  } catch (err) {
    showToast('❌ Failed to get authorization URL: ' + err.message, 'error');
  }
}

async function syncGmailNow() {
  const btn = document.getElementById('syncGmailBtn');
  btn.disabled = true;
  btn.innerHTML = '🔄 Syncing...';

  try {
    const result = await API.google.sync();
    showToast(`✅ Sync complete! ${result.new ?? 0} new emails analyzed.`, 'success');
  } catch (err) {
    showToast('❌ Gmail sync failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔄 Sync Now';
  }
}

async function disconnectGmail() {
  if (!confirm('Disconnect Gmail? Frield will stop monitoring your inbox for threats.')) return;

  const btn = document.querySelector('#gmailConnectedState .btn-outline');
  if (btn) { btn.disabled = true; btn.textContent = '🔌 Disconnecting...'; }

  try {
    await API.google.disconnect();

    // Update UI to reflect disconnected state
    const badge = document.getElementById('gmailStatusBadge');
    const connectedState  = document.getElementById('gmailConnectedState');
    const disconnectedState = document.getElementById('gmailDisconnectedState');

    if (badge) { badge.textContent = 'DISCONNECTED'; badge.className = 'badge'; }
    if (connectedState)    connectedState.style.display  = 'none';
    if (disconnectedState) disconnectedState.style.display = 'block';

    showToast('🔌 Gmail disconnected. You can reconnect anytime.', 'info', 4000);
  } catch (err) {
    showToast('❌ Failed to disconnect Gmail: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔌 Disconnect'; }
  }
}

// ─── API Key ───────────────────────────────────────────────────
function revealApiKey() {
  const el = document.getElementById('apiKey');
  const btn = document.getElementById('revealBtn');
  if (!el) return;
  if (el.textContent.includes('••')) {
    el.textContent = API_KEY;
    btn.textContent = '🙈 Hide';
  } else {
    el.textContent = 'frield_sk_••••••••••••••••••••••••';
    btn.textContent = '👁 Reveal';
  }
}

function copyApiKey() {
  navigator.clipboard.writeText(API_KEY).then(() => {
    showToast('📋 API key copied to clipboard!', 'success');
  }).catch(() => {
    showToast('❌ Could not copy. Please copy manually.', 'error');
  });
}

// ─── Danger Zone ──────────────────────────────────────────────
function confirmDelete(type) {
  const messages = {
    emails:  'Delete all email scan history? This cannot be undone.',
    vault:   'Clear the entire vault ledger? All hash-chain data will be lost.',
    account: 'Permanently delete your account and all data? This CANNOT be undone.'
  };
  if (confirm(messages[type] || 'Are you sure?')) {
    showToast(`⚠️ ${type.charAt(0).toUpperCase() + type.slice(1)} deletion is disabled in this environment.`, 'info', 5000);
  }
}

// ─── Logout ───────────────────────────────────────────────────
function logout() {
  Auth.clear();
  showToast('👋 Logged out. See you next time!', 'info');
  setTimeout(() => window.location.href = '/index.html', 800);
}

function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

// Load prefs on page load
loadPrefs();
