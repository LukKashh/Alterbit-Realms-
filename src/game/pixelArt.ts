import {
  BLOCKGROVE_ART_THEME as THEME,
} from './artTheme.ts';
import { CATALOG } from './catalog.ts';
import {
  CATALOG_TEX30_SIZE,
  drawCatalogItem30,
  getCatalogItemTexture30,
} from './catalogArt30.ts';
import {
  drawFarmableBlock32,
  drawFarmableSeed32,
  getFarmableTexture32,
} from './farmableArt.ts';
import { renderHighDefPlayerSprite } from './playerSpriteHD.ts';

export type PlayerPose =
  | 'idle'
  | 'idle0'
  | 'idle1'
  | 'idle2'
  | 'idle3'
  | 'idle4'
  | 'idle5'
  | 'idle6'
  | 'idle7'
  | 'walk0'
  | 'walk1'
  | 'walk2'
  | 'walk3'
  | 'walk4'
  | 'walk5'
  | 'walk6'
  | 'walk7'
  | 'jump'
  | 'fall'
  | 'land'
  | 'punch'
  | 'punch0'
  | 'punch1'
  | 'punch2'
  | 'punch3'
  | 'mine0'
  | 'mine1'
  | 'mine2'
  | 'mine3'
  | 'place'
  | 'fish_cast'
  | 'fish_hold'
  | 'fish_reel';

export interface EquippedWearables {
  head?: number;
  face?: number;
  back?: number;
}

const TILE_PX = THEME.tileTextureSize; // 60x60 (exact 2x multiple of 30-bit 30x30 textures)

const tileCache = new Map<number, HTMLCanvasElement>();
const iconDataUrls = new Map<number, string>();
const playerFrames = new Map<string, HTMLCanvasElement>();
const crackFrames: HTMLCanvasElement[] = [];

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// High-detail tile & item sprites (32-bit for Farmables 900..939/950..989; 30-bit for all other catalogue items)
function drawTile48(itemId: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TILE_PX, TILE_PX);
  const def = CATALOG[itemId];
  if (!def && itemId !== 3 && !(itemId >= 600 && itemId <= 609)) return c;

  // Dedicated 32-bit downscaled pixel art renderers for 40 Farmables (900..939) and 40 Seeds (950..989)
  if (itemId >= 900 && itemId <= 939) {
    if (drawFarmableBlock32(ctx, itemId, def, TILE_PX, TILE_PX)) {
      return c;
    }
  }
  if (itemId >= 950 && itemId <= 989) {
    if (drawFarmableSeed32(ctx, itemId, def, TILE_PX, TILE_PX)) {
      return c;
    }
  }

  // Dedicated 30-bit (30x30) resolution artwork engine for the remainder of all catalogue items
  drawCatalogItem30(ctx, itemId, def, TILE_PX, TILE_PX);
  return c;
}

export function getTileSprite(itemId: number): HTMLCanvasElement {
  let cached = tileCache.get(itemId);
  if (!cached) {
    // 1. 32-bit pixel art farmable blocks and seeds render directly from the native 32x32 texture
    if ((itemId >= 900 && itemId <= 939) || (itemId >= 950 && itemId <= 989)) {
      const tex32 = getFarmableTexture32(itemId, CATALOG[itemId]);
      if (tex32) {
        const scaled = document.createElement('canvas');
        scaled.width = TILE_PX;
        scaled.height = TILE_PX;
        const sCtx = scaled.getContext('2d')!;
        sCtx.imageSmoothingEnabled = false;
        sCtx.drawImage(tex32, 0, 0, 32, 32, 0, 0, TILE_PX, TILE_PX);
        cached = scaled;
        tileCache.set(itemId, cached);
        return cached;
      }
    }

    // 2. 30-bit pixel art non-farmable catalogue items render directly from the native 30x30 texture
    const tex30 = getCatalogItemTexture30(itemId, CATALOG[itemId]);
    if (tex30) {
      const scaled = document.createElement('canvas');
      scaled.width = TILE_PX;
      scaled.height = TILE_PX;
      const sCtx = scaled.getContext('2d')!;
      sCtx.imageSmoothingEnabled = false;
      sCtx.drawImage(
        tex30,
        0,
        0,
        CATALOG_TEX30_SIZE,
        CATALOG_TEX30_SIZE,
        0,
        0,
        TILE_PX,
        TILE_PX
      );
      cached = scaled;
      tileCache.set(itemId, cached);
      return cached;
    }

    const raw = drawTile48(itemId);
    const scaled = document.createElement('canvas');
    scaled.width = TILE_PX;
    scaled.height = TILE_PX;
    const sCtx = scaled.getContext('2d')!;
    sCtx.imageSmoothingEnabled = false;
    sCtx.drawImage(raw, 0, 0, raw.width, raw.height, 0, 0, TILE_PX, TILE_PX);
    cached = scaled;
    tileCache.set(itemId, cached);
  }
  return cached;
}

