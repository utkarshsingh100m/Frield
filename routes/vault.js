const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { buildBlock, verifyChain, getLastHash } = require('../services/hashChain');

router.use(auth);

/**
 * GET /vault
 * Returns all hash-chain ledger entries for the current user
 */
router.get('/', (req, res) => {
  const blocks = db.prepare(`
    SELECT * FROM vault_ledger WHERE user_id = ? ORDER BY block_index ASC
  `).all(req.user.id);

  res.json({ blocks, total: blocks.length });
});

/**
 * POST /vault/add
 * Add a new block to the hash-chain ledger
 */
router.post('/add', (req, res) => {
  const { filename, content } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  // Check pro plan for vault access
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(req.user.id);
  if (user && user.plan === 'free') {
    return res.status(403).json({ error: 'Blockchain Vault requires Pro plan. Upgrade to access.' });
  }

  const existingBlocks = db.prepare('SELECT * FROM vault_ledger WHERE user_id = ? ORDER BY block_index ASC').all(req.user.id);
  const lastHash = getLastHash(existingBlocks);
  const nextIndex = existingBlocks.length;

  const block = buildBlock(nextIndex, filename, content || filename, lastHash);

  db.prepare(`
    INSERT INTO vault_ledger (id, user_id, filename, sha256_hash, previous_hash, block_index, status)
    VALUES (?, ?, ?, ?, ?, ?, 'VALID')
  `).run(uuidv4(), req.user.id, block.filename, block.sha256_hash, block.previous_hash, block.block_index);

  res.json({ message: 'Block added to ledger', block: { ...block, user_id: req.user.id } });
});

/**
 * POST /vault/verify
 * Re-verify the entire hash chain for the current user
 */
router.post('/verify', (req, res) => {
  const blocks = db.prepare(`
    SELECT * FROM vault_ledger WHERE user_id = ? ORDER BY block_index ASC
  `).all(req.user.id);

  if (blocks.length === 0) {
    return res.json({ message: 'No blocks to verify', results: [] });
  }

  const verified = verifyChain(blocks);

  // Update statuses in DB
  const updateStmt = db.prepare('UPDATE vault_ledger SET status = ? WHERE id = ?');
  const updateAll = db.transaction((verifiedBlocks) => {
    for (const b of verifiedBlocks) updateStmt.run(b.status, b.id);
  });
  updateAll(verified);

  const tampered = verified.filter(b => b.status === 'TAMPERED').length;
  res.json({
    message: tampered === 0 ? 'All blocks verified — chain intact' : `${tampered} tampered block(s) detected`,
    total: verified.length,
    valid: verified.filter(b => b.status === 'VALID').length,
    tampered,
    results: verified
  });
});

/**
 * DELETE /vault/:id
 * Remove a block (for testing tamper detection)
 */
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM vault_ledger WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Block removed' });
});

module.exports = router;
