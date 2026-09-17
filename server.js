require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// Allow requests from localhost (web app) and chrome-extension:// (Chrome Extension)
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files (Frontend) ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/auth',         require('./routes/auth'));
app.use('/emails',       require('./routes/emails'));
app.use('/vault',        require('./routes/vault'));
app.use('/passwords',    require('./routes/passwords'));
app.use('/subscription', require('./routes/subscription'));
app.use('/google',       require('./routes/google'));

// ─── Score endpoint shorthand ─────────────────────────────────────────────────
app.post('/score', require('./middleware/auth'), (req, res) => {
  const { scoreEmail } = require('./services/mlScorer');
  const result = scoreEmail(req.body);
  res.json(result);
});

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'OK', version: '1.0.0', service: 'Frield API' });
});

// ─── Serve frontend HTML pages ────────────────────────────────────────────────
const htmlPages = ['/', '/dashboard', '/email-list', '/vault', '/settings'];
htmlPages.forEach(route => {
  app.get(route, (req, res) => {
    const filename = route === '/' ? 'index' : route.slice(1);
    res.sendFile(path.join(__dirname, 'public', `${filename}.html`));
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Frield Error]', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║        🛡  FRIELD API SERVER 🛡          ║
  ║   Cybersecurity SaaS Platform v1.0.0    ║
  ╠══════════════════════════════════════════╣
  ║  URL:  http://localhost:${PORT}             ║
  ║  ENV:  ${process.env.NODE_ENV || 'development'}                  ║
  ╚══════════════════════════════════════════╝
  `);

  // ─── Background Gmail Sync ──────────────────────────────────────────────────
  const { syncGmail } = require('./services/gmailFetcher');
  const db = require('./db/database');
  
  // Run Gmail sync every 15 minutes (900,000 ms)
  setInterval(async () => {
    console.log('[Background] Starting automatic Gmail synchronization...');
    const users = db.prepare("SELECT user_id FROM email_settings WHERE provider = 'google' AND is_active = 1").all();
    
    for (const { user_id } of users) {
      try {
        const stats = await syncGmail(user_id);
        if (stats.new > 0) {
          console.log(`[Background] Synced ${stats.new} new Gmail messages for user ${user_id}`);
        }
      } catch (err) {
        console.error(`[Background] Gmail sync failed for user ${user_id}:`, err.message);
      }
    }
  }, 15 * 60 * 1000);
});

module.exports = app;
