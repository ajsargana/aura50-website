/**
 * AURA50 Light Proof Verifier (mobile service layer)
 *
 * Thin wrapper around src/lib/crypto/MerkleVerifier.ts that exposes
 * the same public API expected by existing service consumers.
 *
 * The previous implementation used:
 *   - Node.js `crypto` module (not available on Hermes)
 *   - Wrong hash format (no domain separation, no leafIndex)
 *
 * This version uses @noble/hashes and exactly matches the server's merkle.ts.
 */

import {
  verifyMerkleProof,
  quickValidate,
  type MerkleLeafData,
  type VerifiableMerkleProof,
  type VerifyResult,
} from '../lib/crypto/MerkleVerifier';

export { verifyMerkleProof, quickValidate };
export type { MerkleLeafData, VerifiableMerkleProof, VerifyResult };

// ── Legacy-compatible class for existing consumers ────────────────────────────

/**
 * @deprecated Use verifyMerkleProof() from lib/crypto/MerkleVerifier instead.
 *
 * Legacy entry point kept for backward compatibility.
 * The old `MobileOptimizedProof` / `spatialProof` / `temporalRoot` interface
 * no longer exists — callers must migrate to the server-compatible proof format.
 */
export class LightProofVerifier {
  static verifyProof(proof: VerifiableMerkleProof): VerifyResult {
    return verifyMerkleProof(proof);
  }

  static quickValidate(proof: Partial<VerifiableMerkleProof>): boolean {
    return quickValidate(proof);
  }
}
