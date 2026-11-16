import {
  BLOCKGROVE_ART_THEME as THEME,
  deriveColorRamp,
  mixHex,
  shadeHex,
} from './artTheme.ts';
import { CATALOG, ITEM_IDS } from './catalog.ts';
import {
  drawFarmableBlock32,
  drawFarmableBlock48,
  drawFarmableSeed32,
  drawFarmableSeed48,
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

const TILE_PX = THEME.tileTextureSize; // 48x48

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

// 3x pixel-art grid helper (16x16 virtual grid -> 48x48 canvas)
function p3(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 3, y * 3, w * 3, h * 3);
}

// 2x high-detail pixel-art grid helper (24x24 virtual grid -> 48x48 canvas)
function p2(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
}

// Deterministic hash for per-item procedural pixel details
function itemSeed(id: number, salt = 0): number {
  let h = (id * 2654435761 + salt * 1013904223) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// Richly beveled 16x16 framed panel with corner rivets, inner bevel, and specular sheen
function drawFramedPanel16(
  ctx: CanvasRenderingContext2D,
  baseHex: string,
  opts?: { recessed?: boolean; bolts?: boolean; crystal?: boolean; wood?: boolean }
) {
  const ramp = deriveColorRamp(baseHex);
  const rim = shadeHex(ramp.highlight, 0.18);
  p3(ctx, 0, 0, ramp.outline, 16, 16);
  p3(ctx, 1, 1, ramp.base, 14, 14);
  p3(ctx, 1, 1, opts?.recessed ? ramp.shadow : ramp.highlight, 14, 1);
  p3(ctx, 1, 1, opts?.recessed ? ramp.shadow : ramp.highlight, 1, 14);
  p3(ctx, 2, 1, opts?.recessed ? ramp.base : rim, 5, 1);
  p3(ctx, 1, 14, ramp.deep, 14, 1);
  p3(ctx, 14, 1, ramp.deep, 1, 14);

  p3(ctx, 3, 3, opts?.recessed ? ramp.deep : ramp.shadow, 10, 10);
  p3(ctx, 4, 4, ramp.base, 8, 8);
  if (!opts?.recessed) {
    p3(ctx, 4, 4, ramp.highlight, 7, 1);
    p3(ctx, 4, 4, ramp.highlight, 1, 7);
    p3(ctx, 5, 5, rim, 2, 1);
    p3(ctx, 5, 11, ramp.shadow, 7, 1);
    p3(ctx, 11, 5, ramp.shadow, 1, 7);
    // Diagonal sheen streak across inner face
    p2(ctx, 7, 7, rim, 2, 1);
    p2(ctx, 9, 9, ramp.highlight, 2, 1);
    p2(ctx, 11, 11, ramp.highlight, 2, 1);
  }
  if (opts?.bolts) {
    for (const [bx, by] of [
      [2, 2],
      [13, 2],
      [2, 13],
      [13, 13],
    ]) {
      p3(ctx, bx, by, ramp.deep, 1, 1);
      p2(ctx, Math.round(bx * 1.5), Math.round(by * 1.5), rim, 1, 1);
    }
  }
}

// Rich layered soil body with root tendrils, multi-tone pebbles & strata shading
function drawDirtBody16(ctx: CanvasRenderingContext2D, startRow: number) {
  p3(ctx, 0, startRow, THEME.earth.dirtMid, 16, 16 - startRow);
  // Subtle horizontal depth bands
  for (let y = startRow + 1; y < 15; y += 3) {
    p3(ctx, (y * 3) % 5, y, mixHex(THEME.earth.dirtMid, THEME.earth.dirtDeep, 0.35), 11, 1);
  }
  const pebbles: Array<[number, number, number, number, string]> = [
    [1, 5, 3, 2, THEME.earth.dirtDeep],
    [2, 5, 2, 1, THEME.earth.dirtLit],
    [6, 6, 2, 1, THEME.earth.dirtPebble],
    [10, 6, 4, 2, THEME.earth.dirtDeep],
    [11, 6, 2, 1, THEME.earth.dirtLit],
    [3, 9, 3, 2, THEME.earth.dirtDeep],
    [4, 9, 1, 1, THEME.earth.dirtLit],
    [8, 10, 2, 2, THEME.earth.dirtPebble],
    [13, 10, 2, 2, THEME.earth.dirtDeep],
    [5, 12, 3, 2, THEME.earth.dirtPebble],
    [6, 12, 1, 1, THEME.earth.dirtLit],
    [12, 12, 3, 2, THEME.earth.dirtLit],
    [1, 13, 3, 2, THEME.earth.dirtDeep],
    [8, 14, 3, 1, THEME.earth.dirtPebble],
  ];
  for (const [px, py, pw, ph, col] of pebbles) {
    if (py >= startRow) {
      p3(ctx, px, py, col, pw, ph);
    }
  }
  p3(ctx, 0, 15, THEME.earth.dirtDeep, 16, 1);
  p3(ctx, 0, 0, THEME.ink.outline, 1, 16);
  p3(ctx, 15, 0, THEME.earth.dirtDeep, 1, 16);
}

// Detailed 4-course chiseled masonry with mortar depth, specular chips & weathering
function drawMasonryBricks16(
  ctx: CanvasRenderingContext2D,
  lit: string,
  mid: string,
  deep: string,
  mortar: string
) {
  const rim = shadeHex(lit, 0.16);
  p3(ctx, 0, 0, mortar, 16, 16);
  const rows = [
    { y: 1, h: 3, offset: 0 },
    { y: 5, h: 3, offset: 4 },
    { y: 9, h: 3, offset: 2 },
    { y: 13, h: 2, offset: 6 },
  ];
  rows.forEach((row, rIdx) => {
    for (let bx = -8; bx < 16; bx += 8) {
      const rx = bx + row.offset;
      const sx = Math.max(0, rx + 1);
      const ex = Math.min(16, rx + 8);
      const w = ex - sx;
      if (w <= 0) continue;
      const body = (rIdx + Math.floor(bx / 8)) % 2 === 0 ? mid : mixHex(mid, deep, 0.28);
      p3(ctx, sx, row.y, body, w, row.h);
      p3(ctx, sx, row.y, lit, w, 1);
      if (w >= 3) p3(ctx, sx + 1, row.y, rim, Math.min(2, w - 2), 1);
      p3(ctx, sx, row.y + row.h - 1, deep, w, 1);
      p3(ctx, ex - 1, row.y, deep, 1, row.h);
    }
  });
}

// Rich wood planks with woodgrain rings, iron nails & bevels
function drawWoodPlanks16(ctx: CanvasRenderingContext2D, recessed = false) {
  const hi = recessed ? shadeHex(THEME.wood.lit, -0.22) : THEME.wood.highlight;
  const lit = recessed ? shadeHex(THEME.wood.lit, -0.3) : THEME.wood.lit;
  const mid = recessed ? shadeHex(THEME.wood.mid, -0.28) : THEME.wood.mid;
  const sh = recessed ? shadeHex(THEME.wood.shadow, -0.28) : THEME.wood.shadow;
  const deep = recessed ? '#1c1411' : THEME.wood.deep;

  p3(ctx, 0, 0, mid, 16, 16);
  if (recessed) {
    for (let x = 0; x < 16; x += 4) {
      p3(ctx, x, 0, deep, 1, 16);
      p3(ctx, x + 1, 0, hi, 1, 16);
      p3(ctx, x + 2, 2, lit, 1, 12);
      p3(ctx, x + 2, 4, sh, 1, 5);
      p3(ctx, x + 3, 9, sh, 1, 4);
    }
    p3(ctx, 0, 0, deep, 16, 1);
    p3(ctx, 0, 7, deep, 16, 1);
    p3(ctx, 0, 15, deep, 16, 1);
  } else {
    for (let y = 0; y < 16; y += 5) {
      p3(ctx, 0, y, deep, 16, 1);
      p3(ctx, 0, y + 1, hi, 16, 1);
      p3(ctx, 2, y + 2, lit, 12, 1);
      p3(ctx, 0, y + 4, sh, 16, 1);
      const joint = ((y * 3 + 5) % 11) + 2;
      p3(ctx, joint, y + 1, deep, 1, 4);
      p3(ctx, ((joint + 4) % 12) + 1, y + 2, sh, 4, 1);
      // Iron nail studs
      p2(ctx, 3, Math.min(22, y * 1.5 + 3), deep, 1, 1);
      p2(ctx, 20, Math.min(22, y * 1.5 + 3), deep, 1, 1);
    }
    p3(ctx, 0, 0, THEME.ink.outline, 1, 16);
    p3(ctx, 15, 0, sh, 1, 16);
  }
}

function drawSignPost16(
  ctx: CanvasRenderingContext2D,
  variant: 'oak' | 'crappy' | 'pointy' | 'danger'
) {
  p3(ctx, 6, 9, THEME.ink.outline, 4, 7);
  p3(ctx, 7, 10, THEME.wood.mid, 2, 6);
  p3(ctx, 7, 10, THEME.wood.lit, 1, 5);

  if (variant === 'oak') {
    p3(ctx, 1, 2, THEME.ink.outline, 14, 8);
    p3(ctx, 2, 3, THEME.wood.mid, 12, 6);
    p3(ctx, 2, 3, THEME.wood.highlight, 12, 1);
    p3(ctx, 3, 4, THEME.wood.lit, 10, 4);
    p3(ctx, 2, 8, THEME.wood.shadow, 12, 1);
    p3(ctx, 4, 5, THEME.wood.deep, 8, 1);
    p3(ctx, 4, 7, THEME.wood.deep, 6, 1);
    p3(ctx, 2, 4, THEME.metal.goldMid, 1, 1);
    p3(ctx, 13, 4, THEME.metal.goldMid, 1, 1);
  } else if (variant === 'crappy') {
    p3(ctx, 2, 2, THEME.ink.outline, 12, 4);
    p3(ctx, 3, 3, '#9e7043', 10, 2);
    p3(ctx, 1, 6, THEME.ink.outline, 13, 4);
    p3(ctx, 2, 7, '#7c5330', 11, 2);
    p3(ctx, 7, 3, THEME.metal.steelLit, 1, 1);
    p3(ctx, 7, 7, THEME.metal.steelLit, 1, 1);
  } else if (variant === 'pointy') {
    p3(ctx, 1, 2, THEME.ink.outline, 11, 8);
    p3(ctx, 12, 3, THEME.ink.outline, 2, 6);
    p3(ctx, 14, 5, THEME.ink.outline, 1, 2);
    p3(ctx, 2, 3, THEME.wood.lit, 10, 6);
    p3(ctx, 12, 4, THEME.wood.lit, 1, 4);
    p3(ctx, 2, 3, THEME.wood.highlight, 9, 1);
    p3(ctx, 4, 6, THEME.wood.deep, 6, 1);
  } else {
    p3(ctx, 2, 1, THEME.ink.outline, 12, 9);
    p3(ctx, 3, 2, '#d44832', 10, 7);
    p3(ctx, 3, 2, '#ff9852', 10, 1);
    p3(ctx, 7, 3, '#fff6b3', 2, 3);
    p3(ctx, 7, 7, '#fff6b3', 2, 1);
  }
}

function drawDoor16(ctx: CanvasRenderingContext2D, dungeon: boolean) {
  const frameCol = dungeon ? THEME.stone.shadow : THEME.wood.deep;
  const panelLit = dungeon ? '#725d52' : THEME.wood.lit;
  const panelMid = dungeon ? '#54433b' : THEME.wood.mid;
  const panelDeep = dungeon ? '#302521' : THEME.wood.shadow;

  p3(ctx, 2, 1, THEME.ink.outline, 12, 15);
  p3(ctx, 3, 2, frameCol, 10, 14);
  p3(ctx, 4, 3, panelMid, 8, 13);
  p3(ctx, 4, 3, panelLit, 8, 1);

  if (dungeon) {
    p3(ctx, 4, 5, THEME.stone.abyss, 8, 1);
    p3(ctx, 4, 12, THEME.stone.abyss, 8, 1);
    p3(ctx, 5, 6, THEME.ink.outline, 6, 5);
    p3(ctx, 6, 7, '#111824', 4, 3);
    p3(ctx, 7, 6, THEME.metal.steelMid, 1, 5);
    p3(ctx, 9, 6, THEME.metal.steelMid, 1, 5);
    p3(ctx, 10, 10, THEME.metal.goldLit, 1, 2);
  } else {
    p3(ctx, 5, 4, panelDeep, 6, 4);
    p3(ctx, 6, 5, panelLit, 4, 2);
    p3(ctx, 5, 10, panelDeep, 6, 5);
    p3(ctx, 6, 11, panelLit, 4, 3);
    p3(ctx, 10, 9, THEME.metal.goldLit, 1, 2);
  }
}

function drawFlower16(
  ctx: CanvasRenderingContext2D,
  petalLit: string,
  petalMid: string,
  coreColor: string,
  tall = false
) {
  p3(ctx, 5, 14, THEME.earth.grassDeep, 6, 2);
  p3(ctx, 6, 13, THEME.earth.grassMid, 4, 2);
  const stemTop = tall ? 5 : 6;
  p3(ctx, 7, stemTop, THEME.ink.outline, 3, 14 - stemTop);
  p3(ctx, 7, stemTop, THEME.earth.grassMid, 2, 14 - stemTop);
  p3(ctx, 7, stemTop, THEME.earth.grassLit, 1, 13 - stemTop);
  p3(ctx, 4, 10, THEME.earth.grassLit, 3, 2);
  p3(ctx, 9, 9, THEME.earth.grassLit, 3, 2);
  p3(ctx, 4, stemTop - 3, THEME.ink.outline, 8, 6);
  p3(ctx, 5, stemTop - 2, petalMid, 6, 4);
  p3(ctx, 5, stemTop - 3, petalLit, 6, 2);
  p3(ctx, 7, stemTop - 1, coreColor, 2, 2);
  p2(ctx, 11, (stemTop - 1) * 1.5, '#ffffff', 1, 1);
}

// Draw ornate Share Lock sprites (Micro 150, Small 151, Cover 152)
function drawShareLock16(
  ctx: CanvasRenderingContext2D,
  primary: string,
  secondary: string,
  accent: string,
  pipCount: 1 | 2 | 3
) {
  // Heavy metallic shackle at top
  p3(ctx, 4, 1, THEME.ink.outline, 8, 5);
  p3(ctx, 5, 2, '#9eb5c9', 6, 4);
  p3(ctx, 5, 2, '#eef7ff', 5, 1);
  p3(ctx, 6, 3, THEME.ink.outline, 4, 3);

  // Lock body vault
  p3(ctx, 2, 5, THEME.ink.outline, 12, 10);
  p3(ctx, 3, 6, secondary, 10, 8);
  p3(ctx, 4, 7, primary, 8, 6);
  p3(ctx, 3, 6, accent, 10, 1);
  p3(ctx, 3, 6, accent, 1, 8);

  // Arcane keyhole core
  p3(ctx, 7, 8, THEME.ink.outline, 2, 4);
  p2(ctx, 11, 13, accent, 2, 2);
  p2(ctx, 11, 15, '#ffffff', 2, 2);

  // Tier pips along bottom bezel
  for (let i = 0; i < pipCount; i++) {
    const px = pipCount === 1 ? 7 : pipCount === 2 ? 5 + i * 3 : 4 + i * 3;
    p3(ctx, px, 13, accent, 2, 1);
  }
}

// High-detail 48x48 tile & item sprites
function drawTile48(itemId: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TILE_PX, TILE_PX);
  const def = CATALOG[itemId];
  if (!def) return c;

  // Dedicated 32-bit downscaled pixel art renderers for 40 Farmables (900..939) and 40 Seeds (950..989)
  if (itemId >= 900 && itemId <= 939) {
    if (drawFarmableBlock32(ctx, itemId, def, 48, 48)) {
      return c;
    }
  }
  if (itemId >= 950 && itemId <= 989) {
    if (drawFarmableSeed32(ctx, itemId, def, 48, 48)) {
      return c;
    }
  }

  switch (itemId) {
    case ITEM_IDS.BG_SKY: {
      p3(ctx, 0, 0, THEME.sky.mid, 16, 16);
      p3(ctx, 0, 10, THEME.sky.horizon, 16, 6);
      break;
    }

    case ITEM_IDS.BEDROCK: {
      p3(ctx, 0, 0, THEME.stone.abyss, 16, 16);
      p3(ctx, 0, 0, '#363f54', 16, 2);
      p3(ctx, 0, 0, '#4b5773', 16, 1);
      p3(ctx, 1, 3, '#283042', 6, 4);
      p3(ctx, 2, 3, '#3c465e', 4, 1);
      p3(ctx, 9, 3, '#283042', 6, 5);
      p3(ctx, 10, 3, '#3c465e', 4, 1);
      p3(ctx, 3, 9, '#283042', 7, 5);
      p3(ctx, 4, 9, '#3c465e', 4, 1);
      p3(ctx, 11, 10, '#283042', 4, 4);
      p3(ctx, 0, 15, '#0c0f17', 16, 1);
      break;
    }

    case ITEM_IDS.ENTRANCE_PORTAL: {
      // Sculpted stone archway + swirling dimensional vortex
      p3(ctx, 1, 1, THEME.ink.outline, 14, 15);
      p3(ctx, 2, 2, THEME.stone.mid, 12, 14);
      p3(ctx, 2, 2, THEME.stone.lit, 12, 1);
      p3(ctx, 2, 2, THEME.stone.lit, 1, 14);
      p3(ctx, 3, 3, THEME.stone.shadow, 10, 13);
      // Glowing portal interior
      p3(ctx, 4, 4, '#0b1e30', 8, 12);
      p3(ctx, 5, 5, THEME.arcane.aquaDeep, 6, 10);
      p3(ctx, 6, 6, THEME.arcane.aquaMid, 4, 8);
      p3(ctx, 7, 7, THEME.arcane.aquaLit, 2, 6);
      p2(ctx, 11, 12, '#ffffff', 2, 4);
      // Golden keystone & pillar runes
      p3(ctx, 6, 1, THEME.ink.outline, 4, 3);
      p3(ctx, 7, 1, THEME.metal.goldLit, 2, 2);
      p3(ctx, 2, 7, THEME.arcane.aquaLit, 1, 2);
      p3(ctx, 13, 7, THEME.arcane.aquaLit, 1, 2);
      break;
    }

    case ITEM_IDS.WORLD_CORE: {
      // Ornate obsidian-gold altar housing a levitating radiant sun-core
      p3(ctx, 0, 0, THEME.ink.outline, 16, 16);
      p3(ctx, 1, 1, '#261d30', 14, 14);
      p3(ctx, 1, 1, THEME.metal.goldMid, 14, 2);
      p3(ctx, 1, 13, THEME.metal.goldDeep, 14, 2);
      p3(ctx, 2, 1, THEME.metal.goldLit, 12, 1);
      // Corner golden pillars
      p3(ctx, 1, 3, THEME.metal.goldMid, 2, 10);
      p3(ctx, 13, 3, THEME.metal.goldDeep, 2, 10);
      // Inner arcane chamber
      p3(ctx, 3, 3, '#120d1a', 10, 10);
      // Levitating diamond core
      p3(ctx, 6, 4, THEME.metal.goldMid, 4, 8);
      p3(ctx, 4, 6, THEME.metal.goldMid, 8, 4);
      p3(ctx, 5, 5, THEME.metal.goldLit, 6, 6);
      p3(ctx, 6, 6, '#fff8c4', 4, 4);
      p3(ctx, 7, 7, '#ffffff', 2, 2);
      // Corner energy conduits
      p3(ctx, 4, 4, '#38e8d8', 1, 1);
      p3(ctx, 11, 4, '#38e8d8', 1, 1);
      p3(ctx, 4, 11, '#38e8d8', 1, 1);
      p3(ctx, 11, 11, '#38e8d8', 1, 1);
      break;
    }

    case ITEM_IDS.LANDLORD_NPC: {
      // Steward character in royal blue coat, gold-trimmed top hat, monocle & realm deed scroll
      // Top hat
      p3(ctx, 4, 0, THEME.ink.outline, 8, 4);
      p3(ctx, 3, 3, THEME.ink.outline, 10, 2);
      p3(ctx, 5, 1, '#1e3a5f', 6, 2);
      p3(ctx, 5, 3, THEME.metal.goldLit, 6, 1);
      // Head & face
      p3(ctx, 4, 4, THEME.ink.outline, 8, 6);
      p3(ctx, 5, 5, '#f5cba3', 6, 4);
      p3(ctx, 6, 6, '#151b26', 1, 1);
      p3(ctx, 9, 6, THEME.metal.goldLit, 2, 2); // Monocle rim
      p2(ctx, 14, 10, '#8cf7ee', 1, 1); // Monocle lens glint
      p3(ctx, 5, 8, '#e8eef5', 6, 2); // White steward mustache/beard
      // Royal coat & gold lapels
      p3(ctx, 3, 9, THEME.ink.outline, 10, 7);
      p3(ctx, 4, 10, '#234b7a', 8, 5);
      p3(ctx, 4, 10, '#3e78b8', 2, 5);
      p3(ctx, 7, 10, THEME.metal.goldLit, 2, 4);
      // Rolled parchment deed scroll in hand
      p3(ctx, 11, 9, THEME.ink.outline, 4, 5);
      p3(ctx, 12, 10, '#f7e6b5', 2, 3);
      p3(ctx, 12, 11, '#d9483b', 2, 1);
      break;
    }

    case ITEM_IDS.WORLD_BLAST: {
      // Cosmic violet-gold Terra Blast orb with orbital energy rings
      p3(ctx, 3, 2, THEME.ink.outline, 10, 12);
      p3(ctx, 2, 3, THEME.ink.outline, 12, 10);
      p3(ctx, 4, 3, '#582c83', 8, 10);
      p3(ctx, 3, 4, '#7c42b5', 10, 8);
      p3(ctx, 5, 5, '#b86bff', 6, 6);
      p3(ctx, 6, 6, '#f2b738', 4, 4);
      p3(ctx, 7, 7, '#ffffff', 2, 2);
      // Orbital star sparks
      p3(ctx, 1, 7, '#ffe18c', 2, 2);
      p3(ctx, 13, 7, '#ffe18c', 2, 2);
      p3(ctx, 7, 1, '#8cf7ee', 2, 2);
      p3(ctx, 7, 13, '#8cf7ee', 2, 2);
      break;
    }

    case ITEM_IDS.MICRO_SHARE_LOCK: {
      drawShareLock16(ctx, '#48c6d5', '#15556a', '#b8f8ff', 1);
      break;
    }

    case ITEM_IDS.SMALL_SHARE_LOCK: {
      drawShareLock16(ctx, '#57c887', '#1c5d3e', '#c4ffe0', 2);
      break;
    }

    case ITEM_IDS.COVER_SHARE_LOCK: {
      drawShareLock16(ctx, '#b68aff', '#4d2b78', '#f0deff', 3);
      break;
    }

    case ITEM_IDS.WORLD_LOCK: {
      drawFramedPanel16(ctx, THEME.metal.goldMid, { bolts: true });
      p3(ctx, 6, 3, THEME.metal.goldDeep, 4, 3);
      p3(ctx, 5, 5, THEME.ink.outline, 6, 7);
      p3(ctx, 6, 6, THEME.metal.goldLit, 4, 5);
      p3(ctx, 7, 7, THEME.ink.outline, 2, 2);
      p3(ctx, 7, 9, THEME.ink.outline, 2, 2);
      break;
    }

    case ITEM_IDS.SMALL_LOCK: {
      drawFramedPanel16(ctx, THEME.arcane.emeraldMid, { bolts: true });
      p3(ctx, 5, 5, THEME.ink.outline, 6, 6);
      p3(ctx, 6, 6, THEME.arcane.emeraldRim, 4, 4);
      p3(ctx, 7, 7, THEME.arcane.emeraldDeep, 2, 2);
      break;
    }

    case ITEM_IDS.VENDING_MACHINE: {
      p3(ctx, 1, 0, THEME.ink.outline, 14, 16);
      p3(ctx, 2, 1, '#24588a', 12, 14);
      p3(ctx, 2, 1, '#6bb8f5', 12, 1);
      p3(ctx, 2, 2, '#3677b5', 11, 12);
      // Display glass window
      p3(ctx, 3, 3, THEME.ink.outline, 7, 8);
      p3(ctx, 4, 4, '#10283d', 5, 6);
      p3(ctx, 4, 4, '#8de4ff', 5, 1);
      p3(ctx, 4, 5, '#c4f3ff', 1, 3);
      // Coin slot & keypad
      p3(ctx, 11, 3, THEME.ink.outline, 3, 8);
      p3(ctx, 11, 3, THEME.metal.goldLit, 2, 2);
      p3(ctx, 11, 6, THEME.arcane.emeraldLit, 2, 2);
      p3(ctx, 11, 9, '#ff6b6b', 2, 1);
      // Dispenser chute
      p3(ctx, 3, 12, THEME.ink.outline, 10, 3);
      p3(ctx, 4, 13, '#0d1824', 8, 1);
      break;
    }

    case ITEM_IDS.FIST: {
      p3(ctx, 3, 4, THEME.ink.outline, 10, 8);
      p3(ctx, 4, 5, THEME.character.skinMid, 8, 6);
      p3(ctx, 4, 5, THEME.character.skinHighlight, 6, 2);
      p3(ctx, 6, 5, THEME.character.skinShade, 1, 3);
      p3(ctx, 8, 5, THEME.character.skinShade, 1, 3);
      p3(ctx, 10, 5, THEME.character.skinShade, 1, 3);
      p3(ctx, 3, 9, THEME.character.skinHighlight, 4, 2);
      break;
    }

    case ITEM_IDS.WRENCH: {
      for (let i = 0; i < 7; i++) {
        p3(ctx, 2 + i, 12 - i, THEME.ink.outline, 3, 3);
      }
      for (let i = 0; i < 7; i++) {
        p3(ctx, 3 + i, 12 - i, THEME.metal.steelMid, 2, 2);
        p2(ctx, Math.round((3 + i) * 1.5), Math.round((12 - i) * 1.5), THEME.metal.steelLit, 1, 1);
      }
      p3(ctx, 8, 2, THEME.ink.outline, 6, 6);
      p3(ctx, 9, 3, THEME.metal.steelLit, 4, 4);
      p3(ctx, 11, 3, THEME.ink.outline, 2, 2);
      break;
    }

    case ITEM_IDS.WEAR_GOLD_CROWN: {
      p3(ctx, 2, 8, THEME.ink.outline, 12, 5);
      p3(ctx, 2, 5, THEME.ink.outline, 3, 4);
      p3(ctx, 7, 4, THEME.ink.outline, 2, 5);
      p3(ctx, 11, 5, THEME.ink.outline, 3, 4);
      p3(ctx, 3, 9, THEME.metal.goldMid, 10, 3);
      p3(ctx, 3, 6, THEME.metal.goldLit, 1, 3);
      p3(ctx, 7, 5, THEME.metal.goldRim, 2, 4);
      p3(ctx, 12, 6, THEME.metal.goldLit, 1, 3);
      p3(ctx, 5, 10, '#38e8d8', 1, 1);
      p3(ctx, 7, 10, '#ff4f5e', 2, 1);
      p3(ctx, 10, 10, '#38e8d8', 1, 1);
      break;
    }

    case ITEM_IDS.WEAR_EXPLORER_HAT: {
      p3(ctx, 1, 9, THEME.ink.outline, 14, 3);
      p3(ctx, 3, 4, THEME.ink.outline, 10, 6);
      p3(ctx, 2, 10, THEME.wood.deep, 12, 1);
      p3(ctx, 4, 5, THEME.wood.mid, 8, 4);
      p3(ctx, 5, 5, THEME.wood.lit, 5, 1);
      p3(ctx, 4, 8, THEME.metal.goldMid, 8, 1);
      break;
    }

    case ITEM_IDS.WEAR_CYBER_VISOR: {
      p3(ctx, 1, 5, THEME.ink.outline, 14, 6);
      p3(ctx, 2, 6, '#143c4d', 12, 4);
      p3(ctx, 3, 7, THEME.arcane.aquaMid, 10, 2);
      p3(ctx, 4, 7, THEME.arcane.aquaRim, 4, 1);
      break;
    }

    case ITEM_IDS.WEAR_SKY_WINGS: {
      for (const sx of [1, 9]) {
        p3(ctx, sx, 3, THEME.ink.outline, 6, 10);
        p3(ctx, sx + 1, 4, '#3b82c4', 4, 8);
        p3(ctx, sx + 2, 5, THEME.arcane.aquaLit, 2, 6);
        p3(ctx, sx + 2, 5, '#ffffff', 1, 3);
      }
      break;
    }

    // Natural Terrain & Cavern Blocks
    case ITEM_IDS.GP_DIRT: {
      drawDirtBody16(ctx, 0);
      p3(ctx, 0, 0, THEME.earth.dirtLit, 16, 1);
      break;
    }

    case ITEM_IDS.PLOWED_DIRT_SOIL: {
      drawDirtBody16(ctx, 3);
      // Deep tilled soil furrows along the top surface
      p3(ctx, 0, 0, '#2a180d', 16, 4);
      for (let fx = 0; fx < 16; fx += 4) {
        p3(ctx, fx, 0, '#784828', 2, 2);
        p3(ctx, fx, 0, '#a2673d', 2, 1);
        p3(ctx, fx + 2, 1, '#3b2112', 2, 2);
      }
      p3(ctx, 2, 6, '#4a2c18', 3, 1);
      p3(ctx, 9, 9, '#4a2c18', 4, 1);
      break;
    }

    case ITEM_IDS.FARMING_HOE: {
      for (let i = 0; i < 9; i++) {
        p3(ctx, 2 + i, 13 - i, THEME.ink.outline, 3, 3);
      }
      for (let i = 0; i < 9; i++) {
        p3(ctx, 3 + i, 13 - i, '#8c5830', 2, 2);
        p2(ctx, Math.round((3 + i) * 1.5), Math.round((13 - i) * 1.5), '#c2834f', 1, 1);
      }
      // Curved steel hoe blade
      p3(ctx, 8, 2, THEME.ink.outline, 6, 4);
      p3(ctx, 11, 5, THEME.ink.outline, 3, 4);
      p3(ctx, 9, 3, THEME.metal.steelLit, 4, 2);
      p3(ctx, 12, 5, THEME.metal.steelMid, 1, 3);
      p3(ctx, 12, 7, '#ffffff', 1, 1);
      break;
    }

    case ITEM_IDS.GREENS_VENDOR_NPC: {
      p3(ctx, 1, 1, THEME.ink.outline, 14, 4);
      for (let sx = 2; sx < 14; sx += 2) {
        p3(ctx, sx, 2, (sx / 2) % 2 === 0 ? '#16a34a' : '#fef3c7', 2, 2);
      }
      p3(ctx, 3, 4, '#eab308', 10, 2);
      p3(ctx, 5, 6, THEME.character.skinMid, 6, 4);
      p3(ctx, 6, 7, '#151b26', 1, 1);
      p3(ctx, 9, 7, '#151b26', 1, 1);
      p3(ctx, 4, 10, '#15803d', 8, 5);
      p3(ctx, 5, 11, '#86efac', 6, 3);
      break;
    }

    case ITEM_IDS.CROP_BLOCK_RADISH:
    case ITEM_IDS.CROP_BLOCK_CARROT:
    case ITEM_IDS.CROP_BLOCK_CABBAGE:
    case ITEM_IDS.CROP_BLOCK_TOMATO:
    case ITEM_IDS.CROP_BLOCK_CORN:
    case ITEM_IDS.CROP_BLOCK_MELON: {
      // Lush harvestable crop crate/patch block
      p3(ctx, 1, 9, THEME.ink.outline, 14, 6);
      p3(ctx, 2, 10, '#5c381c', 12, 4);
      p3(ctx, 2, 10, '#7d4e29', 12, 1);
      // Leafy greens crown
      p3(ctx, 2, 2, THEME.ink.outline, 12, 8);
      p3(ctx, 3, 3, '#16a34a', 10, 6);
      p3(ctx, 4, 3, '#4ade80', 8, 3);
      // Vibrant crop produce clusters
      for (const [cx, cy] of [
        [4, 6],
        [8, 5],
        [11, 7],
      ]) {
        p3(ctx, cx, cy, def.colorPrimary, 3, 3);
        p3(ctx, cx, cy, def.colorAccent, 2, 1);
      }
      break;
    }

    case ITEM_IDS.CROP_RADISH:
    case ITEM_IDS.CROP_CARROT:
    case ITEM_IDS.CROP_CABBAGE:
    case ITEM_IDS.CROP_TOMATO:
    case ITEM_IDS.CROP_CORN:
    case ITEM_IDS.CROP_MELON: {
      // Fresh harvested produce icon with leafy top
      p3(ctx, 6, 2, THEME.ink.outline, 5, 4);
      p3(ctx, 7, 3, '#22c55e', 3, 2);
      p3(ctx, 7, 2, '#86efac', 2, 1);
      p3(ctx, 4, 5, THEME.ink.outline, 8, 9);
      p3(ctx, 5, 6, def.colorSecondary, 6, 7);
      p3(ctx, 5, 6, def.colorPrimary, 5, 5);
      p3(ctx, 6, 7, def.colorAccent, 2, 2);
      p3(ctx, 6, 7, '#ffffff', 1, 1);
      break;
    }

    case ITEM_IDS.GP_GRASS: {
      drawDirtBody16(ctx, 4);
      p3(ctx, 0, 0, THEME.earth.grassRim, 16, 1);
      p3(ctx, 0, 1, THEME.earth.grassLit, 16, 2);
      p3(ctx, 0, 3, THEME.earth.grassMid, 16, 1);
      // Lush overhanging grass tufts with individual blades
      for (let x = 0; x < 16; x += 3) {
        const overhang = (x % 2) + 2;
        p3(ctx, x, 4, THEME.earth.grassMid, 2, overhang);
        p3(ctx, x, 3 + overhang, THEME.earth.grassDeep, 2, 1);
        p2(ctx, Math.min(22, Math.round(x * 1.5)), 1, '#d4ff9e', 1, 2);
      }
      break;
    }

    case ITEM_IDS.GP_ROCK: {
      p3(ctx, 0, 0, THEME.stone.shadow, 16, 16);
      // Chiseled multi-facet boulders
      const facets: Array<[number, number, number, number]> = [
        [1, 1, 7, 6],
        [9, 1, 6, 5],
        [1, 8, 5, 7],
        [7, 7, 8, 8],
      ];
      for (const [fx, fy, fw, fh] of facets) {
        p3(ctx, fx, fy, THEME.stone.mid, fw, fh);
        p3(ctx, fx, fy, THEME.stone.lit, fw - 1, 1);
        p3(ctx, fx, fy, THEME.stone.lit, 1, fh - 1);
        p3(ctx, fx + 1, fy + 1, THEME.stone.highlight, Math.max(1, fw - 3), 1);
        p3(ctx, fx, fy + fh - 1, THEME.stone.abyss, fw, 1);
      }
      p3(ctx, 0, 15, THEME.stone.abyss, 16, 1);
      break;
    }

    case ITEM_IDS.GP_SAND: {
      p3(ctx, 0, 0, THEME.earth.sandMid, 16, 16);
      p3(ctx, 0, 0, THEME.earth.sandLit, 16, 2);
      p3(ctx, 1, 4, THEME.earth.sandLit, 7, 1);
      p3(ctx, 2, 5, THEME.earth.sandDeep, 6, 1);
      p3(ctx, 8, 7, THEME.earth.sandLit, 6, 1);
      p3(ctx, 9, 8, THEME.earth.sandDeep, 5, 1);
      p3(ctx, 3, 11, THEME.earth.sandLit, 7, 1);
      p3(ctx, 4, 12, THEME.earth.sandDeep, 6, 1);
      p3(ctx, 0, 15, THEME.earth.sandDeep, 16, 1);
      break;
    }

    case ITEM_IDS.GP_LAVA: {
      p3(ctx, 0, 0, THEME.arcane.emberDeep, 16, 16);
      p3(ctx, 0, 1, THEME.arcane.emberMid, 16, 14);
      p3(ctx, 1, 1, THEME.arcane.emberLit, 7, 4);
      p3(ctx, 2, 2, THEME.arcane.emberRim, 4, 2);
      p3(ctx, 9, 6, THEME.arcane.emberLit, 6, 4);
      p3(ctx, 10, 7, THEME.arcane.emberRim, 3, 2);
      p3(ctx, 2, 10, THEME.arcane.emberLit, 6, 4);
      p3(ctx, 3, 11, '#ffffff', 2, 1);
      break;
    }

    case ITEM_IDS.GP_LAVA_ROCK: {
      p3(ctx, 0, 0, '#221c21', 16, 16);
      p3(ctx, 1, 1, '#3d333b', 6, 6);
      p3(ctx, 2, 1, '#52454f', 4, 1);
      p3(ctx, 9, 1, '#382e36', 6, 6);
      p3(ctx, 1, 9, '#3d333b', 6, 6);
      p3(ctx, 9, 9, '#382e36', 6, 6);
      p3(ctx, 7, 1, THEME.arcane.emberMid, 2, 14);
      p3(ctx, 1, 7, THEME.arcane.emberMid, 14, 2);
      p3(ctx, 6, 7, THEME.arcane.emberLit, 4, 2);
      p3(ctx, 7, 7, THEME.arcane.emberRim, 2, 1);
      break;
    }

    // Backgrounds
    case ITEM_IDS.GP_CAVE_BACKGROUND: {
      p3(ctx, 0, 0, '#2b1f19', 16, 16);
      p3(ctx, 0, 4, '#1f1612', 16, 1);
      p3(ctx, 0, 10, '#1f1612', 16, 1);
      p3(ctx, 2, 1, '#3d2c24', 5, 2);
      p3(ctx, 9, 6, '#3d2c24', 5, 2);
      p3(ctx, 3, 12, '#3d2c24', 6, 2);
      break;
    }

    case ITEM_IDS.GP_WOODEN_BACKGROUND: {
      drawWoodPlanks16(ctx, true);
      break;
    }

    case ITEM_IDS.GP_ROCK_BACKGROUND: {
      drawMasonryBricks16(ctx, '#68717d', '#49505a', '#2c3138', '#1a1e24');
      break;
    }

    // Wood & Bricks
    case ITEM_IDS.GP_WOOD_BLOCK: {
      drawWoodPlanks16(ctx, false);
      break;
    }

    case ITEM_IDS.GP_WOODEN_PLATFORM: {
      p3(ctx, 0, 0, THEME.ink.outline, 16, 5);
      p3(ctx, 0, 1, THEME.wood.lit, 16, 3);
      p3(ctx, 0, 1, THEME.wood.highlight, 16, 1);
      p3(ctx, 1, 5, THEME.ink.outline, 4, 4);
      p3(ctx, 2, 5, THEME.wood.shadow, 2, 3);
      p3(ctx, 11, 5, THEME.ink.outline, 4, 4);
      p3(ctx, 12, 5, THEME.wood.shadow, 2, 3);
      break;
    }

    case ITEM_IDS.GP_BRICKS: {
      drawMasonryBricks16(
        ctx,
        THEME.brick.terracottaLit,
        THEME.brick.terracottaMid,
        THEME.brick.terracottaDeep,
        THEME.brick.mortar
      );
      break;
    }

    case ITEM_IDS.GP_RED_BRICKS: {
      drawMasonryBricks16(
        ctx,
        THEME.brick.crimsonLit,
        THEME.brick.crimsonMid,
        THEME.brick.crimsonDeep,
        THEME.brick.mortar
      );
      break;
    }

    // Doors, Windows & Glass
    case ITEM_IDS.GP_DOOR: {
      drawDoor16(ctx, false);
      break;
    }

    case ITEM_IDS.GP_DUNGEON_DOOR: {
      drawDoor16(ctx, true);
      break;
    }

    // Sci-fi Infusion Space Station Pack (15 items: 6 FG, 6 BG, 1 Door, 2 Platforms)
    case ITEM_IDS.SCIFI_ORBITAL_HULL: {
      drawFramedPanel16(ctx, '#64748b', { bolts: true });
      p3(ctx, 2, 7, '#1e293b', 12, 2);
      p3(ctx, 3, 7, '#cbd5e1', 10, 1);
      break;
    }

    case ITEM_IDS.SCIFI_AIRLOCK_FRAME: {
      drawFramedPanel16(ctx, '#475569', { bolts: true });
      p3(ctx, 3, 2, '#0f172a', 10, 12);
      p3(ctx, 4, 3, '#334155', 8, 10);
      p3(ctx, 3, 3, '#38e8d8', 2, 2);
      p3(ctx, 11, 3, '#38e8d8', 2, 2);
      p3(ctx, 3, 11, '#38e8d8', 2, 2);
      p3(ctx, 11, 11, '#38e8d8', 2, 2);
      p3(ctx, 6, 5, '#1e293b', 4, 6);
      p3(ctx, 7, 6, '#38bdf8', 2, 4);
      break;
    }

    case ITEM_IDS.SCIFI_CRYO_PANEL: {
      drawFramedPanel16(ctx, '#1e3a5f', { bolts: true });
      p3(ctx, 3, 3, '#0c4a6e', 10, 10);
      p3(ctx, 4, 4, '#0284c7', 8, 8);
      p3(ctx, 5, 5, '#38bdf8', 6, 6);
      p3(ctx, 6, 6, '#bae6fd', 4, 3);
      p3(ctx, 6, 6, '#ffffff', 2, 1);
      break;
    }

    case ITEM_IDS.SCIFI_SOLAR_LATTICE: {
      p3(ctx, 0, 0, THEME.ink.outline, 16, 16);
      p3(ctx, 1, 1, '#1e293b', 14, 14);
      p3(ctx, 1, 1, '#94a3b8', 14, 1);
      for (const [cx0, cy0] of [
        [2, 2],
        [9, 2],
        [2, 9],
        [9, 9],
      ]) {
        p3(ctx, cx0, cy0, '#0f172a', 5, 5);
        p3(ctx, cx0, cy0, '#1d4ed8', 5, 4);
        p3(ctx, cx0, cy0, '#3b82f6', 4, 2);
        p3(ctx, cx0 + 1, cy0 + 1, '#93c5fd', 2, 1);
      }
      p3(ctx, 7, 2, '#64748b', 2, 12);
      p3(ctx, 2, 7, '#64748b', 12, 2);
      break;
    }

    case ITEM_IDS.SCIFI_VIEWGLASS: {
      p3(ctx, 0, 0, THEME.ink.outline, 16, 16);
      p3(ctx, 1, 1, '#475569', 14, 14);
      p3(ctx, 2, 2, 'rgba(56, 189, 248, 0.34)', 12, 12);
      ctx.clearRect(6, 6, 36, 36);
      ctx.fillStyle = 'rgba(125, 211, 252, 0.30)';
      ctx.fillRect(6, 6, 36, 36);
      p3(ctx, 1, 1, '#94a3b8', 3, 2);
      p3(ctx, 12, 1, '#94a3b8', 3, 2);
      p3(ctx, 1, 13, '#64748b', 3, 2);
      p3(ctx, 12, 13, '#64748b', 3, 2);
      p3(ctx, 3, 3, '#e0f2fe', 3, 1);
      p3(ctx, 3, 4, '#ffffff', 1, 2);
      p3(ctx, 10, 11, '#bae6fd', 2, 1);
      break;
    }

    case ITEM_IDS.SCIFI_ION_CONDUIT: {
      p3(ctx, 0, 0, THEME.ink.outline, 16, 16);
      p3(ctx, 1, 1, '#1e293b', 14, 14);
      p3(ctx, 1, 1, '#475569', 14, 3);
      p3(ctx, 1, 12, '#0f172a', 14, 3);
      // Glowing central plasma rail
      p3(ctx, 1, 6, '#0e7490', 14, 4);
      p3(ctx, 1, 7, '#22d3ee', 14, 2);
      p3(ctx, 3, 7, '#ecfeff', 4, 1);
      p3(ctx, 10, 7, '#ecfeff', 3, 1);
      p3(ctx, 7, 2, '#64748b', 2, 3);
      p3(ctx, 7, 11, '#334155', 2, 3);
      break;
    }

    case ITEM_IDS.SCIFI_BULKHEAD_BG: {
      p3(ctx, 0, 0, '#0f172a', 16, 16);
      p3(ctx, 1, 1, '#263344', 14, 14);
      for (const rx of [2, 6, 10]) {
        p3(ctx, rx, 2, '#1e293b', 3, 12);
        p3(ctx, rx, 2, '#475569', 1, 12);
      }
      p3(ctx, 1, 7, '#151b26', 14, 2);
      p3(ctx, 1, 7, '#64748b', 14, 1);
      break;
    }

    case ITEM_IDS.SCIFI_TELEMETRY_BG: {
      p3(ctx, 0, 0, '#090e17', 16, 16);
      p3(ctx, 1, 1, '#1e293b', 14, 14);
      p3(ctx, 2, 2, '#0b1524', 12, 12);
      p3(ctx, 3, 4, '#0891b2', 5, 2);
      p3(ctx, 3, 4, '#38e8d8', 3, 1);
      p3(ctx, 9, 4, '#f59e0b', 4, 2);
      p3(ctx, 3, 8, '#1e3a5f', 10, 1);
      p3(ctx, 3, 10, '#22d3ee', 2, 2);
      p3(ctx, 6, 9, '#22d3ee', 2, 3);
      p3(ctx, 9, 10, '#38bdf8', 2, 2);
      p3(ctx, 12, 8, '#38e8d8', 1, 4);
      break;
    }

    case ITEM_IDS.SCIFI_STARFIELD_BG: {
      p3(ctx, 0, 0, '#0f172a', 16, 16);
      p3(ctx, 1, 1, '#334155', 14, 14);
      p3(ctx, 2, 2, '#050914', 12, 12);
      p3(ctx, 3, 4, '#0f1d3a', 10, 6);
      p3(ctx, 4, 3, '#ffffff', 1, 1);
      p3(ctx, 11, 4, '#bae6fd', 1, 1);
      p3(ctx, 7, 7, '#38e8d8', 2, 1);
      p3(ctx, 5, 11, '#ffffff', 1, 1);
      p3(ctx, 12, 10, '#7dd3fc', 1, 1);
      p3(ctx, 3, 8, '#38bdf8', 1, 1);
      break;
    }

    case ITEM_IDS.SCIFI_POWER_SPINE_BG: {
      p3(ctx, 0, 0, '#0f172a', 16, 16);
      p3(ctx, 1, 1, '#1e293b', 14, 14);
      p3(ctx, 4, 0, '#0b1524', 8, 16);
      p3(ctx, 5, 0, '#0e7490', 6, 16);
      p3(ctx, 6, 0, '#22d3ee', 4, 16);
      p3(ctx, 7, 1, '#ecfeff', 2, 14);
      p3(ctx, 3, 4, '#64748b', 10, 2);
      p3(ctx, 3, 10, '#64748b', 10, 2);
      break;
    }

    case ITEM_IDS.SCIFI_QUARANTINE_BG: {
      p3(ctx, 0, 0, '#334155', 16, 16);
      p3(ctx, 1, 1, '#cbd5e1', 14, 14);
      p3(ctx, 1, 1, '#f8fafc', 14, 2);
      p3(ctx, 2, 6, '#94a3b8', 12, 1);
      p3(ctx, 2, 11, '#94a3b8', 12, 1);
      p3(ctx, 11, 3, '#0891b2', 3, 2);
      break;
    }

    case ITEM_IDS.SCIFI_HEX_REACTOR_BG: {
      p3(ctx, 0, 0, '#090e17', 16, 16);
      p3(ctx, 1, 1, '#273549', 14, 14);
      for (const ly of [3, 7, 11]) {
        p3(ctx, 2, ly, '#090e17', 12, 3);
        p3(ctx, 3, ly + 1, '#0e7490', 10, 1);
        p3(ctx, 5, ly + 1, '#38bdf8', 6, 1);
      }
      break;
    }

    case ITEM_IDS.SCIFI_AIRLOCK_DOOR: {
      // Pressurized sci-fi station blast doorway with glowing cyan lock seam
      p3(ctx, 2, 0, THEME.ink.outline, 12, 16);
      p3(ctx, 3, 1, '#475569', 10, 14);
      p3(ctx, 3, 1, '#94a3b8', 10, 1);
      // Inner recessed blast leaves
      p3(ctx, 4, 3, '#1e293b', 8, 12);
      p3(ctx, 4, 3, '#334155', 3, 12);
      p3(ctx, 9, 3, '#334155', 3, 12);
      // Center luminous lock seal + header diode
      p3(ctx, 7, 3, '#0e7490', 2, 12);
      p3(ctx, 7, 4, '#38e8d8', 2, 9);
      p3(ctx, 7, 2, '#67e8f9', 2, 1);
      p3(ctx, 5, 7, '#0f172a', 2, 3);
      p3(ctx, 9, 7, '#0f172a', 2, 3);
      break;
    }

    case ITEM_IDS.SCIFI_HOVER_PLATFORM: {
      // Pass-through solid top alloy grate + twin repulsor thrusters beneath
      p3(ctx, 0, 0, THEME.ink.outline, 16, 5);
      p3(ctx, 0, 1, '#64748b', 16, 3);
      p3(ctx, 0, 1, '#cbd5e1', 16, 1);
      p3(ctx, 2, 2, '#1e293b', 2, 1);
      p3(ctx, 7, 2, '#1e293b', 2, 1);
      p3(ctx, 12, 2, '#1e293b', 2, 1);
      // Twin underside repulsor emitters
      p3(ctx, 2, 5, THEME.ink.outline, 4, 3);
      p3(ctx, 3, 5, '#38bdf8', 2, 2);
      p3(ctx, 10, 5, THEME.ink.outline, 4, 3);
      p3(ctx, 11, 5, '#38bdf8', 2, 2);
      break;
    }

    case ITEM_IDS.SCIFI_HOLO_CATWALK: {
      // Jump-through hard-light cyan energy beam between compact emitter brackets
      p3(ctx, 0, 0, THEME.ink.outline, 16, 4);
      p3(ctx, 0, 1, '#0891b2', 16, 2);
      p3(ctx, 2, 1, '#67e8f9', 12, 1);
      p3(ctx, 4, 2, '#ecfeff', 8, 1);
      // Left & right projector end-caps
      p3(ctx, 0, 0, '#334155', 2, 5);
      p3(ctx, 14, 0, '#334155', 2, 5);
      p3(ctx, 1, 1, '#cbd5e1', 1, 2);
      p3(ctx, 14, 1, '#cbd5e1', 1, 2);
      break;
    }

    case ITEM_IDS.GP_WINDOW: {
      p3(ctx, 1, 1, THEME.ink.outline, 14, 14);
      p3(ctx, 2, 2, THEME.wood.mid, 12, 12);
      p3(ctx, 2, 2, THEME.wood.lit, 12, 1);
      p3(ctx, 3, 3, 'rgba(138, 224, 255, 0.78)', 10, 10);
      p3(ctx, 4, 4, '#ffffff', 3, 1);
      p3(ctx, 4, 5, '#ffffff', 1, 2);
      p3(ctx, 10, 10, '#ffffff', 2, 1);
      p3(ctx, 7, 2, THEME.wood.deep, 2, 12);
      p3(ctx, 2, 7, THEME.wood.deep, 12, 2);
      break;
    }

    case ITEM_IDS.GP_GLASS_PANE: {
      p3(ctx, 1, 1, '#3e879c', 14, 14);
      p3(ctx, 2, 2, 'rgba(182, 243, 255, 0.58)', 12, 12);
      p3(ctx, 3, 3, '#ffffff', 4, 1);
      p3(ctx, 3, 4, '#ffffff', 1, 3);
      p3(ctx, 10, 11, '#ffffff', 3, 1);
      break;
    }

    case ITEM_IDS.GP_GLASS_BLOCK: {
      p3(ctx, 0, 0, '#2e6f82', 16, 16);
      p3(ctx, 1, 1, '#9be5f5', 14, 14);
      p3(ctx, 2, 2, 'rgba(215, 252, 255, 0.72)', 12, 12);
      p3(ctx, 3, 3, '#ffffff', 4, 2);
      p3(ctx, 10, 10, '#ffffff', 3, 2);
      break;
    }

    // Signs
    case ITEM_IDS.GP_SIGN: {
      drawSignPost16(ctx, 'oak');
      break;
    }
    case ITEM_IDS.GP_CRAPPY_SIGN: {
      drawSignPost16(ctx, 'crappy');
      break;
    }
    case ITEM_IDS.GP_POINTY_SIGN: {
      drawSignPost16(ctx, 'pointy');
      break;
    }
    case ITEM_IDS.GP_DANGER_SIGN: {
      drawSignPost16(ctx, 'danger');
      break;
    }

    // Flora & Botanicals
    case ITEM_IDS.GP_DAISY: {
      drawFlower16(ctx, '#fffef0', '#f5e898', '#f2b738', false);
      break;
    }
    case ITEM_IDS.GP_ROSE: {
      drawFlower16(ctx, '#ff7597', '#c83d62', '#821c3a', true);
      break;
    }
    case ITEM_IDS.GP_POPPY: {
      drawFlower16(ctx, '#ff857a', '#e34b4b', '#261e26', false);
      break;
    }
    case ITEM_IDS.GP_MUSHROOM: {
      p3(ctx, 5, 9, THEME.ink.outline, 6, 6);
      p3(ctx, 6, 9, '#f2e8d5', 4, 5);
      p3(ctx, 3, 3, THEME.ink.outline, 10, 6);
      p3(ctx, 4, 4, '#c8453b', 8, 4);
      p3(ctx, 5, 4, '#ff7869', 6, 1);
      p3(ctx, 5, 6, '#fff7e8', 2, 1);
      p3(ctx, 9, 5, '#fff7e8', 2, 1);
      break;
    }
    case ITEM_IDS.GP_WHEAT: {
      for (const sx of [3, 7, 11]) {
        p3(ctx, sx, 7, '#a8842a', 2, 8);
        p3(ctx, sx, 2, '#d9b84c', 2, 6);
        p3(ctx, sx, 2, '#fff099', 1, 4);
      }
      p3(ctx, 3, 11, '#754d29', 10, 1);
      break;
    }
    case ITEM_IDS.GP_BUSH: {
      p3(ctx, 2, 5, THEME.ink.outline, 12, 10);
      p3(ctx, 3, 3, THEME.ink.outline, 10, 12);
      p3(ctx, 3, 5, THEME.earth.grassDeep, 10, 9);
      p3(ctx, 4, 4, THEME.earth.grassMid, 8, 8);
      p3(ctx, 5, 4, THEME.earth.grassLit, 6, 3);
      p3(ctx, 6, 4, THEME.earth.grassRim, 3, 1);
      break;
    }
    case ITEM_IDS.GP_HEDGE: {
      drawFramedPanel16(ctx, THEME.earth.grassMid);
      p3(ctx, 4, 4, THEME.earth.grassLit, 3, 2);
      p3(ctx, 9, 6, THEME.earth.grassDeep, 2, 2);
      p3(ctx, 5, 9, THEME.earth.grassLit, 3, 2);
      break;
    }
    case ITEM_IDS.GP_BLUEBERRY: {
      p3(ctx, 2, 4, THEME.ink.outline, 12, 11);
      p3(ctx, 3, 5, THEME.earth.grassDeep, 10, 9);
      p3(ctx, 4, 5, THEME.earth.grassMid, 8, 7);
      for (const [bx, by] of [
        [4, 7],
        [9, 6],
        [6, 10],
        [10, 10],
      ]) {
        p3(ctx, bx, by, '#1c2b59', 3, 3);
        p3(ctx, bx + 1, by + 1, '#58a6ff', 1, 1);
      }
      break;
    }

    // Props & Hazards
    case ITEM_IDS.GP_TOILET: {
      p3(ctx, 3, 2, THEME.ink.outline, 6, 7);
      p3(ctx, 4, 3, '#f2f5f7', 4, 5);
      p3(ctx, 2, 4, THEME.metal.steelMid, 2, 1);
      p3(ctx, 5, 8, THEME.ink.outline, 8, 7);
      p3(ctx, 6, 9, '#e3e8eb', 6, 3);
      p3(ctx, 6, 12, '#c7cfd4', 5, 3);
      break;
    }

    case ITEM_IDS.GP_DEATH_SPIKES: {
      p3(ctx, 0, 13, THEME.ink.outline, 16, 3);
      p3(ctx, 1, 14, THEME.stone.shadow, 14, 2);
      for (const sx of [1, 6, 11]) {
        p3(ctx, sx, 8, THEME.ink.outline, 4, 5);
        p3(ctx, sx + 1, 3, THEME.ink.outline, 2, 6);
        p3(ctx, sx + 1, 8, THEME.metal.steelMid, 2, 5);
        p3(ctx, sx + 1, 5, THEME.metal.steelLit, 1, 4);
        p3(ctx, sx + 1, 3, '#ff4d4d', 2, 2);
      }
      break;
    }

    // --- Desert Blast Biome Blocks (700..707) ---
    case ITEM_IDS.DESERT_SAND: {
      // Wind-rippled golden dune sand with fine stippled sand grains
      p3(ctx, 0, 0, '#e6b85c', 16, 16);
      p3(ctx, 0, 0, '#ffdf88', 16, 2);
      // Sweeping diagonal wind ripples
      p3(ctx, 1, 3, '#c9933b', 6, 1);
      p3(ctx, 7, 4, '#c9933b', 7, 1);
      p3(ctx, 2, 7, '#f7d176', 7, 1);
      p3(ctx, 9, 8, '#c9933b', 6, 1);
      p3(ctx, 0, 11, '#c9933b', 8, 1);
      p3(ctx, 8, 12, '#f7d176', 6, 1);
      p3(ctx, 0, 14, '#b37a2b', 16, 2);
      // Individual sand grain flecks
      for (const [gx, gy, gc] of [
        [3, 5, '#fff0b3'], [11, 2, '#fff0b3'], [5, 9, '#9e6820'],
        [13, 6, '#9e6820'], [2, 13, '#fff0b3'], [12, 14, '#9e6820'],
      ] as const) {
        p3(ctx, gx, gy, gc, 1, 1);
      }
      break;
    }
    case ITEM_IDS.SALT_CRUST: {
      // Chalk-white crystallized salt flat with polygonal desiccation cracks & crystal glints
      p3(ctx, 0, 0, '#dbe4ec', 16, 16);
      p3(ctx, 0, 0, '#ffffff', 16, 2);
      p3(ctx, 0, 14, '#9eb0c2', 16, 2);
      // Hexagonal salt crust fracture lines
      p3(ctx, 4, 2, '#7c91a6', 1, 5);
      p3(ctx, 5, 7, '#7c91a6', 5, 1);
      p3(ctx, 10, 3, '#7c91a6', 1, 8);
      p3(ctx, 11, 6, '#7c91a6', 5, 1);
      p3(ctx, 1, 9, '#7c91a6', 5, 1);
      p3(ctx, 6, 10, '#7c91a6', 1, 5);
      p3(ctx, 12, 11, '#7c91a6', 1, 4);
      // Sparkling white crystal cubes
      p3(ctx, 2, 4, '#ffffff', 2, 2);
      p3(ctx, 7, 3, '#ffffff', 2, 1);
      p3(ctx, 13, 8, '#ffffff', 2, 2);
      p3(ctx, 3, 12, '#f0f7ff', 2, 1);
      break;
    }
    case ITEM_IDS.RED_SANDSTONE: {
      // Sedimentary red-rock horizontal canyon strata (distinct from brick masonry)
      const bands: Array<[number, number, string]> = [
        [0, 3, '#c8603a'],
        [3, 2, '#a34424'],
        [5, 4, '#d97448'],
        [9, 2, '#8a3519'],
        [11, 3, '#be5834'],
        [14, 2, '#732912'],
      ];
      for (const [by, bh, col] of bands) {
        p3(ctx, 0, by, col, 16, bh);
      }
      // Subtle sunlit upper rim & eroded pits
      p3(ctx, 0, 0, '#f09465', 16, 1);
      p3(ctx, 3, 6, '#f09465', 4, 1);
      p3(ctx, 10, 6, '#732912', 3, 1);
      p3(ctx, 4, 12, '#732912', 3, 1);
      p3(ctx, 11, 12, '#e68356', 3, 1);
      break;
    }
    case ITEM_IDS.DESERT_HARDPAN: {
      // Sun-baked parched clay mudflat with wide cracked plates
      p3(ctx, 0, 0, '#9a5a32', 16, 16);
      p3(ctx, 1, 1, '#b56e40', 6, 5);
      p3(ctx, 9, 1, '#ab6539', 6, 6);
      p3(ctx, 1, 8, '#a66137', 7, 6);
      p3(ctx, 10, 9, '#b56e40', 5, 5);
      // Sunlit curled edges along deep cracks
      p3(ctx, 7, 0, '#4f2814', 2, 8);
      p3(ctx, 0, 6, '#4f2814', 16, 2);
      p3(ctx, 8, 8, '#4f2814', 2, 8);
      p3(ctx, 2, 2, '#cf8555', 4, 1);
      p3(ctx, 10, 2, '#cf8555', 4, 1);
      p3(ctx, 2, 9, '#cf8555', 5, 1);
      break;
    }
    case ITEM_IDS.DUNE_GRASS: {
      p3(ctx, 0, 0, '#d9b96b', 16, 16);
      p3(ctx, 0, 5, '#c29e4f', 16, 11);
      // Tufted arid sage-olive scrub blades along crest
      p3(ctx, 0, 0, '#5a6328', 16, 4);
      for (const sx of [1, 5, 9, 13]) {
        p3(ctx, sx, 0, '#a9a64c', 2, 4);
        p3(ctx, sx, 0, '#dedb7c', 1, 2);
      }
      p3(ctx, 3, 8, '#a37e37', 4, 1);
      p3(ctx, 10, 11, '#a37e37', 4, 1);
      break;
    }
    case ITEM_IDS.CACTUS: {
      p3(ctx, 3, 0, THEME.ink.outline, 10, 16);
      p3(ctx, 4, 1, '#28613b', 8, 14);
      p3(ctx, 5, 1, '#4f9b55', 6, 14);
      p3(ctx, 6, 1, '#9cdb79', 2, 14);
      p3(ctx, 2, 4, '#fff6a3', 1, 1);
      p3(ctx, 13, 6, '#fff6a3', 1, 1);
      p3(ctx, 2, 11, '#fff6a3', 1, 1);
      break;
    }
    case ITEM_IDS.DRY_ROOT: {
      // Sun-bleached tangled desert root & scrub earth
      p3(ctx, 0, 0, '#a8844c', 16, 16);
      p3(ctx, 0, 0, '#c7a267', 16, 2);
      p3(ctx, 6, 1, '#47301e', 4, 14);
      p3(ctx, 7, 2, '#785435', 2, 12);
      p3(ctx, 2, 5, '#47301e', 5, 2);
      p3(ctx, 3, 5, '#8f6743', 3, 1);
      p3(ctx, 9, 8, '#47301e', 5, 2);
      p3(ctx, 10, 8, '#8f6743', 3, 1);
      p3(ctx, 2, 12, '#47301e', 4, 2);
      break;
    }
    case ITEM_IDS.DESERT_GRAVEL:
    case ITEM_IDS.CAVE_GRAVEL: {
      // Loose rounded pebble conglomerate (no smooth box frame)
      const ramp = deriveColorRamp(def.colorPrimary);
      p3(ctx, 0, 0, ramp.deep, 16, 16);
      const stones: Array<[number, number, number, number]> = [
        [1, 1, 5, 4], [7, 1, 6, 3], [13, 2, 3, 4],
        [0, 6, 4, 4], [5, 5, 5, 5], [11, 6, 5, 4],
        [2, 11, 5, 4], [8, 11, 4, 4], [12, 10, 4, 5],
      ];
      stones.forEach(([gx, gy, gw, gh], idx) => {
        p3(ctx, gx, gy, idx % 2 === 0 ? ramp.base : ramp.shadow, gw, gh);
        p3(ctx, gx, gy, ramp.highlight, Math.max(1, gw - 1), 1);
        p3(ctx, gx, gy + gh - 1, ramp.outline, gw, 1);
      });
      break;
    }

    // --- Arctic Tundra Biome Blocks (720..727) ---
    case ITEM_IDS.FROST_SNOW: {
      // Soft drifted powder snow with gentle shadow curves
      p3(ctx, 0, 0, '#e8f5ff', 16, 16);
      p3(ctx, 0, 0, '#ffffff', 16, 3);
      p3(ctx, 0, 6, '#c6e2f7', 7, 2);
      p3(ctx, 7, 8, '#c6e2f7', 9, 2);
      p3(ctx, 0, 12, '#a8cee8', 16, 4);
      p3(ctx, 3, 4, '#ffffff', 4, 1);
      p3(ctx, 11, 5, '#ffffff', 3, 1);
      break;
    }
    case ITEM_IDS.PACKED_SNOW: {
      // Dense compressed igloo-cut snow blocks with cool cyan seams
      p3(ctx, 0, 0, '#b5d6eb', 16, 16);
      p3(ctx, 0, 1, '#dceefa', 7, 6);
      p3(ctx, 8, 1, '#d0e8f7', 7, 6);
      p3(ctx, 0, 8, '#d0e8f7', 4, 7);
      p3(ctx, 5, 8, '#dceefa', 10, 7);
      p3(ctx, 1, 1, '#ffffff', 5, 1);
      p3(ctx, 6, 8, '#ffffff', 6, 1);
      p3(ctx, 0, 7, '#8db8d6', 16, 1);
      p3(ctx, 7, 0, '#8db8d6', 1, 7);
      p3(ctx, 4, 8, '#8db8d6', 1, 8);
      break;
    }
    case ITEM_IDS.GLACIER_ICE: {
      // Clear pale cyan glacier ice with crisp diagonal specular streaks
      p3(ctx, 0, 0, '#74ccf2', 16, 16);
      p3(ctx, 0, 0, '#b8f0ff', 16, 2);
      p3(ctx, 2, 3, '#e6fcff', 4, 2);
      p3(ctx, 4, 5, '#ffffff', 3, 2);
      p3(ctx, 9, 8, '#b8f0ff', 5, 2);
      p3(ctx, 11, 10, '#ffffff', 2, 2);
      p3(ctx, 0, 14, '#3e96c4', 16, 2);
      break;
    }
    case ITEM_IDS.BLUE_ICE: {
      // Deep sapphire dense ice with crystalline internal fractures
      p3(ctx, 0, 0, '#2a6bb8', 16, 16);
      p3(ctx, 1, 1, '#3d86db', 14, 14);
      p3(ctx, 2, 2, '#73b8ff', 6, 2);
      p3(ctx, 7, 4, '#b8e2ff', 2, 6);
      p3(ctx, 9, 9, '#73b8ff', 5, 2);
      p3(ctx, 3, 11, '#1c4a85', 5, 2);
      p3(ctx, 0, 14, '#153969', 16, 2);
      break;
    }
    case ITEM_IDS.PERMAFROST: {
      // Dark frozen turf capped by icy frost crust & ice shards
      drawDirtBody16(ctx, 3);
      p3(ctx, 0, 0, '#ffffff', 16, 2);
      p3(ctx, 0, 2, '#7fd9f2', 16, 2);
      p3(ctx, 3, 4, '#54b4d4', 3, 2);
      p3(ctx, 10, 4, '#54b4d4', 4, 2);
      p3(ctx, 6, 9, '#7fd9f2', 3, 1);
      break;
    }
    case ITEM_IDS.FROZEN_DIRT: {
      // Cold slate-brown soil speckled with rime frost crystals
      drawDirtBody16(ctx, 0);
      p3(ctx, 0, 0, '#8db4c9', 16, 1);
      for (const [fx, fy] of [[2, 3], [8, 5], [12, 2], [4, 10], [11, 12]] as const) {
        p3(ctx, fx, fy, '#d8f4ff', 2, 1);
      }
      break;
    }
    case ITEM_IDS.FROST_ROCK: {
      // Jagged cold blue-grey rock with frozen cyan veins & top frost rim
      p3(ctx, 0, 0, '#46586e', 16, 16);
      p3(ctx, 0, 0, '#c9ecff', 16, 2);
      p3(ctx, 1, 3, '#637a94', 6, 5);
      p3(ctx, 8, 2, '#5a6f87', 7, 6);
      p3(ctx, 2, 9, '#556980', 7, 6);
      p3(ctx, 10, 9, '#637a94', 5, 6);
      // Icy blue mineral fissures
      p3(ctx, 6, 4, '#8fe8ff', 2, 5);
      p3(ctx, 3, 8, '#8fe8ff', 5, 1);
      p3(ctx, 11, 11, '#8fe8ff', 3, 1);
      p3(ctx, 0, 15, '#2b3747', 16, 1);
      break;
    }
    case ITEM_IDS.CAVE_LIMESTONE: {
      // Pale buff chalky limestone with horizontal bedding joints & pitted pores
      p3(ctx, 0, 0, '#b8b09c', 16, 16);
      p3(ctx, 0, 0, '#ded7c3', 16, 2);
      p3(ctx, 0, 5, '#8a8270', 16, 1);
      p3(ctx, 0, 11, '#8a8270', 16, 1);
      p3(ctx, 6, 1, '#9c9480', 1, 4);
      p3(ctx, 11, 6, '#9c9480', 1, 5);
      p3(ctx, 3, 12, '#9c9480', 1, 4);
      // Karst pores & fossil specks
      for (const [px, py] of [[3, 3], [12, 2], [5, 8], [13, 9], [8, 13]] as const) {
        p3(ctx, px, py, '#6e6756', 2, 1);
      }
      break;
    }
    case ITEM_IDS.CAVE_SHALE: {
      // Dark fissile slate rock with tight thin horizontal cleavage layers
      p3(ctx, 0, 0, '#363f4d', 16, 16);
      for (let y = 0; y < 16; y += 2) {
        p3(ctx, 0, y, y % 4 === 0 ? '#4d596b' : '#262d38', 16, 1);
      }
      // Subtle chipped diagonal cleavage cracks
      p3(ctx, 3, 2, '#69788f', 5, 1);
      p3(ctx, 9, 6, '#1b2029', 5, 1);
      p3(ctx, 2, 10, '#69788f', 6, 1);
      p3(ctx, 10, 14, '#1b2029', 4, 1);
      break;
    }
    case ITEM_IDS.GRANITE: {
      // Coarse salt-and-pepper igneous granite (pink feldspar, quartz, dark mica)
      p3(ctx, 0, 0, '#7a7578', 16, 16);
      p3(ctx, 0, 0, '#9c9496', 16, 2);
      for (let y = 1; y < 15; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          const v = (x * 7 + y * 13) % 5;
          const col =
            v === 0 ? '#d99b8c' : v === 1 ? '#ebeef2' : v === 2 ? '#343842' : '#9c918e';
          p3(ctx, x, y, col, 2, 2);
        }
      }
      p3(ctx, 0, 15, '#4c484b', 16, 1);
      break;
    }
    case ITEM_IDS.UNDERGROUND_CLAY: {
      // Smooth dense wet riverbed clay with curved trowel striations
      p3(ctx, 0, 0, '#7c828c', 16, 16);
      p3(ctx, 0, 0, '#a3aab5', 16, 2);
      p3(ctx, 2, 4, '#9299a3', 8, 2);
      p3(ctx, 5, 8, '#626873', 9, 2);
      p3(ctx, 1, 11, '#9299a3', 7, 2);
      p3(ctx, 0, 14, '#525761', 16, 2);
      break;
    }
    case ITEM_IDS.ICICLE: {
      // Translucent pointed ice crystal spear hanging from ceiling
      p3(ctx, 2, 0, '#1c4a85', 12, 3);
      p3(ctx, 4, 3, '#1c4a85', 8, 5);
      p3(ctx, 6, 8, '#1c4a85', 4, 6);
      p3(ctx, 3, 0, '#7ce8ff', 10, 3);
      p3(ctx, 5, 3, '#a8f5ff', 6, 5);
      p3(ctx, 7, 8, '#ffffff', 2, 5);
      p3(ctx, 4, 1, '#ffffff', 2, 3);
      break;
    }
    case ITEM_IDS.STALACTITE: {
      // Earthy mineral cavern dripstone hanging down
      p3(ctx, 2, 0, THEME.ink.outline, 12, 4);
      p3(ctx, 4, 4, THEME.ink.outline, 8, 5);
      p3(ctx, 6, 9, THEME.ink.outline, 4, 5);
      p3(ctx, 3, 1, '#786e60', 10, 3);
      p3(ctx, 5, 4, '#948877', 6, 5);
      p3(ctx, 7, 9, '#b8ab97', 2, 4);
      p3(ctx, 4, 2, '#cfc2ae', 3, 1);
      break;
    }
    case ITEM_IDS.STALAGMITE: {
      p3(ctx, 6, 2, THEME.ink.outline, 4, 5);
      p3(ctx, 4, 7, THEME.ink.outline, 8, 5);
      p3(ctx, 2, 12, THEME.ink.outline, 12, 4);
      p3(ctx, 7, 3, '#b8ab97', 2, 4);
      p3(ctx, 5, 7, '#948877', 6, 5);
      p3(ctx, 3, 12, '#786e60', 10, 3);
      break;
    }
    case ITEM_IDS.CRYSTAL_ORE: {
      drawFramedPanel16(ctx, '#4b4569');
      for (const [cx, cy] of [
        [3, 3],
        [9, 4],
        [5, 9],
        [10, 10],
      ]) {
        p3(ctx, cx, cy, '#d7c8ff', 3, 3);
        p3(ctx, cx + 1, cy + 1, '#8d79ce', 2, 2);
        p2(ctx, Math.round(cx * 1.5), Math.round(cy * 1.5), '#ffffff', 1, 1);
      }
      break;
    }
    case ITEM_IDS.CAVE_BACKGROUND_WALL: {
      const ramp = deriveColorRamp(def.colorPrimary);
      drawMasonryBricks16(ctx, ramp.highlight, ramp.base, ramp.shadow, ramp.outline);
      break;
    }

    // --- Fluids & Parkour ---
    case ITEM_IDS.WATER_SOURCE: {
      p3(ctx, 1, 2, THEME.ink.outline, 14, 13);
      p3(ctx, 2, 3, '#1d69a8', 12, 11);
      p3(ctx, 2, 3, '#38a8eb', 12, 8);
      p3(ctx, 3, 4, '#b8f3ff', 4, 2);
      p3(ctx, 9, 5, '#b8f3ff', 3, 2);
      p3(ctx, 5, 8, '#7ad5ff', 6, 2);
      break;
    }

    case ITEM_IDS.ACID_SOURCE: {
      p3(ctx, 1, 2, THEME.ink.outline, 14, 13);
      p3(ctx, 2, 3, '#2d7a1d', 12, 11);
      p3(ctx, 2, 3, '#63d93b', 12, 8);
      p3(ctx, 4, 4, '#d2ff8c', 3, 2);
      p3(ctx, 10, 6, '#d2ff8c', 2, 2);
      p3(ctx, 6, 9, '#9cff63', 4, 2);
      break;
    }

    case ITEM_IDS.BOUNCE_PAD: {
      p3(ctx, 1, 11, THEME.ink.outline, 14, 5);
      p3(ctx, 2, 12, '#6b3e24', 12, 3);
      p3(ctx, 4, 7, THEME.metal.steelMid, 2, 5);
      p3(ctx, 10, 7, THEME.metal.steelMid, 2, 5);
      p3(ctx, 1, 3, THEME.ink.outline, 14, 5);
      p3(ctx, 2, 4, '#e67e32', 12, 3);
      p3(ctx, 3, 4, '#ffe38c', 10, 1);
      break;
    }

    // --- Machines & Scrolls ---
    case ITEM_IDS.STONE_FURNACE: {
      drawFramedPanel16(ctx, '#6c7480', { bolts: true });
      p3(ctx, 4, 4, THEME.ink.outline, 8, 8);
      p3(ctx, 5, 5, '#2b1812', 6, 6);
      p3(ctx, 6, 7, '#ff6824', 4, 4);
      p3(ctx, 7, 8, '#ffda66', 2, 3);
      p3(ctx, 5, 2, '#2d333d', 6, 1);
      break;
    }

    case ITEM_IDS.BFG_COLLECTOR: {
      drawFramedPanel16(ctx, '#3974a8', { bolts: true });
      p3(ctx, 4, 3, THEME.ink.outline, 8, 9);
      p3(ctx, 5, 4, '#112233', 6, 7);
      p3(ctx, 6, 5, '#78f5c8', 4, 5);
      p3(ctx, 7, 6, '#ffffff', 2, 2);
      p3(ctx, 3, 13, '#f2b738', 10, 1);
      break;
    }

    case ITEM_IDS.EXCHANGE_TERMINAL: {
      p3(ctx, 1, 1, THEME.ink.outline, 14, 14);
      p3(ctx, 2, 2, '#2d4b6e', 12, 12);
      p3(ctx, 3, 3, '#101d2c', 10, 6);
      p3(ctx, 4, 4, '#f2b738', 3, 4);
      p3(ctx, 8, 4, '#8cf7ee', 4, 2);
      p3(ctx, 8, 7, '#82e068', 4, 1);
      p3(ctx, 4, 10, '#f2b738', 8, 3);
      break;
    }

    case ITEM_IDS.MINING_SCROLL: {
      p3(ctx, 2, 2, THEME.ink.outline, 12, 12);
      p3(ctx, 3, 3, '#f0dec0', 10, 10);
      p3(ctx, 2, 3, '#8c663b', 12, 2);
      p3(ctx, 2, 11, '#8c663b', 12, 2);
      p3(ctx, 5, 6, def.colorPrimary, 6, 4);
      p3(ctx, 6, 7, def.colorAccent, 4, 2);
      p3(ctx, 7, 7, '#ffffff', 2, 1);
      break;
    }

    // --- Gate Keys (810..814) ---
    case ITEM_IDS.GATE_KEY_I:
    case ITEM_IDS.GATE_KEY_II:
    case ITEM_IDS.GATE_KEY_III:
    case ITEM_IDS.GATE_KEY_IV:
    case ITEM_IDS.GATE_KEY_V: {
      // Ornate dungeon key with gemstone bow & wards
      p3(ctx, 2, 4, THEME.ink.outline, 7, 8);
      p3(ctx, 3, 5, def.colorPrimary, 5, 6);
      p3(ctx, 4, 6, def.colorAccent, 3, 4);
      p3(ctx, 5, 7, '#ffffff', 1, 2);
      // Key shaft & teeth
      p3(ctx, 8, 6, THEME.ink.outline, 7, 4);
      p3(ctx, 10, 9, THEME.ink.outline, 5, 4);
      p3(ctx, 9, 7, def.colorPrimary, 5, 2);
      p3(ctx, 9, 7, def.colorAccent, 4, 1);
      p3(ctx, 11, 9, def.colorPrimary, 1, 3);
      p3(ctx, 13, 9, def.colorPrimary, 1, 2);
      break;
    }

    // --- Pickaxes & Fishing Rods ---
    case ITEM_IDS.STONE_PICKAXE:
    case ITEM_IDS.IRON_PICKAXE:
    case ITEM_IDS.CRYSTAL_PICKAXE: {
      for (let i = 0; i < 8; i++) {
        p3(ctx, 2 + i, 12 - i, THEME.ink.outline, 3, 3);
        p3(ctx, 3 + i, 12 - i, def.colorSecondary, 2, 2);
      }
      p3(ctx, 5, 2, THEME.ink.outline, 9, 4);
      p3(ctx, 11, 5, THEME.ink.outline, 3, 6);
      p3(ctx, 6, 3, def.colorPrimary, 7, 2);
      p3(ctx, 11, 4, def.colorAccent, 2, 6);
      break;
    }

    case ITEM_IDS.BAMBOO_ROD:
    case ITEM_IDS.ANGLER_ROD:
    case ITEM_IDS.FISHING_ROD_III:
    case ITEM_IDS.FISHING_ROD_IV:
    case ITEM_IDS.FISHING_ROD_V:
    case ITEM_IDS.FISHING_ROD_VI: {
      for (let i = 0; i < 9; i++) {
        p3(ctx, 2 + i, 13 - i, THEME.ink.outline, 2, 2);
        p3(ctx, 2 + i, 12 - i, def.colorPrimary, 2, 2);
      }
      // Reel & line with bobber
      p3(ctx, 4, 10, def.colorAccent, 2, 2);
      p3(ctx, 11, 3, '#d9eef7', 1, 7);
      p3(ctx, 10, 10, THEME.ink.outline, 3, 3);
      p3(ctx, 11, 10, def.colorAccent, 2, 2);
      break;
    }

    case ITEM_IDS.STARTER_BAIT: {
      // Coiled wriggling earthworm with fleshy segments & gloss
      p3(ctx, 3, 7, THEME.ink.outline, 10, 6);
      p3(ctx, 4, 8, def.colorSecondary, 8, 4);
      p3(ctx, 5, 8, def.colorPrimary, 6, 3);
      p3(ctx, 5, 7, def.colorAccent, 4, 2);
      p3(ctx, 10, 8, '#fca5a5', 2, 2);
      p3(ctx, 3, 10, def.colorSecondary, 4, 2);
      p3(ctx, 6, 8, '#ffffff', 1, 1);
      break;
    }

    // --- Fuel, Ore Fragments & Ingots ---
    case ITEM_IDS.COAL_FUEL: {
      p3(ctx, 3, 4, THEME.ink.outline, 10, 9);
      p3(ctx, 4, 5, '#303642', 8, 7);
      p3(ctx, 5, 5, '#69748a', 3, 2);
      p3(ctx, 5, 9, '#161921', 6, 2);
      break;
    }


    case ITEM_IDS.SEED_POT: {
      // Terracotta planter pot (16x16 grid -> 48x48)
      p3(ctx, 1, 9, THEME.ink.outline, 14, 7);
      p3(ctx, 2, 10, '#b45309', 12, 5);
      p3(ctx, 2, 9, '#78350f', 12, 1);
      // Top pot rim
      p3(ctx, 0, 7, THEME.ink.outline, 16, 3);
      p3(ctx, 1, 8, '#d97706', 14, 1);
      p3(ctx, 1, 7, '#f59e0b', 14, 1);
      // Soil well inside rim
      p3(ctx, 2, 6, '#451a03', 12, 2);
      p3(ctx, 3, 6, '#290f04', 10, 1);
      // Base rim shadow & specular
      p3(ctx, 3, 14, '#78350f', 10, 1);
      p3(ctx, 2, 8, '#fef3c7', 3, 1);
      break;
    }

    case ITEM_IDS.MATTERAGEN_BOTANICAL:
    case ITEM_IDS.MATTERAGEN_GEOMINERAL:
    case ITEM_IDS.MATTERAGEN_LUMINESCENT:
    case ITEM_IDS.MATTERAGEN_ARCANE:
    case ITEM_IDS.MATTERAGEN_COSMIC: {
      // Heavy industrial generator chassis with glowing elemental reactor
      drawFramedPanel16(ctx, '#1e293b', { bolts: true });
      p3(ctx, 3, 3, THEME.ink.outline, 10, 10);
      p3(ctx, 4, 4, def.colorSecondary, 8, 8);
      p3(ctx, 5, 5, def.colorPrimary, 6, 6);
      p3(ctx, 6, 6, def.colorAccent, 4, 4);
      p3(ctx, 7, 7, '#ffffff', 2, 2);
      // Exhaust vents & corner brass rivets
      p3(ctx, 1, 4, '#94a3b8', 2, 1);
      p3(ctx, 1, 11, '#94a3b8', 2, 1);
      p3(ctx, 13, 4, '#94a3b8', 2, 1);
      p3(ctx, 13, 11, '#94a3b8', 2, 1);
      break;
    }

    case ITEM_IDS.ATM_MACHINE: {
      // Sleek cyber-brass ATM terminal with backlit emerald gem screen and dispenser slot
      drawFramedPanel16(ctx, '#0c4a6e', { bolts: true });
      // Metallic top marquee
      p3(ctx, 2, 1, '#38bdf8', 12, 2);
      p3(ctx, 3, 1, '#e0f2fe', 4, 1);
      // Screen housing
      p3(ctx, 3, 4, THEME.ink.outline, 10, 6);
      p3(ctx, 4, 5, '#064e3b', 8, 4);
      // Pixel gem icon inside screen
      p3(ctx, 6, 5, '#fde047', 4, 4);
      p3(ctx, 7, 6, '#fef9c3', 2, 2);
      // Keypad & dispenser slot
      p3(ctx, 3, 11, '#1e293b', 5, 3);
      p3(ctx, 4, 12, '#94a3b8', 1, 1);
      p3(ctx, 6, 12, '#94a3b8', 1, 1);
      p3(ctx, 9, 11, '#090d16', 4, 3);
      p3(ctx, 10, 12, '#fbbf24', 2, 1);
      break;
    }

    case ITEM_IDS.VAULTBOX: {
      // Reinforced steel & gold safe-chest storage vault with heavy keyhole & latches
      drawFramedPanel16(ctx, '#334155', { bolts: true });
      // Gold horizontal vault band & clasp
      p3(ctx, 1, 6, THEME.ink.outline, 14, 4);
      p3(ctx, 1, 7, '#d97706', 14, 2);
      p3(ctx, 2, 7, '#fbbf24', 12, 1);
      // Center dial & keyhole emblem
      p3(ctx, 5, 4, THEME.ink.outline, 6, 8);
      p3(ctx, 6, 5, '#f59e0b', 4, 6);
      p3(ctx, 7, 6, '#fef3c7', 2, 2);
      p3(ctx, 7, 8, '#090d16', 2, 2);
      // Corner iron gussets
      p3(ctx, 2, 2, '#94a3b8', 2, 2);
      p3(ctx, 12, 2, '#94a3b8', 2, 2);
      p3(ctx, 2, 12, '#64748b', 2, 2);
      p3(ctx, 12, 12, '#64748b', 2, 2);
      break;
    }

    case ITEM_IDS.STARTER_LOOTBOX: {
      // Ornate starter supply crate with golden trim, wood slats & glowing cyan emblem
      p3(ctx, 1, 2, THEME.ink.outline, 14, 14);
      p3(ctx, 2, 3, '#78350f', 12, 12);
      p3(ctx, 3, 4, '#b45309', 10, 10);
      // Gold corner braces & horizontal band
      p3(ctx, 2, 3, '#f59e0b', 12, 2);
      p3(ctx, 2, 3, '#fef08a', 8, 1);
      p3(ctx, 2, 8, '#d97706', 12, 2);
      p3(ctx, 2, 13, '#b45309', 12, 2);
      // Center glowing cyan supply seal
      p3(ctx, 5, 5, THEME.ink.outline, 6, 6);
      p3(ctx, 6, 6, '#0284c7', 4, 4);
      p3(ctx, 7, 7, '#7dd3fc', 2, 2);
      p3(ctx, 7, 7, '#ffffff', 1, 1);
      break;
    }



    default: {
      // Rich procedural pixel-art rendering by category & item key so every catalog item is distinct
      if (def.category === 'seed') {
        const ramp = deriveColorRamp(def.colorPrimary);
        const isFarmableSeed = Boolean(def.farmableTier);
        const rimDark = isFarmableSeed ? '#2b1908' : ramp.outline;
        const sproutMain = isFarmableSeed ? '#fde047' : '#4ade80';
        const sproutShade = isFarmableSeed ? '#eab308' : '#16a34a';

        // Little sprout leaf nib emerging from top-right tip of the seed
        p3(ctx, 10, 1, '#151b26', 3, 1);
        p3(ctx, 9, 2, '#151b26', 5, 2);
        p3(ctx, 10, 4, '#151b26', 3, 1);
        p3(ctx, 10, 2, sproutMain, 3, 1);
        p3(ctx, 10, 3, sproutShade, 2, 1);

        // Crisp 1px dark outer silhouette of an angled plump almond/teardrop seed pod
        p3(ctx, 8, 3, rimDark, 3, 1);
        p3(ctx, 6, 4, rimDark, 6, 1);
        p3(ctx, 5, 5, rimDark, 8, 1);
        p3(ctx, 4, 6, rimDark, 9, 2);
        p3(ctx, 3, 8, rimDark, 10, 3);
        p3(ctx, 3, 11, rimDark, 9, 2);
        p3(ctx, 4, 13, rimDark, 6, 1);
        p3(ctx, 5, 14, rimDark, 4, 1);

        // Interior seed coat body
        p3(ctx, 8, 4, def.colorSecondary, 2, 1);
        p3(ctx, 6, 5, ramp.base, 6, 1);
        p3(ctx, 5, 6, ramp.base, 7, 2);
        p3(ctx, 4, 8, ramp.base, 8, 3);
        p3(ctx, 4, 11, ramp.shadow, 7, 2);
        p3(ctx, 5, 13, ramp.shadow, 4, 1);

        // Upper-left bright highlight crest + white gleam pixel
        p3(ctx, 6, 5, ramp.highlight, 3, 1);
        p3(ctx, 5, 6, ramp.highlight, 3, 2);
        p3(ctx, 4, 8, ramp.highlight, 2, 2);
        p3(ctx, 5, 6, '#ffffff', 2, 1);
        p3(ctx, 5, 7, '#ffffff', 1, 1);

        // Diagonal organic seed-coat stripe & accent vein matching species palette
        p3(ctx, 9, 6, def.colorSecondary, 2, 2);
        p3(ctx, 7, 8, def.colorSecondary, 3, 2);
        p3(ctx, 5, 10, def.colorSecondary, 3, 2);
        p3(ctx, 8, 8, def.colorAccent, 2, 1);
        p3(ctx, 6, 10, def.colorAccent, 2, 1);
        if (isFarmableSeed) {
          // Subtle warm gold glint dot on Farmablock seeds so tier identity stays clear
          p3(ctx, 10, 9, '#fef08a', 1, 2);
        } else {
          // Subtle inner botanical rib dot on Crop seeds
          p3(ctx, 9, 10, ramp.highlight, 1, 1);
        }
      } else if (def.key.endsWith('_ingot') || def.name.toLowerCase().includes('ingot')) {
        p3(ctx, 2, 5, THEME.ink.outline, 12, 7);
        p3(ctx, 3, 6, def.colorSecondary, 10, 5);
        p3(ctx, 3, 6, def.colorPrimary, 9, 3);
        p3(ctx, 4, 6, def.colorAccent, 6, 1);
        p3(ctx, 5, 7, '#ffffff', 2, 1);
      } else if (
        def.key.endsWith('_fragment') ||
        def.key.endsWith('_ore') ||
        def.name.toLowerCase().includes('ore')
      ) {
        drawFramedPanel16(ctx, def.colorSecondary);
        for (const [ox, oy] of [
          [3, 3],
          [9, 4],
          [4, 9],
          [10, 10],
        ]) {
          p3(ctx, ox, oy, def.colorPrimary, 3, 3);
          p3(ctx, ox, oy, def.colorAccent, 2, 1);
          p2(ctx, Math.round(ox * 1.5), Math.round(oy * 1.5), '#ffffff', 1, 1);
        }
      } else if (Boolean(def.fishDepthProfile) || def.key.startsWith('fish_')) {
        p3(ctx, 2, 5, THEME.ink.outline, 10, 6);
        p3(ctx, 11, 6, THEME.ink.outline, 3, 4);
        p3(ctx, 3, 6, def.colorPrimary, 8, 4);
        p3(ctx, 4, 6, def.colorAccent, 5, 2);
        p3(ctx, 11, 7, def.colorSecondary, 2, 2);
        p3(ctx, 4, 7, '#151b26', 1, 1);
      } else if (def.category === 'background') {
        const ramp = deriveColorRamp(def.colorPrimary);
        drawMasonryBricks16(ctx, ramp.highlight, ramp.base, ramp.shadow, ramp.outline);
      } else if (def.key.startsWith('gp_') && def.key.endsWith('_block')) {
        // Painted color building blocks: crisp beveled glossy architectural tile with rivets
        drawFramedPanel16(ctx, def.colorPrimary, { bolts: true });
      } else {
        // Differentiate other blocks by deterministic pattern
        const pattern = itemSeed(itemId) % 3;
        const ramp = deriveColorRamp(def.colorPrimary);
        if (pattern === 0) {
          drawMasonryBricks16(ctx, ramp.highlight, ramp.base, ramp.shadow, ramp.outline);
        } else if (pattern === 1) {
          drawFramedPanel16(ctx, def.colorPrimary, { bolts: true });
          p3(ctx, 6, 6, def.colorAccent, 4, 4);
          p3(ctx, 7, 7, '#ffffff', 2, 2);
        } else {
          drawFramedPanel16(ctx, def.colorPrimary, { bolts: true });
          p3(ctx, 4, 7, def.colorSecondary, 8, 2);
          p3(ctx, 7, 4, def.colorAccent, 2, 8);
        }
      }
    }
  }

  return c;
}

export function getTileSprite(itemId: number): HTMLCanvasElement {
  let cached = tileCache.get(itemId);
  if (!cached) {
    // 32-bit pixel art farmable blocks and seeds render directly from the native 32x32 texture
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
    const raw48 = drawTile48(itemId);
    const scaled = document.createElement('canvas');
    scaled.width = TILE_PX;
    scaled.height = TILE_PX;
    const sCtx = scaled.getContext('2d')!;
    sCtx.imageSmoothingEnabled = false;
    sCtx.drawImage(raw48, 0, 0, 48, 48, 0, 0, TILE_PX, TILE_PX);
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
 * Renders a 3×2 tile (144×96 px) pixel-art market stand for the Nexus plaza.
 */
export function getMarketStandSprite(kind: 'landlord' | 'greens_vendor'): HTMLCanvasElement {
  const cached = marketStandCache.get(kind);
  if (cached) return cached;

  const width = TILE_PX * 3; // 144
  const height = TILE_PX * 2; // 96
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

