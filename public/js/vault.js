/**
 * vault.js — Hash-chain ledger rendering, verify, add block
 */

let vaultBlocks = [];

document.addEventListener('DOMContentLoaded', () => {
  loadVault();
});

// ─── Load Vault ────────────────────────────────────────────────
async function loadVault() {
  try {
    const { blocks, total } = await API.vault.list();
    vaultBlocks = blocks || [];

    renderVaultStats(vaultBlocks);
    renderVaultTable(vaultBlocks);

    const lc = document.getElementById('ledgerCount');
    if (lc) lc.textContent = `${total} blocks`;
  } catch (err) {
    showToast('❌ Failed to load vault: ' + err.message, 'error');
  }
}

// ─── Stats ─────────────────────────────────────────────────────
function renderVaultStats(blocks) {
  const valid    = blocks.filter(b => b.status === 'VALID').length;
  const tampered = blocks.filter(b => b.status === 'TAMPERED').length;

  setEl('validCount',    valid);
  setEl('tamperedCount', tampered);
  setEl('totalBlocks',   blocks.length);

  const cs = document.getElementById('chainStatus');
  if (cs) {
    cs.textContent = tampered > 0
      ? `⚠️ ${tampered} tampered block(s) detected!`
      : `🟢 Chain intact — all ${blocks.length} blocks verified`;
    cs.style.color = tampered > 0 ? 'var(--danger)' : 'var(--neon)';
  }
}

// ─── Table ─────────────────────────────────────────────────────
function renderVaultTable(blocks) {
  const tbody = document.getElementById('vaultTbody');
  if (!tbody) return;

  if (blocks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><div class="empty-icon">🔐</div><p>No files in vault yet. Add your first file to start the hash chain.</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = blocks.map((block, i) => {
    const isValid    = block.status === 'VALID';
    const statusBadge = isValid
      ? '<span class="badge badge-valid">✓ Valid</span>'
      : '<span class="badge badge-tampered">⚠ Tampered</span>';

    const rowStyle = !isValid ? 'background:rgba(255,71,87,0.04);' : '';

    return `
    <tr style="${rowStyle}">
      <td>
        <div class="score-circle ${isValid ? 'safe' : 'dangerous'}" style="width:30px;height:30px;font-size:11px;">
          ${block.block_index}
        </div>
      </td>
      <td>
        <div style="font-size:13px;font-weight:500;">📄 ${escHtml(block.filename)}</div>
      </td>
      <td>
        <span class="hash-text" title="${block.sha256_hash}">${block.sha256_hash}</span>
      </td>
      <td>
        ${block.previous_hash
          ? `<span class="hash-text" title="${block.previous_hash}">${block.previous_hash}</span>`
          : '<span style="font-size:11px;color:var(--text-muted);">Genesis</span>'}
      </td>
      <td><span style="font-size:12px;color:var(--text-muted);">${formatDateTime(block.created_at)}</span></td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="showBlockDetail('${block.id}')" title="View Details">🔍</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBlock('${block.id}')" title="Delete Block">🗑</button>
        </div>
      </td>
    </tr>
    ${i < blocks.length - 1 ? `
    <tr style="background:transparent;border:none;">
      <td colspan="7" style="padding:2px 16px;">
        <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">
          <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--border),transparent);"></div>
          ⬇ chain link
          <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--border),transparent);"></div>
        </div>
      </td>
    </tr>` : ''}`;
  }).join('');
}

// ─── Block Detail Modal ────────────────────────────────────────
function showBlockDetail(blockId) {
  const block = vaultBlocks.find(b => b.id === blockId);
  if (!block) return;

  const detail = document.getElementById('blockDetail');
  const isValid = block.status === 'VALID';

  detail.innerHTML = `
    <div style="margin-bottom:16px;">${isValid
      ? '<span class="badge badge-valid" style="font-size:13px;padding:6px 14px;">✓ VALID</span>'
      : '<span class="badge badge-tampered" style="font-size:13px;padding:6px 14px;">⚠ TAMPERED</span>'}</div>

    <div style="display:grid;gap:10px;">
      ${row('Block Index', `#${block.block_index}`)}
      ${row('Filename', `📄 ${block.filename}`)}
      ${row('SHA-256 Hash', `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;word-break:break-all;color:var(--neon);">${block.sha256_hash}</span>`)}
      ${row('Previous Hash', block.previous_hash
        ? `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;word-break:break-all;">${block.previous_hash}</span>`
        : '<span style="color:var(--text-muted)">Genesis Block</span>')}
      ${row('Timestamp', formatDateTime(block.created_at))}
      ${row('Status', isValid
        ? '<span style="color:var(--neon);">Chain intact — hash matches</span>'
        : '<span style="color:var(--danger);">Hash mismatch detected!</span>')}
    </div>
  `;

  document.getElementById('blockModal').classList.add('open');
}

function row(label, value) {
  return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--bg-secondary);border-radius:6px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);min-width:120px;">${label}</div>
      <div style="font-size:13px;flex:1;">${value}</div>
    </div>`;
}

// ─── Verify All ────────────────────────────────────────────────
async function verifyAll() {
  const btn = document.getElementById('verifyBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Verifying...'; }

  try {
    const result = await API.vault.verify();
    vaultBlocks = result.results || vaultBlocks;
    renderVaultStats(vaultBlocks);
    renderVaultTable(vaultBlocks);

    const msg = result.tampered > 0
      ? `⚠️ ${result.tampered} tampered block(s) detected!`
      : `✅ All ${result.total} blocks verified — chain intact`;

    showToast(msg, result.tampered > 0 ? 'error' : 'success');
  } catch (err) {
    showToast('❌ Verification failed: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '🔍 Verify All Hashes'; }
  }
}

// ─── Add Block ─────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('addModal').classList.add('open');
  document.getElementById('addResult').style.display = 'none';
  document.getElementById('vaultFilename').value = '';
  document.getElementById('vaultContent').value = '';
}

async function addToVault() {
  const filename = document.getElementById('vaultFilename').value.trim();
  const content  = document.getElementById('vaultContent').value.trim();
  if (!filename) { showToast('⚠️ Filename is required', 'error'); return; }

  try {
    const result = await API.vault.add({ filename, content });
    const resEl = document.getElementById('addResult');
    resEl.style.display = 'block';
    resEl.innerHTML = `
      <div style="color:var(--neon);font-weight:600;margin-bottom:6px;">✅ Block #${result.block.block_index} added!</div>
      <div style="font-size:11px;color:var(--text-muted);">Hash: <span style="font-family:'JetBrains Mono',monospace;">${result.block.sha256_hash}</span></div>
    `;
    showToast('🔗 New block added to chain!', 'success');
    await loadVault();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ─── Delete Block ──────────────────────────────────────────────
async function deleteBlock(id) {
  if (!confirm('Delete this block? This will break the chain and flag adjacent blocks as TAMPERED.')) return;
  try {
    await API.vault.delete(id);
    showToast('🗑 Block deleted. Run Verify to update chain status.', 'info');
    await loadVault();
  } catch (err) {
    showToast('❌ Delete failed: ' + err.message, 'error');
  }
}

function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
function escHtml(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
