import {
  BLOCKGROVE_ART_THEME as THEME,
  deriveColorRamp,
  mixHex,
  shadeHex,
} from './artTheme.ts';
import { CATALOG, type ItemDefinition as ItemDef } from './catalog.ts';
import { DRAGON_BONE_WINGS_IMG_CROP, getDragonBoneWingsImage } from './playerSpriteHD.ts';

/**
 * 30-Bit Resolution (30x30 Native Pixel Grid) Artwork Engine for Non-Farmable Catalogue Items.
 *
 * Excludes Farmable Blocks (900..939) and Farmable Seeds (950..989), which use farmableArt.ts.
 * Every remaining item in CATALOG is rendered onto a native 30x30 ("30-bit") pixel canvas
 * with tailored shading, bevels, dithering, and material detailing suited to its name and theme.
 * Because THEME.tileTextureSize is 60, a 30x30 texture scales by an exact 2x integer factor
 * onto world tiles and icons with zero sub-pixel distortion.
 */

export const CATALOG_TEX30_SIZE = 30;

const tex30Cache = new Map<number, HTMLCanvasElement>();

function isFarmableExcluded(itemId: number): boolean {
  return (itemId >= 900 && itemId <= 939) || (itemId >= 950 && itemId <= 989);
}

function prng(seed: number): () => number {
  let s = (seed * 2654435761 + 1013904223) >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= 30 || iy < 0 || iy >= 30) return;
  ctx.fillStyle = color;
  ctx.fillRect(ix, iy, 1, 1);
}

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(30, Math.round(x + w));
  const y1 = Math.min(30, Math.round(y + h));
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

function bevel30(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  hi: string,
  sh: string,
  out: string = THEME.ink.outline
) {
  rect(ctx, x, y, w, h, out);
  if (w <= 2 || h <= 2) {
    rect(ctx, x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2), base);
    return;
  }
  rect(ctx, x + 1, y + 1, w - 2, h - 2, base);
  rect(ctx, x + 1, y + 1, w - 2, 1, hi);
  rect(ctx, x + 1, y + 1, 1, h - 2, hi);
  rect(ctx, x + 1, y + h - 2, w - 2, 1, sh);
  rect(ctx, x + w - 2, y + 1, 1, h - 2, sh);
  // Specular glint on top-left inner rim
  const rim = shadeHex(hi, 0.2);
  rect(ctx, x + 2, y + 1, Math.max(2, Math.floor((w - 4) * 0.45)), 1, rim);
  px(ctx, x + 1, y + 2, rim);
}

function dither30(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cA: string,
  cB: string,
  density = 0.5
) {
  for (let py = y; py < y + h; py++) {
    for (let px0 = x; px0 < x + w; px0++) {
      const bayer = ((px0 & 1) * 2 + (py & 1)) / 4;
      px(ctx, px0, py, bayer < density ? cA : cB);
    }
  }
}

function drawDisc30(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  base: string,
  hi: string,
  sh: string,
  out: string = THEME.ink.outline
) {
  const rOut = r + 0.8;
  for (let y = Math.floor(cy - rOut - 1); y <= Math.ceil(cy + rOut + 1); y++) {
    for (let x = Math.floor(cx - rOut - 1); x <= Math.ceil(cx + rOut + 1); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d <= rOut && d > r - 0.25) {
        px(ctx, x, y, out);
      } else if (d <= r - 0.25) {
        if (dx + dy < -r * 0.45) px(ctx, x, y, hi);
        else if (dx + dy > r * 0.55) px(ctx, x, y, sh);
        else px(ctx, x, y, base);
      }
    }
  }
  px(ctx, Math.round(cx - r * 0.35), Math.round(cy - r * 0.35), '#ffffff');
}

function drawDiamond30(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  base: string,
  hi: string,
  sh: string,
  out: string = THEME.ink.outline
) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const m = Math.abs(dx) + Math.abs(dy);
      if (m <= 1.18 && m > 0.94) {
        px(ctx, x, y, out);
      } else if (m <= 0.94) {
        if (dx + dy < -0.25) px(ctx, x, y, hi);
        else if (dx + dy > 0.3) px(ctx, x, y, sh);
        else px(ctx, x, y, base);
      }
    }
  }
  px(ctx, Math.round(cx - rx * 0.25), Math.round(cy - ry * 0.25), '#ffffff');
}

function drawLine30(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness = 1
) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const r = Math.floor(thickness / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
    rect(ctx, cx - r, cy - r, thickness, thickness, color);
  }
}

function drawBricks30(
  ctx: CanvasRenderingContext2D,
  baseHex: string,
  mortarHex: string,
  seed: number,
  opts?: { recessed?: boolean; rows?: number; cracked?: boolean }
) {
  const ramp = deriveColorRamp(baseHex);
  const out = opts?.recessed ? shadeHex(ramp.outline, -0.15) : ramp.outline;
  const rows = opts?.rows ?? 5;
  const rowH = Math.floor(28 / rows);
  const rand = prng(seed);

  rect(ctx, 0, 0, 30, 30, out);
  rect(ctx, 1, 1, 28, 28, mortarHex);

  for (let r = 0; r < rows; r++) {
    const by = 1 + r * rowH;
    const bh = r === rows - 1 ? 29 - by - 1 : rowH - 1;
    const offset = r % 2 === 1 ? 5 : 0;
    for (let bx = 1 - offset; bx < 29; bx += 10) {
      const x0 = Math.max(1, bx);
      const x1 = Math.min(29, bx + 9);
      const bw = x1 - x0;
      if (bw <= 1) continue;
      const v = (rand() - 0.5) * 0.14;
      const bFill = shadeHex(opts?.recessed ? shadeHex(ramp.base, -0.18) : ramp.base, v);
      const bHi = shadeHex(bFill, 0.2);
      const bSh = shadeHex(bFill, -0.22);
      rect(ctx, x0, by, bw, bh, bFill);
      rect(ctx, x0, by, bw, 1, bHi);
      rect(ctx, x0, by, 1, bh, bHi);
      rect(ctx, x0, by + bh - 1, bw, 1, bSh);
      rect(ctx, x0 + bw - 1, by, 1, bh, bSh);
      if (bw >= 4 && bh >= 3) {
        px(ctx, x0 + 1, by + 1, shadeHex(bHi, 0.12));
        if (opts?.cracked && rand() > 0.65) {
          px(ctx, x0 + Math.floor(bw / 2), by + 1, bSh);
          px(ctx, x0 + Math.floor(bw / 2) + 1, by + 2, bSh);
        }
      }
    }
  }
}

function drawWoodPlanks30(
  ctx: CanvasRenderingContext2D,
  baseHex: string,
  seed: number,
  opts?: { recessed?: boolean; vertical?: boolean }
) {
  const ramp = deriveColorRamp(baseHex);
  const base = opts?.recessed ? shadeHex(ramp.base, -0.2) : ramp.base;
  const hi = shadeHex(base, 0.18);
  const sh = shadeHex(base, -0.22);
  const seam = shadeHex(base, -0.38);
  const rand = prng(seed);

  bevel30(ctx, 0, 0, 30, 30, base, hi, sh, ramp.outline);

  if (opts?.vertical) {
    for (const pxCol of [7, 15, 22]) {
      rect(ctx, pxCol, 1, 1, 28, seam);
      rect(ctx, pxCol + 1, 1, 1, 28, hi);
    }
    for (let y = 2; y < 28; y++) {
      for (let x = 2; x < 28; x++) {
        if (x === 7 || x === 15 || x === 22) continue;
        const wave = Math.sin(y * 0.45 + x * 0.9);
        if (wave > 0.72) px(ctx, x, y, hi);
        else if (wave < -0.72) px(ctx, x, y, sh);
      }
    }
  } else {
    for (const pyRow of [7, 15, 22]) {
      rect(ctx, 1, pyRow, 28, 1, seam);
      rect(ctx, 1, pyRow + 1, 28, 1, hi);
    }
    for (let y = 2; y < 28; y++) {
      if (y === 7 || y === 15 || y === 22) continue;
      for (let x = 2; x < 28; x++) {
        const wave = Math.sin(x * 0.4 + y * 1.1);
        if (wave > 0.74) px(ctx, x, y, hi);
        else if (wave < -0.72) px(ctx, x, y, sh);
      }
    }
    // Wood knots & nails
    for (const [kx, ky] of [
      [8, 4],
      [21, 11],
      [12, 19],
      [23, 25],
    ]) {
      px(ctx, kx, ky, seam);
      px(ctx, kx + 1, ky, sh);
      if (rand() > 0.3) px(ctx, kx - 1, ky, hi);
    }
    for (const [nx, ny] of [
      [3, 3],
      [26, 3],
      [3, 10],
      [26, 10],
      [3, 18],
      [26, 18],
      [3, 25],
      [26, 25],
    ]) {
      px(ctx, nx, ny, seam);
    }
  }
}

function drawStoneMatrix30(
  ctx: CanvasRenderingContext2D,
  baseHex: string,
  secondaryHex: string,
  accentHex: string,
  seed: number,
  style: 'cobble' | 'strata' | 'granular' | 'crystalline' = 'cobble'
) {
  const ramp = deriveColorRamp(baseHex);
  const secRamp = deriveColorRamp(secondaryHex);
  const rand = prng(seed);

  bevel30(ctx, 0, 0, 30, 30, ramp.base, ramp.highlight, ramp.shadow, ramp.outline);

  for (let y = 2; y < 28; y++) {
    for (let x = 2; x < 28; x++) {
      const r = rand();
      if (style === 'strata') {
        const band = Math.floor((y + Math.sin(x * 0.35) * 1.8) / 3) % 3;
        if (band === 0) px(ctx, x, y, r > 0.3 ? ramp.highlight : accentHex);
        else if (band === 1) px(ctx, x, y, r > 0.5 ? ramp.base : secRamp.base);
        else px(ctx, x, y, r > 0.4 ? ramp.shadow : secRamp.shadow);
      } else if (style === 'granular') {
        if (r < 0.22) px(ctx, x, y, ramp.highlight);
        else if (r < 0.44) px(ctx, x, y, ramp.shadow);
        else if (r < 0.56) px(ctx, x, y, secRamp.base);
        else if (r < 0.62) px(ctx, x, y, accentHex);
      } else if (style === 'crystalline') {
        const diag = (x + y * 2) % 9;
        if (diag === 0) px(ctx, x, y, accentHex);
        else if (diag === 1) px(ctx, x, y, ramp.highlight);
        else if (diag === 5) px(ctx, x, y, ramp.shadow);
        else if (r < 0.15) px(ctx, x, y, secRamp.highlight);
      } else {
        // Cobble fractures
        const cell = ((x * 5 + y * 7) ^ Math.floor(r * 13)) % 11;
        if (cell === 0) px(ctx, x, y, ramp.shadow);
        else if (cell === 1) px(ctx, x, y, ramp.highlight);
        else if (cell === 2) px(ctx, x, y, secRamp.base);
        else if (r < 0.08) px(ctx, x, y, accentHex);
      }
    }
  }
}

function drawPickaxe30(
  ctx: CanvasRenderingContext2D,
  headPrimary: string,
  headSecondary: string,
  headAccent: string,
  shaftColor = '#8b5a2b',
  crystalGlow = false
) {
  const out = THEME.ink.outline;
  const shaftHi = shadeHex(shaftColor, 0.22);
  const shaftSh = shadeHex(shaftColor, -0.25);

  // Diagonal wooden shaft from bottom-left (4,25) to top-right (22,7)
  for (let i = 0; i <= 18; i++) {
    const sx = 4 + i;
    const sy = 25 - i;
    rect(ctx, sx - 1, sy - 1, 4, 4, out);
  }
  for (let i = 0; i <= 18; i++) {
    const sx = 4 + i;
    const sy = 25 - i;
    px(ctx, sx, sy, shaftHi);
    px(ctx, sx + 1, sy, shaftColor);
    px(ctx, sx, sy + 1, shaftColor);
    px(ctx, sx + 1, sy + 1, shaftSh);
  }
  // Pommel cap at bottom-left
  bevel30(ctx, 2, 24, 5, 5, headSecondary, headAccent, shadeHex(headSecondary, -0.25), out);

  // Curved twin-fluke pickaxe head centered at (19, 10)
  // Upper-left prong arching from (8, 4) to (19, 10)
  // Lower-right prong arching from (19, 10) to (26, 21)
  const headPixels: Array<[number, number, 'hi' | 'base' | 'sh' | 'spark']> = [
    // Left fluke
    [8, 5, 'spark'], [9, 4, 'hi'], [10, 4, 'hi'], [11, 4, 'hi'], [12, 5, 'hi'],
    [13, 5, 'hi'], [14, 6, 'hi'], [15, 6, 'hi'], [16, 7, 'hi'], [17, 8, 'hi'],
    [9, 5, 'base'], [10, 5, 'base'], [11, 5, 'base'], [12, 6, 'base'], [13, 6, 'base'],
    [14, 7, 'base'], [15, 7, 'base'], [16, 8, 'base'], [17, 9, 'base'],
    [10, 6, 'sh'], [11, 6, 'sh'], [12, 7, 'sh'], [13, 7, 'sh'], [14, 8, 'sh'],
    [15, 8, 'sh'], [16, 9, 'sh'],
    // Center collar
    [18, 8, 'hi'], [19, 8, 'spark'], [20, 9, 'hi'], [21, 10, 'hi'],
    [18, 9, 'base'], [19, 9, 'base'], [20, 10, 'base'], [19, 10, 'base'], [20, 11, 'sh'],
    // Right fluke
    [21, 11, 'hi'], [22, 12, 'hi'], [23, 13, 'hi'], [24, 14, 'hi'], [25, 15, 'hi'],
    [25, 16, 'hi'], [25, 17, 'hi'], [25, 18, 'hi'], [24, 19, 'spark'],
    [20, 12, 'base'], [21, 12, 'base'], [22, 13, 'base'], [23, 14, 'base'],
    [24, 15, 'base'], [24, 16, 'base'], [24, 17, 'base'], [24, 18, 'base'],
    [20, 13, 'sh'], [21, 13, 'sh'], [22, 14, 'sh'], [23, 15, 'sh'], [23, 16, 'sh'], [23, 17, 'sh'],
  ];

  for (const [hx, hy] of headPixels) {
    rect(ctx, hx - 1, hy - 1, 3, 3, out);
  }
  for (const [hx, hy, tone] of headPixels) {
    const col =
      tone === 'spark'
        ? '#ffffff'
        : tone === 'hi'
          ? headAccent
          : tone === 'base'
            ? headPrimary
            : headSecondary;
    px(ctx, hx, hy, col);
  }
  if (crystalGlow) {
    for (const [gx, gy] of [
      [7, 3],
      [14, 3],
      [26, 12],
      [26, 20],
    ]) {
      px(ctx, gx, gy, headAccent);
      px(ctx, gx + 1, gy, '#ffffff');
    }
  }
}

