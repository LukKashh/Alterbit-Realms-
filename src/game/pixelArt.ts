import {
  BLOCKGROVE_ART_THEME as THEME,
  deriveColorRamp,
  mixHex,
  shadeHex,
} from './artTheme.ts';
import { CATALOG, ITEM_IDS } from './catalog.ts';

export type PlayerPose =
  | 'idle'
  | 'idle0'
  | 'idle1'
  | 'idle2'
  | 'idle3'
  | 'walk0'
  | 'walk1'
  | 'walk2'
  | 'walk3'
  | 'jump'
  | 'fall'
  | 'punch'
  | 'punch0'
  | 'punch1'
  | 'punch2'
  | 'punch3'
  | 'mine0'
  | 'mine1'
  | 'mine2'
  | 'mine3'
  | 'place';

export interface EquippedWearables {
  head?: number;
  face?: number;
  back?: number;
}

const TILE_PX = THEME.tileTextureSize; // 48x48
const PLAYER_CANVAS_W = THEME.playerSpriteSize.width; // 68
const PLAYER_CANVAS_H = THEME.playerSpriteSize.height; // 84

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
    case ITEM_IDS.DESERT_SAND:
    case ITEM_IDS.SALT_CRUST: {
      drawFramedPanel16(ctx, def.colorPrimary);
      const ramp = deriveColorRamp(def.colorPrimary);
      p3(ctx, 2, 4, ramp.highlight, 5, 1);
      p3(ctx, 8, 6, ramp.shadow, 5, 1);
      p3(ctx, 3, 10, ramp.highlight, 6, 1);
      p3(ctx, 9, 12, ramp.shadow, 4, 1);
      break;
    }
    case ITEM_IDS.RED_SANDSTONE:
    case ITEM_IDS.DESERT_HARDPAN: {
      const ramp = deriveColorRamp(def.colorPrimary);
      drawMasonryBricks16(ctx, ramp.highlight, ramp.base, ramp.shadow, ramp.outline);
      p3(ctx, 2, 5, ramp.highlight, 12, 1);
      p3(ctx, 2, 11, ramp.shadow, 12, 1);
      break;
    }
    case ITEM_IDS.DUNE_GRASS: {
      drawFramedPanel16(ctx, '#d9b96b');
      p3(ctx, 2, 2, '#656532', 12, 4);
      p3(ctx, 3, 2, '#a9a04f', 10, 3);
      p3(ctx, 4, 2, '#d3c978', 3, 2);
      p3(ctx, 9, 2, '#d3c978', 3, 2);
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
      drawFramedPanel16(ctx, '#b8945e');
      p3(ctx, 6, 2, '#5b422e', 3, 12);
      p3(ctx, 4, 6, '#5b422e', 3, 2);
      p3(ctx, 9, 8, '#5b422e', 3, 2);
      p3(ctx, 7, 3, '#c79c63', 1, 9);
      break;
    }
    case ITEM_IDS.DESERT_GRAVEL:
    case ITEM_IDS.CAVE_GRAVEL: {
      drawFramedPanel16(ctx, def.colorPrimary);
      const ramp = deriveColorRamp(def.colorPrimary);
      for (const [gx, gy] of [
        [3, 3],
        [9, 4],
        [5, 8],
        [10, 10],
        [4, 12],
      ]) {
        p3(ctx, gx, gy, ramp.shadow, 3, 2);
        p3(ctx, gx, gy, ramp.highlight, 2, 1);
      }
      break;
    }

    // --- Arctic Tundra Biome Blocks (720..727) ---
    case ITEM_IDS.FROST_SNOW:
    case ITEM_IDS.PACKED_SNOW: {
      drawFramedPanel16(ctx, def.colorPrimary);
      p3(ctx, 2, 2, '#ffffff', 12, 3);
      p3(ctx, 4, 8, '#ffffff', 3, 2);
      p3(ctx, 10, 10, def.colorSecondary, 3, 2);
      break;
    }
    case ITEM_IDS.GLACIER_ICE:
    case ITEM_IDS.BLUE_ICE: {
      drawFramedPanel16(ctx, def.colorPrimary);
      p3(ctx, 3, 3, def.colorAccent, 5, 2);
      p3(ctx, 5, 5, '#ffffff', 4, 1);
      p3(ctx, 8, 9, def.colorAccent, 4, 2);
      p3(ctx, 3, 11, def.colorSecondary, 5, 2);
      break;
    }
    case ITEM_IDS.PERMAFROST:
    case ITEM_IDS.FROZEN_DIRT: {
      drawFramedPanel16(ctx, def.colorPrimary);
      p3(ctx, 2, 2, '#d5f8ff', 12, 2);
      p3(ctx, 4, 7, def.colorSecondary, 3, 3);
      p3(ctx, 10, 9, def.colorAccent, 3, 2);
      break;
    }
    case ITEM_IDS.FROST_ROCK:
    case ITEM_IDS.CAVE_LIMESTONE:
    case ITEM_IDS.CAVE_SHALE:
    case ITEM_IDS.GRANITE:
    case ITEM_IDS.UNDERGROUND_CLAY: {
      const ramp = deriveColorRamp(def.colorPrimary);
      drawMasonryBricks16(ctx, ramp.highlight, ramp.base, ramp.shadow, ramp.outline);
      p3(ctx, 4, 4, ramp.highlight, 3, 2);
      p3(ctx, 10, 9, ramp.shadow, 3, 2);
      break;
    }
    case ITEM_IDS.ICICLE:
    case ITEM_IDS.STALACTITE: {
      p3(ctx, 2, 0, THEME.ink.outline, 12, 4);
      p3(ctx, 4, 4, THEME.ink.outline, 8, 5);
      p3(ctx, 6, 9, THEME.ink.outline, 4, 5);
      p3(ctx, 3, 1, def.colorPrimary, 10, 3);
      p3(ctx, 5, 4, def.colorPrimary, 6, 5);
      p3(ctx, 7, 9, def.colorAccent, 2, 4);
      break;
    }
    case ITEM_IDS.STALAGMITE: {
      p3(ctx, 6, 2, THEME.ink.outline, 4, 5);
      p3(ctx, 4, 7, THEME.ink.outline, 8, 5);
      p3(ctx, 2, 12, THEME.ink.outline, 12, 4);
      p3(ctx, 7, 3, def.colorAccent, 2, 4);
      p3(ctx, 5, 7, def.colorPrimary, 6, 5);
      p3(ctx, 3, 12, def.colorPrimary, 10, 3);
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

    // --- Fuel, Ore Fragments & Ingots ---
    case ITEM_IDS.COAL_FUEL: {
      p3(ctx, 3, 4, THEME.ink.outline, 10, 9);
      p3(ctx, 4, 5, '#303642', 8, 7);
      p3(ctx, 5, 5, '#69748a', 3, 2);
      p3(ctx, 5, 9, '#161921', 6, 2);
      break;
    }

    // --- 20 Dedicated Farmable Blocks (900..919) ---
    case ITEM_IDS.FARM_SUGAR_CANE:
    case ITEM_IDS.FARM_BAMBOO_SHOOT: {
      for (const sx of [2, 7, 11]) {
        p3(ctx, sx, 1, THEME.ink.outline, 4, 15);
        p3(ctx, sx + 1, 2, def.colorSecondary, 2, 13);
        p3(ctx, sx + 1, 2, def.colorPrimary, 1, 13);
        p3(ctx, sx, 5, def.colorAccent, 4, 1);
        p3(ctx, sx, 10, def.colorAccent, 4, 1);
      }
      break;
    }

    case ITEM_IDS.FARM_PEPPER_BUSH:
    case ITEM_IDS.FARM_VENUS_TRAP: {
      p3(ctx, 1, 2, THEME.ink.outline, 14, 13);
      p3(ctx, 2, 3, def.colorSecondary, 12, 11);
      p3(ctx, 3, 3, '#22c55e', 10, 5);
      // Hanging peppers / pods
      for (const [px, py] of [
        [3, 6],
        [7, 8],
        [11, 5],
      ]) {
        p3(ctx, px, py, THEME.ink.outline, 3, 5);
        p3(ctx, px + 1, py + 1, def.colorPrimary, 2, 3);
        p3(ctx, px + 1, py + 1, def.colorAccent, 1, 1);
      }
      break;
    }

    case ITEM_IDS.FARM_BOUNTY_WHEAT: {
      drawFramedPanel16(ctx, def.colorPrimary);
      p3(ctx, 1, 6, '#b91c1c', 14, 2);
      p3(ctx, 1, 10, '#b91c1c', 14, 2);
      for (let x = 2; x <= 12; x += 3) {
        p3(ctx, x, 2, def.colorAccent, 1, 4);
        p3(ctx, x, 12, def.colorSecondary, 1, 3);
      }
      break;
    }

    case ITEM_IDS.FARM_GLOW_SHROOM:
    case ITEM_IDS.FARM_FROST_LOTUS: {
      p3(ctx, 5, 8, THEME.ink.outline, 6, 8);
      p3(ctx, 6, 9, def.colorSecondary, 4, 6);
      p3(ctx, 1, 3, THEME.ink.outline, 14, 7);
      p3(ctx, 2, 4, def.colorPrimary, 12, 5);
      p3(ctx, 4, 4, def.colorAccent, 3, 2);
      p3(ctx, 9, 5, '#ffffff', 3, 2);
      break;
    }

    case ITEM_IDS.FARM_HONEY_COMB:
    case ITEM_IDS.FARM_GOLD_TREASURE: {
      drawFramedPanel16(ctx, def.colorPrimary, { bolts: true });
      for (const [hx, hy] of [
        [3, 3],
        [8, 3],
        [5, 7],
        [3, 11],
        [8, 11],
      ]) {
        p3(ctx, hx, hy, def.colorSecondary, 4, 3);
        p3(ctx, hx + 1, hy + 1, def.colorAccent, 2, 1);
      }
      break;
    }

    case ITEM_IDS.FARM_PINBALL_BUMPER: {
      p3(ctx, 2, 2, THEME.ink.outline, 12, 12);
      p3(ctx, 3, 3, def.colorSecondary, 10, 10);
      p3(ctx, 4, 4, def.colorPrimary, 8, 8);
      p3(ctx, 6, 5, def.colorAccent, 4, 6);
      p3(ctx, 5, 6, def.colorAccent, 6, 4);
      p3(ctx, 7, 7, '#ffffff', 2, 2);
      break;
    }

    case ITEM_IDS.FARM_CHANDELIER: {
      p3(ctx, 7, 0, THEME.ink.outline, 2, 5);
      p3(ctx, 1, 5, THEME.ink.outline, 14, 5);
      p3(ctx, 2, 6, def.colorPrimary, 12, 3);
      for (const cx of [2, 6, 10, 13]) {
        p3(ctx, cx, 3, def.colorAccent, 2, 3);
        p3(ctx, cx, 10, '#38bdf8', 2, 4);
      }
      break;
    }

    case ITEM_IDS.FARM_LASER_GRID:
    case ITEM_IDS.FARM_AETHER_REACTOR: {
      drawFramedPanel16(ctx, def.colorSecondary, { bolts: true });
      p3(ctx, 3, 3, THEME.ink.outline, 10, 10);
      p3(ctx, 4, 4, def.colorPrimary, 8, 8);
      p3(ctx, 7, 2, def.colorAccent, 2, 12);
      p3(ctx, 2, 7, def.colorAccent, 12, 2);
      p3(ctx, 6, 6, '#ffffff', 4, 4);
      break;
    }

    case ITEM_IDS.FARM_BLACKROCK_GEM:
    case ITEM_IDS.FARM_EMERALD_GEODE:
    case ITEM_IDS.FARM_DRAGON_HOARD: {
      drawFramedPanel16(ctx, def.colorSecondary);
      for (const [gx, gy] of [
        [3, 3],
        [9, 3],
        [6, 7],
        [3, 10],
        [10, 10],
      ]) {
        p3(ctx, gx, gy, THEME.ink.outline, 4, 4);
        p3(ctx, gx + 1, gy + 1, def.colorPrimary, 2, 2);
        p3(ctx, gx + 1, gy + 1, def.colorAccent, 1, 1);
      }
      break;
    }

    case ITEM_IDS.FARM_SORCERER_ORB:
    case ITEM_IDS.FARM_SUNSTONE_PILLAR:
    case ITEM_IDS.FARM_STARLIGHT_PRISM:
    case ITEM_IDS.FARM_CELESTIAL_MONOLITH: {
      drawFramedPanel16(ctx, def.colorSecondary, { bolts: true });
      p3(ctx, 4, 2, THEME.ink.outline, 8, 12);
      p3(ctx, 5, 3, def.colorPrimary, 6, 10);
      p3(ctx, 6, 4, def.colorAccent, 4, 8);
      p3(ctx, 7, 5, '#ffffff', 2, 4);
      break;
    }

    default: {
      // Rich procedural pixel-art rendering by category & item key so every catalog item is distinct
      if (def.category === 'seed') {
        const ramp = deriveColorRamp(def.colorPrimary);
        const isFarmableSeed = Boolean(def.farmableTier);
        // Sprout leaves on top
        p3(ctx, 7, 1, THEME.ink.outline, 2, 4);
        p3(ctx, 4, 2, THEME.ink.outline, 4, 3);
        p3(ctx, 8, 2, THEME.ink.outline, 4, 3);
        p3(ctx, 5, 2, isFarmableSeed ? '#fde047' : THEME.earth.grassLit, 3, 2);
        p3(ctx, 8, 2, isFarmableSeed ? '#facc15' : THEME.earth.grassRim, 3, 2);
        // Seed bulb body with stripes & sheen
        p3(ctx, 3, 4, isFarmableSeed ? '#ca8a04' : ramp.outline, 10, 10);
        p3(ctx, 4, 5, ramp.base, 8, 8);
        p3(ctx, 4, 5, ramp.highlight, 5, 3);
        p3(ctx, 5, 6, '#ffffff', 2, 1);
        p3(ctx, 6, 8, def.colorSecondary, 5, 2);
        p3(ctx, 5, 11, ramp.shadow, 6, 2);
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
      } else {
        // Differentiate blocks by deterministic pattern (masonry, crystal inlay, timber, or rune-bolted)
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
    cached = drawTile48(itemId);
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
      const [c, ctx] = makeCanvas(TILE_PX, TILE_PX);
      p3(ctx, 7, 7, 'rgba(14, 19, 30, 0.85)', 2, 2);
      if (s >= 1) {
        p3(ctx, 6, 5, 'rgba(14, 19, 30, 0.8)', 1, 2);
        p3(ctx, 9, 9, 'rgba(14, 19, 30, 0.8)', 1, 2);
      }
      if (s >= 2) {
        p3(ctx, 4, 3, 'rgba(14, 19, 30, 0.82)', 2, 2);
        p3(ctx, 10, 11, 'rgba(14, 19, 30, 0.82)', 2, 2);
        p2(ctx, 7, 6, 'rgba(255, 255, 255, 0.22)', 1, 1);
      }
      if (s >= 3) {
        p3(ctx, 2, 2, 'rgba(14, 19, 30, 0.86)', 2, 1);
        p3(ctx, 11, 3, 'rgba(14, 19, 30, 0.86)', 2, 2);
        p3(ctx, 3, 11, 'rgba(14, 19, 30, 0.86)', 2, 2);
      }
      if (s >= 4) {
        p3(ctx, 1, 7, 'rgba(14, 19, 30, 0.9)', 3, 1);
        p3(ctx, 12, 7, 'rgba(14, 19, 30, 0.9)', 3, 1);
        p3(ctx, 7, 1, 'rgba(14, 19, 30, 0.9)', 2, 3);
        p3(ctx, 7, 12, 'rgba(14, 19, 30, 0.9)', 2, 3);
      }
      crackFrames.push(c);
    }
  }
  const idx = Math.max(0, Math.min(3, stage - 1));
  return crackFrames[idx];
}

