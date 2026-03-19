/**
 * AURA50 Stable Peer Identity
 *
 * Generates a cryptographic node identity that persists across IP changes,
 * app restarts, and background-to-foreground transitions.
 *
 * Design:
 *   - 32-byte random private key (generated once, stored in expo-secure-store)
 *   - nodeId = hex(SHA-256(privateKey)) — stable, derivable, non-reversible
 *   - privateKey stored in hardware-backed keystore (T2-1 fix)
 *
 * Uses @noble/hashes for pure-JS SHA-256 (Hermes-compatible).
 * Uses expo-secure-store for hardware-backed key storage.
 */

import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const IDENTITY_STORAGE_KEY = 'aura50_peer_identity_v2';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PeerIdentity {
  /** Stable node ID — hex(SHA-256(privateKey)) — stable across IP changes */
  nodeId: string;
  /** 32-byte random seed, hex-encoded */
  privateKeyHex: string;
  /** Unix ms when identity was first created */
  createdAt: number;
}

// ── Internals ─────────────────────────────────────────────────────────────────

function generateSecureRandom32(): Uint8Array {
  const buf = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf);
    return buf;
  }
  // Hard failure — do not fall back to Math.random for a cryptographic key (T2-5 fix)
  throw new Error(
    '[PeerIdentity] crypto.getRandomValues is unavailable. ' +
    'Ensure the expo-crypto polyfill is loaded in App.tsx before calling getOrCreatePeerIdentity().'
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the persisted peer identity, or generate and persist a new one.
 * Stored in expo-secure-store (hardware-backed keystore on iOS/Android).
 *
 * Call once during app startup (e.g., in LightNodeClient.initialize()).
 */
export async function getOrCreatePeerIdentity(): Promise<PeerIdentity> {
  // Try to load existing identity from secure storage
  try {
    const stored = await SecureStore.getItemAsync(IDENTITY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PeerIdentity;
      if (parsed.nodeId && parsed.privateKeyHex && parsed.createdAt) {
        return parsed;
      }
    }
  } catch { /* corrupt/missing — create a new one */ }

  // Generate fresh identity
  const privateKey = generateSecureRandom32(); // throws if crypto unavailable
  const privateKeyHex = bytesToHex(privateKey);
  const nodeId = bytesToHex(sha256(privateKey));

  const identity: PeerIdentity = {
    nodeId,
    privateKeyHex,
    createdAt: Date.now(),
  };

  try {
    await SecureStore.setItemAsync(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Non-fatal — identity works for this session even if we can't persist it
    console.warn('[PeerIdentity] Failed to persist identity to SecureStore');
  }

  return identity;
}

/**
 * Clear the persisted identity (e.g., on account logout).
 * The next call to getOrCreatePeerIdentity() will generate a fresh identity.
 */
export async function clearPeerIdentity(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(IDENTITY_STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Return a short 8-char display string for the node ID (for logs/UI).
 */
export function shortNodeId(nodeId: string): string {
  return nodeId.slice(0, 8);
}
