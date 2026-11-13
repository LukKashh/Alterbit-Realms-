import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GATE_KEYS } from '../src/game/expansion.ts';
import { ITEM_IDS } from '../src/game/catalog.ts';
import { addXp } from '../src/game/rules.ts';
import {
  createDungeonMap,
  DEFAULT_DUNGEON_BALANCE,
  DUNGEON_HEIGHT,
  DUNGEON_WIDTH,
  getDungeonEnemyStats,
  getDungeonOreReward,
  isDungeonWalkable,
  isDungeonPositionWalkable,
  type DungeonAction,
  type DungeonPartyMode,
  type DungeonEnemyState,
  type DungeonPhase,
  type DungeonPlayerState,
  type DungeonReward,
  type DungeonSnapshot,
} from '../src/game/dungeon.ts';
import type { PlayerAccount, AuthoritativeWorldStore } from './worldStore.ts';

const GATE_KEY_ITEM_IDS = [ITEM_IDS.GATE_KEY_I, ITEM_IDS.GATE_KEY_II, ITEM_IDS.GATE_KEY_III, ITEM_IDS.GATE_KEY_IV, ITEM_IDS.GATE_KEY_V] as const;
const MAX_RUN_AGE_MS = DEFAULT_DUNGEON_BALANCE.maxRunAgeMs;
const DISCONNECT_GRACE_MS = DEFAULT_DUNGEON_BALANCE.disconnectGraceMs;

interface DungeonRun {
  runId: string;
  code: string;
  tier: number;
  partyMode: DungeonPartyMode;
  roomIndex: number;
  seed: number;
  map: string[];
  phase: DungeonPhase;
  message: string;
  players: Record<string, DungeonPlayerState & { lastSeenAt: number; lastActionAt: number }>;
  enemies: DungeonEnemyState[];
  lastTickAt: number;
  lastBroadcastAt: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface DungeonActionResult {
  ok: boolean;
  message?: string;
  snapshot?: DungeonSnapshot;
  rewards?: DungeonReward[];
  affectedPlayerIds?: string[];
}

export class DungeonStore {
  private readonly runs = new Map<string, DungeonRun>();
  private readonly accountRefs = new Map<string, PlayerAccount>();
  private readonly filePath = path.resolve(process.cwd(), 'data', 'dungeons.json');