function drawFishingRod30(
  ctx: CanvasRenderingContext2D,
  rodPrimary: string,
  rodSecondary: string,
  rodAccent: string,
  tier: number
) {
  const out = THEME.ink.outline;
  // Diagonal rod blank from bottom-left (3, 26) to top-right (23, 4)
  for (let i = 0; i <= 20; i++) {
    const rx = 3 + i;
    const ry = 26 - Math.round(i * 1.1);
    const w = i < 6 ? 3 : 2;
    rect(ctx, rx - 1, ry - 1, w + 1, w + 1, out);
  }
  for (let i = 0; i <= 20; i++) {
    const rx = 3 + i;
    const ry = 26 - Math.round(i * 1.1);
    if (i < 6) {
      // Cork/wrapped grip
      px(ctx, rx, ry, i % 2 === 0 ? '#d97706' : '#f59e0b');
      px(ctx, rx + 1, ry, rodSecondary);
    } else {
      px(ctx, rx, ry, i % 3 === 0 ? rodAccent : rodPrimary);
      if (i < 14) px(ctx, rx + 1, ry, rodSecondary);
    }
  }

  // Spinning Reel mounted near (9, 20)
  drawDisc30(ctx, 10, 20, 3.2, rodSecondary, rodAccent, shadeHex(rodSecondary, -0.3), out);
  px(ctx, 10, 20, '#ffffff');

  // Fishing line dropping from tip (23, 4) down to bobber/lure at (24, 21)
  for (let ly = 5; ly <= 17; ly++) {
    px(ctx, 24, ly, tier >= 4 ? rodAccent : '#cbd5e1');
  }

  // Tiered Lure / Bobber at (24, 20)
  drawDisc30(
    ctx,
    24,
    20,
    tier >= 4 ? 3.5 : 2.8,
    tier >= 5 ? rodAccent : '#ef4444',
    '#ffffff',
    rodSecondary,
    out
  );
  // Hook below bobber
  px(ctx, 24, 24, out);
  px(ctx, 24, 25, '#e2e8f0');
  px(ctx, 23, 26, '#e2e8f0');
  px(ctx, 22, 25, '#ffffff');

  if (tier >= 3) {
    // Aura sparkles for higher-tier rods
    for (let s = 0; s < tier - 1; s++) {
      const sx = 6 + ((s * 7) % 14);
      const sy = 4 + ((s * 5) % 10);
      px(ctx, sx, sy, rodAccent);
      px(ctx, sx + 1, sy, '#ffffff');
    }
  }
}

function drawOreVeinTile30(
  ctx: CanvasRenderingContext2D,
  orePrimary: string,
  oreSecondary: string,
  oreAccent: string,
  rockBase: string,
  seed: number
) {
  drawStoneMatrix30(ctx, rockBase, shadeHex(rockBase, -0.18), shadeHex(rockBase, 0.14), seed, 'cobble');
  const out = THEME.ink.outline;
  const clusters: Array<[number, number, number, number]> = [
    [6, 6, 4, 3],
    [19, 7, 5, 4],
    [12, 14, 6, 4],
    [6, 21, 5, 4],
    [20, 20, 5, 4],
  ];
  for (const [cx, cy, rx, ry] of clusters) {
    drawDiamond30(ctx, cx, cy, rx * 0.7, ry * 0.7, orePrimary, oreAccent, oreSecondary, out);
  }
}

function drawRawOreChunk30(
  ctx: CanvasRenderingContext2D,
  def: ItemDef,
  tierIndex: number
) {
  const out = THEME.ink.outline;
  const p = def.colorPrimary;
  const s = def.colorSecondary;
  const a = def.colorAccent;

  // Dark matrix pedestal base at bottom
  bevel30(ctx, 5, 19, 20, 7, '#334155', '#64748b', '#1e293b', out);

  // Multi-spired crystalline / metallic raw ore cluster rising from matrix
  const spires: Array<[number, number, number, number]> = [
    [15, 13, 6, 9],
    [9, 15, 4.5, 6.5],
    [21, 15, 4.5, 6.5],
  ];
  if (tierIndex >= 5) {
    spires.push([12, 10, 4, 7], [18, 10, 4, 7]);
  }
  for (const [cx, cy, rx, ry] of spires) {
    drawDiamond30(ctx, cx, cy, rx, ry, p, a, s, out);
  }
  // Extra specular facet lines & sparkles for high-tier ores
  drawLine30(ctx, 15, 6, 15, 18, a, 1);
  px(ctx, 14, 7, '#ffffff');
  px(ctx, 15, 7, '#ffffff');
  if (tierIndex >= 4) {
    for (const [gx, gy] of [
      [5, 6],
      [24, 6],
      [4, 13],
      [25, 13],
    ]) {
      px(ctx, gx, gy, a);
      px(ctx, gx + 1, gy, '#ffffff');
    }
  }
}

function drawFragment30(ctx: CanvasRenderingContext2D, p: string, s: string, a: string) {
  const out = THEME.ink.outline;
  // Trio of jagged mineral shards
  drawDiamond30(ctx, 13, 14, 6, 7, p, a, s, out);
  drawDiamond30(ctx, 20, 18, 4.5, 5, p, a, s, out);
  drawDiamond30(ctx, 8, 20, 3.5, 4, s, p, shadeHex(s, -0.25), out);
  px(ctx, 12, 10, '#ffffff');
  px(ctx, 19, 16, '#ffffff');
}

function drawIngot30(ctx: CanvasRenderingContext2D, p: string, s: string, a: string) {
  const out = THEME.ink.outline;
  // Bottom ingot in stack
  bevel30(ctx, 4, 16, 22, 8, s, p, shadeHex(s, -0.3), out);
  // Top tilted ingot with trapezoidal top bevel
  bevel30(ctx, 6, 9, 18, 9, p, a, s, out);
  rect(ctx, 9, 11, 12, 4, mixHex(p, a, 0.45));
  rect(ctx, 10, 11, 5, 1, '#ffffff');
  // Foundry hallmark stamp in center
  px(ctx, 14, 13, s);
  px(ctx, 15, 13, s);
}

function drawFish30(
  ctx: CanvasRenderingContext2D,
  bodyPrimary: string,
  bodySecondary: string,
  finAccent: string,
  variant: 'minnow' | 'carp' | 'trout' | 'slimefin'
) {
  const out = THEME.ink.outline;
  const bodyRx = variant === 'carp' ? 9 : variant === 'minnow' ? 7.5 : 8.5;
  const bodyRy = variant === 'carp' ? 6.5 : variant === 'minnow' ? 4.2 : 5.2;

  // Forked caudal tail fin at right (21..27, 9..21)
  for (let ty = 9; ty <= 21; ty++) {
    const dist = Math.abs(ty - 15);
    const txStart = 20 + Math.floor(dist * 0.4);
    const txEnd = 25 + Math.floor(dist * 0.35);
    rect(ctx, txStart - 1, ty - 1, txEnd - txStart + 3, 3, out);
  }
  for (let ty = 9; ty <= 21; ty++) {
    const dist = Math.abs(ty - 15);
    const txStart = 20 + Math.floor(dist * 0.4);
    const txEnd = 25 + Math.floor(dist * 0.35);
    rect(ctx, txStart, ty, Math.max(1, txEnd - txStart + 1), 1, dist % 2 === 0 ? finAccent : bodySecondary);
  }

  // Dorsal fin on top (11..18, 6..10) & ventral fin on bottom
  bevel30(ctx, 11, 6, 7, 5, bodySecondary, finAccent, shadeHex(bodySecondary, -0.25), out);
  bevel30(ctx, 12, 19, 6, 4, bodySecondary, finAccent, shadeHex(bodySecondary, -0.25), out);

  // Elliptical fish body centered at (13, 15)
  for (let y = 7; y <= 23; y++) {
    for (let x = 3; x <= 22; x++) {
      const dx = (x - 13) / bodyRx;
      const dy = (y - 15) / bodyRy;
      const d = Math.hypot(dx, dy);
      if (d <= 1.14 && d > 0.94) {
        px(ctx, x, y, out);
      } else if (d <= 0.94) {
        if (dy < -0.3) px(ctx, x, y, bodySecondary);
        else if (dy > 0.35) px(ctx, x, y, finAccent);
        else {
          // Scale pattern
          const scale = (x + y) % 3 === 0;
          px(ctx, x, y, scale ? mixHex(bodyPrimary, finAccent, 0.35) : bodyPrimary);
        }
      }
    }
  }

  // Gill arch & eye at left (7..9, 13..16)
  px(ctx, 10, 13, out);
  px(ctx, 10, 14, out);
  px(ctx, 10, 15, out);
  px(ctx, 10, 16, out);
  rect(ctx, 6, 13, 3, 3, '#ffffff');
  rect(ctx, 6, 14, 2, 2, out);
  px(ctx, 7, 13, '#ffffff');

  if (variant === 'slimefin') {
    // Glowing toxic slime droplets & dorsal spines
    for (const [gx, gy] of [
      [8, 6],
      [15, 4],
      [10, 24],
      [18, 24],
    ]) {
      px(ctx, gx, gy, '#a3e635');
      px(ctx, gx, gy + 1, '#4ade80');
    }
  } else if (variant === 'trout') {
    // Rainbow lateral stripe & ice sparkles
    rect(ctx, 8, 15, 11, 1, '#f472b6');
    px(ctx, 7, 8, '#ffffff');
    px(ctx, 19, 7, '#bae6fd');
  }
}

/**
 * Draws the native 30x30 (30-bit) pixel art for any non-farmable item in CATALOG.
 * Returns true if handled, false if the itemId is a farmable block/seed (900..939, 950..989) or Empty Air (0).
 */
