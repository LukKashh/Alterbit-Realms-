import { GATE_KEYS } from './expansion.ts';
import { ITEM_IDS } from './catalog.ts';

export const DUNGEON_WIDTH = 17;
export const DUNGEON_HEIGHT = 11;
export const DUNGEON_PARTY_LIMIT = 4;

export type DungeonPhase = 'active' | 'cleared' | 'completed' | 'failed';
export type DungeonAction = 'move' | 'attack' | 'next_room' | 'extract' | 'leave';

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
  // The source defines the eligible raw-ore pool, but leaves quantities and odds unspecified.
  // Default: one uniformly selected eligible raw ore per successful extraction.
  const rawOreByName: Record<string, number> = {
    coal: ITEM_IDS.RAW_COAL_ORE,
    copper: ITEM_IDS.RAW_COPPER_ORE,
    iron: ITEM_IDS.RAW_IRON_ORE,
    silver: ITEM_IDS.RAW_SILVER_ORE,
    gold: ITEM_IDS.RAW_GOLD_ORE,
    diamond: ITEM_IDS.RAW_DIAMOND_ORE,
    rubidrite: ITEM_IDS.RAW_RUBIDRITE_ORE,
    emeraldazyte: ITEM_IDS.RAW_EMERALDAZYTE_ORE,
    obsidium: ITEM_IDS.RAW_OBSIDIUM_ORE,
    divinium: ITEM_IDS.RAW_DIVINIUM_ORE,
    mythrilyte: ITEM_IDS.RAW_MYTHRILYTE_ORE,
    omegazyte: ITEM_IDS.RAW_OMEGAZYTE_ORE,
  };
  const configuredPool = GATE_KEYS[tier - 1]?.orePool ?? GATE_KEYS[0].orePool;
  const pool = configuredPool.map((ore) => rawOreByName[ore]).filter((itemId) => Number.isInteger(itemId));
  const safePool = pool.length ? pool : [ITEM_IDS.RAW_COPPER_ORE];
  return [{ itemId: safePool[Math.floor(Math.random() * safePool.length)], qty: 1 }];
}
