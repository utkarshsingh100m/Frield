require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { scoreEmail } = require('../services/mlScorer');
const { buildBlock, getLastHash } = require('../services/hashChain');

console.log('🌱 Seeding Frield database...\n');

// ─── Demo User ────────────────────────────────────────────────────────────────
const demoUser = {
  id: 'demo-user-001',
  email: 'demo@frield.io',
  name: 'Demo User',
  avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=00FF7F&color=0D1117',
  plan: 'pro'
};

db.prepare(`INSERT OR REPLACE INTO users (id, email, name, avatar, plan) VALUES (?, ?, ?, ?, ?)`)
  .run(demoUser.id, demoUser.email, demoUser.name, demoUser.avatar, demoUser.plan);

db.prepare(`INSERT OR REPLACE INTO subscriptions (id, user_id, tier, scan_count) VALUES (?, ?, 'pro', 0)`)
  .run(uuidv4(), demoUser.id);

console.log('✅ Demo user created: demo@frield.io');

// ─── Sample Emails ────────────────────────────────────────────────────────────
const sampleEmails = [
  {
    sender: 'noreply@github.com',
    subject: 'Pull request merged: Fix authentication bug',
    body: 'Your pull request #247 has been merged into main. The team has approved the changes.',
    links: ['https://github.com/user/repo/pull/247'],
    spf_status: 'pass', dkim_status: 'pass', dmarc_status: 'pass'
  },
  {
    sender: 'security@paypal-secure.xyz',
    subject: 'URGENT: Your PayPal account will be suspended',
    body: 'Verify your account immediately or your account will be suspended. Click here to verify your identity now. Act immediately to avoid losing access.',
    links: ['http://paypal-verify.xyz/login', 'http://secure-paypal.tk/confirm'],
    spf_status: 'fail', dkim_status: 'fail', dmarc_status: 'fail'
  },
  {
    sender: 'billing@netflix.com',
    subject: 'Your Netflix subscription renewal',
    body: 'Your monthly subscription has been renewed. Receipt for this month\'s billing cycle attached.',
    links: ['https://netflix.com/account'],
    spf_status: 'pass', dkim_status: 'pass', dmarc_status: 'pass'
  },
  {
    sender: 'winner@lottery2024.ml',
    subject: 'Congratulations! You have won $1,000,000!',
    body: 'You have been selected as the winner of our international lottery! Claim your prize immediately. Wire transfer of $100 processing fee required. Kindly reconfirm your bank account details.',
    links: ['http://claim-prize.tk/winner', 'http://lottery-verify.ga/confirm'],
    spf_status: 'fail', dkim_status: 'fail', dmarc_status: 'fail'
  },
  {
    sender: 'alerts@bank-secure-verify.top',
    subject: 'Unusual activity detected on your account',
    body: 'We detected a suspicious login attempt on your account from an unknown device. Verify your identity immediately by clicking the link. Unauthorized access may result in account suspension.',
    links: ['http://bank-verify.top/secure-login'],
    spf_status: 'fail', dkim_status: 'pass', dmarc_status: 'fail'
  },
  {
    sender: 'team@slack.com',
    subject: 'Team sync scheduled for tomorrow',
    body: 'This is a reminder for the team sync meeting scheduled for tomorrow at 10:00 AM. Meeting agenda has been shared.',
    links: ['https://slack.com/app'],
    spf_status: 'pass', dkim_status: 'pass', dmarc_status: 'pass'
  },
  {
    sender: 'no-reply@linkedin.com',
    subject: 'Action required: Confirm your email',
    body: 'Please confirm your email address by clicking the link below. This link will expire in 24 hours.',
    links: ['https://linkedin.com/verify/email'],
    spf_status: 'pass', dkim_status: 'pass', dmarc_status: 'pass'
  },
  {
    sender: 'support@apple-id-verify.xyz',
    subject: 'Your Apple ID has been compromised — urgent action required',
    body: 'Suspicious login detected. Your Apple ID password reset is required immediately. Click here to verify your identity and update your payment information.',
    links: ['http://apple-secure.xyz/id-verify', 'http://appleid-reset.click/login'],
    spf_status: 'fail', dkim_status: 'fail', dmarc_status: 'fail'
  },
  {
    sender: 'orders@amazon.com',
    subject: 'Order confirmed: Shipment tracking #AMZ-204821',
    body: 'Your order has been confirmed and will ship within 2 business days. Shipment tracking number: AMZ-204821.',
    links: ['https://amazon.com/orders/AMZ-204821'],
    spf_status: 'pass', dkim_status: 'pass', dmarc_status: 'pass'
  },
  {
    sender: 'info@crypto-profits2024.ga',
    subject: 'FINAL NOTICE: Claim your Bitcoin reward',
    body: 'Dear valued member, you have unclaimed bitcoin in your wallet. This is your final notice to claim. Act now before your cryptocurrency expires. Wire transfer instructions enclosed.',
    links: ['http://crypto-claim.ga/bitcoin', 'http://btc-reward.ml/claim'],
    spf_status: 'fail', dkim_status: 'fail', dmarc_status: 'fail'
  },
  {
    sender: 'newsletter@medium.com',
    subject: 'Your weekly reading list is ready',
    body: 'Here are the top stories curated for you this week based on your reading history and interests.',
    links: ['https://medium.com/@weekly'],
    spf_status: 'pass', dkim_status: 'pass', dmarc_status: 'pass'
  },
  {
    sender: 'admin@docusign-secure-login.top',
    subject: 'Document awaiting your signature — expires today',
    body: 'A document requires your urgent signature. Click here immediately to sign. This document will expire in 2 hours. Kindly reconfirm your identity before signing.',
    links: ['http://docusign-fake.top/sign'],
    spf_status: 'fail', dkim_status: 'fail', dmarc_status: 'fail'
  }
];

