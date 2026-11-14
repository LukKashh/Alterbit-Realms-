import { BEDROCK_ROWS, WORLD_HEIGHT, WORLD_TILE_COUNT, WORLD_WIDTH } from './constants.ts';
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

export interface ShareLockRecord {
  x: number;
  y: number;
  itemId: number;
  width: number;
  height: number;
  ownerId: string;
  ownerName: string;
  access: Record<string, { playerName: string; permissions: import('./shareLocks.ts').ShareLockPermissions }>;
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

export interface FurnaceRecord {
  x: number;
  y: number;
  ownerId: string;
  recipeId: string | null;
  startedAt: number | null;
  finishesAt: number | null;
  readyOutputItemId: number;
  readyOutputQty: number;
}

export interface BfgCollectorRecord {
  x: number;
  y: number;
  ownerId: string;
  active: boolean;
  storedGems: number;
  storedItems: { itemId: number; qty: number }[];
}

export interface WorldState {
  name: string;
  seed: number;
  width: number;
  height: number;
  worldKind?: 'standard' | 'mine_shaft';
  worldFamily?: WorldFamily;
  terraBlasted?: boolean;
  expiresAt?: number;
  spawnX: number;
  spawnY: number;
  fg: number[]; // length width * height
  bg: number[]; // length width * height
  fluidType?: number[]; // 0 = dry, 1 = water, 2 = acid
  fluidLevel?: number[]; // 0..4
  plants: Record<string, PlantedTree>; // key: `${x},${y}`
  worldLock: WorldLockRecord | null;
  /** New rectangular area-sharing claims. */
  shareLocks?: Record<string, ShareLockRecord>; // key: `${x},${y}`
  /** Legacy data retained only for safe migration; no longer grants access. */
  areaLocks?: Record<string, AreaLockRecord>; // key: `${x},${y}`
  vendingMachines?: Record<string, VendingMachineRecord>; // key: `${x},${y}`
  furnaces?: Record<string, FurnaceRecord>; // key: `${x},${y}`
  bfgCollectors?: Record<string, BfgCollectorRecord>; // key: `${x},${y}`
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

export function generateWorld(worldName: string, terraBlast = false): WorldState {
  const normalized = worldName.trim().toUpperCase() || 'START';
  const seed = hashWorldSeed(normalized);
  const rand = createRng(seed);

  const fg = new Array<number>(WORLD_TILE_COUNT).fill(ITEM_IDS.AIR);
  const bg = new Array<number>(WORLD_TILE_COUNT).fill(ITEM_IDS.BG_SKY);
  const fluidType = new Array<number>(WORLD_TILE_COUNT).fill(0);
  const fluidLevel = new Array<number>(WORLD_TILE_COUNT).fill(0);

  const isFishingIsland = normalized === 'FISHING' || normalized.includes('FISH');
  const spawnX = Math.floor(WORLD_WIDTH / 2); // 50
  const baseSurfaceY = isFishingIsland ? 32 : 24;
  const blastFamilies: WorldFamily[] = ['desert_blast', 'arctic_tundra', 'cave_blast'];
  const worldFamily = terraBlast
    ? blastFamilies[hashWorldSeed(normalized + '_TERRA') % blastFamilies.length]
    : classifyWorldFamily(normalized);
  const playableRows = WORLD_HEIGHT - BEDROCK_ROWS;

  // Compute smooth rolling surface heights with a flat terrace around spawn
  const surfaceHeights = new Array<number>(WORLD_WIDTH);
  const phase1 = rand() * Math.PI * 2;
  const phase2 = rand() * Math.PI * 2;

  for (let x = 0; x < WORLD_WIDTH; x++) {
    if (isFishingIsland) {
      if (x >= 32 && x <= 68) {
        surfaceHeights[x] = 32;
      } else {
        surfaceHeights[x] = 42; // Deep ocean sides
      }
    } else {
      const distFromSpawn = Math.abs(x - spawnX);
      if (distFromSpawn <= 4) {
        surfaceHeights[x] = baseSurfaceY;
      } else {
        const wave = Math.sin(x * 0.14 + phase1) * 2.1 + Math.cos(x * 0.06 + phase2) * 1.6;
        const blend = Math.min(1, (distFromSpawn - 4) / 6);
        surfaceHeights[x] = Math.round(baseSurfaceY + wave * blend);
      }
    }
  }

  // Fill terrain using the selected world's natural block family
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const sy = surfaceHeights[x];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      const idx = y * WORLD_WIDTH + x;

      if (isFishingIsland && (x < 32 || x > 68)) {
        if (y >= playableRows) {
          fg[idx] = ITEM_IDS.BEDROCK;
          bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        } else if (y >= 42) {
          fg[idx] = ITEM_IDS.AIR;
          bg[idx] = ITEM_IDS.BG_SKY;
          fluidType[idx] = 1;
          fluidLevel[idx] = 7;
        } else {
          fg[idx] = ITEM_IDS.AIR;
          bg[idx] = ITEM_IDS.BG_SKY;
        }
        continue;
      }

      if (isFishingIsland && x >= 32 && x <= 68) {
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        if (y >= playableRows) {
          fg[idx] = ITEM_IDS.BEDROCK;
        } else if (y === sy) {
          fg[idx] = ITEM_IDS.DESERT_SAND;
        } else if (y < sy + 8) {
          fg[idx] = ITEM_IDS.DESERT_SAND;
        } else {
          fg[idx] = ITEM_IDS.RED_SANDSTONE;
        }
        continue;
      }

      // Bottom 6 rows (y = 54..59) are unbreakable bedrock
      if (y >= playableRows) {
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

  // Nexus has a permanent Landlord NPC beside the entrance for realm management.
  if (normalized === 'NEXUS') {
    const landlordX = Math.min(WORLD_WIDTH - 4, spawnX + 4);
    const landlordY = surfaceHeights[landlordX] - 1;
    fg[landlordY * WORLD_WIDTH + landlordX] = ITEM_IDS.LANDLORD_NPC;
  }

  // Place a helpful welcome GrowPixel sign at spawnX - 2
  const signX = spawnX - 2;
  const signY = surfaceHeights[signX] - 1;
  fg[signY * WORLD_WIDTH + signX] = ITEM_IDS.GP_SIGN;

  return {
    name: normalized,
    seed,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    worldKind: 'standard',
    worldFamily,
    terraBlasted: terraBlast,
    spawnX,
    spawnY,
    fg,
    bg,
    fluidType,
    fluidLevel,
    plants: {},
    worldLock: null,
    areaLocks: {},
    shareLocks: {},
    vendingMachines: {},
    furnaces: {},
    bfgCollectors: {},
    signs: {
      [`${signX},${signY}`]: `Welcome to ${normalized}! Mine blocks for seeds & gems, fish pools, or smelt at a Stone Furnace.`,
    },
    revision: 1,
  };
}

/**
 * Ephemeral 50×150 vertical Mining Shaft expedition world.
 * Stratified into Upper Limestone (8..40), Middle Shale (41..85), Crystal Granite (86..122), and Deep Obsidian (123..143).
 */
export function generateMineShaft(shaftName: string, ownerName: string, durationMs = 10 * 60_000): WorldState {
  const normalized = shaftName.trim().toUpperCase() || 'MINE-SHAFT';
  const seed = hashWorldSeed(`${normalized}_${Date.now()}`);
  const rand = createRng(seed);

  const width = 50;
  const height = 150;
  const total = width * height;
  const fg = new Array<number>(total).fill(ITEM_IDS.AIR);
  const bg = new Array<number>(total).fill(ITEM_IDS.CAVE_BACKGROUND_WALL);
  const fluidType = new Array<number>(total).fill(0);
  const fluidLevel = new Array<number>(total).fill(0);

  const spawnX = 25;
  const spawnY = 7;

  // Stratified stone layers
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (x === 0 || x === width - 1 || y >= height - BEDROCK_ROWS) {
        fg[idx] = ITEM_IDS.BEDROCK;
        bg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        continue;
      }
      if (y < 8) {
        fg[idx] = ITEM_IDS.AIR;
        bg[idx] = ITEM_IDS.CAVE_BACKGROUND_WALL;
        continue;
      }
      const r = rand();
      if (y < 42) {
        // Upper Limestone & Copper / Coal stratum
        if (r < 0.08) fg[idx] = ITEM_IDS.COAL_VEIN;
        else if (r < 0.16) fg[idx] = ITEM_IDS.COPPER_VEIN;
        else fg[idx] = r < 0.4 ? ITEM_IDS.CAVE_GRAVEL : ITEM_IDS.CAVE_LIMESTONE;
      } else if (y < 86) {
        // Middle Shale & Iron / Copper stratum
        if (r < 0.06) fg[idx] = ITEM_IDS.COAL_VEIN;
        else if (r < 0.13) fg[idx] = ITEM_IDS.COPPER_VEIN;
        else if (r < 0.23) fg[idx] = ITEM_IDS.IRON_VEIN;
        else fg[idx] = r < 0.55 ? ITEM_IDS.CAVE_SHALE : ITEM_IDS.CAVE_LIMESTONE;
      } else if (y < 122) {
        // Deep Crystal Granite stratum
        if (r < 0.05) fg[idx] = ITEM_IDS.COAL_VEIN;
        else if (r < 0.13) fg[idx] = ITEM_IDS.IRON_VEIN;
        else if (r < 0.24) fg[idx] = ITEM_IDS.CRYSTAL_ORE;
        else fg[idx] = r < 0.65 ? ITEM_IDS.GRANITE : ITEM_IDS.CAVE_SHALE;
      } else {
        // Abyssal Obsidian Core
        if (r < 0.10) fg[idx] = ITEM_IDS.CRYSTAL_ORE;
        else if (r < 0.23) fg[idx] = ITEM_IDS.OBSIDIAN_VEIN;
        else fg[idx] = ITEM_IDS.GP_LAVA_ROCK;
      }
    }
  }

