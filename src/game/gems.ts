import { TILE_SIZE } from './constants.ts';

export type GemTierKey = 'yellow' | 'blue' | 'red' | 'green' | 'purple';

export interface GemTierSpec {
  tier: GemTierKey;
  value: 1 | 5 | 10 | 50 | 100;
  /** Crisp pixel-aligned floating display size in px */
  size: number;
  /** Exact mathematical progression size before pixel snapping */
  exactSize: number;
  darkColor: string;
  baseColor: string;
  lightColor: string;
  sparkColor: string;
}

/**
 * Existing 5 Value Gem denominations in descending greedy sort order:
 * 5. Purple = 100 gems
 * 4. Green  = 50 gems
 * 3. Red    = 10 gems
 * 2. Blue   = 5 gems
 * 1. Yellow = 1 gem
 */
export const GEM_DENOMINATIONS = [100, 50, 10, 5, 1] as const;

/**
 * Display size scaling:
 * - Previously, Red (10 gems) was 24px.
 * - Rescaled twice by -15%: 24 * 0.85 * 0.85 = 17.34px for Red.
 * - Every next tier from lowest (Yellow 1) to highest (Purple 100) is +9% larger (* 1.09).
 */
export const GEM_RED_BASELINE_PREV = 24;
export const GEM_RED_RESCALED_EXACT = GEM_RED_BASELINE_PREV * 0.85 * 0.85; // 17.34
export const GEM_TIER_STEP_RATIO = 1.09;

const EXACT_YELLOW = GEM_RED_RESCALED_EXACT / (GEM_TIER_STEP_RATIO * GEM_TIER_STEP_RATIO); // ~14.595
const EXACT_BLUE = GEM_RED_RESCALED_EXACT / GEM_TIER_STEP_RATIO; // ~15.908
const EXACT_RED = GEM_RED_RESCALED_EXACT; // 17.34
const EXACT_GREEN = GEM_RED_RESCALED_EXACT * GEM_TIER_STEP_RATIO; // ~18.901
const EXACT_PURPLE = GEM_RED_RESCALED_EXACT * (GEM_TIER_STEP_RATIO * GEM_TIER_STEP_RATIO); // ~20.602

export const GEM_TIERS: Record<GemTierKey, GemTierSpec> = {
  yellow: {
    tier: 'yellow',
    value: 1,
    size: Math.round(EXACT_YELLOW), // 15
    exactSize: EXACT_YELLOW,
    darkColor: '#713f12',
    baseColor: '#ca8a04',
    lightColor: '#fde047',
    sparkColor: '#fef08a',
  },
  blue: {
    tier: 'blue',
    value: 5,
    size: Math.round(EXACT_BLUE), // 16
    exactSize: EXACT_BLUE,
    darkColor: '#0369a1',
    baseColor: '#0284c7',
    lightColor: '#38bdf8',
    sparkColor: '#e0f2fe',
  },
  red: {
    tier: 'red',
    value: 10,
    size: Math.round(EXACT_RED), // 17
    exactSize: EXACT_RED,
    darkColor: '#991b1b',
    baseColor: '#dc2626',
    lightColor: '#f87171',
    sparkColor: '#fee2e2',
  },
  green: {
    tier: 'green',
    value: 50,
    size: Math.round(EXACT_GREEN), // 19
    exactSize: EXACT_GREEN,
    darkColor: '#14532d',
    baseColor: '#16a34a',
    lightColor: '#4ade80',
    sparkColor: '#dcfce7',
  },
  purple: {
    tier: 'purple',
    value: 100,
    size: Math.round(EXACT_PURPLE), // 21
    exactSize: EXACT_PURPLE,
    darkColor: '#581c87',
    baseColor: '#9333ea',
    lightColor: '#c084fc',
    sparkColor: '#f3e8ff',
  },
};

export const GEM_TIERS_ASCENDING: readonly GemTierSpec[] = [
  GEM_TIERS.yellow,
  GEM_TIERS.blue,
  GEM_TIERS.red,
  GEM_TIERS.green,
  GEM_TIERS.purple,
];

export function getGemTierSpec(qty: number): GemTierSpec {
  if (qty >= 100) return GEM_TIERS.purple;
  if (qty >= 50) return GEM_TIERS.green;
  if (qty >= 10) return GEM_TIERS.red;
  if (qty >= 5) return GEM_TIERS.blue;
  return GEM_TIERS.yellow;
}

/**
 * Automatically sorts/decomposes an arbitrary whole gem value into exact denomination drops
 * [100, 50, 10, 5, 1] summing strictly to totalGems.
 * Example: 67 -> [50, 10, 5, 1, 1] (1 Green, 1 Red, 1 Blue, 2 Yellow).
 */
export function decomposeGemValue(totalGems: number): Array<1 | 5 | 10 | 50 | 100> {
  let rem = Math.max(0, Math.floor(totalGems));
  if (rem <= 0) return [];
  const out: Array<1 | 5 | 10 | 50 | 100> = [];
  for (const denom of GEM_DENOMINATIONS) {
    while (rem >= denom) {
      out.push(denom);
      rem -= denom;
    }
  }
  return out;
}

/**
 * Picks a randomized world (x, y) drop coordinate strictly within the exact origin tile (tx, ty).
 * Uses safe padding from tile edges so floating gem sprites remain inside [tx*TILE_SIZE, (tx+1)*TILE_SIZE)
 * and lightly avoids stacking directly on top of sibling gems spawned in the same drop batch.
 */
export function rollGemDropPositionInTile(
  tx: number,
  ty: number,
  existingInBatch: ReadonlyArray<{ x: number; y: number }> = [],
  rng: () => number = Math.random
): { x: number; y: number } {
  const pad = 11;
  const minX = tx * TILE_SIZE + pad;
  const maxX = (tx + 1) * TILE_SIZE - pad;
  const minY = ty * TILE_SIZE + pad;
  const maxY = (ty + 1) * TILE_SIZE - pad;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  let bestX = minX + rng() * spanX;
  let bestY = minY + rng() * spanY;
  let bestMinDist = -1;

  for (let attempt = 0; attempt < 10; attempt++) {
    const candX = Math.round((minX + rng() * spanX) * 10) / 10;
    const candY = Math.round((minY + rng() * spanY) * 10) / 10;
    if (existingInBatch.length === 0) {
      return { x: candX, y: candY };
    }
    let minDist = Infinity;
    for (const prev of existingInBatch) {
      const d = Math.hypot(candX - prev.x, candY - prev.y);
      if (d < minDist) minDist = d;
    }
    if (minDist >= 8) {
      return { x: candX, y: candY };
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestX = candX;
      bestY = candY;
    }
  }

  return { x: bestX, y: bestY };
}
