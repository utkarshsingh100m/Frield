const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { scoreEmail } = require('../services/mlScorer');

// All email routes require authentication
router.use(auth);

/**
 * GET /emails
 * List all emails for the current user with scores
 */
router.get('/', (req, res) => {
  const emails = db.prepare(`
    SELECT e.*, es.score, es.features
    FROM emails e
    LEFT JOIN email_scores es ON e.id = es.email_id
    WHERE e.user_id = ?
    ORDER BY e.received_at DESC
  `).all(req.user.id);

  const parsed = emails.map(e => ({
    ...e,
    links: safeParseJSON(e.links, []),
    features: safeParseJSON(e.features, {})
  }));

  res.json({ emails: parsed, total: parsed.length });
});

/**
 * GET /emails/:id
 * Get a single email detail
 */
router.get('/:id', (req, res) => {
  const email = db.prepare(`
    SELECT e.*, es.score, es.features
    FROM emails e
    LEFT JOIN email_scores es ON e.id = es.email_id
    WHERE e.id = ? AND e.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!email) return res.status(404).json({ error: 'Email not found' });

  res.json({
    ...email,
    links: safeParseJSON(email.links, []),
    features: safeParseJSON(email.features, {})
  });
});

/**
 * POST /emails/classify
 * Submit a new email for ML scoring
 */
router.post('/classify', (req, res) => {
  const { sender, subject, body, links, spf_status, dkim_status, dmarc_status } = req.body;
  if (!sender || !subject) return res.status(400).json({ error: 'sender and subject required' });

  // Check scan limit for free plan
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id);
  if (sub && sub.tier === 'free' && sub.scan_count >= 50) {
    return res.status(403).json({ error: 'Daily scan limit reached. Upgrade to Pro for unlimited scans.' });
  }

  const emailId = uuidv4();
  const senderDomain = extractDomain(sender);

  db.prepare(`
    INSERT INTO emails (id, user_id, sender, sender_domain, subject, body, links, spf_status, dkim_status, dmarc_status, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `).run(emailId, req.user.id, sender, senderDomain, subject, body || '',
         JSON.stringify(links || []), spf_status || 'pass', dkim_status || 'pass', dmarc_status || 'pass');

  // Score the email
  const emailObj = { sender, sender_domain: senderDomain, subject, body, links, spf_status, dkim_status, dmarc_status };
  const { score, category, features } = scoreEmail(emailObj);

  db.prepare(`
    INSERT OR REPLACE INTO email_scores (id, email_id, score, features)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), emailId, score, JSON.stringify(features));

  db.prepare('UPDATE emails SET category = ? WHERE id = ?').run(category, emailId);

  // Increment scan count
  if (sub) {
    db.prepare('UPDATE subscriptions SET scan_count = scan_count + 1 WHERE user_id = ?').run(req.user.id);
  }

  res.json({ id: emailId, score, category, features });
});

/**
 * POST /emails/recheck
 * Manually reclassify an existing email
 */
router.post('/recheck', (req, res) => {
  const { email_id, category } = req.body;
  if (!email_id || !category) return res.status(400).json({ error: 'email_id and category required' });
  if (!['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(category.toUpperCase())) {
    return res.status(400).json({ error: 'category must be SAFE, SUSPICIOUS, or DANGEROUS' });
  }

  const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(email_id, req.user.id);
  if (!email) return res.status(404).json({ error: 'Email not found' });

  db.prepare('UPDATE emails SET category = ? WHERE id = ?').run(category.toUpperCase(), email_id);

  // Adjust score to match manual override
  const newScore = category.toUpperCase() === 'SAFE' ? 10 :
                   category.toUpperCase() === 'SUSPICIOUS' ? 50 : 85;
  db.prepare('UPDATE email_scores SET score = ? WHERE email_id = ?').run(newScore, email_id);

  res.json({ message: 'Email reclassified', email_id, category: category.toUpperCase(), score: newScore });
});

/**
 * POST /score
 * Score an arbitrary text payload (for browser extension use)
 */
router.post('/score-text', (req, res) => {
  const { url, filename, redirect_chain } = req.body;
  let score = 0;
  let signals = {};

  if (url) {
    // URL threat scoring
    const suspicious_tlds = ['.xyz', '.tk', '.ml', '.ga'];
    try {
      const u = new URL(url);
      signals.tld = suspicious_tlds.some(t => u.hostname.endsWith(t));
      signals.ip_host = /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);
      signals.long_path = u.pathname.length > 200;
      signals.many_params = u.searchParams.toString().length > 200;
      score += signals.tld ? 30 : 0;
      score += signals.ip_host ? 25 : 0;
      score += signals.long_path ? 15 : 0;
      score += signals.many_params ? 10 : 0;
      if (redirect_chain && redirect_chain.length > 3) score += redirect_chain.length * 5;
    } catch { score = 20; }
  }

  score = Math.min(100, score);
  res.json({ score, category: score <= 30 ? 'SAFE' : score <= 70 ? 'SUSPICIOUS' : 'DANGEROUS', signals });
});

function extractDomain(email) {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase().trim() : email.toLowerCase();
}

function safeParseJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

module.exports = router;
