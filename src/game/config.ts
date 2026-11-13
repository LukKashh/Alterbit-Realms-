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
  drops?: DropEntry[];
}

export interface GameConfig {
  mechanics: GameMechanicsConfig;
  itemOverrides: Record<number, ItemConfigOverride>;
  storeListings?: GemStoreListing[];
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
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
      if (Array.isArray(ov.drops)) {
        cleanOv.drops = ov.drops
          .filter((d) => d && CATALOG[d.itemId])
          .map((d) => ({
            itemId: Number(d.itemId),
            chance: clamp(d.chance, 0.5, 0, 1),
            minQty: Math.round(clamp(d.minQty, 1, 1, 50)),
            maxQty: Math.round(clamp(d.maxQty, Math.max(1, d.minQty ?? 1), 1, 50)),
          }))
          .map((d) => ({ ...d, maxQty: Math.max(d.minQty, d.maxQty) }));
      }
      itemOverrides[id] = cleanOv;
    }
  }

  let storeListings: GemStoreListing[] | undefined = undefined;
  if (Array.isArray(raw?.storeListings)) {
    storeListings = raw.storeListings
      .filter((l) => l && typeof l === 'object' && typeof l.id === 'string' && l.id.trim().length > 0)
      .map((l, idx) => ({
        id: String(l.id).trim().slice(0, 48) || `store_${idx}`,
        section: (['locks', 'blocks', 'seeds', 'wearables'].includes(l.section)
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
    }
  }

  return { mechanics, itemOverrides, storeListings: storeListings ?? [...GEM_STORE_LISTINGS] };
}

export function getEffectiveItemDef(
  itemId: number,
  config?: GameConfig | null
): ItemDefinition | undefined {
  const base = CATALOG[itemId];
  if (!base) return undefined;
  const ov = config?.itemOverrides?.[itemId];
  if (!ov) return base;
  return {
    ...base,
    hardness: ov.hardness ?? base.hardness,
    gemValue: ov.gemValue ?? base.gemValue,
    xpValue: ov.xpValue ?? base.xpValue,
    drops: ov.drops ?? base.drops,
  };
}
