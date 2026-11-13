import type {
  AreaLockRecord,
  ShareLockRecord,
  BfgCollectorRecord,
  FurnaceRecord,
  PlantedTree,
  VendingMachineRecord,
  WorldLockRecord,
  WorldState,
} from './worldGen.ts';
import type { EquippedWearables } from './pixelArt.ts';
import type { BuffType, PlayerStatKey } from './catalog.ts';
import type { GameConfig } from './config.ts';
import type { FluidDelta, LiquidPoolInfo } from './fluids.ts';

export type UserRole = 'player' | 'admin';

export interface InventorySlot {
  itemId: number;
  qty: number;
  durability?: number;
  maxDurability?: number;
  /** Stable identity for an individual fishing rod instance. */
  rodInstanceId?: string;
  /** Persisted individual rod upgrade level (1–3). */
  rodUpgradeLevel?: 1 | 2 | 3;
}

export interface ActiveBuff {
  buffType: BuffType;
  label: string;
  bonusPct: number;
  expiresAt: number;
}

export type FishFightPattern = 'darting' | 'surging' | 'deep_run' | 'erratic';

export interface FishingCastState {
  playerId: string;
  playerName: string;
  bobberTx: number;
  bobberTy: number;
  fluidType: 1 | 2;
  depthTier: LiquidPoolInfo['depthTier'];
  depthLevel?: number;
  biting: boolean;
  startedAt: number;
  pullProgress?: number;
  lineTension?: number;
  bobberOffset?: number;
  fightPattern?: FishFightPattern;
}

export interface ExchangeListing {
  id: string;
  sellerId: string;
  sellerName: string;
  itemId: number;
  bundleSize: number;
  bundlesAvailable: number;
  priceWl: number;
  createdAt: number;
}

export interface ExchangePriceStat {
  itemId: number;
  avgUnitWl: number;
  lastTradeWl: number;
  volumeSold: number;
  updatedAt: number;
}

export interface ExchangeSnapshot {
  listings: ExchangeListing[];
  priceStats: Record<number, ExchangePriceStat>;
  totalWlBurned: number;
  totalGemsCleared: number;
}

export interface WorldDrop {
  id: string;
  itemId: number;
  qty: number;
  x: number;
  y: number;
  isGem?: boolean;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  punching: boolean;
  placing?: boolean;
  shirtColor: string;
  level: number;
  equipped?: EquippedWearables;
  role?: UserRole;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  system?: boolean;
}

export interface WorldSummary {
  name: string;
  playerCount: number;
  ownerName: string | null;
  publicAccess: boolean;
  ownerId?: string | null;
  worldKind?: 'standard' | 'mine_shaft';
}

export interface FriendEntry {
  id: string;
  name: string;
  online: boolean;
  worldName: string | null;
}

export interface FriendRequestEntry {
  fromId: string;
  fromName: string;
  timestamp: number;
}

export interface AuthUserProfile {
  playerId: string;
  playerName: string;
  email: string;
  role: UserRole;
  gems: number;
  xp: number;
  level: number;
  inventory: InventorySlot[];
  equipped: EquippedWearables;
  stats: Record<PlayerStatKey, number>;
  claimedAchievements: string[];
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  favoriteWorlds: string[];
  recentWorlds: string[];
  activeBuffs: ActiveBuff[];
  unclaimedWl: number;
}

export interface ResumePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
}

