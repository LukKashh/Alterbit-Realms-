import { BEDROCK_ROWS, PLAYABLE_ROWS, WORLD_HEIGHT, WORLD_TILE_COUNT, WORLD_WIDTH } from './constants.ts';
import { ITEM_IDS } from './catalog.ts';

export interface PlantedTree {
  x: number;
  y: number;
  seedId: number;
  plantedAt: number;
  maturityAt: number;
  ownerId: string;
}

export interface WorldLockRecord {
  x: number;
  y: number;
  lockItemId: number;
  ownerId: string;
  ownerName: string;
  editors: string[]; // playerIds
  editorNames?: Record<string, string>;
  publicAccess: boolean;
}

export interface AreaLockRecord {
  x: number;
  y: number;
  radius: number; // default 3 -> 7x7 area
  ownerId: string;
  ownerName: string;
  editors: string[];
  editorNames?: Record<string, string>;
}

export interface VendingMachineRecord {
  x: number;
  y: number;
  ownerId: string;
  ownerName: string;
  stockItemId: number;
  stockQty: number;
  priceItemId: number;
  priceQty: number;
  earningsQty: number;
}

export interface WorldState {
  name: string;
  seed: number;
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  fg: number[]; // length 6000
  bg: number[]; // length 6000
  plants: Record<string, PlantedTree>; // key: `${x},${y}`
  worldLock: WorldLockRecord | null;
  areaLocks?: Record<string, AreaLockRecord>; // key: `${x},${y}`
  vendingMachines?: Record<string, VendingMachineRecord>; // key: `${x},${y}`
  signs?: Record<string, string>; // key: `${x},${y}`
  revision: number;
}

