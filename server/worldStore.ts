import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ACHIEVEMENTS,
  FURNACE_RECIPES,
  GEM_STORE_LISTINGS,
  getItemDef,
  getFarmablesByBranch,
  isFarmableSeed,
  getMatteragenBranch,
  getMatteragenIntervalMs,
  getMatteragenEffectiveIntervalMs,
  rollMatteragenYield,
  MATTERAGEN_UPGRADE_COSTS,
  getCoreTokenSpawnChance,
  type CoreTokenSource,
  FARMABLE_SPECS,
  CROP_SPECS,
  getCropSpec,
  isCropBlock,
  isCropItem,
  isCropSeed,
  getCropMasteryRequiredLevel,
  getCropMasteryXpGrant,
  getFarmablockMasteryRequiredLevel,
  getFarmablockMasteryXpGrant,
  ITEM_IDS,
  ATM_MIN_INTERVAL_MS,
  rollAtmIntervalMs,
  rollAtmGems,
  validateCatalogReferences,
  type ItemDefinition,
  type BuffType,
  type PlayerStatKey,
} from '../src/game/catalog.ts';
import {
  DEFAULT_VIEW_SCALE,
  MAX_INVENTORY_SLOTS,
  MAX_STACK_SIZE,
  MAX_WORLD_PLAYERS,
  PLANT_DEFAULT_GROWTH_MS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
  WORLDCORE_FURNACE_DIGIBIT_COST,
  WORLDCORE_FURNACE_TOKEN_COST,
  WORLDCORE_FURNACE_UNLOCK_LEVEL,
} from '../src/game/constants.ts';
import {
  cloneGameConfig,
  DEFAULT_GAME_CONFIG,
  getEffectiveItemDef,
  sanitizeGameConfig,
  type GameConfig,
} from '../src/game/config.ts';
import {
  ensureFluidArrays,
  floodFillLiquidDepth,
  stepFluidFrontier,
  type FluidDelta,
  type LiquidPoolInfo,
} from '../src/game/fluids.ts';
import {
  addMasteryXp,
  addWorldXp,
  addXp,
  canBreakTile,
  canEnterWorld,
  canPlaceTile,
  canPlowTile,
  getPlantGrowthState,
  hasEditPermission,
  inBoundsWorld,
  isDoorBlock,
  isWithinReach,
  resolveSplice,
  tileIndexIn,
  validateWorldName,
} from '../src/game/rules.ts';
import {
  generateMineShaft,
  generateWorld,
  NEXUS_LAYOUT_VERSION,
  VAULTBOX_SLOT_COUNT,
  type BfgCollectorRecord,
  type FurnaceRecord,
  type MatteragenRecord,
  type VaultboxRecord,
  type VaultboxSlot,
  type VendingMachineRecord,
  type WorldState,
} from '../src/game/worldGen.ts';
import type {
  ActiveBuff,
  AuthUserProfile,
  ChatMessage,
  ExchangeListing,
  ExchangePriceStat,
  ExchangeSnapshot,
  FishingCastState,
  FriendEntry,
  FriendRequestEntry,
  InventorySlot,
  RemotePlayerState,
  ResumePosition,
  UserRole,
  WorldDrop,
  WorldSummary,
} from '../src/game/network.ts';
import type { EquippedWearables } from '../src/game/pixelArt.ts';
import { DEFAULT_SHARE_LOCK_PERMISSIONS, getShareLockSpec } from '../src/game/shareLocks.ts';
import type { ShareLockPermissions } from '../src/game/shareLocks.ts';
import { canRodFishAtDepth, getFishingDepthLevel, getFishDepthWeight, getRodUpgradeGemCost, getFishingPullStrength, getFishPullResistance, isSystemWorld } from '../src/game/expansion.ts';
import {
  isCloudSqlConfigured,
  syncPlayerToSql,
  syncWorldToSql,
  syncAccountToSql,
  syncSessionToSql,
  deleteSessionFromSql,
  loadAllStateFromSql,
} from '../src/db/users.ts';

export function getOccupiedBackpackSlots(inventory: InventorySlot[]): number {
  let count = 0;
  let hasCoreTool = false;
  for (const s of inventory) {
    if (!s || s.qty <= 0) continue;
    if (s.itemId === ITEM_IDS.FIST || s.itemId === ITEM_IDS.WRENCH) {
      hasCoreTool = true;
    } else {
      count += 1;
    }
  }
  return count + (hasCoreTool ? 1 : 0);
}

/** Shared server-side tree reward roll used by player harvesting and BFG collectors. */
function rollTreeHarvestRewards(seedId: number, seedDef: ItemDefinition | undefined, luckPct = 0) {
  if (!seedDef?.producesTileId) return [] as Array<{ itemId: number; qty: number }>;
  const yieldCfg = seedDef.treeHarvestYield ?? { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 };
  const minBlocks = Math.max(1, Math.round(yieldCfg.minBlocks));
  const maxBlocks = Math.max(minBlocks, Math.round(yieldCfg.maxBlocks));
  const rewards = [{ itemId: seedDef.producesTileId, qty: minBlocks + Math.floor(Math.random() * (maxBlocks - minBlocks + 1)) }];
  const luckMultiplier = 1 + Math.max(0, luckPct) / 100;
  if (isFarmableSeed(seedId) && Math.random() < Math.min(1, yieldCfg.seedChance * luckMultiplier)) {
    rewards.push({ itemId: seedId, qty: 1 });
  }
  for (const bonus of seedDef.bonusHarvestDrops ?? []) {
    const bonusDef = getItemDef(bonus.itemId);
    if (bonusDef?.category === 'seed' && !isFarmableSeed(bonus.itemId)) continue;
    if (Math.random() <= Math.min(1, bonus.chance * luckMultiplier)) {
      const minQty = Math.max(1, Math.round(bonus.minQty));
      const maxQty = Math.max(minQty, Math.round(bonus.maxQty));
      rewards.push({ itemId: bonus.itemId, qty: minQty + Math.floor(Math.random() * (maxQty - minQty + 1)) });
    }
  }
  return rewards;
}

export interface PlayerAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  gems: number;
  alterbits: number;
  xp: number;
  level: number;
  cropMasteryLevel?: number;
  cropMasteryXp?: number;
  farmablockMasteryLevel?: number;
  farmablockMasteryXp?: number;
  shirtColor: string;
  inventory: InventorySlot[];
  overflowVault?: InventorySlot[];
  equipped: EquippedWearables;
  stats: Record<PlayerStatKey, number>;
  claimedAchievements: string[];
  friends: string[];
  incomingRequests: FriendRequestEntry[];
  favoriteWorlds: string[];
  recentWorlds: string[];
  processedTxIds: string[];
  activeBuffs: ActiveBuff[];
  unclaimedWl: number;
  ownedWorldName?: string;
  hasClaimedStarterLootbox?: boolean;
}

export interface CredentialRecord {
  accountId: string;
  email: string; // normalized lowercase
  username: string; // display username
  usernameLower: string;
  passwordHash: string; // salt:hash
  role: UserRole;
  createdAt: number;
}

export interface SessionRecord {
  token: string;
  accountId: string;
  createdAt: number;
}

interface TileDamageState {
  hits: number;
  lastHitAt: number;
  layer: 'fg' | 'bg' | 'plant' | 'fluid';
}

export interface ServerFishingCast extends FishingCastState {
  worldName: string;
  rodItemId: number;
  rodInstanceId: string;
  rodUpgradeLevel: 1 | 2 | 3;
  pullingStrength: number;
  fishItemId?: number;
  fishResistance?: number;
  pullProgress: number;
  lineTension: number;
  bobberOffset: number;
  fightPattern?: 'darting' | 'surging' | 'deep_run' | 'erratic';
  fightStartedAt: number;
  lastFightUpdateAt: number;
  biteAt: number;
  expiresAt: number;
  lastReelAt?: number;
  zoneId?: string;
}

export interface LiveWorld {
  state: WorldState;
  players: Map<string, RemotePlayerState>;
  drops: Map<string, WorldDrop>;
  damage: Map<string, TileDamageState>;
  fluidFrontier: Set<string>;
  activeCasts: Map<string, ServerFishingCast>;
  chatHistory: ChatMessage[];
  dirty: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WORLDS_DIR = path.join(DATA_DIR, 'worlds');
const PLAYERS_DIR = path.join(DATA_DIR, 'players');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'game-config.json');
const EXCHANGE_FILE = path.join(DATA_DIR, 'exchange.json');

const SHIRT_PALETTE = ['#3f8fd9', '#d95b43', '#49a863', '#c99334', '#8e63c9', '#38a3a5'];
const MAX_OWNED_WORLD_PLAYERS = 10;

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

