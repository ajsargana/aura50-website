/**
 * AURA50 Mobile Merkle Proof Verifier
 *
 * Pure TypeScript SHA-256 implementation matching the server's merkle.ts exactly:
 *   - Leaf hash:     sha256("\x00" + userId + ":" + amount + ":" + type + ":" + blockHeight + ":" + leafIndex)
 *   - Internal hash: sha256("\x01" + leftHex + rightHex)
 *
 * Uses @noble/hashes (pure JS, Hermes-compatible, no native deps).
 * Target: < 5 ms for a 20-level proof on any modern device.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Mirror of server's MerkleLeaf — must stay in sync with server/merkle.ts */
export interface MerkleLeafData {
  userId: string;
  amount: string;
  type: 'mining' | 'participation' | 'referral';
  blockHeight: number;
  leafIndex: number; // Required: included in hash to prevent cross-leaf proof replay (C-5)
}

/** Mirror of server's MerkleProof */
export interface VerifiableMerkleProof {
  leaf: MerkleLeafData;
  leafIndex: number;      // Position in the tree
  proof: string[];        // Sibling hashes (hex, left-to-right path to root)
  root: string;           // Expected Merkle root (hex)
}

export interface VerifyResult {
  valid: boolean;
  computedRoot: string;
  expectedRoot: string;
  durationMs: number;
  reason?: string;
}

// ── Core hash functions (domain-separated, match server exactly) ──────────────

// TextEncoder is available globally in React Native (Hermes) and modern runtimes.
const enc = new TextEncoder();

/**
 * Leaf node hash — domain prefix \x00 prevents second-preimage attacks (H-3).
 * Includes leafIndex to prevent cross-leaf proof replay (C-5).
 *
 * Must exactly match server/merkle.ts hashLeaf():
 *   createHash('sha256').update('\x00' + userId + ':' + amount + ':' + type + ':' + blockHeight + ':' + idx).digest('hex')
 * Both Node.js and TextEncoder produce the same bytes for ASCII + null-byte input.
 */
function hashLeaf(leaf: MerkleLeafData): string {
  const idx = leaf.leafIndex ?? 0;
  const data = `\x00${leaf.userId}:${leaf.amount}:${leaf.type}:${leaf.blockHeight}:${idx}`;
  return bytesToHex(sha256(enc.encode(data)));
}

/**
 * Internal node hash — domain prefix \x01 (H-3).
 * left/right are 64-char hex strings.
 *
 * Must exactly match server/merkle.ts hash():
 *   createHash('sha256').update('\x01' + left + right).digest('hex')
 */
function hashInternal(left: string, right: string): string {
  return bytesToHex(sha256(enc.encode(`\x01${left}${right}`)));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Verify a Merkle proof produced by the AURA50 server.
 *
 * @returns VerifyResult with valid=true only if the recomputed root matches proof.root.
 *
 * Single-participant edge case: proof.proof === [] → computed hash = leafHash,
 * which equals the root when there is only one leaf.  This is correct (H-4).
 */
export function verifyMerkleProof(proof: VerifiableMerkleProof): VerifyResult {
  const start = Date.now();

  // Basic structural validation
  if (!proof.leaf || !proof.root || !Array.isArray(proof.proof)) {
    return {
      valid: false,
      computedRoot: '',
      expectedRoot: proof?.root ?? '',
      durationMs: Date.now() - start,
      reason: 'Malformed proof structure',
    };
  }

  if (proof.proof.length > 32) {
    return {
      valid: false,
      computedRoot: '',
      expectedRoot: proof.root,
      durationMs: Date.now() - start,
      reason: 'Proof depth exceeds maximum (32)',
    };
  }

  // Verify each sibling is a 64-char hex string
  const hexRe = /^[0-9a-f]{64}$/i;
  if (proof.proof.some(p => typeof p !== 'string' || !hexRe.test(p))) {
    return {
      valid: false,
      computedRoot: '',
      expectedRoot: proof.root,
      durationMs: Date.now() - start,
      reason: 'Proof contains invalid hex strings',
    };
  }

  // Walk the path from leaf to root
  let hash = hashLeaf(proof.leaf);
  let index = proof.leafIndex;

  for (const sibling of proof.proof) {
    if (index % 2 === 0) {
      hash = hashInternal(hash, sibling);
    } else {
      hash = hashInternal(sibling, hash);
    }
    index = Math.floor(index / 2);
  }

  const valid = hash === proof.root;
  return {
    valid,
    computedRoot: hash,
    expectedRoot: proof.root,
    durationMs: Date.now() - start,
    reason: valid ? undefined : 'Root mismatch — proof is invalid or tampered',
  };
}

/**
 * Quick structural check (no crypto). Use before full verification to skip
 * obviously malformed proofs early.
 */
export function quickValidate(proof: Partial<VerifiableMerkleProof>): boolean {
  return !!(
    proof.leaf?.userId &&
    proof.leaf?.amount &&
    typeof proof.leaf?.blockHeight === 'number' &&
    typeof proof.leaf?.leafIndex === 'number' &&
    typeof proof.leafIndex === 'number' &&
    Array.isArray(proof.proof) &&
    typeof proof.root === 'string' &&
    proof.root.length === 64
  );
}
