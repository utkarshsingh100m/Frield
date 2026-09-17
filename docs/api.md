# API Documentation — Frield

Base URL: `http://localhost:3000`

All protected routes require: `Authorization: Bearer <token>`

---

## Auth

### POST /auth/google

Exchange Google OAuth token for Frield JWT.

**Request:**

```json
{ "token": "google-token-demo" }
```

**Response:**

```json
{
  "token": "eyJ...",
  "user": {
    "id": "...",
    "email": "demo@frield.io",
    "name": "Demo User",
    "plan": "pro"
  }
}
```

### GET /auth/user 🔒

Get current user profile.

---

## Emails

### GET /emails 🔒

List all scanned emails with scores.

**Response:**

```json
{ "emails": [...], "total": 12 }
```

### GET /emails/:id 🔒

Get single email detail.

### POST /emails/classify 🔒

Submit email for ML threat analysis.

**Request:**

```json
{
  "sender": "attacker@paypal-secure.xyz",
  "subject": "URGENT: Verify your account",
  "body": "Click here immediately...",
  "links": ["http://phish.xyz/login"],
  "spf_status": "fail",
  "dkim_status": "fail",
  "dmarc_status": "fail"
}
```

**Response:**

```json
{ "id": "uuid", "score": 87, "category": "DANGEROUS", "features": {...} }
```

### POST /emails/recheck 🔒

Manually reclassify an email.

**Request:**

```json
{ "email_id": "uuid", "category": "SAFE" }
```

### POST /emails/score-text 🔒

Score a URL or arbitrary content.

**Request:**

```json
{ "url": "http://malware.tk/exe", "redirect_chain": ["a", "b", "c", "d"] }
```

---

## Vault

### GET /vault 🔒

List all hash-chain blocks.

### POST /vault/add 🔒 (Pro only)

Add a new block.

**Request:**

```json
{ "filename": "report.pdf", "content": "file content or identifier" }
```

**Response:**

```json
{
  "message": "Block added to ledger",
  "block": {
    "block_index": 5,
    "sha256_hash": "abc...",
    "previous_hash": "def...",
    "status": "VALID"
  }
}
```

### POST /vault/verify 🔒

Re-verify all blocks in the chain.

**Response:**

```json
{ "total": 5, "valid": 5, "tampered": 0, "results": [...] }
```

---

## Subscription

### GET /subscription/status 🔒

**Response:**

```json
{
  "tier": "pro",
  "daily_limit": "Unlimited",
  "remaining": "Unlimited",
  "scan_count": 0,
  "features": {
    "email_scans": true,
    "blockchain_vault": true,
    "api_access": true
  }
}
```

### POST /subscription/upgrade 🔒

Mock Stripe upgrade.

**Request:**

```json
{ "plan": "pro", "payment_token": "tok_visa" }
```

---

## Score Bands

| Score  | Category   | Meaning                          |
| ------ | ---------- | -------------------------------- |
| 0–30   | SAFE       | Legitimate email, no threats     |
| 31–70  | SUSPICIOUS | Possible threat, review needed   |
| 71–100 | DANGEROUS  | High-confidence phishing/malware |
