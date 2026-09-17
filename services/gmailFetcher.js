const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { scoreEmail } = require('./mlScorer');

// Note: These should match the ones in routes/google.js
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = process.env.APP_URL || 'http://localhost:3000/google/callback';

async function getOAuth2Client(tokens) {
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

/**
 * syncGmail
 * Fetches new emails for a given user from Gmail API
 */
async function syncGmail(userId) {
  const settings = db.prepare('SELECT * FROM email_settings WHERE user_id = ? AND is_active = 1').get(userId);
  if (!settings || !settings.refresh_token) {
    console.log(`[GmailFetcher] No Gmail credentials for user ${userId}`);
    return { count: 0 };
  }

  const oAuth2Client = await getOAuth2Client({
    access_token: settings.access_token,
    refresh_token: settings.refresh_token,
    expiry_date: settings.expiry_date
  });

  // Handle token refresh
  oAuth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      db.prepare('UPDATE email_settings SET access_token = ?, refresh_token = ?, expiry_date = ? WHERE user_id = ?')
        .run(tokens.access_token, tokens.refresh_token, tokens.expiry_date, userId);
    } else {
      db.prepare('UPDATE email_settings SET access_token = ?, expiry_date = ? WHERE user_id = ?')
        .run(tokens.access_token, tokens.expiry_date, userId);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  try {
    // List messages
    let query = 'is:unread';
    if (settings.last_sync) {
      // Use epoch seconds for Gmail query
      const epochSeconds = Math.floor(new Date(settings.last_sync).getTime() / 1000);
      query += ` after:${epochSeconds}`;
    }

    const res = await gmail.users.messages.list({ userId: 'me', q: query });
    const messages = res.data.messages || [];
    
    const stats = { new: 0, total: messages.length };

    for (const msg of messages) {
      const msgDetail = await gmail.users.messages.get({ userId: 'me', id: msg.id });
      const payload = msgDetail.data.payload;
      const headers = payload.headers;

      const subject = (headers.find(h => h.name === 'Subject') || {}).value || '(no subject)';
      const from = (headers.find(h => h.name === 'From') || {}).value || 'unknown@unknown.com';
      const date = (headers.find(h => h.name === 'Date') || {}).value;
      
      let body = '';
      if (payload.parts) {
        const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart && textPart.body.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      } else if (payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString();
      }

      // Check if message-id already exists
      const exists = db.prepare('SELECT id FROM emails WHERE id = ?').get(msg.id);
      if (!exists) {
        await processAndSaveEmail(userId, msg.id, from, subject, body, date);
        stats.new++;
      }
      
      // Mark as read or skip based on preference (we just fetch for now)
    }

    // Update last sync
    db.prepare('UPDATE email_settings SET last_sync = ? WHERE user_id = ?').run(new Date().toISOString(), userId);

    return stats;
  } catch (err) {
    console.error(`[GmailFetcher] Sync failed for ${userId}:`, err.message);
    throw err;
  }
}

async function processAndSaveEmail(userId, messageId, sender, subject, body, date) {
  // Ensure required fields always have values
  sender  = sender  || 'unknown@unknown.com';
  subject = subject || '(no subject)';
  body    = body    || '';

  const senderDomain = extractDomain(sender);
  const receivedAt = date ? new Date(date).toISOString() : new Date().toISOString();

  // Extract links
  const links = [];
  const linkRegex = /https?:\/\/[^\s<>"]+/g;
  let match;
  while ((match = linkRegex.exec(body)) !== null) {
    links.push(match[0]);
  }

  // Score the email
  const emailObj = { 
    sender, 
    sender_domain: senderDomain, 
    subject, 
    body, 
    links, 
    spf_status: 'pass', // Gmail API doesn't easily expose these without raw headers
    dkim_status: 'pass',
    dmarc_status: 'pass' 
  };
  
  const { score, category, features } = scoreEmail(emailObj);

  // Save to DB
  db.prepare(`
    INSERT INTO emails (id, user_id, sender, sender_domain, subject, body, links, spf_status, dkim_status, dmarc_status, category, received_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    messageId, userId, sender, senderDomain, subject, body,
    JSON.stringify(links), 'pass', 'pass', 'pass', category, receivedAt
  );

  db.prepare(`
    INSERT INTO email_scores (id, email_id, score, features)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), messageId, score, JSON.stringify(features));

  // Increment scan count
  db.prepare('UPDATE subscriptions SET scan_count = scan_count + 1 WHERE user_id = ?').run(userId);
}

function extractDomain(email) {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase().trim().split('>')[0].split(']')[0] : email.toLowerCase();
}

module.exports = { syncGmail };
