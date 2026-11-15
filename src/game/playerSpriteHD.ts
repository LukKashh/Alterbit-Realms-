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
// 1:1 crisp pixel-art texel grid scaled cleanly to match 60px tiles
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

export interface CharacterAnimParams {
  facing: 1 | -1;
  vx: number;
  vy: number;
  grounded: boolean;
  punching: boolean;
  placing: boolean;
  shirtColor: string;
  walkPhase: number;
  nowMs: number;
  punchProgress: number;
  actionKind?: 'punch' | 'mine';
  landing?: boolean;
  fishingState?: 'none' | 'hold' | 'reel';
  equipped?: EquippedWearables;
}

type FaceExpression = 'neutral' | 'blink' | 'effort' | 'air';

export interface CharacterPartTextures {
  head: HTMLCanvasElement;
  faces: Record<FaceExpression, HTMLCanvasElement>;
  torso: HTMLCanvasElement;
  handFront: HTMLCanvasElement;
  handBack: HTMLCanvasElement;
  footFront: HTMLCanvasElement;
  footBack: HTMLCanvasElement;
  pickaxe: HTMLCanvasElement;
  placeCube: HTMLCanvasElement;
  fishingRod: HTMLCanvasElement;
}

const INK = THEME.ink.outline; // #151b26 crisp pixel outline matching world blocks
const TEX = 4; // 4x4 logical pixels per crisp pixel-art texel

function createPartBuffer(gridW: number, gridH: number) {
  const cells: (string | null)[] = new Array(gridW * gridH).fill(null);

  const set = (x: number, y: number, color: string | null) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= gridW || iy < 0 || iy >= gridH) return;
    cells[iy * gridW + ix] = color;
  };

  const fill = (x: number, y: number, w: number, h: number, color: string | null) => {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const w0 = Math.round(w);
    const h0 = Math.round(h);
    for (let dy = 0; dy < h0; dy++) {
      for (let dx = 0; dx < w0; dx++) {
        set(x0 + dx, y0 + dy, color);
      }
    }
  };

  const outlinedBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    fillCol: string,
    hiCol?: string,
    shadeCol?: string
  ) => {
    fill(x, y, w, h, INK);
    if (w > 2 && h > 2) {
      fill(x + 1, y + 1, w - 2, h - 2, fillCol);
      if (hiCol) fill(x + 1, y + 1, Math.max(1, w - 3), 1, hiCol);
      if (shadeCol && h > 3) fill(x + 1, y + h - 2, w - 2, 1, shadeCol);
    }
  };

  const toCanvas = (): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = gridW * TEX;
    c.height = gridH * TEX;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const col = cells[y * gridW + x];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * TEX, y * TEX, TEX, TEX);
      }
    }
    return c;
  };

  return { set, fill, outlinedBox, toCanvas };
}

/**
 * Generates localized, completely unornamented pixel-art body part textures:
 * Head, Face (4 expressions), Torso, Hands (front/back), Feet (front/back).
 * Strictly zero hair, zero wardrobe hats/crowns/visors/wings, zero belts/collars/armor/boots.
 */
