import { isForegroundSolid, ITEM_IDS } from './catalog.ts';
import type { WorldState } from './worldGen.ts';

export interface FluidDelta {
  tx: number;
  ty: number;
  fluidType: number;
  fluidLevel: number;
}

export interface LiquidPoolInfo {
  fluidType: 0 | 1 | 2;
  poolSize: number;
  minY: number;
  maxY: number;
  depth: number;
  depthTier: 'none' | 'shallow' | 'deep' | 'abyssal' | 'acid';
}

export function ensureFluidArrays(world: WorldState): {
  fluidType: number[];
  fluidLevel: number[];
} {
  const total = (world.width || 100) * (world.height || 60);
  if (!Array.isArray(world.fluidType) || world.fluidType.length !== total) {
    world.fluidType = new Array<number>(total).fill(0);
  }
  if (!Array.isArray(world.fluidLevel) || world.fluidLevel.length !== total) {
    world.fluidLevel = new Array<number>(total).fill(0);
  }
  return { fluidType: world.fluidType, fluidLevel: world.fluidLevel };
}

/**
 * Flood-fills the connected fluid pool starting at (startTx, startTy) to measure
 * pool depth (vertical span + connected volume) for Depth-Based Fishing.
 */
export function floodFillLiquidDepth(
  world: WorldState,
  startTx: number,
  startTy: number,
  maxScan = 450
): LiquidPoolInfo {
  const w = world.width || 100;
  const h = world.height || 60;
  if (startTx < 0 || startTx >= w || startTy < 0 || startTy >= h) {
    return { fluidType: 0, poolSize: 0, minY: startTy, maxY: startTy, depth: 0, depthTier: 'none' };
  }

  const { fluidType, fluidLevel } = ensureFluidArrays(world);
  const startIdx = startTy * w + startTx;
  let targetType = fluidType[startIdx];
  if (targetType === 0 || fluidLevel[startIdx] <= 0) {
    const fgId = world.fg[startIdx];
    if (fgId === ITEM_IDS.WATER_SOURCE) targetType = 1;
    else if (fgId === ITEM_IDS.ACID_SOURCE) targetType = 2;
    else {
      return { fluidType: 0, poolSize: 0, minY: startTy, maxY: startTy, depth: 0, depthTier: 'none' };
    }
  }

  const visited = new Set<number>([startIdx]);
  const queue: Array<[number, number]> = [[startTx, startTy]];
  let minY = startTy;
  let maxY = startTy;

  while (queue.length > 0 && visited.size < maxScan) {
    const [cx, cy] = queue.shift()!;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;

    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nIdx = ny * w + nx;
      if (visited.has(nIdx)) continue;
      const nFg = world.fg[nIdx];
      const matchesSource =
        (targetType === 1 && nFg === ITEM_IDS.WATER_SOURCE) ||
        (targetType === 2 && nFg === ITEM_IDS.ACID_SOURCE);
      if ((fluidType[nIdx] === targetType && fluidLevel[nIdx] > 0) || matchesSource) {
        visited.add(nIdx);
        queue.push([nx, ny]);
      }
    }
  }

  const verticalSpan = maxY - minY + 1;
  // Combine vertical depth and horizontal reservoir richness so both deep shafts & wide deep ponds reward better catches
  const depth = Math.max(verticalSpan, Math.floor(Math.sqrt(visited.size)));
  const fluidKind = (targetType === 2 ? 2 : 1) as 1 | 2;
  let depthTier: LiquidPoolInfo['depthTier'] = 'shallow';
  if (fluidKind === 2) {
    depthTier = 'acid';
  } else if (depth >= 9 || visited.size >= 40) {
    depthTier = 'abyssal';
  } else if (depth >= 4 || visited.size >= 14) {
    depthTier = 'deep';
  }

  return {
    fluidType: fluidKind,
    poolSize: visited.size,
    minY,
    maxY,
    depth,
    depthTier,
  };
}

/**
 * Budgeted cellular automata step for Water (1) and Acid (2) across levels 0..4.
 * Processes only dirty frontier coordinates and returns incremental deltas.
 */
