const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db   = require('../db/database');
const auth = require('../middleware/auth');

router.use(auth);

/**
 * GET /passwords
 * Returns all saved password entries (encrypted blobs) for the current user
 */
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, site_url, site_name, username, encrypted_password, encrypted_iv, created_at
    FROM passwords
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);

  res.json({ passwords: rows, total: rows.length });
});

/**
 * POST /passwords/add
 * Save a new encrypted credential
 * Body: { site_name, site_url?, username, encrypted_password, encrypted_iv }
 */
router.post('/add', (req, res) => {
  const { site_name, site_url, username, encrypted_password, encrypted_iv } = req.body;

  if (!site_name || !username || !encrypted_password || !encrypted_iv) {
    return res.status(400).json({ error: 'site_name, username, encrypted_password, and encrypted_iv are required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO passwords (id, user_id, site_url, site_name, username, encrypted_password, encrypted_iv)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, site_url || '', site_name, username, encrypted_password, encrypted_iv);

  res.json({ message: 'Password saved', id });
});

/**
 * PUT /passwords/:id
 * Update an existing credential
 */
router.put('/:id', (req, res) => {
  const { site_name, site_url, username, encrypted_password, encrypted_iv } = req.body;
  const existing = db.prepare('SELECT id FROM passwords WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Password entry not found' });

  db.prepare(`
    UPDATE passwords SET site_name = ?, site_url = ?, username = ?, encrypted_password = ?, encrypted_iv = ?
    WHERE id = ? AND user_id = ?
  `).run(site_name, site_url || '', username, encrypted_password, encrypted_iv, req.params.id, req.user.id);

  res.json({ message: 'Password updated' });
});

/**
 * DELETE /passwords/:id
 * Remove a saved credential
 */
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM passwords WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Password entry not found' });
  res.json({ message: 'Password deleted' });
});

module.exports = router;