function buildCharacterPartTextures(shirtColor: string): CharacterPartTextures {
  const skinHi = '#ffe2c4';
  const skinMid = '#f5c396';
  const skinShade = '#d49566';
  const skinBack = '#b87a4e';

  const suitRamp = deriveColorRamp(shirtColor || '#3898ff');
  const suitHi = mixHex(suitRamp.highlight, '#ffffff', 0.16);
  const suitMid = suitRamp.base;
  const suitShade = suitRamp.shadow;
  const suitDeep = shadeHex(suitRamp.shadow, 0.25);

  const legHi = '#556e94';
  const legMid = '#3b4f6e';
  const legShade = '#27364d';

  // --- 1. HEAD (10x9 texels = 40x36 logical px): Clean rounded bare head ---
  const headBuf = createPartBuffer(10, 9);
  headBuf.fill(1, 0, 8, 9, INK);
  headBuf.fill(0, 1, 10, 7, INK);
  // Inner head skin volume
  headBuf.fill(1, 1, 8, 7, skinMid);
  // Top crown highlight & cheek shading
  headBuf.fill(2, 1, 6, 2, skinHi);
  headBuf.fill(1, 2, 3, 4, skinHi);
  headBuf.fill(1, 7, 8, 1, skinShade);
  headBuf.fill(8, 2, 1, 5, skinShade);
  // Subtle rounded ear contour on back-of-head left side (facing +X)
  headBuf.fill(1, 4, 1, 2, skinMid);
  headBuf.set(1, 5, skinShade);
  const head = headBuf.toCanvas();

  // --- 2. FACE (8x6 texels = 32x24 logical px): Localized expression layer ---
  const buildFace = (expr: FaceExpression): HTMLCanvasElement => {
    const f = createPartBuffer(8, 6);
    if (expr === 'blink') {
      f.fill(1, 2, 2, 1, INK);
      f.fill(5, 2, 2, 1, INK);
      f.set(4, 4, '#a66849');
      return f.toCanvas();
    }

    // Subtle brow line (clean unornamented tone-on-skin, angled slightly during effort)
    const browDrop = expr === 'effort' ? 1 : 0;
    f.fill(1, browDrop, 2, 1, '#9e623c');
    f.fill(5, browDrop, 2, 1, '#9e623c');

    // Crisp 3/4-profile eyes looking +X
    f.fill(1, 1, 1, 2, '#ffffff');
    f.fill(2, 1, 1, 2, INK);
    f.fill(5, 1, 1, 2, '#ffffff');
    f.fill(6, 1, 1, 2, INK);

    if (expr === 'effort') {
      f.fill(3, 4, 2, 1, INK);
    } else if (expr === 'air') {
      f.set(4, 4, INK);
      f.set(5, 4, '#9e623c');
    } else {
      f.set(3, 4, '#a66849');
      f.set(4, 4, skinShade);
    }
    return f.toCanvas();
  };

  // --- 3. TORSO (9x8 texels = 36x32 logical px): Clean simple tunic & base shorts ---
  const torsoBuf = createPartBuffer(9, 8);
  torsoBuf.outlinedBox(0, 0, 9, 8, suitMid, suitHi, suitShade);
  // Upper-left chest highlight
  torsoBuf.fill(1, 1, 4, 3, suitHi);
  // Soft right-side core shading
  torsoBuf.fill(6, 1, 2, 5, suitShade);
  // Clean plain trouser-hip transition at bottom 2 inner rows (no belt, no buckle, no collar)
  torsoBuf.fill(1, 5, 7, 2, legMid);
  torsoBuf.fill(6, 5, 2, 2, legShade);
  const torso = torsoBuf.toCanvas();

  // --- 4. HANDS / ARMS (4x7 texels = 16x28 logical px): Simple sleeve + bare hand ---
  const buildHand = (front: boolean): HTMLCanvasElement => {
    const b = createPartBuffer(4, 7);
    b.fill(0, 0, 4, 7, INK);
    // Clean upper short sleeve
    b.fill(1, 1, 2, 3, front ? suitMid : suitDeep);
    if (front) b.set(1, 1, suitHi);
    // Smooth bare forearm & simple rounded hand (zero gauntlets or cuffs)
    b.fill(1, 4, 2, 2, front ? skinMid : skinBack);
    if (front) b.set(1, 4, skinHi);
    return b.toCanvas();
  };

  // --- 5. FEET / LEGS (4x7 texels = 16x28 logical px): Clean leg + simple bare rounded foot ---
  const buildFoot = (front: boolean): HTMLCanvasElement => {
    const b = createPartBuffer(4, 7);
    b.fill(0, 0, 4, 7, INK);
    // Clean leg trouser
    b.fill(1, 1, 2, 3, front ? legMid : legShade);
    if (front) b.set(1, 1, legHi);
    // Simple clean rounded bare foot at bottom (zero boots, zero toe-caps, zero cuffs)
    b.fill(1, 4, 2, 2, front ? skinMid : skinBack);
    if (front) b.set(1, 4, skinHi);
    return b.toCanvas();
  };

  // --- Lightweight Held Props for Active Pickaxe / Place / Fishing Readability ---
  const buildPickaxe = (): HTMLCanvasElement => {
    const p = createPartBuffer(8, 8);
    // Clean diagonal handle + simple steel pick head
    for (let i = 0; i < 6; i++) {
      p.outlinedBox(i, 5 - i, 3, 3, '#b87648', '#d69767', '#6e4226');
    }
    p.outlinedBox(3, 0, 5, 3, THEME.metal.steelMid, THEME.metal.steelLit, THEME.stone.shadow);
    p.fill(6, 1, 2, 1, THEME.arcane.aquaLit);
    return p.toCanvas();
  };

  const buildPlaceCube = (): HTMLCanvasElement => {
    const c = createPartBuffer(5, 5);
    c.outlinedBox(0, 0, 5, 5, THEME.wood.mid, THEME.wood.highlight, THEME.wood.deep);
    c.fill(2, 2, 1, 1, THEME.wood.lit);
    return c.toCanvas();
  };

  const buildFishingRod = (): HTMLCanvasElement => {
    const r = createPartBuffer(8, 8);
    for (let i = 0; i < 7; i++) {
      r.fill(i, 6 - i, 2, 2, INK);
      r.set(i, 6 - i, i === 6 ? '#ff6255' : '#e0a960');
    }
    return r.toCanvas();
  };

  return {
    head,
    faces: {
      neutral: buildFace('neutral'),
      blink: buildFace('blink'),
      effort: buildFace('effort'),
      air: buildFace('air'),
    },
    torso,
    handFront: buildHand(true),
    handBack: buildHand(false),
    footFront: buildFoot(true),
    footBack: buildFoot(false),
    pickaxe: buildPickaxe(),
    placeCube: buildPlaceCube(),
    fishingRod: buildFishingRod(),
  };
}

