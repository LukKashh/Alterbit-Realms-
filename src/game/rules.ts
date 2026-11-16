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
import { getCropSpec, getFarmableSpec, getItemDef, isCropSeed, isFarmableSeed, ITEM_IDS, SPLICE_RECIPES } from './catalog.ts';
import type { AreaLockRecord, PlantedTree, WorldState, ShareLockRecord } from './worldGen.ts';
import { getShareLockSpec, rectanglesOverlap, type ShareLockPermissionKey } from './shareLocks.ts';
import { isSystemWorld } from './expansion.ts';
import {
  getActiveDatasetConfig,
  resolveDatasetLevelRequirement,
  type DatasetProgressionCurve,
} from './config.ts';

export interface PlayerContext {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  adminWorldEdit?: boolean;
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
      return Boolean(access && access.permissions?.[permission] === true);
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

export function getMarketStandAt(
  world: WorldState,
  tx: number,
  ty: number
): { kind: 'landlord' | 'greens_vendor'; anchorX: number; anchorY: number; itemId: number } | null {
  if (!inBoundsWorld(world, tx, ty)) return null;
  // Each 3x2 market stand is anchored at (anchorX, anchorY) on the bottom-center tile,
  // spanning [anchorX - 1 .. anchorX + 1] horizontally and [anchorY - 1 .. anchorY] vertically.
  for (let dy = 0; dy <= 1; dy++) {
    const ay = ty + dy;
    for (let dx = -1; dx <= 1; dx++) {
      const ax = tx - dx;
      if (!inBoundsWorld(world, ax, ay)) continue;
      const fgId = world.fg[tileIndexIn(world, ax, ay)];
      if (fgId === ITEM_IDS.LANDLORD_NPC) {
        return { kind: 'landlord', anchorX: ax, anchorY: ay, itemId: ITEM_IDS.LANDLORD_NPC };
      }
      if (fgId === ITEM_IDS.GREENS_VENDOR_NPC) {
        return { kind: 'greens_vendor', anchorX: ax, anchorY: ay, itemId: ITEM_IDS.GREENS_VENDOR_NPC };
      }
    }
  }
  return null;
}

export function getPixobyteDigichangeAt(
  world: WorldState,
  tx: number,
  ty: number
): { anchorX: number; topY: number; bottomY: number } | null {
  if (!inBoundsWorld(world, tx, ty)) return null;
  const idx = tileIndexIn(world, tx, ty);
  const isHere =
    world.bg[idx] === ITEM_IDS.PIXOBYTE_DIGICHANGE ||
    world.fg[idx] === ITEM_IDS.PIXOBYTE_DIGICHANGE;
  if (!isHere) return null;

  // Check if tile above is also part of the 1x2 vertical terminal
  if (inBoundsWorld(world, tx, ty - 1)) {
    const aboveIdx = tileIndexIn(world, tx, ty - 1);
    if (
      world.bg[aboveIdx] === ITEM_IDS.PIXOBYTE_DIGICHANGE ||
      world.fg[aboveIdx] === ITEM_IDS.PIXOBYTE_DIGICHANGE
    ) {
      return { anchorX: tx, topY: ty - 1, bottomY: ty };
    }
  }
  // Check if tile below is part of the 1x2 vertical terminal
  if (inBoundsWorld(world, tx, ty + 1)) {
    const belowIdx = tileIndexIn(world, tx, ty + 1);
    if (
      world.bg[belowIdx] === ITEM_IDS.PIXOBYTE_DIGICHANGE ||
      world.fg[belowIdx] === ITEM_IDS.PIXOBYTE_DIGICHANGE
    ) {
      return { anchorX: tx, topY: ty, bottomY: ty + 1 };
    }
  }
  // Fallback if single tile placed: span (ty - 1 .. ty)
  const topY = Math.max(0, ty - 1);
  return { anchorX: tx, topY, bottomY: ty };
}

export function isIndestructiblePregenTile(world: WorldState, tx: number, ty: number): boolean {
  if (!world.isPersonalRealm) return false;
  const sx = world.spawnX;
  const sy = world.spawnY; // 19 (groundY = 20)
  // Lower 5-wide Starting Platform at groundY (sy + 1)
  if (ty === sy + 1 && Math.abs(tx - sx) <= 2) return true;
  // Entrance Portal tile (sx, sy) and 1-tile headroom directly above it (sx, sy - 1)
  if (tx === sx && (ty === sy || ty === sy - 1)) return true;
  // Upper 5-wide WorldCore Platform at groundY - 4 (sy - 3)
  if (ty === sy - 3 && Math.abs(tx - sx) <= 2) return true;
  return false;
}

export function isDoorBlock(itemId: number): boolean {
  return (
    itemId === ITEM_IDS.GP_DOOR ||
    itemId === ITEM_IDS.GP_DUNGEON_DOOR ||
    itemId === ITEM_IDS.SCIFI_AIRLOCK_DOOR
  );
}

export function canPlowTile(
  world: WorldState,
  player: PlayerContext,
  tx: number,
  ty: number,
  reachTiles = MAX_REACH_TILES
): { ok: boolean; reason?: string } {
  const adminEdit = Boolean(player.adminWorldEdit);
  if (isSystemWorld(world.name) && !adminEdit) {
    return { ok: false, reason: 'System worlds cannot be plowed.' };
  }
  if (!inBoundsWorld(world, tx, ty)) return { ok: false, reason: 'Out of world bounds.' };
  if (isBedrockRowWorld(world, ty)) return { ok: false, reason: 'Cannot plow bedrock.' };
  if (!adminEdit && isIndestructiblePregenTile(world, tx, ty)) {
    return { ok: false, reason: 'Pregenerated foundation is indestructible.' };
  }
  if (!isWithinReach(player, tx, ty, reachTiles)) return { ok: false, reason: 'Target out of reach.' };
  if (!adminEdit && !hasEditPermission(world, player.id, tx, ty, 'build')) {
    return { ok: false, reason: 'Protected by Lock.' };
  }
  const idx = tileIndexIn(world, tx, ty);
  const fgId = world.fg[idx];
  if (fgId === ITEM_IDS.PLOWED_DIRT_SOIL) {
    return { ok: false, reason: 'This Dirt Soil is already plowed and ready for Crop Seeds.' };
  }
  if (fgId !== ITEM_IDS.GP_DIRT) {
    return { ok: false, reason: 'Farming Hoe can only plow Dirt Soil blocks.' };
  }
  if (ty > 0) {
    const aboveIdx = tileIndexIn(world, tx, ty - 1);
    if (world.fg[aboveIdx] !== ITEM_IDS.AIR || world.plants[`${tx},${ty - 1}`]) {
      return { ok: false, reason: 'Clear the tile above Dirt Soil before plowing.' };
    }
  }
  return { ok: true };
}

export function canBreakTile(
  world: WorldState,
  player: PlayerContext,
  tx: number,
  ty: number,
  reachTiles = MAX_REACH_TILES
): { ok: boolean; layer?: 'fg' | 'bg' | 'plant' | 'fluid'; reason?: string } {
  const adminEdit = Boolean(player.adminWorldEdit);
  if (isSystemWorld(world.name) && !adminEdit) return { ok: false, reason: 'System worlds are indestructible.' };
  if (!inBoundsWorld(world, tx, ty)) return { ok: false, reason: 'Out of world bounds.' };
  if (adminEdit ? ty >= worldHeight(world) - 1 : isBedrockRowWorld(world, ty)) {
    return { ok: false, reason: 'Bedrock is indestructible.' };
  }
  if (!adminEdit && isIndestructiblePregenTile(world, tx, ty)) {
    return { ok: false, reason: 'Pregenerated foundation is indestructible.' };
  }
  if (!isWithinReach(player, tx, ty, reachTiles)) return { ok: false, reason: 'Target out of reach.' };
  if (!adminEdit && !hasEditPermission(world, player.id, tx, ty, 'break')) {
    return { ok: false, reason: 'Protected by Lock.' };
  }
  if (!adminEdit && getMarketStandAt(world, tx, ty)) {
    return { ok: false, reason: 'This market stand cannot be broken.' };
  }

  const key = `${tx},${ty}`;
  if (world.plants[key]) {
    return { ok: true, layer: 'plant' };
  }

  const idx = tileIndexIn(world, tx, ty);
  const fgId = world.fg[idx];
  if (fgId !== ITEM_IDS.AIR) {
    if (!adminEdit) {
      if (
        fgId === ITEM_IDS.WORLD_CORE ||
        fgId === ITEM_IDS.LANDLORD_NPC ||
        fgId === ITEM_IDS.GREENS_VENDOR_NPC
      ) {
        return { ok: false, reason: 'This special world object cannot be broken.' };
      }
      if (fgId === ITEM_IDS.STARTER_LOOTBOX) {
        if (!world.worldLock || world.worldLock.ownerId !== player.id) {
          return { ok: false, reason: 'Only the World Owner can open the Starter Supply Lootbox.' };
        }
      }
      if (fgId === ITEM_IDS.WORLD_LOCK || fgId === ITEM_IDS.SMALL_LOCK) {
        return { ok: false, reason: 'Legacy lock items have been retired.' };
      }
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
      if (fgId === ITEM_IDS.VAULTBOX) {
        const vault = world.vaultboxes?.[key];
        if (vault && vault.ownerId !== player.id) {
          return { ok: false, reason: 'Only the Vaultbox owner can break it.' };
        }
        if (vault && vault.slots.some((s) => s !== null && s.qty > 0)) {
          return { ok: false, reason: 'Empty all Vaultbox storage slots with Wrench before breaking.' };
        }
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
    if (!adminEdit && bgId === ITEM_IDS.STONE_FURNACE) {
      return { ok: false, reason: 'WorldCore Furnace is permanently fused to the WorldCore.' };
    }
    const bgDef = getItemDef(bgId);
    if (!adminEdit && (!bgDef || !bgDef.breakable)) {
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
  const adminEdit = Boolean(player.adminWorldEdit);
  if (isSystemWorld(world.name) && !adminEdit) return { ok: false, reason: 'System worlds do not allow block placement.' };
  if (!inBoundsWorld(world, tx, ty)) return { ok: false, reason: 'Out of bounds.' };
  if (adminEdit ? ty >= worldHeight(world) - 1 : isBedrockRowWorld(world, ty)) {
    return { ok: false, reason: 'Cannot build on bedrock.' };
  }
  if (!adminEdit && isIndestructiblePregenTile(world, tx, ty)) {
    return { ok: false, reason: 'Pregenerated foundation space is protected.' };
  }
  if (!isWithinReach(player, tx, ty, reachTiles)) return { ok: false, reason: 'Target out of reach.' };
  if (!adminEdit && !hasEditPermission(world, player.id, tx, ty, 'build')) {
    return { ok: false, reason: 'Protected by Lock.' };
  }

  if (!adminEdit && getMarketStandAt(world, tx, ty)) {
    return { ok: false, reason: 'Market stand space is reserved.' };
  }
  if (
    !adminEdit &&
    (itemId === ITEM_IDS.WORLD_CORE ||
      itemId === ITEM_IDS.LANDLORD_NPC ||
      itemId === ITEM_IDS.GREENS_VENDOR_NPC)
  ) {
    return { ok: false, reason: 'This special world object cannot be placed.' };
  }
  const def = getItemDef(itemId);
  if (
    !def ||
    (!def.placeable &&
      !(
        adminEdit &&
        itemId !== ITEM_IDS.AIR &&
        (def.category === 'foreground' ||
          def.category === 'background' ||
          def.category === 'interactive' ||
          def.category === 'seed' ||
          def.category === 'fluid')
      ))
  ) {
    return { ok: false, reason: 'Item cannot be placed.' };
  }

  const idx = tileIndexIn(world, tx, ty);
  const isMine = world.worldKind === 'mine_shaft';

  if (def.category === 'background') {
    if (world.bg[idx] !== ITEM_IDS.BG_SKY && !adminEdit) {
      return { ok: false, reason: 'Background tile already occupied.' };
    }
    if (!adminEdit && !hasPlacementSupport(world, tx, ty)) {
      return { ok: false, reason: 'Needs adjacent tile or background support.' };
    }
    return { ok: true, layer: 'bg' };
  }

  if (def.category === 'seed') {
    if (isMine) {
      return { ok: false, reason: 'Seeds cannot be planted inside Mining Shafts.' };
    }
    const potKey = `${tx},${ty}`;
    const existingPlant = world.plants[potKey];
    if (existingPlant) {
      return {
        ok: false,
        reason:
          Date.now() >= existingPlant.maturityAt
            ? 'Plant is already mature! Harvest it before planting.'
            : 'A seed is already growing on this tile.',
      };
    }

    if (isCropSeed(itemId)) {
      if (world.fg[idx] !== ITEM_IDS.AIR) {
        return { ok: false, reason: 'Crop Seeds must be sown into an empty tile directly above Plowed Dirt Soil.' };
      }
      const hasPlowedGround =
        ty + 1 < worldHeight(world) &&
        world.fg[tileIndexIn(world, tx, ty + 1)] === ITEM_IDS.PLOWED_DIRT_SOIL;
      if (!adminEdit && !hasPlowedGround) {
        return {
          ok: false,
          reason: 'Crop Seeds require Dirt Soil beneath that has been plowed with a Farming Hoe.',
        };
      }
      return { ok: true, layer: 'seed' };
    }

    if (!adminEdit && !isFarmableSeed(itemId)) {
      return { ok: false, reason: 'Only Farmable Seeds or Crop Seeds can be planted.' };
    }
    const hasPot = world.fg[idx] === ITEM_IDS.SEED_POT || Boolean(world.seedPots?.[potKey]);
    if (!adminEdit && !hasPot) {
      return { ok: false, reason: 'Place a Seed Pot first before planting.' };
    }
    if (world.fg[idx] !== ITEM_IDS.AIR && world.fg[idx] !== ITEM_IDS.SEED_POT) {
      return { ok: false, reason: 'Tile is occupied.' };
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
  if (!adminEdit && world.bg[idx] === ITEM_IDS.STONE_FURNACE) {
    return { ok: false, reason: 'Space in front of WorldCore Furnace must remain clear.' };
  }

  if (!adminEdit && def.collision === 'solid' && playerOverlapsTile(player, tx, ty)) {
    return { ok: false, reason: 'Cannot place solid block on yourself.' };
  }

  if (isMine && (def.category === 'lock' || def.category === 'interactive')) {
    return { ok: false, reason: 'Locks and machines cannot be placed inside Mining Shafts.' };
  }

  const isMatteragen = itemId >= ITEM_IDS.MATTERAGEN_BOTANICAL && itemId <= ITEM_IDS.MATTERAGEN_COSMIC;
  if (isMatteragen && !adminEdit) {
    if (isMine || isSystemWorld(world.name)) {
      return { ok: false, reason: 'Matteragen Engines can only be placed in personal realms.' };
    }
    const currentEngines = Object.keys(world.matteragenEngines || {}).length;
    if (currentEngines >= 20) {
      return { ok: false, reason: 'Maximum limit of 20 Matteragen Engines reached for this world.' };
    }
  }

  if (itemId === ITEM_IDS.WORLD_LOCK || itemId === ITEM_IDS.SMALL_LOCK) {
    return { ok: false, reason: 'Legacy locks have been retired. Use a Share Lock in a world you own.' };
  }

  const shareSpec = getShareLockSpec(itemId);
  if (shareSpec && !adminEdit) {
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

  if (itemId === ITEM_IDS.BFG_COLLECTOR && !adminEdit) {
    const hasProtection = Boolean(world.worldLock && hasEditPermission(world, player.id, tx, ty, 'interact'));
    if (!hasProtection) {
      return { ok: false, reason: 'BFG Collector must be placed inside an owned realm or Share Lock.' };
    }
  }

  if (!adminEdit && !hasPlacementSupport(world, tx, ty)) {
    return { ok: false, reason: 'Needs adjacent block or wall support.' };
  }

  return { ok: true, layer: 'fg' };
}

export type GrowthStage = 'planted' | 'sprout' | 'young' | 'developing' | 'mature';

export function getPlantGrowthState(
  plant: PlantedTree,
  nowMs: number
): { stage: GrowthStage; progress: number; remainingMs: number } {
  if (nowMs >= plant.maturityAt) {
    return { stage: 'mature', progress: 1, remainingMs: 0 };
  }
  const total = Math.max(1000, plant.maturityAt - plant.plantedAt || PLANT_DEFAULT_GROWTH_MS);
  const elapsed = Math.max(0, nowMs - plant.plantedAt);
  const progress = Math.min(1, elapsed / total);
  const remainingMs = Math.max(0, plant.maturityAt - Math.max(nowMs, plant.plantedAt));
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

export function xpForNextLevel(level: number, curve?: DatasetProgressionCurve): number {
  const active = curve ?? getActiveDatasetConfig().playerMainXp;
  return resolveDatasetLevelRequirement(active, level);
}

export function addXp(
  level: number,
  xp: number,
  gained: number,
  curve?: DatasetProgressionCurve
): { level: number; xp: number; leveledUp: boolean } {
  const active = curve ?? getActiveDatasetConfig().playerMainXp;
  const maxLvl = Math.max(5, active?.maxLevel ?? 100);
  let curLevel = Math.max(1, level);
  let curXp = Math.max(0, xp) + Math.max(0, gained);
  let leveledUp = false;
  while (curLevel < maxLvl && curXp >= xpForNextLevel(curLevel, active)) {
    curXp -= xpForNextLevel(curLevel, active);
    curLevel += 1;
    leveledUp = true;
  }
  return { level: curLevel, xp: curXp, leveledUp };
}

export function worldXpForNextLevel(level: number, curve?: DatasetProgressionCurve): number {
  const active = curve ?? getActiveDatasetConfig().worldCoreXp;
  return resolveDatasetLevelRequirement(active, level);
}

export function addWorldXp(
  level: number,
  xp: number,
  gained: number,
  curve?: DatasetProgressionCurve
): { level: number; xp: number; leveledUp: boolean } {
  const active = curve ?? getActiveDatasetConfig().worldCoreXp;
  const maxLvl = Math.max(5, active?.maxLevel ?? 50);
  let curLevel = Math.max(1, level);
  let curXp = Math.max(0, xp) + Math.max(0, gained);
  let leveledUp = false;
  while (curLevel < maxLvl && curXp >= worldXpForNextLevel(curLevel, active)) {
    curXp -= worldXpForNextLevel(curLevel, active);
    curLevel += 1;
    leveledUp = true;
  }
  return { level: curLevel, xp: curXp, leveledUp };
}

export function masteryXpForNextLevel(
  level: number,
  kindOrCurve?: 'crop' | 'farmablock' | DatasetProgressionCurve
): number {
  const ds = getActiveDatasetConfig();
  const active =
    typeof kindOrCurve === 'object' && kindOrCurve !== null
      ? kindOrCurve
      : kindOrCurve === 'farmablock'
        ? ds.farmablockMastery
        : ds.cropMastery;
  return resolveDatasetLevelRequirement(active, level);
}

export function addMasteryXp(
  level: number,
  xp: number,
  gained: number,
  kindOrCurve?: 'crop' | 'farmablock' | DatasetProgressionCurve
): { level: number; xp: number; leveledUp: boolean } {
  const ds = getActiveDatasetConfig();
  const active =
    typeof kindOrCurve === 'object' && kindOrCurve !== null
      ? kindOrCurve
      : kindOrCurve === 'farmablock'
        ? ds.farmablockMastery
        : ds.cropMastery;
  const maxLvl = Math.max(5, active?.maxLevel ?? 50);
  let curLevel = Math.max(1, level);
  let curXp = Math.max(0, xp) + Math.max(0, gained);
  let leveledUp = false;
  while (curLevel < maxLvl && curXp >= masteryXpForNextLevel(curLevel, active)) {
    curXp -= masteryXpForNextLevel(curLevel, active);
    curLevel += 1;
    leveledUp = true;
  }
  return { level: curLevel, xp: curXp, leveledUp };
}

const CROP_MASTERY_UNLOCKS: Record<number, number> = {
  [ITEM_IDS.CROP_SEED_RADISH]: 1,
  [ITEM_IDS.CROP_SEED_CARROT]: 1,
  [ITEM_IDS.CROP_SEED_CABBAGE]: 2,
  [ITEM_IDS.CROP_SEED_TOMATO]: 3,
  [ITEM_IDS.CROP_SEED_CORN]: 5,
  [ITEM_IDS.CROP_SEED_MELON]: 7,
};

export function getCropMasteryRequiredLevel(itemId: number): number {
  const spec = getCropSpec(itemId);
  const seedId = spec?.seedId ?? itemId;
  const custom = getActiveDatasetConfig().cropMastery?.unlockLevelOverrides?.[seedId];
  if (typeof custom === 'number' && Number.isFinite(custom) && custom >= 1) {
    return Math.round(custom);
  }
  return CROP_MASTERY_UNLOCKS[seedId] ?? 1;
}

const FARMABLE_TIER_MASTERY_UNLOCKS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
  8: 13,
};

export function getFarmableMasteryRequiredLevel(itemId: number): number {
  const spec = getFarmableSpec(itemId);
  if (!spec) return 1;
  const custom = getActiveDatasetConfig().farmablockMastery?.unlockLevelOverrides?.[spec.tier];
  if (typeof custom === 'number' && Number.isFinite(custom) && custom >= 1) {
    return Math.round(custom);
  }
  return FARMABLE_TIER_MASTERY_UNLOCKS[spec.tier] ?? 1;
}

export function getInventorySortRank(itemId: number): number {
  if (itemId === ITEM_IDS.FIST) return 0;
  if (itemId === ITEM_IDS.WRENCH) return 1;
  const def = getItemDef(itemId);
  if (!def) return 999;
  if (def.category === 'tool') return 10;
  if (def.category === 'lock' || isDoorBlock(itemId)) return 20;
  if (itemId === ITEM_IDS.SEED_POT) return 30;
  if (def.category === 'interactive') return 25;
  if (def.category === 'seed') return 35;
  if (def.category === 'farmable' || Boolean(def.farmableTier)) return 40;
  if (def.cropSellAlterbits !== undefined || def.key.startsWith('crop_')) return 45;
  if (def.category === 'foreground') return 50;
  if (def.category === 'background') return 60;
  if (def.category === 'material') return 70;
  if (def.category === 'fluid') return 75;
  if (def.category === 'consumable') return 80;
  if (def.category === 'wearable') return 90;
  return 95;
}

export function sortInventorySlots<T extends { itemId: number; rodUpgradeLevel?: number }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => {
    const rankDiff = getInventorySortRank(a.itemId) - getInventorySortRank(b.itemId);
    if (rankDiff !== 0) return rankDiff;
    const defA = getItemDef(a.itemId);
    const defB = getItemDef(b.itemId);
    const tierDiff = (defA?.farmableTier ?? 0) - (defB?.farmableTier ?? 0);
    if (tierDiff !== 0) return tierDiff;
    if (a.itemId !== b.itemId) return a.itemId - b.itemId;
    return (b.rodUpgradeLevel ?? 0) - (a.rodUpgradeLevel ?? 0);
  });
}


