/**
 * ML Threat Scorer Service
 * 
 * Implements a logistic-regression-style threat scoring system for emails.
 * Features are extracted from email metadata, then combined with weighted
 * keyword NLP scoring to produce a final 0–100 threat score.
 * 
 * Score Bands:
 *   0–30  → SAFE
 *  31–70  → SUSPICIOUS
 *  71–100 → DANGEROUS
 */

// ─── NLP Keyword Dictionaries ────────────────────────────────────────────────

const DANGEROUS_KEYWORDS = [
  'verify your account', 'confirm your identity', 'urgent action required',
  'your account will be suspended', 'click here immediately', 'unusual activity',
  'update your payment', 'your card has been declined', 'winner', 'congratulations',
  'claim your prize', 'you have been selected', 'free gift', 'act now',
  'limited time offer', 'password reset', 'login attempt', 'suspicious login',
  'security alert', 'account compromised', 'unauthorized access', 'verify now',
  'bank account', 'wire transfer', 'cryptocurrency', 'bitcoin', 'invoice attached',
  'dear customer', 'dear valued member', 'kindly reconfirm'
];

const SUSPICIOUS_KEYWORDS = [
  'unsubscribe', 'click here', 'follow this link', 'visit our website',
  'do not share', 'keep confidential', 'as soon as possible', 'final notice',
  'account review', 're: your request', 'fwd:', 'important update',
  'notification', 'reminder', 'action required', 'verify', 'confirm'
];

const SAFE_SIGNALS = [
  'meeting agenda', 'project update', 'team sync', 'pull request',
  'invoice #', 'receipt', 'order confirmed', 'shipment tracking',
  'newsletter', 'calendar invite', 'scheduled maintenance'
];

// ─── Known Malicious TLDs / Domains ──────────────────────────────────────────

const SUSPICIOUS_TLDS = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.click', '.link'];
const SUSPICIOUS_DOMAINS = ['tempmail', 'mailinator', 'guerrilla', 'trashmail', 'yopmail'];

// ─── Feature Extraction ──────────────────────────────────────────────────────

function extractFeatures(email) {
  const text = `${email.subject || ''} ${email.body || ''}`.toLowerCase();
  const links = email.links ? (Array.isArray(email.links) ? email.links : JSON.parse(email.links || '[]')) : [];
  const senderDomain = email.sender_domain || extractDomain(email.sender || '');

  // 1. Keyword scores
  const dangerousHits = DANGEROUS_KEYWORDS.filter(kw => text.includes(kw)).length;
  const suspiciousHits = SUSPICIOUS_KEYWORDS.filter(kw => text.includes(kw)).length;
  const safeHits = SAFE_SIGNALS.filter(kw => text.includes(kw)).length;

  // 2. Authentication signals
  const spfFail = email.spf_status === 'fail' ? 1 : 0;
  const dkimFail = email.dkim_status === 'fail' ? 1 : 0;
  const dmarcFail = email.dmarc_status === 'fail' ? 1 : 0;
  const authScore = (spfFail + dkimFail + dmarcFail);  // 0–3

  // 3. Link analysis
  const linkCount = links.length;
  const suspiciousLinks = links.filter(url => {
    try {
      const u = new URL(url);
      return SUSPICIOUS_TLDS.some(tld => u.hostname.endsWith(tld)) ||
             u.hostname !== u.hostname.split('.').slice(-2).join('.'); // subdomain abuse
    } catch { return false; }
  }).length;

  // 4. Domain reputation
  const domainSuspicious = SUSPICIOUS_DOMAINS.some(d => senderDomain.includes(d)) ? 1 : 0;
  const tldSuspicious = SUSPICIOUS_TLDS.some(tld => senderDomain.endsWith(tld)) ? 1 : 0;

  // 5. Subject urgency signals
  const urgencyWords = ['urgent', 'immediate', 'asap', 'critical', 'alert', 'warning', 'expires'];
  const urgencyCount = urgencyWords.filter(w => (email.subject || '').toLowerCase().includes(w)).length;

  // 6. Text length signals (very short body can be phishing probe)
  const bodyLength = (email.body || '').length;
  const shortBody = bodyLength < 100 && linkCount > 0 ? 1 : 0;

  return {
    dangerousHits,
    suspiciousHits,
    safeHits,
    authScore,
    linkCount: Math.min(linkCount, 10),
    suspiciousLinks,
    domainSuspicious,
    tldSuspicious,
    urgencyCount,
    shortBody,
    senderDomain
  };
}

// ─── Logistic Regression–style Scorer ────────────────────────────────────────

const WEIGHTS = {
  dangerousHits:    12,
  suspiciousHits:   5,
  safeHits:        -8,
  authScore:        10,   // per failed auth (max 30)
  linkCount:        1.5,
  suspiciousLinks:  12,
  domainSuspicious: 20,
  tldSuspicious:    15,
  urgencyCount:     6,
  shortBody:        10
};

function computeScore(features) {
  let raw = 0;
  raw += features.dangerousHits   * WEIGHTS.dangerousHits;
  raw += features.suspiciousHits  * WEIGHTS.suspiciousHits;
  raw += features.safeHits        * WEIGHTS.safeHits;
  raw += features.authScore       * WEIGHTS.authScore;
  raw += features.linkCount       * WEIGHTS.linkCount;
  raw += features.suspiciousLinks * WEIGHTS.suspiciousLinks;
  raw += features.domainSuspicious * WEIGHTS.domainSuspicious;
  raw += features.tldSuspicious    * WEIGHTS.tldSuspicious;
  raw += features.urgencyCount     * WEIGHTS.urgencyCount;
  raw += features.shortBody        * WEIGHTS.shortBody;

  // Clamp to 0–100
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function categorize(score) {
  if (score <= 30) return 'SAFE';
  if (score <= 70) return 'SUSPICIOUS';
  return 'DANGEROUS';
}

// ─── Main Export ──────────────────────────────────────────────────────────────

function scoreEmail(email) {
  const features = extractFeatures(email);
  const score = computeScore(features);
  const category = categorize(score);
  return { score, category, features };
}

function extractDomain(email) {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase().trim() : '';
}

module.exports = { scoreEmail, extractFeatures, computeScore, categorize };