export function drawCatalogItemRaw30(
  ctx: CanvasRenderingContext2D,
  itemId: number,
  def: ItemDef | undefined = CATALOG[itemId]
): boolean {
  if (itemId === 0 || isFarmableExcluded(itemId)) return false;

  const out = THEME.ink.outline;
  const p = def?.colorPrimary ?? '#64748b';
  const s = def?.colorSecondary ?? '#334155';
  const a = def?.colorAccent ?? '#cbd5e1';

  switch (itemId) {
    // =========================================================================
    // 1. CORE TOOLS, PRIMITIVES, LOCKS, FLUIDS, MACHINES & SCROLL (1..157)
    // =========================================================================
    case 1: {
      // Builder Fist — Armored leather builder gauntlet with brass knuckle plates
      bevel30(ctx, 6, 9, 18, 14, '#d97706', '#fbbf24', '#92400e', out);
      // Four articulated fingers across top
      for (let f = 0; f < 4; f++) {
        bevel30(ctx, 6 + f * 4, 6, 5, 6, '#f59e0b', '#fde68a', '#b45309', out);
      }
      // Thumb tucked across front
      bevel30(ctx, 4, 13, 8, 5, '#f59e0b', '#fde68a', '#b45309', out);
      // Studded leather wrist cuff
      bevel30(ctx, 7, 21, 16, 6, '#78350f', '#a16207', '#451a03', out);
      for (const rx of [10, 15, 20]) {
        px(ctx, rx, 23, '#fde047');
        px(ctx, rx, 12, '#fef08a');
      }
      return true;
    }

    case 2: {
      // Tinker Wrench — Forged chrome-vanadium S-spanner with calibration dial
      drawLine30(ctx, 7, 23, 22, 8, out, 7);
      drawLine30(ctx, 7, 23, 22, 8, '#64748b', 5);
      drawLine30(ctx, 7, 22, 21, 8, '#cbd5e1', 2);
      // Upper open jaw at (21, 8)
      bevel30(ctx, 17, 3, 10, 9, '#94a3b8', '#f8fafc', '#475569', out);
      rect(ctx, 21, 3, 5, 5, 'rgba(0,0,0,0)');
      rect(ctx, 21, 4, 4, 4, out);
      // Worm-gear adjustment dial
      rect(ctx, 17, 10, 4, 2, '#38bdf8');
      // Lower ring-spanner eye at (7, 23)
      drawDisc30(ctx, 7, 23, 4.5, '#94a3b8', '#f8fafc', '#475569', out);
      drawDisc30(ctx, 7, 23, 1.8, '#0f172a', '#38bdf8', '#0f172a', out);
      return true;
    }

    case 3: {
      // Sky background — Stratospheric azure gradient with fluffy cumulus cloud
      for (let y = 0; y < 30; y++) {
        const t = y / 29;
        rect(ctx, 0, y, 30, 1, mixHex('#38bdf8', '#bae6fd', t));
      }
      drawDisc30(ctx, 11, 15, 4.5, '#f8fafc', '#ffffff', '#cbd5e1', '#94a3b8');
      drawDisc30(ctx, 16, 14, 5.2, '#ffffff', '#ffffff', '#cbd5e1', '#94a3b8');
      drawDisc30(ctx, 21, 16, 3.8, '#f8fafc', '#ffffff', '#cbd5e1', '#94a3b8');
      return true;
    }

    case 10: {
      // Abyssal Bedrock — Indestructible dark tectonic plates with void-violet seams
      drawStoneMatrix30(ctx, '#1e293b', '#0f172a', '#475569', 10, 'cobble');
      // Deep interlocking obsidian plates & abyssal runes
      for (const [bx, by, bw, bh] of [
        [2, 2, 12, 11],
        [15, 2, 13, 12],
        [2, 14, 14, 14],
        [17, 15, 11, 13],
      ]) {
        bevel30(ctx, bx, by, bw, bh, '#1e293b', '#475569', '#090d16', out);
        px(ctx, bx + 2, by + 2, '#6366f1');
        px(ctx, bx + bw - 3, by + bh - 3, '#312e81');
      }
      return true;
    }

    case 100: {
      // World Gate (Entrance Portal) — Ornate stone archway with swirling dimensional vortex
      rect(ctx, 0, 0, 30, 30, '#0f172a');
      // Left & right carved pillars
      bevel30(ctx, 1, 4, 6, 25, '#64748b', '#cbd5e1', '#334155', out);
      bevel30(ctx, 23, 4, 6, 25, '#64748b', '#cbd5e1', '#334155', out);
      // Arch lintel & golden keystone
      bevel30(ctx, 0, 1, 30, 6, '#475569', '#94a3b8', '#1e293b', out);
      bevel30(ctx, 11, 0, 8, 7, '#f59e0b', '#fef08a', '#b45309', out);
      // Threshold steps
      bevel30(ctx, 0, 26, 30, 4, '#475569', '#94a3b8', '#1e293b', out);
      // Swirling cyan-violet portal vortex inside (7..22, 7..25)
      for (let y = 7; y < 26; y++) {
        for (let x = 7; x < 23; x++) {
          const dx = x - 14.5;
          const dy = (y - 16.5) * 0.8;
          const r = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx) + r * 0.55;
          const swirl = Math.sin(angle * 2);
          if (r < 2.2) px(ctx, x, y, '#ffffff');
          else if (swirl > 0.35) px(ctx, x, y, '#67e8f9');
          else if (swirl > -0.25) px(ctx, x, y, '#0284c7');
          else px(ctx, x, y, '#4f46e5');
        }
      }
      return true;
    }

    case 101: {
      // World Lock — Royal sunforged gold vault lock with ruby crown crest
      // Heavy steel shackle at top
      bevel30(ctx, 7, 1, 16, 10, '#cbd5e1', '#ffffff', '#64748b', out);
      rect(ctx, 11, 4, 8, 7, '#0f172a');
      // Ornate gold lock body
      bevel30(ctx, 2, 9, 26, 20, '#eab308', '#fef08a', '#a16207', out);
      bevel30(ctx, 4, 11, 22, 16, '#f59e0b', '#fde047', '#b45309', out);
      // Royal ruby & emerald corner gems
      for (const [gx, gy, col] of [
        [6, 13, '#ef4444'],
        [22, 13, '#ef4444'],
        [6, 23, '#10b981'],
        [22, 23, '#10b981'],
      ] as const) {
        rect(ctx, gx, gy, 2, 2, col);
        px(ctx, gx, gy, '#ffffff');
      }
      // Center crown emblem & glowing keyhole
      rect(ctx, 11, 13, 8, 3, '#dc2626');
      px(ctx, 11, 12, '#fef08a');
      px(ctx, 14, 12, '#fef08a');
      px(ctx, 18, 12, '#fef08a');
      drawDisc30(ctx, 15, 20, 2.5, '#0f172a', '#38bdf8', '#0f172a', '#fef08a');
      rect(ctx, 14, 21, 2, 4, '#0f172a');
      return true;
    }

    case 102: {
      // Builder Area Lock (Small Lock) — Burnished bronze padlock with emerald indicator
      bevel30(ctx, 8, 2, 14, 10, '#94a3b8', '#f8fafc', '#475569', out);
      rect(ctx, 11, 5, 8, 7, '#0f172a');
      bevel30(ctx, 4, 10, 22, 18, '#d97706', '#fcd34d', '#78350f', out);
      bevel30(ctx, 6, 12, 18, 14, '#b45309', '#f59e0b', '#451a03', out);
      // Keyhole & emerald status gem
      drawDisc30(ctx, 15, 18, 2.2, '#0f172a', '#4ade80', '#0f172a', '#fcd34d');
      rect(ctx, 14, 19, 2, 4, '#0f172a');
      rect(ctx, 8, 14, 2, 2, '#22c55e');
      px(ctx, 8, 14, '#ffffff');
      return true;
    }

    case 103: {
      // Personal Vending Machine — Lit display cabinet with shelves, price screen & chute
      bevel30(ctx, 2, 1, 26, 28, '#0284c7', '#7dd3fc', '#0c4a6e', out);
      // Top illuminated header banner
      bevel30(ctx, 4, 3, 22, 5, '#0f172a', '#38bdf8', '#020617', out);
      rect(ctx, 6, 5, 18, 1, '#fde047');
      // Glass display window (left) with 2 merchandise shelves
      bevel30(ctx, 4, 9, 15, 13, '#082f49', '#38bdf8', '#041e30', out);
      rect(ctx, 5, 14, 13, 1, '#94a3b8');
      rect(ctx, 5, 19, 13, 1, '#94a3b8');
      // Merchandise items on shelves
      rect(ctx, 6, 11, 3, 3, '#f43f5e');
      rect(ctx, 10, 11, 3, 3, '#22c55e');
      rect(ctx, 14, 11, 3, 3, '#eab308');
      rect(ctx, 6, 16, 3, 3, '#a855f7');
      rect(ctx, 10, 16, 3, 3, '#38bdf8');
      rect(ctx, 14, 16, 3, 3, '#f97316');
      // Right control strip: coin slot & keypad
      bevel30(ctx, 20, 9, 6, 13, '#1e293b', '#64748b', '#0f172a', out);
      rect(ctx, 22, 11, 2, 2, '#facc15');
      rect(ctx, 21, 15, 4, 4, '#38bdf8');
      // Bottom pickup flap
      bevel30(ctx, 4, 23, 22, 5, '#0f172a', '#475569', '#020617', out);
      rect(ctx, 8, 25, 14, 1, '#38bdf8');
      return true;
    }

    case 110: {
      // Water Source — Cascading crystalline spring with whitecap foam & caustics
      bevel30(ctx, 0, 0, 30, 30, '#0284c7', '#7dd3fc', '#0369a1', '#0c4a6e');
      for (let y = 2; y < 28; y++) {
        for (let x = 2; x < 28; x++) {
          const wave = Math.sin(x * 0.45 + y * 0.3) + Math.cos(y * 0.55 - x * 0.25);
          if (y <= 5) px(ctx, x, y, y <= 3 ? '#ffffff' : '#bae6fd');
          else if (wave > 1.15) px(ctx, x, y, '#e0f2fe');
          else if (wave > 0.45) px(ctx, x, y, '#38bdf8');
          else if (wave < -0.65) px(ctx, x, y, '#0369a1');
        }
      }
      return true;
    }

    case 111: {
      // Acid Vat — Industrial hazard tank brimming with bubbling neon-lime acid
      bevel30(ctx, 0, 0, 30, 30, '#166534', '#4ade80', '#052e16', out);
      // Hazard stripe top & bottom rims
      for (let x = 1; x < 29; x++) {
        const stripe = ((x + 1) >> 1) % 2 === 0 ? '#facc15' : '#1e293b';
        px(ctx, x, 1, stripe);
        px(ctx, x, 2, stripe);
        px(ctx, x, 27, stripe);
        px(ctx, x, 28, stripe);
      }
      // Bubbling corrosive fluid interior
      rect(ctx, 2, 4, 26, 22, '#15803d');
      rect(ctx, 2, 4, 26, 4, '#bef264');
      rect(ctx, 2, 8, 26, 5, '#4ade80');
      for (const [bx, by, br] of [
        [7, 12, 2.2],
        [15, 16, 2.8],
        [22, 11, 2.0],
        [11, 21, 1.8],
        [20, 20, 2.2],
      ]) {
        drawDisc30(ctx, bx, by, br, '#86efac', '#ecfccb', '#16a34a', '#14532d');
      }
      return true;
    }

    case 112: {
      // Bounce Pad — Coiled spring-steel launcher with crimson-gold chevron cushion
      rect(ctx, 0, 0, 30, 30, 'rgba(0,0,0,0)');
      // Heavy steel baseplate
      bevel30(ctx, 2, 23, 26, 6, '#475569', '#94a3b8', '#1e293b', out);
      // Twin coiled steel springs
      for (let sy = 12; sy <= 22; sy += 3) {
        bevel30(ctx, 6, sy, 18, 3, '#cbd5e1', '#ffffff', '#64748b', out);
      }
      // High-visibility launcher cushion pad on top
      bevel30(ctx, 1, 5, 28, 8, '#e11d48', '#fda4af', '#881337', out);
      // Upward launch chevrons
      for (const cx of [8, 15, 22]) {
        px(ctx, cx, 7, '#fef08a');
        px(ctx, cx - 1, 8, '#fef08a');
        px(ctx, cx + 1, 8, '#fef08a');
        px(ctx, cx - 2, 9, '#facc15');
        px(ctx, cx + 2, 9, '#facc15');
      }
      return true;
    }

    case 120: {
      // Furnace — Heavy basalt smelter with roaring firebox & iron grate
      drawBricks30(ctx, '#475569', '#1e293b', 120, { rows: 5 });
      // Top chimney crown & brass gauge
      bevel30(ctx, 3, 1, 24, 6, '#334155', '#94a3b8', '#0f172a', out);
      drawDisc30(ctx, 15, 4, 2.0, '#fef08a', '#ffffff', '#ea580c', out);
      // Arched firebox opening (6..24, 10..26)
      bevel30(ctx, 5, 9, 20, 18, '#0f172a', '#475569', '#020617', out);
      // Roaring magma/coal flames inside
      rect(ctx, 7, 11, 16, 14, '#7c2d12');
      rect(ctx, 8, 13, 14, 12, '#ea580c');
      rect(ctx, 9, 16, 12, 9, '#facc15');
      rect(ctx, 11, 19, 8, 6, '#fef9c3');
      // Iron grate bars across firebox
      for (const gx of [10, 14, 18, 21]) {
        rect(ctx, gx, 11, 1, 15, '#1e293b');
      }
      return true;
    }

    case 121: {
      // BFG Auto-Collector — Magnetic vacuum harvester with glowing cyan vortex turbine
      bevel30(ctx, 1, 1, 28, 28, '#0f172a', '#38bdf8', '#020617', out);
      bevel30(ctx, 3, 3, 24, 24, '#1e293b', '#64748b', '#090d16', out);
      // Gold magnetic bus coils on all 4 sides
      rect(ctx, 12, 1, 6, 3, '#facc15');
      rect(ctx, 12, 26, 6, 3, '#facc15');
      rect(ctx, 1, 12, 3, 6, '#facc15');
      rect(ctx, 26, 12, 3, 6, '#facc15');
      // Central cyan plasma turbine core
      drawDisc30(ctx, 15, 15, 8.5, '#0284c7', '#7dd3fc', '#0c4a6e', out);
      drawDisc30(ctx, 15, 15, 5.2, '#22d3ee', '#cffafe', '#0284c7', out);
      drawDisc30(ctx, 15, 15, 2.2, '#ffffff', '#ffffff', '#67e8f9', '#0284c7');
      return true;
    }

    case 122: {
      // Exchange Terminal — Financial brokerage console with live candlestick chart & keypad
      bevel30(ctx, 1, 1, 28, 28, '#1e293b', '#64748b', '#0f172a', out);
      // Gold marquee header
      bevel30(ctx, 3, 2, 24, 5, '#b45309', '#fde047', '#78350f', out);
      // Dark green CRT trading screen
      bevel30(ctx, 3, 7, 24, 14, '#052e16', '#22c55e', '#022c22', out);
      // Grid lines & rising green/gold candlestick bars
      for (const [cx, cy, ch, col] of [
        [6, 16, 3, '#ef4444'],
        [9, 14, 4, '#22c55e'],
        [12, 13, 5, '#4ade80'],
        [15, 15, 3, '#ef4444'],
        [18, 11, 6, '#4ade80'],
        [21, 9, 7, '#facc15'],
        [24, 8, 8, '#fde047'],
      ] as const) {
        rect(ctx, cx, cy, 2, ch, col);
        px(ctx, cx, cy - 1, '#ffffff');
      }
      // Brass keyboard deck at bottom
      bevel30(ctx, 3, 22, 24, 6, '#334155', '#94a3b8', '#0f172a', out);
      for (let kx = 5; kx <= 23; kx += 3) {
        rect(ctx, kx, 24, 2, 2, kx === 23 ? '#22c55e' : '#eab308');
      }
      return true;
    }

    case 123: {
      // Mining Shaft Scroll — Rolled expedition vellum with gilded dowels & crimson wax seal
      // Top & bottom wooden scroll rollers with gold finials
      bevel30(ctx, 3, 3, 24, 4, '#92400e', '#f59e0b', '#451a03', out);
      bevel30(ctx, 3, 23, 24, 4, '#92400e', '#f59e0b', '#451a03', out);
      rect(ctx, 2, 4, 2, 2, '#fde047');
      rect(ctx, 26, 4, 2, 2, '#fde047');
      rect(ctx, 2, 24, 2, 2, '#fde047');
      rect(ctx, 26, 24, 2, 2, '#fde047');
      // Parchment body
      bevel30(ctx, 5, 6, 20, 18, '#fde68a', '#fef9c3', '#d97706', out);
      // Map contour lines & shaft diagram
      rect(ctx, 8, 9, 14, 1, '#92400e');
      rect(ctx, 8, 12, 10, 1, '#b45309');
      rect(ctx, 8, 15, 12, 1, '#b45309');
      // Crimson wax seal with gold ribbon at bottom-right
      drawDisc30(ctx, 19, 19, 3.2, '#dc2626', '#fca5a5', '#7f1d1d', out);
      px(ctx, 19, 19, '#fde047');
      return true;
    }

    // =========================================================================
    // 2. PICKAXES, HOE & FISHING RODS (130..140)
    // =========================================================================
    case 130:
      drawPickaxe30(ctx, '#94a3b8', '#475569', '#e2e8f0', '#8b5a2b', false);
      return true;
    case 131:
      drawPickaxe30(ctx, '#e2e8f0', '#64748b', '#ffffff', '#78350f', false);
      return true;
    case 132:
      drawPickaxe30(ctx, '#38bdf8', '#0284c7', '#e0f2fe', '#1e293b', true);
      return true;
    case 133: {
      // Farming Hoe — Curved steel cultivator blade on long timber handle
      drawLine30(ctx, 4, 25, 22, 7, out, 5);
      drawLine30(ctx, 4, 25, 22, 7, '#a16207', 3);
      drawLine30(ctx, 4, 24, 21, 7, '#f59e0b', 1);
      // Single curved cultivator blade sweeping down-right from (20, 6) to (26, 15)
      bevel30(ctx, 18, 4, 9, 5, '#cbd5e1', '#ffffff', '#475569', out);
      bevel30(ctx, 22, 8, 5, 8, '#94a3b8', '#f8fafc', '#334155', out);
      rect(ctx, 23, 14, 3, 2, '#facc15');
      return true;
    }
    case 135:
      drawFishingRod30(ctx, '#ca8a04', '#854d0e', '#fde047', 1);
      return true;
    case 136:
      drawFishingRod30(ctx, '#0284c7', '#1e3a8a', '#7dd3fc', 2);
      return true;
    case 137:
      drawFishingRod30(ctx, '#16a34a', '#14532d', '#86efac', 3);
      return true;
    case 138:
      drawFishingRod30(ctx, '#9333ea', '#4c1d95', '#e9d5ff', 4);
      return true;
    case 139:
      drawFishingRod30(ctx, '#e11d48', '#881337', '#fda4af', 5);
      return true;
    case 140:
      drawFishingRod30(ctx, '#ec4899', '#581c87', '#fef08a', 6);
      return true;

    // =========================================================================
    // 3. SHARE LOCKS, WORLDCORE, NPCS, WORLD BLAST & LOOTBOX (150..157)
    // =========================================================================
    case 150:
    case 151:
    case 152: {
      // Micro / Small / Cover Share Locks — Co-op guild locks with linked dual keyholes
      const tier = itemId - 150; // 0, 1, 2
      bevel30(ctx, 7, 2, 16, 9, '#cbd5e1', '#ffffff', '#475569', out);
      rect(ctx, 10, 5, 10, 6, '#0f172a');
      bevel30(ctx, 3, 9, 24, 19, p, a, s, out);
      bevel30(ctx, 5, 11, 20, 15, s, p, shadeHex(s, -0.25), out);
      // Linked twin keyholes symbolizing shared access
      drawDisc30(ctx, 11, 17, 2.0, '#0f172a', a, '#0f172a', '#ffffff');
      drawDisc30(ctx, 19, 17, 2.0, '#0f172a', a, '#0f172a', '#ffffff');
      rect(ctx, 13, 17, 4, 1, '#fef08a');
      rect(ctx, 10, 19, 2, 4, '#0f172a');
      rect(ctx, 18, 19, 2, 4, '#0f172a');
      // Tier pips along top of lock body
      for (let i = 0; i <= tier; i++) {
        rect(ctx, 11 + i * 3, 12, 2, 2, '#fef08a');
      }
      return true;
    }

    case 153: {
      // WorldCore — Celestial golden-cyan reactor orb inside an obsidian astrolabe frame
      bevel30(ctx, 1, 1, 28, 28, '#1e293b', '#64748b', '#090d16', out);
      // Golden corner astrolabe brackets
      for (const [cx, cy] of [
        [2, 2],
        [22, 2],
        [2, 22],
        [22, 22],
      ]) {
        bevel30(ctx, cx, cy, 6, 6, '#eab308', '#fef08a', '#a16207', out);
      }
      // Outer golden gyro ring & inner radiant cyan core
      drawDisc30(ctx, 15, 15, 9.5, '#f59e0b', '#fef08a', '#92400e', out);
      drawDisc30(ctx, 15, 15, 6.5, '#0284c7', '#7dd3fc', '#0c4a6e', out);
      drawDisc30(ctx, 15, 15, 3.2, '#e0f2fe', '#ffffff', '#38bdf8', '#0284c7');
      return true;
    }

    case 154: {
      // Landlord NPC — Aristocratic magistrate in royal top hat, gold monocle & velvet coat filling full 30x30 frame
      bevel30(ctx, 0, 0, 30, 30, '#1e3a8a', '#60a5fa', '#172554', out);
      // Royal top hat with gold band
      bevel30(ctx, 7, 1, 16, 8, '#0f172a', '#475569', '#020617', out);
      rect(ctx, 8, 7, 14, 1, '#facc15');
      bevel30(ctx, 4, 8, 22, 3, '#0f172a', '#475569', '#020617', out);
      // Face & golden monocle
      bevel30(ctx, 7, 10, 16, 10, '#f1b98a', '#ffd7b3', '#b87a50', out);
      rect(ctx, 10, 13, 2, 2, '#0f172a');
      drawDisc30(ctx, 18, 14, 2.4, '#38bdf8', '#ffffff', '#0284c7', '#facc15');
      rect(ctx, 12, 17, 6, 1, '#78350f');
      // Royal coat & golden cravat grounded flush to bottom frame
      bevel30(ctx, 3, 19, 24, 11, '#1d4ed8', '#60a5fa', '#1e3a8a', out);
      rect(ctx, 13, 20, 4, 9, '#fef08a');
      return true;
    }

    case 155: {
      // World Blast — Bundled plasma demolition charges with digital countdown timer
      bevel30(ctx, 2, 2, 26, 26, '#1e293b', '#64748b', '#090d16', out);
      // Three vertical crimson dynamite/plasma cylinders
      for (const cx of [5, 12, 19]) {
        bevel30(ctx, cx, 4, 6, 22, '#dc2626', '#fca5a5', '#7f1d1d', out);
      }
      // Steel binding straps & central digital detonator display
      bevel30(ctx, 3, 11, 24, 8, '#334155', '#94a3b8', '#0f172a', out);
      bevel30(ctx, 9, 12, 12, 6, '#052e16', '#4ade80', '#022c22', out);
      rect(ctx, 11, 14, 8, 2, '#fef08a');
      return true;
    }

    case 156: {
      // Fresh Greens Vendor NPC — Botanist with woven sunhat, emerald ribbon & garden tunic filling full 30x30 frame
      bevel30(ctx, 0, 0, 30, 30, '#14532d', '#4ade80', '#052e16', out);
      // Woven straw sunhat with green band
      bevel30(ctx, 7, 1, 16, 6, '#eab308', '#fef08a', '#a16207', out);
      bevel30(ctx, 3, 6, 24, 4, '#facc15', '#fef9c3', '#ca8a04', out);
      rect(ctx, 7, 6, 16, 2, '#16a34a');
      // Friendly face
      bevel30(ctx, 7, 9, 16, 10, '#f1b98a', '#ffd7b3', '#b87a50', out);
      rect(ctx, 10, 12, 2, 2, '#0f172a');
      rect(ctx, 18, 12, 2, 2, '#0f172a');
      rect(ctx, 13, 16, 4, 1, '#9a3412');
      // Emerald garden apron grounded flush to bottom frame
      bevel30(ctx, 3, 18, 24, 12, '#16a34a', '#86efac', '#14532d', out);
      rect(ctx, 9, 19, 12, 10, '#dcfce7');
      return true;
    }

    case 157: {
      // Starter Supply Lootbox — Iron-bound oak treasure chest with glowing golden star clasp
      bevel30(ctx, 2, 4, 26, 23, '#b45309', '#f59e0b', '#78350f', out);
      drawWoodPlanks30(ctx, '#b45309', 157);
      // Gold reinforcement corner brackets & vertical straps
      for (const sx of [5, 21]) {
        bevel30(ctx, sx, 2, 4, 26, '#eab308', '#fef08a', '#a16207', out);
      }
      // Horizontal lid seam with glowing cyan-gold loot seam
      rect(ctx, 1, 12, 28, 3, out);
      rect(ctx, 2, 13, 26, 1, '#38bdf8');
      // Center golden shield clasp
      bevel30(ctx, 11, 10, 8, 8, '#facc15', '#ffffff', '#b45309', out);
      rect(ctx, 14, 13, 2, 3, '#0f172a');
      return true;
    }

    case 158: {
      // Pixobyte Digichange — Cryptographic digital Bytomerge terminal with cyan/violet stock waveform
      bevel30(ctx, 0, 0, 30, 30, '#0f172a', '#06b6d4', '#020617', out);
      bevel30(ctx, 2, 2, 26, 17, '#042f2e', '#22d3ee', '#020617', out);
      // Cryptic stock ticker waveform & Pixobyte node
      drawLine30(ctx, 5, 14, 10, 10, '#10b981', 1);
      drawLine30(ctx, 10, 10, 15, 13, '#06b6d4', 1);
      drawLine30(ctx, 15, 13, 23, 6, '#a855f7', 2);
      drawDisc30(ctx, 23, 6, 2.2, '#67e8f9', '#ffffff', '#0891b2', out);
      // Lower cryptic keypad & wallet reader deck
      bevel30(ctx, 3, 20, 24, 8, '#1e1b4b', '#818cf8', '#090d16', out);
      for (const kx of [6, 11, 16, 21]) {
        rect(ctx, kx, 22, 3, 2, '#22d3ee');
        rect(ctx, kx, 25, 3, 1, '#a855f7');
      }
      return true;
    }

    // =========================================================================
    // 4. MINING FUEL, FRAGMENTS, INGOTS, FISH, BAIT & CULINARY DISHES (200..232)
    // =========================================================================
    case 200: {
      // Coal Fuel — Anthracite coal chunks with glowing orange-gold ember fissures
      drawDiamond30(ctx, 12, 16, 7, 6, '#1e293b', '#64748b', '#090d16', out);
      drawDiamond30(ctx, 19, 17, 6, 5.5, '#334155', '#94a3b8', '#0f172a', out);
      drawDiamond30(ctx, 15, 11, 5.5, 5, '#1e293b', '#64748b', '#090d16', out);
      // Glowing ember veins
      for (const [ex, ey] of [
        [11, 15],
        [12, 16],
        [18, 17],
        [15, 11],
      ]) {
        px(ctx, ex, ey, '#f97316');
        px(ctx, ex + 1, ey, '#fef08a');
      }
      return true;
    }
    case 201:
    case 202:
    case 203:
    case 204:
      drawFragment30(ctx, p, s, a);
      return true;

    case 210:
    case 211:
    case 212:
    case 213:
      drawIngot30(ctx, p, s, a);
      return true;

    case 220:
      drawFish30(ctx, p, s, a, 'minnow');
      return true;
    case 221:
      drawFish30(ctx, p, s, a, 'carp');
      return true;
    case 222:
      drawFish30(ctx, p, s, a, 'trout');
      return true;
    case 223:
      drawFish30(ctx, p, s, a, 'slimefin');
      return true;

    case 224: {
      // Starter Earthworm Bait — Tackle tin of rich soil with wriggling pink earthworms
      bevel30(ctx, 4, 13, 22, 13, '#64748b', '#cbd5e1', '#334155', out);
      bevel30(ctx, 6, 11, 18, 6, '#451a03', '#78350f', '#270e02', out);
      // Segmented wriggling worms emerging from soil
      drawLine30(ctx, 9, 13, 12, 6, out, 4);
      drawLine30(ctx, 9, 13, 12, 6, '#f472b6', 2);
      drawLine30(ctx, 16, 13, 21, 7, out, 4);
      drawLine30(ctx, 16, 13, 21, 7, '#fb7185', 2);
      px(ctx, 12, 6, '#fbcfe8');
      px(ctx, 21, 7, '#fbcfe8');
      return true;
    }

    case 230: {
      // Glacier Fillet — Plated seared arctic trout fillet with lemon & frost sparkles
      bevel30(ctx, 2, 16, 26, 9, '#e2e8f0', '#ffffff', '#94a3b8', out);
      bevel30(ctx, 5, 10, 20, 9, '#38bdf8', '#bae6fd', '#0284c7', out);
      // Grill sear marks & salmon-pink glaze
      for (const gx of [8, 13, 18]) {
        drawLine30(ctx, gx, 11, gx + 2, 17, '#0c4a6e', 1);
      }
      // Lemon wedge & herb sprig
      drawDisc30(ctx, 21, 12, 2.5, '#facc15', '#fef9c3', '#ca8a04', out);
      rect(ctx, 7, 11, 3, 2, '#4ade80');
      return true;
    }

    case 231: {
      // Miner's Chowder — Cast-iron pot brimming with golden seafood & potato chowder
      bevel30(ctx, 3, 11, 24, 15, '#334155', '#64748b', '#0f172a', out);
      bevel30(ctx, 5, 9, 20, 6, '#f59e0b', '#fef08a', '#b45309', out);
      // Herbs & potato cubes floating in broth
      rect(ctx, 9, 11, 3, 2, '#fef9c3');
      rect(ctx, 16, 11, 3, 2, '#fde047');
      rect(ctx, 13, 10, 2, 2, '#22c55e');
      // Rising steam wisps
      px(ctx, 10, 5, '#ffffff');
      px(ctx, 15, 4, '#ffffff');
      px(ctx, 20, 6, '#ffffff');
      return true;
    }

    case 232: {
      // Abyssal Luck Broth — Ornate bowl of shimmering violet-emerald broth with golden egg
      bevel30(ctx, 3, 12, 24, 14, '#4c1d95', '#c084fc', '#2e1065', out);
      rect(ctx, 5, 18, 20, 2, '#facc15');
      bevel30(ctx, 5, 9, 20, 6, '#10b981', '#a7f3d0', '#047857', out);
      drawDisc30(ctx, 12, 11, 2.2, '#fef08a', '#ffffff', '#f59e0b', out);
      // Lucky star sparkles above bowl
      px(ctx, 9, 5, '#fde047');
      px(ctx, 15, 3, '#a7f3d0');
      px(ctx, 21, 5, '#f472b6');
      return true;
    }

    // =========================================================================
    // 5. WEARABLES (401..404)
    // =========================================================================
    case 401: {
      // Sunforged Monarch Crown — Five-spired imperial gold crown with rubies & sapphires
      bevel30(ctx, 3, 15, 24, 9, '#eab308', '#fef08a', '#a16207', out);
      // Five royal spires
      for (const [sx, sh] of [
        [4, 8],
        [9, 6],
        [13, 10],
        [18, 6],
        [22, 8],
      ]) {
        bevel30(ctx, sx, 16 - sh, 4, sh, '#facc15', '#ffffff', '#b45309', out);
        px(ctx, sx + 1, 15 - sh, '#fef08a');
      }
      // Crown jewels along circlet band
      rect(ctx, 6, 18, 3, 3, '#ef4444');
      rect(ctx, 13, 17, 4, 4, '#38bdf8');
      rect(ctx, 21, 18, 3, 3, '#ef4444');
      px(ctx, 14, 18, '#ffffff');
      return true;
    }

    case 402: {
      // Frontier Ranger Hat — Saddle-leather wide-brim outback hat with scarlet feather
      bevel30(ctx, 7, 7, 16, 11, '#92400e', '#d97706', '#451a03', out);
      // Hatband & gold buckle
      rect(ctx, 8, 15, 14, 2, '#451a03');
      rect(ctx, 13, 14, 4, 3, '#facc15');
      // Wide curved brim
      bevel30(ctx, 1, 17, 28, 5, '#78350f', '#b45309', '#270e02', out);
      // Scarlet plume feather on right
      drawLine30(ctx, 19, 14, 24, 6, '#dc2626', 3);
      drawLine30(ctx, 20, 13, 24, 6, '#fca5a5', 1);
      return true;
    }

    case 403: {
      // Crystal Sight Visor — Titanium cyber-visor with glowing cyan-magenta HUD lens
      bevel30(ctx, 2, 10, 26, 11, '#334155', '#94a3b8', '#0f172a', out);
      // Panoramic wrap-around neon lens
      bevel30(ctx, 4, 12, 22, 7, '#0284c7', '#67e8f9', '#0c4a6e', out);
      rect(ctx, 6, 13, 9, 2, '#e0f2fe');
      // Targeting reticle on right side of lens
      rect(ctx, 19, 14, 3, 3, '#f43f5e');
      px(ctx, 20, 15, '#ffffff');
      return true;
    }

    case 404: {
      // Aether Feather Wings — Luminous pair of feathered sky wings with gold shoulder mounts
      // Left wing (2..13, 4..25) & Right wing (17..28, 4..25)
      for (const side of [-1, 1] as const) {
        const cx = side === -1 ? 12 : 17;
        for (let row = 0; row < 4; row++) {
          const wy = 5 + row * 5;
          const ww = 10 - row * 1;
          const wx = side === -1 ? cx - ww : cx + 1;
          bevel30(
            ctx,
            wx,
            wy,
            ww,
            6,
            row % 2 === 0 ? '#e0f2fe' : '#bae6fd',
            '#ffffff',
            '#38bdf8',
            out
          );
        }
      }
      // Central golden harness crest
      bevel30(ctx, 12, 10, 6, 10, '#eab308', '#fef08a', '#a16207', out);
      px(ctx, 14, 13, '#38bdf8');
      px(ctx, 15, 13, '#38bdf8');
      return true;
    }

    case 405: {
      // Space Helmet (30-bit) — Pressurized white dome, cyan top beacon & comms ear-pods, slightly see-through visor
      // Outer dark ink silhouette dome
      rect(ctx, 6, 3, 18, 2, out);
      rect(ctx, 4, 5, 22, 19, out);
      rect(ctx, 6, 24, 18, 3, out);
      // White pearl dome shell shading
      rect(ctx, 7, 4, 16, 2, '#f8fafc');
      rect(ctx, 5, 6, 20, 17, '#e2e8f0');
      rect(ctx, 5, 6, 6, 15, '#ffffff');
      rect(ctx, 21, 7, 4, 15, '#94a3b8');
      rect(ctx, 7, 23, 16, 3, '#cbd5e1');
      rect(ctx, 8, 25, 14, 1, '#64748b');
      // Top glowing cyan beacon block
      bevel30(ctx, 11, 2, 8, 5, '#06b6d4', '#cffafe', '#0e7490', out);
      rect(ctx, 13, 3, 4, 2, '#67e8f9');
      // Left & Right side comms ear pods with glowing cyan vertical indicators
      bevel30(ctx, 1, 10, 5, 9, '#64748b', '#cbd5e1', '#334155', out);
      rect(ctx, 2, 12, 2, 5, '#22d3ee');
      px(ctx, 2, 12, '#cffafe');
      bevel30(ctx, 24, 10, 5, 9, '#64748b', '#cbd5e1', '#334155', out);
      rect(ctx, 26, 12, 2, 5, '#22d3ee');
      px(ctx, 26, 12, '#cffafe');
      // Visor bezel & slightly see-through tinted dark-navy viewport glass
      bevel30(ctx, 7, 8, 16, 14, '#334155', '#64748b', '#0f172a', out);
      rect(ctx, 8, 9, 14, 12, 'rgba(18, 32, 62, 0.72)');
      rect(ctx, 9, 10, 12, 10, 'rgba(30, 52, 92, 0.54)');
      // Subtle translucent visor inner tint gradient & crisp diagonal reflection streaks
      rect(ctx, 10, 11, 3, 1, '#ffffff');
      rect(ctx, 9, 12, 2, 2, '#e0f2fe');
      px(ctx, 12, 10, '#cffafe');
      px(ctx, 19, 19, '#38bdf8');
      return true;
    }

    case 406: {
      // Astro Suit (30-bit) — Pressurized torso cuirass with chest computer + linked gauntlet sleeves & EVA gloves
      // Linked left & right suit arm sleeves overlapping torso shoulder sockets
      for (const side of ['left', 'right'] as const) {
        const ax = side === 'left' ? 1 : 23;
        // Curved shoulder pauldron & segmented sleeve
        bevel30(ctx, ax, 6, 6, 13, '#e2e8f0', '#ffffff', '#94a3b8', out);
        rect(ctx, ax + 1, 11, 4, 1, '#64748b');
        // Glowing cyan wrist telemetry ring
        rect(ctx, ax, 17, 6, 3, out);
        rect(ctx, ax + 1, 18, 4, 1, '#22d3ee');
        // Dark charcoal EVA gloved hand
        bevel30(ctx, ax, 19, 6, 6, '#334155', '#64748b', '#1e293b', out);
      }
      // Central pressurized torso plate
      bevel30(ctx, 7, 3, 16, 23, '#e2e8f0', '#ffffff', '#94a3b8', out);
      // Raised circular neck seal collar + chin mic light
      bevel30(ctx, 9, 2, 12, 6, '#cbd5e1', '#ffffff', '#64748b', out);
      rect(ctx, 11, 3, 8, 3, '#1e293b');
      rect(ctx, 13, 6, 4, 2, '#06b6d4');
      px(ctx, 14, 6, '#cffafe');
      // Dark charcoal shoulder harness straps
      rect(ctx, 7, 5, 3, 6, '#334155');
      rect(ctx, 20, 5, 3, 6, '#334155');
      // Center chest life-support computer box
      bevel30(ctx, 10, 9, 10, 9, '#cbd5e1', '#ffffff', '#64748b', out);
      rect(ctx, 12, 11, 6, 2, '#22d3ee');
      rect(ctx, 12, 11, 3, 1, '#cffafe');
      rect(ctx, 12, 15, 2, 2, '#06b6d4');
      rect(ctx, 16, 15, 2, 2, '#06b6d4');
      // Lower utility waist belt & side pouches
      rect(ctx, 7, 19, 16, 5, '#334155');
      bevel30(ctx, 6, 19, 5, 6, '#475569', '#94a3b8', '#1e293b', out);
      bevel30(ctx, 19, 19, 5, 6, '#475569', '#94a3b8', '#1e293b', out);
      bevel30(ctx, 12, 20, 6, 4, '#64748b', '#cbd5e1', '#334155', out);
      px(ctx, 7, 23, '#22d3ee');
      px(ctx, 22, 23, '#22d3ee');
      return true;
    }

    case 407: {
      // Astro Pants (30-bit) — Utility belt waist, thigh plating, armored kneepads & cyan knee lights
      // Top utility belt waistband
      bevel30(ctx, 6, 2, 18, 5, '#334155', '#64748b', '#1e293b', out);
      bevel30(ctx, 12, 2, 6, 5, '#64748b', '#cbd5e1', '#334155', out);
      // Pelvic saddle & split trouser legs
      bevel30(ctx, 6, 6, 18, 8, '#e2e8f0', '#ffffff', '#94a3b8', out);
      rect(ctx, 14, 13, 2, 14, '#ffffff00');
      // Left leg
      bevel30(ctx, 6, 11, 8, 16, '#e2e8f0', '#ffffff', '#94a3b8', out);
      // Right leg
      bevel30(ctx, 16, 11, 8, 16, '#cbd5e1', '#f8fafc', '#64748b', out);
      // Clear inner crotch gap outline cleanly
      rect(ctx, 14, 14, 2, 13, 'rgba(0,0,0,0)');
      ctx.clearRect(14, 14, 2, 16);
      rect(ctx, 13, 13, 1, 14, out);
      rect(ctx, 16, 13, 1, 14, out);
      // Cyan hip pocket indicators
      rect(ctx, 7, 8, 2, 2, '#22d3ee');
      rect(ctx, 21, 8, 2, 2, '#22d3ee');
      // Rounded slate armored kneepads + cyan outer joint lights
      bevel30(ctx, 7, 15, 6, 6, '#94a3b8', '#e2e8f0', '#475569', out);
      bevel30(ctx, 17, 15, 6, 6, '#94a3b8', '#e2e8f0', '#475569', out);
      rect(ctx, 6, 17, 1, 2, '#22d3ee');
      rect(ctx, 23, 17, 1, 2, '#22d3ee');
      // Lower shin cuff rim
      rect(ctx, 7, 24, 6, 2, '#cbd5e1');
      rect(ctx, 17, 24, 6, 2, '#94a3b8');
      return true;
    }

    case 408: {
      // Astro Boots (30-bit) — Paired chunky lunar EVA boots with ankle collars & cyan thruster soles
      for (const [bx, dir] of [
        [2, -1],
        [15, 1],
      ] as const) {
        // Cushioned ankle cuff collar
        bevel30(ctx, bx + 2, 8, 9, 5, '#e2e8f0', '#ffffff', '#94a3b8', out);
        // Boot shin & stepped toe box
        bevel30(ctx, bx + 1, 12, 11, 10, '#cbd5e1', '#f8fafc', '#64748b', out);
        if (dir === -1) {
          bevel30(ctx, bx, 17, 12, 6, '#e2e8f0', '#ffffff', '#94a3b8', out);
        } else {
          bevel30(ctx, bx + 1, 17, 12, 6, '#e2e8f0', '#ffffff', '#94a3b8', out);
        }
        // Dark charcoal heavy sole + glowing cyan mag-thruster sole strip
        rect(ctx, bx, 22, 13, 5, out);
        rect(ctx, bx + 1, 23, 11, 1, '#334155');
        rect(ctx, bx + 1, 24, 11, 2, '#06b6d4');
        rect(ctx, bx + 3, 24, 7, 1, '#cffafe');
      }
      return true;
    }

    case 409: {
      // Lifesup Backpack (30-bit) — Twin top curved air hoses, glowing cyan core console & side thruster pods
      // Curved upper twin oxygen conduit pipes
      bevel30(ctx, 4, 2, 8, 7, '#cbd5e1', '#ffffff', '#64748b', out);
      bevel30(ctx, 18, 2, 8, 7, '#cbd5e1', '#ffffff', '#64748b', out);
      // Left & right side pressurized canister pods with glowing cyan status lights
      bevel30(ctx, 2, 11, 6, 13, '#cbd5e1', '#f8fafc', '#64748b', out);
      rect(ctx, 3, 15, 3, 5, '#22d3ee');
      px(ctx, 4, 16, '#cffafe');
      bevel30(ctx, 22, 11, 6, 13, '#cbd5e1', '#f8fafc', '#64748b', out);
      rect(ctx, 24, 15, 3, 5, '#22d3ee');
      px(ctx, 25, 16, '#cffafe');
      // Main central PLSS backpack housing
      bevel30(ctx, 6, 6, 18, 19, '#e2e8f0', '#ffffff', '#94a3b8', out);
      rect(ctx, 9, 6, 12, 2, '#94a3b8');
      // Central glowing cyan telemetry screen & horizontal cooling louvers
      bevel30(ctx, 10, 10, 10, 5, '#334155', '#64748b', '#0f172a', out);
      rect(ctx, 11, 11, 8, 3, '#22d3ee');
      rect(ctx, 12, 11, 4, 1, '#cffafe');
      rect(ctx, 11, 17, 8, 1, '#64748b');
      rect(ctx, 11, 19, 8, 1, '#64748b');
      // Bottom dual dark exhaust thrusters
      bevel30(ctx, 7, 24, 6, 4, '#334155', '#64748b', '#0f172a', out);
      bevel30(ctx, 17, 24, 6, 4, '#334155', '#64748b', '#0f172a', out);
      return true;
    }

    case 410: {
      const imgAsset = getDragonBoneWingsImage();
      if (imgAsset && imgAsset.complete && imgAsset.naturalWidth > 0) {
        const c = DRAGON_BONE_WINGS_IMG_CROP.full;
        ctx.drawImage(imgAsset, c.sx, c.sy, c.sw, c.sh, 1, 7, 28, 15);
        return true;
      }

      // Dragon Bone Wings (30-bit procedural fallback) — Paired skeletal drake wings
      const palette: Record<string, string> = {
        K: '#151b26', // Crisp dark pixel outline
        H: '#fff7ea', // Cream bone specular highlight
        B: '#f3dec0', // Ivory bone midtone
        S: '#d4b089', // Warm tan bone shadow
        C: '#a37b56', // Deep socket/joint crevice
        '1': '#4a3c3c', // Deep smoky umber webbing shadow
        '2': '#70584e', // Mid smoky taupe webbing
        '3': '#9c7e6a', // Light dusty taupe webbing
        '4': '#c3a488', // Pale tattered webbing rim
      };
      const leftWingRows = [
        '.......KKKK...', // y=2:  shoulder ball socket top
        '......KHHBBK..', // y=3:  shoulder ball cream/ivory
        '.....KKHBBSK..', // y=4:  shoulder ball + upper wing arm
        '....KHHBBSBK..', // y=5:  upper arch + inner spur joint
        '...KHHBSCCBK..', // y=6:  joint crevice + splayed phalanges
        '..KHHB1KHBBSK.', // y=7:  outer bay 1 + mid bones + inner spur
        '.KHHBS1KBB1KBK', // y=8:  elbow crest + webbing bays
        '.KBBC22KB1KBBK', // y=9:  wrist crease + scalloped membrane depth
        '.KHB22KHB12KBK', // y=10: sweeping outer bone + central phalanges
        'KKB23KBS2KB1KK', // y=11: upper wing span
        'KHB34KBS2KB1BK', // y=12: tattered bay 1 + inner spur bone cap
        'KHB4KKBS3KB2BK', // y=13: bay 1 rim + bay 2/3 mid webbing
        'KBSK.KBS4KBKKK', // y=14: bay 1 finished + inner spur tip cap
        'KBSK.KB34KBK..', // y=15: bay 2 pale lower fringe
        'KBK..KB4KHBK..', // y=16: bay 2 concave edge closing
        'KBK.KHHKKHHK..', // y=17: protruding lower knuckle spheres
        'KBK.KHBKKHBK..', // y=18: bulbous knuckle joints
        'KBK.KBSKKBSK..', // y=19: outer claw & knuckle undersides
        '.KK.KHBKKHBK..', // y=20: outer wingtip + twin downward claws
        '.K..KBSKKBSK..', // y=21: outer tip + inner-mid claw tapering
        '....KBSKKBSK..', // y=22: outer-mid & inner-mid claw shafts
        '....KBSK.KK...', // y=23: inner-mid claw tip closed
        '....KBSK......', // y=24: longest outer-mid claw shaft
        '.....KK.......', // y=25: outer-mid claw tip
      ];
      for (let ry = 0; ry < leftWingRows.length; ry++) {
        const row = leftWingRows[ry];
        const y = 2 + ry;
        for (let lx = 0; lx < row.length; lx++) {
          const ch = row[lx];
          if (ch === '.') continue;
          const color = palette[ch];
          if (!color) continue;
          // Left wing (x = 0..13)
          px(ctx, lx, y, color);
          // Mirrored right wing (x = 16..29), keeping crisp top-left bone lighting on specular pixels
          const mirrorColor =
            ch === 'H' && lx >= 8 ? '#f3dec0' : ch === 'S' && lx <= 4 ? '#f3dec0' : color;
          px(ctx, 29 - lx, y, mirrorColor);
        }
      }
      return true;
    }

    // =========================================================================
    // 6. GROWPIXEL CLASSIC TERRAIN, ARCHITECTURE, FLORA & PROPS (500..541)
    // =========================================================================
    case 500: {
      // Dirt — Rich loamy earth with pebbles & root flecks
      drawStoneMatrix30(ctx, '#8b5a2b', '#5c3a21', '#c68b59', 500, 'granular');
      return true;
    }
    case 501: {
      // Rock — Fractured crag stone with quartz flecks
      drawStoneMatrix30(ctx, '#64748b', '#334155', '#cbd5e1', 501, 'cobble');
      return true;
    }
    case 502: {
      // Lava — Incandescent magma currents with dark cooling crust islands
      bevel30(ctx, 0, 0, 30, 30, '#ea580c', '#fde047', '#9a3412', '#451a03');
      for (let y = 2; y < 28; y++) {
        for (let x = 2; x < 28; x++) {
          const v = Math.sin(x * 0.38 + y * 0.25) + Math.cos(y * 0.42 - x * 0.3);
          if (v > 1.05) px(ctx, x, y, '#fef08a');
          else if (v > 0.35) px(ctx, x, y, '#f97316');
          else if (v < -0.75) px(ctx, x, y, '#451a03');
          else px(ctx, x, y, '#dc2626');
        }
      }
      return true;
    }
    case 503: {
      // Cave Background — Recessed dark subterranean masonry
      drawBricks30(ctx, '#334155', '#0f172a', 503, { recessed: true, rows: 5 });
      return true;
    }
    case 504: {
      // Sand — Wind-rippled golden silica dunes
      drawStoneMatrix30(ctx, '#eab308', '#ca8a04', '#fef08a', 504, 'strata');
      return true;
    }
    case 505: {
      // Door — Arched oak-and-iron portal door with viewing grille & brass ring
      bevel30(ctx, 3, 1, 24, 28, '#78350f', '#d97706', '#451a03', out);
      drawWoodPlanks30(ctx, '#92400e', 505, { vertical: true });
      // Iron barred window grille in upper door
      bevel30(ctx, 8, 5, 14, 9, '#0f172a', '#64748b', '#020617', out);
      for (const gx of [11, 15, 18]) {
        rect(ctx, gx, 6, 1, 7, '#94a3b8');
      }
      // Golden doorknob on right
      drawDisc30(ctx, 21, 18, 2.0, '#facc15', '#ffffff', '#b45309', out);
      return true;
    }
    case 506:
    case 527: {
      // Glass Pane (506) & Glass Block (527) — Crystalline framed window with sky reflections
      const rim = itemId === 506 ? '#38bdf8' : '#7dd3fc';
      bevel30(ctx, 0, 0, 30, 30, '#0284c7', '#e0f2fe', '#0369a1', out);
      rect(ctx, 3, 3, 24, 24, '#0c4a6e');
      if (itemId === 506) {
        // Cross mullions
        rect(ctx, 14, 2, 2, 26, rim);
        rect(ctx, 2, 14, 26, 2, rim);
      }
      // Crisp diagonal specular reflection streaks
      drawLine30(ctx, 5, 11, 11, 5, '#ffffff', 2);
      drawLine30(ctx, 17, 23, 23, 17, '#bae6fd', 2);
      return true;
    }
    case 507: {
      // Grass — Lush emerald turf canopy overhanging rich loamy soil
      drawStoneMatrix30(ctx, '#8b5a2b', '#5c3a21', '#c68b59', 507, 'granular');
      rect(ctx, 1, 1, 28, 8, '#16a34a');
      rect(ctx, 1, 1, 28, 3, '#4ade80');
      rect(ctx, 2, 1, 12, 1, '#86efac');
      // Overhanging grass blades along y=8..12
      for (let x = 1; x < 29; x += 2) {
        const drop = 2 + ((x * 7) % 4);
        rect(ctx, x, 8, 2, drop, x % 4 === 1 ? '#22c55e' : '#15803d');
        rect(ctx, x, 8 + drop, 2, 1, '#14532d');
      }
      return true;
    }
    case 508: {
      // Lava Rock — Charred basalt scoria with glowing magma fissures
      drawStoneMatrix30(ctx, '#27272a', '#09090b', '#52525b', 508, 'cobble');
      drawLine30(ctx, 5, 7, 16, 15, '#ea580c', 2);
      drawLine30(ctx, 16, 15, 24, 10, '#f97316', 2);
      drawLine30(ctx, 13, 15, 10, 24, '#facc15', 1);
      px(ctx, 16, 15, '#fef08a');
      return true;
    }
    case 509: {
      // Sign — Framed wooden noticeboard on post with inscribed lines
      bevel30(ctx, 13, 17, 4, 12, '#78350f', '#b45309', '#451a03', out);
      bevel30(ctx, 2, 4, 26, 15, '#b45309', '#fbbf24', '#78350f', out);
      bevel30(ctx, 4, 6, 22, 11, '#fde68a', '#fef9c3', '#d97706', out);
      rect(ctx, 7, 9, 16, 1, '#78350f');
      rect(ctx, 7, 12, 12, 1, '#78350f');
      rect(ctx, 7, 14, 14, 1, '#92400e');
      return true;
    }
    case 510: {
      // Wood Block — Planed oak timber planks
      drawWoodPlanks30(ctx, '#b45309', 510);
      return true;
    }
    case 511: {
      // Bricks — Classic masonry brickwork
      drawBricks30(ctx, '#94a3b8', '#334155', 511, { rows: 5, cracked: true });
      return true;
    }
    case 512: {
      // Crappy Sign — Crooked driftwood sign nailed askew
      bevel30(ctx, 13, 16, 4, 13, '#5c3a21', '#8b5a2b', '#271509', out);
      bevel30(ctx, 3, 6, 24, 11, '#8b5a2b', '#c68b59', '#451a03', out);
      drawLine30(ctx, 6, 10, 22, 12, '#271509', 1);
      drawLine30(ctx, 7, 13, 19, 14, '#271509', 1);
      px(ctx, 5, 8, '#94a3b8');
      px(ctx, 24, 14, '#94a3b8');
      return true;
    }
    case 513:
    case 515:
    case 536: {
      // Daisy (513), Rose (515), Poppy (536) — Botanical flower clusters with stems & leaves
      const petalCol = itemId === 513 ? '#f8fafc' : itemId === 515 ? '#e11d48' : '#ef4444';
      const petalSh = itemId === 513 ? '#cbd5e1' : itemId === 515 ? '#881337' : '#991b1b';
      const eyeCol = itemId === 513 ? '#facc15' : itemId === 515 ? '#fecdd3' : '#1e293b';
      // Leafy stems
      drawLine30(ctx, 15, 28, 15, 12, '#15803d', 3);
      drawLine30(ctx, 15, 24, 9, 17, '#16a34a', 2);
      drawLine30(ctx, 15, 22, 21, 16, '#22c55e', 2);
      // Main blossom head
      for (const [px0, py0] of [
        [15, 7],
        [15, 15],
        [11, 11],
        [19, 11],
        [12, 8],
        [18, 8],
        [12, 14],
        [18, 14],
      ]) {
        drawDisc30(ctx, px0, py0, 2.6, petalCol, '#ffffff', petalSh, out);
      }
      drawDisc30(ctx, 15, 11, 2.5, eyeCol, '#ffffff', petalSh, out);
      return true;
    }
    case 514: {
      // Mushroom — Spotted red Amanita toadstool with cream stalk & mossy turf
      rect(ctx, 5, 25, 20, 4, '#15803d');
      bevel30(ctx, 11, 14, 8, 12, '#fef3c7', '#ffffff', '#d97706', out);
      // Rounded spotted cap
      bevel30(ctx, 4, 6, 22, 10, '#dc2626', '#fca5a5', '#7f1d1d', out);
      for (const [sx, sy] of [
        [8, 9],
        [14, 8],
        [20, 10],
        [11, 12],
      ]) {
        rect(ctx, sx, sy, 3, 2, '#ffffff');
      }
      return true;
    }
    case 516: {
      // Wheat — Golden bearded wheat stalks heavy with grain
      for (const sx of [6, 12, 18, 23]) {
        drawLine30(ctx, sx, 28, sx, 6, '#ca8a04', 2);
        bevel30(ctx, sx - 2, 4, 5, 11, '#eab308', '#fef08a', '#a16207', out);
        px(ctx, sx, 2, '#fef08a');
      }
      // Red harvest ribbon tying sheaf together
      bevel30(ctx, 5, 20, 20, 4, '#dc2626', '#fca5a5', '#7f1d1d', out);
      return true;
    }
    case 517: {
      // Wooden Platform — Timber scaffold deck with knee braces
      bevel30(ctx, 0, 0, 30, 8, '#b45309', '#fbbf24', '#78350f', out);
      for (const pxCol of [6, 12, 18, 24]) {
        rect(ctx, pxCol, 1, 1, 6, '#451a03');
      }
      drawLine30(ctx, 3, 8, 9, 17, out, 4);
      drawLine30(ctx, 3, 8, 9, 17, '#92400e', 2);
      drawLine30(ctx, 26, 8, 20, 17, out, 4);
      drawLine30(ctx, 26, 8, 20, 17, '#92400e', 2);
      return true;
    }
    case 518:
    case 519:
    case 520:
    case 521:
    case 522:
    case 523:
    case 524:
    case 526:
    case 534:
    case 535: {
      // Painted Architectural Color Blocks — High-gloss enameled bevel tiles with inner facet & rivets
      const ramp = deriveColorRamp(p);
      bevel30(ctx, 0, 0, 30, 30, ramp.base, ramp.highlight, ramp.shadow, ramp.outline);
      bevel30(ctx, 4, 4, 22, 22, ramp.base, shadeHex(ramp.highlight, 0.12), ramp.shadow, ramp.shadow);
      // Glossy diagonal specular sheen
      drawLine30(ctx, 7, 13, 13, 7, shadeHex(ramp.highlight, 0.25), 2);
      for (const [rx, ry] of [
        [2, 2],
        [26, 2],
        [2, 26],
        [26, 26],
      ]) {
        rect(ctx, rx, ry, 2, 2, ramp.highlight);
      }
      return true;
    }
    case 525: {
      // Window — Four-pane wooden casement window with sill box
      bevel30(ctx, 1, 1, 28, 28, '#92400e', '#f59e0b', '#451a03', out);
      bevel30(ctx, 4, 4, 22, 20, '#0284c7', '#bae6fd', '#0c4a6e', out);
      // Wooden muntin crossbars
      rect(ctx, 14, 4, 2, 20, '#92400e');
      rect(ctx, 4, 13, 22, 2, '#92400e');
      // Reflections & bottom sill ledge
      drawLine30(ctx, 6, 10, 10, 6, '#ffffff', 1);
      drawLine30(ctx, 18, 20, 22, 16, '#ffffff', 1);
      bevel30(ctx, 0, 24, 30, 5, '#b45309', '#fde68a', '#78350f', out);
      return true;
    }
    case 528: {
      // Toilet — Porcelain cistern tank, hinged seat & pedestal bowl
      bevel30(ctx, 6, 2, 14, 11, '#f8fafc', '#ffffff', '#cbd5e1', out);
      rect(ctx, 18, 5, 3, 2, '#facc15'); // Flush handle
      bevel30(ctx, 5, 13, 19, 5, '#e2e8f0', '#ffffff', '#94a3b8', out);
      bevel30(ctx, 7, 18, 15, 6, '#f8fafc', '#ffffff', '#cbd5e1', out);
      bevel30(ctx, 9, 23, 11, 6, '#cbd5e1', '#f8fafc', '#64748b', out);
      return true;
    }
    case 529: {
      // Red Bricks — Kiln-fired crimson terracotta masonry
      drawBricks30(ctx, '#dc2626', '#450a0a', 529, { rows: 5 });
      return true;
    }
    case 530: {
      // Death Spikes — Serrated steel floor spikes on hazard baseplate
      bevel30(ctx, 1, 23, 28, 6, '#334155', '#94a3b8', '#0f172a', out);
      for (const sx of [5, 12, 19, 25]) {
        drawDiamond30(ctx, sx, 15, 3.2, 8.5, '#cbd5e1', '#ffffff', '#475569', out);
        px(ctx, sx, 7, '#ef4444');
      }
      return true;
    }
    case 531: {
      // Dungeon Door — Heavy gothic iron-barred portcullis with stone arch
      bevel30(ctx, 1, 1, 28, 28, '#334155', '#94a3b8', '#0f172a', out);
      rect(ctx, 5, 5, 20, 23, '#090d16');
      for (const gx of [8, 12, 16, 20]) {
        rect(ctx, gx, 5, 2, 23, '#64748b');
        px(ctx, gx, 6, '#cbd5e1');
      }
      for (const gy of [10, 17, 23]) {
        rect(ctx, 5, gy, 20, 2, '#475569');
      }
      return true;
    }
    case 532: {
      // Bush — Rounded woodland foliage shrub
      drawDisc30(ctx, 10, 18, 7, '#16a34a', '#4ade80', '#14532d', out);
      drawDisc30(ctx, 20, 18, 7, '#15803d', '#4ade80', '#052e16', out);
      drawDisc30(ctx, 15, 12, 8, '#22c55e', '#86efac', '#15803d', out);
      return true;
    }
    case 533: {
      // Hedge — Manicured boxwood topiary block with dense leaf texture
      drawStoneMatrix30(ctx, '#16a34a', '#14532d', '#4ade80', 533, 'granular');
      return true;
    }
    case 537: {
      // Wooden Background — Recessed tongue-and-groove timber wall
      drawWoodPlanks30(ctx, '#78350f', 537, { recessed: true, vertical: true });
      return true;
    }
    case 538: {
      // Rock Background — Recessed fieldstone wall
      drawStoneMatrix30(ctx, '#475569', '#1e293b', '#64748b', 538, 'cobble');
      return true;
    }
    case 539: {
      // Pointy Sign — Arrow signpost pointing right
      bevel30(ctx, 12, 16, 4, 13, '#78350f', '#b45309', '#451a03', out);
      bevel30(ctx, 2, 7, 21, 10, '#d97706', '#fde68a', '#78350f', out);
      drawDiamond30(ctx, 22, 12, 5, 5, '#d97706', '#fde68a', '#78350f', out);
      rect(ctx, 6, 11, 14, 2, '#451a03');
      return true;
    }
    case 540: {
      // Danger Sign — Yellow & black hazard sign with exclamation emblem
      bevel30(ctx, 13, 19, 4, 10, '#475569', '#94a3b8', '#1e293b', out);
      drawDiamond30(ctx, 15, 11, 10, 9, '#facc15', '#fef9c3', '#ca8a04', out);
      rect(ctx, 14, 7, 2, 5, '#0f172a');
      rect(ctx, 14, 14, 2, 2, '#0f172a');
      return true;
    }
    case 541: {
      // Blueberry — Fruiting shrub laden with plump indigo-blue berries
      drawDisc30(ctx, 15, 15, 11, '#15803d', '#4ade80', '#052e16', out);
      for (const [bx, by] of [
        [10, 11],
        [18, 10],
        [14, 15],
        [9, 18],
        [20, 17],
        [15, 21],
      ]) {
        drawDisc30(ctx, bx, by, 2.4, '#3b82f6', '#93c5fd', '#1d4ed8', out);
      }
      return true;
    }

    // =========================================================================
    // 7. AGRICULTURAL OVERHAUL: SEED POT, MATTERAGEN ENGINES, ATM, VAULT, SOIL (550..558)
    // =========================================================================
    case 550: {
      // Seed Pot / Growbox — Glazed terracotta & brass planter box with rich soil
      bevel30(ctx, 2, 8, 26, 7, '#c2410c', '#fb923c', '#7c2d12', out);
      bevel30(ctx, 4, 14, 22, 14, '#9a3412', '#ea580c', '#431407', out);
      // Rich dark soil bed & sprouting seedling
      rect(ctx, 4, 6, 22, 3, '#451a03');
      drawDisc30(ctx, 13, 5, 2.2, '#22c55e', '#86efac', '#15803d', out);
      drawDisc30(ctx, 17, 5, 2.2, '#22c55e', '#86efac', '#15803d', out);
      // Brass moisture badge on front
      bevel30(ctx, 12, 18, 6, 6, '#eab308', '#fef08a', '#a16207', out);
      px(ctx, 14, 20, '#38bdf8');
      px(ctx, 15, 20, '#38bdf8');
      return true;
    }

    case 551:
    case 552:
    case 553:
    case 554:
    case 555: {
      // Tier I-V Matteragen Synthesis Engines
      bevel30(ctx, 1, 1, 28, 28, s, p, shadeHex(s, -0.35), out);
      // Top & bottom brass/titanium manifold caps
      bevel30(ctx, 3, 2, 24, 5, '#334155', '#94a3b8', '#0f172a', out);
      bevel30(ctx, 3, 23, 24, 5, '#334155', '#94a3b8', '#0f172a', out);
      // Central illuminated containment chamber
      bevel30(ctx, 5, 7, 20, 16, '#090d16', a, '#020617', out);
      drawDisc30(ctx, 15, 15, 6.2, p, a, s, out);
      drawDiamond30(ctx, 15, 15, 3.8, 3.8, a, '#ffffff', p, out);
      return true;
    }

    case 556: {
      // ATM Machine — Gem-converting banking kiosk with emerald screen & bill slot
      bevel30(ctx, 2, 1, 26, 28, '#1e293b', '#94a3b8', '#0f172a', out);
      bevel30(ctx, 4, 3, 22, 5, '#eab308', '#fef08a', '#a16207', out);
      bevel30(ctx, 5, 9, 20, 10, '#064e3b', '#34d399', '#022c22', out);
      drawDiamond30(ctx, 15, 14, 3.5, 3.5, '#38bdf8', '#ffffff', '#0284c7', out);
      bevel30(ctx, 5, 20, 20, 7, '#334155', '#cbd5e1', '#0f172a', out);
      rect(ctx, 8, 22, 8, 2, '#10b981');
      rect(ctx, 19, 22, 3, 3, '#facc15');
      return true;
    }

    case 557: {
      // Vaultbox — Titanium-and-gold bank safe with 4-spoke combination wheel
      bevel30(ctx, 1, 1, 28, 28, '#334155', '#94a3b8', '#0f172a', out);
      bevel30(ctx, 4, 4, 22, 22, '#475569', '#cbd5e1', '#1e293b', out);
      // Heavy hinges on right
      rect(ctx, 25, 6, 3, 5, '#eab308');
      rect(ctx, 25, 19, 3, 5, '#eab308');
      // Golden combination wheel in center
      drawDisc30(ctx, 14, 15, 6.5, '#eab308', '#fef08a', '#a16207', out);
      drawDisc30(ctx, 14, 15, 2.5, '#f8fafc', '#ffffff', '#64748b', out);
      return true;
    }

    case 558: {
      // Plowed Dirt Soil — Deeply furrowed agricultural topsoil ridges
      drawStoneMatrix30(ctx, '#5c3a21', '#3b2313', '#8b5a2b', 558, 'granular');
      // Furrowed top ridges
      for (let x = 1; x < 29; x += 6) {
        bevel30(ctx, x, 1, 5, 6, '#8b5a2b', '#c68b59', '#3b2313', out);
      }
      for (const ry of [10, 16, 22]) {
        rect(ctx, 2, ry, 26, 2, '#3b2313');
        rect(ctx, 2, ry + 2, 26, 1, '#8b5a2b');
      }
      return true;
    }

    // =========================================================================
    // 8. BUILDERS MIX PLATFORMS (600..609) & BIOME BLOCKS (700..748)
    // =========================================================================
    case 600:
    case 601:
    case 602:
    case 603:
    case 604:
    case 605:
    case 606:
    case 607:
    case 608:
    case 609: {
      bevel30(ctx, 0, 0, 30, 9, p, a, s, out);
      drawLine30(ctx, 3, 9, 9, 17, s, 3);
      drawLine30(ctx, 26, 9, 20, 17, s, 3);
      return true;
    }

    case 700:
    case 703:
    case 707:
    case 720:
    case 721:
    case 724:
    case 742:
    case 747: {
      // Granular biome soils, sands, gravels, snows & clays
      drawStoneMatrix30(ctx, p, s, a, itemId, 'granular');
      return true;
    }

    case 701:
    case 702:
    case 723:
    case 740:
    case 741: {
      // Stratified sedimentary biome rocks (Red Sandstone, Hardpan, Permafrost, Limestone, Shale)
      drawStoneMatrix30(ctx, p, s, a, itemId, 'strata');
      return true;
    }

    case 722:
    case 725: {
      // Glacier Ice & Blue Ice — Translucent crystalline ice with diagonal refraction bands
      drawStoneMatrix30(ctx, p, s, a, itemId, 'crystalline');
      drawLine30(ctx, 5, 14, 14, 5, '#ffffff', 2);
      drawLine30(ctx, 14, 24, 24, 14, '#e0f2fe', 2);
      return true;
    }

    case 726:
    case 743:
    case 748: {
      // Frost Rock, Granite & Rugged Cave Wall
      drawStoneMatrix30(ctx, p, s, a, itemId, 'cobble');
      return true;
    }

    case 704: {
      // Dune Grass — Wind-swept golden-olive desert grass blades with sandy base tuft
      bevel30(ctx, 4, 25, 22, 4, s, p, shadeHex(s, -0.25), out);
      for (const [gx, gh] of [
        [5, 16],
        [9, 21],
        [14, 24],
        [19, 20],
        [24, 15],
      ]) {
        drawLine30(ctx, gx, 27, gx + 2, 28 - gh, out, 3);
        drawLine30(ctx, gx, 27, gx + 2, 28 - gh, p, 1);
        px(ctx, gx + 2, 28 - gh, a);
        px(ctx, gx, 26, s);
      }
      return true;
    }

    case 705: {
      // Desert Cactus — Ribbed saguaro cactus with twin arms & pink blossom
      bevel30(ctx, 10, 4, 10, 25, p, a, s, out);
      bevel30(ctx, 3, 11, 8, 6, p, a, s, out);
      bevel30(ctx, 3, 6, 5, 7, p, a, s, out);
      bevel30(ctx, 19, 13, 8, 6, p, a, s, out);
      bevel30(ctx, 22, 8, 5, 7, p, a, s, out);
      drawDisc30(ctx, 15, 3, 2.2, '#f43f5e', '#fecdd3', '#be123c', out);
      return true;
    }

    case 706: {
      // Dry Root — Gnarled sun-bleached desert root tangle
      drawLine30(ctx, 15, 2, 14, 27, out, 5);
      drawLine30(ctx, 15, 2, 14, 27, p, 3);
      drawLine30(ctx, 14, 12, 5, 22, out, 4);
      drawLine30(ctx, 14, 12, 5, 22, s, 2);
      drawLine30(ctx, 15, 15, 24, 24, out, 4);
      drawLine30(ctx, 15, 15, 24, 24, a, 2);
      return true;
    }

    case 727:
    case 744: {
      // Icicle (727) & Stalactite (744) — Hanging mineral/ice spears from ceiling
      bevel30(ctx, 1, 0, 28, 6, s, p, shadeHex(s, -0.25), out);
      drawDiamond30(ctx, 8, 12, 3.5, 9, p, a, s, out);
      drawDiamond30(ctx, 15, 16, 4.5, 12, p, a, s, out);
      drawDiamond30(ctx, 22, 11, 3.5, 8, p, a, s, out);
      return true;
    }

    case 745: {
      // Stalagmite — Rising mineral spears from cavern floor
      bevel30(ctx, 1, 24, 28, 6, s, p, shadeHex(s, -0.25), out);
      drawDiamond30(ctx, 8, 18, 3.5, 8, p, a, s, out);
      drawDiamond30(ctx, 15, 14, 4.5, 12, p, a, s, out);
      drawDiamond30(ctx, 22, 19, 3.5, 7, p, a, s, out);
      return true;
    }

    case 746: {
      // Crystal Ore — Deep cavern rock studded with glowing amethyst-cyan crystals
      drawOreVeinTile30(ctx, p, s, a, '#334155', 746);
      return true;
    }

    // =========================================================================
    // 9. MINE SHAFT VEINS (790..793), STATION KEYS (810..814), RAW ORES (830..841)
    // =========================================================================
    case 790:
    case 791:
    case 792:
    case 793: {
      drawOreVeinTile30(ctx, p, s, a, s, itemId);
      return true;
    }

    case 810:
    case 811:
    case 812:
    case 813:
    case 814: {
      // Station Gate Keys I..V — Ornate security cipher keys with rank gemstones
      const rank = itemId - 810; // 0..4
      // Key bow (handle ring) at left (7, 15)
      drawDisc30(ctx, 8, 15, 6.2, p, a, s, out);
      drawDisc30(ctx, 8, 15, 2.2, '#0f172a', a, '#0f172a', '#ffffff');
      // Key blade shaft extending right to x=27
      bevel30(ctx, 13, 13, 15, 5, p, a, s, out);
      // Key teeth notches dropping below shaft
      bevel30(ctx, 19, 17, 3, 6, p, a, s, out);
      bevel30(ctx, 24, 17, 3, 5 + (rank % 2), p, a, s, out);
      // Rank pips along top
      for (let r = 0; r <= rank; r++) {
        rect(ctx, 14 + r * 3, 9, 2, 2, '#fef08a');
      }
      return true;
    }

    case 830:
    case 831:
    case 832:
    case 833:
    case 834:
    case 835:
    case 836:
    case 837:
    case 838:
    case 839:
    case 840:
    case 841: {
      drawRawOreChunk30(ctx, def!, itemId - 830);
      return true;
    }

    // =========================================================================
    // 10. FRESH GREENS VENDOR SEEDS (1000..1005), CROP BLOCKS (1010..1015), CROPS (1020..1025)
    // =========================================================================
    case 1000:
    case 1001:
    case 1002:
    case 1003:
    case 1004:
    case 1005: {
      // Botanical Seed Packets with color-coded crop emblem & sprouting leaf
      bevel30(ctx, 5, 3, 20, 24, '#fef3c7', '#ffffff', '#d97706', out);
      bevel30(ctx, 7, 5, 16, 5, p, a, s, out);
      drawDisc30(ctx, 15, 16, 4.8, p, a, s, out);
      drawDisc30(ctx, 15, 11, 2.2, '#22c55e', '#86efac', '#15803d', out);
      return true;
    }

    case 1010:
    case 1011:
    case 1012:
    case 1013:
    case 1014:
    case 1015: {
      // Planted Garden Crop Blocks — Furrowed soil bed at bottom + lush fruiting foliage
      bevel30(ctx, 1, 21, 28, 8, '#5c3a21', '#8b5a2b', '#3b2313', out);
      // Leafy canopy
      drawDisc30(ctx, 10, 14, 6, '#16a34a', '#4ade80', '#14532d', out);
      drawDisc30(ctx, 20, 14, 6, '#15803d', '#4ade80', '#052e16', out);
      drawDisc30(ctx, 15, 11, 6.5, '#22c55e', '#86efac', '#15803d', out);
      // Ripe produce fruits nestled in canopy
      drawDisc30(ctx, 11, 16, 3.2, p, a, s, out);
      drawDisc30(ctx, 19, 15, 3.2, p, a, s, out);
      drawDisc30(ctx, 15, 12, 3.0, p, a, s, out);
      return true;
    }

    case 1020: {
      // Crisp Radish — Plump crimson-magenta root bulb with white tip & leafy green crown
      drawDisc30(ctx, 13, 6, 3.2, '#22c55e', '#86efac', '#15803d', out);
      drawDisc30(ctx, 17, 6, 3.2, '#16a34a', '#4ade80', '#14532d', out);
      drawDisc30(ctx, 15, 16, 6.8, p, a, s, out);
      drawDiamond30(ctx, 15, 24, 2.5, 3.5, '#ffffff', '#ffffff', '#fbcfe8', out);
      return true;
    }
    case 1021: {
      // Sunroot Carrot — Tapered bright-orange carrot root with feathery green tops
      drawDisc30(ctx, 15, 5, 3.5, '#22c55e', '#86efac', '#15803d', out);
      drawDiamond30(ctx, 15, 16, 6.2, 9.5, p, a, s, out);
      rect(ctx, 13, 12, 4, 1, s);
      rect(ctx, 14, 16, 3, 1, s);
      return true;
    }
    case 1022: {
      // Verdant Cabbage — Layered ruffled emerald-jade cabbage head
      drawDisc30(ctx, 11, 16, 6.5, '#15803d', '#4ade80', '#052e16', out);
      drawDisc30(ctx, 19, 16, 6.5, '#15803d', '#4ade80', '#052e16', out);
      drawDisc30(ctx, 15, 15, 7.2, p, a, s, out);
      return true;
    }
    case 1023: {
      // Ruby Vine Tomato — Glossy scarlet tomato with green calyx star on top
      drawDisc30(ctx, 15, 16, 8.2, p, a, s, out);
      bevel30(ctx, 11, 6, 8, 4, '#16a34a', '#86efac', '#14532d', out);
      return true;
    }
    case 1024: {
      // Golden Sweetcorn — Husked ear of golden kernel corn with green husk leaves
      bevel30(ctx, 10, 5, 10, 19, p, a, s, out);
      dither30(ctx, 12, 7, 6, 15, '#fef08a', '#eab308', 0.5);
      drawDiamond30(ctx, 9, 20, 3.5, 6, '#16a34a', '#86efac', '#14532d', out);
      drawDiamond30(ctx, 21, 20, 3.5, 6, '#16a34a', '#86efac', '#14532d', out);
      return true;
    }
    case 1025: {
      // Starlight Dew Melon — Striped teal-azure melon with glowing starlight core
      drawDisc30(ctx, 15, 16, 8.8, p, a, s, out);
      for (const mx of [10, 15, 20]) {
        drawLine30(ctx, mx, 8, mx, 23, s, 2);
      }
      px(ctx, 13, 12, '#ffffff');
      px(ctx, 17, 18, '#fef08a');
      return true;
    }

    // =========================================================================
    // 11. SCI-FI INFUSION SPACE STATION PACK (1100..1114)
    // =========================================================================
    case 1100: {
      // Orbital Hull Plating — Interlocking titanium hull plates with cyan telemetry seam
      bevel30(ctx, 0, 0, 30, 30, p, a, s, out);
      bevel30(ctx, 3, 3, 24, 11, s, p, shadeHex(s, -0.25), out);
      bevel30(ctx, 3, 16, 24, 11, s, p, shadeHex(s, -0.25), out);
      rect(ctx, 4, 14, 22, 2, '#38bdf8');
      return true;
    }
    case 1101: {
      // Titanium Airlock Frame — Heavy hazard-striped structural bulkhead frame
      bevel30(ctx, 0, 0, 30, 30, p, a, s, out);
      for (let x = 2; x < 28; x++) {
        const c = ((x >> 1) & 1) === 0 ? '#f97316' : '#0f172a';
        px(ctx, x, 2, c);
        px(ctx, x, 3, c);
        px(ctx, x, 26, c);
        px(ctx, x, 27, c);
      }
      bevel30(ctx, 5, 6, 20, 18, s, p, '#090d16', out);
      return true;
    }
    case 1102: {
      // Cryo-Core Panel — Sub-zero coolant module with glowing cyan cryo-tubes
      bevel30(ctx, 0, 0, 30, 30, s, p, '#082f49', out);
      for (const cx of [6, 13, 20]) {
        bevel30(ctx, cx, 4, 4, 22, '#0284c7', '#e0f2fe', '#0369a1', out);
        rect(ctx, cx + 1, 6, 1, 18, '#ffffff');
      }
      return true;
    }
    case 1103: {
      // Solar Relay Lattice — Photovoltaic blue-gold solar wafer grid
      bevel30(ctx, 0, 0, 30, 30, '#1e3a8a', '#facc15', '#0f172a', out);
      for (let gy = 2; gy < 28; gy += 6) {
        for (let gx = 2; gx < 28; gx += 6) {
          rect(ctx, gx, gy, 5, 5, '#1d4ed8');
          px(ctx, gx, gy, '#60a5fa');
        }
      }
      rect(ctx, 14, 1, 2, 28, '#facc15');
      rect(ctx, 1, 14, 28, 2, '#facc15');
      return true;
    }
    case 1104: {
      // Reinforced Viewglass — Armored orbital viewport window
      bevel30(ctx, 0, 0, 30, 30, '#334155', '#94a3b8', '#0f172a', out);
      bevel30(ctx, 4, 4, 22, 22, '#082f49', '#67e8f9', '#020617', out);
      drawLine30(ctx, 7, 13, 13, 7, '#ffffff', 2);
      drawLine30(ctx, 15, 22, 22, 15, '#38bdf8', 2);
      return true;
    }
    case 1105: {
      // Ion Conduit Trim — High-voltage plasma pipeline block
      bevel30(ctx, 0, 0, 30, 30, s, p, '#090d16', out);
      bevel30(ctx, 1, 9, 28, 12, '#0f172a', '#38bdf8', '#020617', out);
      rect(ctx, 2, 13, 26, 4, '#22d3ee');
      rect(ctx, 2, 14, 26, 2, '#ffffff');
      return true;
    }
    case 1106:
    case 1107:
    case 1108:
    case 1109:
    case 1110:
    case 1111: {
      // Sci-Fi Background Walls (Bulkhead, Telemetry, Starfield, Power Spine, Quarantine, Hex-Vent)
      bevel30(ctx, 0, 0, 30, 30, s, p, '#020617', out);
      if (itemId === 1108) {
        // Starfield Viewport Wall — Deep space stars & nebula glow
        rect(ctx, 2, 2, 26, 26, '#020617');
        for (const [sx, sy, col] of [
          [6, 6, '#ffffff'],
          [19, 5, '#38bdf8'],
          [11, 13, '#fef08a'],
          [24, 15, '#ffffff'],
          [7, 22, '#c084fc'],
          [17, 23, '#ffffff'],
        ] as const) {
          px(ctx, sx, sy, col);
        }
      } else {
        bevel30(ctx, 4, 4, 22, 22, shadeHex(s, -0.2), p, '#020617', out);
        rect(ctx, 6, 14, 18, 2, a);
      }
      return true;
    }
    case 1112: {
      // Airlock Bulkhead Door — Twin-leaf sliding pressure door with cyan biometric scanner
      bevel30(ctx, 2, 1, 26, 28, '#334155', '#94a3b8', '#0f172a', out);
      bevel30(ctx, 5, 3, 10, 24, '#475569', '#cbd5e1', '#1e293b', out);
      bevel30(ctx, 15, 3, 10, 24, '#475569', '#cbd5e1', '#1e293b', out);
      drawDisc30(ctx, 15, 15, 3.2, '#0284c7', '#67e8f9', '#0c4a6e', out);
      return true;
    }
    case 1113:
    case 1114: {
      // Hover-Grate Platform (1113) & Holo-Beam Catwalk (1114)
      bevel30(ctx, 0, 0, 30, 8, p, a, s, out);
      rect(ctx, 3, 3, 24, 2, a);
      // Thruster / holo emitter glow beneath platform
      rect(ctx, 5, 8, 5, 3, a);
      rect(ctx, 20, 8, 5, 3, a);
      return true;
    }

    default: {
      // Dynamic / custom item fallback in full 30-bit resolution
      const ramp = deriveColorRamp(p);
      bevel30(ctx, 0, 0, 30, 30, ramp.base, ramp.highlight, ramp.shadow, ramp.outline);
      drawDiamond30(ctx, 15, 15, 7, 7, a, '#ffffff', s, ramp.outline);
      return true;
    }
  }
}

