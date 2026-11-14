import {
  DEFAULT_VIEW_SCALE,
  DROP_MAGNET_RADIUS,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_REACH_TILES,
  MAX_RUN_SPEED,
  PUNCH_COOLDOWN_MS,
} from './constants.ts';
import {
  CATALOG,
  GEM_STORE_LISTINGS,
  type DropEntry,
  type GemStoreListing,
  type ItemDefinition,
} from './catalog.ts';

export interface GameMechanicsConfig {
  viewScale: number;
  reachTiles: number;
  punchCooldownMs: number;
  moveSpeed: number;
  jumpVelocity: number;
  gravity: number;
  dropMagnetRadius: number;
  growthMultiplier: number;
  globalGemDropChance: number;
}

export interface ItemConfigOverride {
  hardness?: number;
  gemValue?: number;
  xpValue?: number;
  growthTimeMs?: number;
  drops?: DropEntry[];
  treeHarvestYield?: { minBlocks: number; maxBlocks: number; seedChance: number };
  bonusHarvestDrops?: DropEntry[];
}

export interface FishingMechanicsConfig {
  /** Gem costs to advance a rod to upgrade levels 1, 2 and 3, indexed by rod type 1–6. */
  upgradeGemCostsByRodType: [number, number, number][];
  /** Pulling multiplier for upgrade levels 1, 2 and 3. */
  pullingMultiplierByUpgrade: [number, number, number];
  /** Resistance multiplier keyed by fish item ID. */
  fishResistanceByItemId: Record<number, number>;
}

export interface GameConfig {
  mechanics: GameMechanicsConfig;
  fishing: FishingMechanicsConfig;
  itemOverrides: Record<number, ItemConfigOverride>;
  storeListings?: GemStoreListing[];
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  fishing: {
    upgradeGemCostsByRodType: [
      [0, 100, 250],
      [0, 200, 500],
      [0, 350, 850],
      [0, 550, 1350],
      [0, 800, 2000],
      [0, 1100, 2750],
    ],
    pullingMultiplierByUpgrade: [1, 1.35, 1.75],
    fishResistanceByItemId: {
      220: 0.7,
      221: 1,
      222: 1.4,
      223: 1.2,
    },
  },
  mechanics: {
    viewScale: DEFAULT_VIEW_SCALE,
    reachTiles: MAX_REACH_TILES,
    punchCooldownMs: PUNCH_COOLDOWN_MS,
    moveSpeed: MAX_RUN_SPEED,
    jumpVelocity: JUMP_VELOCITY,
    gravity: GRAVITY,
    dropMagnetRadius: DROP_MAGNET_RADIUS,
    growthMultiplier: 1,
    globalGemDropChance: 0.55,
  },
  itemOverrides: {},
  storeListings: [...GEM_STORE_LISTINGS],
};

export function cloneGameConfig(cfg: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(cfg)) as GameConfig;
}

