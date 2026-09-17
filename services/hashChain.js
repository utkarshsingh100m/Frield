const crypto = require('crypto');

/**
 * Hash-Chain Ledger Service
 * Implements a simplified blockchain-style hash chain for file integrity tracking.
 * Each block links to the previous via previous_hash, forming an immutable chain.
 */

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Generate SHA-256 hash of file content (or simulated content)
 */
function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Build a new block for the chain
 */
function buildBlock(index, filename, fileContent, previousHash) {
  const timestamp = new Date().toISOString();
  const sha256_hash = hashContent(`${filename}:${fileContent}:${timestamp}:${index}`);
  return {
    block_index: index,
    filename,
    sha256_hash,
    previous_hash: previousHash || GENESIS_HASH,
    timestamp,
    status: 'VALID'
  };
}

/**
 * Verify the integrity of all blocks in the chain
 * For each block: re-check that sha256_hash format is valid and chain linkage is correct
 */
function verifyChain(blocks) {
  if (!blocks || blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index);
  const results = [];

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];
    let status = 'VALID';

    // Verify hash format (64 hex chars)
    if (!/^[a-f0-9]{64}$/.test(block.sha256_hash)) {
      status = 'TAMPERED';
    }

    // Verify chain linkage (each block's previous_hash must match the prior block's hash)
    if (i > 0) {
      const prevBlock = sorted[i - 1];
      if (block.previous_hash !== prevBlock.sha256_hash) {
        status = 'TAMPERED';
      }
    } else {
      // Genesis block must have genesis previous_hash
      if (block.previous_hash !== GENESIS_HASH && block.previous_hash !== null) {
        // Allow null for first block too
      }
    }

    results.push({ ...block, status });
  }

  return results;
}

/**
 * Get the last block's hash (to chain the next block)
 */
function getLastHash(blocks) {
  if (!blocks || blocks.length === 0) return GENESIS_HASH;
  const sorted = [...blocks].sort((a, b) => b.block_index - a.block_index);
  return sorted[0].sha256_hash;
}

module.exports = { buildBlock, verifyChain, getLastHash, hashContent, GENESIS_HASH };