export function getItemIconUrl(itemId: number): string {
  let url = iconDataUrls.get(itemId);
  if (!url) {
    const sprite = getTileSprite(itemId);
    const [out, ctx] = makeCanvas(TILE_PX, TILE_PX);
    ctx.drawImage(sprite, 0, 0, TILE_PX, TILE_PX);
    url = out.toDataURL();
    iconDataUrls.set(itemId, url);
  }
  return url;
}

export const CRACK_STAGE_COUNT = 8;

interface CrackSegment30 {
  stage: number;
  points: ReadonlyArray< readonly [number, number] >;
  /** Optional chipped-edge highlight offsets relative to each point */
  bevel?: readonly [number, number];
  /** Optional secondary width expansion on heavy stages */
  thickFromStage?: number;
}

/**
 * 30-bit (30×30 native grid -> 60×60 TILE_PX) progressive branching fracture segments
 * for placed blocks, background walls, and placeables across 8 damage stages.
 */
const HIGH_DEF_CRACK_SEGMENTS_30: readonly CrackSegment30[] = [
  // Stage 1: Initial impact star at epicenter (15, 14) with 3 short hairline fractures
  {
    stage: 1,
    points: [
      [14, 14], [15, 14], [15, 15], [13, 13], [12, 12],
      [16, 13], [17, 12], [15, 16], [14, 17],
    ],
    bevel: [-1, -1],
    thickFromStage: 5,
  },
  // Stage 2: Primary NW & SE diagonal faults extend outward
  {
    stage: 2,
    points: [
      [11, 11], [10, 11], [9, 10], [8, 9],
      [16, 16], [17, 17], [18, 17], [19, 18], [20, 19],
      [13, 15], [12, 16],
    ],
    bevel: [0, -1],
    thickFromStage: 6,
  },
  // Stage 3: NE & SW counter-faults split from epicenter + upper stress fork
  {
    stage: 3,
    points: [
      [18, 11], [19, 11], [20, 10], [21, 9], [22, 8],
      [11, 17], [10, 18], [9, 19], [8, 20],
      [10, 9], [10, 8], [11, 7],
    ],
    bevel: [-1, 0],
    thickFromStage: 6,
  },
  // Stage 4: Bifurcating side branches & mid-tile shear lines
  {
    stage: 4,
    points: [
      [7, 9], [6, 8], [5, 7],
      [19, 14], [20, 14], [21, 15], [22, 15], [23, 16],
      [14, 11], [14, 10], [15, 9], [15, 8],
      [15, 18], [15, 19], [16, 20], [16, 21],
    ],
    bevel: [0, -1],
    thickFromStage: 7,
  },
  // Stage 5: Deep structural faults reach outer ring + transverse web links
  {
    stage: 5,
    points: [
      [21, 20], [22, 21], [23, 22], [24, 23],
      [7, 20], [6, 21], [5, 22], [4, 23],
      [9, 14], [8, 14], [7, 15], [6, 15], [5, 16],
      [18, 8], [17, 7], [17, 6],
    ],
    bevel: [-1, -1],
    thickFromStage: 7,
  },
  // Stage 6: Peripheral stress fissures approach tile borders + inner ring web
  {
    stage: 6,
    points: [
      [4, 6], [3, 5], [2, 4],
      [23, 7], [24, 6], [25, 5], [26, 4],
      [24, 16], [25, 17], [26, 17], [27, 18],
      [16, 22], [17, 23], [17, 24], [18, 25],
      [11, 13], [11, 14], [12, 15], [17, 14], [17, 15],
    ],
    bevel: [0, -1],
    thickFromStage: 8,
  },
  // Stage 7: Interlocking shatter web across all 4 quadrants + detached spall chips
  {
    stage: 7,
    points: [
      [15, 7], [14, 6], [14, 5], [13, 4], [13, 3],
      [4, 16], [3, 17], [2, 17],
      [25, 23], [26, 24], [27, 25],
      [3, 24], [2, 25],
      [8, 11], [8, 12], [9, 13],
      [20, 12], [21, 13], [20, 17], [19, 19],
    ],
    bevel: [-1, 0],
  },
  // Stage 8: Critical failure — edge-to-edge fracture network & impact crater core
  {
    stage: 8,
    points: [
      [1, 3], [27, 3], [28, 18], [18, 26], [18, 27], [1, 18], [1, 26], [28, 26],
      [13, 2], [12, 2], [6, 4], [7, 5], [22, 4], [21, 5],
      [6, 25], [7, 24], [22, 25], [21, 24],
      [14, 13], [15, 13], [16, 14], [14, 15],
    ],
    bevel: [-1, -1],
  },
];