export function sanitizeGameConfig(raw: Partial<GameConfig> | null | undefined): GameConfig {
  const m = raw?.mechanics ?? ({} as Partial<GameMechanicsConfig>);
  const clamp = (val: unknown, fallback: number, min: number, max: number) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  const rawFishing = raw?.fishing;
  const defaultFishing = DEFAULT_GAME_CONFIG.fishing;
  const upgradeGemCostsByRodType = Array.from({ length: 6 }, (_, index) => {
    const source = rawFishing?.upgradeGemCostsByRodType?.[index];
    const fallback = defaultFishing.upgradeGemCostsByRodType[index];
    const values = [0, 1, 2].map((slot) =>
      Math.round(clamp(source?.[slot], fallback[slot], 0, 1000000))
    );
    values[0] = 0;
    return values as [number, number, number];
  });
  const pullingValues = [0, 1, 2].map((slot) =>
    clamp(
      rawFishing?.pullingMultiplierByUpgrade?.[slot],
      defaultFishing.pullingMultiplierByUpgrade[slot],
      0.25,
      5
    )
  );
  pullingValues[0] = 1;
  const fishResistanceByItemId: Record<number, number> = {};
  for (const [key, fallback] of Object.entries(defaultFishing.fishResistanceByItemId)) {
    const itemId = Number(key);
    fishResistanceByItemId[itemId] = clamp(
      rawFishing?.fishResistanceByItemId?.[itemId],
      fallback,
      0.1,
      5
    );
  }
  const fishing: FishingMechanicsConfig = {
    upgradeGemCostsByRodType,
    pullingMultiplierByUpgrade: pullingValues as [number, number, number],
    fishResistanceByItemId,
  };

  const mechanics: GameMechanicsConfig = {
    viewScale: clamp(m.viewScale, DEFAULT_GAME_CONFIG.mechanics.viewScale, 1, 2.5),
    reachTiles: clamp(m.reachTiles, DEFAULT_GAME_CONFIG.mechanics.reachTiles, 1.5, 8),
    punchCooldownMs: clamp(m.punchCooldownMs, DEFAULT_GAME_CONFIG.mechanics.punchCooldownMs, 60, 600),
    moveSpeed: clamp(m.moveSpeed, DEFAULT_GAME_CONFIG.mechanics.moveSpeed, 150, 720),
    jumpVelocity: clamp(m.jumpVelocity, DEFAULT_GAME_CONFIG.mechanics.jumpVelocity, -1125, -375),
    gravity: clamp(m.gravity, DEFAULT_GAME_CONFIG.mechanics.gravity, 750, 3600),
    dropMagnetRadius: clamp(m.dropMagnetRadius, DEFAULT_GAME_CONFIG.mechanics.dropMagnetRadius, 0, 210),
    growthMultiplier: clamp(m.growthMultiplier, DEFAULT_GAME_CONFIG.mechanics.growthMultiplier, 0.1, 5),
    globalGemDropChance: clamp(
      m.globalGemDropChance,
      DEFAULT_GAME_CONFIG.mechanics.globalGemDropChance,
      0,
      1
    ),
  };

  const itemOverrides: Record<number, ItemConfigOverride> = {};
  if (raw?.itemOverrides && typeof raw.itemOverrides === 'object') {
    for (const [k, ov] of Object.entries(raw.itemOverrides)) {
      const id = Number(k);
      if (!CATALOG[id] || !ov || typeof ov !== 'object') continue;
      const cleanOv: ItemConfigOverride = {};
      if (ov.hardness !== undefined) cleanOv.hardness = Math.round(clamp(ov.hardness, 3, 1, 20));
      if (ov.gemValue !== undefined) cleanOv.gemValue = Math.round(clamp(ov.gemValue, 0, 0, 100));
      if (ov.xpValue !== undefined) cleanOv.xpValue = Math.round(clamp(ov.xpValue, 1, 0, 200));
      if (ov.growthTimeMs !== undefined) {
        cleanOv.growthTimeMs = Math.round(clamp(ov.growthTimeMs, 15000, 1000, 3600000));
      }
      const sanitizeDropEntries = (entries: unknown): DropEntry[] => {
        if (!Array.isArray(entries)) return [];
        return entries
          .filter((d) => d && typeof d === 'object' && CATALOG[Number(d.itemId)])
          .map((d) => ({
            itemId: Number(d.itemId),
            chance: clamp(d.chance, 0.5, 0, 1),
            minQty: Math.round(clamp(d.minQty, 1, 1, 50)),
            maxQty: Math.round(clamp(d.maxQty, Math.max(1, Number(d.minQty) || 1), 1, 50)),
          }))
          .map((d) => ({ ...d, maxQty: Math.max(d.minQty, d.maxQty) }));
      };
      if (Array.isArray(ov.drops)) cleanOv.drops = sanitizeDropEntries(ov.drops);
      if (ov.treeHarvestYield && typeof ov.treeHarvestYield === 'object') {
        const minBlocks = Math.round(clamp(ov.treeHarvestYield.minBlocks, 2, 1, 50));
        const maxBlocks = Math.round(clamp(ov.treeHarvestYield.maxBlocks, minBlocks, minBlocks, 50));
        cleanOv.treeHarvestYield = {
          minBlocks,
          maxBlocks: Math.max(minBlocks, maxBlocks),
          seedChance: clamp(ov.treeHarvestYield.seedChance, 0.65, 0, 1),
        };
      }
      if (Array.isArray(ov.bonusHarvestDrops)) {
        cleanOv.bonusHarvestDrops = sanitizeDropEntries(ov.bonusHarvestDrops);
      }
      itemOverrides[id] = cleanOv;
    }
  }

  let storeListings: GemStoreListing[] | undefined = undefined;
  if (Array.isArray(raw?.storeListings)) {
    const RETIRED_LISTING_IDS = new Set(['store_locks_world_blocks']);
    storeListings = raw.storeListings
      .filter(
        (l) =>
          l &&
          typeof l === 'object' &&
          typeof l.id === 'string' &&
          l.id.trim().length > 0 &&
          !RETIRED_LISTING_IDS.has(l.id.trim())
      )
      .map((l, idx) => ({
        id: String(l.id).trim().slice(0, 48) || `store_${idx}`,
        section: (['locks', 'blocks', 'seeds', 'wearables', 'tools'].includes(l.section)
          ? l.section
          : 'blocks') as GemStoreListing['section'],
        name: String(l.name ?? 'Store Item').slice(0, 48),
        description: String(l.description ?? '').slice(0, 160),
        iconItemId: CATALOG[Number(l.iconItemId)] ? Number(l.iconItemId) : 101,
        gemPrice: Math.max(1, Math.min(100000, Math.round(Number(l.gemPrice) || 10))),
        grants: Array.isArray(l.grants)
          ? l.grants
              .filter((g) => g && CATALOG[Number(g.itemId)])
              .map((g) => ({
                itemId: Number(g.itemId),
                qty: Math.max(1, Math.min(250, Math.round(Number(g.qty) || 1))),
              }))
          : [{ itemId: 101, qty: 1 }],
      }));
    if (storeListings.length === 0) {
      storeListings = [...GEM_STORE_LISTINGS];
    } else {
      const existingIds = new Set(storeListings.map((l) => l.id));
      for (const def of GEM_STORE_LISTINGS) {
        if (!existingIds.has(def.id)) {
          storeListings.push({
            ...def,
            grants: def.grants.map((g) => ({ ...g })),
          });
        }
      }
    }
  }

  return { mechanics, fishing, itemOverrides, storeListings: storeListings ?? [...GEM_STORE_LISTINGS] };
}