// Crisp Pixel-Art Character Palette (Unified 3x + 2x detail grid)
const TEMPLATE_PAL = {
  ink: '#161114',
  hairLit: '#6e472b',
  hairMid: '#4d301b',
  hairDeep: '#2e1b0e',
  skinRim: '#ffe5cc',
  skinLit: '#f7cfa6',
  skinMid: '#e6b083',
  skinShade: '#c7895c',
  skinDeep: '#996039',
  mouth: '#6e3d24',
  eyeDark: '#131924',
  eyeWhite: '#ffffff',
  beltLeather: '#3b2416',
  beltBuckle: '#f2b738',
  jeansLit: '#495a8f',
  jeansMid: '#323f69',
  jeansDeep: '#222b4a',
  jeansDark: '#151b30',
  shoeLit: '#d9483b',
  shoeMid: '#9e2e24',
  shoeDark: '#262b38',
  soleWhite: '#eef2f7',
} as const;

interface ShirtPalette {
  rim: string;
  lit: string;
  mid: string;
  shade: string;
}

function getShirtPalette(shirtColor: string): ShirtPalette {
  const ramp = deriveColorRamp(shirtColor || '#3f8fd9');
  return {
    rim: shadeHex(ramp.highlight, 0.16),
    lit: ramp.highlight,
    mid: ramp.base,
    shade: ramp.shadow,
  };
}

