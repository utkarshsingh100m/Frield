const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

router.use(auth);

/**
 * GET /subscription/status
 * Returns current user's subscription info and usage
 */
router.get('/status', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id);
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(req.user.id);

  if (!sub) {
    // Create default subscription
    const newSub = {
      id: uuidv4(),
      user_id: req.user.id,
      tier: 'free',
      scan_count: 0
    };
    db.prepare(`INSERT INTO subscriptions (id, user_id, tier, scan_count) VALUES (?, ?, ?, 0)`)
      .run(newSub.id, newSub.user_id, newSub.tier);
    return res.json({ ...newSub, daily_limit: 50, remaining: 50 });
  }

  const tier = sub.tier || 'free';
  const dailyLimit = tier === 'pro' ? Infinity : 50;
  const remaining = tier === 'pro' ? 'Unlimited' : Math.max(0, 50 - (sub.scan_count || 0));

  res.json({
    ...sub,
    tier,
    daily_limit: tier === 'pro' ? 'Unlimited' : 50,
    remaining,
    features: {
      email_scans: true,
      blockchain_vault: tier === 'pro',
      priority_support: tier === 'pro',
      api_access: tier === 'pro'
    }
  });
});

/**
 * POST /subscription/upgrade
 * Mock Stripe upgrade endpoint
 */
router.post('/upgrade', (req, res) => {
  const { plan, payment_token } = req.body;
  if (!plan || !['pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Valid options: pro' });
  }

  // Mock payment processing
  if (!payment_token && process.env.NODE_ENV !== 'development') {
    return res.status(400).json({ error: 'Payment token required' });
  }

  // Simulate payment success
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('pro', req.user.id);
  db.prepare(`
    UPDATE subscriptions SET tier = 'pro', start_date = datetime('now'), end_date = ?, scan_count = 0
    WHERE user_id = ?
  `).run(endDate.toISOString(), req.user.id);

  res.json({
    message: 'Successfully upgraded to Pro!',
    plan: 'pro',
    end_date: endDate.toISOString(),
    mock_transaction_id: `txn_${Date.now()}_frield`
  });
});

/**
 * POST /subscription/reset-count
 * Reset daily scan count (would normally be cron-triggered)
 */
router.post('/reset-count', (req, res) => {
  db.prepare('UPDATE subscriptions SET scan_count = 0 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Scan count reset' });
});

module.exports = router;
