/**
 * AURA50 Light Node Client
 *
 * WebSocket client that connects to the AURA50 server, subscribes to epoch
 * finalization events, and maintains a locally-verified cache of epoch roots.
 *
 * Key properties:
 *   - Stable identity (PeerID) persists across IP changes and reconnections
 *   - Automatic reconnect with exponential backoff on disconnect
 *   - Re-subscribes on every reconnect (handles IP change gracefully)
 *   - NetInfo listener triggers immediate reconnect on network recovery
 *   - Offline queue: epoch IDs received while offline are fetched on reconnect
 *   - Threshold validation: epoch roots are only trusted after ≥ MIN_SOURCES agree
 *
 * Usage:
 *   const client = new LightNodeClient({ serverUrl: 'ws://62.84.187.126:5005/ws', userId: '...' });
 *   await client.initialize();
 *   client.on('epochRootVerified', ({ epochId, merkleRoot }) => { ... });
 */

import { EventEmitter } from 'events';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { getOrCreatePeerIdentity, shortNodeId, PeerIdentity } from './PeerIdentity';
import { epochRootStore, VerifiedEpochRoot, RootObservation } from './EpochRootStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LightNodeClientConfig {
  /** Full WebSocket URL, e.g. 'ws://62.84.187.126:5005/ws' */
  serverUrl: string;
  /** Authenticated user ID (included in registration message) */
  userId?: string;
  /**
   * Number of independent epoch-root sources the network exposes.
   * Set to 1 for single-server setup; raise as validators join.
   */
  totalRootSources?: number;
  /** ms between reconnect attempts, doubles each failure, max BACKOFF_MAX_MS */
  backoffBaseMs?: number;
}

/** Emitted when a newly verified root is ready for claiming */
export interface EpochRootVerifiedEvent {
  epochId: number;
  merkleRoot: string;
  totalReward: string;
  participantCount: number;
  confirmedBy: string[];
}

/** Message received from server on the 'epochs' channel */
interface EpochFinalizedMessage {
  type: 'epoch_finalized';
  epochId: number;
  merkleRoot: string;
  totalReward: string;
  participantCount: number;
}

interface ServerWsMessage {
  type: 'event' | 'error' | 'pong';
  channel?: string;
  data?: any;
  timestamp?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS  = 60_000;
const PING_INTERVAL_MS = 25_000; // slightly under server's 30 s CLIENT_TIMEOUT
const SOURCE_ID_SERVER_WS = 'server-ws';

// ── LightNodeClient ───────────────────────────────────────────────────────────

export class LightNodeClient extends EventEmitter {
  private config: Required<LightNodeClientConfig>;
  private identity: PeerIdentity | null = null;
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs: number;
  private isRunning = false;
  private isConnected = false;
  private networkOnline = true;
  private netInfoUnsubscribe: (() => void) | null = null;

