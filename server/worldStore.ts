import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ACHIEVEMENTS,
  GEM_STORE_LISTINGS,
  getItemDef,
  ITEM_IDS,
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
  addXp,
  canBreakTile,
  canEnterWorld,
  canPlaceTile,
  getPlantGrowthState,
  hasEditPermission,
  resolveSplice,
  tileIndex,
  validateWorldName,
} from '../src/game/rules.ts';
import {
  generateWorld,
  type AreaLockRecord,
  type VendingMachineRecord,
  type WorldLockRecord,
  type WorldState,
} from '../src/game/worldGen.ts';
import type {
  AuthUserProfile,
  ChatMessage,
  FriendEntry,
  FriendRequestEntry,
  InventorySlot,
  RemotePlayerState,
  UserRole,
  WorldDrop,
  WorldSummary,
} from '../src/game/network.ts';
import type { EquippedWearables } from '../src/game/pixelArt.ts';

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
  layer: 'fg' | 'bg' | 'plant';
}

export interface LiveWorld {
  state: WorldState;
  players: Map<string, RemotePlayerState>;
  drops: Map<string, WorldDrop>;
  damage: Map<string, TileDamageState>;
  chatHistory: ChatMessage[];
  dirty: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WORLDS_DIR = path.join(DATA_DIR, 'worlds');
const PLAYERS_DIR = path.join(DATA_DIR, 'players');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'game-config.json');

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
};

