require('dotenv').config();
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'frield_secret';

// Google OAuth token verification will rely on decoding the JWT provided
// by Google Identity Services on the frontend.
/**
 * POST /auth/google
 * Exchange a Google OAuth token for a Frield JWT
 */
router.post('/google', (req, res) => {
  const { token: googleToken } = req.body;

  if (!googleToken) {
    return res.status(400).json({ error: 'Google token required' });
  }

  // In production, you should verify the token signature using google-auth-library.
  // For now, we will decode the credential JWT sent by Google Identity Services.
  const decoded = jwt.decode(googleToken);
  if (!decoded || !decoded.email) {
    return res.status(400).json({ error: 'Invalid Google Identity token' });
  }

  const googleUser = {
    id: decoded.sub,
    email: decoded.email,
    name: decoded.name || 'User',
    avatar: decoded.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(decoded.name || 'User')}&background=00FF7F&color=0D1117`
  };
  // Upsert user in database
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(googleUser.id);
  if (!existing) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, avatar, plan)
      VALUES (?, ?, ?, ?, 'free')
    `).run(googleUser.id, googleUser.email, googleUser.name, googleUser.avatar);

    // Create subscription record
    db.prepare(`
      INSERT OR IGNORE INTO subscriptions (id, user_id, tier)
      VALUES (?, ?, 'free')
    `).run(uuidv4(), googleUser.id);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(googleUser.id);
  const jwtPayload = { id: user.id, email: user.email, name: user.name, plan: user.plan };
  const jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });

  // ── Fire-and-forget Gmail sync so emails are ready immediately after login ─
  setImmediate(async () => {
    try {
      const { syncGmail } = require('../services/gmailFetcher');
      const settings = db.prepare("SELECT user_id FROM email_settings WHERE user_id = ? AND is_active = 1").get(user.id);
      if (settings) {
        const stats = await syncGmail(user.id);
        console.log(`[Login Sync] Synced ${stats.new || 0} new emails for ${user.email}`);
      }
    } catch (err) {
      console.error('[Login Sync] Failed for', user.email, ':', err.message);
    }
  });

  res.json({ token: jwtToken, user });
});

/**
 * GET /auth/user
 * Returns the current authenticated user's profile
 */
router.get('/user', require('../middleware/auth'), (req, res) => {
  const user = db.prepare('SELECT id, email, name, avatar, plan, created_at FROM users WHERE id = ?')
                 .get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json(user);
});

/**
 * POST /auth/logout
 * Client-side logout (JWT is stateless; just acknowledge)
 */
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