export function getEffectiveItemDef(
  itemId: number,
  config?: GameConfig | null
): ItemDefinition | undefined {
  const base = CATALOG[itemId];
  if (!base) return undefined;
  const ov = config?.itemOverrides?.[itemId];
  const linkedPartnerId = base.category === 'seed' ? base.producesTileId : base.seedId;
  const partnerOv = linkedPartnerId ? config?.itemOverrides?.[linkedPartnerId] : undefined;
  const partnerBase = linkedPartnerId ? CATALOG[linkedPartnerId] : undefined;
  if (!ov && !partnerOv && base.category !== 'seed') return base;
  return {
    ...base,
    hardness: ov?.hardness ?? base.hardness,
    gemValue: ov?.gemValue ?? base.gemValue,
    xpValue: ov?.xpValue ?? base.xpValue,
    growthTimeMs:
      ov?.growthTimeMs ??
      partnerOv?.growthTimeMs ??
      base.growthTimeMs ??
      partnerBase?.growthTimeMs,
    drops: ov?.drops ?? base.drops,
    treeHarvestYield:
      ov?.treeHarvestYield ??
      partnerOv?.treeHarvestYield ??
      base.treeHarvestYield ??
      partnerBase?.treeHarvestYield,
    bonusHarvestDrops: ov?.bonusHarvestDrops ?? partnerOv?.bonusHarvestDrops ?? base.bonusHarvestDrops,
  };
}

export type FarmabilityTier = 'sink' | 'balanced' | 'farmable' | 'abundant';

export interface FarmabilityTierMeta {
  id: FarmabilityTier;
  label: string;
  shortLabel: string;
  targetYieldLabel: string;
  description: string;
}

export const FARMABILITY_TIERS: FarmabilityTierMeta[] = [
  {
    id: 'sink',
    label: 'Non-Farmable Sink',
    shortLabel: 'Sink (<1×)',
    targetYieldLabel: '~0.65× Yield',
    description: 'Depletes over time; requires splicing or store restocking.',
  },
  {
    id: 'balanced',
    label: 'Balanced Sustain',
    shortLabel: 'Balanced (1.06×)',
    targetYieldLabel: '~1.06× Yield',
    description: 'Slightly above break-even so careful harvesters sustain stock.',
  },
  {
    id: 'farmable',
    label: 'Farmable (+Yield)',
    shortLabel: 'Farmable (+1.38×)',
    targetYieldLabel: '~1.38× Positive Yield',
    description: 'Reliable positive block & seed surplus on every harvest cycle.',
  },
  {
    id: 'abundant',
    label: 'Abundant Farm',
    shortLabel: 'Abundant (+1.85×)',
    targetYieldLabel: '~1.85× High Yield',
    description: 'Fast block multiplication and generous gem/seed output.',
  },
];

