/**
 * Blockgrove Master Art Style & Theme Palette
 * -------------------------------------------
 * Style: Warm-Pixel Storybook Sandbox (2D crisp pixel art, zero blur)
 * Lighting: Top-left 45-degree sunlit specular rim (+light), bottom-right cool occlusion (-shade)
 * Contours: Unified #151b26 midnight-ink outlines on characters, props, locks, and foliage tufts
 *
 * Keep this palette as the single source of truth for all current and future blocks,
 * backgrounds, placeables, wearables, tools, and character sprites.
 */

export const BLOCKGROVE_ART_THEME = {
  styleName: 'Warm-Pixel Storybook Sandbox',
  lightDirection: 'top-left-45deg',
  tileTextureSize: 48,
  playerSpriteSize: { width: 68, height: 84 },
  playerBoxSize: { width: 38.4, height: 84 },
  ink: {
    outline: '#151b26',
    softOutline: '#222b3b',
    interiorSeam: '#1c2432',
    uiShadow: '#0b131e',
  },
  sky: {
    zenith: '#3f95db',
    mid: '#7ec8f2',
    horizon: '#c8ecff',
    cloudLit: '#ffffff',
    cloudShade: '#d5ebfa',
  },
  earth: {
    grassRim: '#b8f58c',
    grassLit: '#7be05f',
    grassMid: '#4ea84e',
    grassDeep: '#286b35',
    dirtLit: '#bd895c',
    dirtMid: '#8b5a35',
    dirtDeep: '#5c3820',
    dirtPebble: '#442817',
    sandLit: '#f5e6b3',
    sandMid: '#d9c17b',
    sandDeep: '#a88d4d',
  },
  stone: {
    highlight: '#cfd7e3',
    lit: '#9aa4b2',
    mid: '#67707d',
    shadow: '#3b424d',
    abyss: '#1a1e28',
  },
  wood: {
    highlight: '#e2b784',
    lit: '#c99057',
    mid: '#a36836',
    shadow: '#6b4222',
    deep: '#452915',
  },
  brick: {
    mortar: '#2c2224',
    terracottaLit: '#e0917e',
    terracottaMid: '#a85a4b',
    terracottaDeep: '#6b3732',
    crimsonLit: '#ea8478',
    crimsonMid: '#ab4640',
    crimsonDeep: '#662828',
  },
  metal: {
    goldRim: '#fff3a8',
    goldLit: '#ffd966',
    goldMid: '#f2b738',
    goldDeep: '#8f5f14',
    steelRim: '#f0f7ff',
    steelLit: '#c9daeb',
    steelMid: '#7f95ab',
    steelDeep: '#405061',
  },
  arcane: {
    aquaRim: '#e0ffff',
    aquaLit: '#9ce5ff',
    aquaMid: '#38e8d8',
    aquaDeep: '#186e75',
    emeraldRim: '#c7ffe4',
    emeraldLit: '#78e3ad',
    emeraldMid: '#3ca374',
    emeraldDeep: '#1a4f38',
    emberRim: '#fff6b3',
    emberLit: '#ffd257',
    emberMid: '#f05a28',
    emberDeep: '#7d1e14',
  },
  character: {
    skinHighlight: '#ffe0c7',
    skinMid: '#f2c199',
    skinShade: '#cf946b',
    skinDeep: '#a66e49',
    hairHighlight: '#85532f',
    hairMid: '#543119',
    hairDeep: '#301a0c',
    eyeDark: '#161d29',
    eyeWhite: '#ffffff',
    trouserLit: '#4b5e7a',
    trouserMid: '#313f54',
    trouserDeep: '#1e2736',
    bootLit: '#8a5532',
    bootMid: '#5e3820',
    bootDeep: '#382011',
    beltLeather: '#292226',
    buckleGold: '#f2c44d',
  },
} as const;

export interface ColorRamp {
  outline: string;
  deep: string;
  shadow: string;
  base: string;
  highlight: string;
  rim: string;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  const n = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = parseHex(hexA);
  const [r2, g2, b2] = parseHex(hexB);
  const clamped = Math.max(0, Math.min(1, t));
  return toHex(r1 + (r2 - r1) * clamped, g1 + (g2 - g1) * clamped, b1 + (b2 - b1) * clamped);
}

export function shadeHex(hex: string, amount: number): string {
  if (amount >= 0) {
    return mixHex(hex, '#fff9eb', amount);
  }
  return mixHex(hex, '#141a26', -amount);
}

export function deriveColorRamp(baseHex: string): ColorRamp {
  return {
    outline: BLOCKGROVE_ART_THEME.ink.outline,
    deep: shadeHex(baseHex, -0.45),
    shadow: shadeHex(baseHex, -0.24),
    base: baseHex,
    highlight: shadeHex(baseHex, 0.22),
    rim: shadeHex(baseHex, 0.44),
  };
}

export function pixelHash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
