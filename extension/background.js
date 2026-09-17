/**
 * background.js — Frield Chrome Extension Service Worker
 * - Polls the Frield backend every 15 minutes for threat stats
 * - Updates the extension badge with the count of DANGEROUS emails
 * - Shows desktop notifications when new threats appear
 */

const API_BASE = 'http://localhost:3000';

// ── Storage helpers ───────────────────────────────────────────────
const Store = {
  get: (key) => new Promise(res => chrome.storage.local.get(key, d => res(d[key] ?? null))),
  set: (key, val) => new Promise(res => chrome.storage.local.set({ [key]: val }, res)),
};

// ── Extension install/startup ─────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Frield] Extension installed');
  setupAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
});

function setupAlarm() {
  chrome.alarms.clearAll(() => {
    chrome.alarms.create('frield_poll', { periodInMinutes: 15 });
  });
}

// ── Alarm handler ─────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'frield_poll') {
    await pollThreats();
  }
});

// ── Poll for threats & update badge ──────────────────────────────
async function pollThreats() {
  const token = await Store.get('frield_token');
  if (!token) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/emails`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (res.status === 401) {
      // Token expired
      await chrome.storage.local.remove(['frield_token', 'frield_user']);
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const data = await res.json();
    const emails = data.emails || [];
    const dangerous = emails.filter(e => e.category === 'DANGEROUS').length;
    const lastCount = await Store.get('frield_danger_count') || 0;

    // Update badge
    if (dangerous > 0) {
      chrome.action.setBadgeText({ text: String(dangerous) });
      chrome.action.setBadgeBackgroundColor({ color: '#FF4757' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }

    // Notify if new threats found since last poll
    if (dangerous > lastCount) {
      const newThreats = dangerous - lastCount;
      chrome.notifications.create('frield_threat_' + Date.now(), {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🚨 Frield — New Threats Detected',
        message: `${newThreats} new dangerous email${newThreats > 1 ? 's' : ''} detected in your inbox!`,
        priority: 2
      });
    }

    await Store.set('frield_danger_count', dangerous);
  } catch (err) {
    console.error('[Frield BG] Poll failed:', err.message);
  }
}

// ── Message listener (from popup/content) ─────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'POLL_NOW') {
    pollThreats().then(() => sendResponse({ ok: true }));
    return true; // async response
  }

  if (msg.type === 'GET_BADGE') {
    chrome.action.getBadgeText({}, text => sendResponse({ text }));
    return true;
  }
});

// ── Notification click → open dashboard ───────────────────────────
chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId.startsWith('frield_')) {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/email-list.html') });
    chrome.notifications.clear(notifId);
  }
});

// ── Run once immediately on load ──────────────────────────────────
pollThreats();