function drawTemplateHead(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  profile: 'front' | 'side',
  squint = false
) {
  const P = TEMPLATE_PAL;
  // Outer outline
  p3(ctx, hx + 1, hy, P.ink, 10, 1);
  p3(ctx, hx + 1, hy + 10, P.ink, 10, 1);
  p3(ctx, hx, hy + 1, P.ink, 1, 9);
  p3(ctx, hx + 11, hy + 1, P.ink, 1, 9);

  // Face skin & warm cheek shading
  p3(ctx, hx + 1, hy + 1, P.skinLit, 10, 9);
  p3(ctx, hx + 1, hy + 3, P.skinRim, 6, 2);
  p3(ctx, hx + 10, hy + 2, P.skinMid, 1, 8);
  p3(ctx, hx + 2, hy + 9, P.skinShade, 8, 1);

  // Textured pixel hair cap & bangs across top of head
  p3(ctx, hx + 1, hy + 1, P.hairMid, 10, 2);
  p3(ctx, hx + 2, hy + 1, P.hairLit, 6, 1);
  p3(ctx, hx + 1, hy + 3, P.hairDeep, 2, 1);
  p3(ctx, hx + 9, hy + 3, P.hairDeep, 2, 1);

  if (profile === 'front') {
    p3(ctx, hx + 2, hy + 4, P.eyeWhite, 1, 2);
    p3(ctx, hx + 3, hy + 4, P.eyeDark, 1, 2);
    p3(ctx, hx + 8, hy + 4, P.eyeDark, 1, 2);
    p3(ctx, hx + 9, hy + 4, P.eyeWhite, 1, 2);
    p3(ctx, hx + 5, hy + 7, P.skinDeep, 2, 1);
    p3(ctx, hx + 4, hy + 8, P.mouth, 4, 1);
  } else {
    const eyeH = squint ? 1 : 2;
    const eyeY = squint ? hy + 5 : hy + 4;
    p3(ctx, hx + 4, eyeY, P.eyeDark, 1, eyeH);
    p3(ctx, hx + 5, eyeY, P.eyeWhite, 1, eyeH);
    p3(ctx, hx + 8, eyeY, P.eyeDark, 1, eyeH);
    p3(ctx, hx + 9, eyeY, P.eyeWhite, 1, eyeH);
    if (squint) {
      p3(ctx, hx + 4, hy + 4, P.skinDeep, 2, 1);
      p3(ctx, hx + 8, hy + 4, P.skinDeep, 2, 1);
    }
    p3(ctx, hx + 7, hy + 7, P.skinDeep, 1, 1);
    p3(ctx, hx + 6, hy + 8, P.mouth, 3, 1);
  }
}

