/**
 * AURA50 Epoch Root Store
 *
 * Local cache of observed epoch Merkle roots.
 * Implements a threshold-consensus model: a root is only "verified" once
 * ≥ ceil(totalSources × 2/3) independent sources agree on the same root.
 *
 * This prevents a single compromised server from serving a fraudulent root —
 * as the validator set grows, more sources must agree.
 *
 * During early deployment (single server, totalSources=1), the threshold is
 * satisfied by the server itself plus optional HTTP fallback confirmation,
 * with room to raise the bar as more validators join.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = '@aura50_epoch_root_v1:';
/** Minimum sources required regardless of threshold calculation */
const MIN_SOURCES_REQUIRED = 1;
/** Fraction of total sources that must agree — 2/3 supermajority */
const THRESHOLD_FRACTION = 2 / 3;

// ── Types ─────────────────────────────────────────────────────────────────────

/** One observation of a root for an epoch, from a single source */
export interface RootObservation {
  source: string;       // e.g. 'server-ws', 'http-fallback', 'peer-<nodeId>'
  merkleRoot: string;   // 64-char hex
  totalReward: string;  // decimal string, e.g. "50.00000000"
  participantCount: number;
  receivedAt: number;   // Unix ms
}

/** A root confirmed by sufficient independent sources */
export interface VerifiedEpochRoot {
  epochId: number;
  merkleRoot: string;
  totalReward: string;
  participantCount: number;
  confirmedBy: string[];   // source IDs that agree
  confirmedAt: number;     // Unix ms
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class EpochRootStore {
  /** Pending (unconfirmed) observations per epoch */
  private observations = new Map<number, RootObservation[]>();
  /** Confirmed (threshold-passed) roots per epoch */
  private verified = new Map<number, VerifiedEpochRoot>();

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Restore persisted verified roots from AsyncStorage on app startup.
   * Called once by LightNodeClient.initialize().
   */
  async loadFromStorage(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const epochKeys = allKeys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
      if (epochKeys.length === 0) return;

      const pairs = await AsyncStorage.multiGet(epochKeys);
      for (const [, value] of pairs) {
        if (!value) continue;
        try {
          const v: VerifiedEpochRoot = JSON.parse(value);
          this.verified.set(v.epochId, v);
        } catch { /* corrupt entry — skip */ }
      }
    } catch { /* storage unavailable — start empty */ }
  }

  // ── Core ───────────────────────────────────────────────────────────────────

  /**
   * Record an observation of a root for the given epoch.
   *
   * @param epochId         The epoch this root covers.
   * @param obs             The observation details.
   * @param totalSources    Total number of independent sources that will
   *                        participate (used for threshold calculation).
   *                        Pass 1 if only the server WebSocket is used.
   * @returns               The verified root if threshold was just reached,
   *                        or null if more observations are still needed.
   */
  async addObservation(
    epochId: number,
    obs: RootObservation,
    totalSources: number = 1
  ): Promise<VerifiedEpochRoot | null> {
    // Already verified — return immediately
    if (this.verified.has(epochId)) {
      return this.verified.get(epochId)!;
    }

    // Accumulate observations (deduplicate by source)
    const existing = this.observations.get(epochId) ?? [];
    if (!existing.some(o => o.source === obs.source)) {
      existing.push(obs);
    }
    this.observations.set(epochId, existing);

    // Count agreement per root value
    const agreement = new Map<string, RootObservation[]>();
    for (const o of existing) {
      const group = agreement.get(o.merkleRoot) ?? [];
      group.push(o);
      agreement.set(o.merkleRoot, group);
    }

    const required = Math.max(
      MIN_SOURCES_REQUIRED,
      Math.ceil(totalSources * THRESHOLD_FRACTION)
    );

    // Find a root that satisfies threshold
    for (const [root, agreeing] of agreement.entries()) {
      if (agreeing.length >= required) {
        const first = agreeing[0];
        const verified: VerifiedEpochRoot = {
          epochId,
          merkleRoot: root,
          totalReward: first.totalReward,
          participantCount: first.participantCount,
          confirmedBy: agreeing.map(o => o.source),
          confirmedAt: Date.now(),
        };
        this.verified.set(epochId, verified);
        this.observations.delete(epochId); // free memory
        await this._persist(epochId, verified);
        return verified;
      }
    }

    return null; // threshold not yet reached
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Return verified root for an epoch, or null if not yet verified. */
  getVerified(epochId: number): VerifiedEpochRoot | null {
    return this.verified.get(epochId) ?? null;
  }

  /** Return pending (unverified) observations for an epoch. */
  getPending(epochId: number): RootObservation[] {
    return this.observations.get(epochId) ?? [];
  }

  /** True if a verified root exists for the given epoch. */
  isVerified(epochId: number): boolean {
    return this.verified.has(epochId);
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  /**
   * Remove verified roots older than `keepLastN` epochs to bound memory/storage.
   * Call periodically (e.g., once per epoch finalization).
   */
  async pruneOlderThan(currentEpochId: number, keepLastN = 20): Promise<void> {
    const cutoff = currentEpochId - keepLastN;
    const toPrune: number[] = [];

    for (const id of this.verified.keys()) {
      if (id < cutoff) toPrune.push(id);
    }

    for (const id of toPrune) {
      this.verified.delete(id);
      this.observations.delete(id);
      try {
        await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
      } catch { /* non-fatal */ }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _persist(epochId: number, v: VerifiedEpochRoot): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEY_PREFIX}${epochId}`,
        JSON.stringify(v)
      );
    } catch { /* non-fatal — in-memory copy still exists */ }
  }
}

// Singleton used across the app
export const epochRootStore = new EpochRootStore();
