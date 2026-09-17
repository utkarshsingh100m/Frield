/**
 * dashboard.js — Dashboard stats, Chart.js rendering, recent threat list
 */

let pieChart = null;
let lineChart = null;
let allEmails = [];

// ─── Initialize ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshDashboard();
});

async function refreshDashboard() {
  try {
    const { emails } = await API.emails.list();
    allEmails = emails || [];
    renderStats(allEmails);
    renderPieChart(allEmails);
    renderLineChart(allEmails);
    renderDangerList(allEmails);

    // Update danger count in sidebar nav
    const dangerousCount = allEmails.filter(e => e.category === 'DANGEROUS').length;
    const dc = document.getElementById('dangerCount');
    if (dc) dc.textContent = dangerousCount;

    // Update scan time
    const ls = document.getElementById('lastScan');
    if (ls) ls.textContent = `Last scan: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    showToast('⚠️ Failed to load dashboard: ' + err.message, 'error');
  }
}

// ─── Stats Cards ───────────────────────────────────────────────
function renderStats(emails) {
  const total       = emails.length;
  const safe        = emails.filter(e => e.category === 'SAFE').length;
  const suspicious  = emails.filter(e => e.category === 'SUSPICIOUS').length;
  const dangerous   = emails.filter(e => e.category === 'DANGEROUS').length;

  animateCounter('totalEmails',     total);
  animateCounter('safeEmails',      safe);
  animateCounter('suspiciousEmails',suspicious);
  animateCounter('dangerousEmails', dangerous);
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 30));
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(timer);
  }, 40);
}

// ─── Pie Chart ─────────────────────────────────────────────────
function renderPieChart(emails) {
  const safe       = emails.filter(e => e.category === 'SAFE').length;
  const suspicious = emails.filter(e => e.category === 'SUSPICIOUS').length;
  const dangerous  = emails.filter(e => e.category === 'DANGEROUS').length;

  Chart.defaults.color = '#8B949E';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Safe', 'Suspicious', 'Dangerous'],
      datasets: [{
        data: [safe, suspicious, dangerous],
        backgroundColor: [
          'rgba(0, 255, 127, 0.7)',
          'rgba(255, 211, 42, 0.7)',
          'rgba(255, 71, 87, 0.7)'
        ],
        borderColor: [
          'rgba(0, 255, 127, 1)',
          'rgba(255, 211, 42, 1)',
          'rgba(255, 71, 87, 1)'
        ],
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            font: { size: 12, weight: '500' },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: '#1C2128',
          borderColor: '#30363D',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} emails`
          }
        }
      }
    }
  });
}

// ─── Line / Timeline Chart ─────────────────────────────────────
function renderLineChart(emails) {
  // Build 14-day buckets
  const days = 14;
  const labels = [];
  const safeData = [], suspData = [], dangerData = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    labels.push(label);

    const dayEmails = emails.filter(e => {
      const ed = new Date(e.received_at);
      return ed.toDateString() === d.toDateString();
    });

    safeData.push(dayEmails.filter(e => e.category === 'SAFE').length);
    suspData.push(dayEmails.filter(e => e.category === 'SUSPICIOUS').length);
    dangerData.push(dayEmails.filter(e => e.category === 'DANGEROUS').length);
  }

  const ctx = document.getElementById('lineChart').getContext('2d');
  if (lineChart) lineChart.destroy();

  const makeGradient = (ctx, color) => {
    const g = ctx.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, color.replace('1)', '0.3)'));
    g.addColorStop(1, color.replace('1)', '0)'));
    return g;
  };

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Safe',
          data: safeData,
          borderColor: 'rgba(0, 255, 127, 1)',
          backgroundColor: makeGradient(ctx, 'rgba(0, 255, 127, 1)'),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Suspicious',
          data: suspData,
          borderColor: 'rgba(255, 211, 42, 1)',
          backgroundColor: makeGradient(ctx, 'rgba(255, 211, 42, 1)'),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Dangerous',
          data: dangerData,
          borderColor: 'rgba(255, 71, 87, 1)',
          backgroundColor: makeGradient(ctx, 'rgba(255, 71, 87, 1)'),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { color: 'rgba(48,54,61,0.5)', drawBorder: false },
          ticks: { font: { size: 11 }, maxRotation: 0 }
        },
        y: {
          grid: { color: 'rgba(48,54,61,0.5)', drawBorder: false },
          ticks: { font: { size: 11 }, stepSize: 1 },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, usePointStyle: true, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#1C2128',
          borderColor: '#30363D',
          borderWidth: 1,
          padding: 12
        }
      }
    }
  });
}

// ─── Recent Dangerous Emails ───────────────────────────────────
function renderDangerList(emails) {
  const dangerous = emails
    .filter(e => e.category === 'DANGEROUS')
    .slice(0, 6);

  const container = document.getElementById('dangerList');
  if (!container) return;

  if (dangerous.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>No dangerous emails detected. Your inbox is clean!</p>
      </div>`;
    return;
  }

  container.innerHTML = dangerous.map(email => `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid rgba(48,54,61,0.5);">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--danger-glow);border:1px solid rgba(255,71,87,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🚨</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(email.subject || '(no subject)')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${escHtml(email.sender)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--danger);">${email.score || '—'}</div>
        <div style="font-size:10px;color:var(--text-muted);">${formatDateTime(email.received_at)}</div>
      </div>
    </div>
  `).join('');
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