export interface FarmabilityAnalysis {
  itemId: number;
  targetBlockId: number;
  linkedSeedId: number | null;
  isFarmCandidate: boolean;
  hasSeedCycle: boolean;
  /** Expected direct blocks dropped when breaking 1 block */
  directBlockReturn: number;
  /** Expected seeds dropped when breaking 1 block */
  directSeedReturn: number;
  /** Average blocks harvested from 1 mature tree */
  avgTreeBlocks: number;
  /** Direct bonus seed chance when harvesting 1 mature tree */
  treeSeedRefund: number;
  /** Total expected blocks per broken block (direct block + seed * avgTreeBlocks) */
  expectedBlockYield: number;
  /** Net block gain per broken block (expectedBlockYield - 1) */
  netBlockGainPerBreak: number;
  /** Expected seeds recovered per full tree harvest + breaking its blocks */
  expectedSeedsPerTreeCycle: number;
  /** True when expectedBlockYield > 1.02 (or expectedSeedsPerTreeCycle >= 1.02) */
  isPositiveYield: boolean;
  /** Classification tier based on current effective config */
  currentTier: FarmabilityTier;
  /** Current primary block drop chance in % (0..100) */
  blockDropRatePct: number;
  /** Current primary block min/max qty */
  blockDropQty: [number, number];
  /** Current seed drop chance in % (0..100) */
  seedDropRatePct: number;
  /** System-calculated recommended value ranges that guarantee positive block yield (>1.05x) */
  positiveYieldRanges: {
    minBlockRatePct: number;
    blockRateRangePct: [number, number];
    minSeedRatePct: number;
    seedRateRangePct: [number, number];
    blockQtyRange: [number, number];
    hardnessRange: [number, number];
    gemValueRange: [number, number];
    xpValueRange: [number, number];
    formulaSummary: string;
  };
}

/**
 * Pure system function that evaluates an item's effective drop rates, seed-tree loop,
 * and calculates the exact Farmable Value Ranges required for Positive Block Yield (>1.0x).
 */