const partTextureCache = new Map<string, CharacterPartTextures>();

export function getCharacterPartTextures(shirtColor: string): CharacterPartTextures {
  const key = (shirtColor || '#3898ff').toLowerCase();
  const cached = partTextureCache.get(key);
  if (cached) return cached;
  const built = buildCharacterPartTextures(key);
  partTextureCache.set(key, built);
  return built;
}

function drawPivotedPart(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  worldX: number,
  worldY: number,
  pivotX: number,
  pivotY: number,
  angleRad: number
) {
  ctx.save();
  ctx.translate(worldX, worldY);
  if (Math.abs(angleRad) > 0.002) {
    ctx.rotate(angleRad);
  }
  ctx.drawImage(img, Math.round(-pivotX), Math.round(-pivotY));
  ctx.restore();
}

/**
 * Renders the 5-part localized modular character rig (Head, Face, Torso, Hands, Feet)
 * directly with smooth continuous phase transforms for natural, fluid movement.
 */
export function drawModularCharacter(
  ctx: CanvasRenderingContext2D,
  drawX: number,
  drawY: number,
  params: CharacterAnimParams
): number {
  const parts = getCharacterPartTextures(params.shirtColor);
  const {
    facing,
    vx,
    vy,
    grounded,
    punching,
    placing,
    walkPhase,
    nowMs,
    punchProgress,
    actionKind = 'punch',
    landing = false,
    fishingState = 'none',
  } = params;

  const isWalking = grounded && Math.abs(vx) > 15 && !punching && !placing;
  const speedRatio = isWalking ? Math.min(1, Math.abs(vx) / 230) : 0;
  const walkTheta = (walkPhase / 8) * Math.PI * 2;

  // Natural blink window (~140ms every ~3.8s)
  const blinkMod = nowMs % 3800;
  const isBlinking = !punching && grounded && !isWalking && blinkMod > 3640;

  let faceExpr: FaceExpression = 'neutral';
  if (punching || fishingState === 'reel') faceExpr = 'effort';
  else if (!grounded) faceExpr = 'air';
  else if (isBlinking) faceExpr = 'blink';

  // Continuous kinematics per part
  let scaleX = 1;
  let scaleY = 1;
  let torsoBobY = Math.sin(nowMs * 0.0034) * 1.35;
  let torsoAngle = 0;
  let headAngle = 0;
  let headLagX = 0;
  let headBobY = 0;

  let backHandAngle = Math.sin(nowMs * 0.0034 + 0.5) * 0.04;
  let frontHandAngle = -Math.sin(nowMs * 0.0034 + 0.5) * 0.04;
  let backHandX = 2;
  let backHandY = 0;
  let frontHandX = -2;
  let frontHandY = 0;

  let backFootX = 8;
  let backFootY = 0;
  let backFootAngle = 0;
  let frontFootX = -8;
  let frontFootY = 0;
  let frontFootAngle = 0;

  if (isWalking) {
    const stride = Math.sin(walkTheta);
    const liftA = Math.max(0, Math.cos(walkTheta));
    const liftB = Math.max(0, -Math.cos(walkTheta));

    torsoBobY = -Math.abs(Math.cos(walkTheta)) * 3.2 * speedRatio;
    torsoAngle = 0.075 * speedRatio;
    headAngle = -0.025 * speedRatio;
    headLagX = -1.2 * speedRatio;
    headBobY = Math.sin(walkTheta * 2 - 0.5) * 1.1 * speedRatio;

    // Smooth elliptical foot stride around grounded feet baseline
    frontFootX = -4 + stride * 11 * speedRatio;
    frontFootY = -liftA * 6.5 * speedRatio;
    frontFootAngle = -stride * 0.28 * speedRatio;

    backFootX = 4 - stride * 11 * speedRatio;
    backFootY = -liftB * 6.5 * speedRatio;
    backFootAngle = stride * 0.28 * speedRatio;

    // Natural opposing arm pendulums
    frontHandAngle = stride * 0.55 * speedRatio;
    backHandAngle = -stride * 0.52 * speedRatio;
  } else if (!grounded) {
    if (vy < 0) {
      scaleX = 0.95;
      scaleY = 1.05;
      torsoBobY = -2;
      torsoAngle = -0.05;
      backHandAngle = -0.88;
      frontHandAngle = -0.78;
      frontFootY = -5;
      backFootY = -3;
      frontFootAngle = 0.22;
      backFootAngle = -0.14;
    } else {
      scaleX = 0.97;
      scaleY = 1.03;
      torsoBobY = -1;
      torsoAngle = 0.06;
      backHandAngle = -1.25;
      frontHandAngle = -1.1;
      frontFootX = -9;
      backFootX = 9;
      frontFootY = -3;
      backFootY = -1;
      frontFootAngle = -0.22;
      backFootAngle = 0.24;
    }
  } else if (landing) {
    scaleX = 1.08;
    scaleY = 0.91;
    torsoBobY = 4;
    headBobY = 2;
    frontFootX = -10;
    backFootX = 10;
    frontHandAngle = 0.24;
    backHandAngle = -0.24;
  }

  if (punching) {
    const p = Math.max(0, Math.min(1, punchProgress));
    if (p < 0.22) {
      // Smooth coiled wind-up
      const t = p / 0.22;
      torsoAngle = -0.12 * t;
      headAngle = -0.05 * t;
      frontHandAngle = (actionKind === 'mine' ? -2.3 : -0.75) * t;
      backHandAngle = 0.35 * t;
    } else if (p < 0.65) {
      // Fast drive extension
      const t = (p - 0.22) / 0.43;
      const drive = Math.sin(t * Math.PI * 0.5);
      torsoAngle = -0.12 + 0.3 * drive;
      headAngle = 0.06 * drive;
      frontHandX = 3 * drive;
      frontHandAngle = actionKind === 'mine' ? -2.3 + 2.9 * drive : -1.55 * drive;
      backHandAngle = 0.45 * drive;
    } else {
      // Elastic follow-through back toward neutral
      const t = (p - 0.65) / 0.35;
      const relax = 1 - t;
      torsoAngle = 0.18 * relax;
      headAngle = 0.06 * relax;
      frontHandX = 3 * relax;
      frontHandAngle = actionKind === 'mine' ? 0.6 * relax : -1.55 * relax;
      backHandAngle = 0.45 * relax;
    }
    if (grounded) {
      frontFootX = -9;
      backFootX = 9;
    }
  } else if (placing) {
    torsoAngle = 0.08;
    frontHandX = 2;
    frontHandAngle = -1.15;
  } else if (fishingState === 'hold') {
    torsoAngle = -0.04;
    frontHandX = 2;
    frontHandAngle = -0.95;
  } else if (fishingState === 'reel') {
    torsoAngle = -0.16;
    headAngle = -0.06;
    frontHandX = 1;
    frontHandAngle = -1.25 - Math.sin(nowMs * 0.025) * 0.15;
  }

  // Anchor coordinates centered horizontally, feet flush at bottom drawY + PLAYER_LOGICAL_H (105)
  const centerX = drawX + PLAYER_LOGICAL_W * 0.5;
  const groundBottomY = drawY + PLAYER_LOGICAL_H;

  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(centerX, groundBottomY);
  ctx.scale(facing * scaleX, scaleY);

  // Relative heights from groundBottomY = 0 upwards
  const hipY = -28 + torsoBobY;
  const shoulderY = hipY - 26;
  const neckY = hipY - 30 + headBobY;

  // --- 1. Back Hand (Behind Torso) ---
  drawPivotedPart(ctx, parts.handBack, backHandX + 10, shoulderY + 4 + backHandY, 8, 5, backHandAngle);

  // --- 2. Back Foot / Leg ---
  drawPivotedPart(ctx, parts.footBack, backFootX, -26 + backFootY, 8, 4, backFootAngle);

  // --- 3. Front Foot / Leg ---
  drawPivotedPart(ctx, parts.footFront, frontFootX, -26 + frontFootY, 8, 4, frontFootAngle);

  // --- 4. Torso ---
  drawPivotedPart(ctx, parts.torso, 0, hipY, 18, 28, torsoAngle);

  // --- 5. Head & Localized Face ---
  ctx.save();
  ctx.translate(headLagX, neckY);
  ctx.rotate(headAngle);
  ctx.drawImage(parts.head, -20, -34);
  // Face anchored cleanly inside forward face region of Head
  ctx.drawImage(parts.faces[faceExpr], -12, -26);
  ctx.restore();

  // --- 6. Front Hand (+ Tool Prop when actively Mining, Placing, or Fishing) ---
  ctx.save();
  ctx.translate(frontHandX - 8, shoulderY + 4 + frontHandY);
  ctx.rotate(frontHandAngle);
  ctx.drawImage(parts.handFront, -8, -5);
  if (punching && actionKind === 'mine') {
    ctx.drawImage(parts.pickaxe, -2, 10);
  } else if (placing) {
    ctx.drawImage(parts.placeCube, -4, 14);
  } else if (fishingState !== 'none') {
    ctx.drawImage(parts.fishingRod, -2, 6);
  }
  ctx.restore();

  ctx.restore();
  ctx.imageSmoothingEnabled = prevSmoothing;
  return drawY + 12;
}

