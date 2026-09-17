# System Architecture — Frield

## Overview

```
┌────────────────────────────────────────────────────────┐
│                      BROWSER                           │
│  index.html  dashboard.html  email-list.html           │
│  vault.html  settings.html                             │
│                    ↕ fetch() API calls                 │
│         js/api.js (JWT Bearer Auth)                    │
└───────────────────────┬────────────────────────────────┘
                        │ HTTP/REST
                        ▼
┌────────────────────────────────────────────────────────┐
│               Express API Server (server.js)           │
│                                                        │
│  /auth/*    → routes/auth.js    → JWT + Google OAuth   │
│  /emails/*  → routes/emails.js  → mlScorer.js         │
│  /vault/*   → routes/vault.js   → hashChain.js        │
│  /subscription/* → routes/subscription.js             │
│                                                        │
│  middleware/auth.js → JWT Verification                 │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────┐
│         SQLite Database              │
│  ┌─────────────────────────────────┐ │
│  │ users         (id, email, plan) │ │
│  │ emails        (id, sender, ...) │ │
│  │ email_scores  (email_id, score) │ │
│  │ vault_ledger  (hash, prev_hash) │ │
│  │ subscriptions (user_id, tier)   │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

## Data Flow: Email Scan

```
User submits email → POST /emails/classify
       ↓
middleware/auth.js (verify JWT)
       ↓
routes/emails.js (extract fields)
       ↓
services/mlScorer.js
  ├── extractFeatures() → keyword hits, link count, auth signals
  ├── computeScore()    → weighted sum → 0–100
  └── categorize()      → SAFE / SUSPICIOUS / DANGEROUS
       ↓
Save to: emails table + email_scores table
       ↓
Return: { score, category, features }
```

## Data Flow: Vault Add

```
User uploads file → POST /vault/add
       ↓
services/hashChain.js
  ├── getLastHash()  → query last block in chain
  ├── buildBlock()   → SHA256(filename:content:timestamp:index)
  └── Returns: block with sha256_hash + previous_hash
       ↓
Save to: vault_ledger table
       ↓
Return: block metadata
```

## Authentication Flow

```
1. User clicks "Sign in with Google"
2. Frontend sends google token → POST /auth/google
3. Server validates mock token (prod: Google OAuth2 API)
4. Server creates/returns user from DB
5. Server signs JWT (7 day expiry)
6. Frontend stores token in localStorage
7. All subsequent API calls: Authorization: Bearer <jwt>
```

## Services

| Service                 | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `services/mlScorer.js`  | NLP keyword matching + weighted scoring |
| `services/hashChain.js` | SHA-256 block builder + chain verifier  |
| `middleware/auth.js`    | JWT extraction + verification           |

## Frontend Architecture

All pages share:

- `css/styles.css` — design tokens and components
- `js/api.js` — API client, Auth helpers, shared UI functions

Page-specific logic:

- `js/dashboard.js` — Chart.js rendering
- `js/email.js` — table, filters, modals
- `js/vault.js` — hash ledger, verify
- `js/settings.js` — subscription, profile
