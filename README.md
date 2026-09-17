# 🛡️ Frield — AI-Powered Cybersecurity SaaS Platform & Extension

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00FF7F?style=for-the-badge)](LICENSE)

> **Frield** is a modern cybersecurity SaaS platform and browser extension that actively protects inboxes and browsing sessions from phishing, malware, malicious URLs, and credential theft using multi-vector ML scoring, automated Gmail telemetry, and an immutable cryptographic SHA-256 hash-chain evidence vault.

---

## 🌟 Key Features

- 📧 **Automated Inbox Threat Scoring** — Real-time NLP and ML classification scoring emails from `0` (Safe) to `100` (Dangerous).
- 🧠 **Multi-Signal ML Threat Engine** — Evaluates SPF/DKIM/DMARC authentication status, suspicious sender domains, high-risk TLDs, urgent call-to-actions, and credential harvest triggers.
- 🔐 **Cryptographic Hash-Chain Vault** — Blockchain-inspired SHA-256 ledger providing tamper-evident cryptographic verification for security incidents and threat evidence.
- 🧩 **Chromium Browser Extension (Manifest V3)** — Real-time webmail scanning, URL reputation analysis, risk level overlays, and instant threat reporting.
- 📬 **Background Gmail Sync** — Automated background synchronization connecting directly to Google Mail APIs for continuous inbox monitoring.
- 🔑 **Credential Exposure & Password Auditing** — Real-time credential safety analysis and entropy scoring.
- 📊 **Security Analyst Dashboard** — Interactive cybersecurity command center built with Chart.js, real-time threat telemetry, risk breakdowns, and audit feeds.
- 💎 **SaaS Plan Management** — Tiered subscription controls (Free Tier: 50 scans/day vs. Pro Tier: Unlimited with custom rules).

---

## 🛠️ Architecture & Tech Stack

```
Frield/
├── server.js               # Express server entry point & background cron
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore configuration
├── db/
│   ├── database.js         # SQLite database initialization & schema
│   └── seed.js             # Telemetry & mock dataset seeder
├── routes/
│   ├── auth.js             # User authentication & JWT handling
│   ├── emails.js           # Email threat analysis & triage endpoints
│   ├── google.js           # Google OAuth 2.0 & Gmail API integration
│   ├── passwords.js        # Password security checker & entropy calculator
│   ├── subscription.js     # SaaS subscription tier management
│   └── vault.js            # Cryptographic hash-chain ledger API
├── services/
│   ├── mlScorer.js         # Multi-factor threat scoring & NLP engine
│   ├── hashChain.js        # SHA-256 cryptographic blockchain ledger
│   └── gmailFetcher.js     # OAuth-based Gmail synchronizer
├── middleware/
│   └── auth.js             # JWT bearer verification middleware
├── public/                 # Analyst Web Command Center (Vanilla JS + CSS)
│   ├── index.html          # Authentication & portal gateway
│   ├── dashboard.html      # Threat metrics & analyst charts
│   ├── email-list.html     # Scanned email feed & inspection modal
│   ├── vault.html          # Immutable hash-chain proof explorer
│   └── settings.html       # API keys, Gmail connection, & billing
└── extension/              # Chromium Browser Extension (Manifest V3)
    ├── manifest.json       # MV3 metadata & permissions
    ├── background.js       # Extension service worker & badge manager
    ├── content.js          # Webmail DOM scanner & warning overlays
    └── popup.html / .js    # Quick-scan popup interface
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18.0.0 or later)
- **npm** (v9.0.0 or later)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/utkarshsingh100m/Frield.git
cd Frield
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your secret keys:
```bash
cp .env.example .env
```

### 3. Initialize & Seed Database
Populate the SQLite database with mock users, sample phishing emails, and hash-chain blocks:
```bash
npm run seed
```

### 4. Start the Application Server
```bash
npm start
# Or start in development mode with nodemon:
npm run dev
```

The Web Command Center will be running at **`http://localhost:3000`**.

---

## 🧩 Installing the Browser Extension

1. Open **Google Chrome**, **Brave**, or **Microsoft Edge** and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the upper-right corner).
3. Click **Load unpacked**.
4. Select the `extension/` directory from the repository.
5. Pin the **Frield** shield icon to your browser toolbar to enable live URL and webmail protection.

---

## 🔒 Threat Scoring Model

The threat scoring engine (`services/mlScorer.js`) evaluates multiple feature vectors to generate a deterministic 0–100 risk score:

| Score Band | Classification | Recommended Action |
| :--- | :--- | :--- |
| **0 – 30** | 🟢 **SAFE** | Legitimate communication, verified sender signature. |
| **31 – 70** | 🟡 **SUSPICIOUS** | Caution advised; anomalous links or unverified headers. |
| **71 – 100** | 🔴 **DANGEROUS** | High probability of phishing, credential harvesting, or spoofing. |

---

## 📡 Core API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health and uptime check |
| `POST` | `/auth/google` | Exchange Google token for Frield JWT |
| `GET` | `/emails` | List all scanned emails with threat classifications |
| `POST` | `/emails/classify` | Submit an email payload for instant AI threat analysis |
| `GET` | `/vault` | Query all blocks in the immutable hash-chain ledger |
| `POST` | `/vault/add` | Append an audit evidence record to the ledger |
| `POST` | `/vault/verify` | Cryptographically verify the integrity of the full chain |
| `POST` | `/passwords/check` | Analyze password strength, entropy, and common leak patterns |

---

## 📄 License

This project is licensed under the **MIT License**.