/**
 * Backwards-compatible static pose renderer mapped onto the new clean 5-part modular character.
 */
export function renderHighDefPlayerSprite(
  pose: string,
  facing: 1 | -1,
  shirtColor: string,
  _equipped?: EquippedWearables
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PLAYER_LOGICAL_W;
  c.height = PLAYER_LOGICAL_H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const isWalk = pose.startsWith('walk');
  const isPunch = pose.startsWith('punch');
  const isMine = pose.startsWith('mine');
  const digit = Number(pose.slice(-1));
  const idx = Number.isNaN(digit) ? 2 : digit;

  drawModularCharacter(ctx, 0, 0, {
    facing,
    vx: isWalk ? 220 : 0,
    vy: pose === 'jump' ? -220 : pose === 'fall' ? 220 : 0,
    grounded: pose !== 'jump' && pose !== 'fall',
    punching: isPunch || isMine,
    placing: pose === 'place',
    shirtColor,
    walkPhase: isWalk ? idx : 0,
    nowMs: pose === 'idle7' ? 3700 : 400,
    punchProgress: isPunch || isMine ? Math.min(0.95, idx / 3.2) : 0,
    actionKind: isMine ? 'mine' : 'punch',
    landing: pose === 'land',
    fishingState:
      pose === 'fish_reel' ? 'reel' : pose === 'fish_hold' || pose === 'fish_cast' ? 'hold' : 'none',
  });
  return c;
}

export const drawPlayerSpriteHD = renderHighDefPlayerSprite;