const MICRO_SPALL_CHIPS_30: ReadonlyArray< readonly [number, number, number] > = [
  // [stage, x, y]
  [2, 13, 11],
  [3, 18, 13],
  [3, 12, 18],
  [4, 8, 7],
  [4, 21, 18],
  [5, 12, 8],
  [5, 22, 11],
  [5, 8, 17],
  [6, 5, 11],
  [6, 24, 13],
  [6, 13, 22],
  [7, 4, 19],
  [7, 25, 9],
  [7, 19, 23],
  [8, 9, 4],
  [8, 24, 20],
  [8, 10, 25],
  [8, 3, 9],
];

export function getCrackOverlay(stage: number): HTMLCanvasElement {
  if (crackFrames.length === 0) {
    for (let s = 1; s <= CRACK_STAGE_COUNT; s++) {
      // Render at native 30x30 (30-bit resolution), then upscale 2x to 60x60 TILE_PX
      const [c30, ctx30] = makeCanvas(CATALOG_TEX30_SIZE, CATALOG_TEX30_SIZE);

      // 1. Subtle outer stress halo + bevel catch-lights so fractures read on both dark & bright tiles
      for (const seg of HIGH_DEF_CRACK_SEGMENTS_30) {
        if (seg.stage > s) continue;
        const [bx, by] = seg.bevel ?? [-1, -1];
        for (const [px, py] of seg.points) {
          // Soft ambient occlusion halo on opposite side of bevel
          ctx30.fillStyle = 'rgba(12, 18, 30, 0.34)';
          ctx30.fillRect(px - bx, py - by, 1, 1);

          // Crisp chipped-edge specular catch-light along upper/left fracture lip
          const highlightAlpha = Math.min(0.52, 0.28 + s * 0.028);
          ctx30.fillStyle = `rgba(232, 245, 255, ${highlightAlpha.toFixed(2)})`;
          ctx30.fillRect(px + bx, py + by, 1, 1);
        }
      }

      // 2. Secondary widened fault trench on progressed stages
      for (const seg of HIGH_DEF_CRACK_SEGMENTS_30) {
        if (seg.stage > s) continue;
        if (seg.thickFromStage && s >= seg.thickFromStage) {
          ctx30.fillStyle = 'rgba(18, 26, 42, 0.78)';
          for (const [px, py] of seg.points) {
            ctx30.fillRect(px + 1, py, 1, 1);
          }
        }
      }

      // 3. Primary high-contrast fracture seams (30-bit 1px crisp paths)
      for (const seg of HIGH_DEF_CRACK_SEGMENTS_30) {
        if (seg.stage > s) continue;
        const isCoreStage = seg.stage <= Math.ceil(s * 0.5);
        ctx30.fillStyle = isCoreStage
          ? 'rgba(6, 9, 16, 0.95)'
          : 'rgba(14, 20, 33, 0.86)';
        for (const [px, py] of seg.points) {
          ctx30.fillRect(px, py, 1, 1);
        }
      }

      // 4. Epicenter impact cavity darkening (grows from 1x1 to 3x3 at high stages)
      if (s >= 3) {
        ctx30.fillStyle = 'rgba(4, 6, 12, 0.96)';
        ctx30.fillRect(14, 14, 2, 2);
      }
      if (s >= 6) {
        ctx30.fillStyle = 'rgba(4, 6, 12, 0.98)';
        ctx30.fillRect(14, 13, 3, 3);
        ctx30.fillStyle = 'rgba(240, 249, 255, 0.55)';
        ctx30.fillRect(13, 13, 1, 1);
        ctx30.fillRect(17, 16, 1, 1);
      }

      // 5. Detached micro-spall chips & grit around fracture lines
      for (const [chipStage, cx, cy] of MICRO_SPALL_CHIPS_30) {
        if (chipStage > s) continue;
        ctx30.fillStyle = 'rgba(10, 15, 26, 0.84)';
        ctx30.fillRect(cx, cy, 1, 1);
        ctx30.fillStyle = 'rgba(226, 240, 255, 0.38)';
        ctx30.fillRect(cx - 1, cy - 1, 1, 1);
      }

      const [scaled, sCtx] = makeCanvas(TILE_PX, TILE_PX);
      sCtx.drawImage(
        c30,
        0,
        0,
        CATALOG_TEX30_SIZE,
        CATALOG_TEX30_SIZE,
        0,
        0,
        TILE_PX,
        TILE_PX
      );
      crackFrames.push(scaled);
    }
  }
  const clampedStage = Math.max(1, Math.min(CRACK_STAGE_COUNT, Math.round(stage)));
  return crackFrames[clampedStage - 1];
}