export function calculateFarmabilityProfile(
  itemId: number,
  config?: GameConfig | null
): FarmabilityAnalysis {
  const rawDef = getEffectiveItemDef(itemId, config) ?? CATALOG[itemId];
  const isSeed = rawDef?.category === 'seed' && Boolean(rawDef.producesTileId);
  const targetBlockId = isSeed && rawDef?.producesTileId ? rawDef.producesTileId : itemId;
  const blockDef = getEffectiveItemDef(targetBlockId, config) ?? CATALOG[targetBlockId] ?? rawDef;

  const linkedSeedId =
    blockDef?.seedId ??
    (isSeed ? itemId : null) ??
    blockDef?.drops?.find((d) => CATALOG[d.itemId]?.category === 'seed')?.itemId ??
    null;

  const seedDef = linkedSeedId
    ? getEffectiveItemDef(linkedSeedId, config) ?? CATALOG[linkedSeedId]
    : undefined;

  const isFarmCandidate = Boolean(
    blockDef &&
      blockDef.breakable &&
      (blockDef.category === 'foreground' ||
        blockDef.category === 'farmable' ||
        blockDef.category === 'background' ||
        blockDef.category === 'interactive' ||
        isSeed)
  );

  const treeYield = seedDef?.treeHarvestYield ??
    blockDef?.treeHarvestYield ?? { minBlocks: 2, maxBlocks: 3, seedChance: 0.65 };
  const avgTreeBlocks = Math.max(1, (treeYield.minBlocks + treeYield.maxBlocks) / 2);
  const treeSeedRefund = Math.max(0, Math.min(1, treeYield.seedChance));
  const hasSeedCycle = Boolean(linkedSeedId && seedDef);

  const drops = blockDef?.drops ?? [];
  let directBlockReturn = 0;
  let directSeedReturn = 0;
  let primaryBlockChance = 0;
  let primaryBlockQty: [number, number] = [1, 1];
  let primarySeedChance = 0;

  for (const d of drops) {
    const avgQty = (Math.max(1, d.minQty) + Math.max(d.minQty, d.maxQty)) / 2;
    if (d.itemId === targetBlockId) {
      directBlockReturn += d.chance * avgQty;
      primaryBlockChance = Math.max(primaryBlockChance, d.chance);
      primaryBlockQty = [d.minQty, d.maxQty];
    } else if (
      (linkedSeedId && d.itemId === linkedSeedId) ||
      CATALOG[d.itemId]?.category === 'seed'
    ) {
      directSeedReturn += d.chance * avgQty;
      primarySeedChance = Math.max(primarySeedChance, d.chance);
    }
  }

  // Expected blocks returned per 1 broken block:
  // Direct block drop + (Seeds dropped per block * Average blocks produced per planted seed tree)
  const expectedBlockYield = Number(
    (directBlockReturn + (hasSeedCycle ? directSeedReturn * avgTreeBlocks : 0)).toFixed(2)
  );
  const netBlockGainPerBreak = Number((expectedBlockYield - 1).toFixed(2));

  // Across a full tree harvest cycle:
  // 1 tree drops avgTreeBlocks blocks + treeSeedRefund seeds.
  // Breaking those blocks with directBlockReturn re-breaks yields avgTreeBlocks / (1 - min(0.8, directBlockReturn)) total block breaks.
  const effectiveBreaksPerTree =
    directBlockReturn > 0 && directBlockReturn < 0.85
      ? avgTreeBlocks / (1 - Math.min(0.75, directBlockReturn * 0.5))
      : avgTreeBlocks * (1 + directBlockReturn * 0.5);
  const expectedSeedsPerTreeCycle = hasSeedCycle
    ? Number((treeSeedRefund + effectiveBreaksPerTree * directSeedReturn).toFixed(2))
    : 0;

  const isPositiveYield =
    expectedBlockYield >= 1.03 || (hasSeedCycle && expectedSeedsPerTreeCycle >= 1.03);

  let currentTier: FarmabilityTier = 'sink';
  if (expectedBlockYield >= 1.6) {
    currentTier = 'abundant';
  } else if (expectedBlockYield >= 1.2) {
    currentTier = 'farmable';
  } else if (expectedBlockYield >= 0.98) {
    currentTier = 'balanced';
  }

  // Rarity-scaled baseline recommendations for Hardness, Gems, and XP
  const rarity = blockDef?.rarity ?? 'common';
  const gpRarity = blockDef?.growPixelRarity ?? (rarity === 'epic' ? 8 : rarity === 'rare' ? 5 : rarity === 'uncommon' ? 3 : 1);

  const hardnessRange: [number, number] =
    gpRarity >= 5 ? [4, 7] : gpRarity >= 3 ? [3, 5] : [2, 4];
  const gemValueRange: [number, number] =
    gpRarity >= 5 ? [4, 10] : gpRarity >= 3 ? [2, 6] : [1, 4];
  const xpValueRange: [number, number] =
    gpRarity >= 5 ? [3, 8] : gpRarity >= 3 ? [2, 5] : [1, 3];

  if (hasSeedCycle) {
    // With seed cycle: E[Yield] = blockRate * avgBlockQty + seedRate * avgTreeBlocks > 1.05
    const avgBlkQty = (primaryBlockQty[0] + primaryBlockQty[1]) / 2;
    const minSeedForLoop = Math.ceil(((1.05 - treeSeedRefund) / avgTreeBlocks) * 100);
    const minSeedForBlockYield = Math.ceil(
      (Math.max(0.08, 1.08 - directBlockReturn) / avgTreeBlocks) * 100
    );
    const minSeedRatePct = Math.max(15, Math.min(60, Math.max(minSeedForLoop, minSeedForBlockYield)));
    const seedRateRangePct: [number, number] = [
      minSeedRatePct,
      Math.min(65, Math.max(minSeedRatePct + 18, 38)),
    ];

    const minBlockRatePct = Math.max(
      55,
      Math.min(
        95,
        Math.ceil(((1.08 - Math.max(0.22, directSeedReturn) * avgTreeBlocks) / Math.max(1, avgBlkQty)) * 100)
      )
    );
    const blockRateRangePct: [number, number] = [
      Math.min(72, minBlockRatePct),
      95,
    ];

    return {
      itemId,
      targetBlockId,
      linkedSeedId,
      isFarmCandidate,
      hasSeedCycle: true,
      directBlockReturn: Number(directBlockReturn.toFixed(2)),
      directSeedReturn: Number(directSeedReturn.toFixed(2)),
      avgTreeBlocks,
      treeSeedRefund,
      expectedBlockYield,
      netBlockGainPerBreak,
      expectedSeedsPerTreeCycle,
      isPositiveYield,
      currentTier,
      blockDropRatePct: Math.round(primaryBlockChance * 100),
      blockDropQty: primaryBlockQty,
      seedDropRatePct: Math.round(primarySeedChance * 100),
      positiveYieldRanges: {
        minBlockRatePct: blockRateRangePct[0],
        blockRateRangePct,
        minSeedRatePct,
        seedRateRangePct,
        blockQtyRange: [1, 2],
        hardnessRange,
        gemValueRange,
        xpValueRange,
        formulaSummary: `Block Rate (${blockRateRangePct[0]}%–${blockRateRangePct[1]}%) + Seed Rate (${seedRateRangePct[0]}%–${seedRateRangePct[1]}%) × ${avgTreeBlocks.toFixed(1)} Tree Blocks > 1.05×`,
      },
    };
  }

  // Direct-drop block (no dedicated seed, e.g., Biome blocks 700..748 or props):
  // Positive block yield requires average block return > 1.05 -> Qty 1..2 (avg 1.5) at 72%..96% rate
  return {
    itemId,
    targetBlockId,
    linkedSeedId: null,
    isFarmCandidate,
    hasSeedCycle: false,
    directBlockReturn: Number(directBlockReturn.toFixed(2)),
    directSeedReturn: Number(directSeedReturn.toFixed(2)),
    avgTreeBlocks,
    treeSeedRefund: 0,
    expectedBlockYield,
    netBlockGainPerBreak,
    expectedSeedsPerTreeCycle: 0,
    isPositiveYield,
    currentTier,
    blockDropRatePct: Math.round(primaryBlockChance * 100),
    blockDropQty: primaryBlockQty,
    seedDropRatePct: 0,
    positiveYieldRanges: {
      minBlockRatePct: 72,
      blockRateRangePct: [74, 96],
      minSeedRatePct: 15,
      seedRateRangePct: [15, 35],
      blockQtyRange: [1, 2],
      hardnessRange,
      gemValueRange,
      xpValueRange,
      formulaSummary: `Block Rate (74%–96%) × Drop Qty (1–2, avg 1.5) = 1.11×–1.44× Positive Yield`,
    },
  };
}

