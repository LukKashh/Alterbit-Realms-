import type {
  AreaLockRecord,
  AtmMachineRecord,
  DoorLinkRecord,
  ShareLockRecord,
  BfgCollectorRecord,
  FurnaceRecord,
  MatteragenRecord,
  PlantedTree,
  SeedPotRecord,
  VaultboxRecord,
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

  zoneId?: string;
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
  lastSeen?: number;
  width?: number;
  height?: number;
  isPersonalRealm?: boolean;
  worldLevel?: number;
  worldXp?: number;
}

export interface AdminPlayerProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  level: number;
  xp: number;
  gems: number;
  alterbits: number;
  pixobytes?: number;
  cropMasteryLevel: number;
  cropMasteryXp: number;
  farmablockMasteryLevel: number;
  farmablockMasteryXp: number;
  unclaimedWl: number;
  ownedWorldName: string | null;
  inventoryCount: number;
  inventorySlots: number;
  equipped?: EquippedWearables;
  stats: Record<string, number>;
  claimedAchievementsCount: number;
  totalAchievementsCount: number;
  favoriteWorlds: string[];
  recentWorlds: string[];
  createdAt: number | null;
  isOnline: boolean;
  currentWorldName: string | null;
  lastSeenAt: number | null;
}

export interface WorldEntityDescriptor {
  entityId: string;
  kind: 'player' | 'npc';
  name: string;
  tx: number;
  ty: number;
  itemId?: number;
  role?: UserRole;
  level?: number;
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
  alterbits: number;
  pixobytes?: number;
  xp: number;
  level: number;
  cropMasteryXp: number;
  cropMasteryLevel: number;
  farmablockMasteryXp: number;
  farmablockMasteryLevel: number;
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
  hasClaimedStarterLootbox?: boolean;
}

export interface PublicPlayerProfile {
  playerId: string;
  playerName: string;
  role: UserRole;
  level: number;
  cropMasteryLevel: number;
  cropMasteryXp: number;
  farmablockMasteryLevel: number;
  farmablockMasteryXp: number;
  ownedWorldName: string | null;
  claimedAchievementsCount: number;
  totalAchievementsCount: number;
  equipped: EquippedWearables;
}

export interface ResumePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
}

export interface ClientMessageMeta {
  ackId?: string;
  clientRevision?: number;
  sessionToken?: string;
}

export type ClientMessagePayload =
  | { type: 'hello'; token: string }
  | { type: 'ping'; clientTime: number; clientRevision?: number }
  | { type: 'join_world'; worldName: string; resumePosition?: ResumePosition }
  | { type: 'create_world'; worldName: string; terraBlast?: boolean }
  | { type: 'leave_world' }
  | { type: 'use_entrance_portal' }

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
  | { type: 'punch_tile'; tx: number; ty: number; toolItemId?: number; adminEdit?: boolean }
  | { type: 'place_tile'; tx: number; ty: number; itemId: number; adminEdit?: boolean }
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
      action:
        | 'grant_item'
        | 'grant_gems'
        | 'clear_inventory'
        | 'delete_inventory_slot'
        | 'grow_all_trees'
        | 'reset_config'
        | 'rebuild_nexus'
        | 'sys_paint_tile'
        | 'sys_clear_tile'
        | 'sys_fill_rect'
        | 'sys_set_spawn'
        | 'sys_reset_world';
      itemId?: number;
      qty?: number;
      gems?: number;
      slotIndex?: number;
      rodInstanceId?: string;
      tx?: number;
      ty?: number;
      tx2?: number;
      ty2?: number;
      layer?: 'fg' | 'bg' | 'both';
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
  | { type: 'upgrade_matteragen'; tx: number; ty: number }
  | { type: 'claim_matteragen'; tx: number; ty: number }
  | { type: 'unlock_worldcore_furnace' }
  | { type: 'unlock_worldcore_vaultbox'; tx: number; ty: number }
  | { type: 'inspect_player'; targetPlayerId: string }
  | { type: 'trash_inventory_item'; itemId: number; qty?: number; rodInstanceId?: string }
  | {
      type: 'configure_vaultbox';
      tx: number;
      ty: number;
      action: 'deposit' | 'withdraw';
      itemId?: number;
      qty?: number;
      slotIndex?: number;
      invIndex?: number;
    }
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
    }
  | { type: 'plow_tile'; tx: number; ty: number; adminEdit?: boolean }
  | {
      type: 'vendor_action';
      action:
        | 'reclaim_hoe'
        | 'buy_hoe'
        | 'buy_seed'
        | 'sell_crop'
        | 'sell_all_crops'
        | 'sell_cart'
        | 'buy_pixobyte';
      itemId?: number;
      qty?: number;
      currency?: 'gems' | 'alterbits' | 'digibits';
      cart?: Array<{ itemId: number; qty: number }>;
    }
  | {
      type: 'configure_door';
      tx: number;
      ty: number;
      targetX: number;
      targetY: number;
      label?: string;
    }
  | { type: 'use_door'; tx: number; ty: number }
  | { type: 'nexus_teleport'; targetX: number; targetY: number; label?: string }
  | { type: 'admin_list_entities' }
  | {
      type: 'admin_teleport_entity';
      entityKind: 'player' | 'npc';
      entityId: string;
      targetTx?: number;
      targetTy?: number;
      summon?: boolean;
    };