function drawTemplateArmDown(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  shirt: ShirtPalette,
  isBack = false
) {
  const P = TEMPLATE_PAL;
  p3(ctx, ax, ay, P.ink, 3, 8);
  p3(ctx, ax + 1, ay + 1, isBack ? shirt.mid : shirt.lit, 1, 3);
  p3(ctx, ax + 1, ay + 4, isBack ? P.skinMid : P.skinLit, 1, 3);
  p3(ctx, ax + 1, ay + 6, isBack ? P.skinShade : P.skinMid, 1, 1);
}

function drawTemplateArmAngled(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  shirt: ShirtPalette,
  isBack = false
) {
  const P = TEMPLATE_PAL;
  const steps = Math.max(3, Math.ceil(Math.hypot(dx, dy)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(ax + dx * t);
    const py = Math.round(ay + dy * t);
    p3(ctx, px - 1, py - 1, P.ink, 3, 3);
  }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(ax + dx * t);
    const py = Math.round(ay + dy * t);
    const isSleeve = t < 0.45;
    const col = isSleeve
      ? isBack
        ? shirt.shade
        : shirt.lit
      : isBack
        ? P.skinMid
        : P.skinLit;
    p3(ctx, px, py, col, 1, 1);
  }
}

function drawTemplateLegVertical(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  isBack = false,
  tucked = false
) {
  const P = TEMPLATE_PAL;
  const h = tucked ? 6 : 8;
  p3(ctx, lx, ly, P.ink, 4, h);
  p3(ctx, lx + 1, ly + 1, isBack ? P.jeansDeep : P.jeansMid, 2, h - 4);
  if (!isBack) {
    p3(ctx, lx + 1, ly + 1, P.jeansLit, 1, Math.max(1, h - 5));
  }
  const sy = ly + h - 3;
  p3(ctx, lx + 1, sy, isBack ? P.shoeDark : P.shoeMid, 2, 1);
  if (!isBack) {
    p3(ctx, lx + 1, sy, P.shoeLit, 1, 1);
  }
  p3(ctx, lx + 1, sy + 1, P.soleWhite, 2, 1);
}

