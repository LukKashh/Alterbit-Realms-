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

export interface SeedPotRecord {
  x: number;
  y: number;
  hasPlant: boolean;
  placedAt?: number;
}

export interface MatteragenRecord {
  x: number;
  y: number;
  typeId: number; // 551..555
  level: number; // 1..5
  placedAtMs: number;
  lastHarvestMs: number;
  isReady: boolean;
  storedDrops?: { itemId: number; count: number }[];
}

export interface AtmMachineRecord {
  x: number;
  y: number;
  ownerId: string;
  placedAtMs: number;
  lastHarvestMs: number;
  intervalMs: number; // 30m - 1.5h random interval per cycle
  isReady: boolean;
  storedGems: number; // 5 - 125 Gems when ready
}

export const VAULTBOX_SLOT_COUNT = 10;

export interface VaultboxSlot {
  itemId: number;
  qty: number;
  durability?: number;
  maxDurability?: number;
  rodInstanceId?: string;
  rodUpgradeLevel?: 1 | 2 | 3;
}

export interface VaultboxRecord {
  x: number;
  y: number;
  ownerId: string;
  ownerName: string;
  slots: (VaultboxSlot | null)[]; // Fixed 10-tile player storage
}

export interface WorldState {
  name: string;
  seed: number;
  width: number;
  height: number;
  worldKind?: 'standard' | 'mine_shaft';
  worldFamily?: WorldFamily;
  terraBlasted?: boolean;
  isPersonalRealm?: boolean;
  expiresAt?: number;
  spawnX: number;
  spawnY: number;
  fg: number[]; // length width * height
  bg: number[]; // length width * height
  fluidType?: number[]; // 0 = dry, 1 = water, 2 = acid
  fluidLevel?: number[]; // 0..4
  plants: Record<string, PlantedTree>; // key: `${x},${y}`
  seedPots?: Record<string, SeedPotRecord>; // key: `${x},${y}`
  matteragenEngines?: Record<string, MatteragenRecord>; // key: `${x},${y}`
  atmMachines?: Record<string, AtmMachineRecord>; // key: `${x},${y}`
  vaultboxes?: Record<string, VaultboxRecord>; // key: `${x},${y}`
  worldLock: WorldLockRecord | null;
  /** New rectangular area-sharing claims. */
  shareLocks?: Record<string, ShareLockRecord>; // key: `${x},${y}`
  /** Legacy data retained only for safe migration; no longer grants access. */
  areaLocks?: Record<string, AreaLockRecord>; // key: `${x},${y}`
  vendingMachines?: Record<string, VendingMachineRecord>; // key: `${x},${y}`
  furnaces?: Record<string, FurnaceRecord>; // key: `${x},${y}`
  bfgCollectors?: Record<string, BfgCollectorRecord>; // key: `${x},${y}`
  signs?: Record<string, string>; // key: `${x},${y}`
  doorLinks?: Record<string, DoorLinkRecord>; // key: `${x},${y}`
  worldXp?: number;
  worldLevel?: number;
  coreTokens?: number;
  nexusLayoutVersion?: number;
  revision: number;
}

export interface DoorLinkRecord {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  label?: string;
}

export interface NexusDoorDestination {
  id: 'west_greens' | 'east_steward' | 'upper_exchange' | 'center_plaza';
  label: string;
  subtitle: string;
  tx: number;
  ty: number;
}

export const NEXUS_DOOR_DESTINATIONS: NexusDoorDestination[] = [
  {
    id: 'west_greens',
    label: '← Fresh Greens',
    subtitle: 'West Deck — Sell Harvested Crops for Digibits & Buy Crop Seeds',
    tx: 28,
    ty: 27,
  },
  {
    id: 'east_steward',
    label: 'Realm Steward →',
    subtitle: 'East Deck — Conjure Your 50×40 Personal World & Starter Lootbox',
    tx: 72,
    ty: 27,
  },
  {
    id: 'upper_exchange',
    label: '↑ Exchange & Furnace',
    subtitle: 'Upper Deck — Global Exchange Terminal & Stone Smelting Furnace',
    tx: 50,
    ty: 17,
  },
  {
    id: 'center_plaza',
    label: '⦿ Center Entry Plaza',
    subtitle: 'Center Deck — Main NEXUS Spawn Portal & Multi-Way Hub Door',
    tx: 50,
    ty: 29,
  },
];

