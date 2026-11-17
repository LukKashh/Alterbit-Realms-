import { useCallback, useEffect, useRef, useState } from 'react';
import { BlockgroveEngine, type TileInspectInfo } from './game/engine.ts';
import {
  GameSocketClient,
  type ActiveBuff,
  type AuthUserProfile,
  type ChatMessage,
  type ExchangeSnapshot,
  type FishingCastState,
  type FriendEntry,
  type FriendRequestEntry,
  type InventorySlot,
  type PublicPlayerProfile,
  type UserRole,
  type WorldSummary,
} from './game/network.ts';
import { getItemDef, ITEM_IDS, type PlayerStatKey } from './game/catalog.ts';
import {
  DEFAULT_VIEW_SCALE,
  MAX_PLAYER_ZOOM,
  MIN_PLAYER_ZOOM,
  TILE_SIZE,
} from './game/constants.ts';
import { resolveUnifiedViewScale, useViewportOrientation } from './game/orientation.ts';
import { cloneGameConfig, DEFAULT_GAME_CONFIG, type GameConfig } from './game/config.ts';
import { sortInventorySlots } from './game/rules.ts';
import type { EquippedWearables } from './game/pixelArt.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx';
import { ModeSelection } from './components/ModeSelection.tsx';
import { GameHud } from './components/GameHud.tsx';
import { soundEngine } from './game/audio.ts';
import { testFirestoreConnection } from './lib/firebase.ts';
import {
  publishWorldPresence,
  subscribeWorldPresence,
  syncUserToFirestore,
  syncWorldToFirestore,
} from './lib/firebaseSync.ts';

type AppState = 'auth' | 'loading' | 'hub' | 'playing' | 'paused';

const TOKEN_STORAGE_KEY = 'blockgrove_auth_token';
const ZOOM_STORAGE_KEY = 'bg_player_zoom';

function makeTxId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_STATS: Record<PlayerStatKey, number> = {
  blocksBroken: 0,
  blocksPlaced: 0,
  treesHarvested: 0,
  seedsSpliced: 0,
  storePurchases: 0,
  vendingTrades: 0,
  locksPlaced: 0,
  friendsAdded: 0,
  oresMined: 0,
  fishCaught: 0,
  itemsSmelted: 0,
  exchangeTrades: 0,
};



const DEFAULT_EXCHANGE: ExchangeSnapshot = {
  listings: [],
  priceStats: {},
  totalWlBurned: 0,
  totalGemsCleared: 0,
};