function drawTemplateLegStride(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  isBack = false
) {
  const P = TEMPLATE_PAL;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(hipX + (footX - hipX) * t);
    const py = Math.round(hipY + (footY - 3 - hipY) * t);
    p3(ctx, px - 1, py - 1, P.ink, 4, 3);
  }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(hipX + (footX - hipX) * t);
    const py = Math.round(hipY + (footY - 3 - hipY) * t);
    p3(ctx, px, py, isBack ? P.jeansDeep : P.jeansMid, 2, 2);
    if (!isBack && i > 0 && i < steps) {
      p3(ctx, px, py, P.jeansLit, 1, 1);
    }
  }
  const sx = Math.round(footX);
  const sy = Math.round(footY - 2);
  p3(ctx, sx - 1, sy - 1, P.ink, 5, 4);
  p3(ctx, sx, sy, isBack ? P.shoeDark : P.shoeMid, 3, 1);
  if (!isBack) p3(ctx, sx + 1, sy, P.shoeLit, 1, 1);
  p3(ctx, sx, sy + 1, P.soleWhite, 3, 1);
}

function drawTemplateTorso(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  shirt: ShirtPalette,
  widthVpx = 10
) {
  const P = TEMPLATE_PAL;
  p3(ctx, tx, ty, P.ink, widthVpx, 8);
  p3(ctx, tx + 1, ty + 1, shirt.mid, widthVpx - 2, 5);
  p3(ctx, tx + 1, ty + 1, shirt.lit, Math.max(2, widthVpx - 4), 4);
  p3(ctx, tx + 1, ty + 1, shirt.rim, Math.max(1, widthVpx - 6), 2);
  p3(ctx, tx + widthVpx - 2, ty + 2, shirt.shade, 1, 4);
  p3(ctx, tx + 1, ty + 5, shirt.shade, widthVpx - 2, 1);
  const colX = tx + Math.floor((widthVpx - 2) * 0.5);
  p3(ctx, colX, ty + 1, P.skinShade, 2, 1);
  // Leather belt & golden buckle
  p3(ctx, tx + 1, ty + 6, P.beltLeather, widthVpx - 2, 1);
  p3(ctx, colX, ty + 6, P.beltBuckle, 2, 1);
}

