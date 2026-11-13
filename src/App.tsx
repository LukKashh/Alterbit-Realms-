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
  type UserRole,
  type WorldSummary,
} from './game/network.ts';
import type { DungeonSnapshot } from './game/dungeon.ts';
import { getItemDef, ITEM_IDS, type PlayerStatKey } from './game/catalog.ts';
import { cloneGameConfig, DEFAULT_GAME_CONFIG, type GameConfig } from './game/config.ts';
import type { EquippedWearables } from './game/pixelArt.ts';
import { soundEngine } from './game/audio.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx';
import { WorldHub } from './components/WorldHub.tsx';
import { GameHud } from './components/GameHud.tsx';
import { DungeonOverlay } from './components/DungeonOverlay.tsx';
import { testFirestoreConnection } from './lib/firebase.ts';
import {
  publishWorldPresence,
  subscribeWorldPresence,
  syncUserToFirestore,
  syncWorldToFirestore,
} from './lib/firebaseSync.ts';

type AppState = 'auth' | 'loading' | 'hub' | 'playing' | 'paused';

const TOKEN_STORAGE_KEY = 'blockgrove_auth_token';

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
  ITEM_IDS.WRENCH,
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
  const [worldName, setWorldName] = useState<string>('START');
  const [worldOwner, setWorldOwner] = useState<string | null>(null);
  const [worldKind, setWorldKind] = useState<'standard' | 'mine_shaft'>('standard');
  const [mineExpiresAt, setMineExpiresAt] = useState<number | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [coords, setCoords] = useState<{ tx: number; ty: number }>({ tx: 50, ty: 23 });
  const [gems, setGems] = useState<number>(0);
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [inventory, setInventory] = useState<InventorySlot[]>([
    { itemId: ITEM_IDS.FIST, qty: 1 },
    { itemId: ITEM_IDS.WRENCH, qty: 1 },
  ]);
  const [equipped, setEquipped] = useState<EquippedWearables>({});
  const [stats, setStats] = useState<Record<PlayerStatKey, number>>(DEFAULT_STATS);
  const [claimedAchievements, setClaimedAchievements] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestEntry[]>([]);
  const [favoriteWorlds, setFavoriteWorlds] = useState<string[]>(['START']);
  const [recentWorlds, setRecentWorlds] = useState<string[]>(['START']);
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuff[]>([]);
  const [unclaimedWl, setUnclaimedWl] = useState<number>(0);
  const [exchangeSnapshot, setExchangeSnapshot] = useState<ExchangeSnapshot>(DEFAULT_EXCHANGE);
  const [fishingCast, setFishingCast] = useState<FishingCastState | null>(null);
  const [fishingBiting, setFishingBiting] = useState<boolean>(false);
  const [fishingProgress, setFishingProgress] = useState<number>(0);
  const [fishingLineTension, setFishingLineTension] = useState<number>(0.15);
  const [fishingFightPattern, setFishingFightPattern] = useState<'darting' | 'surging' | 'deep_run' | 'erratic'>('darting');
  const [dungeonSnapshot, setDungeonSnapshot] = useState<DungeonSnapshot | null>(null);
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inspectInfo, setInspectInfo] = useState<TileInspectInfo | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  }, []);

  const syncHotbarWithInventory = useCallback((inv: InventorySlot[]) => {
    setHotbarItemIds((prev) => {
      const next = [...prev];
      next[0] = ITEM_IDS.FIST;
      next[1] = ITEM_IDS.WRENCH;

      // Clear hotbar slots 3..6 if quantity dropped to 0
      for (let i = 2; i < next.length; i++) {
        const id = next[i];
        if (id !== ITEM_IDS.AIR && !inv.some((s) => s.itemId === id && s.qty > 0)) {
          next[i] = ITEM_IDS.AIR;
        }
      }

      // Auto-populate empty slots 3..6 with newly acquired placeables, tools, or consumables
      for (const slot of inv) {
        if (slot.qty <= 0 || slot.itemId === ITEM_IDS.FIST || slot.itemId === ITEM_IDS.WRENCH) continue;
        const def = getItemDef(slot.itemId);
        if (
          !def ||
          def.category === 'wearable' ||
          (!def.placeable &&
            def.toolKind !== 'pickaxe' &&
            def.toolKind !== 'rod' &&
            def.category !== 'consumable')
        ) {
          continue;
        }
        if (next.includes(slot.itemId)) continue;
        const emptyIdx = next.findIndex((id, idx) => idx >= 2 && id === ITEM_IDS.AIR);
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
      setXp(user.xp);
      setLevel(user.level);
      setInventory(user.inventory);
      syncHotbarWithInventory(user.inventory);
      setEquipped(user.equipped);
      setStats({ ...DEFAULT_STATS, ...user.stats });
      setClaimedAchievements(user.claimedAchievements);
      setFriends(user.friends);
      setIncomingRequests(user.incomingRequests);
      setFavoriteWorlds(user.favoriteWorlds);
      setRecentWorlds(user.recentWorlds);
      const buffs = user.activeBuffs ?? [];
      setActiveBuffs(buffs);
      setUnclaimedWl(user.unclaimedWl ?? 0);
      engineRef.current?.setLocalIdentity(user.playerId, user.playerName, '#3f8fd9', user.equipped);
      engineRef.current?.setActiveBuffs(buffs);
      void syncUserToFirestore(user, socketRef.current?.getActiveWorldName() ?? '').catch(() => {});
    },
    [syncHotbarWithInventory]
  );

  // Sync body dataset state & engine mode
  useEffect(() => {
    modeRef.current = appState;
    document.body.dataset.state = appState;
    if (appState === 'playing' || appState === 'paused') {
      engineRef.current?.setMode(appState);
    } else {
      engineRef.current?.setMode('title');
    }
  }, [appState]);

  // Freeze the sandbox character while the independent top-down dungeon instance is active.
  useEffect(() => {
    if (dungeonSnapshot) {
      engineRef.current?.setMode('paused');
    } else if (appState === 'playing') {
      engineRef.current?.setMode('playing');
    } else if (appState === 'paused') {
      engineRef.current?.setMode('paused');
    }
  }, [dungeonSnapshot?.runId, dungeonSnapshot?.phase, appState]);

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

    void testFirestoreConnection();

    const socket = new GameSocketClient();
    socketRef.current = socket;

    const engine = new BlockgroveEngine(mount, {
      onMoveSync: (state) => socket.send({ type: 'move', ...state }),
      onPunchTile: (tx, ty, toolItemId) => socket.send({ type: 'punch_tile', tx, ty, toolItemId }),
      onPlaceTile: (tx, ty, itemId) => socket.send({ type: 'place_tile', tx, ty, itemId }),
      onPickupDrop: (dropId) => socket.send({ type: 'pickup_drop', dropId }),
      onInspectTile: (info) => setInspectInfo(info),
      onCoordsChange: (tx, ty) => setCoords({ tx, ty }),
      onCastFishing: (tx, ty, rodItemId) =>
        socket.send({ type: 'cast_fishing', tx, ty, rodItemId }),
      onReelFishing: () => socket.send({ type: 'reel_fishing' }),
      onUseConsumable: (itemId) => socket.send({ type: 'use_consumable', itemId }),
      onHazardHit: (hazard) =>
        showToast(
          hazard === 'acid'
            ? 'Burned by Acid pool! Returned to Entrance Portal.'
            : 'Hit Spikes! Returned to Entrance Portal.'
        ),
    });
    engineRef.current = engine;
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
          socket.send({ type: 'dungeon_resume' });
          applyUserProfile({
            playerId: msg.playerId,
            playerName: msg.playerName,
            email: msg.email,
            role: msg.role,
            gems: msg.gems,
            xp: msg.xp,
            level: msg.level,
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
            engine.getWorldState().name === msg.worldName &&
            engine.getWorldRevision() < msg.worldRevision
          ) {
            socket.joinWorld(msg.worldName, engine.getLocalPose());
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
          if (msg.notice) showToast(msg.notice);
          break;
        case 'world_joined': {
          const isReconnectSameWorld =
            Boolean(msg.resumed) ||
            ((modeRef.current === 'playing' || modeRef.current === 'paused') &&
              engine.getWorldState().name === msg.world.name);
          setErrorMessage(null);
          if (!isReconnectSameWorld) {
            setInspectInfo(null);
          }
          setWorldName(msg.world.name);
          setWorldOwner(msg.world.worldLock?.ownerName ?? null);
          setWorldKind(msg.world.worldKind ?? 'standard');
          setMineExpiresAt(msg.world.expiresAt ?? null);
          setFishingCast(null);
          setFishingBiting(false);
          setFishingProgress(0);
          setPlayerCount(msg.players.length);
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
            engine.syncPresenceAndDrops(msg.players, msg.drops, msg.revision);
            setPlayerCount(msg.players.length);
          }
          break;
        case 'dungeon_state':
          setDungeonSnapshot(msg.snapshot);
          break;
        case 'dungeon_error':
          if (msg.message.toLowerCase().includes('left the expedition')) setDungeonSnapshot(null);
          showToast(msg.message);
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
            msg.vendingMachine,
            msg.signText,
            msg.fluidType,
            msg.fluidLevel,
            msg.furnace,
            msg.bfgCollector
          );
          if (msg.worldLock !== undefined) {
            setWorldOwner(msg.worldLock?.ownerName ?? null);
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
        case 'profile_updated':
          setGems(msg.gems);
          setXp(msg.xp);
          setLevel(msg.level);
          setRole(msg.role);
          setEmail(msg.email);
          setInventory(msg.inventory);
          syncHotbarWithInventory(msg.inventory);
          setEquipped(msg.equipped);
          setStats({ ...DEFAULT_STATS, ...msg.stats });
          setClaimedAchievements(msg.claimedAchievements);
          setFriends(msg.friends);
          setIncomingRequests(msg.incomingRequests);
          setFavoriteWorlds(msg.favoriteWorlds);
          setRecentWorlds(msg.recentWorlds);
          setActiveBuffs(msg.activeBuffs ?? []);
          setUnclaimedWl(msg.unclaimedWl ?? 0);
          engine.setLocalEquipped(msg.equipped);
          engine.setActiveBuffs(msg.activeBuffs ?? []);
          if (msg.notice) showToast(msg.notice);
          break;
        case 'chat_message':
          setChatMessages((prev) => [...prev.slice(-39), msg.message]);
          break;
        case 'worlds_list':
          setWorlds(msg.worlds);
          break;
        case 'fishing_started':
          setFishingProgress(0);
          setFishingLineTension(0.15);
          setFishingFightPattern('darting');
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
            setFishingBiting(true);
            showToast('! Fish biting! Tap Reel Catch!');
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
              showToast(`Caught ${msg.caughtName}!`);
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
            setLoadingText({ title: 'Entering START...', subtitle: 'Syncing 100×60 persistent world' });
            socket.joinWorld('START');
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
      const cleanWorld = (targetWorldName || 'START').trim().toUpperCase();
      soundEngine.uiClick();
      setLoadingText({
        title: `Entering ${cleanWorld}...`,
        subtitle: 'Loading 100×60 tiles, trees, locks & active players',
      });
      setAppState('loading');
      socketRef.current?.joinWorld(cleanWorld);
    },
    []
  );

  const handleReturnToHub = useCallback(() => {
    if (dungeonSnapshot) socketRef.current?.send({ type: 'dungeon_action', action: 'leave' });
    setDungeonSnapshot(null);
    socketRef.current?.leaveWorld();
    void fetchWorldsList();
    setInspectInfo(null);
    setAppState('hub');
  }, [fetchWorldsList, dungeonSnapshot]);

  const handleSignOut = useCallback(async () => {
    if (dungeonSnapshot) socketRef.current?.send({ type: 'dungeon_action', action: 'leave' });
    setDungeonSnapshot(null);
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
    setRole('player');
    setAppState('auth');
  }, [dungeonSnapshot]);

  const handleSelectItem = useCallback((itemId: number) => {
    setSelectedItemId(itemId);
    engineRef.current?.setSelectedItem(itemId);
    soundEngine.uiClick();
  }, []);

  // Global keyboard shortcuts (hotbar 1-6, Pause Esc/P, Mute M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (dungeonSnapshot) return;
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
          if (num >= 1 && num <= 6) {
            const id = hotbarItemIds[num - 1];
            if (id && id !== ITEM_IDS.AIR) handleSelectItem(id);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectItem, hotbarItemIds, dungeonSnapshot]);

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
        x: pose?.x ?? coords.tx * 48,
        y: pose?.y ?? coords.ty * 48,
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
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b1622]">
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
        <WorldHub
          playerId={playerId}
          playerName={playerName}
          email={email}
          role={role}
          gems={gems}
          xp={xp}
          level={level}
          inventory={inventory}
          equipped={equipped}
          stats={stats}
          claimedAchievements={claimedAchievements}
          friends={friends}
          favoriteWorlds={favoriteWorlds}
          recentWorlds={recentWorlds}
          worlds={worlds}
          gameConfig={gameConfig}
          unclaimedWl={unclaimedWl}
          exchange={exchangeSnapshot}
          toastMessage={toastMessage}
          onRefreshWorlds={() => {
            void fetchWorldsList();
            socketRef.current?.send({ type: 'list_worlds' });
          }}
          onEnterWorld={handleEnterWorld}
          onBuyGemStore={(listingId) =>
            socketRef.current?.send({ type: 'buy_gem_store', listingId, txId: makeTxId() })
          }
          onEquipWearable={(itemId) => socketRef.current?.send({ type: 'equip_wearable', itemId })}
          onClaimAchievement={(achievementId) =>
            socketRef.current?.send({ type: 'claim_achievement', achievementId })
          }
          onSaveGameConfig={(cfg) =>
            socketRef.current?.send({ type: 'update_game_config', config: cfg })
          }
          onAdminAction={(opts) => socketRef.current?.send({ type: 'admin_action', ...opts })}
          onExchangeAction={(opts) =>
            socketRef.current?.send({
              type: 'exchange_action',
              ...opts,
              txId: opts.action === 'buy' || opts.action === 'post' ? makeTxId() : undefined,
            })
          }
          connected={connected}
          onReconnectNow={() => socketRef.current?.reconnectNow()}
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
          worldName={worldName}
          worldOwner={worldOwner}
          playerCount={playerCount}
          coords={coords}
          gems={gems}
          xp={xp}
          level={level}
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
          onAssignHotbar={(slotIndex, itemId) => {
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
          onUpgradeFishingRod={(rodInstanceId) =>
            socketRef.current?.send({ type: 'upgrade_fishing_rod', rodInstanceId })
          }
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
        />
      )}

      {(appState === 'hub' || appState === 'playing' || appState === 'paused') && (
        <DungeonOverlay
          playerId={playerId}
          level={level}
          gems={gems}
          inventory={inventory}
          snapshot={dungeonSnapshot}
          onBuyKey={(tier) => socketRef.current?.send({ type: 'dungeon_buy_key', tier })}
          onCreate={(tier) => socketRef.current?.send({ type: 'dungeon_create', tier })}
          onJoin={(code) => socketRef.current?.send({ type: 'dungeon_join', code })}
          onAction={(action, dx, dy) => socketRef.current?.send({ type: 'dungeon_action', action, dx, dy })}
          onDismiss={() => setDungeonSnapshot(null)}
        />
      )}
    </main>
  );