export function getPlayerSprite(
  pose: PlayerPose,
  facing: 1 | -1,
  shirtColor = '#3f8fd9',
  equipped?: EquippedWearables
): HTMLCanvasElement {
  const eqKey = `${equipped?.head ?? 0}_${equipped?.face ?? 0}_${equipped?.back ?? 0}`;
  const key = `px4:${pose}:${facing}:${shirtColor}:${eqKey}`;
  const cached = playerFrames.get(key);
  if (cached) return cached;

  const sprite = renderHighDefPlayerSprite(pose, facing, shirtColor, equipped);
  playerFrames.set(key, sprite);
  return sprite;
}

const marketStandCache = new Map<'landlord' | 'greens_vendor', HTMLCanvasElement>();

/**
 * Renders a 3×2 tile (180×120 px) pixel-art market stand for the Nexus plaza.
 */
export function getMarketStandSprite(kind: 'landlord' | 'greens_vendor'): HTMLCanvasElement {
  const cached = marketStandCache.get(kind);
  if (cached) return cached;

  const width = TILE_PX * 3;
  const height = TILE_PX * 2;
  const [c, ctx] = makeCanvas(width, height);

  // Map 48x32 logical grid across the full 180x120 (3x2 tile) frame so the stand & NPC fit edge-to-edge on the floor
  const sx = width / 48;
  const sy = height / 32;
  const b = (gx: number, gy: number, color: string, gw = 1, gh = 1) => {
    const x0 = Math.round(gx * sx);
    const y0 = Math.round(gy * sy);
    const x1 = Math.round((gx + gw) * sx);
    const y1 = Math.round((gy + gh) * sy);
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  };

  const isLandlord = kind === 'landlord';
  const outline = THEME.ink.outline;

  // 1. Timber Support Pillars (left and right, extending flush from canopy down to floor gy = 32)
  b(0, 7, outline, 5, 25);
  b(43, 7, outline, 5, 25);
  b(1, 8, '#5c381c', 3, 23);
  b(44, 8, '#5c381c', 3, 23);
  b(1, 8, '#8b572a', 1, 23);
  b(44, 8, '#8b572a', 1, 23);

  // 2. Backboard Shadow Wall behind counter (filling interior between pillars)
  b(5, 8, 'rgba(12, 18, 28, 0.82)', 38, 13);

  // 3. NPC Proprietor standing behind the counter (sized taller & wider to fill the stall interior)
  if (isLandlord) {
    // Royal top hat with gold band
    b(19, 6, outline, 10, 5);
    b(17, 10, outline, 14, 2);
    b(20, 7, '#1e293b', 8, 3);
    b(20, 9, '#facc15', 8, 1);
    // Face + golden monocle
    b(19, 11, outline, 10, 6);
    b(20, 12, THEME.character.skinMid, 8, 4);
    b(21, 13, '#151b26', 1, 2);
    b(25, 12, '#fde047', 2, 3);
    b(25, 13, '#38bdf8', 1, 1);
    // Coat & cravat reaching counter top
    b(17, 16, outline, 14, 5);
    b(18, 17, '#1d4ed8', 12, 4);
    b(23, 17, '#fef08a', 2, 4);
  } else {
    // Sunhat with green ribbon
    b(18, 7, outline, 12, 3);
    b(15, 9, outline, 18, 2);
    b(19, 8, '#eab308', 10, 1);
    b(16, 9, '#fde047', 16, 1);
    b(19, 9, '#16a34a', 10, 1);
    // Cheerful face
    b(19, 10, outline, 10, 6);
    b(20, 11, THEME.character.skinMid, 8, 5);
    b(21, 12, '#151b26', 1, 2);
    b(26, 12, '#151b26', 1, 2);
    b(23, 15, '#b45309', 2, 1);
    // Garden apron & tunic reaching counter top
    b(17, 16, outline, 14, 5);
    b(18, 17, '#15803d', 12, 4);
    b(21, 17, '#dcfce7', 6, 4);
  }

  // 4. Striped Market Awning Canopy (flush with top & sides of 3x2 frame: gx = 0..48, gy = 0..9)
  b(0, 0, outline, 48, 9);
  b(1, 0, isLandlord ? '#facc15' : '#4ade80', 46, 1);
  for (let gx = 1; gx < 47; gx += 4) {
    const idx = Math.floor((gx - 1) / 4);
    const w = Math.min(4, 47 - gx);
    if (isLandlord) {
      const topCol = idx % 2 === 0 ? '#1d4ed8' : '#fef08a';
      const botCol = idx % 2 === 0 ? '#1e3a8a' : '#eab308';
      b(gx, 1, topCol, w, 5);
      b(gx, 6, botCol, w, 2);
    } else {
      const topCol = idx % 2 === 0 ? '#16a34a' : '#fef9c3';
      const botCol = idx % 2 === 0 ? '#15803d' : '#fde047';
      b(gx, 1, topCol, w, 5);
      b(gx, 6, botCol, w, 2);
    }
    // Scalloped valance fringe along awning bottom
    if (idx % 2 === 0) {
      b(gx, 9, outline, w, 2);
      b(gx + 1, 9, isLandlord ? '#facc15' : '#22c55e', Math.max(1, w - 2), 1);
    }
  }

  // 5. Overhead Sign Plaque centered on canopy
  b(13, 2, outline, 22, 5);
  b(14, 3, isLandlord ? '#1e293b' : '#14532d', 20, 3);
  b(15, 4, isLandlord ? '#fde047' : '#bbf7d0', 18, 1);

  // 6. Hanging Lantern (left) & Scale/Emblem (right)
  b(8, 9, outline, 3, 5);
  b(9, 10, '#fde047', 1, 3);
  b(37, 9, outline, 4, 5);
  b(38, 10, isLandlord ? '#38bdf8' : '#f97316', 2, 3);

  // 7. Full-width Market Counter Desk grounded flush to bottom of 3x2 frame (gx = 0..48, gy = 20..32)
  b(0, 20, outline, 48, 12);
  // Counter tabletop
  b(1, 21, isLandlord ? '#eab308' : '#a16207', 46, 2);
  b(1, 21, isLandlord ? '#fef08a' : '#ca8a04', 46, 1);
  // Counter wood body planks extending down to gy = 31 (with outline baseboard at gy = 31..32)
  b(1, 23, '#5c381c', 46, 7);
  for (let px = 5; px < 45; px += 8) {
    b(px, 23, '#3b2112', 1, 7);
    b(px + 1, 23, '#7c4d28', 2, 7);
  }
  b(1, 30, '#2a180d', 46, 1);

  // 8. Countertop Props & Merchandise Displays
  if (isLandlord) {
    // Left: Stacked Realm Deeds & Wax-Sealed Scrolls
    b(5, 16, outline, 9, 5);
    b(6, 17, '#fef3c7', 7, 3);
    b(8, 18, '#ef4444', 2, 2);
    // Center-left: Golden WorldCore Globe
    b(15, 16, outline, 5, 5);
    b(16, 17, '#f59e0b', 3, 3);
    b(17, 17, '#fef08a', 1, 1);
    // Right: Royal Ledger Book & Ink Quill
    b(31, 17, outline, 10, 4);
    b(32, 18, '#7c2d12', 8, 2);
    b(33, 18, '#fef9c3', 6, 1);
    b(39, 14, '#f8fafc', 2, 4);
  } else {
    // Overflowing Fresh Produce Crates along the counter!
    // Crate 1: Crisp Radishes & Sunroot Carrots (left)
    b(3, 16, outline, 11, 5);
    b(4, 17, '#784828', 9, 3);
    b(4, 16, '#e11d48', 3, 2);
    b(5, 15, '#4ade80', 2, 1);
    b(8, 16, '#f97316', 4, 2);
    b(9, 15, '#22c55e', 2, 1);
    // Crate 2: Verdant Cabbages & Ruby Tomatoes (center-left & center-right)
    b(15, 17, outline, 6, 4);
    b(16, 18, '#16a34a', 4, 2);
    b(17, 17, '#86efac', 2, 2);
    b(27, 17, outline, 6, 4);
    b(28, 18, '#dc2626', 4, 2);
    b(29, 17, '#fca5a5', 2, 1);
    // Crate 3: Golden Sweetcorn & Starlight Melons (right)
    b(34, 16, outline, 11, 5);
    b(35, 17, '#784828', 9, 3);
    b(35, 16, '#eab308', 4, 2);
    b(36, 15, '#fef08a', 2, 1);
    b(40, 15, '#0d9488', 4, 3);
    b(41, 16, '#5eead4', 2, 1);

    // Front counter emblem banner ("ALTERBITS MARKET")
    b(15, 24, outline, 18, 5);
    b(16, 25, '#065f46', 16, 3);
    b(18, 26, '#fde047', 12, 1);
  }

  marketStandCache.set(kind, c);
  return c;
}