export function stepFluidFrontier(
  world: WorldState,
  frontier: Set<string>,
  budget = 220
): FluidDelta[] {
  if (frontier.size === 0) return [];

  const w = world.width || 100;
  const h = world.height || 60;
  const { fluidType, fluidLevel } = ensureFluidArrays(world);
  const changedMap = new Map<string, FluidDelta>();

  const enqueueNeighbors = (tx: number, ty: number) => {
    for (const [nx, ny] of [
      [tx, ty],
      [tx - 1, ty],
      [tx + 1, ty],
      [tx, ty - 1],
      [tx, ty + 1],
    ]) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        frontier.add(`${nx},${ny}`);
      }
    }
  };

  const setFluidCell = (tx: number, ty: number, fType: number, fLevel: number) => {
    const idx = ty * w + tx;
    const clampedLevel = Math.max(0, Math.min(4, Math.floor(fLevel)));
    const nextType = clampedLevel > 0 ? fType : 0;
    if (fluidType[idx] === nextType && fluidLevel[idx] === clampedLevel) return false;
    fluidType[idx] = nextType;
    fluidLevel[idx] = clampedLevel;
    const key = `${tx},${ty}`;
    changedMap.set(key, { tx, ty, fluidType: nextType, fluidLevel: clampedLevel });
    enqueueNeighbors(tx, ty);
    return true;
  };

  let steps = 0;
  const batchKeys = Array.from(frontier);
  for (const key of batchKeys) {
    if (steps >= budget) break;
    frontier.delete(key);
    steps += 1;

    const [txStr, tyStr] = key.split(',');
    const tx = Number(txStr);
    const ty = Number(tyStr);
    if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || tx >= w || ty < 0 || ty >= h) {
      continue;
    }

    const idx = ty * w + tx;
    const fgId = world.fg[idx];

    // Source blocks act as infinite dispensers when uncovered
    if (fgId === ITEM_IDS.WATER_SOURCE || fgId === ITEM_IDS.ACID_SOURCE) {
      const srcType = fgId === ITEM_IDS.ACID_SOURCE ? 2 : 1;
      setFluidCell(tx, ty, srcType, 4);
      // Push down first, then sideways
      if (ty + 1 < h) {
        const belowFg = world.fg[(ty + 1) * w + tx];
        if (!isForegroundSolid(belowFg) && belowFg !== ITEM_IDS.WATER_SOURCE && belowFg !== ITEM_IDS.ACID_SOURCE) {
          const bLevel = fluidLevel[(ty + 1) * w + tx];
          if (bLevel < 4) {
            setFluidCell(tx, ty + 1, srcType, 4);
          }
        }
      }
      for (const nx of [tx - 1, tx + 1]) {
        if (nx < 0 || nx >= w) continue;
        const nIdx = ty * w + nx;
        if (!isForegroundSolid(world.fg[nIdx]) && fluidLevel[nIdx] < 3) {
          setFluidCell(nx, ty, srcType, 3);
        }
      }
      continue;
    }

    // Clear trapped liquid if a solid block occupies the cell
    if (isForegroundSolid(fgId)) {
      if (fluidLevel[idx] > 0) {
        setFluidCell(tx, ty, 0, 0);
      }
      continue;
    }

    const curType = fluidType[idx];
    const curLevel = fluidLevel[idx];
    if (curType === 0 || curLevel <= 0) continue;

    // 1. Fall downward if space below can accept fluid
    if (ty + 1 < h) {
      const belowIdx = (ty + 1) * w + tx;
      const belowFg = world.fg[belowIdx];
      if (!isForegroundSolid(belowFg)) {
        const belowType = fluidType[belowIdx];
        const belowLevel = fluidLevel[belowIdx];
        if (belowType === 0 || (belowType === curType && belowLevel < 4)) {
          const room = 4 - belowLevel;
          const transfer = Math.min(curLevel, room);
          if (transfer > 0) {
            setFluidCell(tx, ty + 1, curType, belowLevel + transfer);
            setFluidCell(tx, ty, curType, curLevel - transfer);
            continue;
          }
        }
      }
    }

    // 2. Spread horizontally to equalize level across open neighbors
    let remaining = fluidLevel[idx];
    if (remaining <= 0) continue;

    const candidates: Array<{ nx: number; level: number }> = [];
    for (const nx of [tx - 1, tx + 1]) {
      if (nx < 0 || nx >= w) continue;
      const nIdx = ty * w + nx;
      if (isForegroundSolid(world.fg[nIdx])) continue;
      const nType = fluidType[nIdx];
      const nLevel = fluidLevel[nIdx];
      if (nType === 0 || (nType === curType && nLevel + 1 < remaining)) {
        candidates.push({ nx, level: nLevel });
      }
    }

    if (candidates.length > 0) {
      // Favor lowest neighbor first
      candidates.sort((a, b) => a.level - b.level);
      for (const c of candidates) {
        if (remaining > c.level + 1) {
          const diff = Math.floor((remaining - c.level) / 2);
          if (diff > 0) {
            setFluidCell(c.nx, ty, curType, c.level + diff);
            remaining -= diff;
          }
        }
      }
      setFluidCell(tx, ty, curType, remaining);
    }
  }

  return Array.from(changedMap.values());
}