/**
 * Compatibility helper that draws the 30-bit item texture onto a 48x48 or arbitrary canvas context.
 */
export function drawCatalogItemRaw48(
  ctx: CanvasRenderingContext2D,
  itemId: number,
  def: ItemDef | undefined = CATALOG[itemId]
): boolean {
  if (itemId === 0 || isFarmableExcluded(itemId)) return false;
  return drawCatalogItemRaw30(ctx, itemId, def);
}

/**
 * Returns a cached native 30x30 (30-bit) HTMLCanvasElement for the given non-farmable itemId.
 */
export function getCatalogItemTexture30(
  itemId: number,
  def: ItemDef | undefined = CATALOG[itemId]
): HTMLCanvasElement | null {
  if (itemId === 0 || isFarmableExcluded(itemId)) return null;
  const cached = tex30Cache.get(itemId);
  if (cached) return cached;

  if (typeof document === 'undefined') return null;

  const c30 = document.createElement('canvas');
  c30.width = CATALOG_TEX30_SIZE;
  c30.height = CATALOG_TEX30_SIZE;
  const ctx30 = c30.getContext('2d')!;
  ctx30.imageSmoothingEnabled = false;

  if (!drawCatalogItemRaw30(ctx30, itemId, def)) return null;

  if (itemId === 410) {
    const imgAsset = getDragonBoneWingsImage();
    if (imgAsset && (!imgAsset.complete || imgAsset.naturalWidth === 0)) {
      imgAsset.addEventListener('load', () => {
        tex30Cache.delete(410);
      }, { once: true });
      return c30;
    }
  }

  tex30Cache.set(itemId, c30);
  return c30;
}

/**
 * Renders the 30-bit (30x30) item texture onto a target canvas context (e.g. 60x60 tile or 48x48 icon)
 * using crisp nearest-neighbor scaling.
 */
export function drawCatalogItem30(
  ctx: CanvasRenderingContext2D,
  itemId: number,
  def: ItemDef | undefined = CATALOG[itemId],
  targetWidth = 60,
  targetHeight = 60
): boolean {
  if (itemId === 0 || isFarmableExcluded(itemId)) return false;
  const tex30 = getCatalogItemTexture30(itemId, def);
  if (!tex30) {
    // Headless Node test environment fallback
    return drawCatalogItemRaw30(ctx, itemId, def);
  }
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tex30, 0, 0, CATALOG_TEX30_SIZE, CATALOG_TEX30_SIZE, 0, 0, targetWidth, targetHeight);
  ctx.imageSmoothingEnabled = prevSmooth;
  return true;
}