function drawTemplateWearables(
  ctx: CanvasRenderingContext2D,
  equipped: EquippedWearables | undefined,
  hx: number,
  hy: number,
  layer: 'back' | 'front'
) {
  if (!equipped) return;
  const ink = TEMPLATE_PAL.ink;

  if (layer === 'back' && equipped.back === ITEM_IDS.WEAR_SKY_WINGS) {
    const wy = hy + 10;
    p3(ctx, hx - 4, wy, ink, 5, 9);
    p3(ctx, hx - 3, wy + 1, '#2b6cb0', 3, 7);
    p3(ctx, hx - 2, wy + 2, THEME.arcane.aquaLit, 3, 5);
    p3(ctx, hx - 1, wy + 3, '#ffffff', 1, 3);
    return;
  }

  if (layer !== 'front') return;

  if (equipped.face === ITEM_IDS.WEAR_CYBER_VISOR) {
    p3(ctx, hx + 2, hy + 3, ink, 9, 4);
    p3(ctx, hx + 3, hy + 4, THEME.arcane.aquaMid, 7, 2);
    p3(ctx, hx + 4, hy + 4, THEME.arcane.aquaRim, 4, 1);
  }

  if (equipped.head === ITEM_IDS.WEAR_GOLD_CROWN) {
    p3(ctx, hx + 1, hy - 1, ink, 10, 3);
    p3(ctx, hx + 2, hy, THEME.metal.goldMid, 8, 1);
    p3(ctx, hx + 2, hy - 2, THEME.metal.goldLit, 2, 2);
    p3(ctx, hx + 5, hy - 2, THEME.metal.goldRim, 2, 2);
    p3(ctx, hx + 8, hy - 2, THEME.metal.goldLit, 2, 2);
    p3(ctx, hx + 5, hy, '#ff4f5e', 2, 1);
  } else if (equipped.head === ITEM_IDS.WEAR_EXPLORER_HAT) {
    p3(ctx, hx - 1, hy, ink, 14, 2);
    p3(ctx, hx + 1, hy - 2, ink, 10, 3);
    p3(ctx, hx, hy + 1, THEME.wood.deep, 12, 1);
    p3(ctx, hx + 2, hy - 1, THEME.wood.mid, 8, 2);
    p3(ctx, hx + 3, hy - 1, THEME.wood.lit, 5, 1);
    p3(ctx, hx + 2, hy, THEME.metal.goldMid, 8, 1);
  }
}

