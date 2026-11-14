import { ITEM_IDS } from './catalog.ts';
import {
  BLOCKGROVE_ART_THEME as THEME,
  deriveColorRamp,
  mixHex,
  shadeHex,
} from './artTheme.ts';

export interface EquippedWearables {
  head?: number;
  face?: number;
  back?: number;
}

export const PLAYER_LOGICAL_W = 90;
export const PLAYER_LOGICAL_H = 105;
// 1:1 crisp pixel-art canvas scaled 25% larger matching 60px tile scale
export const PLAYER_HD_SCALE = 1.25;

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
  | 'mine'
  | 'mine0'
  | 'mine1'
  | 'mine2'
  | 'mine3'
  | 'place'
  | 'fish_cast'
  | 'fish_hold'
  | 'fish_reel';

const GRID_W = 24; // 24 * 3 = 72 logical px
const GRID_H = 28; // 28 * 3 = 84 logical px
const PX = 3; // 3x3 world pixels per pixel-art texel (identical to drawTile48 p3 grid)

const INK = THEME.ink.outline; // #151b26 solid pixel outline

/**
 * 2D Pixel-Art Grid Buffer (24x28 texels -> 72x84 logical pixels).
 * Guarantees 100% opaque crisp pixel blocks and automatic/explicit #151b26 outlines.
 */
class PixelGrid {
  private cells: (string | null)[] = new Array(GRID_W * GRID_H).fill(null);

  set(x: number, y: number, color: string) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= GRID_W || iy < 0 || iy >= GRID_H) return;
    this.cells[iy * GRID_W + ix] = color;
  }

  get(x: number, y: number): string | null {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= GRID_W || iy < 0 || iy >= GRID_H) return null;
    return this.cells[iy * GRID_W + ix];
  }

  fill(x: number, y: number, w: number, h: number, color: string) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const w0 = Math.round(w);
    const h0 = Math.round(h);
    for (let dy = 0; dy < h0; dy++) {
      for (let dx = 0; dx < w0; dx++) {
        this.set(x0 + dx, y0 + dy, color);
      }
    }
  }

  /**
   * Draws a 100% opaque pixel-art box with a 1-texel #151b26 border and inner fill.
   */
  outlinedBox(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    topHighlight?: string,
    bottomShadow?: string
  ) {
    this.fill(x, y, w, h, INK);
    if (w > 2 && h > 2) {
      this.fill(x + 1, y + 1, w - 2, h - 2, fill);
      if (topHighlight) {
        this.fill(x + 1, y + 1, Math.max(1, w - 3), 1, topHighlight);
      }
      if (bottomShadow && h > 3) {
        this.fill(x + 1, y + h - 2, w - 2, 1, bottomShadow);
      }
    }
  }

  /**
   * Renders the 24x28 pixel grid onto the 72x84 canvas with optional horizontal flip.
   */
  flushToCanvas(ctx: CanvasRenderingContext2D, facing: 1 | -1) {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const col = this.cells[y * GRID_W + x];
        if (!col) continue;
        const drawX = facing === 1 ? x * PX : (GRID_W - 1 - x) * PX;
        ctx.fillStyle = col;
        ctx.fillRect(drawX, y * PX, PX, PX);
      }
    }
  }
}

interface LegPose {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  fx: number;
  fy: number;
  fw: number;
  fh: number;
}