export type ClientMessage = ClientMessagePayload & ClientMessageMeta;

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      playerName: string;
      email: string;
      role: UserRole;
      gems: number;
      alterbits: number;
      pixobytes?: number;
      xp: number;
      level: number;
      cropMasteryXp: number;
      cropMasteryLevel: number;
      farmablockMasteryXp: number;
      farmablockMasteryLevel: number;
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
      hasClaimedStarterLootbox?: boolean;
      gameConfig: GameConfig;
      exchange: ExchangeSnapshot;
      sessionToken?: string;
    }
  | {
      type: 'pong';
      clientTime: number;
      serverTime: number;
      worldName?: string | null;
      worldRevision?: number | null;
      playerCount?: number;
      authenticated?: boolean;
      sessionExpiresAt?: number | null;
    }
  | {
      type: 'action_ack';
      ackId: string;
      actionType: ClientMessagePayload['type'];
      ok: boolean;
      serverTime: number;
      worldName: string | null;
      worldRevision: number | null;
      pose?: ResumePosition;
      errorMessage?: string;
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
      seedPot?: SeedPotRecord | null;
      matteragenEngine?: MatteragenRecord | null;
      atmMachine?: AtmMachineRecord | null;
      vaultbox?: VaultboxRecord | null;
      signText?: string | null;
      doorLink?: DoorLinkRecord | null;
      revision: number;
    }
  | { type: 'fluid_delta'; deltas: FluidDelta[] }
  | { type: 'drop_spawned'; drop: WorldDrop }
  | { type: 'drop_removed'; dropId: string }
  | {
      type: 'profile_updated';
      gems: number;
      alterbits: number;
      pixobytes?: number;
      xp: number;
      level: number;
      cropMasteryXp: number;
      cropMasteryLevel: number;
      farmablockMasteryXp: number;
      farmablockMasteryLevel: number;
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
      hasClaimedStarterLootbox?: boolean;
      notice?: string;
    }
  | { type: 'player_profile'; profile: PublicPlayerProfile }
  | { type: 'world_xp_updated'; worldName: string; worldXp: number; worldLevel: number; coreTokens?: number; hasFurnaceExpansion?: boolean; hasVaultboxExpansion?: boolean }
  | { type: 'player_teleported'; tx: number; ty: number; notice?: string }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'worlds_list'; worlds: WorldSummary[] }
  | { type: 'fishing_started'; cast: FishingCastState }
  | { type: 'fishing_bite'; playerId: string; bobberTx: number; bobberTy: number; depthTier: LiquidPoolInfo['depthTier'] }
  | { type: 'fishing_progress'; playerId: string; progress: number; lineTension: number; bobberOffset: number; fightPattern: FishFightPattern }
  | { type: 'fishing_ended'; playerId: string; caughtItemId?: number; caughtName?: string; depthTier?: LiquidPoolInfo['depthTier'] }
  | { type: 'exchange_updated'; exchange: ExchangeSnapshot }
  | { type: 'mine_shaft_expired'; worldName: string; message: string }
  | {
      type: 'world_entities';
      worldName: string;
      worldWidth: number;
      worldHeight: number;
      adminTx: number;
      adminTy: number;
      entities: WorldEntityDescriptor[];
      notice?: string;
    };