const EMPTY_HOTBAR = [
  ITEM_IDS.FIST,
  ITEM_IDS.AIR,
  ITEM_IDS.AIR,
  ITEM_IDS.AIR,
  ITEM_IDS.AIR,
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BlockgroveEngine | null>(null);
  const socketRef = useRef<GameSocketClient | null>(null);
  const modeRef = useRef<AppState>('auth');
  const playerIdRef = useRef<string>('');

  const [appState, setAppState] = useState<AppState>('auth');
  const [loadingText, setLoadingText] = useState<{ title: string; subtitle?: string }>({
    title: 'Loading Blockgrove...',
    subtitle: 'Connecting to world servers',
  });
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('Explorer');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<UserRole>('player');
  const [worldName, setWorldName] = useState<string>('NEXUS');
  const [worldOwner, setWorldOwner] = useState<string | null>(null);
  const [worldOwnerId, setWorldOwnerId] = useState<string | null>(null);
  const [worldKind, setWorldKind] = useState<'standard' | 'mine_shaft'>('standard');
  const [mineExpiresAt, setMineExpiresAt] = useState<number | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [serverRevision, setServerRevision] = useState<number>(0);
  const [coords, setCoords] = useState<{ tx: number; ty: number }>({ tx: 50, ty: 29 });
  const [gems, setGems] = useState<number>(0);
  const [alterbits, setAlterbits] = useState<number>(0);
  const [pixobytes, setPixobytes] = useState<number>(0);
  const [hasClaimedStarterLootbox, setHasClaimedStarterLootbox] = useState<boolean>(false);
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [worldXp, setWorldXp] = useState<number>(0);
  const [worldLevel, setWorldLevel] = useState<number>(1);
  const [worldCoreTokens, setWorldCoreTokens] = useState<number>(0);
  const [worldHasFurnaceExpansion, setWorldHasFurnaceExpansion] = useState<boolean>(false);
  const [worldHasVaultboxExpansion, setWorldHasVaultboxExpansion] = useState<boolean>(false);
  const [vaultboxPlacementActive, setVaultboxPlacementActive] = useState<boolean>(false);
  const [cropMasteryXp, setCropMasteryXp] = useState<number>(0);
  const [cropMasteryLevel, setCropMasteryLevel] = useState<number>(1);
  const [farmablockMasteryXp, setFarmablockMasteryXp] = useState<number>(0);
  const [farmablockMasteryLevel, setFarmablockMasteryLevel] = useState<number>(1);
  const [publicProfile, setPublicProfile] = useState<PublicPlayerProfile | null>(null);
  const [inventory, setInventory] = useState<InventorySlot[]>([
    { itemId: ITEM_IDS.FIST, qty: 1 },
    { itemId: ITEM_IDS.WRENCH, qty: 1 },
  ]);
  const [equipped, setEquipped] = useState<EquippedWearables>({});
  const [stats, setStats] = useState<Record<PlayerStatKey, number>>(DEFAULT_STATS);
  const [claimedAchievements, setClaimedAchievements] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestEntry[]>([]);
  const [favoriteWorlds, setFavoriteWorlds] = useState<string[]>(['NEXUS']);
  const [recentWorlds, setRecentWorlds] = useState<string[]>(['NEXUS']);
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuff[]>([]);
  const [unclaimedWl, setUnclaimedWl] = useState<number>(0);
  const [exchangeSnapshot, setExchangeSnapshot] = useState<ExchangeSnapshot>(DEFAULT_EXCHANGE);
  const [fishingCast, setFishingCast] = useState<FishingCastState | null>(null);
  const [fishingBiting, setFishingBiting] = useState<boolean>(false);
  const [fishingProgress, setFishingProgress] = useState<number>(0);
  const [fishingLineTension, setFishingLineTension] = useState<number>(0.15);
  const [fishingFightPattern, setFishingFightPattern] = useState<'darting' | 'surging' | 'deep_run' | 'erratic'>('darting');
  const [hotbarItemIds, setHotbarItemIds] = useState<number[]>(EMPTY_HOTBAR);
  const [selectedItemId, setSelectedItemId] = useState<number>(ITEM_IDS.FIST);
  const [gameConfig, setGameConfig] = useState<GameConfig>(() => cloneGameConfig(DEFAULT_GAME_CONFIG));
  const [muted, setMuted] = useState<boolean>(false);
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(pointer: coarse)').matches ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
      : false
  );
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [worldEntities, setWorldEntities] = useState<import('./components/AdminEntityPanel.tsx').WorldEntitiesSnapshot | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inspectInfo, setInspectInfo] = useState<TileInspectInfo | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [adminWorldEdit, setAdminWorldEdit] = useState<boolean>(false);
  const [adminBrushItemId, setAdminBrushItemId] = useState<number | null>(null);
  const orientation = useViewportOrientation();
  const [viewZoom, setViewZoom] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= MIN_PLAYER_ZOOM && saved <= MAX_PLAYER_ZOOM) {
        return resolveUnifiedViewScale(saved, DEFAULT_VIEW_SCALE);
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_VIEW_SCALE;
  });



  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  }, []);

  const syncHotbarWithInventory = useCallback((inv: InventorySlot[]) => {
    setHotbarItemIds((prev) => {
      const next = prev.slice(0, EMPTY_HOTBAR.length);
      while (next.length < EMPTY_HOTBAR.length) {
        next.push(ITEM_IDS.AIR);
      }
      next[0] = prev[0] === ITEM_IDS.WRENCH ? ITEM_IDS.WRENCH : ITEM_IDS.FIST;

      // Clear hotbar quick slots 2..5 if quantity dropped to 0 or item ID was pruned from CATALOG
      for (let i = 1; i < next.length; i++) {
        const id = next[i];
        if (
          id !== ITEM_IDS.AIR &&
          (!getItemDef(id) || !inv.some((s) => s.itemId === id && s.qty > 0))
        ) {
          next[i] = ITEM_IDS.AIR;
        }
      }

      // Auto-populate empty quick slots 2..5 with newly acquired placeables, tools, or consumables
      for (const slot of inv) {
        if (slot.qty <= 0 || slot.itemId === ITEM_IDS.FIST || slot.itemId === ITEM_IDS.WRENCH) continue;
        const def = getItemDef(slot.itemId);
        if (
          !def ||
          def.category === 'wearable' ||
          (!def.placeable &&
            def.toolKind !== 'pickaxe' &&
            def.toolKind !== 'rod' &&
            def.toolKind !== 'hoe' &&
            def.category !== 'consumable')
        ) {
          continue;
        }
        if (next.includes(slot.itemId)) continue;
        const emptyIdx = next.findIndex((id, idx) => idx >= 1 && id === ITEM_IDS.AIR);
        if (emptyIdx !== -1) {
          next[emptyIdx] = slot.itemId;
        }
      }
      return next;
    });
  }, []);

  const applyUserProfile = useCallback(
    (user: AuthUserProfile) => {
      playerIdRef.current = user.playerId;
      setPlayerId(user.playerId);
      setPlayerName(user.playerName);
      setEmail(user.email);
      setRole(user.role);
      setGems(user.gems);
      setAlterbits(user.alterbits ?? 0);
      setPixobytes(user.pixobytes ?? 0);
      setHasClaimedStarterLootbox(Boolean(user.hasClaimedStarterLootbox));
      setXp(user.xp);
      setLevel(user.level);
      setCropMasteryXp(user.cropMasteryXp ?? 0);
      setCropMasteryLevel(user.cropMasteryLevel ?? 1);
      setFarmablockMasteryXp(user.farmablockMasteryXp ?? 0);
      setFarmablockMasteryLevel(user.farmablockMasteryLevel ?? 1);
      const cleanInv = sortInventorySlots(
        (user.inventory ?? []).filter((s) => Boolean(getItemDef(s.itemId)))
      );
      setInventory(cleanInv);
      syncHotbarWithInventory(cleanInv);
      setEquipped(user.equipped);
      setStats({ ...DEFAULT_STATS, ...user.stats });
      setClaimedAchievements(user.claimedAchievements);
      setFriends(user.friends);
      setIncomingRequests(user.incomingRequests);
      setFavoriteWorlds(user.favoriteWorlds?.length ? user.favoriteWorlds : ['NEXUS']);
      setRecentWorlds(user.recentWorlds?.length ? user.recentWorlds : ['NEXUS']);
      const buffs = user.activeBuffs ?? [];
      setActiveBuffs(buffs);
      setUnclaimedWl(user.unclaimedWl ?? 0);
      engineRef.current?.setLocalIdentity(
        user.playerId,
        user.playerName,
        '#3f8fd9',
        user.equipped,
        user.role
      );
      engineRef.current?.setActiveBuffs(buffs);
      if (user.role !== 'admin') {
        setAdminWorldEdit(false);
        setAdminBrushItemId(null);
        engineRef.current?.setAdminWorldEdit(false, null);
      }
      void syncUserToFirestore(user, socketRef.current?.getActiveWorldName() ?? '').catch(() => {});
    },
    [syncHotbarWithInventory]
  );

  // Sync body dataset state, engine mode & menu/world theme audio
  useEffect(() => {
    modeRef.current = appState;
    document.body.dataset.state = appState;
    if (appState === 'playing') {
      engineRef.current?.setMode('playing');
      soundEngine.startWorldTheme();
    } else if (appState === 'paused') {
      engineRef.current?.setMode('paused');
      soundEngine.startMenuTheme();
    } else {
      engineRef.current?.setMode('title');
      soundEngine.startMenuTheme();
    }
  }, [appState]);
  useEffect(() => {
    const unified = resolveUnifiedViewScale(viewZoom, DEFAULT_VIEW_SCALE);
    engineRef.current?.setPlayerZoomScale(unified);
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(unified));
    } catch {
      // ignore storage errors
    }
  }, [viewZoom, orientation]);

  useEffect(() => {
    engineRef.current?.setVaultboxPlacementMode(vaultboxPlacementActive);
  }, [vaultboxPlacementActive]);

  useEffect(() => {
    if (appState !== 'playing' && appState !== 'paused') return;
    const engine = engineRef.current;
    const socket = socketRef.current;
    if (!engine || !socket) return;
    const clientRev = engine.getWorldRevision();
    if (serverRevision - clientRev > 2) {
      const wName = engine.getWorldState().name;
      if (wName) {
        socket.joinWorld(wName, engine.getLocalPose());
      }
    }
  }, [serverRevision, appState]);


  const fetchWorldsList = useCallback(async () => {
    try {
      const res = await fetch('/api/worlds');
      if (res.ok) {
        const data = (await res.json()) as { worlds: WorldSummary[] };
        setWorlds(data.worlds);
      }
    } catch {
      // ignore transient network glitch
    }
  }, []);

  const fetchExchangeSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/exchange');
      if (res.ok) {
        const data = (await res.json()) as { exchange: ExchangeSnapshot };
        if (data.exchange) setExchangeSnapshot(data.exchange);
      }
    } catch {
      // ignore transient network glitch
    }
  }, []);

  // Mount isolated Canvas2D engine + WebSocket client once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    // Sanitize legacy client localStorage state on schema v2 upgrade
    try {
      const schemaVersion = localStorage.getItem('blockgrove_client_schema_v');
      if (schemaVersion !== '2') {
        localStorage.removeItem('blockgrove_hotbar');
        localStorage.removeItem('blockgrove_last_world');
        localStorage.setItem('blockgrove_client_schema_v', '2');
      }
    } catch {
      // ignore storage errors
    }

    void testFirestoreConnection();

    const socket = new GameSocketClient();
    socketRef.current = socket;

    const engine = new BlockgroveEngine(mount, {
      onMoveSync: (state) => socket.send({ type: 'move', ...state }),
      onPunchTile: (tx, ty, toolItemId, adminEdit) =>
        socket.send({ type: 'punch_tile', tx, ty, toolItemId, ...(adminEdit ? { adminEdit: true } : {}) }),
      onPlaceTile: (tx, ty, itemId, adminEdit) =>
        socket.send({ type: 'place_tile', tx, ty, itemId, ...(adminEdit ? { adminEdit: true } : {}) }),
      onPlowTile: (tx, ty, adminEdit) =>
        socket.send({ type: 'plow_tile', tx, ty, ...(adminEdit ? { adminEdit: true } : {}) }),
      onPickupDrop: (dropId) => socket.send({ type: 'pickup_drop', dropId }),
      onInspectTile: (info) => setInspectInfo(info),
      onInspectPlayer: (targetPlayerId) =>
        socket.send({ type: 'inspect_player', targetPlayerId }),
      onCoordsChange: (tx, ty) => setCoords({ tx, ty }),
      onCastFishing: (tx, ty, rodItemId) =>
        socket.send({ type: 'cast_fishing', tx, ty, rodItemId }),
      onReelFishing: () => socket.send({ type: 'reel_fishing' }),
      onUseConsumable: (itemId) => socket.send({ type: 'use_consumable', itemId }),
      onUseDoor: (tx, ty) => socket.send({ type: 'use_door', tx, ty }),
      onUseEntrancePortal: () => socket.send({ type: 'use_entrance_portal' }),
      onPlaceWorldCoreVaultbox: (tx, ty) => {
        setVaultboxPlacementActive(false);
        socket.send({ type: 'unlock_worldcore_vaultbox', tx, ty });
      },
      onHazardHit: (hazard) =>
        engineRef.current?.queuePlayerAnnouncement(
          hazard === 'acid' ? 'Burned by Acid!' : 'Hit Spikes!',
          'ruby'
        ),
    });
    engineRef.current = engine;
    engine.setPlayerZoomScale(viewZoom);
    engine.setMode('title');

    let wasDisconnectedWhilePlaying = false;
    const unsubStatus = socket.onStatus((isConn) => {
      setConnected(isConn);
      if (!isConn && (modeRef.current === 'playing' || modeRef.current === 'paused')) {
        wasDisconnectedWhilePlaying = true;
      } else if (isConn && wasDisconnectedWhilePlaying) {
        wasDisconnectedWhilePlaying = false;
        showToast('Reconnected to live world state.');
      }
    });
    const unsubMsg = socket.onMessage((msg) => {
      switch (msg.type) {
        case 'welcome':
          applyUserProfile({
            playerId: msg.playerId,
            playerName: msg.playerName,
            email: msg.email,
            role: msg.role,
            gems: msg.gems,
            alterbits: msg.alterbits ?? 0,
            pixobytes: msg.pixobytes ?? 0,
            xp: msg.xp,
            level: msg.level,
            cropMasteryXp: msg.cropMasteryXp ?? 0,
            cropMasteryLevel: msg.cropMasteryLevel ?? 1,
            farmablockMasteryXp: msg.farmablockMasteryXp ?? 0,
            farmablockMasteryLevel: msg.farmablockMasteryLevel ?? 1,
            inventory: msg.inventory,
            equipped: msg.equipped,
            stats: msg.stats,
            claimedAchievements: msg.claimedAchievements,
            friends: msg.friends,
            incomingRequests: msg.incomingRequests,
            favoriteWorlds: msg.favoriteWorlds,
            recentWorlds: msg.recentWorlds,
            activeBuffs: msg.activeBuffs,
            unclaimedWl: msg.unclaimedWl,
            hasClaimedStarterLootbox: msg.hasClaimedStarterLootbox,
          });
          setGameConfig(msg.gameConfig);
          engine.applyGameConfig(msg.gameConfig);
          if (msg.exchange) setExchangeSnapshot(msg.exchange);
          break;
        case 'pong':
          if (typeof msg.playerCount === 'number') {
            setPlayerCount(msg.playerCount);
          }
          if (
            msg.worldName &&
            typeof msg.worldRevision === 'number' &&
            (modeRef.current === 'playing' || modeRef.current === 'paused') &&
            engine.getWorldState().name === msg.worldName
          ) {
            setServerRevision((prev) => Math.max(prev, msg.worldRevision!));
            if (engine.getWorldRevision() < msg.worldRevision) {
              socket.joinWorld(msg.worldName, engine.getLocalPose());
            }
          }
          break;
        case 'action_ack':
          if (
            msg.worldName &&
            typeof msg.worldRevision === 'number' &&
            engine.getWorldState().name === msg.worldName
          ) {
            setServerRevision((prev) => Math.max(prev, msg.worldRevision!));
          }
          if (
            msg.actionType === 'move' &&
            msg.ok &&
            msg.pose &&
            msg.worldName === engine.getWorldState().name
          ) {
            engine.reconcileServerPose(msg.pose);
          }
          break;
        case 'auth_error':
          try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
          } catch {
            // ignore
          }
          setErrorMessage(msg.message);
          setAppState('auth');
          break;
        case 'config_updated':
          setGameConfig(msg.gameConfig);
          engine.applyGameConfig(msg.gameConfig);
          if (msg.notice) engine.queuePlayerAnnouncement(msg.notice, 'info');
          break;
        case 'world_joined': {
          const isReconnectSameWorld =
            Boolean(msg.resumed) ||
            ((modeRef.current === 'playing' || modeRef.current === 'paused') &&
              engine.getWorldState().name === msg.world.name);
          setErrorMessage(null);
          if (!isReconnectSameWorld) {
            setInspectInfo(null);
            setPublicProfile(null);
            setWorldEntities(null);
          }
          setWorldName(msg.world.name);
          setWorldOwner(msg.world.worldLock?.ownerName ?? null);
          setWorldOwnerId(msg.world.worldLock?.ownerId ?? null);
          setWorldXp(msg.world.worldXp ?? 0);
          setWorldLevel(msg.world.worldLevel ?? 1);
          setWorldCoreTokens(msg.world.coreTokens ?? 0);
          setWorldHasFurnaceExpansion(Boolean(msg.world.hasFurnaceExpansion));
          setWorldHasVaultboxExpansion(Boolean(msg.world.hasVaultboxExpansion));
          if (!isReconnectSameWorld) setVaultboxPlacementActive(false);
          setWorldKind(msg.world.worldKind ?? 'standard');
          setMineExpiresAt(msg.world.expiresAt ?? null);
          setFishingCast(null);
          setFishingBiting(false);
          setFishingProgress(0);
          setPlayerCount(msg.players.length);
          setServerRevision(msg.world.revision ?? 0);
          setChatMessages(msg.chatHistory);
          engine.loadWorld(msg.world, msg.players, msg.drops, {
            preserveLocalPose: isReconnectSameWorld,
          });
          socket.updateLocalPose(engine.getLocalPose());
          if (modeRef.current !== 'paused') {
            engine.setMode('playing');
            setAppState('playing');
          }
          void syncWorldToFirestore(msg.world).catch(() => {});
          break;
        }
        case 'presence_sync':
          if (engine.getWorldState().name === msg.worldName) {
            engine.syncPresenceAndDrops(msg.players, msg.drops);
            setPlayerCount(msg.players.length);
            setServerRevision(msg.revision);
          }
          break;
        case 'world_error':
          if (modeRef.current === 'loading') {
            setAppState('hub');
            showToast(msg.message);
          } else if (modeRef.current === 'auth') {
            setErrorMessage(msg.message);
          } else {
            showToast(msg.message);
          }
          break;
        case 'player_joined':
          engine.addRemotePlayer(msg.player);
          setPlayerCount((c) => c + 1);
          break;
        case 'player_left':
          engine.removeRemotePlayer(msg.playerId);
          setPlayerCount((c) => Math.max(1, c - 1));
          break;
        case 'player_moved':
          engine.updateRemotePlayer(msg.player);
          break;
        case 'tile_damaged':
          engine.applyTileDamaged(msg.tx, msg.ty, msg.hits, msg.maxHits);
          break;
        case 'tile_updated':
          engine.applyTileUpdated(
            msg.tx,
            msg.ty,
            msg.fg,
            msg.bg,
            msg.plant,
            msg.worldLock,
            msg.areaLock,
            msg.shareLock,
            msg.vendingMachine,
            msg.signText,
            msg.fluidType,
            msg.fluidLevel,
            msg.furnace,
            msg.bfgCollector,
            msg.seedPot,
            msg.matteragenEngine,
            msg.atmMachine,
            msg.vaultbox,
            msg.doorLink,
            msg.revision
          );
          if (typeof msg.revision === 'number') {
            setServerRevision((prev) => Math.max(prev, msg.revision));
          }
          if (msg.worldLock !== undefined) {
            setWorldOwner(msg.worldLock?.ownerName ?? null);
            setWorldOwnerId(msg.worldLock?.ownerId ?? null);
          }
          setInspectInfo((cur) => {
            if (cur && cur.tx === msg.tx && cur.ty === msg.ty) {
              engine.emitInspectAt(msg.tx, msg.ty);
            }
            return cur;
          });
          break;
        case 'fluid_delta':
          engine.applyFluidDeltas(msg.deltas);
          break;
        case 'drop_spawned':
          engine.addDrop(msg.drop);
          break;
        case 'drop_removed':
          engine.removeDrop(msg.dropId);
          break;
        case 'profile_updated': {
          setGems(msg.gems);
          setAlterbits(msg.alterbits ?? 0);
          setPixobytes(msg.pixobytes ?? 0);
          if (msg.hasClaimedStarterLootbox !== undefined) {
            setHasClaimedStarterLootbox(Boolean(msg.hasClaimedStarterLootbox));
          }
          setXp(msg.xp);
          setLevel(msg.level);
          setCropMasteryXp(msg.cropMasteryXp ?? 0);
          setCropMasteryLevel(msg.cropMasteryLevel ?? 1);
          setFarmablockMasteryXp(msg.farmablockMasteryXp ?? 0);
          setFarmablockMasteryLevel(msg.farmablockMasteryLevel ?? 1);
          setRole(msg.role);
          setEmail(msg.email);
          const cleanInv = sortInventorySlots(
            (msg.inventory ?? []).filter((s) => Boolean(getItemDef(s.itemId)))
          );
          setInventory(cleanInv);
          syncHotbarWithInventory(cleanInv);
          setEquipped(msg.equipped);
          setStats({ ...DEFAULT_STATS, ...msg.stats });
          setClaimedAchievements(msg.claimedAchievements);
          setFriends(msg.friends);
          setIncomingRequests(msg.incomingRequests);
          setFavoriteWorlds(msg.favoriteWorlds?.length ? msg.favoriteWorlds : ['NEXUS']);
          setRecentWorlds(msg.recentWorlds?.length ? msg.recentWorlds : ['NEXUS']);
          setActiveBuffs(msg.activeBuffs ?? []);
          setUnclaimedWl(msg.unclaimedWl ?? 0);
          engine.setLocalEquipped(msg.equipped);
          engine.setActiveBuffs(msg.activeBuffs ?? []);
          if (msg.notice) engine.queuePlayerAnnouncement(msg.notice, 'info');
          break;
        }
        case 'world_xp_updated':
          if (engine.getWorldState().name === msg.worldName) {
            engine.updateWorldXp(
              msg.worldXp,
              msg.worldLevel,
              msg.coreTokens,
              msg.hasVaultboxExpansion
            );
            setWorldXp(msg.worldXp);
            setWorldLevel(msg.worldLevel);
            if (typeof msg.coreTokens === 'number') {
              setWorldCoreTokens(msg.coreTokens);
            }
            if (typeof msg.hasFurnaceExpansion === 'boolean') {
              setWorldHasFurnaceExpansion(msg.hasFurnaceExpansion);
            }
            if (typeof msg.hasVaultboxExpansion === 'boolean') {
              setWorldHasVaultboxExpansion(msg.hasVaultboxExpansion);
              if (msg.hasVaultboxExpansion) setVaultboxPlacementActive(false);
            }
          }
          break;
        case 'player_profile':
          setPublicProfile(msg.profile);
          break;
        case 'player_teleported':
          engine.teleportLocalPlayer(msg.tx, msg.ty);
          socket.updateLocalPose(engine.getLocalPose());
          if (msg.notice) engine.queuePlayerAnnouncement(msg.notice, 'info');
          break;
        case 'chat_message':
          setChatMessages((prev) => [...prev.slice(-39), msg.message]);
          break;
        case 'worlds_list':
          setWorlds(msg.worlds);
          break;
        case 'world_entities':
          setWorldEntities({
            worldName: msg.worldName,
            worldWidth: msg.worldWidth,
            worldHeight: msg.worldHeight,
            adminTx: msg.adminTx,
            adminTy: msg.adminTy,
            entities: msg.entities,
            notice: msg.notice,
          });
          if (msg.notice) {
            engine.queuePlayerAnnouncement(msg.notice, 'info');
          }
          break;
        case 'fishing_started':
                    setFishingProgress(msg.cast.pullProgress ?? 0);
          setFishingLineTension(msg.cast.lineTension ?? 0.15);
          setFishingFightPattern(msg.cast.fightPattern ?? 'darting');
          engine.setFishingCast(msg.cast);
          if (msg.cast.playerId === playerIdRef.current) {
            setFishingCast(msg.cast);
            setFishingBiting(msg.cast.biting);
          }
          break;
        case 'fishing_progress':
          engine.updateFishingProgress(msg.playerId, msg.progress, msg.lineTension, msg.bobberOffset, msg.fightPattern);
          if (msg.playerId === playerIdRef.current) {
            setFishingProgress(msg.progress);
            setFishingLineTension(msg.lineTension);
            setFishingFightPattern(msg.fightPattern);
            setFishingCast((current) => current ? { ...current, lineTension: msg.lineTension, bobberOffset: msg.bobberOffset, fightPattern: msg.fightPattern, pullProgress: msg.progress } : current);
          }
          break;
        case 'fishing_bite':
          engine.markFishingBite(msg.playerId);
          if (msg.playerId === playerIdRef.current) {
            soundEngine.fishingBite();
            setFishingBiting(true);
            engine.queuePlayerAnnouncement('! Fish biting! Tap Reel!', 'gold');
          }
          break;
        case 'fishing_ended':
          engine.removeFishingCast(msg.playerId);
          if (msg.playerId === playerIdRef.current) {
            setFishingCast(null);
            setFishingBiting(false);
            setFishingProgress(0);
            setFishingLineTension(0.15);
            setFishingFightPattern('darting');
            if (msg.caughtName) {
              soundEngine.unlock();
              engine.queuePlayerAnnouncement(`Caught ${msg.caughtName}!`, 'emerald');
            }
          }
          break;
        case 'exchange_updated':
          setExchangeSnapshot(msg.exchange);
          break;
        case 'mine_shaft_expired':
          showToast(msg.message);
          break;
      }
    });

    // Restore existing session token if stored
    let savedToken: string | null = null;
    try {
      savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      savedToken = null;
    }

    if (savedToken) {
      setLoadingText({ title: 'Restoring Session...', subtitle: 'Verifying your explorer credentials' });
      setAppState('loading');
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then(async (r) => {
          if (!r.ok) throw new Error('expired');
          const data = (await r.json()) as {
            user: AuthUserProfile;
            gameConfig: GameConfig;
          };
          applyUserProfile(data.user);
          setGameConfig(data.gameConfig);
          engine.applyGameConfig(data.gameConfig);
          socket.connectWithToken(savedToken!);
          await Promise.all([fetchWorldsList(), fetchExchangeSnapshot()]);
          const params = new URLSearchParams(window.location.search);
          if (params.get('autostart') === '1') {
            setLoadingText({ title: 'Entering NEXUS...', subtitle: 'Syncing 100×60 Sci-Fi Hub' });
            socket.joinWorld('NEXUS');
          } else {
            setAppState('hub');
          }
        })
        .catch(() => {
          try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
          } catch {
            // ignore
          }
          setAppState('auth');
        });
    }

    return () => {
      unsubStatus();
      unsubMsg();
      socket.disconnect();
      engine.destroy();
      engineRef.current = null;
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishAuthSuccess = useCallback(
    async (token: string, user: AuthUserProfile, cfg: GameConfig) => {
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } catch {
        // ignore storage error
      }
      setLoadingText({ title: 'Loading World Hub...', subtitle: `Welcome back, ${user.playerName}` });
      setAppState('loading');
      applyUserProfile(user);
      setGameConfig(cfg);
      engineRef.current?.applyGameConfig(cfg);
      socketRef.current?.connectWithToken(token);
      await Promise.all([fetchWorldsList(), fetchExchangeSnapshot()]);
      window.setTimeout(() => {
        setAppState((cur) => (cur === 'loading' ? 'hub' : cur));
      }, 280);
    },
    [applyUserProfile, fetchExchangeSnapshot, fetchWorldsList]
  );

  const handleLogin = useCallback(
    async (identifier: string, password: string) => {
      setAuthSubmitting(true);
      setErrorMessage(null);
      soundEngine.uiClick();
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setErrorMessage(data.message ?? 'Login failed.');
          return;
        }
        await finishAuthSuccess(data.token, data.user, data.gameConfig);
      } catch {
        setErrorMessage('Unable to reach server. Please try again.');
      } finally {
        setAuthSubmitting(false);
      }
    },
    [finishAuthSuccess]
  );

  const handleRegister = useCallback(
    async (regEmail: string, username: string, password: string) => {
      setAuthSubmitting(true);
      setErrorMessage(null);
      soundEngine.uiClick();
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: regEmail, username, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setErrorMessage(data.message ?? 'Registration failed.');
          return;
        }
        await finishAuthSuccess(data.token, data.user, data.gameConfig);
      } catch {
        setErrorMessage('Unable to reach server. Please try again.');
      } finally {
        setAuthSubmitting(false);
      }
    },
    [finishAuthSuccess]
  );

  const handleEnterWorld = useCallback(
    (targetWorldName: string) => {
      const cleanWorld = (targetWorldName || 'NEXUS').trim().toUpperCase();
      soundEngine.uiClick();
      setLoadingText({
        title: `Entering ${cleanWorld}...`,
        subtitle: 'Loading world tiles, platforms, locks & active players',
      });
      setAppState('loading');
      socketRef.current?.joinWorld(cleanWorld);
    },
    []
  );

  const handleReturnToHub = useCallback(() => {
            socketRef.current?.leaveWorld();
    void fetchWorldsList();
    setInspectInfo(null);
    setAppState('hub');
  }, [fetchWorldsList]);

  const handleSignOut = useCallback(async () => {
            let token: string | null = null;
    try {
      token = localStorage.getItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      token = null;
    }
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    socketRef.current?.disconnect();
    setHotbarItemIds(EMPTY_HOTBAR);
    setSelectedItemId(ITEM_IDS.FIST);
    engineRef.current?.setSelectedItem(ITEM_IDS.FIST);
    setAdminWorldEdit(false);
    setAdminBrushItemId(null);
    engineRef.current?.setAdminWorldEdit(false, null);
    setRole('player');
    setAppState('auth');
  }, []);

  const handleToggleAdminWorldEdit = useCallback(
    (enabled: boolean, brushItemId: number | null = null) => {
      if (role !== 'admin') return;
      setAdminWorldEdit(enabled);
      if (brushItemId && brushItemId !== ITEM_IDS.AIR) {
        setAdminBrushItemId(brushItemId);
        setSelectedItemId(brushItemId);
        engineRef.current?.setAdminWorldEdit(enabled, brushItemId);
        engineRef.current?.setSelectedItem(brushItemId);
      } else {
        setAdminBrushItemId(null);
        engineRef.current?.setAdminWorldEdit(enabled, null);
      }
      soundEngine.uiClick();
    },
    [role]
  );

  const handleSelectItem = useCallback((itemId: number) => {
    setAdminBrushItemId(null);
    setSelectedItemId(itemId);
    if (itemId === ITEM_IDS.WRENCH) {
      setHotbarItemIds((prev) => (prev[0] === ITEM_IDS.WRENCH ? prev : [ITEM_IDS.WRENCH, ...prev.slice(1)]));
    } else {
      setHotbarItemIds((prev) => (prev[0] === ITEM_IDS.FIST ? prev : [ITEM_IDS.FIST, ...prev.slice(1)]));
    }
    engineRef.current?.setAdminBrushItem(null);
    engineRef.current?.setSelectedItem(itemId);
    soundEngine.uiClick();
  }, []);

  const handleTapPrimarySlot = useCallback(() => {
    setAdminBrushItemId(null);
    engineRef.current?.setAdminBrushItem(null);
    setSelectedItemId((cur) => {
      const nextId = cur === ITEM_IDS.FIST ? ITEM_IDS.WRENCH : ITEM_IDS.FIST;
      setHotbarItemIds((prev) => [nextId, ...prev.slice(1)]);
      engineRef.current?.setSelectedItem(nextId);
      return nextId;
    });
    soundEngine.uiClick();
  }, []);

  // Global keyboard shortcuts (hotbar 1-5, Pause Esc/P, Mute M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (modeRef.current === 'playing' || modeRef.current === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setAppState((cur) => (cur === 'playing' ? 'paused' : cur === 'paused' ? 'playing' : cur));
          return;
        }
        if (e.code === 'KeyM') {
          soundEngine.muted = !soundEngine.muted;
          setMuted(soundEngine.muted);
          return;
        }
        if (modeRef.current === 'playing' && e.code.startsWith('Digit')) {
          const num = Number(e.code.replace('Digit', ''));
          if (num === 1) {
            handleTapPrimarySlot();
          } else if (num >= 2 && num <= EMPTY_HOTBAR.length) {
            const id = hotbarItemIds[num - 1];
            if (id && id !== ITEM_IDS.AIR) handleSelectItem(id);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectItem, handleTapPrimarySlot, hotbarItemIds]);

  // Live Firestore world presence heartbeat & subscription when in a world
  useEffect(() => {
    if ((appState !== 'playing' && appState !== 'paused') || !worldName) return;

    const unsubPresence = subscribeWorldPresence(worldName, () => {
      // Presence listener keeps Firestore live collection active
    });

    const publishNow = (online: boolean) => {
      const pose = engineRef.current?.getLocalPose();
      void publishWorldPresence({
        worldName,
        playerName,
        x: pose?.x ?? coords.tx * TILE_SIZE,
        y: pose?.y ?? coords.ty * TILE_SIZE,
        level,
        online,
      }).catch(() => {});
    };

    publishNow(true);
    const interval = window.setInterval(() => {
      publishNow(true);
      const ws = engineRef.current?.getWorldState();
      if (ws && ws.worldKind !== 'mine_shaft') {
        void syncWorldToFirestore(ws).catch(() => {});
      }
    }, 8000);

    return () => {
      window.clearInterval(interval);
      unsubPresence();
      publishNow(false);
    };
  }, [appState, coords.tx, coords.ty, level, playerName, worldName]);

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0b1622]">
      {/* Isolated Canvas2D World Mount */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {appState === 'auth' && (
        <TitleScreen
          onLogin={handleLogin}
          onRegister={handleRegister}
          errorMessage={errorMessage}
          submitting={authSubmitting}
        />
      )}

      {appState === 'loading' && (
        <LoadingScreen title={loadingText.title} subtitle={loadingText.subtitle} />
      )}

      {appState === 'hub' && (
        <ModeSelection
          playerName={playerName}
          level={level}
          gems={gems}
          connected={connected}
          onReconnectNow={() => socketRef.current?.reconnectNow()}
          onEnterWorld={handleEnterWorld}
          onSignOut={handleSignOut}
        />
      )}

      {(appState === 'playing' || appState === 'paused') && (
        <GameHud
          mode={appState}
          playerId={playerId}
          playerName={playerName}
          role={role}
          gameConfig={gameConfig}
          onUpdateGameConfig={(cfg) =>
            socketRef.current?.send({ type: 'update_game_config', config: cfg })
          }
          onAdminAction={(opts) => socketRef.current?.send({ type: 'admin_action', ...opts })}
          adminWorldEdit={adminWorldEdit}
          adminBrushItemId={adminBrushItemId}
          onToggleAdminWorldEdit={handleToggleAdminWorldEdit}
          worldName={worldName}
          worldOwner={worldOwner}
          worldOwnerId={worldOwnerId}
          worldXp={worldXp}
          worldLevel={worldLevel}
          worldCoreTokens={worldCoreTokens}
          worldHasFurnaceExpansion={worldHasFurnaceExpansion}
          worldHasVaultboxExpansion={worldHasVaultboxExpansion}
          vaultboxPlacementActive={vaultboxPlacementActive}
          playerCount={playerCount}
          coords={coords}
          gems={gems}
          alterbits={alterbits}
          pixobytes={pixobytes}
          xp={xp}
          level={level}
          cropMasteryXp={cropMasteryXp}
          cropMasteryLevel={cropMasteryLevel}
          farmablockMasteryXp={farmablockMasteryXp}
          farmablockMasteryLevel={farmablockMasteryLevel}
          publicProfile={publicProfile}
          onDismissPublicProfile={() => setPublicProfile(null)}
          inventory={inventory}
          equipped={equipped}
          stats={stats}
          claimedAchievements={claimedAchievements}
          friends={friends}
          incomingRequests={incomingRequests}
          favoriteWorlds={favoriteWorlds}
          recentWorlds={recentWorlds}
          hotbarItemIds={hotbarItemIds}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onTapPrimarySlot={handleTapPrimarySlot}
          onAssignHotbar={(slotIndex, itemId) => {
            if (slotIndex < 1) return;
            setHotbarItemIds((prev) => {
              const next = [...prev];
              next[slotIndex] = itemId;
              return next;
            });
          }}
          muted={muted}
          onToggleMute={() => {
            soundEngine.muted = !soundEngine.muted;
            setMuted(soundEngine.muted);
          }}
          touchEnabled={touchEnabled}
          onToggleTouch={() => setTouchEnabled((t) => !t)}
          onTouchMove={(dir, active) => engineRef.current?.setTouchMove(dir, active)}
          onTouchJump={(active) => engineRef.current?.setTouchJump(active)}
          onTouchPunch={(active) => engineRef.current?.setTouchPunch(active)}
          onTouchPunchStick={(active, dx, dy) =>
            engineRef.current?.setTouchPunchStick(active, dx, dy)
          }
          onPause={() => setAppState('paused')}
          onResume={() => setAppState('playing')}
          onReturnToHub={handleReturnToHub}
          onLeaveWorld={handleSignOut}
          worlds={worlds}
          onRefreshWorlds={() => socketRef.current?.send({ type: 'list_worlds' })}
          onJoinWorld={(name) => handleEnterWorld(name)}
          onCreateWorld={(name, terraBlast) => socketRef.current?.send({ type: 'create_world', worldName: name, terraBlast })}
          onToggleFavoriteWorld={(name) =>
            socketRef.current?.send({ type: 'toggle_favorite_world', worldName: name })
          }
          chatMessages={chatMessages}
          onSendChat={(text) => socketRef.current?.send({ type: 'chat', text })}
          onSpliceSeeds={(seedA, seedB) =>
            socketRef.current?.send({ type: 'splice_seeds', seedA, seedB })
          }
          onBuyGemStore={(listingId) =>
            socketRef.current?.send({ type: 'buy_gem_store', listingId, txId: makeTxId() })
          }
          onEquipWearable={(itemId) => socketRef.current?.send({ type: 'equip_wearable', itemId })}
          onClaimAchievement={(achievementId) =>
            socketRef.current?.send({ type: 'claim_achievement', achievementId })
          }
          onFriendAction={(action, targetNameOrId) =>
            socketRef.current?.send({ type: 'friend_action', action, targetNameOrId })
          }
          onConfigureLock={(tx, ty, opts) =>
            socketRef.current?.send({ type: 'configure_lock', tx, ty, ...opts })
          }
          onConfigureVending={(tx, ty, opts) =>
            socketRef.current?.send({ type: 'configure_vending', tx, ty, ...opts })
          }
          onBuyVending={(tx, ty, units) =>
            socketRef.current?.send({ type: 'buy_vending', tx, ty, units, txId: makeTxId() })
          }
          onConfigureSign={(tx, ty, text) =>
            socketRef.current?.send({ type: 'configure_sign', tx, ty, text })
          }
          inspectInfo={inspectInfo}
          onDismissInspect={() => setInspectInfo(null)}
          toastMessage={toastMessage}
          connected={connected}
          onReconnectNow={() => socketRef.current?.reconnectNow()}
          worldKind={worldKind}
          mineExpiresAt={mineExpiresAt}
          activeBuffs={activeBuffs}
          unclaimedWl={unclaimedWl}
          exchange={exchangeSnapshot}
          fishingActive={Boolean(fishingCast)}
          fishingBiting={fishingBiting}
          fishingProgress={fishingProgress}
          fishingLineTension={fishingLineTension}
          fishingFightPattern={fishingFightPattern}
          fishingDepthLevel={fishingCast?.depthLevel ?? null}
          onExitMineShaft={() => socketRef.current?.send({ type: 'exit_mine_shaft' })}
          onUseConsumable={(itemId) =>
            socketRef.current?.send({ type: 'use_consumable', itemId })
          }
          onReelFishing={() => socketRef.current?.send({ type: 'reel_fishing' })}
          onConfigureFurnace={(tx, ty, opts) =>
            socketRef.current?.send({ type: 'configure_furnace', tx, ty, ...opts })
          }
          onConfigureBfg={(tx, ty, opts) =>
            socketRef.current?.send({ type: 'configure_bfg', tx, ty, ...opts })
          }
          onExchangeAction={(opts) =>
            socketRef.current?.send({
              type: 'exchange_action',
              ...opts,
              txId: opts.action === 'buy' || opts.action === 'post' ? makeTxId() : undefined,
            })
          }
          onUpgradeMatteragen={(tx, ty) =>
            socketRef.current?.send({ type: 'upgrade_matteragen', tx, ty })
          }
          onClaimMatteragen={(tx, ty) =>
            socketRef.current?.send({ type: 'claim_matteragen', tx, ty })
          }
          onUnlockWorldCoreFurnace={() =>
            socketRef.current?.send({ type: 'unlock_worldcore_furnace' })
          }
          onStartWorldCoreVaultboxPlacement={() => setVaultboxPlacementActive(true)}
          onCancelWorldCoreVaultboxPlacement={() => setVaultboxPlacementActive(false)}
          onTrashInventoryItem={(opts) =>
            socketRef.current?.send({ type: 'trash_inventory_item', ...opts })
          }
          onConfigureVaultbox={(tx, ty, opts) =>
            socketRef.current?.send({ type: 'configure_vaultbox', tx, ty, ...opts })
          }
          hasClaimedStarterLootbox={hasClaimedStarterLootbox}
          onVendorAction={(opts) =>
            socketRef.current?.send({ type: 'vendor_action', ...opts })
          }
          onConfigureDoor={(tx, ty, targetX, targetY, label) =>
            socketRef.current?.send({ type: 'configure_door', tx, ty, targetX, targetY, label })
          }
          onUseDoor={(tx, ty) =>
            socketRef.current?.send({ type: 'use_door', tx, ty })
          }
          onNexusTeleport={(targetX, targetY, label) => {
            engineRef.current?.teleportLocalPlayer(targetX, targetY);
            if (engineRef.current) {
              socketRef.current?.updateLocalPose(engineRef.current.getLocalPose());
            }
            socketRef.current?.send({ type: 'nexus_teleport', targetX, targetY, label });
          }}
          entitiesSnapshot={worldEntities}
          onRefreshEntities={() => socketRef.current?.send({ type: 'admin_list_entities' })}
          onTeleportEntity={(opts) =>
            socketRef.current?.send({ type: 'admin_teleport_entity', ...opts })
          }
          orientation={orientation}
          viewZoom={viewZoom}
          onChangeViewZoom={(nextZoom) =>
            setViewZoom(resolveUnifiedViewScale(nextZoom, DEFAULT_VIEW_SCALE))
          }
        />
      )}

      </main>
  );
}
