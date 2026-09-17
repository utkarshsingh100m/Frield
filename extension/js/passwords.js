/**
 * passwords.js — Frield Password Manager
 * Client-side AES-256-GCM encryption via SubtleCrypto.
 * Server only ever stores encrypted ciphertext.
 */

let masterKey = null;      // CryptoKey derived from master password
let masterSalt = null;     // Uint8Array salt (stored in localStorage per-user)
let allPasswords = [];

// ─── Master Password Setup ───────────────────────────────────────

/** Derive an AES-GCM key from a master password using PBKDF2 */
async function deriveMasterKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt plaintext string → { ciphertext (base64), iv (base64) } */
async function encryptPassword(plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    enc.encode(plaintext)
  );
  return {
    encrypted_password: btoa(String.fromCharCode(...new Uint8Array(cipherBuf))),
    encrypted_iv:       btoa(String.fromCharCode(...iv))
  };
}

/** Decrypt base64 ciphertext → plaintext string */
async function decryptPassword(encB64, ivB64) {
  const cipherBuf = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
  const iv        = Uint8Array.from(atob(ivB64),   c => c.charCodeAt(0));
  const decBuf    = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, cipherBuf);
  return new TextDecoder().decode(decBuf);
}

// ─── Master Password Prompt ─────────────────────────────────────

function showMasterPrompt(callback) {
  document.getElementById('masterPromptOverlay').classList.add('open');
  document.getElementById('masterPwInput').value = '';
  document.getElementById('masterPwInput').focus();
  document.getElementById('masterPwConfirmBtn').onclick = async () => {
    const pw = document.getElementById('masterPwInput').value.trim();
    if (!pw) { showToast('Enter a master password', 'error'); return; }
    await setupMasterKey(pw);
    document.getElementById('masterPromptOverlay').classList.remove('open');
    callback();
  };
}

async function setupMasterKey(password) {
  const user = Auth.getUser();
  const saltKey = `frield_salt_${user?.id || 'default'}`;
  let saltB64 = localStorage.getItem(saltKey);
  if (!saltB64) {
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    saltB64 = btoa(String.fromCharCode(...newSalt));
    localStorage.setItem(saltKey, saltB64);
  }
  masterSalt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  masterKey  = await deriveMasterKey(password, masterSalt);
  showToast('🔐 Vault unlocked', 'success');
}

// ─── Load & Render ──────────────────────────────────────────────

async function loadPasswords() {
  if (!masterKey) { showMasterPrompt(loadPasswords); return; }
  const tbody = document.getElementById('pwTbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);"><span class="spinner"></span> Loading…</td></tr>`;

  try {
    const { passwords } = await API.passwords.list();
    allPasswords = passwords || [];
    document.getElementById('pwCount').textContent = `${allPasswords.length} entries`;
    renderPasswordTable(allPasswords);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger);">Failed to load passwords: ${escHtml(err.message)}</td></tr>`;
  }
}