export type ClientMessage =
  | { type: 'hello'; token?: string; playerId?: string; playerName?: string }
  | { type: 'ping'; clientTime: number }
  | { type: 'join_world'; worldName: string; resumePosition?: ResumePosition }
  | { type: 'leave_world' }
  | { type: 'dungeon_buy_key'; tier: number; payment: 'gems' | 'world_locks'; txId: string }
  | { type: 'dungeon_create'; tier: number; partyMode: 'solo' | 'cooperative' }
  | { type: 'dungeon_join'; code: string }
  | { type: 'dungeon_resume' }
  | { type: 'dungeon_action'; action: 'move' | 'attack' | 'next_room' | 'extract' | 'leave'; dx?: number; dy?: number; attackId?: string }
  | {
      type: 'move';
      x: number;
      y: number;
      vx: number;
      vy: number;
      facing: 1 | -1;
      grounded: boolean;
      punching: boolean;
      placing?: boolean;
    }
  | { type: 'punch_tile'; tx: number; ty: number; toolItemId?: number }
  | { type: 'place_tile'; tx: number; ty: number; itemId: number }
  | { type: 'pickup_drop'; dropId: string }
  | { type: 'splice_seeds'; seedA: number; seedB: number }
  | { type: 'buy_gem_store'; listingId: string; txId: string }
  | {
      type: 'configure_lock';
      tx: number;
      ty: number;
      publicAccess?: boolean;
      addEditorName?: string;
      removeEditorId?: string;
      permissionTargetId?: string;
      permissions?: Partial<import('./shareLocks.ts').ShareLockPermissions>;
    }
  | {
      type: 'configure_vending';
      tx: number;
      ty: number;
      action: 'stock' | 'withdraw';
      stockItemId?: number;
      stockQty?: number;
      priceItemId?: number;
      priceQty?: number;
    }
  | {
      type: 'buy_vending';
      tx: number;
      ty: number;
      units: number;
      txId: string;
    }
  | { type: 'configure_sign'; tx: number; ty: number; text: string }
  | { type: 'equip_wearable'; itemId: number }
  | {
      type: 'friend_action';
      action: 'send_request' | 'accept' | 'decline' | 'remove';
      targetNameOrId: string;
    }
  | { type: 'claim_achievement'; achievementId: string }
  | { type: 'toggle_favorite_world'; worldName: string }
  | { type: 'chat'; text: string }
  | { type: 'list_worlds' }
  | { type: 'update_game_config'; config: GameConfig }
  | {
      type: 'admin_action';
      action: 'grant_item' | 'grant_gems' | 'grow_all_trees' | 'reset_config';
      itemId?: number;
      qty?: number;
      gems?: number;
    }
  | { type: 'use_consumable'; itemId: number }
  | { type: 'exit_mine_shaft' }
  | {
      type: 'configure_furnace';
      tx: number;
      ty: number;
      action: 'craft' | 'collect' | 'repair';
      recipeId?: string;
      toolItemId?: number;
    }
  | {
      type: 'configure_bfg';
      tx: number;
      ty: number;
      action: 'toggle' | 'withdraw';
    }
  | { type: 'cast_fishing'; tx: number; ty: number; rodItemId: number }
  | { type: 'upgrade_fishing_rod'; rodInstanceId: string }
  | { type: 'reel_fishing' }
  | {
      type: 'exchange_action';
      action: 'list' | 'post' | 'buy' | 'cancel' | 'claim_wl';
      itemId?: number;
      bundleSize?: number;
      bundles?: number;
      priceWl?: number;
      listingId?: string;
      txId?: string;
    };

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      playerName: string;
      email: string;
      role: UserRole;
      gems: number;
      xp: number;
      level: number;
      inventory: InventorySlot[];
      equipped: EquippedWearables;
      stats: Record<PlayerStatKey, number>;
      claimedAchievements: string[];
      friends: FriendEntry[];
      incomingRequests: FriendRequestEntry[];
      favoriteWorlds: string[];
      recentWorlds: string[];
      activeBuffs: ActiveBuff[];
      unclaimedWl: number;
      gameConfig: GameConfig;
      exchange: ExchangeSnapshot;
    }
  | {
      type: 'pong';
      clientTime: number;
      serverTime: number;
      worldName?: string | null;
      worldRevision?: number | null;
      playerCount?: number;
    }
  | { type: 'auth_error'; message: string }
  | { type: 'config_updated'; gameConfig: GameConfig; notice?: string }
  | {
      type: 'world_joined';
      world: WorldState;
      players: RemotePlayerState[];
      drops: WorldDrop[];
      chatHistory: ChatMessage[];
      resumed?: boolean;
    }
  | {
      type: 'presence_sync';
      worldName: string;
      players: RemotePlayerState[];
      drops: WorldDrop[];
      revision: number;
    }
  | { type: 'world_error'; message: string }
  | { type: 'player_joined'; player: RemotePlayerState }
  | { type: 'player_left'; playerId: string }
  | { type: 'player_moved'; player: RemotePlayerState }
  | {
      type: 'tile_damaged';
      tx: number;
      ty: number;
      hits: number;
      maxHits: number;
      layer: 'fg' | 'bg' | 'plant';
    }
  | {
      type: 'tile_updated';
      tx: number;
      ty: number;
      fg: number;
      bg: number;
      fluidType?: number;
      fluidLevel?: number;
      plant: PlantedTree | null;
      worldLock?: WorldLockRecord | null;
      areaLock?: AreaLockRecord | null;
      shareLock?: ShareLockRecord | null;
      vendingMachine?: VendingMachineRecord | null;
      furnace?: FurnaceRecord | null;
      bfgCollector?: BfgCollectorRecord | null;
      signText?: string | null;
      revision: number;
    }
  | { type: 'fluid_delta'; deltas: FluidDelta[] }
  | { type: 'drop_spawned'; drop: WorldDrop }
  | { type: 'drop_removed'; dropId: string }
  | {
      type: 'profile_updated';
      gems: number;
      xp: number;
      level: number;
      role: UserRole;
      email: string;
      inventory: InventorySlot[];
      equipped: EquippedWearables;
      stats: Record<PlayerStatKey, number>;
      claimedAchievements: string[];
      friends: FriendEntry[];
      incomingRequests: FriendRequestEntry[];
      favoriteWorlds: string[];
      recentWorlds: string[];
      activeBuffs: ActiveBuff[];
      unclaimedWl: number;
      notice?: string;
    }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'worlds_list'; worlds: WorldSummary[] }
  | { type: 'fishing_started'; cast: FishingCastState }
  | { type: 'fishing_bite'; playerId: string; bobberTx: number; bobberTy: number; depthTier: LiquidPoolInfo['depthTier'] }
  | { type: 'fishing_progress'; playerId: string; progress: number; lineTension: number; bobberOffset: number; fightPattern: FishFightPattern }
  | { type: 'fishing_ended'; playerId: string; caughtItemId?: number; caughtName?: string; depthTier?: LiquidPoolInfo['depthTier'] }
  | { type: 'exchange_updated'; exchange: ExchangeSnapshot }
  | { type: 'mine_shaft_expired'; worldName: string; message: string }
  | { type: 'dungeon_state'; snapshot: import('./dungeon.ts').DungeonSnapshot }
  | { type: 'dungeon_error'; message: string };