// Dates spread over the last 30 days
const now = new Date();
let insertedCount = 0;

sampleEmails.forEach((emailData, i) => {
  const emailId = uuidv4();
  const senderDomain = emailData.sender.split('@')[1] || emailData.sender;
  const daysAgo = Math.floor((i / sampleEmails.length) * 30);
  const receivedAt = new Date(now.getTime() - daysAgo * 86400000).toISOString();

  const emailObj = {
    ...emailData,
    sender_domain: senderDomain
  };

  const { score, category, features } = scoreEmail(emailObj);

  db.prepare(`
    INSERT OR IGNORE INTO emails (id, user_id, sender, sender_domain, subject, body, links, spf_status, dkim_status, dmarc_status, category, received_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(emailId, demoUser.id, emailData.sender, senderDomain, emailData.subject,
         emailData.body, JSON.stringify(emailData.links), emailData.spf_status,
         emailData.dkim_status, emailData.dmarc_status, category, receivedAt);

  db.prepare(`INSERT OR IGNORE INTO email_scores (id, email_id, score, features) VALUES (?, ?, ?, ?)`)
    .run(uuidv4(), emailId, score, JSON.stringify(features));

  console.log(`  📧 [${category.padEnd(10)}] (${score.toString().padStart(3)}) ${emailData.subject.substring(0, 60)}`);
  insertedCount++;
});

console.log(`\n✅ ${insertedCount} sample emails seeded.\n`);

// ─── Vault Entries ────────────────────────────────────────────────────────────
const vaultFiles = [
  { filename: 'financial_report_Q4_2024.pdf', content: 'Financial Report Q4 2024 — Confidential' },
  { filename: 'employee_database.csv',        content: 'Employee Database Export 2024-01-15'      },
  { filename: 'server_config.json',           content: 'Production Server Configuration v3.2'    },
  { filename: 'encryption_keys.pem',          content: 'RSA Private Key — Frield Production'     },
  { filename: 'audit_log_2024.txt',           content: 'Security Audit Log — Full Year 2024'     }
];

const existingBlocks = db.prepare('SELECT * FROM vault_ledger WHERE user_id = ? ORDER BY block_index ASC').all(demoUser.id);
if (existingBlocks.length === 0) {
  let lastHash = null;
  vaultFiles.forEach((file, i) => {
    const block = buildBlock(i, file.filename, file.content, lastHash);
    db.prepare(`
      INSERT OR IGNORE INTO vault_ledger (id, user_id, filename, sha256_hash, previous_hash, block_index, status)
      VALUES (?, ?, ?, ?, ?, ?, 'VALID')
    `).run(uuidv4(), demoUser.id, block.filename, block.sha256_hash, block.previous_hash, block.block_index);
    lastHash = block.sha256_hash;
    console.log(`  🔐 Block [${i}] ${file.filename}`);
  });
  console.log(`\n✅ ${vaultFiles.length} vault blocks seeded.\n`);
} else {
  console.log(`ℹ️  Vault blocks already exist, skipping.\n`);
}

console.log('🎉 Database seeding complete!\n');
console.log('   Run: node server.js');
console.log('   URL: http://localhost:3000\n');
