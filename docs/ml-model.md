# ML Threat Scoring Model — Frield

## Overview

Frield uses a **logistic regression–inspired scoring system** implemented in pure JavaScript. It extracts features from email metadata and text, then applies weighted linear scoring to produce a 0–100 threat score.

## Feature Extraction

| Feature            | Description                                              | Max Weight Impact |
| ------------------ | -------------------------------------------------------- | ----------------- |
| `dangerousHits`    | Count of high-risk NLP keywords in subject+body          | +12 per hit       |
| `suspiciousHits`   | Count of moderate-risk keywords                          | +5 per hit        |
| `safeHits`         | Count of safe signal keywords (invoice, meeting)         | -8 per hit        |
| `authScore`        | SPF + DKIM + DMARC failures (0–3)                        | +10 per fail      |
| `linkCount`        | Number of links in email (capped at 10)                  | +1.5 per link     |
| `suspiciousLinks`  | Links pointing to suspicious TLDs (.xyz, .tk, .ml, etc.) | +12 per link      |
| `domainSuspicious` | Sender domain is a known temp-mail provider              | +20               |
| `tldSuspicious`    | Sender domain TLD is in suspicious list                  | +15               |
| `urgencyCount`     | Urgency words in subject (urgent, asap, critical)        | +6 per word       |
| `shortBody`        | Very short body (<100 chars) with links — probe signal   | +10               |

## Score Formula

```
raw_score = Σ (feature_value × weight)
final_score = clamp(raw_score, 0, 100)
```

## Classification Bands

| Score  | Label             | Action               |
| ------ | ----------------- | -------------------- |
| 0–30   | **SAFE** ✅       | No action needed     |
| 31–70  | **SUSPICIOUS** ⚠️ | Flag for user review |
| 71–100 | **DANGEROUS** 🚨  | Block / quarantine   |

## NLP Keyword Dictionaries

**Dangerous keywords** (weight ×12 each):

- "verify your account", "urgent action required", "your account will be suspended"
- "claim your prize", "winner", "congratulations", "bitcoin", "wire transfer"
- "suspicious login", "account compromised", "unauthorized access"

**Suspicious keywords** (weight ×5 each):

- "click here", "follow this link", "action required", "verify", "do not share"

**Safe signals** (weight -8 each):

- "meeting agenda", "team sync", "pull request", "invoice #", "shipment tracking"

## Authentication Signal Analysis

Email authentication headers (SPF, DKIM, DMARC) are strong phishing signals:

- Each `fail` status adds **+10 points** to the score
- All three failing = +30 points (already SUSPICIOUS territory)
- Legitimate emails rarely fail all three

## Extensibility

The model can be enhanced by:

1. Replacing weights with trained coefficients (export from scikit-learn logistic regression)
2. Adding domain age lookups (WHOIS API)
3. URL reputation API integration (VirusTotal, Google Safe Browsing)
4. Adding a feedback loop from user reclassifications to retrain the model
