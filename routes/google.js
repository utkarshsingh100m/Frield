const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI  = process.env.APP_URL || 'http://localhost:3000/google/callback';

console.log('[Google OAuth] REDIRECT_URI =', REDIRECT_URI);

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/**
 * GET /google/auth-url
 * Returns the URL for the Google OAuth2 consent screen
 */
router.get('/auth-url', authMiddleware, (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: req.user.id
  });
  console.log('[Google OAuth] Auth URL generated with redirect_uri:', REDIRECT_URI);
  res.json({ url });
});

/**
 * GET /google/callback
 * Handles the OAuth2 callback from Google
 */
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('Invalid callback parameters');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens to database
    db.prepare(`
      INSERT OR REPLACE INTO email_settings (user_id, provider, access_token, refresh_token, expiry_date, is_active)
      VALUES (?, 'google', ?, ?, ?, 1)
    `).run(userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date);

    // Redirect to settings page or dashboard
    res.redirect('/settings.html?gmail_connected=success');
  } catch (err) {
    console.error('OAuth Error:', err.message);
    res.redirect('/settings.html?gmail_connected=error');
  }
});

/**
 * GET /google/status
 * Check user's Gmail connection status
 */
router.get('/status', authMiddleware, (req, res) => {
  const settings = db.prepare('SELECT user_id, provider, is_active FROM email_settings WHERE user_id = ?').get(req.user.id);
  res.json({ connected: !!settings, settings: settings || null });
});

/**
 * POST /google/sync
 * Manually trigger Gmail synchronization
 */
const { syncGmail } = require('../services/gmailFetcher');

router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const stats = await syncGmail(req.user.id);
    res.json({ message: 'Sync complete', ...stats });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

/**
 * DELETE /google/disconnect
 * Revoke Gmail access and clear stored tokens for the user
 */
router.delete('/disconnect', authMiddleware, async (req, res) => {
  try {
    const settings = db.prepare('SELECT access_token FROM email_settings WHERE user_id = ?').get(req.user.id);

    // Try to revoke the token with Google (best-effort, don't fail if it errors)
    if (settings && settings.access_token) {
      try {
        oauth2Client.setCredentials({ access_token: settings.access_token });
        await oauth2Client.revokeCredentials();
      } catch (revokeErr) {
        console.warn('[Google OAuth] Token revoke failed (ignoring):', revokeErr.message);
      }
    }

    // Clear tokens from DB and mark inactive
    db.prepare(`
      UPDATE email_settings
      SET access_token = NULL, refresh_token = NULL, expiry_date = NULL, is_active = 0
      WHERE user_id = ?
    `).run(req.user.id);

    res.json({ success: true, message: 'Gmail disconnected' });
  } catch (err) {
    console.error('[Google OAuth] Disconnect failed:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

module.exports = router;