let pixobyteDigichangeSpriteCache: HTMLCanvasElement | null = null;

/**
 * Renders the 1x2 tile (60x120px) interactive background terminal block "Pixobyte Digichange".
 */
export function getPixobyteDigichangeSprite(): HTMLCanvasElement {
  if (pixobyteDigichangeSpriteCache) return pixobyteDigichangeSpriteCache;
  const width = TILE_PX;
  const height = TILE_PX * 2;
  const [c, ctx] = makeCanvas(width, height);

  // 30x60 logical 2px grid filling the entire 60x120 (1x2 tile) frame
  const b = (gx: number, gy: number, color: string, gw = 1, gh = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(gx * 2, gy * 2, gw * 2, gh * 2);
  };

  const out = '#050b14';
  // Outer armored cryptographic monolith chassis (full 30x60 grid -> 60x120px)
  b(0, 0, out, 30, 60);
  b(1, 1, '#0f172a', 28, 58);
  b(2, 2, '#1e293b', 26, 56);

  // Side neon cyan & violet power conduits
  b(1, 4, '#06b6d4', 1, 52);
  b(28, 4, '#a855f7', 1, 52);

  // Top Header Crown Banner (gy = 2..8): "PIXOBYTE" cryptic marquee
  b(3, 3, out, 24, 6);
  b(4, 4, '#1e1b4b', 22, 4);
  b(6, 5, '#22d3ee', 4, 2);
  b(12, 5, '#a855f7', 6, 2);
  b(20, 5, '#10b981', 4, 2);

  // Upper Holographic Display Screen (gy = 10..31): Live Pixostatic Stock Chart & Coin Emblem
  b(3, 10, out, 24, 22);
  b(4, 11, '#022c22', 22, 20);
  b(5, 12, '#042f2e', 20, 18);

  // Subtle grid lines inside CRT/holo screen
  for (let gy = 15; gy <= 27; gy += 4) {
    b(5, gy, '#064e3b', 20, 1);
  }
  for (let gx = 9; gx <= 21; gx += 4) {
    b(gx, 12, '#064e3b', 1, 18);
  }

  // Stock chart ascending candle/waveform
  b(6, 25, '#10b981', 3, 2);
  b(9, 23, '#10b981', 3, 2);
  b(12, 24, '#f43f5e', 2, 2);
  b(14, 20, '#22d3ee', 3, 2);
  b(17, 17, '#22d3ee', 3, 2);
  b(20, 14, '#a855f7', 4, 2);
  b(23, 13, '#ecfeff', 2, 2);

  // Floating Pixobyte Coin emblem in upper-left of screen
  b(6, 13, out, 7, 7);
  b(7, 14, '#9333ea', 5, 5);
  b(8, 15, '#67e8f9', 3, 3);
  b(9, 16, '#ecfeff', 1, 1);

  // Mid-section Cryptic Bytomerge Slot & Angled Control Console (gy = 33..44)
  b(3, 33, out, 24, 11);
  b(4, 34, '#0f172a', 22, 9);
  // Glowing DigiBit -> Pixobyte merge bridge
  b(6, 36, '#10b981', 5, 3);
  b(12, 37, '#67e8f9', 6, 1);
  b(19, 36, '#a855f7', 5, 3);
  // Tactile terminal keys
  for (let kx = 6; kx <= 21; kx += 5) {
    b(kx, 40, '#38bdf8', 3, 2);
  }

  // Lower Armored Server Pedestal & Floor Plinth (gy = 45..60, flush with deck floor)
  b(2, 45, out, 26, 15);
  b(3, 46, '#1e293b', 24, 12);
  b(5, 48, '#090d16', 20, 8);
  for (let vy = 49; vy <= 54; vy += 2) {
    b(7, vy, '#0e7490', 16, 1);
    b(8, vy, '#22d3ee', 4, 1);
  }
  // Heavy grounded baseplate at gy = 57..60
  b(1, 57, '#334155', 28, 2);
  b(0, 59, out, 30, 1);

  pixobyteDigichangeSpriteCache = c;
  return c;
}

