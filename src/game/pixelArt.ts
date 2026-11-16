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

// 3x pixel-art grid helper (used by crack overlay)
function p3(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 3, y * 3, w * 3, h * 3);
}

// 2x high-detail pixel-art grid helper (used by crack overlay)
function p2(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
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

export function getCrackOverlay(stage: number): HTMLCanvasElement {
  if (crackFrames.length === 0) {
    for (let s = 1; s <= 4; s++) {
      const c48 = document.createElement('canvas');
      c48.width = 48;
      c48.height = 48;
      const ctx48 = c48.getContext('2d')!;
      ctx48.imageSmoothingEnabled = false;

      p3(ctx48, 7, 7, 'rgba(14, 19, 30, 0.85)', 2, 2);
      if (s >= 1) {
        p3(ctx48, 6, 5, 'rgba(14, 19, 30, 0.8)', 1, 2);
        p3(ctx48, 9, 9, 'rgba(14, 19, 30, 0.8)', 1, 2);
      }
      if (s >= 2) {
        p3(ctx48, 4, 3, 'rgba(14, 19, 30, 0.82)', 2, 2);
        p3(ctx48, 10, 11, 'rgba(14, 19, 30, 0.82)', 2, 2);
        p2(ctx48, 7, 6, 'rgba(255, 255, 255, 0.22)', 1, 1);
      }
      if (s >= 3) {
        p3(ctx48, 2, 2, 'rgba(14, 19, 30, 0.86)', 2, 1);
        p3(ctx48, 11, 3, 'rgba(14, 19, 30, 0.86)', 2, 2);
        p3(ctx48, 3, 11, 'rgba(14, 19, 30, 0.86)', 2, 2);
      }
      if (s >= 4) {
        p3(ctx48, 1, 7, 'rgba(14, 19, 30, 0.9)', 3, 1);
        p3(ctx48, 12, 7, 'rgba(14, 19, 30, 0.9)', 3, 1);
        p3(ctx48, 7, 1, 'rgba(14, 19, 30, 0.9)', 2, 3);
        p3(ctx48, 7, 12, 'rgba(14, 19, 30, 0.9)', 2, 3);
      }

      const scaled = document.createElement('canvas');
      scaled.width = TILE_PX;
      scaled.height = TILE_PX;
      const sCtx = scaled.getContext('2d')!;
      sCtx.imageSmoothingEnabled = false;
      sCtx.drawImage(c48, 0, 0, 48, 48, 0, 0, TILE_PX, TILE_PX);
      crackFrames.push(scaled);
    }
  }
  const idx = Math.max(0, Math.min(3, stage - 1));
  return crackFrames[idx];
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

  // Helper on 48x32 logical 3px grid (48 * 3 = 144, 32 * 3 = 96)
  const b = (gx: number, gy: number, color: string, gw = 1, gh = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(gx * 3, gy * 3, gw * 3, gh * 3);
  };

  const isLandlord = kind === 'landlord';
  const outline = THEME.ink.outline;

  // 1. Timber Support Pillars (left and right)
  b(2, 8, outline, 4, 24);
  b(42, 8, outline, 4, 24);
  b(3, 9, '#5c381c', 2, 22);
  b(43, 9, '#5c381c', 2, 22);
  b(3, 9, '#8b572a', 1, 22);
  b(43, 9, '#8b572a', 1, 22);

  // 2. Backboard Shadow Wall behind counter
  b(6, 10, 'rgba(12, 18, 28, 0.72)', 36, 12);

  // 3. NPC Proprietor standing behind the counter (centered around gx = 21..27, gy = 9..21)
  if (isLandlord) {
    // Royal top hat with gold band
    b(20, 8, outline, 8, 5);
    b(19, 12, outline, 10, 2);
    b(21, 9, '#1e293b', 6, 3);
    b(21, 11, '#facc15', 6, 1);
    // Face + golden monocle
    b(20, 13, outline, 8, 5);
    b(21, 14, THEME.character.skinMid, 6, 3);
    b(22, 15, '#151b26', 1, 1);
    b(25, 14, '#fde047', 2, 2);
    b(25, 15, '#38bdf8', 1, 1);
    // Coat & cravat
    b(19, 18, outline, 10, 4);
    b(20, 19, '#1d4ed8', 8, 3);
    b(23, 19, '#fef08a', 2, 3);
  } else {
    // Sunhat with green ribbon
    b(19, 9, outline, 10, 3);
    b(17, 11, outline, 14, 2);
    b(20, 10, '#eab308', 8, 1);
    b(18, 11, '#fde047', 12, 1);
    b(20, 11, '#16a34a', 8, 1);
    // Cheerful face
    b(20, 12, outline, 8, 5);
    b(21, 13, THEME.character.skinMid, 6, 4);
    b(22, 14, '#151b26', 1, 1);
    b(25, 14, '#151b26', 1, 1);
    b(23, 16, '#b45309', 2, 1);
    // Garden apron & tunic
    b(19, 17, outline, 10, 5);
    b(20, 18, '#15803d', 8, 4);
    b(22, 18, '#dcfce7', 4, 4);
  }

  // 4. Striped Market Awning Canopy (top 3 tiles wide: gx = 0..48, gy = 1..10)
  b(0, 1, outline, 48, 9);
  b(1, 1, isLandlord ? '#facc15' : '#4ade80', 46, 1);
  for (let gx = 1; gx < 47; gx += 4) {
    const idx = Math.floor((gx - 1) / 4);
    const w = Math.min(4, 47 - gx);
    if (isLandlord) {
      const topCol = idx % 2 === 0 ? '#1d4ed8' : '#fef08a';
      const botCol = idx % 2 === 0 ? '#1e3a8a' : '#eab308';
      b(gx, 2, topCol, w, 5);
      b(gx, 7, botCol, w, 2);
    } else {
      const topCol = idx % 2 === 0 ? '#16a34a' : '#fef9c3';
      const botCol = idx % 2 === 0 ? '#15803d' : '#fde047';
      b(gx, 2, topCol, w, 5);
      b(gx, 7, botCol, w, 2);
    }
    // Scalloped valance fringe along awning bottom
    if (idx % 2 === 0) {
      b(gx, 10, outline, w, 2);
      b(gx + 1, 10, isLandlord ? '#facc15' : '#22c55e', Math.max(1, w - 2), 1);
    }
  }

  // 5. Overhead Sign Plaque centered on canopy
  b(13, 3, outline, 22, 5);
  b(14, 4, isLandlord ? '#1e293b' : '#14532d', 20, 3);
  b(15, 5, isLandlord ? '#fde047' : '#bbf7d0', 18, 1);

  // 6. Hanging Lantern (left) & Scale/Emblem (right)
  b(9, 10, outline, 3, 5);
  b(10, 11, '#fde047', 1, 3);
  b(36, 10, outline, 4, 5);
  b(37, 11, isLandlord ? '#38bdf8' : '#f97316', 2, 3);

  // 7. Full-width Market Counter Desk (gx = 1..47, gy = 20..32)
  b(1, 20, outline, 46, 12);
  // Counter tabletop
  b(2, 21, isLandlord ? '#eab308' : '#a16207', 44, 2);
  b(2, 21, isLandlord ? '#fef08a' : '#ca8a04', 44, 1);
  // Counter wood body planks
  b(2, 23, '#5c381c', 44, 8);
  for (let px = 6; px < 44; px += 8) {
    b(px, 23, '#3b2112', 1, 8);
    b(px + 1, 23, '#7c4d28', 2, 8);
  }
  b(2, 30, '#2a180d', 44, 1);

  // 8. Countertop Props & Merchandise Displays
  if (isLandlord) {
    // Left: Stacked Realm Deeds & Wax-Sealed Scrolls
    b(6, 16, outline, 9, 5);
    b(7, 17, '#fef3c7', 7, 3);
    b(9, 18, '#ef4444', 2, 2);
    // Center-left: Golden WorldCore Globe
    b(16, 16, outline, 5, 5);
    b(17, 17, '#f59e0b', 3, 3);
    b(18, 17, '#fef08a', 1, 1);
    // Right: Royal Ledger Book & Ink Quill
    b(30, 17, outline, 10, 4);
    b(31, 18, '#7c2d12', 8, 2);
    b(32, 18, '#fef9c3', 6, 1);
    b(38, 14, '#f8fafc', 2, 4);
  } else {
    // Overflowing Fresh Produce Crates along the counter!
    // Crate 1: Crisp Radishes & Sunroot Carrots (left)
    b(4, 16, outline, 11, 5);
    b(5, 17, '#784828', 9, 3);
    b(5, 16, '#e11d48', 3, 2);
    b(6, 15, '#4ade80', 2, 1);
    b(9, 16, '#f97316', 4, 2);
    b(10, 15, '#22c55e', 2, 1);
    // Crate 2: Verdant Cabbages & Ruby Tomatoes (center-left & center-right)
    b(16, 17, outline, 6, 4);
    b(17, 18, '#16a34a', 4, 2);
    b(18, 17, '#86efac', 2, 2);
    b(26, 17, outline, 6, 4);
    b(27, 18, '#dc2626', 4, 2);
    b(28, 17, '#fca5a5', 2, 1);
    // Crate 3: Golden Sweetcorn & Starlight Melons (right)
    b(33, 16, outline, 11, 5);
    b(34, 17, '#784828', 9, 3);
    b(34, 16, '#eab308', 4, 2);
    b(35, 15, '#fef08a', 2, 1);
    b(39, 15, '#0d9488', 4, 3);
    b(40, 16, '#5eead4', 2, 1);

    // Front counter emblem banner ("ALTERBITS MARKET")
    b(15, 24, outline, 18, 5);
    b(16, 25, '#065f46', 16, 3);
    b(18, 26, '#fde047', 12, 1);
  }

  marketStandCache.set(kind, c);
  return c;
}
