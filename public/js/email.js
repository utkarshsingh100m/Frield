/**
 * email.js — Email list, filter tabs, modals, reclassify actions
 */

let allEmails = [];
let currentFilter = 'ALL';
let currentEmailId = null;

// ─── Initialize ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadEmails();
});

async function loadEmails() {
  try {
    const { emails, total } = await API.emails.list();
    allEmails = emails || [];

    const countEl = document.getElementById('emailCount');
    if (countEl) countEl.textContent = `${total} emails scanned`;

    const dangerEl = document.getElementById('dangerCount');
    if (dangerEl) dangerEl.textContent = allEmails.filter(e => e.category === 'DANGEROUS').length;

    renderTable(allEmails);
    filterTable();
  } catch (err) {
    showToast('❌ Failed to load emails: ' + err.message, 'error');
    document.getElementById('emailTbody').innerHTML =
      `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--danger);">Error loading emails: ${err.message}</td></tr>`;
  }
}

// ─── Filter ────────────────────────────────────────────────────
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterTable();
}

function filterTable() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();

  const filtered = allEmails.filter(e => {
    const catMatch = currentFilter === 'ALL' || e.category === currentFilter;
    const txtMatch = !search ||
      (e.sender || '').toLowerCase().includes(search) ||
      (e.subject || '').toLowerCase().includes(search);
    return catMatch && txtMatch;
  });

  renderTable(filtered);
}

// ─── Table Render ──────────────────────────────────────────────
function renderTable(emails) {
  const tbody = document.getElementById('emailTbody');
  if (!tbody) return;

  if (emails.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state"><div class="empty-icon">📭</div><p>No emails match this filter.</p></div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = emails.map(email => {
    const links = Array.isArray(email.links) ? email.links : [];
    const catClass = (email.category || 'pending').toLowerCase();
    const score = email.score ?? '—';

    return `
    <tr class="${email.category === 'DANGEROUS' ? 'row-danger' : ''}" onclick="openEmailModal('${email.id}')" style="cursor:pointer;">
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          ${score !== '—' ? scoreBarHTML(score, catClass) : '<span style="color:var(--text-muted)">—</span>'}
        </div>
      </td>
      <td>${categoryBadge(email.category)}</td>
      <td>
        <div style="font-size:13px;font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(email.sender)}">${escHtml(email.sender)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(email.sender_domain || '')}</div>
      </td>
      <td>
        <div style="font-size:13px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(email.subject)}">${escHtml(email.subject || '(no subject)')}</div>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:2px;font-size:11px;">
          <span>SPF: ${authStatusPill(email.spf_status)}</span>
          <span>DKIM: ${authStatusPill(email.dkim_status)}</span>
          <span>DMARC: ${authStatusPill(email.dmarc_status)}</span>
        </div>
      </td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-secondary);">${links.length}</span></td>
      <td><span style="font-size:12px;color:var(--text-muted);">${formatDateTime(email.received_at)}</span></td>
      <td onclick="event.stopPropagation();">
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-sm" onclick="reclassify('${email.id}', 'SAFE')" title="Mark Safe">✅</button>
          <button class="btn btn-danger btn-sm" onclick="reclassify('${email.id}', 'DANGEROUS')" title="Mark Dangerous">🚨</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── Email Detail Modal ────────────────────────────────────────
async function openEmailModal(emailId) {
  currentEmailId = emailId;
  const modal = document.getElementById('emailModal');
  modal.classList.add('open');

  const email = allEmails.find(e => e.id === emailId);
  if (!email) return;

  document.getElementById('modalSubject').textContent = email.subject || '(no subject)';
  document.getElementById('modalSender').textContent = `From: ${email.sender} • ${formatDateTime(email.received_at)}`;
  document.getElementById('modalBody').textContent = email.body || '(no body content)';

  // Auth grid
  document.getElementById('modalAuthGrid').innerHTML = `
    <div style="background:var(--bg-secondary);border-radius:6px;padding:10px;text-align:center;">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">SPF</div>
      ${authStatusPill(email.spf_status)}
    </div>
    <div style="background:var(--bg-secondary);border-radius:6px;padding:10px;text-align:center;">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">DKIM</div>
      ${authStatusPill(email.dkim_status)}
    </div>
    <div style="background:var(--bg-secondary);border-radius:6px;padding:10px;text-align:center;">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">DMARC</div>
      ${authStatusPill(email.dmarc_status)}
    </div>
  `;

  // Score section
  const score = email.score ?? 0;
  const cat = email.category || 'PENDING';
  const catCls = cat.toLowerCase();
  document.getElementById('modalScoreSection').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-secondary);border-radius:8px;">
      <div class="score-circle ${catCls}" style="width:52px;height:52px;font-size:16px;">${score}</div>
      <div>
        <div style="font-size:14px;font-weight:700;">${categoryBadge(cat)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Threat Score: ${score}/100</div>
      </div>
      <div style="flex:1;margin-left:8px;">
        <div class="score-bar" style="width:100%;height:8px;">
          <div class="score-fill ${catCls}" style="width:${score}%;"></div>
        </div>
      </div>
    </div>
  `;

  // Links section
  const links = Array.isArray(email.links) ? email.links : [];
  document.getElementById('modalLinks').innerHTML = links.length > 0 ? `
    <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">🔗 Links (${links.length})</div>
    ${links.map(l => `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--bg-secondary);padding:5px 10px;border-radius:4px;margin-bottom:4px;color:var(--warning);overflow-wrap:break-word;">${escHtml(l)}</div>
    `).join('')}
  ` : '';

  // Button handlers
  document.getElementById('markSafeBtn').onclick = () => reclassify(emailId, 'SAFE', true);
  document.getElementById('markDangerBtn').onclick = () => reclassify(emailId, 'DANGEROUS', true);
}