  // Carve winding vertical shaft pockets & wooden ladder platforms
  let cx = spawnX;
  for (let y = spawnY + 1; y < height - BEDROCK_ROWS - 4; y += 5) {
    cx = Math.max(6, Math.min(width - 7, cx + Math.round((rand() - 0.5) * 10)));
    const pocketW = 3 + Math.floor(rand() * 3);
    const pocketH = 3 + Math.floor(rand() * 2);
    for (let dy = 0; dy < pocketH; dy++) {
      for (let dx = -pocketW; dx <= pocketW; dx++) {
        const px = cx + dx;
        const py = y + dy;
        if (px > 1 && px < width - 2 && py > 8 && py < height - BEDROCK_ROWS - 1) {
          fg[py * width + px] = ITEM_IDS.AIR;
        }
      }
    }
    // Wooden walkway platform
    for (let dx = -2; dx <= 2; dx++) {
      const px = cx + dx;
      if (px > 1 && px < width - 2) {
        fg[(y + pocketH - 1) * width + px] = ITEM_IDS.GP_WOODEN_PLATFORM;
      }
    }
    // Small water or deep acid pools inside caverns for risky mining / subterranean fishing
    if (rand() < 0.35 && y > 22) {
      const fKind = y > 105 ? 2 : 1;
      for (let dx = -1; dx <= 1; dx++) {
        const pIdx = (y + pocketH - 2) * width + (cx + dx);
        if (fg[pIdx] === ITEM_IDS.AIR) {
          fluidType[pIdx] = fKind;
          fluidLevel[pIdx] = 4;
        }
      }
    }
  }