export class AuthoritativeWorldStore {
  private worlds = new Map<string, LiveWorld>();
  private players = new Map<string, PlayerAccount>();
  private credentials: CredentialRecord[] = [];
  private sessions = new Map<string, SessionRecord>();
  private gameConfig: GameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);
  private exchangeState: ExchangeSnapshot = {
    listings: [],
    priceStats: {},
    totalWlBurned: 0,
    totalGemsCleared: 0,
  };
  private lastPunchAt = new Map<string, number>();
  private lastChatAt = new Map<string, number>();
  private lastKnownPositions = new Map<string, { pose: ResumePosition; savedAt: number }>();
  private pendingWorldSaves = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingPlayerSaves = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    fs.mkdirSync(WORLDS_DIR, { recursive: true });
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });

    const catalogCheck = validateCatalogReferences();
    if (!catalogCheck.valid) {
      console.warn('[CatalogValidator] Reference issues found:', catalogCheck.warnings);
    }

    // Never run destructive world/profile wipes automatically on startup.
    this.loadCredentials();
    this.loadSessions();
    this.loadGameConfig();
    this.loadExchange();
    this.seedBootstrapAdminIfConfigured();
    this.getOrCreateWorld('START');
    this.getOrCreateWorld('NEXUS');
    this.getOrCreateWorld('DWELLER');
    this.getOrCreateWorld('FISHING');
    this.getOrCreateWorld('STATION');
    this.getOrCreateWorld('TRADE');
    this.getOrCreateWorld('FARM');
  }

  private writeJsonAtomically(filePath: string, payload: unknown) {
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  /**
   * Hydrates accounts, sessions, player profiles, and worlds from PostgreSQL (Cloud SQL)
   * when configured as the single authoritative production storage.
   */
  async hydrateFromDatabase(): Promise<void> {
    if (!isCloudSqlConfigured()) return;
    try {
      const state = await loadAllStateFromSql();
      for (const accRow of state.accounts) {
        const existingIdx = this.credentials.findIndex((c) => c.accountId === accRow.accountId);
        const record: CredentialRecord = {
          accountId: accRow.accountId,
          email: accRow.email,
          username: accRow.username,
          usernameLower: accRow.usernameLower,
          passwordHash: accRow.passwordHash,
          role: accRow.role === 'admin' ? 'admin' : 'player',
          createdAt: accRow.createdAt,
        };
        if (existingIdx >= 0) this.credentials[existingIdx] = record;
        else this.credentials.push(record);
      }
      for (const sessRow of state.sessions) {
        this.sessions.set(sessRow.token, {
          token: sessRow.token,
          accountId: sessRow.accountId,
          createdAt: sessRow.createdAt,
        });
      }
      for (const rawPlayer of state.players) {
        if (rawPlayer && typeof rawPlayer === 'object' && 'id' in rawPlayer) {
          const hydrated = this.hydrateAccountDefaults(rawPlayer as PlayerAccount);
          this.players.set(hydrated.id, hydrated);
        }
      }
      for (const rawWorld of state.worlds) {
        if (rawWorld && typeof rawWorld === 'object' && 'name' in rawWorld) {
          const wState = rawWorld as WorldState;
          const name = String(wState.name || '').trim().toUpperCase();
          if (!name) continue;
          const hydratedState =
            name === 'NEXUS' && (wState.nexusLayoutVersion ?? 0) !== NEXUS_LAYOUT_VERSION
              ? this.hydrateWorldDefaults(generateWorld('NEXUS'))
              : this.hydrateWorldDefaults(wState);
          const existing = this.worlds.get(name);
          if (existing) {
            existing.state = hydratedState;
            existing.fluidFrontier = this.seedInitialFluidFrontier(hydratedState);
          } else {
            this.worlds.set(name, {
              state: hydratedState,
              players: new Map(),
              drops: new Map(),
              damage: new Map(),
              fluidFrontier: this.seedInitialFluidFrontier(hydratedState),
              activeCasts: new Map(),
              chatHistory: [
                {
                  id: `sys_${Date.now()}`,
                  senderId: 'system',
                  senderName: 'Blockgrove',
                  text: `Welcome to ${hydratedState.name}.`,
                  timestamp: Date.now(),
                  system: true,
                },
              ],
              dirty: false,
            });
          }
        }
      }
    } catch (err) {
      console.error('[WorldStore] Failed to hydrate from Cloud SQL:', err);
    }
  }

  private hashPassword(password: string, salt?: string): string {
    const s = salt ?? crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, s, 64).toString('hex');
    return `${s}:${derived}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [salt, hashHex] = stored.split(':');
    if (!salt || !hashHex) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  private loadCredentials() {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      this.credentials = [];
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
      this.credentials = Array.isArray(parsed) ? (parsed as CredentialRecord[]) : [];
    } catch {
      this.credentials = [];
    }
  }

  private saveCredentials(changedCred?: CredentialRecord) {
    if (isCloudSqlConfigured()) {
      if (changedCred) {
        void syncAccountToSql(changedCred);
      } else {
        for (const c of this.credentials) void syncAccountToSql(c);
      }
      return;
    }
    this.writeJsonAtomically(ACCOUNTS_FILE, this.credentials);
  }

  private loadSessions() {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        for (const s of parsed as SessionRecord[]) {
          if (s?.token && s?.accountId) this.sessions.set(s.token, s);
        }
      }
    } catch {
      // ignore corrupted sessions
    }
  }

  private saveSessions(changedSession?: SessionRecord) {
    if (isCloudSqlConfigured()) {
      if (changedSession) {
        void syncSessionToSql(changedSession);
      }
      return;
    }
    const arr = Array.from(this.sessions.values()).slice(-500);
    this.writeJsonAtomically(SESSIONS_FILE, arr);
  }

  private loadGameConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
      this.gameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);
      this.gameConfig.mechanics.viewScale = DEFAULT_VIEW_SCALE;
      return;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Partial<GameConfig>;
      this.gameConfig = sanitizeGameConfig(raw);
    } catch {
      this.gameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);
    }
  }

  private saveGameConfig() {
    this.writeJsonAtomically(CONFIG_FILE, this.gameConfig);
  }

  /**
   * Provisions an initial admin account ONLY when explicit deployment secrets
   * (`ADMIN_BOOTSTRAP_USERNAME` and `ADMIN_BOOTSTRAP_SECRET`) are provided.
   * Never seeds hardcoded default credentials (`GameDev` / `123456`).
   */
  private seedBootstrapAdminIfConfigured() {
    const bootstrapSecret = (process.env.ADMIN_BOOTSTRAP_SECRET ?? '').trim();
    const bootstrapUser = (process.env.ADMIN_BOOTSTRAP_USERNAME ?? '').trim();
    const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
    if (!bootstrapSecret || !bootstrapUser) return;

    const existing = this.credentials.find(
      (c) =>
        (bootstrapEmail && c.email === bootstrapEmail) ||
        c.usernameLower === bootstrapUser.toLowerCase()
    );
    if (!existing) {
      const accountId = `admin_${this.safeFileId(bootstrapUser.toLowerCase())}`;
      const cred: CredentialRecord = {
        accountId,
        email: bootstrapEmail || `${bootstrapUser.toLowerCase()}@localhost`,
        username: bootstrapUser,
        usernameLower: bootstrapUser.toLowerCase(),
        passwordHash: this.hashPassword(bootstrapSecret),
        role: 'admin',
        createdAt: Date.now(),
      };
      this.credentials.push(cred);
      this.saveCredentials(cred);
      const acc = this.createEmptyPlayerAccount(accountId, cred.username, cred.email, 'admin');
      this.players.set(accountId, acc);
      this.savePlayer(acc, true);
    }
  }

  private safeFileId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  }

  private pickShirtColor(id: string): string {
    let sum = 0;
    for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    return SHIRT_PALETTE[sum % SHIRT_PALETTE.length];
  }

  private loadExchange() {
    if (!fs.existsSync(EXCHANGE_FILE)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(EXCHANGE_FILE, 'utf8')) as Partial<ExchangeSnapshot>;
      this.exchangeState = {
        listings: Array.isArray(raw.listings) ? raw.listings : [],
        priceStats: raw.priceStats && typeof raw.priceStats === 'object' ? raw.priceStats : {},
        totalWlBurned: Number(raw.totalWlBurned ?? 0),
        totalGemsCleared: Number(raw.totalGemsCleared ?? 0),
      };
    } catch {
      // ignore corrupted exchange state
    }
  }

  private saveExchange() {
    this.writeJsonAtomically(EXCHANGE_FILE, this.exchangeState);
  }

  getExchangeSnapshot(): ExchangeSnapshot {
    return {
      listings: this.exchangeState.listings.map((l) => ({ ...l })),
      priceStats: { ...this.exchangeState.priceStats },
      totalWlBurned: this.exchangeState.totalWlBurned,
      totalGemsCleared: this.exchangeState.totalGemsCleared,
    };
  }

  private pushToOverflowVault(vault: InventorySlot[], slot: InventorySlot) {
    if (!slot || slot.qty <= 0) return;
    const def = getItemDef(slot.itemId);
    if (!def) return;
    if (def.maxDurability || def.toolKind === 'rod') {
      vault.push({ ...slot, qty: 1 });
      return;
    }
    const existing = vault.find((v) => v.itemId === slot.itemId);
    if (existing) {
      existing.qty += slot.qty;
    } else {
      vault.push({ itemId: slot.itemId, qty: slot.qty });
    }
  }

  private hydrateAccountDefaults(acc: PlayerAccount): PlayerAccount {
    acc.email = acc.email ?? '';
    acc.role = acc.role === 'admin' ? 'admin' : 'player';
    acc.equipped = acc.equipped ?? {};
    acc.stats = { ...DEFAULT_STATS, ...(acc.stats ?? {}) };
    acc.claimedAchievements = acc.claimedAchievements ?? [];
    acc.friends = acc.friends ?? [];
    acc.incomingRequests = acc.incomingRequests ?? [];
    acc.favoriteWorlds = acc.favoriteWorlds ?? ['NEXUS'];
    acc.recentWorlds = acc.recentWorlds ?? ['NEXUS'];
    acc.processedTxIds = acc.processedTxIds ?? [];
    acc.activeBuffs = (acc.activeBuffs ?? []).filter((b) => b.expiresAt > Date.now());
    acc.unclaimedWl = Math.max(0, Math.floor(Number(acc.unclaimedWl ?? 0)));
    acc.alterbits = Math.max(0, Math.floor(Number(acc.alterbits ?? 0)));
    acc.cropMasteryLevel = Math.max(1, Math.floor(Number(acc.cropMasteryLevel ?? 1)));
    acc.cropMasteryXp = Math.max(0, Math.floor(Number(acc.cropMasteryXp ?? 0)));
    acc.farmablockMasteryLevel = Math.max(1, Math.floor(Number(acc.farmablockMasteryLevel ?? 1)));
    acc.farmablockMasteryXp = Math.max(0, Math.floor(Number(acc.farmablockMasteryXp ?? 0)));
    acc.hasClaimedStarterLootbox = Boolean(acc.hasClaimedStarterLootbox);
    acc.overflowVault = Array.isArray(acc.overflowVault)
      ? acc.overflowVault.filter((s) => s && s.qty > 0 && Boolean(getItemDef(s.itemId)))
      : [];

    if (!acc.inventory.some((s) => s.itemId === ITEM_IDS.FIST)) {
      acc.inventory.unshift({ itemId: ITEM_IDS.FIST, qty: 1 });
    }
    if (!acc.inventory.some((s) => s.itemId === ITEM_IDS.WRENCH)) {
      acc.inventory.splice(1, 0, { itemId: ITEM_IDS.WRENCH, qty: 1 });
    }

    // Consolidate inventory under 20-slot / 500-stack single-slot-per-item rules;
    // route any excess stacks or quantities into acc.overflowVault so zero items are lost.
    const consolidated: InventorySlot[] = [];
    for (const rawSlot of acc.inventory) {
      if (!rawSlot || rawSlot.qty <= 0) continue;
      const def = getItemDef(rawSlot.itemId);
      if (!def) continue;
      if (def.category === 'seed' && !isFarmableSeed(rawSlot.itemId) && !isCropSeed(rawSlot.itemId)) {
        continue;
      }
      if (rawSlot.itemId === ITEM_IDS.FIST || rawSlot.itemId === ITEM_IDS.WRENCH) {
        if (!consolidated.some((s) => s.itemId === rawSlot.itemId)) {
          consolidated.push({ itemId: rawSlot.itemId, qty: 1 });
        }
        continue;
      }
      if (def.maxDurability || def.toolKind === 'rod') {
        const copies = Math.max(1, Math.floor(rawSlot.qty));
        for (let i = 0; i < copies; i++) {
          const instance: InventorySlot = {
            ...rawSlot,
            qty: 1,
            rodInstanceId:
              def.toolKind === 'rod'
                ? i === 0 && rawSlot.rodInstanceId
                  ? rawSlot.rodInstanceId
                  : crypto.randomUUID()
                : undefined,
            rodUpgradeLevel:
              def.toolKind === 'rod'
                ? ((Number.isInteger(rawSlot.rodUpgradeLevel) &&
                  Number(rawSlot.rodUpgradeLevel) >= 1 &&
                  Number(rawSlot.rodUpgradeLevel) <= 3
                    ? rawSlot.rodUpgradeLevel
                    : 1) as 1 | 2 | 3)
                : undefined,
            maxDurability: def.maxDurability ?? rawSlot.maxDurability,
            durability: rawSlot.durability ?? def.maxDurability,
          };
          if (getOccupiedBackpackSlots(consolidated) < MAX_INVENTORY_SLOTS) {
            consolidated.push(instance);
          } else {
            this.pushToOverflowVault(acc.overflowVault, instance);
          }
        }
        continue;
      }

      const maxStack = Math.min(MAX_STACK_SIZE, Math.max(1, def.stackLimit || MAX_STACK_SIZE));
      const existing = consolidated.find((s) => s.itemId === rawSlot.itemId);
      if (existing) {
        const room = Math.max(0, maxStack - existing.qty);
        const fit = Math.min(room, rawSlot.qty);
        existing.qty += fit;
        const leftover = rawSlot.qty - fit;
        if (leftover > 0) {
          this.pushToOverflowVault(acc.overflowVault, { itemId: rawSlot.itemId, qty: leftover });
        }
      } else if (getOccupiedBackpackSlots(consolidated) < MAX_INVENTORY_SLOTS) {
        const fit = Math.min(maxStack, rawSlot.qty);
        consolidated.push({ itemId: rawSlot.itemId, qty: fit });
        const leftover = rawSlot.qty - fit;
        if (leftover > 0) {
          this.pushToOverflowVault(acc.overflowVault, { itemId: rawSlot.itemId, qty: leftover });
        }
      } else {
        this.pushToOverflowVault(acc.overflowVault, { itemId: rawSlot.itemId, qty: rawSlot.qty });
      }
    }
    acc.inventory = consolidated;
    return acc;
  }

  private createEmptyPlayerAccount(
    id: string,
    name: string,
    email = '',
    role: UserRole = 'player'
  ): PlayerAccount {
    return this.hydrateAccountDefaults({
      id,
      name,
      email,
      role,
      gems: 0,
      alterbits: 0,
      xp: 0,
      level: 1,
      cropMasteryLevel: 1,
      cropMasteryXp: 0,
      farmablockMasteryLevel: 1,
      farmablockMasteryXp: 0,
      shirtColor: this.pickShirtColor(id),
      inventory: [
        { itemId: ITEM_IDS.FIST, qty: 1 },
        { itemId: ITEM_IDS.WRENCH, qty: 1 },
      ],
      overflowVault: [],
      equipped: {},
      stats: { ...DEFAULT_STATS },
      claimedAchievements: [],
      friends: [],
      incomingRequests: [],
      favoriteWorlds: ['NEXUS'],
      recentWorlds: ['NEXUS'],
      processedTxIds: [],
      activeBuffs: [],
      unclaimedWl: 0,
    });
  }

  private loadPlayerById(id: string): PlayerAccount | null {
    const cached = this.players.get(id);
    if (cached) return this.hydrateAccountDefaults(cached);
    const filePath = path.join(PLAYERS_DIR, `${this.safeFileId(id)}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PlayerAccount;
      this.hydrateAccountDefaults(parsed);
      this.players.set(id, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  registerAccount(input: {
    email: string;
    username: string;
    password: string;
    bootstrapSecret?: string;
  }): { ok: true; token: string; account: PlayerAccount } | { ok: false; message: string } {
    const email = (input.email ?? '').trim().toLowerCase();
    const username = (input.username ?? '').trim();
    const password = input.password ?? '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: 'Enter a valid email address.' };
    }
    if (!/^[a-zA-Z0-9_-]{2,16}$/.test(username)) {
      return { ok: false, message: 'Username must be 2–16 letters, numbers, _ or -.' };
    }
    if (password.length < 6 || password.length > 64) {
      return { ok: false, message: 'Password must be at least 6 characters.' };
    }

    const usernameLower = username.toLowerCase();
    if (this.credentials.some((c) => c.email === email)) {
      return { ok: false, message: 'An account with this email already exists.' };
    }
    if (this.credentials.some((c) => c.usernameLower === usernameLower)) {
      return { ok: false, message: 'That username is already taken.' };
    }

    const envSecret = (process.env.ADMIN_BOOTSTRAP_SECRET ?? '').trim();
    const isBootstrapAdmin = Boolean(envSecret && input.bootstrapSecret && input.bootstrapSecret === envSecret);
    const role: UserRole = isBootstrapAdmin ? 'admin' : 'player';

    const accountId = `acc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const cred: CredentialRecord = {
      accountId,
      email,
      username,
      usernameLower,
      passwordHash: this.hashPassword(password),
      role,
      createdAt: Date.now(),
    };
    this.credentials.push(cred);
    this.saveCredentials(cred);

    const account = this.createEmptyPlayerAccount(accountId, username, email, role);
    this.players.set(accountId, account);
    this.savePlayer(account, true);

    const token = crypto.randomBytes(24).toString('hex');
    const sess: SessionRecord = { token, accountId, createdAt: Date.now() };
    this.sessions.set(token, sess);
    this.saveSessions(sess);

    return { ok: true, token, account };
  }

  loginAccount(input: {
    identifier: string;
    password: string;
  }): { ok: true; token: string; account: PlayerAccount } | { ok: false; message: string } {
    const idLower = (input.identifier ?? '').trim().toLowerCase();
    const password = input.password ?? '';
    if (!idLower || !password) {
      return { ok: false, message: 'Enter your email or username and password.' };
    }

    const cred = this.credentials.find(
      (c) => c.email === idLower || c.usernameLower === idLower
    );
    if (!cred || !this.verifyPassword(password, cred.passwordHash)) {
      return { ok: false, message: 'Invalid email/username or password.' };
    }

    let account = this.loadPlayerById(cred.accountId);
    if (!account) {
      account = this.createEmptyPlayerAccount(cred.accountId, cred.username, cred.email, cred.role);
      this.players.set(cred.accountId, account);
      this.savePlayer(account, true);
    } else {
      account.role = cred.role;
      account.email = cred.email;
      account.name = cred.username;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const sess: SessionRecord = { token, accountId: account.id, createdAt: Date.now() };
    this.sessions.set(token, sess);
    this.saveSessions(sess);

    return { ok: true, token, account };
  }

  loginOrCreateFirebaseAccount(input: {
    uid: string;
    email: string;
    displayName?: string;
    emailVerified?: boolean;
  }): { ok: true; token: string; account: PlayerAccount } | { ok: false; message: string } {
    const uid = (input.uid ?? '').trim();
    if (!uid) {
      return { ok: false, message: 'Missing Firebase user ID.' };
    }

    const email = (input.email ?? '').trim().toLowerCase();
    const fbAccountId = `fb_${this.safeFileId(uid)}`;
    const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();

    let cred = this.credentials.find(
      (c) => (email && c.email === email) || c.accountId === fbAccountId
    );

    if (!cred) {
      const rawBase = (input.displayName || email.split('@')[0] || 'Player')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 12);
      const baseName = rawBase.length >= 2 ? rawBase : `Player_${uid.slice(0, 4)}`;
      let candidate = baseName;
      let suffix = 1;
      while (this.credentials.some((c) => c.usernameLower === candidate.toLowerCase())) {
        const suffixStr = String(suffix++);
        candidate = `${baseName.slice(0, Math.max(2, 16 - suffixStr.length))}${suffixStr}`;
      }

      const role: UserRole = bootstrapEmail && email === bootstrapEmail ? 'admin' : 'player';
      cred = {
        accountId: fbAccountId,
        email,
        username: candidate,
        usernameLower: candidate.toLowerCase(),
        passwordHash: this.hashPassword(crypto.randomBytes(24).toString('hex')),
        role,
        createdAt: Date.now(),
      };
      this.credentials.push(cred);
      this.saveCredentials(cred);
    } else if (email && cred.email !== email) {
      cred.email = email;
      if (bootstrapEmail && email === bootstrapEmail) {
        cred.role = 'admin';
      }
      this.saveCredentials(cred);
    }

    let account = this.loadPlayerById(cred.accountId);
    if (!account) {
      account = this.createEmptyPlayerAccount(cred.accountId, cred.username, cred.email, cred.role);
      this.players.set(cred.accountId, account);
      this.savePlayer(account, true);
    } else {
      account.role = cred.role;
      account.email = cred.email;
      account.name = cred.username;
      this.savePlayer(account, true);
    }

    const token = crypto.randomBytes(24).toString('hex');
    const sess: SessionRecord = { token, accountId: account.id, createdAt: Date.now() };
    this.sessions.set(token, sess);
    this.saveSessions(sess);

    return { ok: true, token, account };
  }

  getAccountByToken(token: string | undefined): PlayerAccount | null {
    if (!token) return null;
    const sess = this.sessions.get(token);
    if (!sess) return null;
    const cred = this.credentials.find((c) => c.accountId === sess.accountId);
    const acc = this.loadPlayerById(sess.accountId);
    if (!acc) return null;
    if (cred) {
      acc.role = cred.role;
      acc.email = cred.email;
    }
    return acc;
  }

  logoutToken(token: string | undefined) {
    if (!token) return;
    if (this.sessions.delete(token)) {
      if (isCloudSqlConfigured()) {
        void deleteSessionFromSql(token);
      } else {
        this.saveSessions();
      }
    }
  }

  pruneAndGetBuffs(account: PlayerAccount): ActiveBuff[] {
    const now = Date.now();
    account.activeBuffs = (account.activeBuffs ?? []).filter((b) => b.expiresAt > now);
    return account.activeBuffs;
  }

  getBuffBonusPct(account: PlayerAccount, buffType: BuffType): number {
    const active = this.pruneAndGetBuffs(account);
    let total = 0;
    for (const b of active) {
      if (b.buffType === buffType) total += b.bonusPct;
    }
    return total;
  }

  toAuthUserProfile(account: PlayerAccount): AuthUserProfile {
    return {
      playerId: account.id,
      playerName: account.name,
      email: account.email,
      role: account.role,
      gems: account.gems,
      alterbits: account.alterbits ?? 0,
      xp: account.xp,
      level: account.level,
      cropMasteryLevel: account.cropMasteryLevel ?? 1,
      cropMasteryXp: account.cropMasteryXp ?? 0,
      farmablockMasteryLevel: account.farmablockMasteryLevel ?? 1,
      farmablockMasteryXp: account.farmablockMasteryXp ?? 0,
      inventory: account.inventory,
      overflowVault: account.overflowVault ?? [],
      equipped: account.equipped,
      stats: account.stats,
      claimedAchievements: account.claimedAchievements,
      friends: this.getFriendEntries(account),
      incomingRequests: account.incomingRequests,
      favoriteWorlds: account.favoriteWorlds,
      recentWorlds: account.recentWorlds,
      activeBuffs: this.pruneAndGetBuffs(account),
      unclaimedWl: account.unclaimedWl ?? 0,
      hasClaimedStarterLootbox: Boolean(account.hasClaimedStarterLootbox),
    };
  }

  getGameConfig(): GameConfig {
    return cloneGameConfig(this.gameConfig);
  }

  updateGameConfig(
    account: PlayerAccount,
    rawConfig: Partial<GameConfig>
  ): { ok: true; gameConfig: GameConfig } | { ok: false; message: string } {
    if (account.role !== 'admin') {
      return { ok: false, message: 'Administrator role required to update game configuration.' };
    }
    this.gameConfig = sanitizeGameConfig(rawConfig);
    this.saveGameConfig();
    return { ok: true, gameConfig: cloneGameConfig(this.gameConfig) };
  }

  private clearTileMetadata(live: LiveWorld, tx: number, ty: number) {
    const key = `${tx},${ty}`;
    if (live.state.plants?.[key]) delete live.state.plants[key];
    if (live.state.shareLocks?.[key]) delete live.state.shareLocks[key];
    if (live.state.areaLocks?.[key]) delete live.state.areaLocks[key];
    if (live.state.vendingMachines?.[key]) delete live.state.vendingMachines[key];
    if (live.state.furnaces?.[key]) delete live.state.furnaces[key];
    if (live.state.bfgCollectors?.[key]) delete live.state.bfgCollectors[key];
    if (live.state.matteragenEngines?.[key]) delete live.state.matteragenEngines[key];
    if (live.state.atmMachines?.[key]) delete live.state.atmMachines[key];
    if (live.state.vaultboxes?.[key]) delete live.state.vaultboxes[key];
    if (live.state.seedPots?.[key]) delete live.state.seedPots[key];
    if (live.state.signs?.[key]) delete live.state.signs[key];
    if (live.state.doorLinks?.[key]) delete live.state.doorLinks[key];
  }

  private applyAdminTileSet(
    live: LiveWorld,
    tx: number,
    ty: number,
    itemId: number,
    layer: 'fg' | 'bg' | 'both' = 'fg',
    actorId = 'system',
    actorName = 'System'
  ): boolean {
    if (!inBoundsWorld(live.state, tx, ty)) return false;
    const h = live.state.height || 60;
    if (ty >= h - 1) return false; // preserve absolute bottom bedrock edge
    const idx = tileIndexIn(live.state, tx, ty);
    const key = `${tx},${ty}`;
    ensureFluidArrays(live.state);
    live.damage.delete(key);

    if (itemId === ITEM_IDS.AIR || itemId === ITEM_IDS.BG_SKY) {
      if (layer === 'fg' || layer === 'both') {
        live.state.fg[idx] = ITEM_IDS.AIR;
        live.state.fluidType![idx] = 0;
        live.state.fluidLevel![idx] = 0;
        this.clearTileMetadata(live, tx, ty);
      }
      if (layer === 'bg' || layer === 'both' || itemId === ITEM_IDS.BG_SKY) {
        live.state.bg[idx] = ITEM_IDS.BG_SKY;
        if (live.state.doorLinks?.[key]) delete live.state.doorLinks[key];
      }
      this.enqueueFluidNeighbors(live, tx, ty);
      return true;
    }

    const def = getItemDef(itemId);
    if (!def) return false;

    if (def.category === 'background' || layer === 'bg') {
      if (def.category === 'background') {
        live.state.bg[idx] = itemId;
        return true;
      }
      if (layer === 'bg') return false;
    }

    if (def.category === 'seed') {
      live.state.fg[idx] = ITEM_IDS.AIR;
      live.state.fluidType![idx] = 0;
      live.state.fluidLevel![idx] = 0;
      this.clearTileMetadata(live, tx, ty);
      const now = Date.now();
      const mult = Math.max(0.1, this.gameConfig.mechanics.growthMultiplier || 1);
      const growDuration = Math.round((def.growthTimeMs ?? PLANT_DEFAULT_GROWTH_MS) / mult);
      live.state.plants[key] = {
        x: tx,
        y: ty,
        seedId: itemId,
        plantedAt: now,
        maturityAt: now + growDuration,
        ownerId: actorId,
      };
      return true;
    }

    if (def.category === 'fluid') {
      this.clearTileMetadata(live, tx, ty);
      live.state.fg[idx] = itemId;
      live.state.fluidType![idx] = itemId === ITEM_IDS.ACID_SOURCE ? 2 : 1;
      live.state.fluidLevel![idx] = 4;
      this.enqueueFluidNeighbors(live, tx, ty);
      return true;
    }

    // Foreground / interactive / special prop
    this.clearTileMetadata(live, tx, ty);
    live.state.fluidType![idx] = 0;
    live.state.fluidLevel![idx] = 0;
    live.state.fg[idx] = itemId;
    if (getItemDef(itemId)?.key.includes('sign')) {
      live.state.signs = live.state.signs ?? {};
      live.state.signs[key] = `Sign by ${actorName}`;
    }
    this.enqueueFluidNeighbors(live, tx, ty);
    return true;
  }

  handleAdminAction(
    account: PlayerAccount,
    live: LiveWorld | null,
    opts: {
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
  ):
    | {
        ok: true;
        notice: string;
        grownTiles?: { tx: number; ty: number }[];
        updatedTiles?: { tx: number; ty: number }[];
        fullWorldSync?: boolean;
        configReset?: boolean;
      }
    | { ok: false; message: string } {
    if (account.role !== 'admin') {
      return { ok: false, message: 'Administrator role required.' };
    }
    if (opts.action === 'reset_config') {
      this.gameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);
      this.saveGameConfig();
      return { ok: true, notice: 'Reset mechanics and drop rates to defaults.', configReset: true };
    }
    if (opts.action === 'grant_gems') {
      const amt = Math.max(1, Math.min(100000, Math.floor(Number(opts.gems ?? 100))));
      account.gems += amt;
      this.savePlayer(account);
      return { ok: true, notice: `Granted +${amt} Gems.` };
    }
    if (opts.action === 'clear_inventory') {
      const removedCount = account.inventory.filter(
        (s) => s.itemId !== ITEM_IDS.FIST && s.itemId !== ITEM_IDS.WRENCH
      ).length;
      account.inventory = [
        { itemId: ITEM_IDS.FIST, qty: 1 },
        { itemId: ITEM_IDS.WRENCH, qty: 1 },
      ];
      account.equipped = {};
      this.savePlayer(account);
      return {
        ok: true,
        notice: `Cleared ${removedCount} inventory slot${removedCount === 1 ? '' : 's'} (retained Fist & Tinker Wrench).`,
      };
    }
    if (opts.action === 'delete_inventory_slot') {
      let targetIdx = -1;
      if (
        typeof opts.slotIndex === 'number' &&
        Number.isInteger(opts.slotIndex) &&
        opts.slotIndex >= 0 &&
        opts.slotIndex < account.inventory.length
      ) {
        targetIdx = opts.slotIndex;
      } else if (opts.rodInstanceId) {
        targetIdx = account.inventory.findIndex((s) => s.rodInstanceId === opts.rodInstanceId);
      } else if (typeof opts.itemId === 'number') {
        targetIdx = account.inventory.findIndex((s) => s.itemId === opts.itemId);
      }
      if (targetIdx < 0 || targetIdx >= account.inventory.length) {
        return { ok: false, message: 'Inventory slot not found.' };
      }
      const targetSlot = account.inventory[targetIdx];
      if (targetSlot.itemId === ITEM_IDS.FIST || targetSlot.itemId === ITEM_IDS.WRENCH) {
        return { ok: false, message: 'Core Fist and Tinker Wrench tools cannot be deleted.' };
      }
      const [removed] = account.inventory.splice(targetIdx, 1);
      const removedDef = getItemDef(removed.itemId);
      if (removedDef?.wearableSlot && account.equipped[removedDef.wearableSlot] === removed.itemId) {
        delete account.equipped[removedDef.wearableSlot];
      }
      this.savePlayer(account);
      return {
        ok: true,
        notice: `Deleted ${removed.qty}× ${removedDef?.name ?? `#${removed.itemId}`} from Backpack.`,
      };
    }
    if (opts.action === 'grant_item') {
      const itemId = Number(opts.itemId ?? 0);
      const qty = Math.max(1, Math.min(200, Math.floor(Number(opts.qty ?? 10))));
      const def = getItemDef(itemId);
      if (!def || itemId === ITEM_IDS.AIR) {
        return { ok: false, message: 'Invalid item selected.' };
      }
      this.addInventory(account, itemId, qty);
      this.savePlayer(account);
      return { ok: true, notice: `Granted ${qty}× ${def.name}.` };
    }
    if (opts.action === 'grow_all_trees') {
      if (!live) return { ok: false, message: 'Join a world to grow planted trees.' };
      const now = Date.now();
      const grownTiles: { tx: number; ty: number }[] = [];
      for (const plant of Object.values(live.state.plants)) {
        plant.maturityAt = now - 1000;
        grownTiles.push({ tx: plant.x, ty: plant.y });
      }
      live.state.revision += 1;
      this.saveWorld(live);
      return { ok: true, notice: `Matured ${grownTiles.length} planted trees.`, grownTiles };
    }
    if (opts.action === 'sys_paint_tile') {
      if (!live) return { ok: false, message: 'Join a world to modify tiles.' };
      const tx = Math.floor(Number(opts.tx ?? -1));
      const ty = Math.floor(Number(opts.ty ?? -1));
      const itemId = Number(opts.itemId ?? 0);
      const layer = opts.layer ?? 'fg';
      if (!inBoundsWorld(live.state, tx, ty)) {
        return { ok: false, message: 'Coordinates out of world bounds.' };
      }
      const changed = this.applyAdminTileSet(live, tx, ty, itemId, layer, account.id, account.name);
      if (!changed) {
        return { ok: false, message: 'Cannot modify that tile with selected item.' };
      }
      live.state.revision += 1;
      this.saveWorld(live);
      const name = getItemDef(itemId)?.name ?? 'Tile';
      return {
        ok: true,
        notice: `Placed ${name} at (${tx}, ${ty}) in ${live.state.name}.`,
        updatedTiles: [{ tx, ty }],
      };
    }
    if (opts.action === 'sys_clear_tile') {
      if (!live) return { ok: false, message: 'Join a world to modify tiles.' };
      const tx = Math.floor(Number(opts.tx ?? -1));
      const ty = Math.floor(Number(opts.ty ?? -1));
      const layer = opts.layer ?? 'fg';
      if (!inBoundsWorld(live.state, tx, ty)) {
        return { ok: false, message: 'Coordinates out of world bounds.' };
      }
      const changed = this.applyAdminTileSet(live, tx, ty, ITEM_IDS.AIR, layer, account.id, account.name);
      if (!changed) {
        return { ok: false, message: 'Cannot clear that tile.' };
      }
      live.state.revision += 1;
      this.saveWorld(live);
      return {
        ok: true,
        notice: `Cleared ${layer.toUpperCase()} at (${tx}, ${ty}) in ${live.state.name}.`,
        updatedTiles: [{ tx, ty }],
      };
    }
    if (opts.action === 'sys_fill_rect') {
      if (!live) return { ok: false, message: 'Join a world to fill tiles.' };
      const x1 = Math.max(0, Math.min((live.state.width || 100) - 1, Math.floor(Number(opts.tx ?? 0))));
      const y1 = Math.max(0, Math.min((live.state.height || 60) - 2, Math.floor(Number(opts.ty ?? 0))));
      const x2 = Math.max(0, Math.min((live.state.width || 100) - 1, Math.floor(Number(opts.tx2 ?? x1))));
      const y2 = Math.max(0, Math.min((live.state.height || 60) - 2, Math.floor(Number(opts.ty2 ?? y1))));
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      const area = (maxX - minX + 1) * (maxY - minY + 1);
      if (area > 400) {
        return { ok: false, message: `Selection too large (${area} tiles). Max 400 tiles per fill.` };
      }
      const itemId = Number(opts.itemId ?? ITEM_IDS.AIR);
      const layer = opts.layer ?? 'fg';
      const updatedTiles: { tx: number; ty: number }[] = [];
      for (let ty = minY; ty <= maxY; ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
          if (this.applyAdminTileSet(live, tx, ty, itemId, layer, account.id, account.name)) {
            updatedTiles.push({ tx, ty });
          }
        }
      }
      live.state.revision += 1;
      this.saveWorld(live);
      const itemLabel = itemId === ITEM_IDS.AIR ? 'Air (Clear)' : (getItemDef(itemId)?.name ?? `#${itemId}`);
      return {
        ok: true,
        notice: `Filled ${updatedTiles.length} tiles (${minX},${minY}→${maxX},${maxY}) with ${itemLabel}.`,
        updatedTiles: updatedTiles.length <= 36 ? updatedTiles : undefined,
        fullWorldSync: updatedTiles.length > 36,
      };
    }
    if (opts.action === 'sys_set_spawn') {
      if (!live) return { ok: false, message: 'Join a world to set spawn.' };
      const tx = Math.max(1, Math.min((live.state.width || 100) - 2, Math.floor(Number(opts.tx ?? live.state.spawnX))));
      const ty = Math.max(1, Math.min((live.state.height || 60) - 7, Math.floor(Number(opts.ty ?? live.state.spawnY))));
      live.state.spawnX = tx;
      live.state.spawnY = ty;
      const idx = tileIndexIn(live.state, tx, ty);
      this.clearTileMetadata(live, tx, ty);
      live.state.fg[idx] = ITEM_IDS.ENTRANCE_PORTAL;
      live.state.revision += 1;
      this.saveWorld(live);
      return {
        ok: true,
        notice: `Updated ${live.state.name} spawn point to (${tx}, ${ty}).`,
        fullWorldSync: true,
      };
    }
    if (opts.action === 'rebuild_nexus') {
      const nexusLive = this.getOrCreateWorld('NEXUS');
      const regenerated = this.hydrateWorldDefaults(generateWorld('NEXUS'));
      regenerated.revision = (nexusLive.state.revision ?? 1) + 1;
      nexusLive.state = regenerated;
      nexusLive.damage.clear();
      nexusLive.drops.clear();
      nexusLive.fluidFrontier = this.seedInitialFluidFrontier(regenerated);
      for (const k of Array.from(this.lastKnownPositions.keys())) {
        if (k.startsWith('NEXUS:')) this.lastKnownPositions.delete(k);
      }
      const defaultX = regenerated.spawnX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
      const defaultY = (regenerated.spawnY + 1) * TILE_SIZE - PLAYER_HEIGHT;
      for (const rp of nexusLive.players.values()) {
        rp.x = defaultX;
        rp.y = defaultY;
        rp.vx = 0;
        rp.vy = 0;
      }
      this.saveWorld(nexusLive);
      return {
        ok: true,
        notice: `Rebuilt NEXUS Sci-Fi Floating Platform Hub (v${NEXUS_LAYOUT_VERSION}).`,
        fullWorldSync: true,
      };
    }
    if (opts.action === 'sys_reset_world') {
      if (!live) return { ok: false, message: 'Join a world first.' };
      if (!isSystemWorld(live.state.name) && live.state.worldLock) {
        return { ok: false, message: 'Cannot reset player-owned realms. Only System & public worlds can be reset.' };
      }
      const regenerated = this.hydrateWorldDefaults(generateWorld(live.state.name));
      regenerated.revision = (live.state.revision ?? 1) + 1;
      live.state = regenerated;
      live.damage.clear();
      live.drops.clear();
      live.fluidFrontier = this.seedInitialFluidFrontier(regenerated);
      for (const k of Array.from(this.lastKnownPositions.keys())) {
        if (k.startsWith(`${live.state.name}:`)) this.lastKnownPositions.delete(k);
      }
      const defaultX = regenerated.spawnX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
      const defaultY = (regenerated.spawnY + 1) * TILE_SIZE - PLAYER_HEIGHT;
      for (const rp of live.players.values()) {
        rp.x = defaultX;
        rp.y = defaultY;
        rp.vx = 0;
        rp.vy = 0;
      }
      this.saveWorld(live);
      return {
        ok: true,
        notice: `Regenerated default layout for ${live.state.name}.`,
        fullWorldSync: true,
      };
    }
    return { ok: false, message: 'Unknown admin action.' };
  }

  getOrCreatePlayer(rawId: string, rawName: string): PlayerAccount {
    const id = this.safeFileId(rawId || crypto.randomUUID());
    const cleanName = (rawName || 'Explorer').trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 16) || 'Explorer';

    const existing = this.players.get(id);
    if (existing) {
      existing.name = cleanName;
      return this.hydrateAccountDefaults(existing);
    }

    const loaded = this.loadPlayerById(id);
    if (loaded) {
      loaded.name = cleanName;
      return loaded;
    }

    const created = this.createEmptyPlayerAccount(id, cleanName, '', 'player');
    this.players.set(id, created);
    this.savePlayer(created);
    return created;
  }

  findPlayerByNameOrId(query: string): PlayerAccount | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    for (const acc of this.players.values()) {
      if (acc.id.toLowerCase() === q || acc.name.toLowerCase() === q) {
        return acc;
      }
    }
    const files = fs.readdirSync(PLAYERS_DIR).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(PLAYERS_DIR, f), 'utf8')) as PlayerAccount;
        if (parsed.id.toLowerCase() === q || parsed.name.toLowerCase() === q) {
          this.hydrateAccountDefaults(parsed);
          this.players.set(parsed.id, parsed);
          return parsed;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  getFriendEntries(account: PlayerAccount): FriendEntry[] {
    return account.friends.map((fid) => {
      const friendAcc = this.findPlayerByNameOrId(fid);
      let online = false;
      let worldName: string | null = null;
      for (const live of this.worlds.values()) {
        if (live.players.has(fid)) {
          online = true;
          worldName = live.state.name;
          break;
        }
      }
      return {
        id: fid,
        name: friendAcc?.name ?? fid,
        online,
        worldName,
      };
    });
  }

  private persistPlayerNow(account: PlayerAccount) {
    if (account.processedTxIds.length > 200) {
      account.processedTxIds = account.processedTxIds.slice(-200);
    }
    if (isCloudSqlConfigured()) {
      void syncPlayerToSql(account);
      return;
    }
    const filePath = path.join(PLAYERS_DIR, `${this.safeFileId(account.id)}.json`);
    this.writeJsonAtomically(filePath, account);
  }

  savePlayer(account: PlayerAccount, immediate = false) {
    if (!isCloudSqlConfigured() || immediate) {
      const prevTimer = this.pendingPlayerSaves.get(account.id);
      if (prevTimer) {
        clearTimeout(prevTimer);
        this.pendingPlayerSaves.delete(account.id);
      }
      this.persistPlayerNow(account);
      return;
    }
    if (this.pendingPlayerSaves.has(account.id)) return;
    const timer = setTimeout(() => {
      this.pendingPlayerSaves.delete(account.id);
      this.persistPlayerNow(account);
    }, 550);
    this.pendingPlayerSaves.set(account.id, timer);
  }

  private hydrateWorldDefaults(state: WorldState): WorldState {
    state.width = state.width || 100;
    state.height = state.height || 60;
    state.worldKind = state.worldKind ?? 'standard';
    state.areaLocks = state.areaLocks ?? {};
    state.shareLocks = state.shareLocks ?? {};
    state.vendingMachines = state.vendingMachines ?? {};
    state.furnaces = state.furnaces ?? {};
    state.bfgCollectors = state.bfgCollectors ?? {};
    state.seedPots = state.seedPots ?? {};
    state.matteragenEngines = state.matteragenEngines ?? {};
    state.atmMachines = state.atmMachines ?? {};
    state.vaultboxes = state.vaultboxes ?? {};
    state.signs = state.signs ?? {};
    state.doorLinks = state.doorLinks ?? {};
    state.worldXp = Math.max(0, Math.floor(Number(state.worldXp ?? 0)));
    state.worldLevel = Math.max(1, Math.floor(Number(state.worldLevel ?? 1)));
    state.coreTokens = Math.max(0, Math.floor(Number(state.coreTokens ?? 0)));
    ensureFluidArrays(state);

    // Retire old physical lock blocks and convert existing ownership anchors to WorldCore.
    for (const oldLock of Object.values(state.areaLocks)) {
      const oldIndex = tileIndexIn(state, oldLock.x, oldLock.y);
      if (state.fg[oldIndex] === ITEM_IDS.SMALL_LOCK) state.fg[oldIndex] = ITEM_IDS.AIR;
    }
    state.areaLocks = {};
    for (const machine of Object.values(state.vendingMachines)) {
      if (machine.priceItemId === ITEM_IDS.WORLD_LOCK || machine.priceItemId === ITEM_IDS.SMALL_LOCK) {
        machine.priceItemId = ITEM_IDS.GP_RED_BRICKS;
      }
    }

    if (state.worldLock) {
      const oldIndex = tileIndexIn(state, state.worldLock.x, state.worldLock.y);
      if (state.fg[oldIndex] === ITEM_IDS.WORLD_LOCK) state.fg[oldIndex] = ITEM_IDS.AIR;
      const coreX = state.spawnX;
      const coreY = state.isPersonalRealm
        ? Math.max(1, state.spawnY - 3)
        : Math.min(state.height - 7, state.spawnY + 1);
      const coreIndex = tileIndexIn(state, coreX, coreY);
      state.fg[coreIndex] = ITEM_IDS.WORLD_CORE;
      state.worldLock.x = coreX;
      state.worldLock.y = coreY;
      state.worldLock.lockItemId = ITEM_IDS.WORLD_CORE;
      state.worldLock.publicAccess = Boolean(state.worldLock.publicAccess);
      state.worldLock.editors = Array.isArray(state.worldLock.editors) ? state.worldLock.editors : [];
      state.worldLock.editorNames = state.worldLock.editorNames ?? {};

      if (state.hasWorldCoreFurnace) {
        const fx = coreX + 1;
        const fy = Math.max(1, coreY - 1);
        state.coreFurnacePos = { x: fx, y: fy };
        state.bg[tileIndexIn(state, fx, fy)] = ITEM_IDS.STONE_FURNACE;
        const fKey = `${fx},${fy}`;
        if (!state.furnaces[fKey]) {
          state.furnaces[fKey] = {
            x: fx,
            y: fy,
            ownerId: state.worldLock.ownerId,
            recipeId: null,
            startedAt: null,
            finishesAt: null,
            readyOutputItemId: 0,
            readyOutputQty: 0,
          };
        }
      }
    }
    return state;
  }

  private seedInitialFluidFrontier(state: WorldState): Set<string> {
    const frontier = new Set<string>();
    const w = state.width || 100;
    const h = state.height || 60;
    const { fluidLevel } = ensureFluidArrays(state);
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const idx = ty * w + tx;
        const fg = state.fg[idx];
        if (fg === ITEM_IDS.WATER_SOURCE || fg === ITEM_IDS.ACID_SOURCE || fluidLevel[idx] > 0) {
          frontier.add(`${tx},${ty}`);
        }
      }
    }
    return frontier;
  }

  enqueueFluidNeighbors(live: LiveWorld, tx: number, ty: number) {
    for (const [nx, ny] of [
      [tx, ty],
      [tx - 1, ty],
      [tx + 1, ty],
      [tx, ty - 1],
      [tx, ty + 1],
    ]) {
      if (inBoundsWorld(live.state, nx, ny)) {
        live.fluidFrontier.add(`${nx},${ny}`);
      }
    }
  }

  getExistingWorld(worldName: string): LiveWorld | null {
    return this.worlds.get(worldName.trim().toUpperCase()) ?? null;
  }

  getOrCreateWorld(rawName: string): LiveWorld {
    const check = validateWorldName(rawName);
    const name = check.ok ? check.normalized : 'START';

    const cached = this.worlds.get(name);
    if (cached) return cached;

    const filePath = path.join(WORLDS_DIR, `${name}.json`);
    let state: WorldState;
    if (fs.existsSync(filePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as WorldState;
        if (name === 'NEXUS' && (parsed.nexusLayoutVersion ?? 0) !== NEXUS_LAYOUT_VERSION) {
          state = this.hydrateWorldDefaults(generateWorld('NEXUS'));
          for (const k of Array.from(this.lastKnownPositions.keys())) {
            if (k.startsWith('NEXUS:')) this.lastKnownPositions.delete(k);
          }
        } else {
          state = this.hydrateWorldDefaults(parsed);
        }
      } catch {
        state = generateWorld(name);
      }
    } else {
      state = generateWorld(name);
    }
    if (!isCloudSqlConfigured()) {
      this.writeJsonAtomically(filePath, state);
    }

    const live: LiveWorld = {
      state,
      players: new Map(),
      drops: new Map(),
      damage: new Map(),
      fluidFrontier: this.seedInitialFluidFrontier(state),
      activeCasts: new Map(),
      chatHistory: [
        {
          id: `sys_${Date.now()}`,
          senderId: 'system',
          senderName: 'Blockgrove',
          text: `Welcome to ${state.name}. ${state.worldLock ? `Locked by ${state.worldLock.ownerName}.` : 'This world is unlocked.'}`,
          timestamp: Date.now(),
          system: true,
        },
      ],
      dirty: false,
    };
    this.worlds.set(name, live);
    return live;
  }


  getUserPersonalWorld(userId: string): string | null {
    for (const live of this.worlds.values()) {
      if (live.state.worldLock?.ownerId === userId && live.state.isPersonalRealm) {
        return live.state.name;
      }
    }
    if (!isCloudSqlConfigured() && fs.existsSync(WORLDS_DIR)) {
      const files = fs.readdirSync(WORLDS_DIR).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(WORLDS_DIR, file), 'utf8');
          const data = JSON.parse(raw);
          if (data?.worldLock?.ownerId === userId && data?.isPersonalRealm) {
            return data.name || file.replace(/\.json$/, '');
          }
        } catch {
          // ignore corrupted files
        }
      }
    }
    return null;
  }

  createOwnedWorld(
    account: PlayerAccount,
    rawName: string,
    terraBlast = false
  ): { ok: true; worldName: string; notice: string } | { ok: false; message: string } {
    const existingRealm = this.getUserPersonalWorld(account.id);
    if (existingRealm) {
      return {
        ok: false,
        message: `You already own the personal sanctuary "${existingRealm}". Personal world generation is limited to 1 per user.`,
      };
    }

    const validation = validateWorldName(rawName);
    if (!validation.ok) return { ok: false, message: validation.reason ?? 'Invalid world name.' };
    const name = validation.normalized;
    const reserved = new Set(['START', 'TRADE', 'FARM']);
    if (isSystemWorld(name) || reserved.has(name)) {
      return { ok: false, message: 'That name is reserved for a system world.' };
    }
    const filePath = path.join(WORLDS_DIR, `${name}.json`);
    if (this.worlds.has(name) || (!isCloudSqlConfigured() && fs.existsSync(filePath))) {
      return { ok: false, message: 'That realm name is already taken. Choose another name.' };
    }
    if (terraBlast && !this.consumeInventory(account, ITEM_IDS.WORLD_BLAST, 1)) {
      return { ok: false, message: 'You need a World Blast to Terra Blast this realm.' };
    }

    const includeStarterLootbox = !account.hasClaimedStarterLootbox;
    const state = generateWorld(name, terraBlast, {
      isPersonalWorld: true,
      includeStarterLootbox,
    });
    state.isPersonalRealm = true;
    const coreX = state.spawnX; // 25
    const coreY = Math.max(1, state.spawnY - 3); // 16 (groundY - 4)
    const coreIndex = tileIndexIn(state, coreX, coreY);
    state.fg[coreIndex] = ITEM_IDS.WORLD_CORE;
    state.worldLock = {
      x: coreX,
      y: coreY,
      lockItemId: ITEM_IDS.WORLD_CORE,
      ownerId: account.id,
      ownerName: account.name,
      editors: [],
      editorNames: {},
      publicAccess: false,
    };
    state.revision += 1;

    const live: LiveWorld = {
      state,
      players: new Map(),
      drops: new Map(),
      damage: new Map(),
      fluidFrontier: this.seedInitialFluidFrontier(state),
      activeCasts: new Map(),
      chatHistory: [{
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: 'Alterbit Realms',
        text: `Welcome to ${name}. This 50×40 realm belongs to ${account.name}. Break the Starter Supply Lootbox beside the portal to claim your Farming Hoe, Dirt & Radish Seeds!`,
        timestamp: Date.now(),
        system: true,
      }],
      dirty: false,
    };
    this.worlds.set(name, live);
    this.saveWorld(live, true);
    account.ownedWorldName = name;
    this.savePlayer(account, true);
    return {
      ok: true,
      worldName: name,
      notice: terraBlast
        ? `Terra Blasted 50×40 realm ${name} created. World Blast consumed.`
        : `50×40 Realm ${name} created! Break the Starter Supply Lootbox beside your Entrance Portal.`,
    };
  }

  private persistWorldNow(live: LiveWorld) {
    if (live.state.worldKind === 'mine_shaft') {
      live.dirty = false;
      return;
    }
    if (isCloudSqlConfigured()) {
      void syncWorldToSql(live.state);
      live.dirty = false;
      return;
    }
    const filePath = path.join(WORLDS_DIR, `${live.state.name}.json`);
    this.writeJsonAtomically(filePath, live.state);
    live.dirty = false;
  }

  saveWorld(live: LiveWorld, immediate = false) {
    if (live.state.worldKind === 'mine_shaft') {
      live.dirty = false;
      return;
    }
    if (!isCloudSqlConfigured() || immediate) {
      const prevTimer = this.pendingWorldSaves.get(live.state.name);
      if (prevTimer) {
        clearTimeout(prevTimer);
        this.pendingWorldSaves.delete(live.state.name);
      }
      this.persistWorldNow(live);
      return;
    }
    live.dirty = true;
    if (this.pendingWorldSaves.has(live.state.name)) return;
    const timer = setTimeout(() => {
      this.pendingWorldSaves.delete(live.state.name);
      this.persistWorldNow(live);
    }, 600);
    this.pendingWorldSaves.set(live.state.name, timer);
  }

  flushPendingSavesNow() {
    for (const [wName, timer] of this.pendingWorldSaves.entries()) {
      clearTimeout(timer);
      this.pendingWorldSaves.delete(wName);
      const live = this.worlds.get(wName);
      if (live) this.persistWorldNow(live);
    }
    for (const [pId, timer] of this.pendingPlayerSaves.entries()) {
      clearTimeout(timer);
      this.pendingPlayerSaves.delete(pId);
      const acc = this.players.get(pId);
      if (acc) this.persistPlayerNow(acc);
    }
    this.flushDirtyWorlds();
  }

  listWorlds(): WorldSummary[] {
    const names = new Set<string>(['START', 'NEXUS', 'DWELLER', 'FISHING', 'STATION', 'TRADE', 'FARM']);
    if (!isCloudSqlConfigured() && fs.existsSync(WORLDS_DIR)) {
      const files = fs.readdirSync(WORLDS_DIR).filter((f) => f.endsWith('.json'));
      for (const f of files) names.add(f.replace(/\.json$/, ''));
    }
    for (const [k, lw] of this.worlds.entries()) {
      if (lw.state.worldKind !== 'mine_shaft') names.add(k);
    }

    const summaries: WorldSummary[] = [];
    for (const name of names) {
      const live = this.getOrCreateWorld(name);
      if (live.state.worldKind === 'mine_shaft') continue;
      summaries.push({
        name: live.state.name,
        playerCount: live.players.size,
        ownerName: live.state.worldLock?.ownerName ?? null,
        ownerId: live.state.worldLock?.ownerId ?? null,
        publicAccess: live.state.worldLock ? live.state.worldLock.publicAccess : true,
        worldKind: live.state.worldKind ?? 'standard',
      });
    }
    return summaries.sort((a, b) => b.playerCount - a.playerCount || a.name.localeCompare(b.name));
  }

  flushDirtyWorlds(): number {
    let flushed = 0;
    for (const live of this.worlds.values()) {
      if (live.dirty && live.state.worldKind !== 'mine_shaft') {
        this.saveWorld(live, true);
        flushed += 1;
      }
    }
    return flushed;
  }

  recordPlayerPose(worldName: string, playerId: string, pose: ResumePosition) {
    this.lastKnownPositions.set(`${worldName}:${playerId}`, {
      pose,
      savedAt: Date.now(),
    });
  }

  joinWorld(
    account: PlayerAccount,
    rawWorldName: string,
    resumePosition?: ResumePosition
  ):
    | { ok: true; world: LiveWorld; remote: RemotePlayerState; resumed: boolean }
    | { ok: false; message: string } {
    const v = validateWorldName(rawWorldName);
    if (!v.ok) return { ok: false, message: v.reason ?? 'Invalid world name.' };

    if (v.normalized.startsWith('MINE_') && !this.worlds.has(v.normalized)) {
      return { ok: false, message: 'This Mining Shaft has collapsed or expired.' };
    }

    const live = this.getOrCreateWorld(v.normalized);
    const isAdmin = account.role === 'admin';
    const enterCheck = canEnterWorld(live.state, account.id);
    if (!enterCheck.ok && !isAdmin) {
      return { ok: false, message: enterCheck.reason ?? 'World access is restricted.' };
    }

    const ownerId = live.state.worldLock?.ownerId;
    const playerLimit = ownerId ? MAX_OWNED_WORLD_PLAYERS : MAX_WORLD_PLAYERS;
    const ownerAlreadyPresent = ownerId ? live.players.has(ownerId) : true;
    const visitorLimit = ownerId && !ownerAlreadyPresent && account.id !== ownerId
      ? playerLimit - 1
      : playerLimit;
    if (!isAdmin && live.players.size >= visitorLimit && !live.players.has(account.id)) {
      return {
        ok: false,
        message: `World ${v.normalized} is full (${playerLimit}/${playerLimit}).`,
      };
    }

    if (live.state.worldKind !== 'mine_shaft') {
      account.recentWorlds = [
        live.state.name,
        ...account.recentWorlds.filter((w) => w !== live.state.name),
      ].slice(0, 8);
      this.savePlayer(account);
    }

    const posKey = `${live.state.name}:${account.id}`;
    const savedPoseEntry = this.lastKnownPositions.get(posKey);
    const candidatePose =
      resumePosition ??
      (savedPoseEntry && Date.now() - savedPoseEntry.savedAt < 10 * 60 * 1000
        ? savedPoseEntry.pose
        : undefined);

    const maxPxX = ((live.state.width || 100) - 1) * TILE_SIZE;
    const maxPxY = ((live.state.height || 60) - 1) * TILE_SIZE;
    const defaultX = live.state.spawnX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
    const defaultY = (live.state.spawnY + 1) * TILE_SIZE - PLAYER_HEIGHT;

    let spawnX = defaultX;
    let spawnY = defaultY;
    let facing: 1 | -1 = 1;
    let grounded = true;
    let resumed = false;

    if (
      candidatePose &&
      Number.isFinite(candidatePose.x) &&
      Number.isFinite(candidatePose.y) &&
      candidatePose.x >= 0 &&
      candidatePose.x <= maxPxX &&
      candidatePose.y >= 0 &&
      candidatePose.y <= maxPxY
    ) {
      spawnX = candidatePose.x;
      spawnY = candidatePose.y;
      facing = candidatePose.facing === -1 ? -1 : 1;
      grounded = Boolean(candidatePose.grounded);
      resumed = true;
    }

    const remote: RemotePlayerState = {
      id: account.id,
      name: account.name,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      facing,
      grounded,
      punching: false,
      shirtColor: account.shirtColor,
      level: account.level,
      cropMasteryLevel: account.cropMasteryLevel ?? 1,
      farmablockMasteryLevel: account.farmablockMasteryLevel ?? 1,
      equipped: account.equipped,
      role: account.role,
    };
    live.players.set(account.id, remote);
    this.recordPlayerPose(live.state.name, account.id, {
      x: remote.x,
      y: remote.y,
      vx: 0,
      vy: 0,
      facing: remote.facing,
      grounded: remote.grounded,
    });
    return { ok: true, world: live, remote, resumed };
  }

  leaveWorld(worldName: string, playerId: string, explicitExit = false) {
    const live = this.worlds.get(worldName);
    if (!live) return;
    const existing = live.players.get(playerId);
    if (existing && !explicitExit) {
      this.recordPlayerPose(worldName, playerId, {
        x: existing.x,
        y: existing.y,
        vx: existing.vx,
        vy: existing.vy,
        facing: existing.facing,
        grounded: existing.grounded,
      });
    } else if (explicitExit) {
      this.lastKnownPositions.delete(`${worldName}:${playerId}`);
    }
    live.players.delete(playerId);
    live.activeCasts.delete(playerId);
    if (explicitExit && live.state.worldKind === 'mine_shaft' && live.players.size === 0) {
      this.worlds.delete(worldName);
      return;
    }
    if (live.dirty) {
      this.saveWorld(live);
    }
  }

  getInventoryRoomForItem(account: PlayerAccount, itemId: number): number {
    if (itemId === ITEM_IDS.FIST || itemId === ITEM_IDS.WRENCH) return 1;
    const def = getItemDef(itemId);
    if (!def) return 0;
    if (def.maxDurability || def.toolKind === 'rod') {
      return Math.max(0, MAX_INVENTORY_SLOTS - getOccupiedBackpackSlots(account.inventory));
    }
    const maxStack = Math.min(MAX_STACK_SIZE, Math.max(1, def.stackLimit || MAX_STACK_SIZE));
    const existing = account.inventory.find((s) => s.itemId === itemId);
    if (existing) {
      return Math.max(0, maxStack - existing.qty);
    }
    if (getOccupiedBackpackSlots(account.inventory) >= MAX_INVENTORY_SLOTS) {
      return 0;
    }
    return maxStack;
  }

  addInventoryPartial(account: PlayerAccount, itemId: number, qty: number): number {
    if (qty <= 0) return 0;
    const def = getItemDef(itemId);
    if (!def) return 0;
    const reqQty = Math.floor(qty);
    if (reqQty <= 0) return 0;

    if (def.maxDurability || def.toolKind === 'rod') {
      const availableSlots = Math.max(0, MAX_INVENTORY_SLOTS - getOccupiedBackpackSlots(account.inventory));
      const toAdd = Math.min(reqQty, availableSlots);
      for (let i = 0; i < toAdd; i++) {
        account.inventory.push({
          itemId,
          qty: 1,
          durability: def.maxDurability,
          maxDurability: def.maxDurability,
          ...(def.toolKind === 'rod' ? { rodInstanceId: crypto.randomUUID(), rodUpgradeLevel: 1 as const } : {}),
        });
      }
      return toAdd;
    }

    const maxStack = Math.min(MAX_STACK_SIZE, Math.max(1, def.stackLimit || MAX_STACK_SIZE));
    const slot = account.inventory.find((s) => s.itemId === itemId);
    if (slot) {
      const room = Math.max(0, maxStack - slot.qty);
      const added = Math.min(room, reqQty);
      slot.qty += added;
      return added;
    }
    if (getOccupiedBackpackSlots(account.inventory) >= MAX_INVENTORY_SLOTS) {
      return 0;
    }
    const added = Math.min(maxStack, reqQty);
    account.inventory.push({ itemId, qty: added });
    return added;
  }

  addInventory(account: PlayerAccount, itemId: number, qty: number): boolean {
    return this.addInventoryPartial(account, itemId, qty) > 0;
  }

  claimOverflowVault(
    account: PlayerAccount,
    targetItemId?: number
  ): { ok: true; claimedQty: number; notice: string } | { ok: false; message: string } {
    account.overflowVault = account.overflowVault ?? [];
    if (account.overflowVault.length === 0) {
      return { ok: false, message: 'Overflow Vault is empty.' };
    }
    let totalClaimed = 0;
    for (const entry of account.overflowVault) {
      if (targetItemId !== undefined && entry.itemId !== targetItemId) continue;
      if (entry.qty <= 0) continue;
      const added = this.addInventoryPartial(account, entry.itemId, entry.qty);
      if (added > 0) {
        entry.qty -= added;
        totalClaimed += added;
      }
    }
    account.overflowVault = account.overflowVault.filter((e) => e.qty > 0);
    if (totalClaimed <= 0) {
      return {
        ok: false,
        message: 'Backpack is full (20/20 slots or 500 stack cap). Free a slot first.',
      };
    }
    this.savePlayer(account, true);
    return {
      ok: true,
      claimedQty: totalClaimed,
      notice: `Claimed ${totalClaimed} item${totalClaimed === 1 ? '' : 's'} from Overflow Vault!`,
    };
  }

  consumeInventory(account: PlayerAccount, itemId: number, qty: number): boolean {
    const def = getItemDef(itemId);
    if ((def?.maxDurability || def?.toolKind === 'rod') && qty >= 1) {
      let removed = 0;
      const kept: InventorySlot[] = [];
      for (const s of account.inventory) {
        if (s.itemId === itemId && removed < qty) {
          removed += 1;
        } else {
          kept.push(s);
        }
      }
      if (removed < qty) return false;
      account.inventory = kept;
      return true;
    }
    const slot = account.inventory.find((s) => s.itemId === itemId);
    if (!slot || slot.qty < qty) return false;
    slot.qty -= qty;
    if (slot.qty <= 0 && itemId !== ITEM_IDS.FIST && itemId !== ITEM_IDS.WRENCH) {
      account.inventory = account.inventory.filter((s) => s.itemId !== itemId);
    }
    return true;
  }

  public tryAwardCoreToken(
    live: LiveWorld,
    account: PlayerAccount,
    source: CoreTokenSource,
    rng: () => number = Math.random
  ): boolean {
    // Core Tokens are strictly relative to the World and only earned by the World Owner inside their owned world
    if (!live.state.worldLock || live.state.worldLock.ownerId !== account.id) return false;
    if (!live.players.has(account.id)) return false;
    const chance = getCoreTokenSpawnChance(source);
    if (rng() < chance) {
      // Strictly +1 Core Token per proc, transferred directly to WorldCore storage (no capacity limit)
      live.state.coreTokens = Math.max(0, Math.floor(Number(live.state.coreTokens ?? 0))) + 1;
      return true;
    }
    return false;
  }

  private awardWorldXp(
    live: LiveWorld,
    account: PlayerAccount,
    gained: number
  ): { worldXp: number; worldLevel: number; coreTokens: number; leveledUp: boolean } | null {
    if (gained <= 0) return null;
    // World only gains XP from its owner's actions while the owner is actively inside the world
    if (!live.state.worldLock || live.state.worldLock.ownerId !== account.id) return null;
    if (!live.players.has(account.id)) return null;
    const next = addWorldXp(live.state.worldLevel ?? 1, live.state.worldXp ?? 0, gained);
    live.state.worldLevel = next.level;
    live.state.worldXp = next.xp;
    const coreTokens = Math.max(0, Math.floor(Number(live.state.coreTokens ?? 0)));
    return { worldXp: next.xp, worldLevel: next.level, coreTokens, leveledUp: next.leveledUp };
  }

  private grantCropMasteryXp(account: PlayerAccount, gained: number): boolean {
    if (gained <= 0) return false;
    const res = addMasteryXp(account.cropMasteryLevel ?? 1, account.cropMasteryXp ?? 0, gained);
    account.cropMasteryLevel = res.level;
    account.cropMasteryXp = res.xp;
    return res.leveledUp;
  }

  private grantFarmablockMasteryXp(account: PlayerAccount, gained: number): boolean {
    if (gained <= 0) return false;
    const res = addMasteryXp(account.farmablockMasteryLevel ?? 1, account.farmablockMasteryXp ?? 0, gained);
    account.farmablockMasteryLevel = res.level;
    account.farmablockMasteryXp = res.xp;
    return res.leveledUp;
  }

  handlePunchTile(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    toolItemId?: number,
    adminEdit = false
  ):
    | { ok: false; reason?: string }
    | {
        ok: true;
        broken: boolean;
        layer: 'fg' | 'bg' | 'plant' | 'fluid';
        hits: number;
        maxHits: number;
        drops: WorldDrop[];
        xpGained: number;
        gemsGained: number;
        worldXpUpdate?: { worldXp: number; worldLevel: number; coreTokens: number; leveledUp: boolean } | null;
        notice?: string;
      } {
    const effectiveAdminEdit = account.role === 'admin' && Boolean(adminEdit);
    const now = Date.now();
    const prevPunch = this.lastPunchAt.get(account.id) ?? 0;
    const breakSpeedBuff = this.getBuffBonusPct(account, 'break_speed');
    const baseCooldown = effectiveAdminEdit
      ? 65
      : Math.max(50, this.gameConfig.mechanics.punchCooldownMs - 35);
    const punchCooldown = breakSpeedBuff > 0 ? Math.max(45, Math.round(baseCooldown * 0.72)) : baseCooldown;
    if (now - prevPunch < punchCooldown) {
      return { ok: false };
    }
    this.lastPunchAt.set(account.id, now);

    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false };

    const reach = effectiveAdminEdit
      ? Math.max(12, this.gameConfig.mechanics.reachTiles)
      : this.gameConfig.mechanics.reachTiles;
    const check = canBreakTile(
      live.state,
      { id: account.id, x: playerState.x, y: playerState.y, adminWorldEdit: effectiveAdminEdit },
      tx,
      ty,
      reach
    );
    if (!check.ok || !check.layer) {
      return { ok: false, reason: check.reason };
    }

    const key = `${tx},${ty}`;
    const idx = tileIndexIn(live.state, tx, ty);

    // Fluid scooping / draining with Fist
    if (check.layer === 'fluid') {
      ensureFluidArrays(live.state);
      live.state.fluidType![idx] = 0;
      live.state.fluidLevel![idx] = 0;
      live.state.revision += 1;
      this.enqueueFluidNeighbors(live, tx, ty);
      this.saveWorld(live);
      return {
        ok: true,
        broken: true,
        layer: 'fluid',
        hits: 1,
        maxHits: 1,
        drops: [],
        xpGained: 0,
        gemsGained: 0,
      };
    }

    // Active Pickaxe tool power & luck
    let toolPower = 1;
    let pickaxeBonusChance = 0;
    let usedPickaxeSlot: InventorySlot | undefined;
    if (toolItemId && !effectiveAdminEdit) {
      const candidate = account.inventory.find(
        (s) => s.itemId === toolItemId && s.qty >= 1 && (s.durability ?? 1) > 0
      );
      const tDef = candidate ? getItemDef(candidate.itemId) : undefined;
      if (candidate && tDef?.toolKind === 'pickaxe') {
        usedPickaxeSlot = candidate;
        toolPower = tDef.toolPower ?? 2;
        if (tDef.id === ITEM_IDS.IRON_PICKAXE) pickaxeBonusChance = 0.15;
        if (tDef.id === ITEM_IDS.CRYSTAL_PICKAXE) pickaxeBonusChance = 0.30;
      }
    }
    const luckPct = this.getBuffBonusPct(account, 'luck');
    const bonusMultiplier = 1 + luckPct / 100 + pickaxeBonusChance;

    let maxHits = 3;
    let targetDef = getEffectiveItemDef(ITEM_IDS.GP_DIRT, this.gameConfig);
    if (check.layer === 'plant') {
      const plant = live.state.plants[key];
      const growth = getPlantGrowthState(plant, now);
      maxHits = effectiveAdminEdit ? 1 : growth.stage === 'mature' ? 1 : 2;
      targetDef = getEffectiveItemDef(plant.seedId, this.gameConfig);
    } else if (check.layer === 'fg') {
      const atm = live.state.atmMachines?.[key];
      if (atm && atm.isReady && !effectiveAdminEdit) {
        const stored = Math.max(5, Math.min(125, Math.round(atm.storedGems || 0)));
        const gemDrop: WorldDrop = {
          id: `gem_${Date.now()}_atm_${Math.random().toString(36).slice(2, 7)}`,
          itemId: 0,
          qty: stored,
          x: tx * TILE_SIZE + TILE_SIZE * 0.5,
          y: ty * TILE_SIZE + TILE_SIZE * 0.5 - 8,
          isGem: true,
        };
        live.drops.set(gemDrop.id, gemDrop);

        const leveled = addXp(account.level, account.xp, 12);
        account.level = leveled.level;
        account.xp = leveled.xp;
        playerState.level = account.level;
        const tokenEarned = this.tryAwardCoreToken(live, account, { kind: 'atm_harvest' });
        const worldXpUpdate = this.awardWorldXp(live, account, 8);

        atm.isReady = false;
        atm.storedGems = 0;
        atm.lastHarvestMs = now;
        atm.intervalMs = rollAtmIntervalMs();
        live.damage.delete(key);
        live.state.revision += 1;
        live.dirty = true;
        this.saveWorld(live);
        this.savePlayer(account);
        return {
          ok: true,
          broken: false,
          layer: 'fg',
          hits: 0,
          maxHits: 1,
          drops: [gemDrop],
          xpGained: 12,
          gemsGained: stored,
          worldXpUpdate,
          notice: `Collected ${stored} Gems from ATM Machine${tokenEarned ? ' (+1 Core Token!)' : ''}!`,
        };
      }
      targetDef = getEffectiveItemDef(live.state.fg[idx], this.gameConfig);
      maxHits = effectiveAdminEdit ? 1 : Math.max(1, targetDef?.hardness ?? 3);
    } else {
      targetDef = getEffectiveItemDef(live.state.bg[idx], this.gameConfig);
      maxHits = effectiveAdminEdit ? 1 : Math.max(1, targetDef?.hardness ?? 2);
    }

    const hitDamage = effectiveAdminEdit
      ? 1
      : check.layer === 'plant'
        ? 1
        : toolPower + (breakSpeedBuff > 0 && Math.random() < 0.3 ? 1 : 0);

    const existing = live.damage.get(key);
    const hits =
      existing && existing.layer === check.layer && now - existing.lastHitAt < 4000
        ? existing.hits + hitDamage
        : hitDamage;

    if (hits < maxHits) {
      live.damage.set(key, { hits, lastHitAt: now, layer: check.layer });
      return {
        ok: true,
        broken: false,
        layer: check.layer,
        hits: Math.min(maxHits, hits),
        maxHits,
        drops: [],
        xpGained: 0,
        gemsGained: 0,
      };
    }

    // Tile broken!
    live.damage.delete(key);
    live.state.revision += 1;
    const spawnedDrops: WorldDrop[] = [];
    let xpGained = targetDef?.xpValue ?? 1;
    let gemsGained = 0;
    let notice: string | undefined;
    const isMineShaft = live.state.worldKind === 'mine_shaft';
    const suppressDrops = false;

    let tokenSource: CoreTokenSource | null = { kind: 'block_break' };
    if (check.layer === 'plant') {
      const plant = live.state.plants[key];
      const growth = getPlantGrowthState(plant, now);
      delete live.state.plants[key];
      if (live.state.seedPots?.[key]) {
        live.state.seedPots[key].hasPlant = false;
      }
      if (!suppressDrops) {
        if (growth.stage === 'mature' && targetDef?.producesTileId) {
          account.stats.treesHarvested = (account.stats.treesHarvested ?? 0) + 1;
          if (isCropSeed(plant.seedId)) {
            const cropIdx = CROP_SPECS.findIndex((c) => c.seedId === plant.seedId);
            const cropTier = Math.max(1, Math.min(6, cropIdx >= 0 ? cropIdx + 1 : 1)) as 1 | 2 | 3 | 4 | 5 | 6;
            tokenSource = { kind: 'soil_crop', tier: cropTier };
            // Harvesting a mature Crop plant spawns the relative Crop Block in place!
            live.state.fg[idx] = targetDef.producesTileId;
            xpGained = targetDef.xpValue ?? 4;
            gemsGained = 0;
            this.grantCropMasteryXp(account, getCropMasteryXpGrant(plant.seedId));
            const blockDef = getItemDef(targetDef.producesTileId);
            notice = `${blockDef?.name ?? 'Crop Block'} ripened!`;
          } else {
            const producedDef = getEffectiveItemDef(targetDef.producesTileId, this.gameConfig);
            const farmTier = (targetDef.farmableTier ?? producedDef?.farmableTier ?? 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
            tokenSource = { kind: 'farmable_harvest', tier: farmTier };
            for (const reward of rollTreeHarvestRewards(plant.seedId, targetDef, luckPct)) {
              spawnedDrops.push(this.createDrop(live, reward.itemId, reward.qty, tx, ty, spawnedDrops.length));
            }
            if (!isMineShaft) {
              gemsGained =
                farmTier > 0
                  ? farmTier * 3 + Math.floor(Math.random() * (farmTier * 2 + 3))
                  : 2 + Math.floor(Math.random() * 4);
            }
            xpGained += 4;
            this.grantFarmablockMasteryXp(account, getFarmablockMasteryXpGrant(plant.seedId));
          }
        } else {
          // Immature plant (Stages 0–2): returns 1x seed only, 0 produce, 0 Mastery XP
          tokenSource = null;
          xpGained = 0;
          gemsGained = 0;
          spawnedDrops.push(this.createDrop(live, plant.seedId, 1, tx, ty, spawnedDrops.length));
        }
      }
    } else if (check.layer === 'fg') {
      const prevFg = live.state.fg[idx];
      if (isCropBlock(prevFg)) {
        const cropIdx = CROP_SPECS.findIndex((c) => c.blockId === prevFg);
        const cropTier = Math.max(1, Math.min(6, cropIdx >= 0 ? cropIdx + 1 : 1)) as 1 | 2 | 3 | 4 | 5 | 6;
        tokenSource = { kind: 'soil_crop', tier: cropTier };
        this.grantCropMasteryXp(account, getCropMasteryXpGrant(prevFg));
      } else if (targetDef?.farmableTier || targetDef?.category === 'farmable') {
        tokenSource = { kind: 'farmable_harvest', tier: (targetDef.farmableTier ?? 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 };
        this.grantFarmablockMasteryXp(account, getFarmablockMasteryXpGrant(prevFg));
      }
      live.state.fg[idx] = ITEM_IDS.AIR;
      if (!suppressDrops) {
        account.stats.blocksBroken = (account.stats.blocksBroken ?? 0) + 1;
      }

      if (
        prevFg === ITEM_IDS.COAL_VEIN ||
        prevFg === ITEM_IDS.COPPER_VEIN ||
        prevFg === ITEM_IDS.IRON_VEIN ||
        prevFg === ITEM_IDS.CRYSTAL_ORE ||
        prevFg === ITEM_IDS.OBSIDIAN_VEIN
      ) {
        if (!suppressDrops) {
          account.stats.oresMined = (account.stats.oresMined ?? 0) + 1;
        }
      }

      if (getShareLockSpec(prevFg) && live.state.shareLocks) {
        delete live.state.shareLocks[key];
      }
      if (prevFg === ITEM_IDS.SMALL_LOCK && live.state.areaLocks) {
        delete live.state.areaLocks[key];
      }
      if (prevFg === ITEM_IDS.VENDING_MACHINE && live.state.vendingMachines) {
        delete live.state.vendingMachines[key];
      }
      if (prevFg === ITEM_IDS.STONE_FURNACE && live.state.furnaces) {
        delete live.state.furnaces[key];
      }
      if (prevFg === ITEM_IDS.BFG_COLLECTOR && live.state.bfgCollectors) {
        delete live.state.bfgCollectors[key];
      }
      if (getItemDef(prevFg)?.key.includes('sign') && live.state.signs) {
        delete live.state.signs[key];
      }
      if (isDoorBlock(prevFg) && live.state.doorLinks) {
        delete live.state.doorLinks[key];
      }
      if (live.state.matteragenEngines?.[key]) {
        delete live.state.matteragenEngines[key];
      }
      if (live.state.atmMachines?.[key]) {
        delete live.state.atmMachines[key];
      }
      if (live.state.vaultboxes?.[key]) {
        delete live.state.vaultboxes[key];
      }
      if (prevFg === ITEM_IDS.SEED_POT && live.state.seedPots) {
        delete live.state.seedPots[key];
      }

      this.enqueueFluidNeighbors(live, tx, ty);

      if (prevFg === ITEM_IDS.STARTER_LOOTBOX) {
        if (!account.hasClaimedStarterLootbox) {
          account.hasClaimedStarterLootbox = true;
          if (!account.inventory.some((s) => s.itemId === ITEM_IDS.FARMING_HOE && s.qty >= 1)) {
            this.addInventory(account, ITEM_IDS.FARMING_HOE, 1);
          }
          this.addInventory(account, ITEM_IDS.GP_DIRT, 25);
          this.addInventory(account, ITEM_IDS.CROP_SEED_RADISH, 3);
          notice =
            'Starter Lootbox opened: +1 Farming Hoe, +25 Dirt Block & +3 Radish Seed.';
        } else {
          notice = 'Starter Lootbox already claimed.';
        }
      } else if (!suppressDrops && targetDef?.drops) {
        for (const d of targetDef.drops) {
          const dropDef = getItemDef(d.itemId);
          if (dropDef?.category === 'seed' && !isFarmableSeed(d.itemId) && !isCropSeed(d.itemId)) continue;
          const effChance = isCropBlock(prevFg) ? d.chance : Math.min(1, d.chance * bonusMultiplier);
          if (Math.random() <= effChance) {
            let qty = d.minQty + Math.floor(Math.random() * (d.maxQty - d.minQty + 1));
            if (!isCropBlock(prevFg) && isMineShaft && pickaxeBonusChance > 0 && Math.random() < pickaxeBonusChance) {
              qty += 1;
            }
            if (qty > 0) {
              spawnedDrops.push(this.createDrop(live, d.itemId, qty, tx, ty, spawnedDrops.length));
            }
          }
        }
      }
      const isFarmableBlock = targetDef?.category === 'farmable' || Boolean(targetDef?.farmableTier);
      const effectiveGemChance = isFarmableBlock
        ? Math.max(0.88, this.gameConfig.mechanics.globalGemDropChance)
        : this.gameConfig.mechanics.globalGemDropChance;
      if (!suppressDrops && !isMineShaft && targetDef && targetDef.gemValue > 0 && Math.random() <= effectiveGemChance) {
        if (isFarmableBlock) {
          const minGems = Math.max(2, Math.ceil(targetDef.gemValue * 0.45));
          const span = Math.max(1, targetDef.gemValue - minGems + 1);
          gemsGained = minGems + Math.floor(Math.random() * span);
        } else {
          gemsGained = 1 + Math.floor(Math.random() * targetDef.gemValue);
        }
      }

      // Decrement Pickaxe durability on foreground break
      if (usedPickaxeSlot && typeof usedPickaxeSlot.durability === 'number') {
        usedPickaxeSlot.durability = Math.max(0, usedPickaxeSlot.durability - 1);
        if (usedPickaxeSlot.durability === 0) {
          const pName = getItemDef(usedPickaxeSlot.itemId)?.name ?? 'Pickaxe';
          notice = `${pName} reached 0 durability! Repair it at a Stone Furnace.`;
        }
      }
    } else {
      const prevBg = live.state.bg[idx];
      if (isDoorBlock(prevBg) && live.state.doorLinks) {
        delete live.state.doorLinks[key];
      }
      live.state.bg[idx] = ITEM_IDS.BG_SKY;
      if (!suppressDrops) {
        account.stats.blocksBroken = (account.stats.blocksBroken ?? 0) + 1;
        if (targetDef?.drops) {
          for (const d of targetDef.drops) {
            if (Math.random() <= Math.min(1, d.chance * (1 + luckPct / 100))) {
              const qty = d.minQty + Math.floor(Math.random() * (d.maxQty - d.minQty + 1));
              if (qty > 0) {
                spawnedDrops.push(this.createDrop(live, d.itemId, qty, tx, ty, spawnedDrops.length));
              }
            }
          }
        }
        if (
          !isMineShaft &&
          targetDef &&
          targetDef.gemValue > 0 &&
          Math.random() <= this.gameConfig.mechanics.globalGemDropChance * 0.5
        ) {
          gemsGained = 1 + Math.floor(Math.random() * targetDef.gemValue);
        }
      }
    }

    if (gemsGained > 0) {
      const gemSpreadOffsets: ReadonlyArray< readonly [number, number] > = [
        [0, 0],
        [-15, -7],
        [15, -7],
        [-12, 10],
        [12, 10],
        [0, -13],
        [-18, 3],
        [18, 3],
        [-7, 13],
        [7, -12],
      ];
      const packetCount = gemsGained >= 14 ? 3 : gemsGained >= 5 ? 2 : 1;
      let remGems = gemsGained;
      for (let p = 0; p < packetCount; p++) {
        const chunkQty = p === packetCount - 1 ? remGems : Math.max(1, Math.floor(gemsGained / packetCount));
        remGems -= chunkQty;
        if (chunkQty <= 0) continue;
        const spreadIdx = (spawnedDrops.length + (spawnedDrops.length === 0 && p === 0 ? 0 : 1)) % gemSpreadOffsets.length;
        const [gxOff, gyOff] = gemSpreadOffsets[spreadIdx];
        const gemDrop: WorldDrop = {
          id: `gem_${Date.now()}_${p}_${Math.random().toString(36).slice(2, 7)}`,
          itemId: 0,
          qty: chunkQty,
          x: tx * TILE_SIZE + TILE_SIZE * 0.5 + gxOff,
          y: ty * TILE_SIZE + TILE_SIZE * 0.5 + gyOff,
          isGem: true,
        };
        spawnedDrops.push(gemDrop);
        live.drops.set(gemDrop.id, gemDrop);
      }
    }

    if (xpGained > 0) {
      const leveled = addXp(account.level, account.xp, xpGained);
      account.level = leveled.level;
      account.xp = leveled.xp;
      playerState.level = account.level;
    }

    if (!suppressDrops && tokenSource) {
      const tokenEarned = this.tryAwardCoreToken(live, account, tokenSource);
      if (tokenEarned) {
        notice = notice
          ? `${notice} (+1 Core Token!)`
          : '+1 Core Token stored in WorldCore!';
      }
    }
    const worldXpGain = suppressDrops || !tokenSource ? 0 : (targetDef?.worldXpValue ?? Math.max(1, xpGained));
    const worldXpUpdate = this.awardWorldXp(live, account, worldXpGain);

    this.saveWorld(live);
    this.savePlayer(account);

    return {
      ok: true,
      broken: true,
      layer: check.layer,
      hits: maxHits,
      maxHits,
      drops: spawnedDrops,
      xpGained,
      gemsGained: 0,
      worldXpUpdate,
      notice,
    };
  }

  handlePlowTile(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    adminEdit = false
  ):
    | {
        ok: true;
        worldXpUpdate?: { worldXp: number; worldLevel: number; coreTokens: number; leveledUp: boolean } | null;
        notice?: string;
      }
    | { ok: false; reason?: string } {
    const effectiveAdminEdit = account.role === 'admin' && Boolean(adminEdit);
    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false };

    if (!effectiveAdminEdit) {
      const hasHoe = account.inventory.some((s) => s.itemId === ITEM_IDS.FARMING_HOE && s.qty >= 1);
      if (!hasHoe) {
        return { ok: false, reason: 'You need a Farming Hoe to plow Dirt Soil.' };
      }
    }

    const reach = effectiveAdminEdit
      ? Math.max(12, this.gameConfig.mechanics.reachTiles)
      : this.gameConfig.mechanics.reachTiles;
    const check = canPlowTile(
      live.state,
      { id: account.id, x: playerState.x, y: playerState.y, adminWorldEdit: effectiveAdminEdit },
      tx,
      ty,
      reach
    );
    if (!check.ok) {
      return { ok: false, reason: check.reason };
    }

    const idx = tileIndexIn(live.state, tx, ty);
    live.state.fg[idx] = ITEM_IDS.PLOWED_DIRT_SOIL;
    live.state.revision += 1;

    const leveled = addXp(account.level, account.xp, 1);
    account.level = leveled.level;
    account.xp = leveled.xp;
    playerState.level = account.level;
    const tokenEarned = this.tryAwardCoreToken(live, account, { kind: 'plow_soil' });
    const worldXpUpdate = this.awardWorldXp(live, account, 1);

    this.saveWorld(live);
    this.savePlayer(account);
    return {
      ok: true,
      worldXpUpdate,
      notice: tokenEarned ? '+1 Core Token stored in WorldCore!' : undefined,
    };
  }

  handleVendorAction(
    account: PlayerAccount,
    opts: {
      action: 'reclaim_hoe' | 'buy_hoe' | 'buy_seed' | 'sell_crop' | 'sell_all_crops';
      itemId?: number;
      qty?: number;
      currency?: 'gems' | 'alterbits' | 'digibits';
    }
  ): { ok: true; notice: string } | { ok: false; message: string } {
    account.alterbits = Math.max(0, Math.floor(Number(account.alterbits ?? 0)));

    if (opts.action === 'reclaim_hoe' || opts.action === 'buy_hoe') {
      return {
        ok: false,
        message: 'Farming Hoe is not sold or distributed in the Fresh Greens Market.',
      };
    }

    if (opts.action === 'buy_seed') {
      const seedId = Number(opts.itemId ?? 0);
      const qty = Math.max(1, Math.min(50, Math.floor(Number(opts.qty ?? 1))));
      if (!isCropSeed(seedId)) {
        return { ok: false, message: 'Invalid Crop Seed selected.' };
      }
      const spec = getCropSpec(seedId);
      const def = getItemDef(seedId);
      if (!spec || !def) {
        return { ok: false, message: 'Unknown Crop Seed.' };
      }
      const reqMastery = getCropMasteryRequiredLevel(seedId);
      if ((account.cropMasteryLevel ?? 1) < reqMastery) {
        return {
          ok: false,
          message: `Requires Crop Mastery Lv. ${reqMastery} to buy ${def.name}.`,
        };
      }
      const room = this.getInventoryRoomForItem(account, seedId);
      if (room < qty) {
        return {
          ok: false,
          message:
            room <= 0
              ? `Backpack full (20/20 slots or ${MAX_STACK_SIZE} stack limit reached for ${def.name}).`
              : `Only room for ${room}× more ${def.name} in your Backpack.`,
        };
      }
      if (opts.currency === 'gems') {
        return { ok: false, message: 'Fresh Greens Market trades exclusively in Digibits.' };
      }
      const totalDb = spec.seedAlterbitPrice * qty;
      if (account.alterbits < totalDb) {
        return { ok: false, message: `Need ${totalDb} Digibits to buy ${qty}× ${def.name}.` };
      }
      account.alterbits -= totalDb;
      this.addInventoryPartial(account, seedId, qty);
      this.savePlayer(account, true);
      return { ok: true, notice: `Bought ${qty}× ${def.name} (-${totalDb} DB)!` };
    }

    if (opts.action === 'sell_crop') {
      const cropId = Number(opts.itemId ?? 0);
      if (!isCropItem(cropId)) {
        return { ok: false, message: 'Only harvested crops can be sold to the Fresh Greens Vendor.' };
      }
      const slot = account.inventory.find((s) => s.itemId === cropId && s.qty > 0);
      if (!slot) {
        return { ok: false, message: 'You do not have any of that crop in your inventory.' };
      }
      const sellQty = Math.max(1, Math.min(slot.qty, Math.floor(Number(opts.qty ?? slot.qty))));
      const spec = getCropSpec(cropId);
      const def = getItemDef(cropId);
      const unitDb = spec?.sellAlterbits ?? def?.cropSellAlterbits ?? 2;
      if (!this.consumeInventory(account, cropId, sellQty)) {
        return { ok: false, message: 'Could not deduct crops from inventory.' };
      }
      const earnedDb = sellQty * unitDb;
      account.alterbits += earnedDb;
      this.savePlayer(account, true);
      return {
        ok: true,
        notice: `Sold ${sellQty}× ${def?.name ?? 'Crop'} (+${earnedDb} DB)!`,
      };
    }

    if (opts.action === 'sell_all_crops') {
      let totalCropsSold = 0;
      let totalDbEarned = 0;
      const cropSlots = account.inventory.filter((s) => isCropItem(s.itemId) && s.qty > 0);
      if (cropSlots.length === 0) {
        return { ok: false, message: 'No harvested crops in your inventory to sell.' };
      }
      for (const s of cropSlots) {
        const qty = s.qty;
        const spec = getCropSpec(s.itemId);
        const def = getItemDef(s.itemId);
        const unitDb = spec?.sellAlterbits ?? def?.cropSellAlterbits ?? 2;
        if (this.consumeInventory(account, s.itemId, qty)) {
          totalCropsSold += qty;
          totalDbEarned += qty * unitDb;
        }
      }
      account.alterbits += totalDbEarned;
      this.savePlayer(account, true);
      return {
        ok: true,
        notice: `Sold ${totalCropsSold} crops (+${totalDbEarned} DB)!`,
      };
    }

    return { ok: false, message: 'Unknown vendor action.' };
  }

  private createDrop(
    live: LiveWorld,
    itemId: number,
    qty: number,
    tx: number,
    ty: number,
    slotIndex = 0
  ): WorldDrop {
    const maxStack = Math.max(1, getItemDef(itemId)?.stackLimit ?? MAX_STACK_SIZE);
    const originX = tx * TILE_SIZE + TILE_SIZE * 0.5;
    const originY = ty * TILE_SIZE + TILE_SIZE * 0.5;
    let remaining = Math.max(1, Math.floor(qty));
    let firstDrop: WorldDrop | undefined;
    let existingInTileCount = 0;
    // Merge nearby identical item drops before creating another visible stack.
    for (const existing of live.drops.values()) {
      const dist = Math.hypot(existing.x - originX, existing.y - originY);
      if (dist <= TILE_SIZE * 0.58) {
        existingInTileCount += 1;
      }
      if (existing.isGem || existing.itemId !== itemId || dist > TILE_SIZE * 1.35) continue;
      const room = Math.max(0, maxStack - existing.qty);
      if (room <= 0) continue;
      const added = Math.min(room, remaining);
      existing.qty += added;
      remaining -= added;
      firstDrop ??= existing;
      if (remaining <= 0) return firstDrop;
    }
    const offsets: ReadonlyArray< readonly [number, number] > = [
      [0, 0],
      [-15, -6],
      [15, -6],
      [-11, 10],
      [11, 10],
      [0, -13],
      [-18, 3],
      [18, 3],
      [-7, 13],
      [7, -12],
    ];
    let created = 0;
    const baseSlot = Math.max(slotIndex, existingInTileCount);
    while (remaining > 0) {
      const [ox, oy] = offsets[(baseSlot + created) % offsets.length];
      const stackQty = Math.min(maxStack, remaining);
      const drop: WorldDrop = {
        id: `drp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId,
        qty: stackQty,
        x: originX + ox + (created > 0 ? created * 3 : 0),
        y: originY + oy,
      };
      live.drops.set(drop.id, drop);
      firstDrop ??= drop;
      remaining -= stackQty;
      created += 1;
    }
    return firstDrop!;
  }

  handlePlaceTile(
    live: LiveWorld,
    account: PlayerAccount,
    itemId: number,
    tx: number,
    ty: number,
    adminEdit = false
  ): { ok: true; layer: 'fg' | 'bg' | 'seed' | 'fluid'; notice?: string } | { ok: false; reason?: string } {
    const effectiveAdminEdit = account.role === 'admin' && Boolean(adminEdit);
    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false };

    const hasItemInInventory = account.inventory.some((s) => s.itemId === itemId && s.qty >= 1);
    if (!effectiveAdminEdit && !hasItemInInventory) {
      return { ok: false, reason: 'Out of stock in inventory.' };
    }

    if (!effectiveAdminEdit) {
      if (isCropSeed(itemId)) {
        const reqMastery = getCropMasteryRequiredLevel(itemId);
        if ((account.cropMasteryLevel ?? 1) < reqMastery) {
          return {
            ok: false,
            reason: `Requires Crop Mastery Lv. ${reqMastery} to plant ${getItemDef(itemId)?.name ?? 'this crop'}.`,
          };
        }
      } else if (isFarmableSeed(itemId) || getItemDef(itemId)?.category === 'farmable') {
        const reqMastery = getFarmablockMasteryRequiredLevel(itemId);
        if ((account.farmablockMasteryLevel ?? 1) < reqMastery) {
          return {
            ok: false,
            reason: `Requires Farmablock Mastery Lv. ${reqMastery} to use ${getItemDef(itemId)?.name ?? 'this farmable'}.`,
          };
        }
      }
    }

    const reach = effectiveAdminEdit
      ? Math.max(12, this.gameConfig.mechanics.reachTiles)
      : this.gameConfig.mechanics.reachTiles;
    const check = canPlaceTile(
      live.state,
      { id: account.id, x: playerState.x, y: playerState.y, adminWorldEdit: effectiveAdminEdit },
      itemId,
      tx,
      ty,
      reach
    );
    if (!check.ok || !check.layer) {
      return { ok: false, reason: check.reason };
    }

    if (hasItemInInventory && !isSystemWorld(live.state.name)) {
      if (!this.consumeInventory(account, itemId, 1) && !effectiveAdminEdit) {
        return { ok: false, reason: 'Failed to deduct item.' };
      }
    } else if (!effectiveAdminEdit) {
      if (!this.consumeInventory(account, itemId, 1)) {
        return { ok: false, reason: 'Failed to deduct item.' };
      }
    }

    const idx = tileIndexIn(live.state, tx, ty);
    const key = `${tx},${ty}`;
    const now = Date.now();
    let notice: string | undefined;

    if (check.layer === 'bg') {
      live.state.bg[idx] = itemId;
      if (!effectiveAdminEdit) account.stats.blocksPlaced = (account.stats.blocksPlaced ?? 0) + 1;
    } else if (check.layer === 'seed') {
      if (!isCropSeed(itemId)) {
        live.state.seedPots = live.state.seedPots ?? {};
        live.state.seedPots[key] = live.state.seedPots[key] ?? { x: tx, y: ty, hasPlant: true, placedAt: now };
        live.state.seedPots[key].hasPlant = true;
      }
      const mult = Math.max(0.1, this.gameConfig.mechanics.growthMultiplier || 1);
      const def = getEffectiveItemDef(itemId, this.gameConfig);
      const growDuration = Math.round((def?.growthTimeMs ?? PLANT_DEFAULT_GROWTH_MS) / mult);
      live.state.plants[key] = {
        x: tx,
        y: ty,
        seedId: itemId,
        plantedAt: now,
        maturityAt: now + growDuration,
        ownerId: account.id,
      };
    } else if (check.layer === 'fluid') {
      ensureFluidArrays(live.state);
      const fType = itemId === ITEM_IDS.ACID_SOURCE ? 2 : 1;
      live.state.fg[idx] = itemId;
      live.state.fluidType![idx] = fType;
      live.state.fluidLevel![idx] = 4;
      if (!effectiveAdminEdit) account.stats.blocksPlaced = (account.stats.blocksPlaced ?? 0) + 1;
      this.enqueueFluidNeighbors(live, tx, ty);
      notice = itemId === ITEM_IDS.ACID_SOURCE ? 'Acid Vat poured!' : 'Water Source placed!';
    } else {
      if (effectiveAdminEdit) this.clearTileMetadata(live, tx, ty);
      live.state.fg[idx] = itemId;
      if (!effectiveAdminEdit) account.stats.blocksPlaced = (account.stats.blocksPlaced ?? 0) + 1;
      this.enqueueFluidNeighbors(live, tx, ty);

      const shareSpec = getShareLockSpec(itemId);
      if (shareSpec) {
        live.state.shareLocks = live.state.shareLocks ?? {};
        live.state.shareLocks[key] = {
          x: tx,
          y: ty,
          itemId,
          width: shareSpec.width,
          height: shareSpec.height,
          ownerId: account.id,
          ownerName: account.name,
          access: {},
        };
        account.stats.locksPlaced = (account.stats.locksPlaced ?? 0) + 1;
        notice = `${shareSpec.name} placed · ${shareSpec.width}×${shareSpec.height} area claimed.`;
      } else if (itemId === ITEM_IDS.WORLD_LOCK || itemId === ITEM_IDS.SMALL_LOCK) {
        return { ok: false, reason: 'Legacy locks are retired. Use a Share Lock instead.' };
      } else if (itemId === ITEM_IDS.VENDING_MACHINE) {
        live.state.vendingMachines = live.state.vendingMachines ?? {};
        live.state.vendingMachines[key] = {
          x: tx,
          y: ty,
          ownerId: account.id,
          ownerName: account.name,
          stockItemId: 0,
          stockQty: 0,
          priceItemId: ITEM_IDS.SMALL_LOCK,
          priceQty: 1,
          earningsQty: 0,
        };
        notice = 'Vending Machine placed!';
      } else if (itemId === ITEM_IDS.STONE_FURNACE) {
        live.state.furnaces = live.state.furnaces ?? {};
        live.state.furnaces[key] = {
          x: tx,
          y: ty,
          ownerId: account.id,
          recipeId: null,
          startedAt: null,
          finishesAt: null,
          readyOutputItemId: 0,
          readyOutputQty: 0,
        };
        notice = 'Stone Furnace placed!';
      } else if (itemId === ITEM_IDS.BFG_COLLECTOR) {
        live.state.bfgCollectors = live.state.bfgCollectors ?? {};
        live.state.bfgCollectors[key] = {
          x: tx,
          y: ty,
          ownerId: account.id,
          active: true,
          storedGems: 0,
          storedItems: [],
        };
        notice = 'BFG Auto-Collector online!';
      } else if (itemId === ITEM_IDS.EXCHANGE_TERMINAL) {
        notice = 'Exchange Terminal placed!';
      } else if (itemId === ITEM_IDS.SEED_POT) {
        live.state.seedPots = live.state.seedPots ?? {};
        live.state.seedPots[key] = { x: tx, y: ty, hasPlant: false, placedAt: now };
        notice = 'Seed Pot placed!';
      } else if (itemId >= ITEM_IDS.MATTERAGEN_BOTANICAL && itemId <= ITEM_IDS.MATTERAGEN_COSMIC) {
        live.state.matteragenEngines = live.state.matteragenEngines ?? {};
        live.state.matteragenEngines[key] = {
          x: tx,
          y: ty,
          typeId: itemId,
          level: 1,
          placedAtMs: now,
          lastHarvestMs: now,
          isReady: false,
          storedDrops: [],
        };
        const engDef = getItemDef(itemId);
        notice = `${engDef?.name ?? 'Matteragen Engine'} placed! Interact when ready to claim yield.`;
      } else if (itemId === ITEM_IDS.ATM_MACHINE) {
        live.state.atmMachines = live.state.atmMachines ?? {};
        live.state.atmMachines[key] = {
          x: tx,
          y: ty,
          ownerId: account.id,
          placedAtMs: now,
          lastHarvestMs: now,
          intervalMs: rollAtmIntervalMs(),
          isReady: false,
          storedGems: 0,
        };
        notice = 'ATM Machine placed!';
      } else if (itemId === ITEM_IDS.VAULTBOX) {
        live.state.vaultboxes = live.state.vaultboxes ?? {};
        live.state.vaultboxes[key] = {
          x: tx,
          y: ty,
          ownerId: account.id,
          ownerName: account.name,
          slots: Array.from({ length: VAULTBOX_SLOT_COUNT }, () => null),
        };
        notice = 'Vaultbox placed!';
      } else if (getItemDef(itemId)?.key.includes('sign')) {
        live.state.signs = live.state.signs ?? {};
        live.state.signs[key] = `Sign by ${account.name}`;
        notice = 'Signboard placed!';
      }
    }

    live.state.revision += 1;
    this.saveWorld(live);
    this.savePlayer(account);
    return { ok: true, layer: check.layer, notice };
  }

  handlePickupDrop(
    live: LiveWorld,
    account: PlayerAccount,
    dropId: string
  ):
    | { ok: true; drop: WorldDrop; removed: boolean; remainingDrop?: WorldDrop }
    | { ok: false; reason?: string } {
    const drop = live.drops.get(dropId);
    const playerState = live.players.get(account.id);
    if (!drop || !playerState) return { ok: false };

    const dist = Math.hypot(
      drop.x - (playerState.x + PLAYER_WIDTH * 0.5),
      drop.y - (playerState.y + PLAYER_HEIGHT * 0.5)
    );
    if (dist > this.gameConfig.mechanics.dropMagnetRadius + 44) {
      return { ok: false };
    }

    if (drop.isGem) {
      live.drops.delete(dropId);
      account.gems += drop.qty;
      this.savePlayer(account);
      return { ok: true, drop, removed: true };
    }

    const added = this.addInventoryPartial(account, drop.itemId, drop.qty);
    if (added <= 0) {
      return {
        ok: false,
        reason: `Backpack full (20/20 slots or ${MAX_STACK_SIZE} stack limit reached).`,
      };
    }

    if (added < drop.qty) {
      drop.qty -= added;
      this.savePlayer(account);
      return {
        ok: true,
        drop: { ...drop, qty: added },
        removed: false,
        remainingDrop: { ...drop },
      };
    }

    live.drops.delete(dropId);
    this.savePlayer(account);
    return { ok: true, drop, removed: true };
  }

  handleSplice(
    account: PlayerAccount,
    seedA: number,
    seedB: number
  ): { ok: true; resultSeedId: number; resultName: string } | { ok: false; message: string } {
    const result = resolveSplice(seedA, seedB);
    if (!result) return { ok: false, message: 'No known seed combination for those two seeds.' };

    const slotA = account.inventory.find((s) => s.itemId === seedA);
    const slotB = account.inventory.find((s) => s.itemId === seedB);
    if (seedA === seedB) {
      if (!slotA || slotA.qty < 2) return { ok: false, message: 'Need 2 of that seed.' };
    } else if (!slotA || slotA.qty < 1 || !slotB || slotB.qty < 1) {
      return { ok: false, message: 'Missing required seeds.' };
    }

    this.consumeInventory(account, seedA, 1);
    this.consumeInventory(account, seedB, 1);
    this.addInventory(account, result, 1);
    account.stats.seedsSpliced = (account.stats.seedsSpliced ?? 0) + 1;
    const leveled = addXp(account.level, account.xp, 8);
    account.level = leveled.level;
    account.xp = leveled.xp;
    this.savePlayer(account);
    const resultName = getItemDef(result)?.name ?? 'Hybrid Seed';
    return { ok: true, resultSeedId: result, resultName };
  }

  handleBuyGemStore(
    account: PlayerAccount,
    listingId: string,
    txId: string
  ): { ok: true; notice: string } | { ok: false; message: string } {
    if (!txId || account.processedTxIds.includes(txId)) {
      return { ok: false, message: 'Duplicate transaction ignored.' };
    }
    const storeListings = this.gameConfig.storeListings ?? GEM_STORE_LISTINGS;
    const listing = storeListings.find((l) => l.id === listingId);
    if (!listing) {
      return { ok: false, message: 'Store item not found.' };
    }
    if (account.gems < listing.gemPrice) {
      return { ok: false, message: `Not enough Gems (need ${listing.gemPrice}).` };
    }

    account.gems -= listing.gemPrice;
    account.processedTxIds.push(txId);
    for (const grant of listing.grants) {
      this.addInventory(account, grant.itemId, grant.qty);
    }
    account.stats.storePurchases = (account.stats.storePurchases ?? 0) + 1;
    const leveled = addXp(account.level, account.xp, 5);
    account.level = leveled.level;
    account.xp = leveled.xp;
    this.savePlayer(account);
    return { ok: true, notice: `Purchased ${listing.name}!` };
  }

  handleConfigureLock(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    opts: {
      addEditorName?: string;
      removeEditorId?: string;
      permissionTargetId?: string;
      permissions?: Partial<ShareLockPermissions>;
    }
  ): { ok: true; shareLock: import('../src/game/worldGen.ts').ShareLockRecord; notice: string } | { ok: false; message: string } {
    const key = `${tx},${ty}`;
    const lock = live.state.shareLocks?.[key];
    if (!lock) return { ok: false, message: 'No Share Lock found at that tile.' };
    if (lock.ownerId !== account.id && account.role !== 'admin') {
      return { ok: false, message: 'Only the world owner can manage Share Lock access.' };
    }

    lock.access = lock.access ?? {};
    if (opts.addEditorName) {
      const target = this.findPlayerByNameOrId(opts.addEditorName);
      if (!target) return { ok: false, message: 'Player not found. Check the exact username.' };
      if (target.id === lock.ownerId) return { ok: false, message: 'You already own this area.' };
      lock.access[target.id] = {
        playerName: target.name,
        permissions: { ...DEFAULT_SHARE_LOCK_PERMISSIONS },
      };
    }
    if (opts.removeEditorId) delete lock.access[opts.removeEditorId];
    if (opts.permissionTargetId && opts.permissions) {
      const existing = lock.access[opts.permissionTargetId];
      if (!existing) return { ok: false, message: 'That player does not have access to this Share Lock.' };
      existing.permissions = { ...DEFAULT_SHARE_LOCK_PERMISSIONS, ...existing.permissions, ...opts.permissions };
    }

    live.state.revision += 1;
    this.saveWorld(live);
    return { ok: true, shareLock: lock, notice: 'Share Lock access updated.' };
  }

  handleConfigureVending(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    opts: {
      action: 'stock' | 'withdraw';
      stockItemId?: number;
      stockQty?: number;
      priceItemId?: number;
      priceQty?: number;
    }
  ): { ok: true; machine: VendingMachineRecord; notice: string } | { ok: false; message: string } {
    const key = `${tx},${ty}`;
    const vm = live.state.vendingMachines?.[key];
    if (!vm) return { ok: false, message: 'Vending Machine not found.' };
    if (vm.ownerId !== account.id && account.role !== 'admin') {
      return { ok: false, message: 'Only the Vending Machine owner can configure it.' };
    }

    if (opts.action === 'withdraw') {
      if (vm.stockQty > 0 && vm.stockItemId > 0) {
        this.addInventory(account, vm.stockItemId, vm.stockQty);
      }
      if (vm.earningsQty > 0 && vm.priceItemId > 0) {
        this.addInventory(account, vm.priceItemId, vm.earningsQty);
      }
      vm.stockItemId = 0;
      vm.stockQty = 0;
      vm.earningsQty = 0;
      live.state.revision += 1;
      this.saveWorld(live);
      this.savePlayer(account);
      return { ok: true, machine: vm, notice: 'Withdrew stock and payment earnings.' };
    }

    // Stocking machine
    const itemId = Number(opts.stockItemId ?? 0);
    const qty = Math.max(1, Math.floor(Number(opts.stockQty ?? 1)));
    const priceItemId = Number(opts.priceItemId ?? ITEM_IDS.GP_RED_BRICKS);
    const priceQty = Math.max(1, Math.floor(Number(opts.priceQty ?? 1)));

    const itemDef = getItemDef(itemId);
    const priceDef = getItemDef(priceItemId);
    if (!itemDef || !itemDef.tradeable) {
      return { ok: false, message: 'Selected item cannot be sold in a Vending Machine.' };
    }
    if (!priceDef || !priceDef.tradeable) {
      return { ok: false, message: 'Invalid payment item.' };
    }
    if (priceItemId === ITEM_IDS.WORLD_LOCK || priceItemId === ITEM_IDS.SMALL_LOCK) {
      return { ok: false, message: 'Legacy lock items can no longer be used as vending prices.' };
    }
    if (vm.stockQty > 0 && (vm.stockItemId !== itemId || vm.priceItemId !== priceItemId)) {
      return { ok: false, message: 'Withdraw existing listing before changing item type.' };
    }

    if (!this.consumeInventory(account, itemId, qty)) {
      return { ok: false, message: `You do not have ${qty} ${itemDef.name} in your Backpack.` };
    }

    vm.stockItemId = itemId;
    vm.stockQty += qty;
    vm.priceItemId = priceItemId;
    vm.priceQty = priceQty;
    live.state.revision += 1;
    this.saveWorld(live);
    this.savePlayer(account);
    return {
      ok: true,
      machine: vm,
      notice: `Listed ${vm.stockQty}× ${itemDef.name} for ${priceQty}× ${priceDef.name} each.`,
    };
  }

  handleBuyVending(
    live: LiveWorld,
    buyer: PlayerAccount,
    tx: number,
    ty: number,
    rawUnits: number,
    txId: string
  ): { ok: true; machine: VendingMachineRecord; notice: string } | { ok: false; message: string } {
    if (!txId || buyer.processedTxIds.includes(txId)) {
      return { ok: false, message: 'Duplicate transaction ignored.' };
    }
    const key = `${tx},${ty}`;
    if (buyer.role !== 'admin' && !hasEditPermission(live.state, buyer.id, tx, ty, 'interact')) {
      return { ok: false, message: 'You do not have permission to use this Vending Machine.' };
    }
    const vm = live.state.vendingMachines?.[key];
    if (!vm || vm.stockQty <= 0 || vm.stockItemId <= 0) {
      return { ok: false, message: 'This Vending Machine is out of stock.' };
    }

    const units = Math.max(1, Math.floor(rawUnits));
    if (vm.stockQty < units) {
      return { ok: false, message: `Only ${vm.stockQty} available in stock.` };
    }

    const totalCost = vm.priceQty * units;
    const paymentDef = getItemDef(vm.priceItemId);
    const stockDef = getItemDef(vm.stockItemId);
    if (!paymentDef || !stockDef) {
      return { ok: false, message: 'Invalid machine listing.' };
    }

    const buyerPaySlot = buyer.inventory.find((s) => s.itemId === vm.priceItemId);
    if (!buyerPaySlot || buyerPaySlot.qty < totalCost) {
      return {
        ok: false,
        message: `Need ${totalCost}× ${paymentDef.name} to buy ${units}× ${stockDef.name}.`,
      };
    }

    // Atomic exchange
    if (!this.consumeInventory(buyer, vm.priceItemId, totalCost)) {
      return { ok: false, message: 'Payment deduction failed.' };
    }
    buyer.processedTxIds.push(txId);
    vm.stockQty -= units;
    vm.earningsQty += totalCost;
    this.addInventory(buyer, vm.stockItemId, units);

    buyer.stats.vendingTrades = (buyer.stats.vendingTrades ?? 0) + 1;
    const leveled = addXp(buyer.level, buyer.xp, 6);
    buyer.level = leveled.level;
    buyer.xp = leveled.xp;

    // Also credit seller stats if seller exists
    const seller = this.findPlayerByNameOrId(vm.ownerId);
    if (seller && seller.id !== buyer.id) {
      seller.stats.vendingTrades = (seller.stats.vendingTrades ?? 0) + 1;
      this.savePlayer(seller);
    }

    live.state.revision += 1;
    this.saveWorld(live);
    this.savePlayer(buyer);
    return {
      ok: true,
      machine: vm,
      notice: `Bought ${units}× ${stockDef.name} for ${totalCost}× ${paymentDef.name}!`,
    };
  }

  handleConfigureSign(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    rawText: string
  ): { ok: true; text: string; notice: string } | { ok: false; message: string } {
    if (isSystemWorld(live.state.name) && account.role !== 'admin') {
      return { ok: false, message: 'System world directional signs cannot be modified.' };
    }
    if (account.role !== 'admin' && !hasEditPermission(live.state, account.id, tx, ty, 'interact')) {
      return { ok: false, message: 'You do not have permission to edit this sign.' };
    }
    const idx = tileIndexIn(live.state, tx, ty);
    if (!getItemDef(live.state.fg[idx])?.key.includes('sign')) {
      return { ok: false, message: 'No Signboard at that location.' };
    }
    const cleanText = rawText.trim().slice(0, 80) || 'Empty Sign';
    live.state.signs = live.state.signs ?? {};
    live.state.signs[`${tx},${ty}`] = cleanText;
    live.state.revision += 1;
    this.saveWorld(live);
    return { ok: true, text: cleanText, notice: 'Signboard inscription updated.' };
  }

  handleConfigureFurnace(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    opts: { action: 'craft' | 'collect' | 'repair'; recipeId?: string; toolItemId?: number }
  ): { ok: true; furnace: FurnaceRecord; notice: string } | { ok: false; message: string } {
    if (account.role !== 'admin' && !hasEditPermission(live.state, account.id, tx, ty, 'interact')) {
      return { ok: false, message: 'Protected by Lock.' };
    }
    const key = `${tx},${ty}`;
    const furnace = live.state.furnaces?.[key];
    if (!furnace) return { ok: false, message: 'Stone Furnace not found.' };
    const now = Date.now();

    // Auto-complete finished job if ready
    if (furnace.recipeId && furnace.finishesAt && now >= furnace.finishesAt && furnace.readyOutputItemId === 0) {
      const doneRecipe = FURNACE_RECIPES.find((r) => r.id === furnace.recipeId);
      if (doneRecipe) {
        furnace.readyOutputItemId = doneRecipe.outputItemId;
        furnace.readyOutputQty = doneRecipe.outputQty;
      }
      furnace.recipeId = null;
      furnace.startedAt = null;
      furnace.finishesAt = null;
    }

    if (opts.action === 'collect') {
      if (furnace.readyOutputItemId <= 0 || furnace.readyOutputQty <= 0) {
        if (furnace.recipeId && furnace.finishesAt && now < furnace.finishesAt) {
          const secs = Math.max(1, Math.ceil((furnace.finishesAt - now) / 1000));
          return { ok: false, message: `Smelting in progress (${secs}s left).` };
        }
        return { ok: false, message: 'Furnace output tray is empty.' };
      }
      const outDef = getItemDef(furnace.readyOutputItemId);
      this.addInventory(account, furnace.readyOutputItemId, furnace.readyOutputQty);
      const qty = furnace.readyOutputQty;
      furnace.readyOutputItemId = 0;
      furnace.readyOutputQty = 0;
      account.stats.itemsSmelted = (account.stats.itemsSmelted ?? 0) + 1;
      const leveled = addXp(account.level, account.xp, 8);
      account.level = leveled.level;
      account.xp = leveled.xp;
      const tokenEarned = this.tryAwardCoreToken(live, account, { kind: 'furnace_smelt' });
      this.awardWorldXp(live, account, 4);
      live.state.revision += 1;
      this.saveWorld(live);
      this.savePlayer(account);
      return {
        ok: true,
        furnace,
        notice: `Collected ${qty}× ${outDef?.name ?? 'Crafted Item'}${tokenEarned ? ' (+1 Core Token transferred to WorldCore!)' : ''}!`,
      };
    }

    if (opts.action === 'repair') {
      const slot = account.inventory.find(
        (s) =>
          s.itemId === opts.toolItemId &&
          typeof s.maxDurability === 'number' &&
          (s.durability ?? s.maxDurability) < s.maxDurability
      );
      if (!slot) {
        return { ok: false, message: 'No damaged Pickaxe or Rod selected.' };
      }
      const def = getItemDef(slot.itemId);
      if (!def || !def.repairMaterialId || !def.repairQty) {
        return { ok: false, message: 'Tool does not support furnace repair.' };
      }
      const matDef = getItemDef(def.repairMaterialId);
      if (!this.consumeInventory(account, def.repairMaterialId, def.repairQty)) {
        return {
          ok: false,
          message: `Need ${def.repairQty}× ${matDef?.name ?? 'material'} to repair ${def.name}.`,
        };
      }
      slot.durability = slot.maxDurability;
      this.savePlayer(account);
      return {
        ok: true,
        furnace,
        notice: `Repaired ${def.name} to 100% durability!`,
      };
    }

    // Craft / smelt
    if (furnace.recipeId || furnace.readyOutputItemId > 0) {
      return { ok: false, message: 'Collect or wait for current furnace batch first.' };
    }
    const recipe = FURNACE_RECIPES.find((r) => r.id === opts.recipeId);
    if (!recipe) return { ok: false, message: 'Unknown furnace recipe.' };

    if (recipe.fuelQty > 0) {
      const coalSlot = account.inventory.find((s) => s.itemId === ITEM_IDS.COAL_FUEL);
      if (!coalSlot || coalSlot.qty < recipe.fuelQty) {
        return { ok: false, message: `Need ${recipe.fuelQty}× Coal Fuel to fire this recipe.` };
      }
    }
    for (const inp of recipe.inputs) {
      const s = account.inventory.find((sl) => sl.itemId === inp.itemId);
      if (!s || s.qty < inp.qty) {
        return {
          ok: false,
          message: `Need ${inp.qty}× ${getItemDef(inp.itemId)?.name ?? 'material'}.`,
        };
      }
    }

    if (recipe.fuelQty > 0) {
      this.consumeInventory(account, ITEM_IDS.COAL_FUEL, recipe.fuelQty);
    }
    for (const inp of recipe.inputs) {
      this.consumeInventory(account, inp.itemId, inp.qty);
    }

    furnace.recipeId = recipe.id;
    furnace.startedAt = now;
    furnace.finishesAt = now + recipe.durationMs;
    live.state.revision += 1;
    this.saveWorld(live);
    this.savePlayer(account);
    return {
      ok: true,
      furnace,
      notice: `Started ${recipe.name} (${Math.round(recipe.durationMs / 1000)}s)...`,
    };
  }

  handleConfigureBfg(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    opts: { action: 'toggle' | 'withdraw' }
  ): { ok: true; bfg: BfgCollectorRecord; notice: string } | { ok: false; message: string } {
    const key = `${tx},${ty}`;
    const bfg = live.state.bfgCollectors?.[key];
    if (!bfg) return { ok: false, message: 'BFG Auto-Collector not found.' };
    const isBfgOwner =
      bfg.ownerId === account.id ||
      live.state.worldLock?.ownerId === account.id ||
      account.role === 'admin';
    const hasSharedInteract = Boolean(live.state.worldLock && hasEditPermission(live.state, account.id, tx, ty, 'interact'));
    if (!isBfgOwner && !hasSharedInteract) {
      return { ok: false, message: 'You do not have permission to interact with this BFG Collector.' };
    }

    if (opts.action === 'toggle') {
      bfg.active = !bfg.active;
      live.state.revision += 1;
      this.saveWorld(live);
      return {
        ok: true,
        bfg,
        notice: `BFG Auto-Collector turned ${bfg.active ? 'ON' : 'OFF'}.`,
      };
    }

    // Withdraw buffered gems and items
    const gems = Math.max(0, Math.floor(bfg.storedGems));
    const items = [...bfg.storedItems];
    if (gems === 0 && items.length === 0) {
      return { ok: false, message: 'BFG Collector storage buffer is empty.' };
    }
    account.gems += gems;
    for (const it of items) {
      this.addInventory(account, it.itemId, it.qty);
    }
    bfg.storedGems = 0;
    bfg.storedItems = [];
    live.state.revision += 1;
    this.saveWorld(live);
    this.savePlayer(account);
    return {
      ok: true,
      bfg,
      notice: `Withdrew ${gems} Gems and ${items.reduce((s, i) => s + i.qty, 0)} items from BFG!`,
    };
  }

  handleConfigureVaultbox(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    opts: {
      action: 'deposit' | 'withdraw';
      itemId?: number;
      qty?: number;
      slotIndex?: number;
      invIndex?: number;
    }
  ): { ok: true; vaultbox: VaultboxRecord; notice: string } | { ok: false; message: string } {
    const key = `${tx},${ty}`;
    const vault = live.state.vaultboxes?.[key];
    if (!vault) return { ok: false, message: 'Vaultbox not found.' };
    if (vault.ownerId !== account.id && account.role !== 'admin') {
      return { ok: false, message: `Locked: Only ${vault.ownerName} can access this Vaultbox.` };
    }

    // Normalize fixed 10-tile array
    const normalized: (VaultboxSlot | null)[] = Array.from(
      { length: VAULTBOX_SLOT_COUNT },
      (_, idx) => vault.slots?.[idx] ?? null
    );
    vault.slots = normalized;

    if (opts.action === 'withdraw') {
      const slotIdx = Number(opts.slotIndex);
      if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= VAULTBOX_SLOT_COUNT) {
        return { ok: false, message: 'Invalid Vaultbox storage tile.' };
      }
      const stored = vault.slots[slotIdx];
      if (!stored || stored.qty <= 0) {
        return { ok: false, message: 'Selected storage tile is already empty.' };
      }
      const def = getItemDef(stored.itemId);
      const isUniqueGear = Boolean(def?.maxDurability || def?.toolKind === 'rod');
      if (isUniqueGear) {
        account.inventory.push({ ...stored, qty: 1 });
        vault.slots[slotIdx] = null;
        live.state.revision += 1;
        live.dirty = true;
        this.saveWorld(live);
        this.savePlayer(account);
        return {
          ok: true,
          vaultbox: vault,
          notice: `Withdrew ${def?.name ?? 'Item'} from Vaultbox.`,
        };
      }

      const requested = opts.qty !== undefined ? Math.max(1, Math.floor(opts.qty)) : stored.qty;
      const takeQty = Math.min(stored.qty, requested);
      this.addInventory(account, stored.itemId, takeQty);
      stored.qty -= takeQty;
      if (stored.qty <= 0) {
        vault.slots[slotIdx] = null;
      }
      live.state.revision += 1;
      live.dirty = true;
      this.saveWorld(live);
      this.savePlayer(account);
      return {
        ok: true,
        vaultbox: vault,
        notice: `Withdrew ${takeQty}× ${def?.name ?? 'Item'} from Vaultbox.`,
      };
    }

    // Deposit into Vaultbox
    const itemId = Number(opts.itemId ?? 0);
    if (itemId === ITEM_IDS.FIST || itemId === ITEM_IDS.WRENCH) {
      return { ok: false, message: 'Core tools cannot be stored in a Vaultbox.' };
    }
    const def = getItemDef(itemId);
    if (!def) return { ok: false, message: 'Unknown item.' };

    const isUniqueGear = Boolean(def.maxDurability || def.toolKind === 'rod');
    if (isUniqueGear) {
      let invIdx =
        typeof opts.invIndex === 'number' &&
        opts.invIndex >= 0 &&
        opts.invIndex < account.inventory.length &&
        account.inventory[opts.invIndex]?.itemId === itemId
          ? opts.invIndex
          : account.inventory.findIndex((s) => s.itemId === itemId);
      if (invIdx < 0) {
        return { ok: false, message: `You do not have ${def.name} in your Backpack.` };
      }

      let targetSlotIdx =
        typeof opts.slotIndex === 'number' &&
        opts.slotIndex >= 0 &&
        opts.slotIndex < VAULTBOX_SLOT_COUNT
          ? opts.slotIndex
          : vault.slots.findIndex((s) => s === null);

      if (targetSlotIdx < 0 || vault.slots[targetSlotIdx] !== null) {
        return { ok: false, message: 'No empty Vaultbox tile available (10 slots max).' };
      }
      const [moved] = account.inventory.splice(invIdx, 1);
      vault.slots[targetSlotIdx] = { ...moved, qty: 1 };
      live.state.revision += 1;
      live.dirty = true;
      this.saveWorld(live);
      this.savePlayer(account);
      return {
        ok: true,
        vaultbox: vault,
        notice: `Stored ${def.name} in Vaultbox slot #${targetSlotIdx + 1}.`,
      };
    }

    const invSlot = account.inventory.find((s) => s.itemId === itemId);
    if (!invSlot || invSlot.qty <= 0) {
      return { ok: false, message: `You do not have any ${def.name} in your Backpack.` };
    }
    const maxStack = Math.max(1, def.stackLimit || 200);
    const reqQty = Math.min(invSlot.qty, Math.max(1, Math.floor(opts.qty ?? 1)));

    let targetSlotIdx = -1;
    let depositQty = 0;

    if (
      typeof opts.slotIndex === 'number' &&
      Number.isInteger(opts.slotIndex) &&
      opts.slotIndex >= 0 &&
      opts.slotIndex < VAULTBOX_SLOT_COUNT
    ) {
      const existing = vault.slots[opts.slotIndex];
      if (existing === null) {
        targetSlotIdx = opts.slotIndex;
        depositQty = Math.min(reqQty, maxStack);
      } else if (existing.itemId === itemId && existing.qty < maxStack) {
        targetSlotIdx = opts.slotIndex;
        depositQty = Math.min(reqQty, maxStack - existing.qty);
      } else {
        return { ok: false, message: 'Selected Vaultbox tile cannot hold more of this item.' };
      }
    } else {
      // First look for an existing non-full matching stack, then first empty tile
      const stackIdx = vault.slots.findIndex(
        (s) => s !== null && s.itemId === itemId && s.qty < maxStack
      );
      if (stackIdx !== -1) {
        targetSlotIdx = stackIdx;
        depositQty = Math.min(reqQty, maxStack - vault.slots[stackIdx]!.qty);
      } else {
        const emptyIdx = vault.slots.findIndex((s) => s === null);
        if (emptyIdx === -1) {
          return { ok: false, message: 'Vaultbox is full (all 10 storage tiles occupied).' };
        }
        targetSlotIdx = emptyIdx;
        depositQty = Math.min(reqQty, maxStack);
      }
    }

    if (depositQty <= 0 || !this.consumeInventory(account, itemId, depositQty)) {
      return { ok: false, message: 'Failed to move items to Vaultbox.' };
    }

    const cur = vault.slots[targetSlotIdx];
    if (cur && cur.itemId === itemId) {
      cur.qty += depositQty;
    } else {
      vault.slots[targetSlotIdx] = { itemId, qty: depositQty };
    }

    live.state.revision += 1;
    live.dirty = true;
    this.saveWorld(live);
    this.savePlayer(account);
    return {
      ok: true,
      vaultbox: vault,
      notice: `Stored ${depositQty}× ${def.name} into Vaultbox.`,
    };
  }

  handleUseConsumable(
    account: PlayerAccount,
    itemId: number
  ):
    | { ok: true; kind: 'buff' | 'mine_scroll'; notice: string; mineWorldName?: string }
    | { ok: false; message: string } {
    const def = getItemDef(itemId);
    if (!def || def.category !== 'consumable') {
      return { ok: false, message: 'Item cannot be activated.' };
    }
    const slot = account.inventory.find((s) => s.itemId === itemId);
    if (!slot || slot.qty < 1) {
      return { ok: false, message: `You do not have any ${def.name}.` };
    }

    if (itemId === ITEM_IDS.MINING_SCROLL) {
      this.consumeInventory(account, itemId, 1);
      const randTag = Math.random().toString(36).slice(2, 6).toUpperCase();
      const shaftName = `MINE_${randTag}`;
      const state = generateMineShaft(shaftName, account.name, 10 * 60_000);
      const live: LiveWorld = {
        state,
        players: new Map(),
        drops: new Map(),
        damage: new Map(),
        fluidFrontier: this.seedInitialFluidFrontier(state),
        activeCasts: new Map(),
        chatHistory: [
          {
            id: `sys_${Date.now()}`,
            senderId: 'system',
            senderName: 'Expedition',
            text: `Private Mining Shaft ${shaftName} opened (10:00 timer). Mine Coal, Copper, Iron, Crystal & Obsidian veins!`,
            timestamp: Date.now(),
            system: true,
          },
        ],
        dirty: false,
      };
      this.worlds.set(shaftName, live);
      this.savePlayer(account);
      return {
        ok: true,
        kind: 'mine_scroll',
        mineWorldName: shaftName,
        notice: `Opened Mining Shaft ${shaftName}!`,
      };
    }

    if (def.buffEffect) {
      this.consumeInventory(account, itemId, 1);
      const now = Date.now();
      this.pruneAndGetBuffs(account);
      account.activeBuffs = account.activeBuffs.filter((b) => b.buffType !== def.buffEffect!.buffType);
      account.activeBuffs.push({
        buffType: def.buffEffect.buffType,
        label: def.buffEffect.label,
        bonusPct: def.buffEffect.bonusPct,
        expiresAt: now + def.buffEffect.durationMs,
      });
      this.savePlayer(account);
      return {
        ok: true,
        kind: 'buff',
        notice: `Activated ${def.name} (${def.buffEffect.label})!`,
      };
    }

    return { ok: false, message: 'No effect defined for this consumable.' };
  }

  

  handleCastFishing(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    rodItemId: number
  ): { ok: true; cast: ServerFishingCast } | { ok: false; message: string } {
    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false, message: 'Not in world.' };

    const rodSlot = account.inventory
      .filter((s) => s.itemId === rodItemId && s.qty >= 1 && (s.durability ?? 1) > 0)
      .sort((a, b) => (b.rodUpgradeLevel ?? 1) - (a.rodUpgradeLevel ?? 1))[0];
    const rodDef = rodSlot ? getItemDef(rodSlot.itemId) : undefined;
    if (!rodSlot || rodDef?.toolKind !== 'rod') {
      return { ok: false, message: 'Select a valid fishing rod before casting.' };
    }
    if ((rodSlot.durability ?? 1) <= 0) {
      return { ok: false, message: `${rodDef.name} is at 0 durability! Repair it at a Stone Furnace.` };
    }
    if (!inBoundsWorld(live.state, tx, ty)) {
      return { ok: false, message: 'Target out of bounds.' };
    }
    if (!isWithinReach({ id: account.id, x: playerState.x, y: playerState.y }, tx, ty, 4.5)) {
      return { ok: false, message: 'Pool is too far away to cast.' };
    }

    let pool: LiquidPoolInfo = floodFillLiquidDepth(live.state, tx, ty);
    let bobberTx = tx;
    let bobberTy = ty;
    if (pool.fluidType === 0 && ty + 1 < (live.state.height || 60)) {
      const belowPool = floodFillLiquidDepth(live.state, tx, ty + 1);
      if (belowPool.fluidType !== 0) {
        pool = belowPool;
        bobberTy = ty + 1;
      }
    }
    if (pool.fluidType === 0 || pool.depthTier === 'none') {
      return { ok: false, message: 'Cast your line into a Water or Acid pool!' };
    }

    const depthLevel = getFishingDepthLevel(pool.depth);
    const rodType = rodDef.rodType ?? 1;
    if (!canRodFishAtDepth(rodType, depthLevel)) {
      return { ok: false, message: `${rodDef.name} supports depth level ${rodType}, but this pool is depth level ${depthLevel}. Use a higher-type rod.` };
    }

    const now = Date.now();
    const isAdvancedRod = rodType >= 2;
    const delayMs = isAdvancedRod
      ? 1800 + Math.floor(Math.random() * 1400)
      : 2600 + Math.floor(Math.random() * 1900);

    const cast: ServerFishingCast = {
      playerId: account.id,
      playerName: account.name,
      worldName: live.state.name,
      bobberTx,
      bobberTy,
      fluidType: pool.fluidType,
      depthTier: pool.depthTier,
      depthLevel,
      rodItemId,
      rodInstanceId: rodSlot.rodInstanceId ?? (rodSlot.rodInstanceId = crypto.randomUUID()),
      rodUpgradeLevel: rodSlot.rodUpgradeLevel ?? 1,
      pullingStrength: getFishingPullStrength(rodType, rodSlot.rodUpgradeLevel ?? 1, this.gameConfig.fishing),
      pullProgress: 0,
      lineTension: 0.15,
      bobberOffset: 0,
      fightStartedAt: now,
      lastFightUpdateAt: now,
      biting: false,
      startedAt: now,
      biteAt: now + delayMs,
      expiresAt: now + delayMs + 15000,
    };
    live.activeCasts.set(account.id, cast);
    return { ok: true, cast };
  }

  handleUpgradeFishingRod(
    account: PlayerAccount,
    rodInstanceId: string
  ): { ok: true; notice: string } | { ok: false; message: string } {
    const slot = account.inventory.find((s) => s.rodInstanceId === rodInstanceId);
    const def = slot ? getItemDef(slot.itemId) : undefined;
    if (!slot || def?.toolKind !== 'rod' || !def.rodType) {
      return { ok: false, message: 'That fishing rod is no longer in your inventory.' };
    }
    const currentLevel = slot.rodUpgradeLevel ?? 1;
    if (currentLevel >= 3) return { ok: false, message: 'This fishing rod is already fully upgraded.' };
    const targetLevel = (currentLevel + 1) as 1 | 2 | 3;
    const cost = getRodUpgradeGemCost(def.rodType, targetLevel, this.gameConfig.fishing);
    if (!Number.isFinite(cost) || cost <= 0) return { ok: false, message: 'Invalid fishing rod upgrade cost.' };
    if (account.gems < cost) return { ok: false, message: `You need ${cost} Gems to upgrade ${def.name}.` };
    account.gems -= cost;
    slot.rodUpgradeLevel = targetLevel;
    this.savePlayer(account);
    return { ok: true, notice: `${def.name} upgraded to Level ${targetLevel} for ${cost} Gems!` };
  }

  handleReelFishing(
    live: LiveWorld,
    account: PlayerAccount
  ):
    | { ok: true; caught: boolean; finished: boolean; progress: number; caughtItemId?: number; caughtName?: string; depthTier?: LiquidPoolInfo['depthTier']; notice: string }
    | { ok: false; message: string } {
    const cast = live.activeCasts.get(account.id);
    if (!cast) return { ok: false, message: 'No active fishing cast.' };
    const now = Date.now();
    if (cast.lastReelAt && now - cast.lastReelAt < 120) {
      return {
        ok: true,
        caught: false,
        finished: false,
        progress: Math.round(cast.pullProgress),
        notice: 'Reeling in...',
      };
    }
    cast.lastReelAt = now;
    if (!cast.biting) {
      live.activeCasts.delete(account.id);
      return { ok: true, caught: false, finished: true, progress: 0, notice: 'Reeled in too early — wait for the ! bite alert.' };
    }

    const rodSlot = account.inventory.find(
      (s) => s.rodInstanceId === cast.rodInstanceId && s.itemId === cast.rodItemId && (s.durability ?? 1) > 0
    );
    if (!rodSlot) {
      live.activeCasts.delete(account.id);
      return { ok: false, message: 'The fishing rod used for this cast is no longer available or has no durability.' };
    }

    if (cast.fishItemId === undefined) {
      if (cast.fluidType === 2 || cast.depthTier === 'acid') {
        cast.fishItemId = ITEM_IDS.FISH_SLIMEFIN;
      } else {
        const depthLevel = cast.depthLevel ?? 1;
        const candidates = [ITEM_IDS.FISH_MINNOW, ITEM_IDS.FISH_CARP, ITEM_IDS.FISH_GLACIER_TROUT]
          .map((itemId) => {
            const fish = getItemDef(itemId);
            return { itemId, weight: fish?.fishDepthProfile ? getFishDepthWeight(fish.fishDepthProfile, depthLevel) : 0 };
          })
          .filter((candidate) => candidate.weight > 0);
        const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
        if (totalWeight > 0) {
          let roll = Math.random() * totalWeight;
          const selected = candidates.find((candidate) => (roll -= candidate.weight) < 0);
          cast.fishItemId = selected?.itemId ?? candidates[candidates.length - 1].itemId;
        } else {
          cast.fishItemId = ITEM_IDS.FISH_MINNOW;
        }
      }
      cast.fishResistance = getFishPullResistance(cast.fishItemId ?? ITEM_IDS.FISH_MINNOW, this.gameConfig.fishing);
    }

    const fishItemId = cast.fishItemId ?? ITEM_IDS.FISH_MINNOW;
    const resistance = cast.fishResistance ?? getFishPullResistance(fishItemId, this.gameConfig.fishing);
    const timingMultiplier = cast.lineTension > 0.82 ? 0.55 : cast.lineTension < 0.38 ? 1.3 : 0.95;
    cast.pullProgress = Math.min(100, cast.pullProgress + 22 * timingMultiplier * cast.pullingStrength / resistance);
    if (cast.pullProgress < 100) {
      return {
        ok: true,
        caught: false,
        finished: false,
        progress: Math.round(cast.pullProgress),
        notice: `The ${getItemDef(fishItemId)?.name ?? 'fish'} is fighting back! Keep reeling.`,
      };
    }

    live.activeCasts.delete(account.id);
    if (typeof rodSlot.durability === 'number') {
      rodSlot.durability = Math.max(0, rodSlot.durability - 1);
    }
    const caughtItemId = fishItemId;
    this.addInventory(account, caughtItemId, 1);
    account.stats.fishCaught = (account.stats.fishCaught ?? 0) + 1;
    const def = getItemDef(caughtItemId);
    const leveled = addXp(account.level, account.xp, def?.xpValue ?? 4);
    account.level = leveled.level;
    account.xp = leveled.xp;
    this.savePlayer(account);

    return {
      ok: true,
      caught: true,
      finished: true,
      progress: 100,
      caughtItemId,
      caughtName: def?.name ?? 'Fish',
      depthTier: cast.depthTier,
      notice: `Caught ${def?.name ?? 'a fish'} from ${cast.depthTier} water!`,
    };
  }

  handleExchangeAction(
    account: PlayerAccount,
    opts: {
      action: 'list' | 'post' | 'buy' | 'cancel' | 'claim_wl';
      itemId?: number;
      bundleSize?: number;
      bundles?: number;
      priceWl?: number;
      listingId?: string;
      txId?: string;
    }
  ): { ok: true; notice?: string; sellerIdToNotify?: string } | { ok: false; message: string } {
    if (opts.action === 'list') {
      return { ok: true };
    }

    if (opts.action === 'claim_wl') {
      const claim = Math.max(0, Math.floor(account.unclaimedWl ?? 0));
      if (claim <= 0) {
        return { ok: false, message: 'No World Locks waiting in your Exchange Vault.' };
      }
      this.addInventory(account, ITEM_IDS.WORLD_LOCK, claim);
      account.unclaimedWl = 0;
      this.savePlayer(account);
      return { ok: true, notice: `Claimed ${claim}× World Lock from Global Exchange Vault!` };
    }

    if (opts.action === 'post') {
      const itemId = Number(opts.itemId ?? 0);
      const bundleSize = Math.max(1, Math.min(200, Math.floor(Number(opts.bundleSize ?? 1))));
      const bundles = Math.max(1, Math.min(25, Math.floor(Number(opts.bundles ?? 1))));
      const priceWl = Math.max(1, Math.min(999, Math.floor(Number(opts.priceWl ?? 1))));

      const def = getItemDef(itemId);
      if (!def || !def.tradeable || itemId === ITEM_IDS.WORLD_LOCK) {
        return { ok: false, message: 'This item cannot be listed for World Locks.' };
      }
      if (def.maxDurability) {
        return { ok: false, message: 'Durable tools cannot be stacked on Global Exchange.' };
      }

      const totalQty = bundleSize * bundles;
      const slot = account.inventory.find((s) => s.itemId === itemId);
      if (!slot || slot.qty < totalQty) {
        return { ok: false, message: `Need ${totalQty}× ${def.name} in your Backpack.` };
      }

      const clearingFeeGems = priceWl === 1 ? 10 * bundles : 0;
      if (clearingFeeGems > 0 && account.gems < clearingFeeGems) {
        return {
          ok: false,
          message: `1-WL listings require a ${clearingFeeGems} Gem anti-spam clearing fee.`,
        };
      }

      if (!this.consumeInventory(account, itemId, totalQty)) {
        return { ok: false, message: 'Failed to escrow items.' };
      }
      if (clearingFeeGems > 0) {
        account.gems -= clearingFeeGems;
        this.exchangeState.totalGemsCleared += clearingFeeGems;
      }

      const listing: ExchangeListing = {
        id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sellerId: account.id,
        sellerName: account.name,
        itemId,
        bundleSize,
        bundlesAvailable: bundles,
        priceWl,
        createdAt: Date.now(),
      };
      this.exchangeState.listings.unshift(listing);
      this.saveExchange();
      this.savePlayer(account);
      return {
        ok: true,
        notice: `Listed ${bundles}× bundle (${bundleSize} ${def.name}) for ${priceWl} WL each.`,
      };
    }

    if (opts.action === 'buy') {
      const txId = opts.txId ?? '';
      if (!txId || account.processedTxIds.includes(txId)) {
        return { ok: false, message: 'Duplicate trade ignored.' };
      }
      const idx = this.exchangeState.listings.findIndex((l) => l.id === opts.listingId);
      if (idx === -1) {
        return { ok: false, message: 'Listing no longer available.' };
      }
      const listing = this.exchangeState.listings[idx];
      if (listing.sellerId === account.id) {
        return { ok: false, message: 'Cannot buy your own listing (use Cancel instead).' };
      }
      if (listing.bundlesAvailable < 1) {
        return { ok: false, message: 'Listing is sold out.' };
      }

      const wlSlot = account.inventory.find((s) => s.itemId === ITEM_IDS.WORLD_LOCK);
      if (!wlSlot || wlSlot.qty < listing.priceWl) {
        return {
          ok: false,
          message: `Need ${listing.priceWl}× World Lock to buy this bundle.`,
        };
      }

      if (!this.consumeInventory(account, ITEM_IDS.WORLD_LOCK, listing.priceWl)) {
        return { ok: false, message: 'World Lock payment failed.' };
      }

      // 5% WL sink on >= 2 WL trades (1-WL trades already paid 10 Gems clearing fee)
      const taxWl = listing.priceWl >= 2 ? Math.max(1, Math.floor(listing.priceWl * 0.05)) : 0;
      const payoutWl = listing.priceWl - taxWl;
      this.exchangeState.totalWlBurned += taxWl;

      account.processedTxIds.push(txId);
      this.addInventory(account, listing.itemId, listing.bundleSize);
      account.stats.exchangeTrades = (account.stats.exchangeTrades ?? 0) + 1;
      const leveled = addXp(account.level, account.xp, 10);
      account.level = leveled.level;
      account.xp = leveled.xp;

      const seller = this.findPlayerByNameOrId(listing.sellerId);
      if (seller) {
        seller.unclaimedWl = (seller.unclaimedWl ?? 0) + payoutWl;
        seller.stats.exchangeTrades = (seller.stats.exchangeTrades ?? 0) + 1;
        this.savePlayer(seller);
      }

      // Update rolling average price stat
      const unitWl = listing.priceWl / listing.bundleSize;
      const prevStat = this.exchangeState.priceStats[listing.itemId];
      const nextVol = (prevStat?.volumeSold ?? 0) + listing.bundleSize;
      const avgUnitWl = prevStat
        ? (prevStat.avgUnitWl * prevStat.volumeSold + listing.priceWl) / nextVol
        : unitWl;
      this.exchangeState.priceStats[listing.itemId] = {
        itemId: listing.itemId,
        avgUnitWl: Math.round(avgUnitWl * 1000) / 1000,
        lastTradeWl: Math.round(unitWl * 1000) / 1000,
        volumeSold: nextVol,
        updatedAt: Date.now(),
      };

      listing.bundlesAvailable -= 1;
      if (listing.bundlesAvailable <= 0) {
        this.exchangeState.listings.splice(idx, 1);
      }

      this.saveExchange();
      this.savePlayer(account);
      const itemName = getItemDef(listing.itemId)?.name ?? 'Item';
      return {
        ok: true,
        sellerIdToNotify: listing.sellerId,
        notice: `Bought ${listing.bundleSize}× ${itemName} for ${listing.priceWl} WL (${taxWl} WL tax burned).`,
      };
    }

    if (opts.action === 'cancel') {
      const idx = this.exchangeState.listings.findIndex((l) => l.id === opts.listingId);
      if (idx === -1) return { ok: false, message: 'Listing not found.' };
      const listing = this.exchangeState.listings[idx];
      if (listing.sellerId !== account.id && account.role !== 'admin') {
        return { ok: false, message: 'Only the seller can cancel this listing.' };
      }
      const refundQty = listing.bundleSize * listing.bundlesAvailable;
      this.addInventory(account, listing.itemId, refundQty);
      this.exchangeState.listings.splice(idx, 1);
      this.saveExchange();
      this.savePlayer(account);
      return { ok: true, notice: `Cancelled listing and returned ${refundQty}× items.` };
    }

    return { ok: false, message: 'Unknown exchange action.' };
  }

  /** Periodic 250ms tick helpers called by server.ts */
  tickAllWorlds(now: number): {
    fluidUpdates: Array<{ worldName: string; deltas: FluidDelta[] }>;
    fishingBites: Array<{ worldName: string; cast: ServerFishingCast }>;
    fishingTimeouts: Array<{ worldName: string; playerId: string }>;
    fishingStates: Array<{ worldName: string; cast: ServerFishingCast }>;
    completedFurnaces: Array<{ worldName: string; tx: number; ty: number }>;
    completedEngines: Array<{ worldName: string; tx: number; ty: number }>;
    expiredMines: Array<{ worldName: string; playerIds: string[] }>;
  } {
    const fluidUpdates: Array<{ worldName: string; deltas: FluidDelta[] }> = [];
    const fishingBites: Array<{ worldName: string; cast: ServerFishingCast }> = [];
    const fishingTimeouts: Array<{ worldName: string; playerId: string }> = [];
    const fishingStates: Array<{ worldName: string; cast: ServerFishingCast }> = [];
    const completedFurnaces: Array<{ worldName: string; tx: number; ty: number }> = [];
    const completedEngines: Array<{ worldName: string; tx: number; ty: number }> = [];
    const expiredMines: Array<{ worldName: string; playerIds: string[] }> = [];

    for (const [wName, live] of this.worlds.entries()) {
      if (live.state.worldKind === 'mine_shaft' && live.state.expiresAt && now >= live.state.expiresAt) {
        expiredMines.push({ worldName: wName, playerIds: Array.from(live.players.keys()) });
        this.worlds.delete(wName);
        continue;
      }

      if (live.players.size === 0 && live.activeCasts.size === 0) continue;

      if (live.fluidFrontier.size > 0) {
        const deltas = stepFluidFrontier(live.state, live.fluidFrontier, 220);
        if (deltas.length > 0) {
          live.dirty = true;
          fluidUpdates.push({ worldName: wName, deltas });
        }
      }

      for (const [pid, cast] of live.activeCasts.entries()) {
        if (!cast.biting && now >= cast.biteAt) {
          cast.biting = true;
          fishingBites.push({ worldName: wName, cast });
        } else if (cast.biting && now >= cast.expiresAt) {
          live.activeCasts.delete(pid);
          fishingTimeouts.push({ worldName: wName, playerId: pid });
        } else if (cast.biting) {
          if (cast.pullProgress > 0) cast.pullProgress = Math.max(0, cast.pullProgress - 0.75);
          const fishId = cast.fishItemId;
          if (fishId !== undefined && !cast.fightPattern) {
            cast.fightPattern = fishId === ITEM_IDS.FISH_MINNOW ? 'darting'
              : fishId === ITEM_IDS.FISH_CARP ? 'surging'
              : fishId === ITEM_IDS.FISH_GLACIER_TROUT ? 'deep_run' : 'erratic';
          }
          const pattern = cast.fightPattern ?? 'darting';
          const elapsed = now - cast.fightStartedAt;
          const period = pattern === 'darting' ? 900 : pattern === 'surging' ? 1900 : pattern === 'deep_run' ? 2600 : 1250;
          const wave = Math.sin((elapsed / period) * Math.PI * 2);
          const secondary = Math.sin((elapsed / (period * 0.47)) * Math.PI * 2);
          const amplitude = pattern === 'deep_run' ? 9 : pattern === 'surging' ? 7 : pattern === 'erratic' ? 11 : 5;
          cast.lineTension = Math.max(0.08, Math.min(1, 0.52 + wave * 0.32 + (pattern === 'erratic' ? secondary * 0.16 : 0)));
          cast.bobberOffset = Math.round(wave * amplitude + (pattern === 'erratic' ? secondary * 3 : 0));
          if (now - cast.lastFightUpdateAt >= 500) {
            cast.lastFightUpdateAt = now;
            fishingStates.push({ worldName: wName, cast });
          }
        }
      }

      if (live.state.furnaces) {
        for (const f of Object.values(live.state.furnaces)) {
          if (f.recipeId && f.finishesAt && now >= f.finishesAt && f.readyOutputItemId === 0) {
            const recipe = FURNACE_RECIPES.find((r) => r.id === f.recipeId);
            if (recipe) {
              f.readyOutputItemId = recipe.outputItemId;
              f.readyOutputQty = recipe.outputQty;
            }
            f.recipeId = null;
            f.startedAt = null;
            f.finishesAt = null;
            live.state.revision += 1;
            live.dirty = true;
            completedFurnaces.push({ worldName: wName, tx: f.x, ty: f.y });
          }
        }
      }
      if (live.state.matteragenEngines) {
        let enginesChanged = false;
        for (const engine of Object.values(live.state.matteragenEngines)) {
          if (engine.isReady) continue; // Stops past a singular yield until collected
          const interval = getMatteragenEffectiveIntervalMs(engine.typeId, engine.level || 1);
          if (now - (engine.lastHarvestMs || engine.placedAtMs || now) >= interval) {
            engine.isReady = true;
            engine.storedDrops = rollMatteragenYield(engine.typeId, engine.level || 1);
            live.dirty = true;
            enginesChanged = true;
            completedEngines.push({ worldName: wName, tx: engine.x, ty: engine.y });
          }
        }
        if (enginesChanged) {
          live.state.revision += 1;
        }
      }
      if (live.state.atmMachines) {
        let atmsChanged = false;
        for (const atm of Object.values(live.state.atmMachines)) {
          if (atm.isReady) continue; // Holds single payout until collected
          const interval = atm.intervalMs || ATM_MIN_INTERVAL_MS;
          if (now - (atm.lastHarvestMs || atm.placedAtMs || now) >= interval) {
            atm.isReady = true;
            atm.storedGems = rollAtmGems();
            live.dirty = true;
            atmsChanged = true;
            completedEngines.push({ worldName: wName, tx: atm.x, ty: atm.y });
          }
        }
        if (atmsChanged) {
          live.state.revision += 1;
        }
      }
    }

    return { fluidUpdates, fishingBites, fishingTimeouts, fishingStates, completedFurnaces, completedEngines, expiredMines };
  }

  upgradeMatteragenEngine(
    account: PlayerAccount,
    worldName: string,
    tx: number,
    ty: number
  ): { ok: true; level: number; coreTokens: number; notice: string } | { ok: false; message: string } {
    const live = this.worlds.get(worldName);
    if (!live) return { ok: false, message: 'World not found.' };
    const key = `${tx},${ty}`;
    const engine = live.state.matteragenEngines?.[key];
    if (!engine) return { ok: false, message: 'Matteragen Engine not found.' };
    if (
      live.state.worldLock &&
      live.state.worldLock.ownerId !== account.id &&
      !live.state.worldLock.editors.includes(account.id) &&
      account.role !== 'admin'
    ) {
      return { ok: false, message: 'Only the world owner can upgrade engines.' };
    }
    if (engine.level >= 5) {
      return { ok: false, message: 'Engine is already at maximum Level 5.' };
    }
    const cost = MATTERAGEN_UPGRADE_COSTS[engine.level] ?? 6;
    const availableTokens = Math.max(0, Math.floor(Number(live.state.coreTokens ?? 0)));
    if (availableTokens < cost) {
      return {
        ok: false,
        message: `Requires ${cost} Core Tokens (World has ${availableTokens}).`,
      };
    }
    live.state.coreTokens = availableTokens - cost;
    engine.level += 1;
    live.state.revision += 1;
    live.dirty = true;
    this.saveWorld(live, true);
    const totalReductionPct = (engine.level - 1) * 5;
    return {
      ok: true,
      level: engine.level,
      coreTokens: live.state.coreTokens,
      notice: `Upgraded to Lv.${engine.level} (-${totalReductionPct}% production time)!`,
    };
  }

  claimMatteragenEngine(
    account: PlayerAccount,
    worldName: string,
    tx: number,
    ty: number
  ):
    | {
        ok: true;
        partial: boolean;
        engine: MatteragenRecord;
        claimedItems: Array<{ itemId: number; qty: number }>;
        worldXpUpdate?: { worldXp: number; worldLevel: number; coreTokens: number; leveledUp: boolean } | null;
        notice: string;
      }
    | { ok: false; message: string } {
    const live = this.worlds.get(worldName);
    if (!live) return { ok: false, message: 'World not found.' };
    const key = `${tx},${ty}`;
    const engine = live.state.matteragenEngines?.[key];
    if (!engine) return { ok: false, message: 'Matteragen Engine not found.' };

    if (account.role !== 'admin' && !hasEditPermission(live.state, account.id, tx, ty, 'interact')) {
      return { ok: false, message: 'You do not have permission to claim this Matteragen Engine.' };
    }
    if (!engine.isReady || !engine.storedDrops || engine.storedDrops.length === 0) {
      return { ok: false, message: 'Matteragen Engine yield is not ready yet.' };
    }

    const claimedItems: Array<{ itemId: number; qty: number }> = [];
    let totalClaimed = 0;

    for (const drop of engine.storedDrops) {
      if (drop.count <= 0) continue;
      const fit = this.addInventoryPartial(account, drop.itemId, drop.count);
      if (fit > 0) {
        drop.count -= fit;
        totalClaimed += fit;
        claimedItems.push({ itemId: drop.itemId, qty: fit });
      }
    }

    engine.storedDrops = engine.storedDrops.filter((d) => d.count > 0);
    if (totalClaimed <= 0) {
      return {
        ok: false,
        message: `Backpack full (20/20 slots or ${MAX_STACK_SIZE} stack cap). Clear space to claim yield.`,
      };
    }

    const now = Date.now();
    if (engine.storedDrops.length > 0) {
      // Partial claim: keep engine ready with remaining unclaimed drops
      engine.isReady = true;
      live.state.revision += 1;
      live.dirty = true;
      this.saveWorld(live, true);
      this.savePlayer(account, true);
      return {
        ok: true,
        partial: true,
        engine,
        claimedItems,
        notice: `Claimed ${totalClaimed} blocks (Backpack full — clear space for remaining yield).`,
      };
    }

    // Full claim: award XP, Gems, World XP, and restart production cycle
    const engLevel = Math.max(1, engine.level || 1);
    const xpGain = 15 * engLevel;
    const gemBonus = 10 * engLevel;
    account.gems += gemBonus;
    const leveled = addXp(account.level, account.xp, xpGain);
    account.level = leveled.level;
    account.xp = leveled.xp;
    const playerState = live.players.get(account.id);
    if (playerState) playerState.level = account.level;

    const branchTier: 1 | 2 | 3 | 4 | 5 =
      engine.typeId === ITEM_IDS.MATTERAGEN_COSMIC
        ? 5
        : engine.typeId === ITEM_IDS.MATTERAGEN_ARCANE
          ? 4
          : engine.typeId === ITEM_IDS.MATTERAGEN_LUMINESCENT
            ? 3
            : engine.typeId === ITEM_IDS.MATTERAGEN_GEOMINERAL
              ? 2
              : 1;
    const tokenEarned = this.tryAwardCoreToken(live, account, {
      kind: 'matteragen_harvest',
      branchTier,
      level: engLevel,
    });
    const worldXpUpdate = this.awardWorldXp(live, account, 10 * engLevel);

    engine.isReady = false;
    engine.storedDrops = [];
    engine.lastHarvestMs = now;
    live.state.revision += 1;
    live.dirty = true;
    this.saveWorld(live, true);
    this.savePlayer(account, true);

    return {
      ok: true,
      partial: false,
      engine,
      claimedItems,
      worldXpUpdate,
      notice: `Claimed ${totalClaimed} blocks & +${gemBonus} Gems${tokenEarned ? ' (+1 Core Token!)' : ''}!`,
    };
  }

  unlockWorldCoreFurnace(
    live: LiveWorld,
    account: PlayerAccount
  ):
    | {
        ok: true;
        tx: number;
        ty: number;
        furnace: FurnaceRecord;
        coreTokens: number;
        notice: string;
      }
    | { ok: false; message: string } {
    if (!live.state.worldLock || live.state.worldLock.ownerId !== account.id) {
      return { ok: false, message: 'Only the World Owner can unlock the WorldCore Smeltery Furnace.' };
    }
    const worldLvl = live.state.worldLevel ?? 1;
    if (worldLvl < WORLDCORE_FURNACE_UNLOCK_LEVEL) {
      return {
        ok: false,
        message: `Requires World Level ${WORLDCORE_FURNACE_UNLOCK_LEVEL} (currently Lv. ${worldLvl}).`,
      };
    }
    if (live.state.hasWorldCoreFurnace) {
      return { ok: false, message: 'WorldCore Smeltery Furnace is already unlocked.' };
    }
    const availableDb = Math.max(0, Math.floor(Number(account.alterbits ?? 0)));
    if (availableDb < WORLDCORE_FURNACE_DIGIBIT_COST) {
      return {
        ok: false,
        message: `Requires ${WORLDCORE_FURNACE_DIGIBIT_COST} Digibits (you have ${availableDb} DB).`,
      };
    }
    const availableTokens = Math.max(0, Math.floor(Number(live.state.coreTokens ?? 0)));
    if (availableTokens < WORLDCORE_FURNACE_TOKEN_COST) {
      return {
        ok: false,
        message: `Requires ${WORLDCORE_FURNACE_TOKEN_COST} Core Tokens (WorldCore has ${availableTokens}).`,
      };
    }

    account.alterbits = availableDb - WORLDCORE_FURNACE_DIGIBIT_COST;
    live.state.coreTokens = availableTokens - WORLDCORE_FURNACE_TOKEN_COST;

    const coreX = live.state.worldLock.x;
    const coreY = live.state.worldLock.y;
    const fx = coreX + 1;
    const fy = Math.max(1, coreY - 1);
    const idx = tileIndexIn(live.state, fx, fy);
    const prevBg = live.state.bg[idx];
    if (
      prevBg !== ITEM_IDS.BG_SKY &&
      prevBg !== ITEM_IDS.GP_ROCK_BACKGROUND &&
      prevBg !== ITEM_IDS.STONE_FURNACE
    ) {
      const added = this.addInventoryPartial(account, prevBg, 1);
      if (added <= 0) {
        account.overflowVault = account.overflowVault ?? [];
        this.pushToOverflowVault(account.overflowVault, { itemId: prevBg, qty: 1 });
      }
    }

    live.state.bg[idx] = ITEM_IDS.STONE_FURNACE;
    live.state.hasWorldCoreFurnace = true;
    live.state.coreFurnacePos = { x: fx, y: fy };
    live.state.furnaces = live.state.furnaces ?? {};
    const fRecord: FurnaceRecord = {
      x: fx,
      y: fy,
      ownerId: account.id,
      recipeId: null,
      startedAt: null,
      finishesAt: null,
      readyOutputItemId: 0,
      readyOutputQty: 0,
    };
    live.state.furnaces[`${fx},${fy}`] = fRecord;
    live.state.revision += 1;
    live.dirty = true;
    this.saveWorld(live, true);
    this.savePlayer(account, true);

    return {
      ok: true,
      tx: fx,
      ty: fy,
      furnace: fRecord,
      coreTokens: live.state.coreTokens,
      notice: `Unlocked WorldCore Smeltery Furnace at (${fx}, ${fy})!`,
    };
  }

  handleConfigureDoor(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    targetX: number,
    targetY: number,
    rawLabel?: string
  ):
    | { ok: true; doorLink: import('../src/game/worldGen.ts').DoorLinkRecord; notice: string }
    | { ok: false; message: string } {
    if (isSystemWorld(live.state.name) && account.role !== 'admin') {
      return { ok: false, message: 'System world doorways cannot be reconfigured.' };
    }
    if (account.role !== 'admin' && !hasEditPermission(live.state, account.id, tx, ty, 'build')) {
      return { ok: false, message: 'Only the world owner or authorized editors can link this Door.' };
    }
    if (!inBoundsWorld(live.state, tx, ty) || !inBoundsWorld(live.state, targetX, targetY)) {
      return { ok: false, message: 'Target doorway coordinates are out of world bounds.' };
    }
    const idx = tileIndexIn(live.state, tx, ty);
    if (!isDoorBlock(live.state.bg[idx]) && !isDoorBlock(live.state.fg[idx])) {
      return { ok: false, message: 'No Doorway found at that tile.' };
    }
    const cleanLabel = (rawLabel ?? '').trim().slice(0, 32) || `Gateway (${targetX}, ${targetY})`;
    live.state.doorLinks = live.state.doorLinks ?? {};
    const record = {
      x: tx,
      y: ty,
      targetX: Math.floor(targetX),
      targetY: Math.floor(targetY),
      label: cleanLabel,
    };
    live.state.doorLinks[`${tx},${ty}`] = record;
    live.state.revision += 1;
    this.saveWorld(live);
    return {
      ok: true,
      doorLink: record,
      notice: `Linked Door at (${tx}, ${ty}) → (${record.targetX}, ${record.targetY}) [${cleanLabel}].`,
    };
  }

  handleUseDoor(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number
  ):
    | { ok: true; targetX: number; targetY: number; remote: RemotePlayerState; notice: string }
    | { ok: false; message: string } {
    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false, message: 'Player not in world.' };
    const link = live.state.doorLinks?.[`${tx},${ty}`];
    if (!link) {
      return { ok: false, message: 'This Doorway is not linked yet. Use a Tinker Wrench to link target coordinates.' };
    }
    if (!inBoundsWorld(live.state, link.targetX, link.targetY)) {
      return { ok: false, message: 'Linked destination is out of bounds.' };
    }
    playerState.x = link.targetX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
    playerState.y = (link.targetY + 1) * TILE_SIZE - PLAYER_HEIGHT;
    playerState.vx = 0;
    playerState.vy = 0;
    this.recordPlayerPose(live.state.name, account.id, {
      x: playerState.x,
      y: playerState.y,
      vx: 0,
      vy: 0,
      facing: playerState.facing,
      grounded: true,
    });
    return {
      ok: true,
      targetX: link.targetX,
      targetY: link.targetY,
      remote: playerState,
      notice: `Entered ${link.label || `Doorway → (${link.targetX}, ${link.targetY})`}!`,
    };
  }

  handleNexusTeleport(
    live: LiveWorld,
    account: PlayerAccount,
    targetX: number,
    targetY: number,
    rawLabel?: string
  ):
    | { ok: true; targetX: number; targetY: number; remote: RemotePlayerState; notice: string }
    | { ok: false; message: string } {
    if (live.state.name !== 'NEXUS') {
      return { ok: false, message: 'NEXUS Transit Door is only available inside NEXUS.' };
    }
    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false, message: 'Player not in NEXUS.' };
    const tx = Math.max(2, Math.min((live.state.width || 100) - 3, Math.floor(Number(targetX))));
    const ty = Math.max(2, Math.min((live.state.height || 60) - 3, Math.floor(Number(targetY))));
    playerState.x = tx * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
    playerState.y = (ty + 1) * TILE_SIZE - PLAYER_HEIGHT;
    playerState.vx = 0;
    playerState.vy = 0;
    this.recordPlayerPose(live.state.name, account.id, {
      x: playerState.x,
      y: playerState.y,
      vx: 0,
      vy: 0,
      facing: playerState.facing,
      grounded: true,
    });
    return {
      ok: true,
      targetX: tx,
      targetY: ty,
      remote: playerState,
      notice: `Traveled via NEXUS Multi-Way Door to ${rawLabel || `(${tx}, ${ty})`}!`,
    };
  }

  tickBfgCollectors(now: number): Array<{
    worldName: string;
    collectorTiles: Array<{ tx: number; ty: number }>;
    harvestedTiles: Array<{ tx: number; ty: number }>;
    removedDropIds: string[];
  }> {
    const updates: Array<{
      worldName: string;
      collectorTiles: Array<{ tx: number; ty: number }>;
      harvestedTiles: Array<{ tx: number; ty: number }>;
      removedDropIds: string[];
    }> = [];

    for (const [wName, live] of this.worlds.entries()) {
      if (live.players.size === 0 || !live.state.bfgCollectors) continue;
      const collectors = Object.values(live.state.bfgCollectors);
      if (collectors.length === 0) continue;

      const collectorTiles: Array<{ tx: number; ty: number }> = [];
      const harvestedTiles: Array<{ tx: number; ty: number }> = [];
      const removedDropIds: string[] = [];

      const storeInBfg = (bfg: BfgCollectorRecord, itemId: number, qty: number) => {
        const existing = bfg.storedItems.find((s) => s.itemId === itemId);
        if (existing) existing.qty += qty;
        else bfg.storedItems.push({ itemId, qty });
      };

      for (const bfg of collectors) {
        if (!bfg.active) continue;
        let touched = false;

        // 1. Harvest mature trees within 3-tile radius (excluding soil crops which ripen into Crop Blocks)
        for (const [key, plant] of Object.entries(live.state.plants)) {
          if (isCropSeed(plant.seedId)) continue;
          if (Math.max(Math.abs(plant.x - bfg.x), Math.abs(plant.y - bfg.y)) > 3) continue;
          const growth = getPlantGrowthState(plant, now);
          if (growth.stage !== 'mature') continue;
          const seedDef = getEffectiveItemDef(plant.seedId, this.gameConfig);
          delete live.state.plants[key];
          harvestedTiles.push({ tx: plant.x, ty: plant.y });
          for (const reward of rollTreeHarvestRewards(plant.seedId, seedDef)) {
            storeInBfg(bfg, reward.itemId, reward.qty);
          }
          bfg.storedGems += 2 + Math.floor(Math.random() * 3);
          touched = true;
        }

        // 2. Magnet nearby drops within 5 tiles into buffer
        for (const [dropId, drop] of live.drops.entries()) {
          const dTiles = Math.hypot(
            drop.x / TILE_SIZE - (bfg.x + 0.5),
            drop.y / TILE_SIZE - (bfg.y + 0.5)
          );
          if (dTiles <= 5.2) {
            live.drops.delete(dropId);
            removedDropIds.push(dropId);
            if (drop.isGem) bfg.storedGems += drop.qty;
            else storeInBfg(bfg, drop.itemId, drop.qty);
            touched = true;
          }
        }

        if (touched) {
          collectorTiles.push({ tx: bfg.x, ty: bfg.y });
        }
      }

      if (collectorTiles.length > 0 || harvestedTiles.length > 0 || removedDropIds.length > 0) {
        live.state.revision += 1;
        this.saveWorld(live);
        updates.push({ worldName: wName, collectorTiles, harvestedTiles, removedDropIds });
      }
    }
    return updates;
  }

  handleEquipWearable(
    account: PlayerAccount,
    itemId: number
  ): { ok: true; notice: string } | { ok: false; message: string } {
    const def = getItemDef(itemId);
    if (!def || def.category !== 'wearable' || !def.wearableSlot) {
      return { ok: false, message: 'Item is not a wearable cosmetic.' };
    }
    const owned = account.inventory.find((s) => s.itemId === itemId);
    if (!owned || owned.qty < 1) {
      return { ok: false, message: 'You do not own that wearable.' };
    }
    const slot = def.wearableSlot;
    if (account.equipped[slot] === itemId) {
      delete account.equipped[slot];
      this.savePlayer(account);
      return { ok: true, notice: `Unequipped ${def.name}.` };
    }
    account.equipped[slot] = itemId;
    this.savePlayer(account);
    return { ok: true, notice: `Equipped ${def.name}!` };
  }

  handleFriendAction(
    account: PlayerAccount,
    action: 'send_request' | 'accept' | 'decline' | 'remove',
    targetNameOrId: string
  ): { ok: true; targetAccount?: PlayerAccount; notice: string } | { ok: false; message: string } {
    const cleanTarget = targetNameOrId.trim();
    if (!cleanTarget) return { ok: false, message: 'Enter a player name.' };

    if (action === 'send_request') {
      const target = this.findPlayerByNameOrId(cleanTarget);
      if (!target) {
        return { ok: false, message: `Player "${cleanTarget}" not found.` };
      }
      if (target.id === account.id) {
        return { ok: false, message: 'You cannot send a friend request to yourself.' };
      }
      if (account.friends.includes(target.id)) {
        return { ok: false, message: `${target.name} is already on your Friend List.` };
      }
      if (!target.incomingRequests.some((r) => r.fromId === account.id)) {
        target.incomingRequests.push({
          fromId: account.id,
          fromName: account.name,
          timestamp: Date.now(),
        });
        this.savePlayer(target);
      }
      return { ok: true, targetAccount: target, notice: `Friend request sent to ${target.name}.` };
    }

    if (action === 'accept') {
      const req = account.incomingRequests.find((r) => r.fromId === cleanTarget || r.fromName === cleanTarget);
      if (!req) return { ok: false, message: 'Friend request not found.' };
      account.incomingRequests = account.incomingRequests.filter((r) => r.fromId !== req.fromId);
      if (!account.friends.includes(req.fromId)) {
        account.friends.push(req.fromId);
        account.stats.friendsAdded = (account.stats.friendsAdded ?? 0) + 1;
      }
      const sender = this.findPlayerByNameOrId(req.fromId);
      if (sender && !sender.friends.includes(account.id)) {
        sender.friends.push(account.id);
        sender.stats.friendsAdded = (sender.stats.friendsAdded ?? 0) + 1;
        this.savePlayer(sender);
      }
      this.savePlayer(account);
      return { ok: true, targetAccount: sender ?? undefined, notice: `You and ${req.fromName} are now friends!` };
    }

    if (action === 'decline') {
      account.incomingRequests = account.incomingRequests.filter(
        (r) => r.fromId !== cleanTarget && r.fromName !== cleanTarget
      );
      this.savePlayer(account);
      return { ok: true, notice: 'Declined friend request.' };
    }

    if (action === 'remove') {
      account.friends = account.friends.filter((id) => id !== cleanTarget);
      const target = this.findPlayerByNameOrId(cleanTarget);
      if (target) {
        target.friends = target.friends.filter((id) => id !== account.id);
        this.savePlayer(target);
      }
      this.savePlayer(account);
      return { ok: true, targetAccount: target ?? undefined, notice: 'Removed friend.' };
    }

    return { ok: false, message: 'Unknown friend action.' };
  }

  handleClaimAchievement(
    account: PlayerAccount,
    achievementId: string
  ): { ok: true; notice: string } | { ok: false; message: string } {
    const ach = ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!ach) return { ok: false, message: 'Achievement not found.' };
    if (account.claimedAchievements.includes(ach.id)) {
      return { ok: false, message: 'Achievement reward already claimed.' };
    }
    const progress = account.stats[ach.statKey] ?? 0;
    if (progress < ach.target) {
      return { ok: false, message: `Progress ${progress}/${ach.target} — not yet complete.` };
    }

    account.claimedAchievements.push(ach.id);
    account.gems += ach.gemReward;
    const leveled = addXp(account.level, account.xp, ach.xpReward);
    account.level = leveled.level;
    account.xp = leveled.xp;
    this.savePlayer(account);
    return {
      ok: true,
      notice: `Claimed "${ach.name}": +${ach.gemReward} Gems & +${ach.xpReward} XP!`,
    };
  }

  handleToggleFavoriteWorld(account: PlayerAccount, rawWorldName: string): string {
    const v = validateWorldName(rawWorldName);
    if (!v.ok) return 'Invalid world name.';
    const name = v.normalized;
    if (account.favoriteWorlds.includes(name)) {
      account.favoriteWorlds = account.favoriteWorlds.filter((w) => w !== name);
      this.savePlayer(account);
      return `Removed ${name} from Favorites.`;
    }
    account.favoriteWorlds.push(name);
    this.savePlayer(account);
    return `Added ${name} to Favorites!`;
  }

  handleChat(live: LiveWorld, account: PlayerAccount, rawText: string): ChatMessage | null {
    const now = Date.now();
    const prev = this.lastChatAt.get(account.id) ?? 0;
    if (now - prev < 500) return null;
    const text = rawText.trim().slice(0, 140);
    if (!text) return null;
    this.lastChatAt.set(account.id, now);

    const msg: ChatMessage = {
      id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: account.id,
      senderName: account.name,
      text,
      timestamp: now,
    };
    live.chatHistory.push(msg);
    if (live.chatHistory.length > 40) {
      live.chatHistory.shift();
    }
    return msg;
  }
}
