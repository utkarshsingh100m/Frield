# Blockchain Hash-Chain Ledger — Frield

## Overview

Frield's **Vault Ledger** implements a simplified blockchain-style hash-chain for tamper-evident file integrity tracking. Each file added to the vault is represented as a **block** cryptographically linked to the previous block.

## Block Structure

```json
{
  "id": "uuid-v4",
  "user_id": "user-id",
  "filename": "financial_report.pdf",
  "sha256_hash": "e3b0c44298fc1c149afb...",
  "previous_hash": "d4f3c22a91e4bc8f3...",
  "block_index": 3,
  "status": "VALID",
  "created_at": "2024-02-22T10:30:00.000Z"
}
```

## Hash Chain Mechanism

```
Block 0 (Genesis)           Block 1                    Block 2
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│ filename: cfg.json │      │ filename: db.csv   │      │ filename: keys.pem │
│ hash: abc123...    │─────▶│ prev: abc123...    │─────▶│ prev: def456...    │
│ prev: 000000...    │      │ hash: def456...    │      │ hash: ghi789...    │
└────────────────────┘      └────────────────────┘      └────────────────────┘
```

Each block's `previous_hash` must match the `sha256_hash` of the block before it. This forms an unbreakable chain.

## Block Building Algorithm

```js
sha256_hash = SHA256(`${filename}:${content}:${timestamp}:${index}`);
```

The hash is computed from a combination of filename, content, timestamp, and index — making each hash unique and deterministic.

## Integrity Verification

When **"Verify All Hashes"** is clicked:

1. All blocks are fetched, sorted by `block_index`
2. For each block:
   - Verify `sha256_hash` is a valid 64-char hex string
   - Verify `previous_hash === blocks[i-1].sha256_hash`
3. Any mismatch → block marked `TAMPERED`
4. All statuses updated in the database

## Tamper Detection

If an attacker modifies a file and needs to update Block N's hash:

- Block N+1's `previous_hash` no longer matches the new Block N hash
- Every subsequent block is flagged `TAMPERED`
- The chain cannot be silently modified

### Example Tamper Scenario

```
Normal state:
  Block 0: hash=aaa
  Block 1: prev=aaa, hash=bbb  ✓
  Block 2: prev=bbb, hash=ccc  ✓

After Block 0 tampered:
  Block 0: hash=XXX (changed!)
  Block 1: prev=aaa ≠ XXX, hash=bbb  ⚠ TAMPERED
  Block 2: (also flagged)              ⚠ TAMPERED
```

## Genesis Block

The very first block uses a fixed `previous_hash`:

```
0000000000000000000000000000000000000000000000000000000000000000
```

(64 zeros — analogous to Bitcoin's genesis block)

## Storage

All blocks are stored in SQLite (`vault_ledger` table). They are not stored on a distributed ledger — this is a **centralized, simplified** hash-chain designed for file integrity auditing within a single organization's account.

## Limitations vs Real Blockchain

| Feature           | Frield Vault        | Real Blockchain      |
| ----------------- | ------------------- | -------------------- |
| Tamper detection  | ✅ Yes              | ✅ Yes               |
| Distributed       | ❌ Centralized      | ✅ Decentralized     |
| Consensus         | ❌ None             | ✅ PoW/PoS           |
| Immutability      | ⚠️ Admin can delete | ✅ True immutability |
| Crypto signatures | ❌ No               | ✅ Yes               |