  // Clear spawn chamber at y=4..8 around x=20..30
  for (let y = 4; y <= 7; y++) {
    for (let x = spawnX - 4; x <= spawnX + 4; x++) {
      fg[y * width + x] = ITEM_IDS.AIR;
    }
  }
  for (let x = spawnX - 4; x <= spawnX + 4; x++) {
    fg[8 * width + x] = x >= spawnX - 1 && x <= spawnX + 1 ? ITEM_IDS.GP_WOODEN_PLATFORM : ITEM_IDS.CAVE_LIMESTONE;
  }
  fg[spawnY * width + spawnX] = ITEM_IDS.ENTRANCE_PORTAL;

  return {
    name: normalized,
    seed,
    width,
    height,
    worldKind: 'mine_shaft',
    expiresAt: Date.now() + durationMs,
    spawnX,
    spawnY,
    fg,
    bg,
    fluidType,
    fluidLevel,
    plants: {},
    worldLock: null,
    areaLocks: {},
    vendingMachines: {},
    furnaces: {},
    bfgCollectors: {},
    signs: {
      [`${spawnX - 2},${spawnY}`]: `Mine Shaft Expedition (${ownerName}) — Exclusive Coal, Copper, Iron, Crystal & Obsidian Ores!`,
    },
    revision: 1,
  };
}