interface QueuedClientMessage {
  msg: ClientMessage;
  queuedAt: number;
}

interface PendingAckRecord {
  type: ClientMessagePayload['type'];
  sentAt: number;
  worldName: string | null;
}

export class GameSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(msg: ServerMessage) => void>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempts = 0;
  private lastMessageReceivedAt = 0;
  private lastPongAt = 0;
  private latencyMs: number | null = null;
  private helloPayload: { token: string } | null = null;
  private wsSessionToken: string | null = null;
  private activeWorldName: string | null = null;
  private currentWorldRevision = 0;
  private lastLocalPose: ResumePosition | undefined = undefined;
  private pendingQueue: QueuedClientMessage[] = [];
  private pendingAcks = new Map<string, PendingAckRecord>();
  private nextAckSeq = 1;
  private lastAckTimeoutCheckAt = 0;
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
      // Immediately verify liveness and world revision when tab returns to foreground
      this.sendHeartbeatPing();
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
    const cleanToken = token.trim();
    if (!cleanToken) return;
    this.bindBrowserLifecycle();
    this.helloPayload = { token: cleanToken };
    this.wsSessionToken = null;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'hello', token: cleanToken }));
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
    this.pendingAcks.clear();
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

  private sendHeartbeatPing() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'ping',
        clientTime: Date.now(),
        clientRevision: this.currentWorldRevision,
        ...(this.wsSessionToken ? { sessionToken: this.wsSessionToken } : {}),
      })
    );
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    if (typeof window === 'undefined') return;
    this.lastMessageReceivedAt = Date.now();
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        if (this.helloPayload && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.setConnectedState(false);
          this.reconnectNow();
        }
        return;
      }

      const now = Date.now();
      const silenceMs = now - this.lastMessageReceivedAt;
      if (silenceMs > 12000) {
        // Stale half-open connection detected — force reconnect
        this.reconnectNow();
        return;
      }

      // Check for overdue unacknowledged client actions
      let oldestDiscreteAckAge = 0;
      for (const [ackId, rec] of this.pendingAcks.entries()) {
        const age = now - rec.sentAt;
        if (age > 10000) {
          this.pendingAcks.delete(ackId);
          continue;
        }
        if (rec.type !== 'move' && age > oldestDiscreteAckAge) {
          oldestDiscreteAckAge = age;
        }
      }

      if (oldestDiscreteAckAge > 5500 && now - this.lastAckTimeoutCheckAt > 4000) {
        this.lastAckTimeoutCheckAt = now;
        if (this.activeWorldName) {
          this.joinWorld(this.activeWorldName, this.lastLocalPose);
        }
      }

      this.sendHeartbeatPing();
    }, 3000);
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

  private prepareOutboundMessage(msg: ClientMessage): ClientMessage {
    if (msg.type === 'hello' || msg.type === 'ping') {
      return msg;
    }
    const ackId = msg.ackId ?? `ack_${this.nextAckSeq++}_${Date.now().toString(36)}`;
    return {
      ...msg,
      ackId,
      clientRevision: msg.clientRevision ?? this.currentWorldRevision,
      ...(this.wsSessionToken ? { sessionToken: this.wsSessionToken } : {}),
    };
  }

  private trackPendingAck(msg: ClientMessage) {
    if (!msg.ackId || msg.type === 'hello' || msg.type === 'ping') return;
    this.pendingAcks.set(msg.ackId, {
      type: msg.type,
      sentAt: Date.now(),
      worldName: this.activeWorldName,
    });
    if (this.pendingAcks.size > 256) {
      const oldestKey = this.pendingAcks.keys().next().value;
      if (oldestKey) this.pendingAcks.delete(oldestKey);
    }
  }

  private flushPendingQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.pendingQueue.length === 0) return;
    const cutoff = Date.now() - 15000;
    const items = this.pendingQueue.splice(0, this.pendingQueue.length);
    for (const item of items) {
      if (item.queuedAt >= cutoff) {
        const prepared = this.prepareOutboundMessage(item.msg);
        this.trackPendingAck(prepared);
        this.ws.send(JSON.stringify(prepared));
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
      this.wsSessionToken = null;
      this.setConnectedState(true);
      this.startHeartbeat();
      if (this.helloPayload) {
        ws.send(JSON.stringify({ type: 'hello', token: this.helloPayload.token }));
      }
    };

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      this.lastMessageReceivedAt = Date.now();
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        if (msg.type === 'welcome') {
          this.wsSessionToken = msg.sessionToken ?? null;
          if (this.activeWorldName) {
            this.send({
              type: 'join_world',
              worldName: this.activeWorldName,
              resumePosition: this.lastLocalPose,
            });
          } else {
            this.flushPendingQueue();
          }
        } else if (msg.type === 'world_joined') {
          this.activeWorldName = msg.world.name;
          this.currentWorldRevision = msg.world.revision ?? 0;
          this.pendingAcks.clear();
          this.flushPendingQueue();
        } else if (msg.type === 'tile_updated') {
          if (typeof msg.revision === 'number' && msg.revision > this.currentWorldRevision) {
            this.currentWorldRevision = msg.revision;
          }
        } else if (msg.type === 'action_ack') {
          this.pendingAcks.delete(msg.ackId);
        } else if (msg.type === 'pong') {
          this.lastPongAt = Date.now();
          this.latencyMs = Math.max(0, this.lastPongAt - msg.clientTime);
          if (msg.authenticated === false && this.helloPayload) {
            ws.send(JSON.stringify({ type: 'hello', token: this.helloPayload.token }));
          }
        } else if (msg.type === 'auth_error') {
          this.wsSessionToken = null;
          this.helloPayload = null;
          this.pendingAcks.clear();
        }
        this.listeners.forEach((cb) => cb(msg));
      } catch {
        // Ignore malformed server frame
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.wsSessionToken = null;
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

  getConnectionDiagnostics() {
    return {
      connected: this.connected,
      readyState: this.ws?.readyState ?? WebSocket.CLOSED,
      latencyMs: this.latencyMs,
      lastPongAt: this.lastPongAt,
      pendingAckCount: this.pendingAcks.size,
      worldRevision: this.currentWorldRevision,
      hasSessionToken: Boolean(this.wsSessionToken),
    };
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
    this.currentWorldRevision = 0;
    this.pendingAcks.clear();
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
    const prepared = this.prepareOutboundMessage(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.wsSessionToken) {
      this.trackPendingAck(prepared);
      this.ws.send(JSON.stringify(prepared));
      return;
    }
    // Buffer discrete user actions during brief reconnect windows
    if (
      prepared.type !== 'move' &&
      prepared.type !== 'ping' &&
      prepared.type !== 'hello' &&
      prepared.type !== 'join_world'
    ) {
      this.pendingQueue.push({ msg: prepared, queuedAt: Date.now() });
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
    this.wsSessionToken = null;
    this.activeWorldName = null;
    this.currentWorldRevision = 0;
    this.lastLocalPose = undefined;
    this.pendingQueue = [];
    this.pendingAcks.clear();
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
