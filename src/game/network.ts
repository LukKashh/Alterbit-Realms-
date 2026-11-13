import type {
  AreaLockRecord,
  PlantedTree,
  VendingMachineRecord,
  WorldLockRecord,
  WorldState,
} from './worldGen.ts';
import type { EquippedWearables } from './pixelArt.ts';
import type { PlayerStatKey } from './catalog.ts';
import type { GameConfig } from './config.ts';

export type UserRole = 'player' | 'admin';

export interface InventorySlot {
  itemId: number;
  qty: number;
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
}

export type ClientMessage =
  | { type: 'hello'; token?: string; playerId?: string; playerName?: string }
  | { type: 'join_world'; worldName: string }
  | { type: 'leave_world' }
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
  | { type: 'punch_tile'; tx: number; ty: number }
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
      gameConfig: GameConfig;
    }
  | { type: 'auth_error'; message: string }
  | { type: 'config_updated'; gameConfig: GameConfig; notice?: string }
  | {
      type: 'world_joined';
      world: WorldState;
      players: RemotePlayerState[];
      drops: WorldDrop[];
      chatHistory: ChatMessage[];
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
      plant: PlantedTree | null;
      worldLock?: WorldLockRecord | null;
      areaLock?: AreaLockRecord | null;
      vendingMachine?: VendingMachineRecord | null;
      signText?: string | null;
      revision: number;
    }
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
      notice?: string;
    }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'worlds_list'; worlds: WorldSummary[] };

export class GameSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(msg: ServerMessage) => void>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private reconnectTimer: number | null = null;
  private helloPayload: { token?: string; playerId?: string; playerName?: string } | null = null;
  private activeWorldName: string | null = null;
  public connected = false;

  connectWithToken(token: string) {
    this.helloPayload = { token };
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'hello', token });
      }
      return;
    }
    this.openSocket();
  }

  connect(playerId: string, playerName: string) {
    this.helloPayload = { playerId, playerName };
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'hello', playerId, playerName });
      }
      return;
    }
    this.openSocket();
  }

  private openSocket() {
    if (typeof window === 'undefined') return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.statusListeners.forEach((cb) => cb(true));
      if (this.helloPayload) {
        this.send({ type: 'hello', ...this.helloPayload });
      }
      if (this.activeWorldName) {
        this.send({ type: 'join_world', worldName: this.activeWorldName });
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        this.listeners.forEach((cb) => cb(msg));
      } catch {
        // Ignore malformed server frame
      }
    };

    ws.onclose = () => {
      this.connected = false;
      this.statusListeners.forEach((cb) => cb(false));
      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer);
      }
      this.reconnectTimer = window.setTimeout(() => {
        if (this.helloPayload) {
          this.openSocket();
        }
      }, 1500);
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };
  }

  joinWorld(worldName: string) {
    this.activeWorldName = worldName;
    this.send({ type: 'join_world', worldName });
  }

  leaveWorld() {
    this.activeWorldName = null;
    this.send({ type: 'leave_world' });
  }

  send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.helloPayload = null;
    this.activeWorldName = null;
    this.ws?.close();
    this.ws = null;
  }
}
