const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "frield.db");
const db = new Database(DB_PATH);

// Enable WAL for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    sender_domain TEXT,
    subject TEXT,
    body TEXT,
    links TEXT,
    spf_status TEXT DEFAULT 'unknown',
    dkim_status TEXT DEFAULT 'unknown',
    dmarc_status TEXT DEFAULT 'unknown',
    category TEXT DEFAULT 'PENDING',
    received_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS email_scores (
    id TEXT PRIMARY KEY,
    email_id TEXT UNIQUE NOT NULL,
    score INTEGER NOT NULL,
    features TEXT,
    scored_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (email_id) REFERENCES emails(id)
  );

  CREATE TABLE IF NOT EXISTS vault_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    previous_hash TEXT,
    block_index INTEGER NOT NULL,
    status TEXT DEFAULT 'VALID',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    tier TEXT DEFAULT 'free',
    start_date TEXT DEFAULT (datetime('now')),
    end_date TEXT,
    scan_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS email_settings (
    user_id TEXT PRIMARY KEY,
    provider TEXT DEFAULT 'google',
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER,
    last_sync TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS passwords (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    site_url TEXT,
    site_name TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    encrypted_iv TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Safe migrations: add columns that may not exist in older DBs ──────────────
// SQLite doesn't support IF NOT EXISTS on ALTER TABLE, so we catch the error.
function safeAddColumn(table, column, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }
}

// email_settings migrations
safeAddColumn('email_settings', 'provider',      "TEXT DEFAULT 'google'");
safeAddColumn('email_settings', 'access_token',  'TEXT');
safeAddColumn('email_settings', 'refresh_token', 'TEXT');
safeAddColumn('email_settings', 'expiry_date',   'INTEGER');
safeAddColumn('email_settings', 'last_sync',     'TEXT');
safeAddColumn('email_settings', 'is_active',     'INTEGER DEFAULT 1');

// passwords table columns (in case table existed before encrypted_iv was added)
try {
  safeAddColumn('passwords', 'encrypted_iv', 'TEXT NOT NULL DEFAULT ""');
} catch {}

module.exports = db;