export function getPlayerSprite(
  pose: PlayerPose,
  facing: 1 | -1,
  shirtColor = '#3f8fd9',
  equipped?: EquippedWearables
): HTMLCanvasElement {
  const eqKey = `${equipped?.head ?? 0}_${equipped?.face ?? 0}_${equipped?.back ?? 0}`;
  const key = `tpl4:${pose}:${facing}:${shirtColor}:${eqKey}`;
  const cached = playerFrames.get(key);
  if (cached) return cached;

  const [c, ctx] = makeCanvas(PLAYER_CANVAS_W, PLAYER_CANVAS_H);
  const shirt = getShirtPalette(shirtColor);
  const normPose: PlayerPose = pose === 'idle' ? 'idle0' : pose === 'punch' ? 'punch3' : pose;

  ctx.save();
  if (facing === -1) {
    ctx.translate(PLAYER_CANVAS_W, 0);
    ctx.scale(-1, 1);
  }

  const CX = 12;
  const isIdle =
    normPose === 'idle0' || normPose === 'idle1' || normPose === 'idle2' || normPose === 'idle3';

  if (isIdle) {
    const breath = normPose === 'idle1' || normPose === 'idle2' ? 1 : 0;
    const hx = CX - 6;
    const hy = 2 + breath;
    const tx = CX - 5;
    const ty = 13 + breath;

    drawTemplateWearables(ctx, equipped, hx, hy, 'back');
    drawTemplateLegVertical(ctx, CX - 5, 20, true);
    drawTemplateLegVertical(ctx, CX + 1, 20, false);
    drawTemplateArmDown(ctx, CX - 7, ty + 1, shirt, false);
    drawTemplateArmDown(ctx, CX + 4, ty + 1, shirt, false);
    drawTemplateTorso(ctx, tx, ty, shirt, 10);
    drawTemplateHead(ctx, hx, hy, 'front');
    drawTemplateWearables(ctx, equipped, hx, hy, 'front');
  } else {
    let bobY = 0;
    let leanX = 0;
    let squint = false;

    if (normPose === 'walk1' || normPose === 'walk3') bobY = -1;
    if (normPose === 'jump') bobY = -1;
    if (normPose === 'fall') bobY = 1;
    const attackPose = new Set<string>(['punch1', 'punch2', 'punch3', 'mine1', 'mine2', 'mine3']);
    if (attackPose.has(normPose)) {
      leanX = 1;
      squint = normPose === 'punch2' || normPose === 'punch3' || normPose === 'mine2' || normPose === 'mine3';
    }
    if (normPose === 'place') leanX = 1;

    const hx = CX - 6 + leanX;
    const hy = 2 + bobY;
    const tx = CX - 4 + leanX;
    const ty = 13 + bobY;

    drawTemplateWearables(ctx, equipped, hx, hy, 'back');

    // 1. Back Arm
    if (normPose === 'walk0') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, -2, 4, shirt, true);
    } else if (normPose === 'walk1') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, 3, 3, shirt, true);
    } else if (normPose === 'walk2') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, 1, 4, shirt, true);
    } else if (normPose === 'walk3') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, -3, 3, shirt, true);
    } else if (normPose === 'jump') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, -4, -3, shirt, true);
    } else if (normPose === 'fall') {
      drawTemplateArmAngled(ctx, tx + 1, ty + 1, -4, 0, shirt, true);
    } else if (normPose === 'punch0' || normPose === 'mine0') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, 1, 4, shirt, true);
    } else if (normPose === 'punch1' || normPose === 'mine1') {
      drawTemplateArmAngled(ctx, tx + 3, ty + 1, 3, 1, shirt, true);
    } else if (normPose === 'punch2' || normPose === 'punch3' || normPose === 'mine2' || normPose === 'mine3') {
      drawTemplateArmAngled(ctx, tx + 1, ty + 1, -2, 3, shirt, true);
    } else if (normPose === 'place') {
      drawTemplateArmAngled(ctx, tx + 1, ty + 1, -1, 4, shirt, true);
    }

    // 2. Legs & Sneakers
    if (normPose === 'walk0') {
      drawTemplateLegStride(ctx, CX - 2, 20, CX - 3, 27, true);
      drawTemplateLegStride(ctx, CX + 1, 20, CX + 2, 27, false);
    } else if (normPose === 'walk1') {
      drawTemplateLegStride(ctx, CX - 1, 19, CX - 5, 27, true);
      drawTemplateLegStride(ctx, CX + 1, 19, CX + 4, 27, false);
    } else if (normPose === 'walk2') {
      drawTemplateLegVertical(ctx, CX - 3, 20, true);
      drawTemplateLegVertical(ctx, CX, 20, false);
    } else if (normPose === 'walk3') {
      drawTemplateLegStride(ctx, CX + 1, 19, CX + 4, 27, true);
      drawTemplateLegStride(ctx, CX - 1, 19, CX - 5, 27, false);
    } else if (normPose === 'jump') {
      drawTemplateLegStride(ctx, CX - 1, 19, CX - 4, 26, true);
      drawTemplateLegVertical(ctx, CX + 1, 19, false, true);
    } else if (normPose === 'fall') {
      drawTemplateLegStride(ctx, CX - 2, 20, CX - 4, 27, true);
      drawTemplateLegStride(ctx, CX + 1, 20, CX + 4, 27, false);
    } else if (normPose === 'punch0' || normPose === 'mine0' || normPose === 'punch1' || normPose === 'mine1') {
      drawTemplateLegStride(ctx, CX - 2, 20, CX - 4, 27, true);
      drawTemplateLegStride(ctx, CX + 2, 20, CX + 3, 27, false);
    } else if (normPose === 'punch2' || normPose === 'punch3' || normPose === 'mine2' || normPose === 'mine3') {
      drawTemplateLegStride(ctx, CX - 1, 20, CX - 4, 27, true);
      drawTemplateLegStride(ctx, CX + 2, 20, CX + 5, 27, false);
    } else {
      drawTemplateLegStride(ctx, CX - 2, 20, CX - 3, 27, true);
      drawTemplateLegStride(ctx, CX + 1, 20, CX + 3, 27, false);
    }

    // 3. Torso & Head
    drawTemplateTorso(ctx, tx, ty, shirt, 8);
    drawTemplateHead(ctx, hx, hy, 'side', squint);
    drawTemplateWearables(ctx, equipped, hx, hy, 'front');

    // 4. Front Arm + Action Impact/Placement FX
    if (normPose === 'walk0') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, 1, 4, shirt, false);
    } else if (normPose === 'walk1') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, -3, 3, shirt, false);
    } else if (normPose === 'walk2') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, -1, 4, shirt, false);
    } else if (normPose === 'walk3') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, 3, 3, shirt, false);
    } else if (normPose === 'jump') {
      drawTemplateArmAngled(ctx, tx + 3, ty + 1, 3, -3, shirt, false);
    } else if (normPose === 'fall') {
      drawTemplateArmAngled(ctx, tx + 3, ty + 1, 4, 0, shirt, false);
    } else if (normPose === 'punch0' || normPose === 'mine0') {
      drawTemplateArmAngled(ctx, tx + 2, ty + 1, -1, 4, shirt, false);
    } else if (normPose === 'punch1' || normPose === 'mine1') {
      drawTemplateArmAngled(ctx, tx + 1, ty + 1, -2, 1, shirt, false);
      p3(ctx, tx + 1, ty + 2, TEMPLATE_PAL.skinLit, 2, 2);
    } else if (normPose === 'punch2') {
      p3(ctx, tx + 2, ty + 1, TEMPLATE_PAL.ink, 8, 3);
      p3(ctx, tx + 2, ty + 2, shirt.lit, 3, 1);
      p3(ctx, tx + 5, ty + 2, TEMPLATE_PAL.skinLit, 4, 1);
    } else if (normPose === 'punch3') {
      p3(ctx, tx + 3, ty + 1, TEMPLATE_PAL.ink, 10, 3);
      p3(ctx, tx + 3, ty + 2, shirt.lit, 4, 1);
      p3(ctx, tx + 7, ty + 2, TEMPLATE_PAL.skinLit, 4, 1);
      p3(ctx, tx + 11, ty + 2, TEMPLATE_PAL.skinRim, 1, 1);
      p3(ctx, tx + 14, ty, TEMPLATE_PAL.eyeWhite, 1, 1);
      p3(ctx, tx + 14, ty + 2, TEMPLATE_PAL.eyeWhite, 2, 1);
      p3(ctx, tx + 14, ty + 4, TEMPLATE_PAL.eyeWhite, 1, 1);
    } else if (normPose === 'mine2' || normPose === 'mine3') {
      drawTemplateArmAngled(ctx, tx + 3, ty + 1, 2, -5, shirt, false);
      const toolX = tx + 6;
      const toolY = ty - 6;
      p3(ctx, toolX, toolY, TEMPLATE_PAL.ink, 2, 5);
      p3(ctx, toolX - 2, toolY, '#a9c4d5', 6, 2);
      p3(ctx, toolX - 1, toolY - 1, '#e7f4fa', 4, 1);
      if (normPose === 'mine3') {
        p3(ctx, toolX + 4, toolY - 2, '#fff1a6', 2, 1);
        p3(ctx, toolX + 6, toolY, '#fff1a6', 1, 1);
      }
    } else if (normPose === 'place') {
      drawTemplateArmAngled(ctx, tx + 3, ty + 1, 5, -2, shirt, false);
      const gx = tx + 9;
      const gy = ty - 3;
      p3(ctx, gx, gy, 'rgba(255, 240, 148, 0.38)', 3, 3);
      p3(ctx, gx, gy, '#fff3a8', 3, 1);
      p3(ctx, gx, gy + 2, '#fff3a8', 3, 1);
      p3(ctx, gx, gy, '#fff3a8', 1, 3);
      p3(ctx, gx + 2, gy, '#fff3a8', 1, 3);
    }
  }

  ctx.restore();
  playerFrames.set(key, c);
  return c;
}