async function renderPasswordTable(passwords) {
  const tbody = document.getElementById('pwTbody');
  if (!passwords.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🔑</div><p>No saved passwords yet. Click <strong>+ Add Password</strong> or import from your browser.</p></div></td></tr>`;
    return;
  }

  const rows = await Promise.all(passwords.map(async (p) => {
    let plain = '••••••••';
    try { plain = await decryptPassword(p.encrypted_password, p.encrypted_iv); } catch {}
    return { ...p, plain };
  }));

  tbody.innerHTML = rows.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <img src="https://www.google.com/s2/favicons?sz=20&domain=${encodeURIComponent(p.site_url || p.site_name)}" onerror="this.style.display='none'" style="border-radius:3px;width:16px;height:16px;" />
          <div>
            <div style="font-weight:600;font-size:13px;">${escHtml(p.site_name)}</div>
            ${p.site_url ? `<div style="font-size:11px;color:var(--text-muted);">${escHtml(p.site_url)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="font-size:13px;">${escHtml(p.username)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="pw_${p.id}" style="font-family:'JetBrains Mono',monospace;font-size:12px;">••••••••</span>
          <button class="btn btn-ghost btn-icon" style="font-size:12px;padding:2px 6px;" onclick="togglePwVisibility('${p.id}','${p.encrypted_password}','${p.encrypted_iv}')">👁</button>
          <button class="btn btn-ghost btn-icon" style="font-size:12px;padding:2px 6px;" onclick="copyToClipboard('${escHtml(p.plain)}')">📋</button>
        </div>
      </td>
      <td style="font-size:11px;color:var(--text-muted);">${formatDate(p.created_at)}</td>
      <td>
        <button class="btn btn-ghost btn-icon" style="color:var(--danger);" onclick="deletePassword('${p.id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

async function togglePwVisibility(id, encB64, ivB64) {
  const el = document.getElementById(`pw_${id}`);
  if (!el) return;
  if (el.textContent === '••••••••') {
    try { el.textContent = await decryptPassword(encB64, ivB64); } catch { showToast('Decryption failed — wrong master password?', 'error'); }
  } else {
    el.textContent = '••••••••';
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to clipboard!', 'success'));
}

// ─── Add Password ───────────────────────────────────────────────

function openAddPasswordModal() {
  if (!masterKey) { showMasterPrompt(() => openAddPasswordModal()); return; }
  document.getElementById('addPwModal').classList.add('open');
  ['addPwSite','addPwUrl','addPwUser','addPwPass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

async function saveNewPassword() {
  const site_name = document.getElementById('addPwSite').value.trim();
  const site_url  = document.getElementById('addPwUrl').value.trim();
  const username  = document.getElementById('addPwUser').value.trim();
  const plainPw   = document.getElementById('addPwPass').value;

  if (!site_name || !username || !plainPw) {
    showToast('Site name, username, and password are required', 'error'); return;
  }

  try {
    const { encrypted_password, encrypted_iv } = await encryptPassword(plainPw);
    await API.passwords.add({ site_name, site_url, username, encrypted_password, encrypted_iv });
    closeModal('addPwModal');
    showToast('🔑 Password saved securely!', 'success');
    loadPasswords();
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  }
}

// ─── Delete Password ────────────────────────────────────────────

async function deletePassword(id) {
  if (!confirm('Remove this saved password?')) return;
  try {
    await API.passwords.delete(id);
    showToast('🗑 Password deleted', 'info');
    loadPasswords();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// ─── Import from Browser ────────────────────────────────────────

async function importFromBrowser() {
  if (!masterKey) { showMasterPrompt(() => importFromBrowser()); return; }

  // Use the Credential Management API
  if (!window.PasswordCredential && !window.navigator.credentials) {
    showToast('❌ Your browser does not support the Credential Management API', 'error');
    return;
  }

  try {
    // Request credentials for the current origin
    const cred = await navigator.credentials.get({
      password: true,
      mediation: 'optional'
    });

    if (!cred) {
      showToast('No credential selected or none available', 'info');
      return;
    }

    const site_name = cred.id.split('@')[1] || cred.id;
    const username  = cred.id;
    const plainPw   = cred.password;

    if (!plainPw) {
      showToast('Browser did not return a password for this credential', 'info');
      return;
    }

    const { encrypted_password, encrypted_iv } = await encryptPassword(plainPw);
    await API.passwords.add({
      site_name,
      site_url: window.location.origin,
      username,
      encrypted_password,
      encrypted_iv
    });
    showToast('✅ Browser credential imported!', 'success');
    loadPasswords();
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      showToast('Import cancelled by user', 'info');
    } else {
      showToast('Import failed: ' + err.message, 'error');
    }
  }
}

// ─── Import from CSV ────────────────────────────────────────────

function openCsvImport() {
  if (!masterKey) { showMasterPrompt(() => openCsvImport()); return; }
  document.getElementById('csvFileInput').click();
}

document.addEventListener('DOMContentLoaded', () => {
  const csvInput = document.getElementById('csvFileInput');
  if (csvInput) {
    csvInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.trim().split('\n').slice(1); // skip header
      let imported = 0;
      for (const line of lines) {
        // Standard export format: name,url,username,password
        const parts = line.split(',');
        if (parts.length < 4) continue;
        const [site_name, site_url, username, ...pwParts] = parts;
        const plainPw = pwParts.join(',').replace(/^"|"$/g, '').trim();
        if (!username || !plainPw) continue;
        try {
          const { encrypted_password, encrypted_iv } = await encryptPassword(plainPw);
          await API.passwords.add({ site_name: site_name.trim(), site_url: site_url.trim(), username: username.trim(), encrypted_password, encrypted_iv });
          imported++;
        } catch {}
      }
      showToast(`✅ Imported ${imported} passwords from CSV`, 'success');
      loadPasswords();
      csvInput.value = '';
    });
  }
});

// ─── Search ─────────────────────────────────────────────────────

function filterPasswords(query) {
  const q = (query || '').toLowerCase();
  const filtered = q ? allPasswords.filter(p =>
    p.site_name.toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q)
  ) : allPasswords;
  renderPasswordTable(filtered);
}
