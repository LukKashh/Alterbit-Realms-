import {
  BEDROCK_ROWS,
  MAX_REACH_TILES,
  PLANT_DEFAULT_GROWTH_MS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.ts';
import { getItemDef, isForegroundSolid, ITEM_IDS, SPLICE_RECIPES } from './catalog.ts';
import type { AreaLockRecord, PlantedTree, WorldState, ShareLockRecord } from './worldGen.ts';
import { DEFAULT_SHARE_LOCK_PERMISSIONS, getShareLockSpec, rectanglesOverlap, type ShareLockPermissionKey } from './shareLocks.ts';
import { isSystemWorld } from './expansion.ts';

export interface PlayerContext {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export function worldWidth(world?: Pick<WorldState, 'width'> | null): number {
  return world?.width || WORLD_WIDTH;
}

export function worldHeight(world?: Pick<WorldState, 'height'> | null): number {
  return world?.height || WORLD_HEIGHT;
}

export function tileIndex(tx: number, ty: number, width = WORLD_WIDTH): number {
  return ty * width + tx;
}

export function tileIndexIn(world: Pick<WorldState, 'width'>, tx: number, ty: number): number {
  return ty * worldWidth(world) + tx;
}

export function inBounds(tx: number, ty: number, width = WORLD_WIDTH, height = WORLD_HEIGHT): boolean {
  return Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && tx < width && ty >= 0 && ty < height;
}

export function inBoundsWorld(world: Pick<WorldState, 'width' | 'height'>, tx: number, ty: number): boolean {
  return inBounds(tx, ty, worldWidth(world), worldHeight(world));
}

export function isBedrockRow(ty: number, height = WORLD_HEIGHT): boolean {
  return ty >= height - BEDROCK_ROWS;
}

export function isBedrockRowWorld(world: Pick<WorldState, 'height'>, ty: number): boolean {
  return isBedrockRow(ty, worldHeight(world));
}

export function isWithinReach(
  player: PlayerContext,
  tx: number,
  ty: number,
  reachTiles = MAX_REACH_TILES
): boolean {
  const pw = player.width ?? PLAYER_WIDTH;
  const ph = player.height ?? PLAYER_HEIGHT;
  const pcx = (player.x + pw * 0.5) / TILE_SIZE;
  const pcy = (player.y + ph * 0.5) / TILE_SIZE;
  const nearestX = Math.max(tx, Math.min(tx + 1, pcx));
  const nearestY = Math.max(ty, Math.min(ty + 1, pcy));
  const dist = Math.hypot(nearestX - pcx, nearestY - pcy);
  return dist <= reachTiles;
}

export function playerOverlapsTile(player: PlayerContext, tx: number, ty: number): boolean {
  const pw = player.width ?? PLAYER_WIDTH;
  const ph = player.height ?? PLAYER_HEIGHT;
  const left = tx * TILE_SIZE;
  const right = left + TILE_SIZE;
  const top = ty * TILE_SIZE;
  const bottom = top + TILE_SIZE;
  return player.x < right && player.x + pw > left && player.y < bottom && player.y + ph > top;
}

export function getCoveringAreaLock(world: WorldState, tx: number, ty: number): AreaLockRecord | null {
  const locks = world.areaLocks;
  if (!locks) return null;
  for (const key in locks) {
    const lock = locks[key];
    const r = lock.radius ?? 3;
    if (Math.abs(tx - lock.x) <= r && Math.abs(ty - lock.y) <= r) {
      return lock;
    }
  }
  return null;
}

export function hasAreaLockConflict(world: WorldState, tx: number, ty: number, radius = 3): boolean {
  const locks = world.areaLocks;
  if (!locks) return false;
  for (const key in locks) {
    const lock = locks[key];
    const r = lock.radius ?? 3;
    if (Math.abs(tx - lock.x) <= r + radius && Math.abs(ty - lock.y) <= r + radius) {
      return true;
    }
  }
  return false;
}

export function getCoveringShareLock(world: WorldState, tx: number, ty: number): ShareLockRecord | null {
  for (const lock of Object.values(world.shareLocks ?? {})) {
    if (tx >= lock.x && tx < lock.x + lock.width && ty >= lock.y && ty < lock.y + lock.height) {
      return lock;
    }
  }
  return null;
}

export function hasShareLockConflict(
  world: WorldState, x: number, y: number, width: number, height: number
): boolean {
  return Object.values(world.shareLocks ?? {}).some((lock) =>
    rectanglesOverlap(x, y, width, height, lock.x, lock.y, lock.width, lock.height)
  );
}

export function hasEditPermission(
  world: WorldState,
  playerId: string,
  tx?: number,
  ty?: number,
  permission: ShareLockPermissionKey = 'build'
): boolean {
  if (world.worldLock?.ownerId === playerId) return true;
  if (world.worldLock?.editors?.includes(playerId)) return true;
  if (typeof tx === 'number' && typeof ty === 'number') {
    const lock = getCoveringShareLock(world, tx, ty);
    if (lock) {
      const access = lock.access?.[playerId];
      return Boolean(access?.permissions?.[permission] ?? DEFAULT_SHARE_LOCK_PERMISSIONS[permission]);
    }
  }
  return !world.worldLock;
}

export function canEnterWorld(world: WorldState, playerId: string): { ok: boolean; reason?: string } {
  if (!world.worldLock || world.worldLock.publicAccess || world.worldLock.ownerId === playerId ||
      world.worldLock.editors?.includes(playerId)) return { ok: true };
  const hasShareAccess = Object.values(world.shareLocks ?? {}).some((lock) => Boolean(lock.access?.[playerId]));
  if (hasShareAccess) return { ok: true };
  return { ok: false, reason: `World ${world.name} is private. Ask its owner for Share Lock access.` };
}

export function canBreakTile(
  world: WorldState,
  player: PlayerContext,
  tx: number,
  ty: number,
  reachTiles = MAX_REACH_TILES
): { ok: boolean; layer?: 'fg' | 'bg' | 'plant' | 'fluid'; reason?: string } {
  if (isSystemWorld(world.name)) return { ok: false, reason: 'System worlds are indestructible.' };
  if (!inBoundsWorld(world, tx, ty)) return { ok: false, reason: 'Out of world bounds.' };
  if (isBedrockRowWorld(world, ty)) return { ok: false, reason: 'Bedrock is indestructible.' };
  if (!isWithinReach(player, tx, ty, reachTiles)) return { ok: false, reason: 'Target out of reach.' };
  if (!hasEditPermission(world, player.id, tx, ty, 'break')) {
    return { ok: false, reason: 'Protected by Lock.' };
  }

  const key = `${tx},${ty}`;
  if (world.plants[key]) {
    return { ok: true, layer: 'plant' };
  }

  const idx = tileIndexIn(world, tx, ty);
  const fgId = world.fg[idx];
  if (fgId !== ITEM_IDS.AIR) {
    const def = getItemDef(fgId);
    if (!def || !def.breakable) {
      return { ok: false, reason: `${def?.name ?? 'Tile'} cannot be broken.` };
    }
    if (fgId === ITEM_IDS.WORLD_LOCK && world.worldLock && world.worldLock.ownerId !== player.id) {
      return { ok: false, reason: 'Only the World Lock owner can remove this lock.' };
    }
    if (fgId === ITEM_IDS.SMALL_LOCK) {
      const areaLock = world.areaLocks?.[key];
      if (areaLock && areaLock.ownerId !== player.id) {
        return { ok: false, reason: 'Only the Area Lock owner can remove this lock.' };
      }
    }
    if (fgId === ITEM_IDS.VENDING_MACHINE) {
      const vm = world.vendingMachines?.[key];
      if (vm && vm.ownerId !== player.id && world.worldLock?.ownerId !== player.id) {
        return { ok: false, reason: 'Only the Vending Machine owner can break it.' };
      }
      if (vm && (vm.stockQty > 0 || vm.earningsQty > 0)) {
        return { ok: false, reason: 'Withdraw stock and earnings with Wrench before breaking.' };
      }
    }
    if (fgId === ITEM_IDS.BFG_COLLECTOR) {
      const bfg = world.bfgCollectors?.[key];
      if (bfg && bfg.ownerId !== player.id && world.worldLock?.ownerId !== player.id) {
        return { ok: false, reason: 'Only the BFG Collector owner can break it.' };
      }
      if (bfg && (bfg.storedGems > 0 || bfg.storedItems.length > 0)) {
        return { ok: false, reason: 'Withdraw stored Gems & items with Wrench before breaking.' };
      }
    }
    return { ok: true, layer: 'fg' };
  }

  // Allow draining fluid tile directly when fg is air
  if ((world.fluidLevel?.[idx] ?? 0) > 0 && (world.fluidType?.[idx] ?? 0) > 0) {
    return { ok: true, layer: 'fluid' };
  }

  const bgId = world.bg[idx];
  if (bgId !== ITEM_IDS.BG_SKY) {
    const bgDef = getItemDef(bgId);
    if (!bgDef || !bgDef.breakable) {
      return { ok: false, reason: 'Background cannot be broken.' };
    }
    return { ok: true, layer: 'bg' };
  }

  return { ok: false, reason: 'Nothing to break here.' };
}

export function hasPlacementSupport(world: WorldState, tx: number, ty: number): boolean {
  const idx = tileIndexIn(world, tx, ty);
  if (world.bg[idx] !== ITEM_IDS.BG_SKY) return true;
  const neighbors = [
    [tx - 1, ty],
    [tx + 1, ty],
    [tx, ty - 1],
    [tx, ty + 1],
  ];
  for (const [nx, ny] of neighbors) {
    if (!inBoundsWorld(world, nx, ny)) continue;
    const nIdx = tileIndexIn(world, nx, ny);
    if (world.fg[nIdx] !== ITEM_IDS.AIR || world.bg[nIdx] !== ITEM_IDS.BG_SKY) {
      return true;
    }
  }
  return false;
}

export function canPlaceTile(
  world: WorldState,
  player: PlayerContext,
  itemId: number,
  tx: number,
  ty: number,
  reachTiles = MAX_REACH_TILES
): { ok: boolean; layer?: 'fg' | 'bg' | 'seed' | 'fluid'; reason?: string } {
  if (isSystemWorld(world.name)) return { ok: false, reason: 'System worlds do not allow block placement.' };
  if (!inBoundsWorld(world, tx, ty)) return { ok: false, reason: 'Out of bounds.' };
  if (isBedrockRowWorld(world, ty)) return { ok: false, reason: 'Cannot build on bedrock.' };
  if (!isWithinReach(player, tx, ty, reachTiles)) return { ok: false, reason: 'Target out of reach.' };
  if (!hasEditPermission(world, player.id, tx, ty, 'build')) {
    return { ok: false, reason: 'Protected by Lock.' };
  }

  const def = getItemDef(itemId);
  if (!def || !def.placeable) return { ok: false, reason: 'Item cannot be placed.' };

  const idx = tileIndexIn(world, tx, ty);
  const isMine = world.worldKind === 'mine_shaft';

  if (def.category === 'background') {
    if (world.bg[idx] !== ITEM_IDS.BG_SKY) {
      return { ok: false, reason: 'Background tile already occupied.' };
    }
    if (!hasPlacementSupport(world, tx, ty)) {
      return { ok: false, reason: 'Needs adjacent tile or background support.' };
    }
    return { ok: true, layer: 'bg' };
  }

  if (def.category === 'seed') {
    if (isMine) {
      return { ok: false, reason: 'Trees cannot be planted inside Mining Shafts.' };
    }
    if (world.fg[idx] !== ITEM_IDS.AIR || world.plants[`${tx},${ty}`]) {
      return { ok: false, reason: 'Tile is occupied.' };
    }
    if (ty + 1 >= worldHeight(world)) return { ok: false, reason: 'Cannot plant here.' };
    const belowId = world.fg[tileIndexIn(world, tx, ty + 1)];
    if (!isForegroundSolid(belowId)) {
      return { ok: false, reason: 'Seeds must be planted on solid ground.' };
    }
    return { ok: true, layer: 'seed' };
  }

  if (def.category === 'fluid') {
    if (world.fg[idx] !== ITEM_IDS.AIR || world.plants[`${tx},${ty}`]) {
      return { ok: false, reason: 'Tile is occupied.' };
    }
    return { ok: true, layer: 'fluid' };
  }

  // Foreground / Lock / Interactive
  if (world.fg[idx] !== ITEM_IDS.AIR || world.plants[`${tx},${ty}`]) {
    return { ok: false, reason: 'Foreground tile already occupied.' };
  }

  if (def.collision === 'solid' && playerOverlapsTile(player, tx, ty)) {
    return { ok: false, reason: 'Cannot place solid block on yourself.' };
  }

  if (isMine && (def.category === 'lock' || def.category === 'interactive')) {
    return { ok: false, reason: 'Locks and machines cannot be placed inside Mining Shafts.' };
  }

  if (itemId === ITEM_IDS.WORLD_LOCK || itemId === ITEM_IDS.SMALL_LOCK) {
    return { ok: false, reason: 'Legacy locks have been retired. Use a Share Lock in a world you own.' };
  }

  const shareSpec = getShareLockSpec(itemId);
  if (shareSpec) {
    if (world.worldLock?.ownerId !== player.id) {
      return { ok: false, reason: 'Share Locks can only be placed in a world you own.' };
    }
    if (tx + shareSpec.width > worldWidth(world) || ty + shareSpec.height > worldHeight(world) - BEDROCK_ROWS) {
      return { ok: false, reason: 'The Share Lock area must fit inside the buildable world.' };
    }
    if (hasShareLockConflict(world, tx, ty, shareSpec.width, shareSpec.height)) {
      return { ok: false, reason: 'Share Lock areas cannot overlap.' };
    }
  }

  if (itemId === ITEM_IDS.BFG_COLLECTOR) {
    const hasProtection = hasEditPermission(world, player.id, tx, ty, 'interact');
    if (!hasProtection) {
      return { ok: false, reason: 'BFG Collector must be placed inside your World Lock or Area Lock.' };
    }
  }

  if (!hasPlacementSupport(world, tx, ty)) {
    return { ok: false, reason: 'Needs adjacent block or wall support.' };
  }

  return { ok: true, layer: 'fg' };
}

export type GrowthStage = 'planted' | 'sprout' | 'young' | 'developing' | 'mature';

export function getPlantGrowthState(
  plant: PlantedTree,
  nowMs: number
): { stage: GrowthStage; progress: number; remainingMs: number } {
  const total = Math.max(1000, plant.maturityAt - plant.plantedAt || PLANT_DEFAULT_GROWTH_MS);
  const elapsed = Math.max(0, nowMs - plant.plantedAt);
  const progress = Math.min(1, elapsed / total);
  const remainingMs = Math.max(0, total - elapsed);
  if (progress >= 1) return { stage: 'mature', progress: 1, remainingMs: 0 };
  if (progress >= 0.6) return { stage: 'developing', progress, remainingMs };
  if (progress >= 0.3) return { stage: 'young', progress, remainingMs };
  if (progress >= 0.1) return { stage: 'sprout', progress, remainingMs };
  return { stage: 'planted', progress, remainingMs };
}

export function resolveSplice(seedA: number, seedB: number): number | null {
  for (const recipe of SPLICE_RECIPES) {
    if (
      (recipe.seedA === seedA && recipe.seedB === seedB) ||
      (recipe.seedA === seedB && recipe.seedB === seedA)
    ) {
      return recipe.resultSeedId;
    }
  }
  return null;
}

const RESERVED_WORLDS = new Set(['ADMIN', 'SYSTEM', 'API', 'LOGIN', 'NULL', 'UNDEFINED']);

export function normalizeWorldName(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function validateWorldName(raw: string): { ok: boolean; normalized: string; reason?: string } {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return { ok: false, normalized: '', reason: 'World name must be 2–20 characters.' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { ok: false, normalized: '', reason: 'Use only letters, numbers, - or _.' };
  }
  const normalized = trimmed.toUpperCase();
  if (RESERVED_WORLDS.has(normalized)) {
    return { ok: false, normalized: '', reason: 'That world name is reserved.' };
  }
  return { ok: true, normalized };
}

export function xpForNextLevel(level: number): number {
  return 50 + (level - 1) * 35;
}

export function addXp(
  level: number,
  xp: number,
  gained: number
): { level: number; xp: number; leveledUp: boolean } {
  let curLevel = Math.max(1, level);
  let curXp = Math.max(0, xp) + Math.max(0, gained);
  let leveledUp = false;
  while (curXp >= xpForNextLevel(curLevel)) {
    curXp -= xpForNextLevel(curLevel);
    curLevel += 1;
    leveledUp = true;
  }
  return { level: curLevel, xp: curXp, leveledUp };
}