interface QueuedClientMessage {
  msg: ClientMessage;
  queuedAt: number;
}

export class GameSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(msg: ServerMessage) => void>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempts = 0;
  private lastMessageReceivedAt = 0;
  private helloPayload: { token?: string; playerId?: string; playerName?: string } | null = null;
  private activeWorldName: string | null = null;
  private lastLocalPose: ResumePosition | undefined = undefined;
  private pendingQueue: QueuedClientMessage[] = [];
  private lifecycleBound = false;
  public connected = false;

  private readonly handleOnline = () => {
    if (this.helloPayload && !this.connected) {
      this.reconnectNow();
    }
  };

  private readonly handleVisibilityOrFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (!this.helloPayload) return;
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectNow();
    } else {
      // Immediately verify liveness when tab returns to foreground
      this.send({ type: 'ping', clientTime: Date.now() });
    }
  };

  constructor() {
    this.bindBrowserLifecycle();
  }

  private bindBrowserLifecycle() {
    if (this.lifecycleBound || typeof window === 'undefined') return;
    this.lifecycleBound = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('focus', this.handleVisibilityOrFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityOrFocus);
    }
  }

  private unbindBrowserLifecycle() {
    if (!this.lifecycleBound || typeof window === 'undefined') return;
    this.lifecycleBound = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('focus', this.handleVisibilityOrFocus);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityOrFocus);
    }
  }

  connectWithToken(token: string) {
    this.bindBrowserLifecycle();
    this.helloPayload = { token };
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'hello', token });
        if (this.activeWorldName) {
          this.send({
            type: 'join_world',
            worldName: this.activeWorldName,
            resumePosition: this.lastLocalPose,
          });
        }
      }
      return;
    }
    this.openSocket();
  }

  connect(playerId: string, playerName: string) {
    this.bindBrowserLifecycle();
    this.helloPayload = { playerId, playerName };
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'hello', playerId, playerName });
        if (this.activeWorldName) {
          this.send({
            type: 'join_world',
            worldName: this.activeWorldName,
            resumePosition: this.lastLocalPose,
          });
        }
      }
      return;
    }
    this.openSocket();
  }

  reconnectNow() {
    if (!this.helloPayload) return;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.setConnectedState(false);
    this.openSocket();
  }

  private setConnectedState(next: boolean) {
    if (this.connected === next) return;
    this.connected = next;
    this.statusListeners.forEach((cb) => cb(next));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    if (typeof window === 'undefined') return;
    this.lastMessageReceivedAt = Date.now();
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const silenceMs = Date.now() - this.lastMessageReceivedAt;
      if (silenceMs > 15000) {
        // Stale half-open connection detected — force reconnect
        this.reconnectNow();
        return;
      }
      this.send({ type: 'ping', clientTime: Date.now() });
    }, 5500);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (typeof window === 'undefined' || !this.helloPayload) return;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    const baseDelay = Math.min(3500, 450 * Math.pow(1.55, Math.min(6, this.reconnectAttempts)));
    const jitter = Math.floor(Math.random() * 180);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.helloPayload) {
        this.openSocket();
      }
    }, Math.round(baseDelay + jitter));
  }

  private flushPendingQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.pendingQueue.length === 0) return;
    const cutoff = Date.now() - 15000;
    const items = this.pendingQueue.splice(0, this.pendingQueue.length);
    for (const item of items) {
      if (item.queuedAt >= cutoff) {
        this.ws.send(JSON.stringify(item.msg));
      }
    }
  }

  private openSocket() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.lastMessageReceivedAt = Date.now();
      this.setConnectedState(true);
      this.startHeartbeat();
      if (this.helloPayload) {
        this.send({ type: 'hello', ...this.helloPayload });
      }
      if (this.activeWorldName) {
        this.send({
          type: 'join_world',
          worldName: this.activeWorldName,
          resumePosition: this.lastLocalPose,
        });
      } else {
        this.flushPendingQueue();
      }
    };

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      this.lastMessageReceivedAt = Date.now();
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        if (msg.type === 'world_joined') {
          this.activeWorldName = msg.world.name;
          this.flushPendingQueue();
        } else if (msg.type === 'welcome' && !this.activeWorldName) {
          this.flushPendingQueue();
        }
        this.listeners.forEach((cb) => cb(msg));
      } catch {
        // Ignore malformed server frame
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stopHeartbeat();
      this.setConnectedState(false);
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };
  }

  updateLocalPose(pose: ResumePosition) {
    this.lastLocalPose = pose;
  }

  getActiveWorldName(): string | null {
    return this.activeWorldName;
  }

  joinWorld(worldName: string, resumePosition?: ResumePosition) {
    const clean = worldName.trim().toUpperCase();
    if (this.activeWorldName !== clean) {
      this.lastLocalPose = resumePosition;
    }
    this.activeWorldName = clean;
    this.send({
      type: 'join_world',
      worldName: clean,
      resumePosition: resumePosition ?? this.lastLocalPose,
    });
  }

  leaveWorld() {
    this.activeWorldName = null;
    this.lastLocalPose = undefined;
    this.send({ type: 'leave_world' });
  }

  send(msg: ClientMessage) {
    if (msg.type === 'move') {
      this.lastLocalPose = {
        x: msg.x,
        y: msg.y,
        vx: msg.vx,
        vy: msg.vy,
        facing: msg.facing,
        grounded: msg.grounded,
      };
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    // Buffer discrete user actions during brief reconnect windows
    if (
      msg.type !== 'move' &&
      msg.type !== 'ping' &&
      msg.type !== 'hello' &&
      msg.type !== 'join_world'
    ) {
      this.pendingQueue.push({ msg, queuedAt: Date.now() });
      if (this.pendingQueue.length > 32) {
        this.pendingQueue.shift();
      }
    }
    if (this.helloPayload && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
      this.scheduleReconnect();
    }
  }

  onMessage(cb: (msg: ServerMessage) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onStatus(cb: (connected: boolean) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  disconnect() {
    this.stopHeartbeat();
    this.unbindBrowserLifecycle();
    if (this.reconnectTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.helloPayload = null;
    this.activeWorldName = null;
    this.lastLocalPose = undefined;
    this.pendingQueue = [];
    this.setConnectedState(false);
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }
}
