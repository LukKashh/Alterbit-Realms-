import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ACHIEVEMENTS,
  FURNACE_RECIPES,
  GEM_STORE_LISTINGS,
  getItemDef,
  ITEM_IDS,
  type ItemDefinition,
  type BuffType,
  type PlayerStatKey,
} from '../src/game/catalog.ts';
import {
  DEFAULT_VIEW_SCALE,
  MAX_WORLD_PLAYERS,
  PLANT_DEFAULT_GROWTH_MS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
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
  addXp,
  canBreakTile,
  canEnterWorld,
  canPlaceTile,
  getPlantGrowthState,
  hasEditPermission,
  inBoundsWorld,
  isWithinReach,
  resolveSplice,
  tileIndexIn,
  validateWorldName,
} from '../src/game/rules.ts';
import {
  generateMineShaft,
  generateWorld,
  type AreaLockRecord,
  type BfgCollectorRecord,
  type FurnaceRecord,
  type VendingMachineRecord,
  type WorldLockRecord,
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
import { canRodFishAtDepth, getFishingDepthLevel, getFishDepthWeight, getRodUpgradeGemCost, getFishingPullStrength, getFishPullResistance } from '../src/game/expansion.ts';


/** Shared server-side tree reward roll used by player harvesting and BFG collectors. */
function rollTreeHarvestRewards(seedId: number, seedDef: ItemDefinition | undefined, luckPct = 0) {
  if (!seedDef?.producesTileId) return [] as Array<{ itemId: number; qty: number }>;
  const yieldCfg = seedDef.treeHarvestYield ?? { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 };
  const minBlocks = Math.max(1, Math.round(yieldCfg.minBlocks));
  const maxBlocks = Math.max(minBlocks, Math.round(yieldCfg.maxBlocks));
  const rewards = [{ itemId: seedDef.producesTileId, qty: minBlocks + Math.floor(Math.random() * (maxBlocks - minBlocks + 1)) }];
  const luckMultiplier = 1 + Math.max(0, luckPct) / 100;
  if (Math.random() < Math.min(1, yieldCfg.seedChance * luckMultiplier)) rewards.push({ itemId: seedId, qty: 1 });
  for (const bonus of seedDef.bonusHarvestDrops ?? []) {
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
  xp: number;
  level: number;
  shirtColor: string;
  inventory: InventorySlot[];
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
  biteAt: number;
  expiresAt: number;
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

  constructor() {
    fs.mkdirSync(WORLDS_DIR, { recursive: true });
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });
    this.loadCredentials();
    this.loadSessions();
    this.loadGameConfig();
    this.loadExchange();
    this.seedDefaultAccounts();
    this.getOrCreateWorld('START');
    this.getOrCreateWorld('TRADE');
    this.getOrCreateWorld('FARM');
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

  private saveCredentials() {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.credentials, null, 2), 'utf8');
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

  private saveSessions() {
    const arr = Array.from(this.sessions.values()).slice(-500);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(arr), 'utf8');
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
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.gameConfig, null, 2), 'utf8');
  }

  private seedDefaultAccounts() {
    const adminEmail = 'puncisters@gmail.com';
    const adminUser = 'GameDev';
    const existing = this.credentials.find(
      (c) => c.email === adminEmail || c.usernameLower === adminUser.toLowerCase()
    );
    if (!existing) {
      const accountId = 'admin_gamedev';
      const cred: CredentialRecord = {
        accountId,
        email: adminEmail,
        username: adminUser,
        usernameLower: adminUser.toLowerCase(),
        passwordHash: this.hashPassword('123456'),
        role: 'admin',
        createdAt: Date.now(),
      };
      this.credentials.push(cred);
      this.saveCredentials();
      const acc = this.createEmptyPlayerAccount(accountId, adminUser, adminEmail, 'admin');
      this.players.set(accountId, acc);
      this.savePlayer(acc);
    } else {
      let changed = false;
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        changed = true;
      }
      if (existing.email !== adminEmail) {
        existing.email = adminEmail;
        changed = true;
      }
      if (changed) this.saveCredentials();
      const acc = this.loadPlayerById(existing.accountId);
      if (acc) {
        acc.role = 'admin';
        acc.email = adminEmail;
        this.savePlayer(acc);
      } else {
        const created = this.createEmptyPlayerAccount(
          existing.accountId,
          existing.username,
          adminEmail,
          'admin'
        );
        this.players.set(existing.accountId, created);
        this.savePlayer(created);
      }
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
    fs.writeFileSync(EXCHANGE_FILE, JSON.stringify(this.exchangeState, null, 2), 'utf8');
  }

  getExchangeSnapshot(): ExchangeSnapshot {
    return {
      listings: this.exchangeState.listings.map((l) => ({ ...l })),
      priceStats: { ...this.exchangeState.priceStats },
      totalWlBurned: this.exchangeState.totalWlBurned,
      totalGemsCleared: this.exchangeState.totalGemsCleared,
    };
  }

  private hydrateAccountDefaults(acc: PlayerAccount): PlayerAccount {
    acc.email = acc.email ?? '';
    acc.role = acc.role === 'admin' ? 'admin' : 'player';
    acc.equipped = acc.equipped ?? {};
    acc.stats = { ...DEFAULT_STATS, ...(acc.stats ?? {}) };
    acc.claimedAchievements = acc.claimedAchievements ?? [];
    acc.friends = acc.friends ?? [];
    acc.incomingRequests = acc.incomingRequests ?? [];
    acc.favoriteWorlds = acc.favoriteWorlds ?? ['START'];
    acc.recentWorlds = acc.recentWorlds ?? ['START'];
    acc.processedTxIds = acc.processedTxIds ?? [];
    acc.activeBuffs = (acc.activeBuffs ?? []).filter((b) => b.expiresAt > Date.now());
    acc.unclaimedWl = Math.max(0, Math.floor(Number(acc.unclaimedWl ?? 0)));
    if (!acc.inventory.some((s) => s.itemId === ITEM_IDS.FIST)) {
      acc.inventory.unshift({ itemId: ITEM_IDS.FIST, qty: 1 });
    }
    if (!acc.inventory.some((s) => s.itemId === ITEM_IDS.WRENCH)) {
      acc.inventory.splice(1, 0, { itemId: ITEM_IDS.WRENCH, qty: 1 });
    }
    for (const slot of acc.inventory) {
      const def = getItemDef(slot.itemId);
      if (def?.toolKind === 'rod') {
        slot.rodInstanceId = slot.rodInstanceId || crypto.randomUUID();
        const level = Number(slot.rodUpgradeLevel ?? 1);
        slot.rodUpgradeLevel = (Number.isInteger(level) && level >= 1 && level <= 3 ? level : 1) as 1 | 2 | 3;
      }
      if (def?.maxDurability && slot.maxDurability === undefined) {
        slot.maxDurability = def.maxDurability;
        slot.durability = def.maxDurability;
      }
    }
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
      xp: 0,
      level: 1,
      shirtColor: this.pickShirtColor(id),
      inventory: [
        { itemId: ITEM_IDS.FIST, qty: 1 },
        { itemId: ITEM_IDS.WRENCH, qty: 1 },
      ],
      equipped: {},
      stats: { ...DEFAULT_STATS },
      claimedAchievements: [],
      friends: [],
      incomingRequests: [],
      favoriteWorlds: ['START'],
      recentWorlds: ['START'],
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

    const accountId = `acc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const cred: CredentialRecord = {
      accountId,
      email,
      username,
      usernameLower,
      passwordHash: this.hashPassword(password),
      role: 'player',
      createdAt: Date.now(),
    };
    this.credentials.push(cred);
    this.saveCredentials();

    const account = this.createEmptyPlayerAccount(accountId, username, email, 'player');
    this.players.set(accountId, account);
    this.savePlayer(account);

    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { token, accountId, createdAt: Date.now() });
    this.saveSessions();

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
      this.savePlayer(account);
    } else {
      account.role = cred.role;
      account.email = cred.email;
      account.name = cred.username;
    }

    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { token, accountId: account.id, createdAt: Date.now() });
    this.saveSessions();

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

      const role: UserRole = email === 'puncisters@gmail.com' ? 'admin' : 'player';
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
      this.saveCredentials();
    } else if (email && cred.email !== email) {
      cred.email = email;
      if (email === 'puncisters@gmail.com') {
        cred.role = 'admin';
      }
      this.saveCredentials();
    }

    let account = this.loadPlayerById(cred.accountId);
    if (!account) {
      account = this.createEmptyPlayerAccount(cred.accountId, cred.username, cred.email, cred.role);
      this.players.set(cred.accountId, account);
      this.savePlayer(account);
    } else {
      account.role = cred.role;
      account.email = cred.email;
      account.name = cred.username;
      this.savePlayer(account);
    }

    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { token, accountId: account.id, createdAt: Date.now() });
    this.saveSessions();

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
      this.saveSessions();
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
      xp: account.xp,
      level: account.level,
      inventory: account.inventory,
      equipped: account.equipped,
      stats: account.stats,
      claimedAchievements: account.claimedAchievements,
      friends: this.getFriendEntries(account),
      incomingRequests: account.incomingRequests,
      favoriteWorlds: account.favoriteWorlds,
      recentWorlds: account.recentWorlds,
      activeBuffs: this.pruneAndGetBuffs(account),
      unclaimedWl: account.unclaimedWl ?? 0,
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

  handleAdminAction(
    account: PlayerAccount,
    live: LiveWorld | null,
    opts: {
      action: 'grant_item' | 'grant_gems' | 'grow_all_trees' | 'reset_config';
      itemId?: number;
      qty?: number;
      gems?: number;
    }
  ):
    | { ok: true; notice: string; grownTiles?: { tx: number; ty: number }[]; configReset?: boolean }
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

  savePlayer(account: PlayerAccount) {
    if (account.processedTxIds.length > 200) {
      account.processedTxIds = account.processedTxIds.slice(-200);
    }
    const filePath = path.join(PLAYERS_DIR, `${this.safeFileId(account.id)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(account), 'utf8');
  }

  private hydrateWorldDefaults(state: WorldState): WorldState {
    state.width = state.width || 100;
    state.height = state.height || 60;
    state.worldKind = state.worldKind ?? 'standard';
    state.areaLocks = state.areaLocks ?? {};
    state.vendingMachines = state.vendingMachines ?? {};
    state.furnaces = state.furnaces ?? {};
    state.bfgCollectors = state.bfgCollectors ?? {};
    state.signs = state.signs ?? {};
    ensureFluidArrays(state);
    if (state.worldLock) {
      state.worldLock.editorNames = state.worldLock.editorNames ?? {};
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
        state = this.hydrateWorldDefaults(JSON.parse(fs.readFileSync(filePath, 'utf8')) as WorldState);
      } catch {
        state = generateWorld(name);
      }
    } else {
      state = generateWorld(name);
      fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
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

  saveWorld(live: LiveWorld) {
    if (live.state.worldKind === 'mine_shaft') {
      live.dirty = false;
      return;
    }
    const filePath = path.join(WORLDS_DIR, `${live.state.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(live.state), 'utf8');
    live.dirty = false;
  }

  listWorlds(): WorldSummary[] {
    const files = fs.readdirSync(WORLDS_DIR).filter((f) => f.endsWith('.json'));
    const names = new Set<string>(['START', 'TRADE', 'FARM']);
    for (const f of files) names.add(f.replace(/\.json$/, ''));
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
        this.saveWorld(live);
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
    const enterCheck = canEnterWorld(live.state, account.id);
    if (!enterCheck.ok) {
      return { ok: false, message: enterCheck.reason ?? 'World access is restricted.' };
    }

    if (live.players.size >= MAX_WORLD_PLAYERS && !live.players.has(account.id)) {
      return {
        ok: false,
        message: `World ${v.normalized} is full (${MAX_WORLD_PLAYERS}/${MAX_WORLD_PLAYERS}).`,
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

  addInventory(account: PlayerAccount, itemId: number, qty: number): boolean {
    if (qty <= 0) return false;
    const def = getItemDef(itemId);
    if (!def) return false;
    if (def.maxDurability || def.toolKind === 'rod') {
      for (let i = 0; i < qty; i++) {
        account.inventory.push({
          itemId,
          qty: 1,
          durability: def.maxDurability,
          maxDurability: def.maxDurability,
          ...(def.toolKind === 'rod' ? { rodInstanceId: crypto.randomUUID(), rodUpgradeLevel: 1 as const } : {}),
        });
      }
      return true;
    }
    const slot = account.inventory.find((s) => s.itemId === itemId);
    if (slot) {
      slot.qty = Math.min(def.stackLimit, slot.qty + qty);
    } else {
      account.inventory.push({ itemId, qty: Math.min(def.stackLimit, qty) });
    }
    return true;
  }

  consumeInventory(account: PlayerAccount, itemId: number, qty: number): boolean {
    const def = getItemDef(itemId);
    if (def?.maxDurability && qty >= 1) {
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

  handlePunchTile(
    live: LiveWorld,
    account: PlayerAccount,
    tx: number,
    ty: number,
    toolItemId?: number
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
        notice?: string;
      } {
    const now = Date.now();
    const prevPunch = this.lastPunchAt.get(account.id) ?? 0;
    const breakSpeedBuff = this.getBuffBonusPct(account, 'break_speed');
    const baseCooldown = Math.max(50, this.gameConfig.mechanics.punchCooldownMs - 35);
    const punchCooldown = breakSpeedBuff > 0 ? Math.max(45, Math.round(baseCooldown * 0.72)) : baseCooldown;
    if (now - prevPunch < punchCooldown) {
      return { ok: false };
    }
    this.lastPunchAt.set(account.id, now);

    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false };

    const reach = this.gameConfig.mechanics.reachTiles;
    const check = canBreakTile(
      live.state,
      { id: account.id, x: playerState.x, y: playerState.y },
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
    if (toolItemId) {
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
      maxHits = growth.stage === 'mature' ? 1 : 2;
      targetDef = getEffectiveItemDef(plant.seedId, this.gameConfig);
    } else if (check.layer === 'fg') {
      targetDef = getEffectiveItemDef(live.state.fg[idx], this.gameConfig);
      maxHits = Math.max(1, targetDef?.hardness ?? 3);
    } else {
      targetDef = getEffectiveItemDef(live.state.bg[idx], this.gameConfig);
      maxHits = Math.max(1, targetDef?.hardness ?? 2);
    }

    const hitDamage =
      check.layer === 'plant' ? 1 : toolPower + (breakSpeedBuff > 0 && Math.random() < 0.3 ? 1 : 0);

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

    if (check.layer === 'plant') {
      const plant = live.state.plants[key];
      const growth = getPlantGrowthState(plant, now);
      delete live.state.plants[key];
      if (growth.stage === 'mature' && targetDef?.producesTileId) {
        account.stats.treesHarvested = (account.stats.treesHarvested ?? 0) + 1;
        for (const reward of rollTreeHarvestRewards(plant.seedId, targetDef, luckPct)) {
          spawnedDrops.push(this.createDrop(live, reward.itemId, reward.qty, tx, ty, spawnedDrops.length));
        }
        if (!isMineShaft) {
          gemsGained = 2 + Math.floor(Math.random() * 4);
        }
        xpGained += 4;
      } else {
        spawnedDrops.push(this.createDrop(live, plant.seedId, 1, tx, ty, spawnedDrops.length));
      }
    } else if (check.layer === 'fg') {
      const prevFg = live.state.fg[idx];
      live.state.fg[idx] = ITEM_IDS.AIR;
      account.stats.blocksBroken = (account.stats.blocksBroken ?? 0) + 1;

      if (
        prevFg === ITEM_IDS.COAL_VEIN ||
        prevFg === ITEM_IDS.COPPER_VEIN ||
        prevFg === ITEM_IDS.IRON_VEIN ||
        prevFg === ITEM_IDS.CRYSTAL_ORE ||
        prevFg === ITEM_IDS.OBSIDIAN_VEIN
      ) {
        account.stats.oresMined = (account.stats.oresMined ?? 0) + 1;
      }

      if (prevFg === ITEM_IDS.WORLD_LOCK) {
        live.state.worldLock = null;
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

      this.enqueueFluidNeighbors(live, tx, ty);

      if (targetDef?.drops) {
        for (const d of targetDef.drops) {
          const effChance = Math.min(1, d.chance * bonusMultiplier);
          if (Math.random() <= effChance) {
            let qty = d.minQty + Math.floor(Math.random() * (d.maxQty - d.minQty + 1));
            if (isMineShaft && pickaxeBonusChance > 0 && Math.random() < pickaxeBonusChance) {
              qty += 1;
            }
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
        Math.random() <= this.gameConfig.mechanics.globalGemDropChance
      ) {
        gemsGained = 1 + Math.floor(Math.random() * targetDef.gemValue);
      }

      // Decrement Pickaxe durability on foreground break
      if (usedPickaxeSlot && typeof usedPickaxeSlot.durability === 'number') {
        usedPickaxeSlot.durability = Math.max(0, usedPickaxeSlot.durability - 1);
        if (usedPickaxeSlot.durability === 0) {
          const pName = getItemDef(usedPickaxeSlot.itemId)?.name ?? 'Pickaxe';
          notice = `${pName} reached 0 durability! Repair it at any Stone Furnace.`;
        }
      }
    } else {
      live.state.bg[idx] = ITEM_IDS.BG_SKY;
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

    if (gemsGained > 0) {
      const slotOffset = spawnedDrops.length === 0 ? 0 : spawnedDrops.length % 2 === 1 ? -4 : 4;
      const gemDrop: WorldDrop = {
        id: `gem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId: 0,
        qty: gemsGained,
        x: tx * TILE_SIZE + TILE_SIZE * 0.5 + slotOffset,
        y: ty * TILE_SIZE + TILE_SIZE * 0.5,
        isGem: true,
      };
      spawnedDrops.push(gemDrop);
      live.drops.set(gemDrop.id, gemDrop);
    }

    const leveled = addXp(account.level, account.xp, xpGained);
    account.level = leveled.level;
    account.xp = leveled.xp;
    playerState.level = account.level;

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
      notice,
    };
  }

  private createDrop(
    live: LiveWorld,
    itemId: number,
    qty: number,
    tx: number,
    ty: number,
    slotIndex = 0
  ): WorldDrop {
    const maxStack = Math.max(1, getItemDef(itemId)?.stackLimit ?? 99);
    const originX = tx * TILE_SIZE + TILE_SIZE * 0.5;
    const originY = ty * TILE_SIZE + TILE_SIZE * 0.5;
    let remaining = Math.max(1, Math.floor(qty));
    let firstDrop: WorldDrop | undefined;
    // Merge nearby identical item drops before creating another visible stack.
    for (const existing of live.drops.values()) {
      if (existing.isGem || existing.itemId !== itemId || Math.hypot(existing.x - originX, existing.y - originY) > TILE_SIZE * 1.35) continue;
      const room = Math.max(0, maxStack - existing.qty);
      if (room <= 0) continue;
      const added = Math.min(room, remaining);
      existing.qty += added;
      remaining -= added;
      firstDrop ??= existing;
      if (remaining <= 0) return firstDrop;
    }
    const offsets = [[0, 0], [-5, -2], [5, -2], [0, 4]];
    let created = 0;
    while (remaining > 0) {
      const [ox, oy] = offsets[(slotIndex + created) % offsets.length];
      const stackQty = Math.min(maxStack, remaining);
      const drop: WorldDrop = {
        id: `drp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId,
        qty: stackQty,
        x: originX + ox + created * 2,
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
    ty: number
  ): { ok: true; layer: 'fg' | 'bg' | 'seed' | 'fluid'; notice?: string } | { ok: false; reason?: string } {
    const playerState = live.players.get(account.id);
    if (!playerState) return { ok: false };

    const slot = account.inventory.find((s) => s.itemId === itemId);
    if (!slot || slot.qty < 1) {
      return { ok: false, reason: 'Out of stock in inventory.' };
    }

    const check = canPlaceTile(
      live.state,
      { id: account.id, x: playerState.x, y: playerState.y },
      itemId,
      tx,
      ty,
      this.gameConfig.mechanics.reachTiles
    );
    if (!check.ok || !check.layer) {
      return { ok: false, reason: check.reason };
    }

    if (!this.consumeInventory(account, itemId, 1)) {
      return { ok: false, reason: 'Failed to deduct item.' };
    }

    const idx = tileIndexIn(live.state, tx, ty);
    const key = `${tx},${ty}`;
    const now = Date.now();
    let notice: string | undefined;

    if (check.layer === 'bg') {
      live.state.bg[idx] = itemId;
      account.stats.blocksPlaced = (account.stats.blocksPlaced ?? 0) + 1;
    } else if (check.layer === 'seed') {
      const def = getEffectiveItemDef(itemId, this.gameConfig);
      const mult = Math.max(0.1, this.gameConfig.mechanics.growthMultiplier || 1);
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
      account.stats.blocksPlaced = (account.stats.blocksPlaced ?? 0) + 1;
      this.enqueueFluidNeighbors(live, tx, ty);
      notice = itemId === ITEM_IDS.ACID_SOURCE ? 'Acid Vat poured!' : 'Water Source placed!';
    } else {
      live.state.fg[idx] = itemId;
      account.stats.blocksPlaced = (account.stats.blocksPlaced ?? 0) + 1;
      this.enqueueFluidNeighbors(live, tx, ty);

      if (itemId === ITEM_IDS.WORLD_LOCK) {
        live.state.worldLock = {
          x: tx,
          y: ty,
          lockItemId: itemId,
          ownerId: account.id,
          ownerName: account.name,
          editors: [],
          editorNames: {},
          publicAccess: true,
        };
        account.stats.locksPlaced = (account.stats.locksPlaced ?? 0) + 1;
        notice = 'World claimed with World Lock! Wrench the lock to manage editors.';
      } else if (itemId === ITEM_IDS.SMALL_LOCK) {
        live.state.areaLocks = live.state.areaLocks ?? {};
        live.state.areaLocks[key] = {
          x: tx,
          y: ty,
          radius: 3,
          ownerId: account.id,
          ownerName: account.name,
          editors: [],
          editorNames: {},
        };
        account.stats.locksPlaced = (account.stats.locksPlaced ?? 0) + 1;
        notice = '7×7 Area Lock placed! Wrench the lock to manage builders.';
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
        notice = 'Vending Machine placed! Use Tinker Wrench to stock items.';
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
        notice = 'Stone Furnace placed! Wrench it to smelt ores, craft gear, or repair tools.';
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
        notice = 'BFG Auto-Collector online! Wrench it to collect harvested drops & Gems.';
      } else if (itemId === ITEM_IDS.EXCHANGE_TERMINAL) {
        notice = 'Exchange Terminal placed! Wrench it to open the World-Lock Global Exchange.';
      } else if (getItemDef(itemId)?.key.includes('sign')) {
        live.state.signs = live.state.signs ?? {};
        live.state.signs[key] = `Sign by ${account.name}`;
        notice = 'Signboard placed! Use Tinker Wrench to edit inscription.';
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
  ): { ok: true; drop: WorldDrop } | { ok: false } {
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

    live.drops.delete(dropId);
    if (drop.isGem) {
      account.gems += drop.qty;
    } else {
      this.addInventory(account, drop.itemId, drop.qty);
    }
    this.savePlayer(account);
    return { ok: true, drop };
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
    opts: { publicAccess?: boolean; addEditorName?: string; removeEditorId?: string }
  ):
    | { ok: true; worldLock?: WorldLockRecord | null; areaLock?: AreaLockRecord | null; notice: string }
    | { ok: false; message: string } {
    const key = `${tx},${ty}`;
    const wl = live.state.worldLock;
    const al = live.state.areaLocks?.[key];

    if (wl && wl.x === tx && wl.y === ty) {
      if (wl.ownerId !== account.id) {
        return { ok: false, message: 'Only the World Lock owner can change permissions.' };
      }
      wl.editorNames = wl.editorNames ?? {};
      if (typeof opts.publicAccess === 'boolean') {
        wl.publicAccess = opts.publicAccess;
      }
      if (opts.addEditorName) {
        const target = this.findPlayerByNameOrId(opts.addEditorName);
        const targetId = target ? target.id : opts.addEditorName.trim();
        const targetName = target ? target.name : opts.addEditorName.trim();
        if (targetId && targetId !== account.id && !wl.editors.includes(targetId)) {
          wl.editors.push(targetId);
          wl.editorNames[targetId] = targetName;
        }
      }
      if (opts.removeEditorId) {
        wl.editors = wl.editors.filter((id) => id !== opts.removeEditorId);
        delete wl.editorNames[opts.removeEditorId];
      }
      live.state.revision += 1;
      this.saveWorld(live);
      return { ok: true, worldLock: wl, notice: 'World Lock permissions updated.' };
    }

    if (al) {
      if (al.ownerId !== account.id) {
        return { ok: false, message: 'Only the Area Lock owner can change permissions.' };
      }
      al.editorNames = al.editorNames ?? {};
      if (opts.addEditorName) {
        const target = this.findPlayerByNameOrId(opts.addEditorName);
        const targetId = target ? target.id : opts.addEditorName.trim();
        const targetName = target ? target.name : opts.addEditorName.trim();
        if (targetId && targetId !== account.id && !al.editors.includes(targetId)) {
          al.editors.push(targetId);
          al.editorNames[targetId] = targetName;
        }
      }
      if (opts.removeEditorId) {
        al.editors = al.editors.filter((id) => id !== opts.removeEditorId);
        delete al.editorNames[opts.removeEditorId];
      }
      live.state.revision += 1;
      this.saveWorld(live);
      return { ok: true, areaLock: al, notice: 'Area Lock permissions updated.' };
    }

    return { ok: false, message: 'No configurable lock found at that tile.' };
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
    if (vm.ownerId !== account.id) {
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
    const priceItemId = Number(opts.priceItemId ?? ITEM_IDS.SMALL_LOCK);
    const priceQty = Math.max(1, Math.floor(Number(opts.priceQty ?? 1)));

    const itemDef = getItemDef(itemId);
    const priceDef = getItemDef(priceItemId);
    if (!itemDef || !itemDef.tradeable) {
      return { ok: false, message: 'Selected item cannot be sold in a Vending Machine.' };
    }
    if (!priceDef || !priceDef.tradeable) {
      return { ok: false, message: 'Invalid payment item.' };
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
    if (!hasEditPermission(live.state, account.id, tx, ty)) {
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
    if (!hasEditPermission(live.state, account.id, tx, ty)) {
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
      live.state.revision += 1;
      this.saveWorld(live);
      this.savePlayer(account);
      return {
        ok: true,
        furnace,
        notice: `Collected ${qty}× ${outDef?.name ?? 'Crafted Item'}!`,
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
    if (bfg.ownerId !== account.id && live.state.worldLock?.ownerId !== account.id) {
      return { ok: false, message: 'Only the BFG owner or World Lock owner can access this unit.' };
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
      cast.fishResistance = getFishPullResistance(cast.fishItemId, this.gameConfig.fishing);
    }

    const resistance = cast.fishResistance ?? getFishPullResistance(cast.fishItemId, this.gameConfig.fishing);
    cast.pullProgress = Math.min(100, cast.pullProgress + 24 * cast.pullingStrength / resistance);
    if (cast.pullProgress < 100) {
      return {
        ok: true,
        caught: false,
        finished: false,
        progress: Math.round(cast.pullProgress),
        notice: `The ${getItemDef(cast.fishItemId)?.name ?? 'fish'} is fighting back! Keep reeling.`,
      };
    }

    live.activeCasts.delete(account.id);
    if (typeof rodSlot.durability === 'number') {
      rodSlot.durability = Math.max(0, rodSlot.durability - 1);
    }
    const caughtItemId = cast.fishItemId;
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
    completedFurnaces: Array<{ worldName: string; tx: number; ty: number }>;
    expiredMines: Array<{ worldName: string; playerIds: string[] }>;
  } {
    const fluidUpdates: Array<{ worldName: string; deltas: FluidDelta[] }> = [];
    const fishingBites: Array<{ worldName: string; cast: ServerFishingCast }> = [];
    const fishingTimeouts: Array<{ worldName: string; playerId: string }> = [];
    const completedFurnaces: Array<{ worldName: string; tx: number; ty: number }> = [];
    const expiredMines: Array<{ worldName: string; playerIds: string[] }> = [];

    for (const [wName, live] of this.worlds.entries()) {
      if (live.state.worldKind === 'mine_shaft' && live.state.expiresAt && now >= live.state.expiresAt) {
        expiredMines.push({ worldName: wName, playerIds: Array.from(live.players.keys()) });
        this.worlds.delete(wName);
        continue;
      }

      if (live.players.size === 0) continue;

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
        } else if (cast.biting && cast.pullProgress > 0) {
          // Fish steadily regain line while the player is not actively reeling.
          cast.pullProgress = Math.max(0, cast.pullProgress - 1.5);
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
    }

    return { fluidUpdates, fishingBites, fishingTimeouts, completedFurnaces, expiredMines };
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

        // 1. Harvest mature trees within 3-tile radius
        for (const [key, plant] of Object.entries(live.state.plants)) {
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