function drawBootAndLeg(
  g: PixelGrid,
  x: number,
  y: number,
  w: number,
  h: number,
  pantsLit: string,
  pantsMid: string,
  pantsDeep: string,
  bootLit: string,
  bootMid: string,
  bootDeep: string,
  isFront: boolean
) {
  // Full 1-texel #151b26 outline around the leg + boot silhouette
  g.fill(x, y, w, h, INK);
  if (w <= 2 || h <= 2) return;

  const iw = w - 2;
  const ih = h - 2;
  const ix = x + 1;
  const iy = y + 1;

  // Upper trouser section
  const pantsH = Math.max(1, ih - 2);
  g.fill(ix, iy, iw, pantsH, isFront ? pantsMid : pantsDeep);
  if (isFront) {
    g.fill(ix, iy, Math.max(1, iw - 1), 1, pantsLit);
    if (pantsH >= 2) {
      // Reinforced knee pad highlight
      g.set(ix + Math.min(iw - 1, 1), iy + 1, pantsLit);
    }
  }

  // Chunky cuffed explorer boot at bottom 2 inner rows
  const bootY = iy + pantsH;
  const bootH = ih - pantsH;
  if (bootH > 0) {
    g.fill(ix, bootY, iw, bootH, isFront ? bootMid : bootDeep);
    // Boot cuff highlight & steel toe cap facing forward (+X)
    g.set(ix, bootY, bootLit);
    if (iw >= 3) {
      g.set(ix + iw - 1, bootY + bootH - 1, '#b8c7d9');
    }
  }
}

function drawSuitedArm(
  g: PixelGrid,
  x: number,
  y: number,
  w: number,
  h: number,
  suitHi: string,
  suitMid: string,
  suitShade: string,
  skinHi: string,
  skinMid: string,
  cuffGold: string,
  fistAtEnd: 'down' | 'right' | 'up' = 'down'
) {
  g.fill(x, y, w, h, INK);
  if (w <= 2 || h <= 2) return;
  const ix = x + 1;
  const iy = y + 1;
  const iw = w - 2;
  const ih = h - 2;

  g.fill(ix, iy, iw, ih, suitMid);
  g.fill(ix, iy, Math.max(1, iw - 1), 1, suitHi);
  if (ih > 1) {
    g.fill(ix, iy + ih - 1, iw, 1, suitShade);
  }

  if (fistAtEnd === 'down' && ih >= 3) {
    // Gold gauntlet cuff + sturdy pixel fist at bottom
    g.fill(ix, iy + ih - 2, iw, 1, cuffGold);
    g.fill(ix, iy + ih - 1, iw, 1, skinMid);
    g.set(ix, iy + ih - 1, skinHi);
  } else if (fistAtEnd === 'right' && iw >= 3) {
    // Gold gauntlet cuff + sturdy pixel fist at right end
    g.fill(ix + iw - 2, iy, 1, ih, cuffGold);
    g.fill(ix + iw - 1, iy, 1, ih, skinMid);
    g.set(ix + iw - 1, iy, skinHi);
  } else if (fistAtEnd === 'up' && ih >= 3) {
    // Gold gauntlet cuff + pixel fist at top end
    g.fill(ix, iy + 1, iw, 1, cuffGold);
    g.fill(ix, iy, iw, 1, skinMid);
    g.set(ix, iy, skinHi);
  }
}