/**
 * Generates a deterministic ItemConfigOverride for a target FarmabilityTier.
 * Guarantees positive block yield (>1.0x) for 'balanced', 'farmable', and 'abundant' tiers.
 */
export function buildFarmabilityOverride(
  itemId: number,
  tier: FarmabilityTier,
  config?: GameConfig | null
): { targetItemId: number; override: ItemConfigOverride } {
  const analysis = calculateFarmabilityProfile(itemId, config);
  const targetId = analysis.targetBlockId;
  const baseDef = CATALOG[targetId] ?? CATALOG[itemId];
  if (!baseDef) {
    return { targetItemId: itemId, override: {} };
  }

  const [minH, maxH] = analysis.positiveYieldRanges.hardnessRange;
  const [minG, maxG] = analysis.positiveYieldRanges.gemValueRange;
  const [minX, maxX] = analysis.positiveYieldRanges.xpValueRange;

  // Preserve any custom non-block/non-seed bonus drops
  const existingDrops = (getEffectiveItemDef(targetId, config)?.drops ?? baseDef.drops ?? []).filter(
    (d) =>
      d.itemId !== targetId &&
      d.itemId !== analysis.linkedSeedId &&
      CATALOG[d.itemId]?.category !== 'seed'
  );

  if (analysis.hasSeedCycle && analysis.linkedSeedId) {
    // Seed-linked block (e.g., 500..541):
    // avgTreeBlocks is ~2.5.
    // sink:     block 0.35 (1..1) + seed 0.12 (1..1) => 0.35 + 0.30 = 0.65x
    // balanced: block 0.56 (1..1) + seed 0.20 (1..1) => 0.56 + 0.50 = 1.06x
    // farmable: block 0.78 (1..1) + seed 0.24 (1..1) => 0.78 + 0.60 = 1.38x
    // abundant: block 0.70 (1..2, avg 1.5 = 1.05) + seed 0.32 (1..1) => 1.05 + 0.80 = 1.85x
    const presets: Record<
      FarmabilityTier,
      {
        blockChance: number;
        blockMin: number;
        blockMax: number;
        seedChance: number;
        hardness: number;
        gemValue: number;
        xpValue: number;
      }
    > = {
      sink: {
        blockChance: 0.35,
        blockMin: 1,
        blockMax: 1,
        seedChance: 0.12,
        hardness: maxH + 1,
        gemValue: Math.max(1, minG),
        xpValue: Math.max(1, minX),
      },
      balanced: {
        blockChance: 0.56,
        blockMin: 1,
        blockMax: 1,
        seedChance: 0.2,
        hardness: Math.round((minH + maxH) / 2),
        gemValue: Math.round((minG + maxG) / 2),
        xpValue: Math.round((minX + maxX) / 2),
      },
      farmable: {
        blockChance: 0.78,
        blockMin: 1,
        blockMax: 1,
        seedChance: 0.24,
        hardness: minH,
        gemValue: maxG,
        xpValue: maxX,
      },
      abundant: {
        blockChance: 0.7,
        blockMin: 1,
        blockMax: 2,
        seedChance: 0.32,
        hardness: Math.max(1, minH - 1),
        gemValue: maxG + 2,
        xpValue: maxX + 1,
      },
    };

    const p = presets[tier];
    const drops: DropEntry[] = [
      { itemId: targetId, chance: p.blockChance, minQty: p.blockMin, maxQty: p.blockMax },
      { itemId: analysis.linkedSeedId, chance: p.seedChance, minQty: 1, maxQty: 1 },
      ...existingDrops,
    ];

    return {
      targetItemId: targetId,
      override: {
        hardness: p.hardness,
        gemValue: p.gemValue,
        xpValue: p.xpValue,
        drops,
      },
    };
  }

  // Natural / Non-seed block (e.g., Biome blocks 700..748):
  // Uses multi-drop qty (1..2 or 1..3) so breaking blocks yields positive block count directly!
  const directPresets: Record<
    FarmabilityTier,
    {
      blockChance: number;
      blockMin: number;
      blockMax: number;
      hardness: number;
      gemValue: number;
      xpValue: number;
    }
  > = {
    sink: {
      blockChance: 0.65,
      blockMin: 1,
      blockMax: 1,
      hardness: maxH + 1,
      gemValue: Math.max(1, minG),
      xpValue: Math.max(1, minX),
    },
    balanced: {
      blockChance: 0.72,
      blockMin: 1,
      blockMax: 2, // 0.72 * 1.5 = 1.08x
      hardness: Math.round((minH + maxH) / 2),
      gemValue: Math.round((minG + maxG) / 2),
      xpValue: Math.round((minX + maxX) / 2),
    },
    farmable: {
      blockChance: 0.92,
      blockMin: 1,
      blockMax: 2, // 0.92 * 1.5 = 1.38x
      hardness: minH,
      gemValue: maxG,
      xpValue: maxX,
    },
    abundant: {
      blockChance: 0.94,
      blockMin: 1,
      blockMax: 3, // 0.94 * 2.0 = 1.88x
      hardness: Math.max(1, minH - 1),
      gemValue: maxG + 2,
      xpValue: maxX + 1,
    },
  };

  const dp = directPresets[tier];
  const drops: DropEntry[] = [
    { itemId: targetId, chance: dp.blockChance, minQty: dp.blockMin, maxQty: dp.blockMax },
    ...existingDrops,
  ];

  return {
    targetItemId: targetId,
    override: {
      hardness: dp.hardness,
      gemValue: dp.gemValue,
      xpValue: dp.xpValue,
      drops,
    },
  };
}

export function applyFarmabilityTier(
  cfg: GameConfig,
  itemIds: number[],
  tier: FarmabilityTier
): GameConfig {
  const next = cloneGameConfig(cfg);
  for (const rawId of itemIds) {
    const { targetItemId, override } = buildFarmabilityOverride(rawId, tier, next);
    if (!CATALOG[targetItemId] || !CATALOG[targetItemId].breakable) continue;
    next.itemOverrides[targetItemId] = {
      ...(next.itemOverrides[targetItemId] ?? {}),
      ...override,
    };
  }
  return next;
}