  constructor(config: LightNodeClientConfig) {
    super();
    this.config = {
      totalRootSources: 1,
      backoffBaseMs: BACKOFF_BASE_MS,
      userId: '',
      ...config,
    };
    this.backoffMs = this.config.backoffBaseMs;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the light node:
   *   1. Load or generate stable PeerID
   *   2. Restore verified epoch roots from AsyncStorage
   *   3. Connect to server WebSocket
   *   4. Start network monitoring for IP change detection
   */
  async initialize(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Load stable identity (survives IP changes)
    this.identity = await getOrCreatePeerIdentity();
    console.log(`[LightNode] PeerID: ${shortNodeId(this.identity.nodeId)}`);

    // Restore previously verified roots (avoids re-fetching on every restart)
    await epochRootStore.loadFromStorage();

    // Monitor network changes — handles IP change on mobile (LTE ↔ WiFi etc.)
    this.netInfoUnsubscribe = NetInfo.addEventListener(this.onNetworkChange.bind(this));

    // Initial connect
    this.connect();
  }

  /** Gracefully close the connection and stop reconnect timers. */
  async destroy(): Promise<void> {
    this.isRunning = false;
    this.cancelReconnect();
    this.clearPing();
    this.netInfoUnsubscribe?.();
    this.netInfoUnsubscribe = null;
    this.ws?.close();
    this.ws = null;
  }

  // ── Connection management ─────────────────────────────────────────────────

  private connect(): void {
    if (!this.isRunning || !this.networkOnline) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    // Clean up any previous socket
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    console.log(`[LightNode] Connecting to ${this.config.serverUrl}…`);
    const ws = new WebSocket(this.config.serverUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (ws !== this.ws) return; // stale socket
      console.log(`[LightNode] Connected (nodeId: ${shortNodeId(this.identity!.nodeId)})`);
      this.isConnected = true;
      this.backoffMs = this.config.backoffBaseMs; // reset on success
      this.startPing();

      // Register node identity with server (for future server-side features)
      this.send({
        type: 'register_node',
        nodeId: this.identity!.nodeId,
        userId: this.config.userId,
      });

      // Subscribe to epoch finalization events
      this.send({ type: 'subscribe', channel: 'epochs' });

      // Request recent epochs — catches any finalized while we were offline (T2-3 fix)
      this.send({ type: 'get_recent_epochs' });

      this.emit('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      if (ws !== this.ws) return;
      try {
        const msg: ServerWsMessage = JSON.parse(
          typeof event.data === 'string' ? event.data : event.data.toString()
        );
        this.handleMessage(msg);
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onerror = () => {
      // onclose fires right after onerror — reconnect is handled there
    };

    ws.onclose = (event: CloseEvent) => {
      if (ws !== this.ws) return;
      console.log(`[LightNode] Disconnected (code=${event.code})`);
      this.isConnected = false;
      this.clearPing();
      this.emit('disconnected');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || !this.networkOnline) return;
    this.cancelReconnect();
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    console.log(`[LightNode] Reconnecting in ${delay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPing(): void {
    this.clearPing();
    this.pingTimer = setInterval(() => {
      // Server's heartbeat checker expects a WebSocket-level ping/pong.
      // WebSocket.ping() is not available in browser/RN — send a JSON ping instead.
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, PING_INTERVAL_MS);
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private send(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch { /* non-fatal */ }
    }
  }

  // ── Network change handler ────────────────────────────────────────────────

  /**
   * Called by NetInfo whenever network state changes.
   * Handles: WiFi ↔ LTE (IP change), flight mode, reconnect.
   */
  private onNetworkChange(state: NetInfoState): void {
    const wasOnline = this.networkOnline;
    this.networkOnline = !!(state.isConnected && state.isInternetReachable !== false);

    if (!wasOnline && this.networkOnline) {
      console.log('[LightNode] Network restored — reconnecting immediately');
      this.cancelReconnect();
      this.backoffMs = this.config.backoffBaseMs; // reset backoff on network recovery
      // Close the stale socket (old IP) and open a fresh one
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.connect();
    } else if (wasOnline && !this.networkOnline) {
      console.log('[LightNode] Network lost');
      this.cancelReconnect();
      this.emit('offline');
    }
  }

  // ── Message handling ──────────────────────────────────────────────────────

  private handleMessage(msg: ServerWsMessage): void {
    if (msg.type === 'event' && msg.channel === 'epochs' && msg.data) {
      this.handleEpochEvent(msg.data as EpochFinalizedMessage);
    }
    // Other channels (blocks, transactions, etc.) are ignored by the light node
  }

  private async handleEpochEvent(data: EpochFinalizedMessage): Promise<void> {
    if (data.type !== 'epoch_finalized') return;

    const { epochId, merkleRoot, totalReward, participantCount } = data;

    if (!epochId || !merkleRoot || merkleRoot.length !== 64) {
      console.warn('[LightNode] Received malformed epoch_finalized message', data);
      return;
    }

    console.log(`[LightNode] Epoch ${epochId} finalized — root: ${merkleRoot.slice(0, 16)}…`);

    const obs: RootObservation = {
      source: SOURCE_ID_SERVER_WS,
      merkleRoot,
      totalReward: totalReward ?? '0',
      participantCount: participantCount ?? 0,
      receivedAt: Date.now(),
    };

    const verified = await epochRootStore.addObservation(
      epochId,
      obs,
      this.config.totalRootSources
    );

    if (verified) {
      this.emit('epochRootVerified', {
        epochId: verified.epochId,
        merkleRoot: verified.merkleRoot,
        totalReward: verified.totalReward,
        participantCount: verified.participantCount,
        confirmedBy: verified.confirmedBy,
      } satisfies EpochRootVerifiedEvent);

      // Notify user that their mining reward is ready to claim
      try {
        const { NotificationService } = require('../../services/NotificationService');
        await NotificationService.getInstance().triggerEpochRewardNotification(
          verified.epochId,
          verified.totalReward,
          verified.participantCount,
        );
      } catch { /* non-fatal */ }

      // Prune old roots to bound storage growth
      await epochRootStore.pruneOlderThan(epochId);
    }
  }

  // ── Public queries ────────────────────────────────────────────────────────

  /** True if the WebSocket is currently open. */
  get connected(): boolean {
    return this.isConnected;
  }

  /** Return the stable node ID (hex string), or null if not yet initialized. */
  get nodeId(): string | null {
    return this.identity?.nodeId ?? null;
  }

  /**
   * Add an additional source observation for an epoch root (e.g., an HTTP
   * fallback confirmation).  Call this after fetching the epoch info via REST
   * to corroborate the WebSocket observation.
   */
  /** Returns configured totalRootSources (used by LightClaimFlow HTTP fallback path) */
  getTotalRootSources(): number {
    return this.config.totalRootSources;
  }

  async addHttpFallbackObservation(
    epochId: number,
    merkleRoot: string,
    totalReward: string,
    participantCount: number
  ): Promise<VerifiedEpochRoot | null> {
    return epochRootStore.addObservation(
      epochId,
      {
        source: 'http-fallback',
        merkleRoot,
        totalReward,
        participantCount,
        receivedAt: Date.now(),
      },
      this.config.totalRootSources
    );
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

let _instance: LightNodeClient | null = null;

/**
 * Get (or lazily create) the singleton LightNodeClient.
 *
 * Call initialize() on it before using it:
 *
 *   const client = getLightNodeClient({ serverUrl, userId });
 *   await client.initialize();
 */
export function getLightNodeClient(config?: LightNodeClientConfig): LightNodeClient {
  if (!_instance) {
    if (!config) throw new Error('LightNodeClient: config required on first call');
    _instance = new LightNodeClient(config);
  }
  return _instance;
}

/**
 * Returns the configured totalRootSources for the singleton client,
 * or 1 (single-server default) if the client has not been initialized.
 * Used by LightClaimFlow to avoid hardcoding 1 in the HTTP fallback path.
 */
export function getConfiguredTotalRootSources(): number {
  return _instance?.getTotalRootSources() ?? 1;
}

/**
 * Replace the singleton (useful for testing or re-initialization after logout).
 */
export function resetLightNodeClient(): void {
  _instance?.destroy().catch(() => {});
  _instance = null;
}