export const NEXUS_LAYOUT_VERSION = 4;

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
    return ((t ^ (t ^ (t >>> 14)) >>> 0) >>> 0) / 4294967296;
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

export function generateWorld(
  worldName: string,
  terraBlast = false,
  options?: { isPersonalWorld?: boolean; includeStarterLootbox?: boolean }
): WorldState {
  const normalized = worldName.trim().toUpperCase() || 'START';
  const seed = hashWorldSeed(normalized);
  const rand = createRng(seed);

  // Personal World Generation: 50x40 Default Plain World with Indestructible Pregen Foundation
  if (options?.isPersonalWorld) {
    const pWidth = 50;
    const pHeight = 40;
    const pTileCount = pWidth * pHeight;
    const pFg = new Array<number>(pTileCount).fill(ITEM_IDS.AIR);
    const pBg = new Array<number>(pTileCount).fill(ITEM_IDS.BG_SKY);
    const pFluidType = new Array<number>(pTileCount).fill(0);
    const pFluidLevel = new Array<number>(pTileCount).fill(0);

    const pSpawnX = 25;
    const pSurfaceY = 20;
    const pSpawnY = pSurfaceY - 1; // 19
    const pPlayableRows = pHeight - BEDROCK_ROWS; // 34 (bottom 6 rows y=34..39 are bedrock)

    for (let x = 0; x < pWidth; x++) {
      for (let y = 0; y < pHeight; y++) {
        const idx = y * pWidth + x;
        if (y >= pPlayableRows) {
          pFg[idx] = ITEM_IDS.BEDROCK;
          pBg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        } else if (y >= pSurfaceY) {
          // Plain Dirt underground & surface
          pFg[idx] = ITEM_IDS.GP_DIRT;
          pBg[idx] = ITEM_IDS.GP_CAVE_BACKGROUND;
        } else {
          pFg[idx] = ITEM_IDS.AIR;
          pBg[idx] = ITEM_IDS.BG_SKY;
        }
      }
    }

    // Lower 5-wide Indestructible Starting Platform (x = 23..27, y = 20)
    for (let x = pSpawnX - 2; x <= pSpawnX + 2; x++) {
      const idx = pSurfaceY * pWidth + x;
      pFg[idx] = ITEM_IDS.GP_ROCK;
      pBg[idx] = ITEM_IDS.GP_ROCK_BACKGROUND;
    }

    // Entrance Portal in the middle of the Starting Platform (25, 19)
    pFg[pSpawnY * pWidth + pSpawnX] = ITEM_IDS.ENTRANCE_PORTAL;

    // One-Time Starter Supply Lootbox on the starting platform next to the Entrance Portal (26, 19)
    if (options.includeStarterLootbox !== false) {
      pFg[pSpawnY * pWidth + (pSpawnX + 1)] = ITEM_IDS.STARTER_LOOTBOX;
    }

    // Upper 5-wide Indestructible WorldCore Platform (x = 23..27, y = 16 -> 3 empty blocks y=19,18,17 in-between)
    const upperPlatformY = pSurfaceY - 4; // 16
    for (let x = pSpawnX - 2; x <= pSpawnX + 2; x++) {
      const idx = upperPlatformY * pWidth + x;
      pBg[idx] = ITEM_IDS.GP_ROCK_BACKGROUND;
      pFg[idx] = x === pSpawnX ? ITEM_IDS.WORLD_CORE : ITEM_IDS.GP_WOODEN_PLATFORM;
    }

    return {
      name: normalized,
      seed,
      width: pWidth,
      height: pHeight,
      worldKind: 'standard',
      worldFamily: 'temperate',
      terraBlasted: terraBlast,
      isPersonalRealm: true,
      spawnX: pSpawnX,
      spawnY: pSpawnY,
      fg: pFg,
      bg: pBg,
      fluidType: pFluidType,
      fluidLevel: pFluidLevel,
      plants: {},
      seedPots: {},
      matteragenEngines: {},
      atmMachines: {},
      vaultboxes: {},
      worldLock: null,
      areaLocks: {},
      shareLocks: {},
      vendingMachines: {},
      furnaces: {},
      bfgCollectors: {},
      signs: {},
      doorLinks: {},
      worldXp: 0,
      worldLevel: 1,
      coreTokens: 0,
      revision: 1,
    };
  }

  // Main System World: NEXUS — Custom Sci-Fi Floating Platform Hub
  if (normalized === 'NEXUS') {
    const nWidth = WORLD_WIDTH; // 100
    const nHeight = WORLD_HEIGHT; // 60
    const nTileCount = nWidth * nHeight;
    const nFg = new Array<number>(nTileCount).fill(ITEM_IDS.AIR);
    const nBg = new Array<number>(nTileCount).fill(ITEM_IDS.BG_SKY);
    const nFluidType = new Array<number>(nTileCount).fill(0);
    const nFluidLevel = new Array<number>(nTileCount).fill(0);

    // Bottom safety floor row (y = 59)
    for (let x = 0; x < nWidth; x++) {
      nFg[(nHeight - 1) * nWidth + x] = ITEM_IDS.BEDROCK;
    }

    const spawnX = 50;
    const centerDeckY = 30;
    const spawnY = centerDeckY - 1; // 29

    // 1. Center Entry Deck (x = 40..60, y = 30)
    for (let x = 40; x <= 60; x++) {
      nFg[centerDeckY * nWidth + x] = x === 45 || x === 55 ? ITEM_IDS.BOUNCE_PAD : ITEM_IDS.GP_GREY_BLOCK;
      nBg[centerDeckY * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
      nBg[(centerDeckY - 1) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
      nBg[(centerDeckY - 2) * nWidth + x] = ITEM_IDS.GP_GLASS_PANE;
    }
    for (let x = 42; x <= 58; x++) {
      nFg[(centerDeckY + 1) * nWidth + x] =
        x === 44 || x === 50 || x === 56 ? ITEM_IDS.GP_GLASS_BLOCK : ITEM_IDS.GP_ROCK;
      nBg[(centerDeckY + 1) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
    }
    for (let x = 46; x <= 54; x++) {
      nFg[(centerDeckY + 2) * nWidth + x] = x === 50 ? ITEM_IDS.GP_AQUA_BLOCK : ITEM_IDS.GP_GREY_BLOCK;
      nBg[(centerDeckY + 2) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
    }

    // Center Spawn Entrance Portal + Single Multi-Way Background Door & Adjacent Pass-Through WOODEN_SIGN Blocks
    nFg[spawnY * nWidth + spawnX] = ITEM_IDS.ENTRANCE_PORTAL;
    nBg[spawnY * nWidth + 53] = ITEM_IDS.GP_DOOR; // Multi-Way Navigational Door (Background Block)
    nFg[spawnY * nWidth + 47] = ITEM_IDS.WOODEN_SIGN;
    nFg[spawnY * nWidth + 52] = ITEM_IDS.WOODEN_SIGN;
    nFg[spawnY * nWidth + 55] = ITEM_IDS.WOODEN_SIGN;

    // Sci-Fi Floating Step Bridges connecting Center Deck to West & East Decks
    for (const bx of [36, 37, 38, 62, 63, 64]) {
      nFg[29 * nWidth + bx] = ITEM_IDS.GP_WOODEN_PLATFORM;
      nBg[29 * nWidth + bx] = ITEM_IDS.GP_GLASS_PANE;
    }

    // 2. West Marketplace Deck — Fresh Greens Market (x = 16..34, y = 28)
    const westDeckY = 28;
    for (let x = 16; x <= 34; x++) {
      nFg[westDeckY * nWidth + x] =
        x >= 22 && x <= 28 ? ITEM_IDS.GP_WOOD_BLOCK : ITEM_IDS.GP_GREY_BLOCK;
      nBg[westDeckY * nWidth + x] = ITEM_IDS.GP_WOODEN_BACKGROUND;
      nBg[(westDeckY - 1) * nWidth + x] = ITEM_IDS.GP_WOODEN_BACKGROUND;
      nBg[(westDeckY - 2) * nWidth + x] = ITEM_IDS.GP_GLASS_PANE;
    }
    for (let x = 18; x <= 32; x++) {
      nFg[(westDeckY + 1) * nWidth + x] =
        x === 21 || x === 25 || x === 29 ? ITEM_IDS.GP_GLASS_BLOCK : ITEM_IDS.GP_ROCK;
      nBg[(westDeckY + 1) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
    }
    nBg[(westDeckY - 1) * nWidth + 31] = ITEM_IDS.GP_DOOR;
    nFg[(westDeckY - 1) * nWidth + 30] = ITEM_IDS.WOODEN_SIGN;
    nFg[(westDeckY - 1) * nWidth + 25] = ITEM_IDS.GREENS_VENDOR_NPC;
    nFg[(westDeckY - 1) * nWidth + 19] = ITEM_IDS.WOODEN_SIGN;

    // 3. East Realm Steward Deck — Personal World Conjuring (x = 66..84, y = 28)
    const eastDeckY = 28;
    for (let x = 66; x <= 84; x++) {
      nFg[eastDeckY * nWidth + x] = ITEM_IDS.GP_GREY_BLOCK;
      nBg[eastDeckY * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
      nBg[(eastDeckY - 1) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
      nBg[(eastDeckY - 2) * nWidth + x] = ITEM_IDS.GP_GLASS_PANE;
    }
    for (let x = 68; x <= 82; x++) {
      nFg[(eastDeckY + 1) * nWidth + x] =
        x === 71 || x === 75 || x === 79 ? ITEM_IDS.GP_GLASS_BLOCK : ITEM_IDS.GP_ROCK;
      nBg[(eastDeckY + 1) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
    }
    nBg[(eastDeckY - 1) * nWidth + 69] = ITEM_IDS.GP_DOOR;
    nFg[(eastDeckY - 1) * nWidth + 70] = ITEM_IDS.WOODEN_SIGN;
    nFg[(eastDeckY - 1) * nWidth + 75] = ITEM_IDS.LANDLORD_NPC;
    nFg[(eastDeckY - 1) * nWidth + 81] = ITEM_IDS.WOODEN_SIGN;

    // Intermediate Jump/Bounce Booster Platforms (y = 24, x = 44..46 & x = 54..56)
    for (const lx of [44, 45, 46, 54, 55, 56]) {
      nFg[24 * nWidth + lx] = lx === 45 || lx === 55 ? ITEM_IDS.BOUNCE_PAD : ITEM_IDS.GP_WOODEN_PLATFORM;
      nBg[24 * nWidth + lx] = ITEM_IDS.GP_GLASS_PANE;
    }

    // 4. Upper Command & Exchange Deck (x = 38..62, y = 18)
    const upperDeckY = 18;
    for (let x = 38; x <= 62; x++) {
      const isLandingHole = (x >= 44 && x <= 46) || (x >= 54 && x <= 56);
      nFg[upperDeckY * nWidth + x] = isLandingHole ? ITEM_IDS.GP_WOODEN_PLATFORM : ITEM_IDS.GP_GREY_BLOCK;
      nBg[upperDeckY * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
      nBg[(upperDeckY - 1) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
      nBg[(upperDeckY - 2) * nWidth + x] = ITEM_IDS.GP_GLASS_PANE;
    }
    for (let x = 40; x <= 60; x++) {
      if ((x >= 44 && x <= 46) || (x >= 54 && x <= 56)) continue;
      nFg[(upperDeckY + 1) * nWidth + x] =
        x === 42 || x === 50 || x === 58 ? ITEM_IDS.GP_AQUA_BLOCK : ITEM_IDS.GP_ROCK;
      nBg[(upperDeckY + 1) * nWidth + x] = ITEM_IDS.GP_ROCK_BACKGROUND;
    }
    nFg[(upperDeckY - 1) * nWidth + 43] = ITEM_IDS.EXCHANGE_TERMINAL;
    nFg[(upperDeckY - 1) * nWidth + 57] = ITEM_IDS.STONE_FURNACE;
    nBg[(upperDeckY - 1) * nWidth + 51] = ITEM_IDS.GP_DOOR;
    nFg[(upperDeckY - 1) * nWidth + 50] = ITEM_IDS.WOODEN_SIGN;

    return {
      name: normalized,
      seed,
      width: nWidth,
      height: nHeight,
      worldKind: 'standard',
      worldFamily: 'temperate',
      terraBlasted: false,
      nexusLayoutVersion: NEXUS_LAYOUT_VERSION,
      spawnX,
      spawnY,
      fg: nFg,
      bg: nBg,
      fluidType: nFluidType,
      fluidLevel: nFluidLevel,
      plants: {},
      seedPots: {},
      matteragenEngines: {},
      atmMachines: {},
      vaultboxes: {},
      worldLock: null,
      areaLocks: {},
      shareLocks: {},
      vendingMachines: {},
      furnaces: {
        '57,17': {
          x: 57,
          y: 17,
          ownerId: 'SYSTEM',
          recipeId: null,
          startedAt: null,
          finishesAt: null,
          readyOutputItemId: 0,
          readyOutputQty: 0,
        },
      },
      bfgCollectors: {},
      signs: {
        '47,29': '← Fresh Greens',
        '52,29': '↑ Exchange & Furnace',
        '55,29': 'Realm Steward →',
        '30,27': '← Fresh Greens',
        '19,27': 'Fresh Greens Market: Trade harvested Crops for Digibits & buy Crop Seeds!',
        '70,27': 'Realm Steward →',
        '81,27': 'Realm Steward: Conjure your personal 50×40 World with a Starter Supply Lootbox!',
        '50,17': '↑ Exchange & Furnace',
      },
      doorLinks: {},
      worldXp: 0,
      worldLevel: 1,
      coreTokens: 0,
      revision: 1,
    };
  }

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
      const flatRadius = normalized === 'NEXUS' ? 8 : 4;
      if (distFromSpawn <= flatRadius) {
        surfaceHeights[x] = baseSurfaceY;
      } else {
        const wave = Math.sin(x * 0.14 + phase1) * 2.1 + Math.cos(x * 0.06 + phase2) * 1.6;
        const blend = Math.min(1, (distFromSpawn - flatRadius) / 6);
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
    if (Math.abs(x - spawnX) <= (normalized === 'NEXUS' ? 8 : 6)) continue;
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

  // Nexus has two permanent 3x2 market stands on opposite sides of the spawn plaza:
  // Landlord Realm Steward on the right (spawnX + 5) and Fresh Greens Vendor on the left (spawnX - 6).
  if (normalized === 'NEXUS') {
    const landlordX = Math.min(WORLD_WIDTH - 4, spawnX + 5);
    const landlordY = surfaceHeights[landlordX] - 1;
    fg[landlordY * WORLD_WIDTH + landlordX] = ITEM_IDS.LANDLORD_NPC;

    const greensX = Math.max(3, spawnX - 6);
    const greensY = surfaceHeights[greensX] - 1;
    fg[greensY * WORLD_WIDTH + greensX] = ITEM_IDS.GREENS_VENDOR_NPC;
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
    seedPots: {},
    matteragenEngines: {},
    atmMachines: {},
    vaultboxes: {},
    worldLock: null,
    areaLocks: {},
    shareLocks: {},
    vendingMachines: {},
    furnaces: {},
    bfgCollectors: {},
    signs: {
      [`${signX},${signY}`]: `Welcome to ${normalized}! Mine blocks for seeds & gems, fish pools, or smelt at a Stone Furnace.`,
    },
    worldXp: 0,
    worldLevel: 1,
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
