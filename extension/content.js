/**
 * content.js — Frield Content Script
 * Runs on every page automatically. Collects links for URL scanning.
 * Listens for scan requests from the popup.
 */

// Respond to messages from the popup/background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_LINKS') {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(h => h.startsWith('http'))
      .slice(0, 30); // limit to 30 links per page

    sendResponse({ links, title: document.title, url: window.location.href });
    return true;
  }

  if (msg.type === 'SHOW_SCAN_RESULT') {
    showFloatingBanner(msg.result);
    sendResponse({ ok: true });
    return true;
  }
});

// ── Floating banner for scan results ────────────────────────────
function showFloatingBanner(result) {
  // Remove existing banner if present
  const existing = document.getElementById('frield-banner');
  if (existing) existing.remove();

  const cat   = result.category || 'UNKNOWN';
  const score = result.score ?? '—';
  const emoji = cat === 'SAFE' ? '✅' : cat === 'SUSPICIOUS' ? '⚠️' : '🚨';
  const color = cat === 'SAFE'
    ? { bg: 'rgba(0,255,127,0.12)', border: 'rgba(0,255,127,0.35)', text: '#00FF7F' }
    : cat === 'SUSPICIOUS'
    ? { bg: 'rgba(255,211,42,0.12)', border: 'rgba(255,211,42,0.35)', text: '#FFD32A' }
    : { bg: 'rgba(255,71,87,0.12)', border: 'rgba(255,71,87,0.35)', text: '#FF4757' };

  const banner = document.createElement('div');
  banner.id = 'frield-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    background: #0D1117;
    border: 1px solid ${color.border};
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
    backdrop-filter: blur(12px);
    animation: frield-slide-in 0.3s ease;
    max-width: 320px;
  `;

  banner.innerHTML = `
    <style>
      @keyframes frield-slide-in {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    </style>
    <div style="width:36px;height:36px;border-radius:8px;background:${color.bg};border:1px solid ${color.border};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${emoji}</div>
    <div style="flex:1;">
      <div style="font-weight:700;color:${color.text};font-size:12px;letter-spacing:0.5px;">🛡 FRIELD — PAGE SCAN</div>
      <div style="color:#E6EDF3;margin-top:2px;">${cat} <span style="font-family:monospace;font-size:11px;color:#8B949E;">score: ${score}</span></div>
    </div>
    <button id="frield-close" style="background:none;border:none;color:#8B949E;cursor:pointer;font-size:16px;padding:0;line-height:1;">✕</button>
  `;

  document.body.appendChild(banner);

  document.getElementById('frield-close').addEventListener('click', () => banner.remove());
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
}