export function renderHighDefPlayerSprite(
  pose: string,
  facing: 1 | -1,
  shirtColor: string,
  equipped?: EquippedWearables
): HTMLCanvasElement {
  const tmpC = document.createElement('canvas');
  tmpC.width = 72;
  tmpC.height = 84;
  const tmpCtx = tmpC.getContext('2d')!;
  tmpCtx.imageSmoothingEnabled = false;

  const g = new PixelGrid();

  // --- 100% Opaque Pixel-Art Palettes ---
  const skinHi = '#ffe2c4';
  const skinMid = '#f5c396';
  const skinShade = '#d49566';

  const hairHi = '#965e3e';
  const hairMid = '#633922';
  const hairDeep = '#3d2112';

  // Customizable Explorer Suit Ramp (derived from player shirtColor)
  const suitRamp = deriveColorRamp(shirtColor || '#3898ff');
  const suitHi = mixHex(suitRamp.highlight, '#ffffff', 0.16);
  const suitMid = suitRamp.base;
  const suitShade = suitRamp.shadow;
  const suitDeep = shadeHex(suitRamp.shadow, 0.24);

  const collarLit = '#eef5fc';
  const collarShade = '#9fb4cc';

  // Sturdy Explorer Trousers & Boots
  const pantsLit = '#475f85';
  const pantsMid = '#2f415e';
  const pantsDeep = '#1d293d';

  const bootLit = '#9c6239';
  const bootMid = '#6e4226';
  const bootDeep = '#472915';

  const beltDark = '#3b2212';
  const beltLit = '#633b22';
  const goldHi = THEME.metal.goldLit;
  const goldMid = THEME.metal.goldMid;
  const goldDeep = THEME.metal.goldDeep;

  // --- Parse Pose & Animation Keyframes ---
  const isWalk = pose.startsWith('walk');
  const isIdle = pose.startsWith('idle');
  const isPunch = pose.startsWith('punch');
  const isMine = pose.startsWith('mine');
  const isFish = pose.startsWith('fish_');
  const lastChar = pose.slice(-1);
  const parsedDigit = Number(lastChar);
  const frameIdx =
    isWalk || isIdle || isPunch || isMine
      ? Number.isNaN(parsedDigit)
        ? isPunch || isMine
          ? 2
          : 0
        : parsedDigit
      : 0;

  // Vertical body bounce (in 3px texels)
  let bobY = 0;
  let torsoLeanX = 0;

  if (isIdle) {
    // Breathing cadence on frames 3, 4, 5
    bobY = frameIdx >= 3 && frameIdx <= 5 ? 1 : 0;
  } else if (isWalk) {
    // 8-frame pixel stride bounce: crush on 1 & 5, high push-off on 3 & 7
    const walkBobs = [0, 1, 0, -1, 0, 1, 0, -1];
    bobY = walkBobs[frameIdx] ?? 0;
  } else if (pose === 'jump') {
    bobY = -1;
  } else if (pose === 'land') {
    bobY = 1;
  } else if (isPunch) {
    if (frameIdx >= 1) torsoLeanX = 1;
    if (frameIdx === 2) bobY = 0;
  } else if (isMine) {
    if (frameIdx >= 2) torsoLeanX = 1;
  } else if (pose === 'fish_reel') {
    torsoLeanX = -1;
  }

  // --- 1. Back Layer: Equipped Wings (WEAR_SKY_WINGS) ---
  if (equipped?.back === ITEM_IDS.WEAR_SKY_WINGS) {
    const wingLift =
      pose === 'jump' || pose === 'fall' || (isWalk && frameIdx % 2 === 1) ? -1 : 0;
    const wy = 10 + bobY + wingLift;
    // Outer wing contour (#151b26) behind character back
    g.fill(1, wy, 7, 10, INK);
    g.fill(0, wy + 1, 5, 6, INK);
    // Feathered midtone & radiant cyan/white inner plumes
    g.fill(2, wy + 1, 5, 8, '#2b6cb0');
    g.fill(1, wy + 2, 4, 4, '#4fa8e8');
    g.fill(2, wy + 2, 3, 5, THEME.arcane.aquaLit);
    g.fill(2, wy + 2, 2, 2, '#ffffff');
    // Wing feather notches
    g.set(1, wy + 7, INK);
    g.set(2, wy + 9, INK);
  }

  // --- 2. Back Arm (Behind Torso on +X side) ---
  const torsoX = 6 + torsoLeanX;
  const torsoY = 14 + bobY;

  if (isWalk) {
    // Opposite arm swing relative to front arm
    const backArmXOffsets = [15, 16, 15, 14, 13, 12, 13, 14];
    const backArmYOffsets = [15, 15, 15, 16, 16, 16, 15, 15];
    drawSuitedArm(
      g,
      backArmXOffsets[frameIdx] + torsoLeanX,
      backArmYOffsets[frameIdx] + bobY,
      4,
      6,
      suitMid,
      suitShade,
      suitDeep,
      skinMid,
      skinShade,
      goldDeep,
      'down'
    );
  } else if (pose === 'jump' || pose === 'fall') {
    drawSuitedArm(
      g,
      torsoX + 10,
      torsoY - 1,
      4,
      6,
      suitMid,
      suitShade,
      suitDeep,
      skinMid,
      skinShade,
      goldDeep,
      'up'
    );
  } else {
    drawSuitedArm(
      g,
      torsoX + 9,
      torsoY + 1,
      4,
      6,
      suitMid,
      suitShade,
      suitDeep,
      skinMid,
      skinShade,
      goldDeep,
      'down'
    );
  }

  // --- 3. Sturdy Girth-Fitting Legs & Chunky Explorer Boots (Y = 21..27) ---
  let legs: LegPose = {
    // Default wide, grounded 10-texel (30px) stance with zero stickman gap
    bx: 11 + torsoLeanX,
    by: 21,
    bw: 6,
    bh: 7,
    fx: 7 + torsoLeanX,
    fy: 21,
    fw: 6,
    fh: 7,
  };

  if (isWalk) {
    // 8 distinct hand-crafted pixel-art stride keyframes
    const walkLegs: LegPose[] = [
      // 0: Contact stride (front leg forward right, back leg trailing left)
      { bx: 5, by: 21, bw: 6, bh: 6, fx: 12, fy: 21, fw: 6, fh: 6 },
      // 1: Down crush (wide firmly planted boots)
      { bx: 5, by: 22, bw: 6, bh: 6, fx: 13, fy: 22, fw: 6, fh: 6 },
      // 2: Pass-through (front planted, back knee tucked up)
      { bx: 6, by: 20, bw: 6, bh: 6, fx: 11, fy: 21, fw: 6, fh: 7 },
      // 3: High push-off (back leg swinging forward high, front pushing)
      { bx: 12, by: 20, bw: 6, bh: 6, fx: 7, fy: 21, fw: 6, fh: 7 },
      // 4: Opposite contact
      { bx: 12, by: 21, bw: 6, bh: 6, fx: 5, fy: 21, fw: 6, fh: 6 },
      // 5: Opposite crush
      { bx: 13, by: 22, bw: 6, bh: 6, fx: 5, fy: 22, fw: 6, fh: 6 },
      // 6: Opposite pass-through
      { bx: 11, by: 21, bw: 6, bh: 7, fx: 7, fy: 20, fw: 6, fh: 6 },
      // 7: Opposite high push-off
      { bx: 7, by: 21, bw: 6, bh: 7, fx: 12, fy: 20, fw: 6, fh: 6 },
    ];
    legs = walkLegs[frameIdx] ?? legs;
  } else if (pose === 'jump') {
    // Tucked airborne knees
    legs = { bx: 11, by: 20, bw: 6, bh: 6, fx: 6, fy: 20, fw: 6, fh: 6 };
  } else if (pose === 'fall') {
    // Braced air stance
    legs = { bx: 12, by: 21, bw: 6, bh: 6, fx: 5, fy: 20, fw: 6, fh: 6 };
  } else if (pose === 'land') {
    // Wide impact crouch
    legs = { bx: 12, by: 22, bw: 6, bh: 6, fx: 5, fy: 22, fw: 6, fh: 6 };
  } else if (isPunch && frameIdx >= 1) {
    // Braced combat lunge
    legs = { bx: 6, by: 21, bw: 6, bh: 7, fx: 12, fy: 21, fw: 6, fh: 7 };
  }

  // Draw back leg then front leg
  drawBootAndLeg(
    g,
    legs.bx,
    legs.by,
    legs.bw,
    legs.bh,
    pantsLit,
    pantsMid,
    pantsDeep,
    bootLit,
    bootMid,
    bootDeep,
    false
  );
  drawBootAndLeg(
    g,
    legs.fx,
    legs.fy,
    legs.fw,
    legs.fh,
    pantsLit,
    pantsMid,
    pantsDeep,
    bootLit,
    bootMid,
    bootDeep,
    true
  );

  // --- 4. Suited Explorer Torso, Armored Pauldrons, Collar & Utility Belt ---
  // Broad 12-texel (36px) torso box (X = 6..17, Y = 14..21)
  g.outlinedBox(torsoX, torsoY, 12, 8, suitMid, suitHi, suitDeep);

  // Tailored chest shading on right half & under-chest
  g.fill(torsoX + 6, torsoY + 1, 5, 5, suitShade);
  g.fill(torsoX + 1, torsoY + 1, 5, 4, suitMid);
  g.fill(torsoX + 1, torsoY + 1, 4, 2, suitHi);

  // Structured suit jacket lapel / center seam & chest badge
  g.fill(torsoX + 6, torsoY + 1, 1, 5, suitDeep);
  g.fill(torsoX + 5, torsoY + 2, 1, 4, suitHi);

  // High explorer suit collar & gold chest clasp
  g.fill(torsoX + 2, torsoY + 1, 8, 1, collarLit);
  g.fill(torsoX + 6, torsoY + 1, 4, 1, collarShade);
  g.fill(torsoX + 6, torsoY + 2, 2, 2, goldHi);
  g.set(torsoX + 7, torsoY + 3, goldMid);

  // Armored shoulder pauldrons on left & right shoulders
  g.outlinedBox(torsoX - 1, torsoY, 4, 4, suitMid, suitHi, suitShade);
  g.outlinedBox(torsoX + 9, torsoY, 4, 4, suitShade, suitMid, suitDeep);

  // Heavy tactical leather utility belt & gleaming gold buckle at waist (Y = torsoY + 5..6)
  const beltY = torsoY + 5;
  g.fill(torsoX + 1, beltY, 10, 2, beltDark);
  g.fill(torsoX + 1, beltY, 9, 1, beltLit);
  // Belt side pouch
  g.fill(torsoX + 2, beltY, 2, 2, bootMid);
  g.set(torsoX + 2, beltY, bootLit);
  // Gold belt buckle (2x2)
  g.fill(torsoX + 6, beltY, 2, 2, goldHi);
  g.set(torsoX + 7, beltY + 1, goldMid);

  // --- 5. Stocky 3/4-Profile Pixel-Art Head, Hair & Expressive Directional Face ---
  const headX = 6 + torsoLeanX;
  const headY = 5 + bobY;

  // Head silhouette box (12 texels = 36px wide, 10 texels = 30px tall)
  g.outlinedBox(headX, headY, 12, 10, skinMid, skinHi, skinShade);

  // Warm facial lighting: sunlit forehead/cheek on left-center, jaw shadow on bottom
  g.fill(headX + 2, headY + 3, 8, 5, skinMid);
  g.fill(headX + 2, headY + 3, 5, 3, skinHi);
  g.fill(headX + 2, headY + 8, 9, 1, skinShade);

  // Sculpted pixel-art hair crest, back hair volume & swept explorer bangs
  // Top hair crown
  g.fill(headX, headY - 1, 12, 2, INK);
  g.fill(headX + 1, headY, 10, 3, hairMid);
  g.fill(headX + 2, headY, 6, 2, hairHi);
  g.fill(headX + 8, headY + 1, 3, 2, hairDeep);
  // Heroic hair tuft spike at top-front
  g.fill(headX + 7, headY - 2, 4, 2, INK);
  g.fill(headX + 8, headY - 1, 2, 1, hairHi);
  // Sideburn & back-of-head hair framing (left side X = headX + 1..2)
  g.fill(headX + 1, headY + 2, 2, 5, hairDeep);
  g.set(headX + 2, headY + 3, hairMid);
  // Ear pixel on left side of face
  g.fill(headX + 2, headY + 5, 1, 2, skinHi);
  g.set(headX + 2, headY + 6, skinShade);
  // Forward-swept bangs across upper forehead
  g.fill(headX + 4, headY + 3, 3, 1, hairMid);
  g.set(headX + 5, headY + 3, hairHi);
  g.fill(headX + 8, headY + 3, 2, 1, hairDeep);

  // Expressive 3/4-profile eyes facing right (+X)
  const isBlink = pose === 'idle7';
  const browFrown = isPunch || isMine || pose === 'fish_reel' ? 1 : 0;

  if (isBlink) {
    // Crisp closed pixel eyelids
    g.fill(headX + 4, headY + 6, 2, 1, INK);
    g.fill(headX + 8, headY + 6, 2, 1, INK);
  } else {
    // Eyebrows
    g.fill(headX + 4, headY + 4 + browFrown, 2, 1, hairDeep);
    g.fill(headX + 8, headY + 4 + browFrown, 2, 1, hairDeep);

    // Rear-side eye (sclera on left, dark pupil on right looking +X)
    g.fill(headX + 4, headY + 5, 1, 2, '#ffffff');
    g.fill(headX + 5, headY + 5, 1, 2, INK);

    // Front-side eye (sclera on left, dark pupil on right looking +X)
    g.fill(headX + 8, headY + 5, 1, 2, '#ffffff');
    g.fill(headX + 9, headY + 5, 1, 2, INK);
  }

  // Confident pixel mouth / smirk
  if (isPunch || isMine || pose === 'jump') {
    g.fill(headX + 6, headY + 8, 2, 1, INK);
  } else {
    g.set(headX + 6, headY + 8, '#9e5c42');
    g.set(headX + 7, headY + 8, skinShade);
  }

  // --- 6. Equipped Head & Face Wearables ---
  if (equipped?.face === ITEM_IDS.WEAR_CYBER_VISOR) {
    // Wrap-around glowing neon-aqua pixel visor
    g.fill(headX + 2, headY + 4, 10, 4, INK);
    g.fill(headX + 3, headY + 5, 8, 2, THEME.arcane.aquaMid);
    g.fill(headX + 4, headY + 5, 4, 1, '#ffffff');
    g.fill(headX + 8, headY + 6, 3, 1, THEME.arcane.aquaLit);
  }

  if (equipped?.head === ITEM_IDS.WEAR_GOLD_CROWN) {
    const cy = headY - 3;
    // Regal 3-peak golden crown matching pixelArt.ts WEAR_GOLD_CROWN
    g.fill(headX + 1, cy + 1, 10, 4, INK);
    g.fill(headX + 1, cy - 1, 3, 3, INK);
    g.fill(headX + 5, cy - 2, 3, 4, INK);
    g.fill(headX + 8, cy - 1, 3, 3, INK);

    g.fill(headX + 2, cy + 2, 8, 2, goldMid);
    g.fill(headX + 2, cy, 1, 3, goldHi);
    g.fill(headX + 6, cy - 1, 1, 4, THEME.metal.goldRim);
    g.fill(headX + 9, cy, 1, 3, goldHi);
    // Socketed crown jewels
    g.set(headX + 3, cy + 2, '#38e8d8');
    g.set(headX + 6, cy + 2, '#ff4f5e');
    g.set(headX + 8, cy + 2, '#38e8d8');
  } else if (equipped?.head === ITEM_IDS.WEAR_EXPLORER_HAT) {
    const hy = headY - 3;
    // Wide-brimmed explorer fedora matching pixelArt.ts WEAR_EXPLORER_HAT
    g.fill(headX - 2, hy + 3, 16, 3, INK);
    g.fill(headX + 1, hy, 10, 4, INK);
    g.fill(headX - 1, hy + 4, 14, 1, bootMid);
    g.fill(headX + 2, hy + 1, 8, 3, bootLit);
    g.fill(headX + 3, hy + 1, 4, 1, '#c48352');
    // Gold hatband ribbon
    g.fill(headX + 2, hy + 3, 8, 1, goldHi);
  }

  // --- 7. Front Arm, Gauntlet & Active Tool / Action Keyframes ---
  if (isPunch) {
    if (frameIdx === 0) {
      // Wind-up: coiled back at left shoulder
      drawSuitedArm(
        g,
        torsoX - 3,
        torsoY + 1,
        5,
        5,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'right'
      );
    } else if (frameIdx === 1) {
      // Lunge drive across chest
      drawSuitedArm(
        g,
        torsoX + 2,
        torsoY + 1,
        8,
        5,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'right'
      );
    } else if (frameIdx === 2) {
      // Full heavy gauntlet extension + crisp opaque pixel impact arc
      drawSuitedArm(
        g,
        torsoX + 5,
        torsoY,
        9,
        5,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'right'
      );
      // Enlarged heavy striking fist (X = torsoX + 12..16)
      g.outlinedBox(torsoX + 11, torsoY - 1, 5, 6, skinMid, skinHi, skinShade);
      // Crisp pixel-art kinetic shockwave arc
      g.fill(22, torsoY - 2, 2, 1, '#ffffff');
      g.fill(23, torsoY - 1, 1, 7, '#ffffff');
      g.fill(22, torsoY, 1, 5, THEME.arcane.aquaLit);
      g.fill(22, torsoY + 6, 2, 1, '#ffffff');
    } else {
      // Follow-through frame
      drawSuitedArm(
        g,
        torsoX + 4,
        torsoY + 1,
        9,
        5,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'right'
      );
      g.fill(22, torsoY, 2, 2, THEME.arcane.aquaLit);
      g.fill(22, torsoY + 4, 2, 2, '#ffffff');
    }
  } else if (isMine) {
    // 4-frame pixel pickaxe swing matching pixelArt.ts pickaxe palette
    const shaftLit = '#b87648';
    const shaftDeep = '#6e4226';
    const headSteelLit = THEME.metal.steelLit;
    const headSteelMid = THEME.metal.steelMid;
    const headTipCyan = THEME.arcane.aquaLit;

    if (frameIdx === 0) {
      // Wind-up overhead-back
      drawSuitedArm(
        g,
        torsoX - 1,
        torsoY - 3,
        4,
        6,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'up'
      );
      // Pickaxe shaft & head raised high
      for (let i = 0; i < 5; i++) {
        g.outlinedBox(torsoX + i, headY - 2 - Math.floor(i / 2), 3, 3, shaftLit);
      }
      g.outlinedBox(torsoX + 3, 1, 7, 4, headSteelMid, headSteelLit, THEME.stone.shadow);
      g.fill(torsoX + 8, 2, 2, 2, headTipCyan);
    } else if (frameIdx === 1) {
      // Apex overhead
      drawSuitedArm(
        g,
        torsoX + 2,
        torsoY - 4,
        4,
        6,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'up'
      );
      g.outlinedBox(torsoX + 4, 3, 3, 8, shaftLit, shaftLit, shaftDeep);
      g.outlinedBox(torsoX + 2, 1, 9, 4, headSteelMid, headSteelLit, THEME.stone.shadow);
      g.fill(torsoX + 9, 2, 2, 2, headTipCyan);
    } else if (frameIdx === 2) {
      // Fast downward cleave
      drawSuitedArm(
        g,
        torsoX + 4,
        torsoY,
        7,
        5,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'right'
      );
      // Horizontal/angled shaft extending forward
      g.outlinedBox(torsoX + 10, torsoY - 1, 7, 3, shaftLit, shaftLit, shaftDeep);
      // Curved pickaxe head cleaving downward
      g.outlinedBox(torsoX + 14, torsoY - 4, 4, 9, headSteelMid, headSteelLit, THEME.stone.shadow);
      g.fill(torsoX + 16, torsoY + 2, 2, 2, headTipCyan);
      // Crisp pixel motion trail above
      g.fill(torsoX + 13, torsoY - 7, 3, 1, '#ffffff');
      g.fill(torsoX + 15, torsoY - 6, 3, 1, headTipCyan);
    } else {
      // Low impact follow-through
      drawSuitedArm(
        g,
        torsoX + 4,
        torsoY + 2,
        7,
        5,
        suitHi,
        suitMid,
        suitShade,
        skinHi,
        skinMid,
        goldHi,
        'right'
      );
      g.outlinedBox(torsoX + 10, torsoY + 3, 6, 3, shaftLit, shaftLit, shaftDeep);
      g.outlinedBox(torsoX + 14, torsoY + 1, 4, 8, headSteelMid, headSteelLit, THEME.stone.shadow);
      g.fill(torsoX + 16, torsoY + 6, 2, 2, headTipCyan);
      // Impact sparks
      g.fill(22, torsoY + 6, 2, 2, '#ffe18c');
      g.set(23, torsoY + 4, '#ffffff');
    }
  } else if (pose === 'place') {
    // Forward block-placing stance holding a crisp 6x6 framed pixel block
    drawSuitedArm(
      g,
      torsoX + 3,
      torsoY + 1,
      7,
      5,
      suitHi,
      suitMid,
      suitShade,
      skinHi,
      skinMid,
      goldHi,
      'right'
    );
    g.outlinedBox(
      torsoX + 9,
      torsoY - 1,
      6,
      6,
      THEME.wood.mid,
      THEME.wood.highlight,
      THEME.wood.deep
    );
    g.fill(torsoX + 11, torsoY + 1, 2, 2, THEME.wood.lit);
  } else if (isFish) {
    // Sturdy angled pixel fishing rod held in front gauntlet (live line/bobber is drawn by engine.ts)
    const isReel = pose === 'fish_reel';
    drawSuitedArm(
      g,
      torsoX + 3,
      torsoY + 1,
      6,
      5,
      suitHi,
      suitMid,
      suitShade,
      skinHi,
      skinMid,
      goldHi,
      'right'
    );
    const rodBaseX = torsoX + 8;
    const rodBaseY = torsoY + 2;
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const rx = rodBaseX + i;
      const ry = rodBaseY - i - (isReel && i >= 3 ? 1 : 0);
      g.fill(rx, ry, 2, 2, INK);
      g.set(rx, ry, i === steps - 1 ? '#ff6255' : '#e0a960');
    }
    // Golden reel wheel at handle
    g.outlinedBox(rodBaseX + 1, rodBaseY, 3, 3, goldMid, goldHi, goldDeep);
  } else if (isWalk) {
    // 8-frame opposite arm swing across torso
    const frontArmX = [5, 4, 5, 7, 9, 10, 8, 6][frameIdx] ?? 6;
    const frontArmY = [15, 15, 15, 15, 15, 15, 15, 15][frameIdx] ?? 15;
    const fistDir = frameIdx >= 4 && frameIdx <= 6 ? 'right' : 'down';
    const armW = fistDir === 'right' ? 6 : 4;
    const armH = fistDir === 'right' ? 5 : 6;
    drawSuitedArm(
      g,
      frontArmX + torsoLeanX,
      frontArmY + bobY,
      armW,
      armH,
      suitHi,
      suitMid,
      suitShade,
      skinHi,
      skinMid,
      goldHi,
      fistDir
    );
  } else if (pose === 'jump' || pose === 'fall') {
    // Raised balance arm in air
    drawSuitedArm(
      g,
      torsoX - 2,
      torsoY - 1,
      4,
      6,
      suitHi,
      suitMid,
      suitShade,
      skinHi,
      skinMid,
      goldHi,
      'up'
    );
  } else {
    // Grounded idle / land front arm resting at side with gauntlet
    drawSuitedArm(
      g,
      torsoX - 1,
      torsoY + 1,
      4,
      6,
      suitHi,
      suitMid,
      suitShade,
      skinHi,
      skinMid,
      goldHi,
      'down'
    );
  }

  g.flushToCanvas(tmpCtx, facing);

  const c = document.createElement('canvas');
  c.width = PLAYER_LOGICAL_W;
  c.height = PLAYER_LOGICAL_H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmpC, 0, 0, 72, 84, 0, 0, PLAYER_LOGICAL_W, PLAYER_LOGICAL_H);
  return c;
}

export const drawPlayerSpriteHD = renderHighDefPlayerSprite;