// ─── Reclassify ────────────────────────────────────────────────
async function reclassify(emailId, category, closeAfter = false) {
  try {
    await API.emails.recheck(emailId, category);
    showToast(`✅ Email marked as ${category}`, 'success');

    // Update local state
    const idx = allEmails.findIndex(e => e.id === emailId);
    if (idx >= 0) {
      allEmails[idx].category = category;
      allEmails[idx].score = category === 'SAFE' ? 10 : category === 'SUSPICIOUS' ? 50 : 85;
    }

    if (closeAfter) closeModal('emailModal');
    filterTable();
  } catch (err) {
    showToast('❌ Reclassify failed: ' + err.message, 'error');
  }
}

// ─── Scan New Email Modal ──────────────────────────────────────
function openClassifyModal() {
  document.getElementById('classifyModal').classList.add('open');
  document.getElementById('classifyResult').style.display = 'none';
}

async function submitClassify() {
  const sender  = document.getElementById('newSender').value.trim();
  const subject = document.getElementById('newSubject').value.trim();
  const body    = document.getElementById('newBody').value.trim();
  const linksRaw= document.getElementById('newLinks').value.trim();
  const spf     = document.getElementById('newSpf').value;
  const dkim    = document.getElementById('newDkim').value;
  const dmarc   = document.getElementById('newDmarc').value;

  if (!sender || !subject) {
    showToast('⚠️ Sender and Subject are required.', 'error');
    return;
  }

  const links = linksRaw ? linksRaw.split(',').map(l => l.trim()).filter(Boolean) : [];

  try {
    const result = await API.emails.classify({ sender, subject, body, links, spf_status: spf, dkim_status: dkim, dmarc_status: dmarc });
    const resEl = document.getElementById('classifyResult');
    resEl.style.display = 'block';
    const catCls = (result.category || '').toLowerCase();
    resEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div class="score-circle ${catCls}" style="width:48px;height:48px;font-size:16px;">${result.score}</div>
        <div>
          <div>${categoryBadge(result.category)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Threat Score: ${result.score}/100</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);">Email added to your inbox. <a href="#" onclick="closeModal('classifyModal');loadEmails();">View in list →</a></div>
    `;
    showToast(`🧠 Analyzed: ${result.category} (score ${result.score})`, result.category === 'DANGEROUS' ? 'error' : 'success');
    await loadEmails();
  } catch (err) {
    showToast('❌ Analysis failed: ' + err.message, 'error');
  }
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
