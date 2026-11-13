import { GATE_KEYS } from './expansion.ts';

export const DUNGEON_WIDTH = 17;
export const DUNGEON_HEIGHT = 11;
export const DUNGEON_PARTY_LIMIT = 4;

export type DungeonPhase = 'active' | 'cleared' | 'completed' | 'failed';
export type DungeonAction = 'move' | 'attack' | 'next_room' | 'leave';

export interface DungeonPlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  connected: boolean;
}

export interface DungeonEnemyState {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  boss: boolean;
  nextAttackAt: number;
  nextMoveAt: number;
}

export interface DungeonSnapshot {
  runId: string;
  code: string;
  tier: number;
  roomIndex: number;
  roomCount: number;
  width: number;
  height: number;
  map: string[];
  phase: DungeonPhase;
  message: string;
  players: DungeonPlayerState[];
  enemies: DungeonEnemyState[];
  rewardXp?: number;
}

export interface DungeonReward {
  playerId: string;
  xp: number;
  items: Array<{ itemId: number; qty: number }>;
}

export function isDungeonWalkable(tile: string): boolean {
  return tile === '.' || tile === '<' || tile === '>';
}

export function createDungeonMap(tier: number, roomIndex: number, seed: number): string[] {
  let state = (seed ^ (tier * 0x45d9f3b) ^ (roomIndex * 0x119de1f3)) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const grid = Array.from({ length: DUNGEON_HEIGHT }, (_, y) =>
    Array.from({ length: DUNGEON_WIDTH }, (_, x) =>
      x === 0 || y === 0 || x === DUNGEON_WIDTH - 1 || y === DUNGEON_HEIGHT - 1 ? '#' : '.'
    )
  );
  const pillars = [[5, 3], [5, 7], [11, 3], [11, 7], [8, 2], [8, 8]];
  for (const [x, y] of pillars) {
    if (random() < 0.72) grid[y][x] = '#';
  }
  for (let y = 1; y < DUNGEON_HEIGHT - 1; y++) {
    grid[y][1] = '.';
    grid[y][DUNGEON_WIDTH - 2] = '.';
  }
  for (let x = 1; x < DUNGEON_WIDTH - 1; x++) grid[5][x] = '.';
  grid[5][1] = '<';
  grid[5][DUNGEON_WIDTH - 2] = '>';
  return grid.map((row) => row.join(''));
}

export function getDungeonKey(tier: number) {
  return GATE_KEYS.find((key) => key.tier === tier) ?? null;
}

export function getDungeonEnemyStats(tier: number, boss: boolean) {
  const hp = 18 + tier * 9;
  return {
    hp: boss ? 90 + tier * 34 : hp,
    damage: boss ? 9 + tier * 3 : 3 + tier * 2,
    name: boss ? 'Gate Guardian ' + tier : ([
      'Cavern Slime', 'Sentinel Golem', 'Emerald Stalker', 'Divinium Warden', 'Omegazyte Overlord'
    ][Math.max(0, tier - 1)] ?? 'Cave Dweller'),
  };
}

export function getDungeonOreReward(tier: number): { itemId: number; qty: number }[] {
  // The source blueprint defines each Gate Key's ore pool but leaves exact reward quantities open.
  // These bounded defaults are intentionally conservative until the economy is tuned.
  const orePools: Record<number, number[]> = {
    1: [201, 202, 202, 210],
    2: [210, 203, 204],
    3: [203, 204, 204],
    4: [204, 204, 204],
    5: [204, 204, 204],
  };
  const pool = orePools[tier] ?? orePools[1];
  const itemId = pool[Math.floor(Math.random() * pool.length)];
  return [{ itemId, qty: Math.max(1, Math.min(4, Math.ceil(tier / 2))) }];
}