export function hashWorldSeed(name: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type WorldFamily = 'desert_blast' | 'arctic_tundra' | 'cave_blast' | 'temperate';

export function classifyWorldFamily(worldName: string): WorldFamily {
  const name = worldName.trim().toUpperCase();
  if (name.includes('DESERT') || name.includes('DUNES') || name.includes('ARID')) return 'desert_blast';
  if (name.includes('ARCTIC') || name.includes('TUNDRA') || name.includes('FROST') || name.includes('ICE')) return 'arctic_tundra';
  if (name.includes('CAVE') || name.includes('CAVERN') || name.includes('UNDERGROUND')) return 'cave_blast';
  return 'temperate';
}

export function generateWorld(worldName: string): WorldState {
  const normalized = worldName.trim().toUpperCase() || 'START';
  const seed = hashWorldSeed(normalized);
  const rand = createRng(seed);

  const fg = new Array<number>(WORLD_TILE_COUNT).fill(ITEM_IDS.AIR);
  const bg = new Array<number>(WORLD_TILE_COUNT).fill(ITEM_IDS.BG_SKY);

  const spawnX = Math.floor(WORLD_WIDTH / 2); // 50
  const baseSurfaceY = 24;
  const worldFamily = classifyWorldFamily(normalized);

  // Compute smooth rolling surface heights with a flat terrace around spawn
  const surfaceHeights = new Array<number>(WORLD_WIDTH);
  const phase1 = rand() * Math.PI * 2;
  const phase2 = rand() * Math.PI * 2;

  for (let x = 0; x < WORLD_WIDTH; x++) {
    const distFromSpawn = Math.abs(x - spawnX);
    if (distFromSpawn <= 4) {
      surfaceHeights[x] = baseSurfaceY;
    } else {
      const wave = Math.sin(x * 0.14 + phase1) * 2.1 + Math.cos(x * 0.06 + phase2) * 1.6;
      const blend = Math.min(1, (distFromSpawn - 4) / 6);
      surfaceHeights[x] = Math.round(baseSurfaceY + wave * blend);
    }
  }

  // Fill terrain using the selected world's natural block family
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const sy = surfaceHeights[x];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      const idx = y * WORLD_WIDTH + x;

      // Bottom 6 rows (y = 54..59) are unbreakable bedrock
      if (y >= PLAYABLE_ROWS) {
        fg[idx] = ITEM_IDS.BEDROCK;
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        continue;
      }

      if (y < sy) {
        fg[idx] = ITEM_IDS.AIR;
        bg[idx] = ITEM_IDS.BG_SKY;
      } else if (worldFamily === 'desert_blast') {
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        if (y === sy) fg[idx] = rand() < 0.18 ? ITEM_IDS.DESERT_GRAVEL : ITEM_IDS.DESERT_SAND;
        else if (y < sy + 7) fg[idx] = ITEM_IDS.DESERT_SAND;
        else if (y < 46) {
          const r = rand();
          fg[idx] = r < 0.14 ? ITEM_IDS.RED_SANDSTONE : r < 0.28 ? ITEM_IDS.DESERT_GRAVEL : r < 0.48 ? ITEM_IDS.DESERT_HARDPAN : ITEM_IDS.DESERT_SAND;
        } else {
          const r = rand();
          fg[idx] = r < 0.10 ? ITEM_IDS.SALT_CRUST : r < 0.38 ? ITEM_IDS.RED_SANDSTONE : ITEM_IDS.DESERT_HARDPAN;
        }
      } else if (worldFamily === 'arctic_tundra') {
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        if (y === sy) fg[idx] = rand() < 0.16 ? ITEM_IDS.FROST_ROCK : ITEM_IDS.FROST_SNOW;
        else if (y < sy + 5) fg[idx] = rand() < 0.22 ? ITEM_IDS.FROZEN_DIRT : ITEM_IDS.PACKED_SNOW;
        else if (y < 46) {
          const r = rand();
          fg[idx] = r < 0.18 ? ITEM_IDS.GLACIER_ICE : r < 0.42 ? ITEM_IDS.FROST_ROCK : ITEM_IDS.PERMAFROST;
        } else {
          const r = rand();
          fg[idx] = r < 0.12 ? ITEM_IDS.BLUE_ICE : r < 0.45 ? ITEM_IDS.GLACIER_ICE : ITEM_IDS.PERMAFROST;
        }
      } else if (worldFamily === 'cave_blast') {
        bg[idx] = ITEM_IDS.CAVE_BACKGROUND_WALL;
        if (y === sy) fg[idx] = ITEM_IDS.CAVE_GRAVEL;
        else if (y < sy + 7) fg[idx] = rand() < 0.25 ? ITEM_IDS.UNDERGROUND_CLAY : ITEM_IDS.CAVE_LIMESTONE;
        else if (y < 46) {
          const r = rand();
          fg[idx] = r < 0.12 ? ITEM_IDS.CRYSTAL_ORE : r < 0.30 ? ITEM_IDS.GRANITE : r < 0.62 ? ITEM_IDS.CAVE_SHALE : ITEM_IDS.CAVE_LIMESTONE;
        } else {
          const r = rand();
          fg[idx] = r < 0.08 ? ITEM_IDS.CRYSTAL_ORE : r < 0.42 ? ITEM_IDS.GRANITE : r < 0.72 ? ITEM_IDS.CAVE_SHALE : ITEM_IDS.CAVE_LIMESTONE;
        }
      } else if (y === sy) {
        fg[idx] = ITEM_IDS.GP_GRASS;
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
      } else if (y < sy + 7) {
        fg[idx] = ITEM_IDS.GP_DIRT;
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
      } else if (y < 46) {
        const r = rand();
        if (r < 0.035) fg[idx] = ITEM_IDS.GP_ROCK;
        else if (r < 0.16 && y < sy + 14) fg[idx] = ITEM_IDS.GP_DIRT;
        else if (r < 0.05 && y > sy + 10) fg[idx] = ITEM_IDS.AIR;
        else fg[idx] = ITEM_IDS.GP_ROCK;
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
      } else {
        const r = rand();
        fg[idx] = r < 0.15 ? ITEM_IDS.GP_LAVA : ITEM_IDS.GP_ROCK;
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
      }
    }
  }

  // Add biome-appropriate surface vegetation and formations away from spawn terrace
  for (let x = 6; x < WORLD_WIDTH - 6; x++) {
    if (Math.abs(x - spawnX) <= 6) continue;
    const roll = rand();
    const sy = surfaceHeights[x];
    if (worldFamily === 'desert_blast') {
      if (roll < 0.10) {
        fg[(sy - 1) * WORLD_WIDTH + x] = ITEM_IDS.CACTUS;
        if (rand() < 0.45 && x + 1 < WORLD_WIDTH) fg[(sy - 1) * WORLD_WIDTH + x + 1] = ITEM_IDS.DRY_ROOT;
        x += 2;
      } else if (roll < 0.16) {
        fg[(sy - 1) * WORLD_WIDTH + x] = ITEM_IDS.DUNE_GRASS;
      }
    } else if (worldFamily === 'arctic_tundra') {
      if (roll < 0.09) {
        fg[(sy - 1) * WORLD_WIDTH + x] = ITEM_IDS.ICICLE;
      }
    } else if (worldFamily === 'cave_blast') {
      if (roll < 0.075) fg[(sy - 1) * WORLD_WIDTH + x] = ITEM_IDS.STALAGMITE;
      else if (roll < 0.15 && sy > 2) fg[(sy - 2) * WORLD_WIDTH + x] = ITEM_IDS.STALACTITE;
    } else if (roll < 0.095) {
      const trunkH = 3 + Math.floor(rand() * 2);
      for (let h = 1; h <= trunkH; h++) {
        const ty = sy - h;
        if (ty > 2) fg[ty * WORLD_WIDTH + x] = ITEM_IDS.GP_WOOD_BLOCK;
      }
      const topY = sy - trunkH;
      for (let lx = -1; lx <= 1; lx++) {
        for (let ly = -1; ly <= 0; ly++) {
          const tx = x + lx;
          const ty = topY + ly;
          if (tx >= 0 && tx < WORLD_WIDTH && ty >= 1 && fg[ty * WORLD_WIDTH + tx] === ITEM_IDS.AIR) {
            fg[ty * WORLD_WIDTH + tx] = ITEM_IDS.GP_BUSH;
          }
        }
      }
      x += 4;
    }
  }

  // Place Entrance Portal at spawnX, one tile above surface
  const spawnY = surfaceHeights[spawnX] - 1;
  fg[spawnY * WORLD_WIDTH + spawnX] = ITEM_IDS.ENTRANCE_PORTAL;

  // Place a helpful welcome GrowPixel sign at spawnX - 2
  const signX = spawnX - 2;
  const signY = surfaceHeights[signX] - 1;
  fg[signY * WORLD_WIDTH + signX] = ITEM_IDS.GP_SIGN;

  void BEDROCK_ROWS;

  return {
    name: normalized,
    seed,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    spawnX,
    spawnY,
    fg,
    bg,
    plants: {},
    worldLock: null,
    areaLocks: {},
    vendingMachines: {},
    signs: {
      [`${signX},${signY}`]: `Welcome to ${normalized}! Mine GrowPixel blocks for seeds & gems, splice items, or use wrench.`,
    },
    revision: 1,
  };
}