  constructor(private readonly playerStore: AuthoritativeWorldStore) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as DungeonRun[];
      if (!Array.isArray(parsed)) return;
      const now = Date.now();
      for (const run of parsed) {
        if (!run?.runId || !run.code || !Array.isArray(run.map) || !run.players) continue;
        if (now - (run.updatedAt || run.createdAt || now) > MAX_RUN_AGE_MS) continue;
        for (const player of Object.values(run.players)) {
          player.connected = false;
          player.facingX = Number.isFinite(player.facingX) ? player.facingX : 1;
          player.facingY = Number.isFinite(player.facingY) ? player.facingY : 0;
        }
        this.runs.set(run.runId, run);
      }
    } catch (error) {
      console.error('Could not load dungeon runs:', error);
    }
  }

  private persist() {
    const runs = [...this.runs.values()].filter((run) => run.phase === 'active' || run.phase === 'cleared');
    const tempPath = this.filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(runs), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  private keyItemId(tier: number) {
    return GATE_KEY_ITEM_IDS[tier - 1];
  }

  getAccountRef(playerId: string): PlayerAccount | undefined {
    const cached = this.accountRefs.get(playerId);
    if (cached) return cached;
    const run = [...this.runs.values()].find((entry) => entry.players[playerId]);
    const player = run?.players[playerId];
    if (!player) return undefined;
    const account = this.playerStore.getOrCreatePlayer(playerId, player.name);
    this.accountRefs.set(playerId, account);
    return account;
  }

  buyGateKey(account: PlayerAccount, tier: number, payment: 'gems' | 'world_locks', txId: string): DungeonActionResult {
    const key = GATE_KEYS.find((entry) => entry.tier === tier);
    const itemId = this.keyItemId(tier);
    this.accountRefs.set(account.id, account);
    if (!key || !itemId) return { ok: false, message: 'Unknown Gate Key tier.' };
    if (account.level < key.minLevel) return { ok: false, message: 'Explorer level ' + key.minLevel + ' is required.' };
    const requestId = String(txId ?? '').trim();
    if (!requestId || requestId.length > 100) return { ok: false, message: 'A valid purchase request ID is required.' };
    if (account.processedTxIds.includes(requestId)) {
      return { ok: true, message: 'This Gate Key purchase was already processed.' };
    }
    const locks = account.inventory.find((slot) => slot.itemId === ITEM_IDS.WORLD_LOCK)?.qty ?? 0;
    if (payment === 'gems' && account.gems < key.gemPrice) {
      return { ok: false, message: 'Requires ' + key.gemPrice + ' Gems.' };
    }
    if (payment === 'world_locks' && locks < key.worldLockPrice) {
      return { ok: false, message: 'Requires ' + key.worldLockPrice + ' World Lock(s).' };
    }
    if (payment !== 'gems' && payment !== 'world_locks') {
      return { ok: false, message: 'Choose Gems or World Locks as the payment method.' };
    }
    if (!this.playerStore.addInventory(account, itemId, 1)) {
      return { ok: false, message: 'Could not add the Gate Key to your inventory.' };
    }
    if (payment === 'gems') {
      account.gems -= key.gemPrice;
    } else if (!this.playerStore.consumeInventory(account, ITEM_IDS.WORLD_LOCK, key.worldLockPrice)) {
      this.playerStore.consumeInventory(account, itemId, 1);
      return { ok: false, message: 'Could not consume the selected World Locks.' };
    }
    account.processedTxIds.push(requestId);
    if (account.processedTxIds.length > 500) account.processedTxIds = account.processedTxIds.slice(-500);
    this.playerStore.savePlayer(account);
    return { ok: true, message: 'Purchased ' + key.id.replace(/_/g, ' ').toUpperCase() + ' using ' + (payment === 'gems' ? 'Gems' : 'World Locks') + '.' };
  }

  createRun(account: PlayerAccount, tier: number, partyMode: DungeonPartyMode, now = Date.now()): DungeonActionResult {
    const key = GATE_KEYS.find((entry) => entry.tier === tier);
    const keyItemId = this.keyItemId(tier);
    this.accountRefs.set(account.id, account);
    if (!key || !keyItemId) return { ok: false, message: 'Unknown Gate Key tier.' };
    if (account.level < key.minLevel) return { ok: false, message: 'Explorer level ' + key.minLevel + ' is required.' };
    if (this.findRun(account.id)) return { ok: false, message: 'You are already assigned to an active dungeon party.' };
    if (partyMode !== 'solo' && partyMode !== 'cooperative') return { ok: false, message: 'Choose Solo or Cooperative mode.' };
    const keySlot = account.inventory.find((slot) => slot.itemId === keyItemId && slot.qty > 0);
    if (!keySlot || !this.playerStore.consumeInventory(account, keyItemId, 1)) {
      return { ok: false, message: 'You need a ' + key.id.replace(/_/g, ' ') + ' to open this dungeon.' };
    }

    const seed = crypto.randomBytes(4).readUInt32BE(0);
    const runId = crypto.randomUUID();
    const code = this.makeCode();
    const map = createDungeonMap(tier, 0, seed);
    const player: DungeonPlayerState & { lastSeenAt: number; lastActionAt: number } = {
      id: account.id, name: account.name, x: 1.5, y: 5.5, hp: DEFAULT_DUNGEON_BALANCE.playerMaxHealth, maxHp: DEFAULT_DUNGEON_BALANCE.playerMaxHealth,
      connected: true, facingX: 1, facingY: 0, lastSeenAt: now, lastActionAt: 0,
    };
    const run: DungeonRun = {
      runId, code, tier, partyMode, roomIndex: 0, seed, map, phase: 'active',
      message: 'Dungeon opened. Clear the room to unlock the next gate.',
      players: { [account.id]: player },
      enemies: this.createEnemies(tier, 0, key.rooms, seed, now),
      lastTickAt: now, lastBroadcastAt: now, createdAt: now, updatedAt: now,
    };
    this.runs.set(runId, run);
    try {
      this.playerStore.savePlayer(account);
      this.persist();
    } catch (error) {
      this.runs.delete(runId);
      this.playerStore.addInventory(account, keyItemId, 1);
      try { this.playerStore.savePlayer(account); this.persist(); } catch (rollbackError) {
        console.error('Dungeon entry rollback failed:', rollbackError);
      }
      console.error('Dungeon instance creation failed:', error);
      return { ok: false, message: 'Dungeon creation failed. Your Gate Key has been returned.' };
    }
    return { ok: true, message: 'Dungeon party created. Share code ' + code + '.', snapshot: this.snapshot(run) };
  }

  joinRun(account: PlayerAccount, rawCode: string, now = Date.now()): DungeonActionResult {
    this.accountRefs.set(account.id, account);
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return { ok: false, message: 'Enter a valid six-character party code.' };
    const run = [...this.runs.values()].find((entry) => entry.code === code);
    if (!run || run.phase !== 'active' && run.phase !== 'cleared') return { ok: false, message: 'That dungeon party is no longer available.' };
    if (run.partyMode !== 'cooperative') return { ok: false, message: 'This expedition was created as a solo run.' };
    const currentRun = this.findRun(account.id);
    if (currentRun && currentRun.runId !== run.runId) return { ok: false, message: 'Leave your current dungeon party before joining another.' };
    if (run.players[account.id]) {
      run.players[account.id].connected = true;
      run.players[account.id].lastSeenAt = now;
      return { ok: true, snapshot: this.snapshot(run) };
    }
    if (Object.keys(run.players).length >= DEFAULT_DUNGEON_BALANCE.cooperativePartyLimit) return { ok: false, message: 'This dungeon party is full.' };
    run.players[account.id] = {
      id: account.id, name: account.name, x: 1.5, y: 5.5, hp: DEFAULT_DUNGEON_BALANCE.playerMaxHealth, maxHp: DEFAULT_DUNGEON_BALANCE.playerMaxHealth,
      connected: true, facingX: 1, facingY: 0, lastSeenAt: now, lastActionAt: 0,
    };
    run.message = account.name + ' joined the expedition.';
    run.updatedAt = now;
    this.persist();
    return { ok: true, snapshot: this.snapshot(run) };
  }

  resume(account: PlayerAccount, now = Date.now()): DungeonActionResult {
    this.accountRefs.set(account.id, account);
    const run = [...this.runs.values()].find((entry) => entry.players[account.id] && (entry.phase === 'active' || entry.phase === 'cleared'));
    if (!run) return { ok: false, message: 'No active dungeon expedition to resume.' };
    const player = run.players[account.id];
    player.connected = true;
    player.lastSeenAt = now;
    run.updatedAt = now;
    this.persist();
    return { ok: true, snapshot: this.snapshot(run) };
  }

  disconnect(playerId: string, now = Date.now()) {
    for (const run of this.runs.values()) {
      const player = run.players[playerId];
      if (player && (run.phase === 'active' || run.phase === 'cleared')) {
        player.connected = false;
        player.lastSeenAt = now;
        run.updatedAt = now;
      }
    }
    this.persist();
  }

  private makeCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = Array.from(crypto.randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join('');
    } while ([...this.runs.values()].some((run) => run.code === code && run.phase === 'active'));
    return code;
  }

  private createEnemies(tier: number, roomIndex: number, roomCount: number, seed: number, now: number): DungeonEnemyState[] {
    let state = (seed + tier * 7919 + roomIndex * 104729) >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const isBossRoom = roomIndex === roomCount - 1;
    const count = isBossRoom ? 1 : DEFAULT_DUNGEON_BALANCE.enemyCountBase + Math.min(DEFAULT_DUNGEON_BALANCE.enemyCountBonusCap, tier * DEFAULT_DUNGEON_BALANCE.enemyCountTierBonus);
    const enemies: DungeonEnemyState[] = [];
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      let x = 8, y = 2;
      for (let attempt = 0; attempt < 80; attempt++) {
        x = 7 + Math.floor(random() * 8);
        y = 1 + Math.floor(random() * 9);
        const key = x + ',' + y;
        if (runTileWalkable(createDungeonMap(tier, roomIndex, seed), x, y) && !used.has(key) && !(x === 15 && y === 5)) {
          used.add(key);
          break;
        }
      }
      const enemyStats = getDungeonEnemyStats(tier, isBossRoom);
      enemies.push({
        id: 'enemy_' + roomIndex + '_' + i + '_' + Math.floor(random() * 1e8),
        name: isBossRoom ? enemyStats.name : (tier === 1 && i % 2 === 1 ? 'Station Drone' : enemyStats.name),
        kind: isBossRoom ? 'boss' : (tier === 1 && i % 2 === 1 ? 'drone' : 'dweller'),
        x: x + 0.5, y: y + 0.5,
        hp: enemyStats.hp, maxHp: enemyStats.hp, damage: enemyStats.damage,
        boss: isBossRoom, nextAttackAt: now + DEFAULT_DUNGEON_BALANCE.enemyAttackCooldownMs, nextMoveAt: now + DEFAULT_DUNGEON_BALANCE.enemyMoveCooldownMs,
      });
    }
    return enemies;
  }

  private findRun(playerId: string) {
    return [...this.runs.values()].find((run) => run.players[playerId] && (run.phase === 'active' || run.phase === 'cleared')) ?? null;
  }

  act(account: PlayerAccount, action: DungeonAction, dx = 0, dy = 0, now = Date.now()): DungeonActionResult {
    const run = this.findRun(account.id);
    if (!run) return { ok: false, message: 'You are not in an active dungeon.' };
    const player = run.players[account.id];
    if (!player.connected) player.connected = true;
    player.lastSeenAt = now;
    if (action === 'leave') {
      delete run.players[account.id];
      this.accountRefs.delete(account.id);
      run.message = account.name + ' left the expedition.';
      run.updatedAt = now;
      const ids = Object.keys(run.players);
      if (ids.length === 0) this.runs.delete(run.runId);
      this.persist();
      return { ok: true, snapshot: ids.length ? this.snapshot(run) : undefined, affectedPlayerIds: ids };
    }
    if (run.phase === 'cleared' && action !== 'next_room') {
      return { ok: true, snapshot: this.snapshot(run) };
    }
    if (run.phase !== 'active' && run.phase !== 'cleared') return { ok: false, message: 'This dungeon has ended.' };
    if (player.hp <= 0) return { ok: false, message: 'You are down and cannot act.' };
    if (now - player.lastActionAt < (action === 'move' ? DEFAULT_DUNGEON_BALANCE.playerMoveCooldownMs : DEFAULT_DUNGEON_BALANCE.playerAttackCooldownMs)) return { ok: false, message: 'Wait for your action cooldown.' };
    player.lastActionAt = now;

    if (action === 'move') {
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 0.01) return { ok: false, message: 'Movement input is empty.' };
      const magnitude = Math.hypot(dx, dy);
      const directionX = dx / magnitude;
      const directionY = dy / magnitude;
      const speed = DEFAULT_DUNGEON_BALANCE.playerMoveStep;
      const nx = Math.max(1.22, Math.min(DUNGEON_WIDTH - 1.22, player.x + directionX * speed));
      const ny = Math.max(1.22, Math.min(DUNGEON_HEIGHT - 1.22, player.y + directionY * speed));
      if (!isDungeonPositionWalkable(run.map, nx, ny) ||
          Object.values(run.players).some((other) => other.id !== player.id && other.hp > 0 && Math.hypot(other.x - nx, other.y - ny) < 0.48) ||
          run.enemies.some((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - nx, enemy.y - ny) < 0.5)) {
        return { ok: false, message: 'Blocked.' };
      }
      player.x = nx;
      player.y = ny;
      player.facingX = directionX;
      player.facingY = directionY;
    } else if (action === 'attack') {
      const target = run.enemies
        .filter((enemy) => {
          if (enemy.hp <= 0) return false;
          const vx = enemy.x - player.x;
          const vy = enemy.y - player.y;
          const distance = Math.hypot(vx, vy);
          if (distance > DEFAULT_DUNGEON_BALANCE.playerAttackRange) return false;
          if (distance < 0.001) return true;
          const facingDot = (vx / distance) * player.facingX + (vy / distance) * player.facingY;
          return facingDot >= 0.35;
        })
        .sort((a, b) => Number(b.boss) - Number(a.boss))[0];
      if (!target) return { ok: false, message: 'Move next to an enemy to attack.' };
      const damage = DEFAULT_DUNGEON_BALANCE.playerBaseDamage + Math.floor(account.level * DEFAULT_DUNGEON_BALANCE.playerDamagePerLevel);
      target.hp = Math.max(0, target.hp - damage);
      run.message = account.name + ' dealt ' + damage + ' damage to ' + target.name + '.';
      if (target.hp <= 0) run.message = target.name + ' was defeated.';
      if (run.enemies.every((enemy) => enemy.hp <= 0)) {
        run.phase = 'cleared';
        run.message = run.roomIndex === GATE_KEYS[run.tier - 1].rooms - 1
          ? 'The Gate Guardian is defeated. Expedition cleared!'
          : 'Room cleared. The exit gate is unlocked.';
      }
    } else if (action === 'next_room' || action === 'extract') {
      if (run.phase !== 'cleared') return { ok: false, message: 'Defeat every enemy before using the exit.' };
      const exitX = DUNGEON_WIDTH - 2;
      const atExit = Math.hypot(player.x - (exitX + 0.5), player.y - 5.5) <= 0.85;
      if (!atExit) return { ok: false, message: 'Reach the unlocked extraction gate at the far right of the room.' };
      const roomCount = GATE_KEYS[run.tier - 1].rooms;
      const isFinalRoom = run.roomIndex >= roomCount - 1;
      if (action === 'extract') {
        if (!isFinalRoom) return { ok: false, message: 'The extraction portal is only available after the final encounter.' };
        run.phase = 'completed';
        run.completedAt = now;
        run.message = 'Extraction successful. Expedition rewards have been secured.';
        const ore = getDungeonOreReward(run.tier);
        const rewards = Object.keys(run.players).map((playerId) => ({
          playerId,
          xp: GATE_KEYS[run.tier - 1].xp,
          items: ore,
        }));
        run.updatedAt = now;
        this.persist();
        return {
          ok: true, snapshot: this.snapshot(run), rewards,
          affectedPlayerIds: Object.keys(run.players),
        };
      }
      if (isFinalRoom) return { ok: false, message: 'Use the extraction portal to finish the expedition.' };
      run.roomIndex += 1;
      run.map = createDungeonMap(run.tier, run.roomIndex, run.seed);
      run.enemies = this.createEnemies(run.tier, run.roomIndex, roomCount, run.seed, now);
      run.phase = 'active';
      for (const member of Object.values(run.players)) {
        member.x = 1.5;
        member.y = 5.5;
      }
      run.message = 'Room ' + (run.roomIndex + 1) + ' / ' + roomCount + '. Defeat the Cave Dwellers.';
    run.updatedAt = now;
    this.persist();
    return { ok: true, snapshot: this.snapshot(run), affectedPlayerIds: Object.keys(run.players) };
  }

  private findNextStep(run: DungeonRun, fromX: number, fromY: number, toX: number, toY: number) {
    const queue: Array<{ x: number; y: number; first: { x: number; y: number } }> = [];
    const seen = new Set<string>([fromX + ',' + fromY]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = fromX + dx, y = fromY + dy;
      if (isDungeonWalkable(run.map[y]?.[x] ?? '#')) queue.push({ x, y, first: { x, y } });
    }
    while (queue.length) {
      const current = queue.shift()!;
      const key = current.x + ',' + current.y;
      if (seen.has(key)) continue;
      seen.add(key);
      if (current.x === toX && current.y === toY) return current.first;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = current.x + dx, y = current.y + dy;
        if (!seen.has(x + ',' + y) && isDungeonWalkable(run.map[y]?.[x] ?? '#')) {
          queue.push({ x, y, first: current.first });
        }
      }
    }
    return null;
  }

  tick(now = Date.now()): DungeonSnapshot[] {
    const changed: DungeonSnapshot[] = [];
    for (const run of this.runs.values()) {
      if (run.phase !== 'active') continue;
      if (now - run.createdAt > MAX_RUN_AGE_MS) {
        run.phase = 'failed';
        run.message = 'The expedition expired before completion.';
        run.updatedAt = now;
        changed.push(this.snapshot(run));
        continue;
      }
      const connectedPlayers = Object.values(run.players).filter((player) => player.connected && player.hp > 0);
      if (connectedPlayers.length === 0) {
        const anyRecentlyConnected = Object.values(run.players).some((player) => now - player.lastSeenAt < DISCONNECT_GRACE_MS);
        if (!anyRecentlyConnected) {
          run.phase = 'failed';
          run.message = 'The party abandoned the expedition. No rewards were granted.';
          run.updatedAt = now;
          changed.push(this.snapshot(run));
        }
        continue;
      }
      if (now - run.lastTickAt < 250) continue;
      run.lastTickAt = now;
      let didChange = false;
      for (const enemy of run.enemies) {
        if (enemy.hp <= 0) continue;
        const targets = connectedPlayers.filter((player) => player.hp > 0);
        if (!targets.length) break;
        const target = targets.sort((a, b) =>
          Math.abs(a.x - enemy.x) + Math.abs(a.y - enemy.y) - (Math.abs(b.x - enemy.x) + Math.abs(b.y - enemy.y))
        )[0];
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= DEFAULT_DUNGEON_BALANCE.enemyAttackRange && now >= enemy.nextAttackAt) {
          target.hp = Math.max(0, target.hp - enemy.damage);
          enemy.nextAttackAt = now + (enemy.boss ? DEFAULT_DUNGEON_BALANCE.bossAttackCooldownMs : DEFAULT_DUNGEON_BALANCE.enemyAttackCooldownMs);
          run.message = enemy.name + ' hit ' + target.name + ' for ' + enemy.damage + '.';
          didChange = true;
        } else if (distance > 0.9 && now >= enemy.nextMoveAt) {
          const step = this.findNextStep(run, Math.floor(enemy.x), Math.floor(enemy.y), Math.floor(target.x), Math.floor(target.y));
          if (step && !Object.values(run.players).some((p) => p.hp > 0 && Math.hypot(p.x - (step.x + 0.5), p.y - (step.y + 0.5)) < 0.48) &&
              !run.enemies.some((other) => other.id !== enemy.id && other.hp > 0 && Math.hypot(other.x - (step.x + 0.5), other.y - (step.y + 0.5)) < 0.48)) {
            enemy.x = step.x + 0.5;
            enemy.y = step.y + 0.5;
          }
          enemy.nextMoveAt = now + (enemy.boss ? DEFAULT_DUNGEON_BALANCE.bossMoveCooldownMs : DEFAULT_DUNGEON_BALANCE.enemyMoveCooldownMs);
          didChange = true;
        }
      }
      if (Object.values(run.players).every((player) => player.hp <= 0)) {
        run.phase = 'failed';
        run.message = 'The entire party was defeated. No rewards were granted.';
        didChange = true;
      }
      if (didChange) {
        run.updatedAt = now;
        if (now - run.lastBroadcastAt >= 300) {
          run.lastBroadcastAt = now;
          changed.push(this.snapshot(run));
        }
      }
    }
    if (changed.length) this.persist();
    return changed;
  }

  getParticipantIds(runId: string): string[] {
    const run = this.runs.get(runId);
    return run ? Object.keys(run.players) : [];
  }

  private snapshot(run: DungeonRun): DungeonSnapshot {
    return {
      runId: run.runId, code: run.code, tier: run.tier, partyMode: run.partyMode,
      roomIndex: run.roomIndex, roomCount: GATE_KEYS[run.tier - 1].rooms,
      width: DUNGEON_WIDTH, height: DUNGEON_HEIGHT, map: [...run.map],
      phase: run.phase, message: run.message,
      players: Object.values(run.players).map(({ lastSeenAt, lastActionAt, ...player }) => ({ ...player })),
      enemies: run.enemies.map((enemy) => ({ ...enemy })),
      rewardXp: run.phase === 'completed' ? GATE_KEYS[run.tier - 1].xp : undefined,
    };
  }
}

function runTileWalkable(map: string[], x: number, y: number) {
  return isDungeonWalkable(map[y]?.[x] ?? '#');
}