export class AuthoritativeWorldStore {
  private worlds = new Map<string, LiveWorld>();
  private players = new Map<string, PlayerAccount>();
  private credentials: CredentialRecord[] = [];
  private sessions = new Map<string, SessionRecord>();
  private gameConfig: GameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);
  private lastPunchAt = new Map<string, number>();
  private lastChatAt = new Map<string, number>();

  constructor() {
    fs.mkdirSync(WORLDS_DIR, { recursive: true });
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });
    this.loadCredentials();
    this.loadSessions();
    this.loadGameConfig();
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
    if (!acc.inventory.some((s) => s.itemId === ITEM_IDS.FIST)) {
      acc.inventory.unshift({ itemId: ITEM_IDS.FIST, qty: 1 });
    }
    if (!acc.inventory.some((s) => s.itemId === ITEM_IDS.WRENCH)) {
      acc.inventory.splice(1, 0, { itemId: ITEM_IDS.WRENCH, qty: 1 });
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

  loginOrCreateFirebaseAccount(input: {
    uid: string;
    email: string;
    displayName?: string;
    emailVerified?: boolean;
  }): { ok: true; token: string; account: PlayerAccount } | { ok: false; message: string } {
    const uid = this.safeFileId(input.uid || '');
    const email = (input.email ?? '').trim().toLowerCase();
    if (!uid || !email) {
      return { ok: false, message: 'Firebase account must include a verified UID and email.' };
    }

    const isVerifiedAdminEmail = email === 'puncisters@gmail.com' && Boolean(input.emailVerified);
    let cred = this.credentials.find((c) => c.email === email || c.accountId === `fb_${uid}`);

    if (!cred) {
      const accountId = isVerifiedAdminEmail ? 'admin_gamedev' : `fb_${uid}`;
      const baseName = (input.displayName || email.split('@')[0] || 'Explorer')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 12) || 'Explorer';
      let candidate = baseName.length >= 2 ? baseName : `Player_${uid.slice(0, 4)}`;
      let suffix = 1;
      while (this.credentials.some((c) => c.usernameLower === candidate.toLowerCase())) {
        candidate = `${baseName.slice(0, 11)}_${suffix++}`;
      }
      cred = {
        accountId,
        email,
        username: candidate,
        usernameLower: candidate.toLowerCase(),
        passwordHash: this.hashPassword(crypto.randomBytes(24).toString('hex')),
        role: isVerifiedAdminEmail ? 'admin' : 'player',
        createdAt: Date.now(),
      };
      this.credentials.push(cred);
      this.saveCredentials();
    } else if (isVerifiedAdminEmail && cred.role !== 'admin') {
      cred.role = 'admin';
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
    state.areaLocks = state.areaLocks ?? {};
    state.vendingMachines = state.vendingMachines ?? {};
    state.signs = state.signs ?? {};
    if (state.worldLock) {
      state.worldLock.editorNames = state.worldLock.editorNames ?? {};
    }
    return state;
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
    const filePath = path.join(WORLDS_DIR, `${live.state.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(live.state), 'utf8');
    live.dirty = false;
  }

  listWorlds(): WorldSummary[] {
    const files = fs.readdirSync(WORLDS_DIR).filter((f) => f.endsWith('.json'));
    const names = new Set<string>(['START', 'TRADE', 'FARM']);
    for (const f of files) names.add(f.replace(/\.json$/, ''));
    for (const k of this.worlds.keys()) names.add(k);

    const summaries: WorldSummary[] = [];
    for (const name of names) {
      const live = this.getOrCreateWorld(name);
      summaries.push({
        name: live.state.name,
        playerCount: live.players.size,
        ownerName: live.state.worldLock?.ownerName ?? null,
        publicAccess: live.state.worldLock ? live.state.worldLock.publicAccess : true,
      });
    }
    return summaries.sort((a, b) => b.playerCount - a.playerCount || a.name.localeCompare(b.name));
  }

  joinWorld(
    account: PlayerAccount,
    rawWorldName: string
  ): { ok: true; world: LiveWorld; remote: RemotePlayerState } | { ok: false; message: string } {
    const v = validateWorldName(rawWorldName);
    if (!v.ok) return { ok: false, message: v.reason ?? 'Invalid world name.' };

    const live = this.getOrCreateWorld(v.normalized);
    const enterCheck = canEnterWorld(live.state, account.id);
    if (!enterCheck.ok) {
      return { ok: false, message: enterCheck.reason ?? 'World access is restricted.' };
    }

    if (live.players.size >= MAX_WORLD_PLAYERS && !live.players.has(account.id)) {
      return { ok: false, message: `World ${v.normalized} is full (${MAX_WORLD_PLAYERS}/${MAX_WORLD_PLAYERS}).` };
    }

    // Track recent worlds
    account.recentWorlds = [
      live.state.name,
      ...account.recentWorlds.filter((w) => w !== live.state.name),
    ].slice(0, 8);
    this.savePlayer(account);

    const remote: RemotePlayerState = {
      id: account.id,
      name: account.name,
      x: live.state.spawnX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5,
      y: (live.state.spawnY + 1) * TILE_SIZE - PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      punching: false,
      shirtColor: account.shirtColor,
      level: account.level,
      equipped: account.equipped,
      role: account.role,
    };
    live.players.set(account.id, remote);
    return { ok: true, world: live, remote };
  }

  leaveWorld(worldName: string, playerId: string) {
    const live = this.worlds.get(worldName);
    if (!live) return;
    live.players.delete(playerId);
    if (live.dirty) {
      this.saveWorld(live);
    }
  }

  addInventory(account: PlayerAccount, itemId: number, qty: number): boolean {
    if (qty <= 0) return false;
    const def = getItemDef(itemId);
    if (!def) return false;
    const slot = account.inventory.find((s) => s.itemId === itemId);
    if (slot) {
      slot.qty = Math.min(def.stackLimit, slot.qty + qty);
    } else {
      account.inventory.push({ itemId, qty: Math.min(def.stackLimit, qty) });
    }
    return true;
  }

  consumeInventory(account: PlayerAccount, itemId: number, qty: number): boolean {
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
    ty: number
  ):
    | { ok: false; reason?: string }
    | {
        ok: true;
        broken: boolean;
        layer: 'fg' | 'bg' | 'plant';
        hits: number;
        maxHits: number;
        drops: WorldDrop[];
        xpGained: number;
        gemsGained: number;
      } {
    const now = Date.now();
    const prevPunch = this.lastPunchAt.get(account.id) ?? 0;
    const punchCooldown = Math.max(50, this.gameConfig.mechanics.punchCooldownMs - 35);
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
    const idx = tileIndex(tx, ty);

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

    const existing = live.damage.get(key);
    const hits =
      existing && existing.layer === check.layer && now - existing.lastHitAt < 4000
        ? existing.hits + 1
        : 1;

    if (hits < maxHits) {
      live.damage.set(key, { hits, lastHitAt: now, layer: check.layer });
      return {
        ok: true,
        broken: false,
        layer: check.layer,
        hits,
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

    if (check.layer === 'plant') {
      const plant = live.state.plants[key];
      const growth = getPlantGrowthState(plant, now);
      delete live.state.plants[key];
      if (growth.stage === 'mature' && targetDef?.producesTileId) {
        account.stats.treesHarvested = (account.stats.treesHarvested ?? 0) + 1;
        const harvestYield = targetDef?.treeHarvestYield ?? { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 };
        const yieldQty = harvestYield.minBlocks + Math.floor(Math.random() * (harvestYield.maxBlocks - harvestYield.minBlocks + 1));
        spawnedDrops.push(
          this.createDrop(live, targetDef.producesTileId, yieldQty, tx, ty, spawnedDrops.length)
        );
        if (Math.random() < harvestYield.seedChance) {
          spawnedDrops.push(
            this.createDrop(live, plant.seedId, 1, tx, ty, spawnedDrops.length)
          );
        }
        if (targetDef?.bonusHarvestDrops) {
          for (const bonus of targetDef.bonusHarvestDrops) {
            if (Math.random() <= bonus.chance) {
              const qty = bonus.minQty + Math.floor(Math.random() * (bonus.maxQty - bonus.minQty + 1));
              if (qty > 0) spawnedDrops.push(this.createDrop(live, bonus.itemId, qty, tx, ty, spawnedDrops.length));
            }
          }
        }
        gemsGained = 2 + Math.floor(Math.random() * 4);
        xpGained += 4;
      } else {
        spawnedDrops.push(this.createDrop(live, plant.seedId, 1, tx, ty, spawnedDrops.length));
      }
    } else if (check.layer === 'fg') {
      const prevFg = live.state.fg[idx];
      live.state.fg[idx] = ITEM_IDS.AIR;
      account.stats.blocksBroken = (account.stats.blocksBroken ?? 0) + 1;

      if (prevFg === ITEM_IDS.WORLD_LOCK) {
        live.state.worldLock = null;
      }
      if (prevFg === ITEM_IDS.SMALL_LOCK && live.state.areaLocks) {
        delete live.state.areaLocks[key];
      }
      if (prevFg === ITEM_IDS.VENDING_MACHINE && live.state.vendingMachines) {
        delete live.state.vendingMachines[key];
      }
      if (prevFg === ITEM_IDS.SIGN_POST && live.state.signs) {
        delete live.state.signs[key];
      }

      if (targetDef?.drops) {
        for (const d of targetDef.drops) {
          if (Math.random() <= d.chance) {
            const qty = d.minQty + Math.floor(Math.random() * (d.maxQty - d.minQty + 1));
            if (qty > 0) {
              spawnedDrops.push(this.createDrop(live, d.itemId, qty, tx, ty, spawnedDrops.length));
            }
          }
        }
      }
      if (
        targetDef &&
        targetDef.gemValue > 0 &&
        Math.random() <= this.gameConfig.mechanics.globalGemDropChance
      ) {
        gemsGained = 1 + Math.floor(Math.random() * targetDef.gemValue);
      }
    } else {
      live.state.bg[idx] = ITEM_IDS.BG_SKY;
      account.stats.blocksBroken = (account.stats.blocksBroken ?? 0) + 1;
      if (targetDef?.drops) {
        for (const d of targetDef.drops) {
          if (Math.random() <= d.chance) {
            const qty = d.minQty + Math.floor(Math.random() * (d.maxQty - d.minQty + 1));
            if (qty > 0) {
              spawnedDrops.push(this.createDrop(live, d.itemId, qty, tx, ty, spawnedDrops.length));
            }
          }
        }
      }
      if (
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
        x: tx * TILE_SIZE + 16 + slotOffset,
        y: ty * TILE_SIZE + 16,
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
    // Drops spawn centered where they originate and float in place
    const offsets = [
      [0, 0],
      [-5, -2],
      [5, -2],
      [0, 4],
    ];
    const [ox, oy] = offsets[slotIndex % offsets.length];
    const drop: WorldDrop = {
      id: `drp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemId,
      qty,
      x: tx * TILE_SIZE + 16 + ox,
      y: ty * TILE_SIZE + 16 + oy,
    };
    live.drops.set(drop.id, drop);
    return drop;
  }

  handlePlaceTile(
    live: LiveWorld,
    account: PlayerAccount,
    itemId: number,
    tx: number,
    ty: number
  ): { ok: true; layer: 'fg' | 'bg' | 'seed'; notice?: string } | { ok: false; reason?: string } {
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

    const idx = tileIndex(tx, ty);
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
    } else {
      live.state.fg[idx] = itemId;
      account.stats.blocksPlaced = (account.stats.blocksPlaced ?? 0) + 1;

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
      } else if (itemId === ITEM_IDS.SIGN_POST) {
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
    const listing = GEM_STORE_LISTINGS.find((l) => l.id === listingId);
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
    const idx = tileIndex(tx, ty);
    if (live.state.fg[idx] !== ITEM_IDS.SIGN_POST) {
      return { ok: false, message: 'No Signboard at that location.' };
    }
    const cleanText = rawText.trim().slice(0, 80) || 'Empty Sign';
    live.state.signs = live.state.signs ?? {};
    live.state.signs[`${tx},${ty}`] = cleanText;
    live.state.revision += 1;
    this.saveWorld(live);
    return { ok: true, text: cleanText, notice: 'Signboard inscription updated.' };
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
