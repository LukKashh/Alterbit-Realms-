import { BLOCKGROVE_ART_THEME as THEME } from './artTheme.ts';
import { PLAYER_HEIGHT, PLAYER_WIDTH } from './constants.ts';

export interface EquippedWearables {
  head?: number;
  face?: number;
  back?: number;
}

// Fitted 1:1 to the maximum player hitbox border dimensions (48x105)
export const PLAYER_LOGICAL_W = PLAYER_WIDTH; // 48px (24 texels * 2px)
export const PLAYER_LOGICAL_H = PLAYER_HEIGHT; // 105px
export const PLAYER_HD_SCALE = 1;

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
  placeProgress?: number;
  actionKind?: 'punch' | 'mine';
  /** Directional vector from player shoulder center to target action tile in world space */
  aimX?: number;
  aimY?: number;
  landing?: boolean;
  fishingState?: 'none' | 'hold' | 'reel';
  equipped?: EquippedWearables;
}

export type FaceExpression =
  | 'neutral'
  | 'blink'
  | 'walk'
  | 'jump'
  | 'fall'
  | 'land'
  | 'effort'
  | 'focus';

export type TorsoVariant = 'neutral' | 'twist' | 'stretch';
export type HandVariant = 'rest' | 'swing_fwd' | 'swing_back' | 'strike' | 'raise';
export type FootVariant = 'stand' | 'stride_fwd' | 'stride_back' | 'jump_tuck' | 'land_crouch';

export interface CharacterPartTextures {
  head: HTMLCanvasElement;
  faces: Record<FaceExpression, HTMLCanvasElement>;
  torsos: Record<TorsoVariant, HTMLCanvasElement>;
  handsFront: Record<HandVariant, HTMLCanvasElement>;
  handsBack: Record<HandVariant, HTMLCanvasElement>;
  feetFront: Record<FootVariant, HTMLCanvasElement>;
  feetBack: Record<FootVariant, HTMLCanvasElement>;
  pickaxe: HTMLCanvasElement;
  placeCube: HTMLCanvasElement;
  fishingRod: HTMLCanvasElement;
}

export interface SubLayerTransform {
  x: number;
  y: number;
  pivotX: number;
  pivotY: number;
  angleRad: number;
}

export interface ModularPlayerRigState {
  centerX: number;
  groundBottomY: number;
  topBoxY: number;
  facing: 1 | -1;
  scaleX: number;
  scaleY: number;
  faceExpr: FaceExpression;
  torsoVariant: TorsoVariant;
  frontHandVariant: HandVariant;
  backHandVariant: HandVariant;
  frontFootVariant: FootVariant;
  backFootVariant: FootVariant;
  head: SubLayerTransform;
  faceOffsetX: number;
  faceOffsetY: number;
  torso: SubLayerTransform;
  handFront: SubLayerTransform;
  handBack: SubLayerTransform;
  footFront: SubLayerTransform;
  footBack: SubLayerTransform;
  activeProp: 'none' | 'pickaxe' | 'placeCube' | 'fishingRod';
}

const INK = THEME.ink.outline; // #151b26 crisp pixel outline matching world blocks
const TEX = 2; // 2x2 logical pixels per texel (24x52 texel grid = crisp block-world pixel art)

const SKIN = {
  spec: '#fff3df',
  lit: '#fbd7b5',
  hi: '#f0be93',
  mid: '#e0a373',
  warm: '#c98655',
  shade: '#ad6b3d',
  deep: '#854b24',
};

const BACK_SKIN = {
  lit: '#e0a373',
  hi: '#c98655',
  mid: '#b37041',
  warm: '#99592e',
  shade: '#7d441f',
  deep: '#5e3013',
};

/**
 * Blocky texel buffer (TEX = 2) with rectilinear/chamfered box helpers
 * so shapes have crisp, structured pixel-art corners rather than overly round circles.
 */
function createTexelBuffer(gridW: number, gridH: number) {
  const cells: (string | null)[] = new Array(gridW * gridH).fill(null);

  const set = (x: number, y: number, col: string | null) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= gridW || iy < 0 || iy >= gridH) return;
    cells[iy * gridW + ix] = col;
  };

  const fill = (x: number, y: number, w: number, h: number, col: string | null) => {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const w0 = Math.round(w);
    const h0 = Math.round(h);
    for (let dy = 0; dy < h0; dy++) {
      for (let dx = 0; dx < w0; dx++) {
        set(x0 + dx, y0 + dy, col);
      }
    }
  };

  /**
   * Draws a structured pixel-art block with a 1-texel corner chamfer (not round!)
   * and crisp 1-texel dark ink border.
   */
  const chamferBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    baseCol: string,
    litCol: string,
    shadeCol: string,
    chamfer = 1
  ) => {
    // Outer ink silhouette with 1-texel stepped corner bevel
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cornerDist =
          (dx < chamfer && dy < chamfer && dx + dy < chamfer) ||
          (dx >= w - chamfer && dy < chamfer && (w - 1 - dx) + dy < chamfer) ||
          (dx < chamfer && dy >= h - chamfer && dx + (h - 1 - dy) < chamfer) ||
          (dx >= w - chamfer && dy >= h - chamfer && (w - 1 - dx) + (h - 1 - dy) < chamfer);
        if (!cornerDist) {
          set(x + dx, y + dy, INK);
        }
      }
    }
    // Inner skin fill + Planar top-left lighting & right/bottom planar shading
    for (let dy = 1; dy < h - 1; dy++) {
      for (let dx = 1; dx < w - 1; dx++) {
        const onOuter =
          (dx === 1 && dy === 1 && chamfer >= 1) ||
          (dx === w - 2 && dy === 1 && chamfer >= 1) ||
          (dx === 1 && dy === h - 2 && chamfer >= 1) ||
          (dx === w - 2 && dy === h - 2 && chamfer >= 1);
        if (onOuter) {
          set(x + dx, y + dy, INK);
          continue;
        }
        let col = baseCol;
        if (dy <= 2 || dx <= 2) col = litCol;
        if (dx >= w - 3 || dy >= h - 2) col = shadeCol;
        set(x + dx, y + dy, col);
      }
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

  return { set, fill, chamferBox, toCanvas };
}

/**
 * Builds the default naked player character on a crisp TEX=2 (24x52 texel) pixel-art grid:
 * - Chiseled, non-round 1-texel chamfered corners matching the block world aesthetic
 * - Stocky, broad-shouldered anatomical proportions (eliminating the elongated 'toothpick' look)
 * - Integrated shoulder and hip connection sockets so Hands, Torso, and Feet lock together seamlessly
 */
function buildDefaultNakedPartTextures(): CharacterPartTextures {
  // ============================================================================
  // 1. HEAD SUB-LAYER (20x18 texels = 40x36 px)
  // Structured, squared pixel-art head with 1-texel chamfered corners & ear block.
  // ============================================================================
  const headBuf = createTexelBuffer(20, 18);
  // Main cranium & jaw block (x = 1..19, y = 0..17, chamfer = 1 for crisp blocky corners)
  headBuf.chamferBox(1, 0, 18, 17, SKIN.mid, SKIN.lit, SKIN.warm, 1);
  // Top forehead & temple planar highlight
  headBuf.fill(3, 1, 12, 2, SKIN.spec);
  headBuf.fill(2, 2, 13, 3, SKIN.lit);
  headBuf.fill(2, 5, 4, 8, SKIN.hi);
  // Right cheek & lower jaw planar shadow
  headBuf.fill(16, 3, 2, 12, SKIN.warm);
  headBuf.fill(3, 15, 14, 1, SKIN.shade);
  // Squared pixel-art ear block on left side (x = 0..2, y = 7..12)
  headBuf.fill(0, 7, 3, 6, INK);
  headBuf.fill(1, 8, 2, 4, SKIN.warm);
  headBuf.set(1, 8, SKIN.lit);
  headBuf.set(1, 10, SKIN.deep);
  // Thick muscular neck base at bottom center (x = 6..14, y = 16..18)
  headBuf.fill(6, 16, 8, 2, INK);
  headBuf.fill(7, 16, 6, 2, SKIN.warm);
  headBuf.fill(7, 16, 3, 1, SKIN.mid);
  const head = headBuf.toCanvas();

  // ============================================================================
  // 2. FACE SUB-LAYER (14x9 texels = 28x18 px)
  // Crisp blocky pixel-art eyes, brows, nose step, and mouth.
  // ============================================================================
  const buildFace = (expr: FaceExpression): HTMLCanvasElement => {
    const f = createTexelBuffer(14, 9);
    const brow = SKIN.deep;

    if (expr === 'blink') {
      f.fill(2, 2, 4, 1, brow);
      f.fill(8, 2, 4, 1, brow);
      f.fill(2, 4, 4, 1, INK);
      f.fill(8, 4, 4, 1, INK);
      f.set(6, 5, SKIN.shade);
      f.fill(5, 7, 3, 1, SKIN.deep);
      return f.toCanvas();
    }

    // Brows
    if (expr === 'effort') {
      f.fill(2, 1, 2, 1, brow);
      f.fill(4, 2, 2, 1, brow);
      f.fill(8, 2, 2, 1, brow);
      f.fill(10, 1, 2, 1, brow);
    } else if (expr === 'jump' || expr === 'fall') {
      f.fill(2, 1, 4, 1, brow);
      f.fill(8, 1, 4, 1, brow);
    } else {
      f.fill(2, 2, 4, 1, brow);
      f.fill(8, 2, 4, 1, brow);
    }

    // Crisp 3x2 pixel-art eyes
    const eyeY = expr === 'jump' ? 2 : 3;
    const shiftX = expr === 'walk' || expr === 'focus' || expr === 'effort' ? 1 : 0;
    // Left eye
    f.fill(2, eyeY, 3, 2, '#ffffff');
    f.fill(3 + shiftX, eyeY, 2, 2, INK);
    f.set(3 + shiftX, eyeY, '#315285');
    // Right eye
    f.fill(8, eyeY, 3, 2, '#ffffff');
    f.fill(9 + shiftX, eyeY, 2, 2, INK);
    f.set(9 + shiftX, eyeY, '#315285');

    // Nose pixel step
    f.fill(6, 5, 2, 1, SKIN.shade);

    // Mouth
    if (expr === 'effort') {
      f.fill(4, 7, 5, 2, INK);
      f.fill(5, 7, 3, 1, '#ffffff');
    } else if (expr === 'fall') {
      f.fill(5, 7, 3, 2, INK);
    } else if (expr === 'land') {
      f.fill(4, 7, 5, 1, SKIN.deep);
    } else if (expr === 'focus') {
      f.fill(5, 7, 3, 1, INK);
    } else {
      f.fill(5, 7, 3, 1, SKIN.deep);
      f.set(8, 7, SKIN.shade);
    }
    return f.toCanvas();
  };

  // ============================================================================
  // 3. TORSO SUB-LAYER (16x19 texels = 32x38 px)
  // Broad, sturdy bare chest (16 texels = 32px wide) + thick waist & pelvis (14 texels = 28px wide)
  // with chiseled 1-texel chamfer corners and integrated shoulder/hip sockets.
  // ============================================================================
  const buildTorso = (variant: TorsoVariant): HTMLCanvasElement => {
    const t = createTexelBuffer(16, 19);
    const shift = variant === 'twist' ? 1 : 0;

    // 1) Muscular neck & trapezius bridge at top (x = 4..12, y = 0..2)
    t.fill(4, 0, 8, 3, INK);
    t.fill(5, 1, 6, 2, SKIN.hi);

    // 2) Broad squared upper chest & shoulder girdle (x = 0..16, y = 1..10, 32px wide!)
    t.chamferBox(0, 1, 16, 10, SKIN.mid, SKIN.lit, SKIN.warm, 1);

    // 3) Thick, sturdy ribcage, waist & pelvis block (x = 1..15, y = 9..19, 28px wide!)
    t.chamferBox(1, 9, 14, 10, SKIN.mid, SKIN.hi, SKIN.shade, 1);

    // Seamless interior merge between upper chest and lower torso/pelvis
    t.fill(2, 8, 12, 3, SKIN.mid);
    t.fill(2, 2, 11, 2, SKIN.lit);
    t.fill(3, 2, 5, 1, SKIN.spec);

    // Chiseled pectoral plates (squared pixel planes, not round)
    t.fill(2 + shift, 3, 5, 4, SKIN.lit);
    t.fill(8 + shift, 3, 5, 4, SKIN.hi);
    // Lower pectoral shadow line & sternum
    t.fill(2 + shift, 7, 5, 1, SKIN.warm);
    t.fill(8 + shift, 7, 5, 1, SKIN.shade);
    t.fill(7 + shift, 3, 1, 10, SKIN.warm);

    // Structured abdominal blocks
    t.fill(4 + shift, 9, 3, 2, SKIN.lit);
    t.fill(8 + shift, 9, 3, 2, SKIN.hi);
    t.fill(4 + shift, 11, 3, 1, SKIN.warm);
    t.fill(8 + shift, 11, 3, 1, SKIN.warm);
    t.fill(4 + shift, 12, 3, 2, SKIN.hi);
    t.fill(8 + shift, 12, 3, 2, SKIN.mid);

    // Navel & pelvis hip line
    t.set(7 + shift, 14, SKIN.deep);
    t.fill(2, 16, 12, 1, SKIN.warm);
    t.fill(3, 17, 10, 1, SKIN.shade);

    if (variant === 'stretch') {
      t.fill(3, 2, 10, 3, SKIN.lit);
    }
    return t.toCanvas();
  };

  // ============================================================================
  // 4. HANDS / ARMS SUB-LAYER (7x18 texels = 14x36 px)
  // Chunky 7-texel (14px) wide arm with a 1-texel chamfered shoulder block (pivotX = 7, pivotY = 5)
  // that overlaps and locks into the Torso's shoulder socket!
  // ============================================================================
  const buildHand = (front: boolean, variant: HandVariant): HTMLCanvasElement => {
    const pal = front ? SKIN : BACK_SKIN;
    const b = createTexelBuffer(8, 18);

    if (variant === 'strike') {
      // Extended muscular punch/swing arm + wider 8-texel blocky fist at bottom
      b.chamferBox(0, 0, 7, 13, pal.mid, pal.lit, pal.warm, 1);
      b.chamferBox(0, 11, 8, 7, pal.hi, pal.lit, pal.shade, 1);
      // Seamless elbow merge & knuckle highlight
      b.fill(1, 10, 5, 3, pal.mid);
      b.fill(2, 13, 5, 3, pal.lit);
      b.fill(5, 12, 2, 2, pal.warm); // thumb step
      return b.toCanvas();
    }

    if (variant === 'raise') {
      // Raised arm block
      b.chamferBox(0, 0, 7, 18, pal.mid, pal.lit, pal.warm, 1);
      b.fill(1, 13, 5, 4, pal.lit);
      return b.toCanvas();
    }

    if (variant === 'swing_fwd') {
      // Stepped forward-angled forearm & blocky hand
      b.chamferBox(0, 0, 7, 11, pal.mid, pal.lit, pal.warm, 1);
      b.chamferBox(1, 8, 7, 10, pal.hi, pal.lit, pal.shade, 1);
      b.fill(1, 7, 5, 3, pal.mid);
      b.fill(2, 13, 5, 3, pal.lit);
      return b.toCanvas();
    }

    if (variant === 'swing_back') {
      // Trailing stride arm
      b.chamferBox(1, 0, 7, 11, pal.mid, pal.hi, pal.warm, 1);
      b.chamferBox(0, 8, 7, 10, pal.mid, pal.hi, pal.shade, 1);
      b.fill(1, 7, 5, 3, pal.mid);
      return b.toCanvas();
    }

    // 'rest': Sturdy 7x18 texel (14x36 px) chiseled shoulder, bicep, forearm, and hand
    b.chamferBox(0, 0, 7, 18, pal.mid, pal.lit, pal.warm, 1);
    // Deltoid shoulder highlight at top (connects into Torso shoulder)
    if (front) {
      b.fill(1, 1, 4, 4, SKIN.spec);
      b.fill(1, 5, 4, 4, SKIN.lit);
    }
    // Elbow crease & blocky hand / fingers at bottom (y = 13..16)
    b.fill(2, 9, 3, 1, pal.warm);
    b.fill(1, 13, 5, 3, pal.lit);
    b.fill(2, 16, 4, 1, pal.shade);
    return b.toCanvas();
  };

  // ============================================================================
  // 5. FEET / LEGS SUB-LAYER (9x18 texels = 18x36 px)
  // Chunky 7-texel (14px) wide leg overlapping the pelvis hip socket + 9-texel (18px)
  // flat-soled blocky bare foot planted flush at y = 0 (bottom border 105px).
  // ============================================================================
  const buildFoot = (front: boolean, variant: FootVariant): HTMLCanvasElement => {
    const pal = front ? SKIN : BACK_SKIN;
    const b = createTexelBuffer(9, 18);

    if (variant === 'jump_tuck') {
      b.chamferBox(0, 0, 7, 11, pal.mid, pal.lit, pal.warm, 1);
      b.chamferBox(1, 8, 8, 8, pal.hi, pal.lit, pal.shade, 1);
      b.fill(1, 7, 5, 3, pal.mid);
      return b.toCanvas();
    }

    if (variant === 'land_crouch') {
      b.chamferBox(0, 2, 7, 12, pal.mid, pal.lit, pal.warm, 1);
      b.chamferBox(0, 12, 9, 6, pal.hi, pal.lit, pal.shade, 1);
      b.fill(1, 11, 5, 3, pal.mid);
      b.fill(1, 16, 7, 1, pal.shade);
      return b.toCanvas();
    }

    if (variant === 'stride_fwd') {
      b.chamferBox(0, 0, 7, 13, pal.mid, pal.lit, pal.warm, 1);
      b.chamferBox(1, 12, 8, 6, pal.hi, pal.lit, pal.shade, 1);
      b.fill(1, 11, 5, 3, pal.mid);
      b.fill(2, 16, 6, 1, pal.shade);
      return b.toCanvas();
    }

    if (variant === 'stride_back') {
      b.chamferBox(1, 0, 7, 13, pal.mid, pal.hi, pal.warm, 1);
      b.chamferBox(0, 12, 8, 6, pal.mid, pal.hi, pal.shade, 1);
      b.fill(1, 11, 5, 3, pal.mid);
      b.fill(1, 16, 6, 1, pal.shade);
      return b.toCanvas();
    }

    // 'stand': Sturdy 7-texel thigh & calf + 9-texel (18px) flat bare foot flush at bottom
    b.chamferBox(0, 0, 7, 14, pal.mid, pal.lit, pal.warm, 1);
    b.chamferBox(0, 12, 9, 6, pal.hi, pal.lit, pal.shade, 1);
    // Seamless ankle merge, knee highlight, and flat foot sole
    b.fill(1, 11, 5, 3, pal.mid);
    b.fill(2, 7, 3, 2, pal.lit);
    b.fill(2, 9, 3, 1, pal.warm);
    b.fill(2, 13, 6, 2, pal.lit);
    b.fill(1, 16, 7, 1, pal.shade);
    return b.toCanvas();
  };

  // ============================================================================
  // Held Action Props (Pickaxe, Block Cube, Fishing Rod) on TEX=2 grid
  // ============================================================================
  const buildPickaxe = (): HTMLCanvasElement => {
    const p = createTexelBuffer(12, 12);
    for (let i = 0; i < 8; i++) {
      p.fill(1 + i, 9 - i, 3, 3, INK);
      p.set(2 + i, 10 - i, '#c98552');
    }
    p.chamferBox(5, 0, 7, 5, THEME.metal.steelMid, THEME.metal.steelLit, THEME.stone.shadow, 1);
    return p.toCanvas();
  };

  const buildPlaceCube = (): HTMLCanvasElement => {
    const c = createTexelBuffer(8, 8);
    c.chamferBox(0, 0, 8, 8, THEME.wood.mid, THEME.wood.highlight, THEME.wood.deep, 1);
    return c.toCanvas();
  };

  const buildFishingRod = (): HTMLCanvasElement => {
    const r = createTexelBuffer(12, 12);
    for (let i = 0; i < 10; i++) {
      r.fill(1 + i, 10 - i, 2, 2, INK);
      r.set(1 + i, 10 - i, i >= 8 ? '#ff6255' : '#e0a960');
    }
    return r.toCanvas();
  };

  return {
    head,
    faces: {
      neutral: buildFace('neutral'),
      blink: buildFace('blink'),
      walk: buildFace('walk'),
      jump: buildFace('jump'),
      fall: buildFace('fall'),
      land: buildFace('land'),
      effort: buildFace('effort'),
      focus: buildFace('focus'),
    },
    torsos: {
      neutral: buildTorso('neutral'),
      twist: buildTorso('twist'),
      stretch: buildTorso('stretch'),
    },
    handsFront: {
      rest: buildHand(true, 'rest'),
      swing_fwd: buildHand(true, 'swing_fwd'),
      swing_back: buildHand(true, 'swing_back'),
      strike: buildHand(true, 'strike'),
      raise: buildHand(true, 'raise'),
    },
    handsBack: {
      rest: buildHand(false, 'rest'),
      swing_fwd: buildHand(false, 'swing_fwd'),
      swing_back: buildHand(false, 'swing_back'),
      strike: buildHand(false, 'strike'),
      raise: buildHand(false, 'raise'),
    },
    feetFront: {
      stand: buildFoot(true, 'stand'),
      stride_fwd: buildFoot(true, 'stride_fwd'),
      stride_back: buildFoot(true, 'stride_back'),
      jump_tuck: buildFoot(true, 'jump_tuck'),
      land_crouch: buildFoot(true, 'land_crouch'),
    },
    feetBack: {
      stand: buildFoot(false, 'stand'),
      stride_fwd: buildFoot(false, 'stride_fwd'),
      stride_back: buildFoot(false, 'stride_back'),
      jump_tuck: buildFoot(false, 'jump_tuck'),
      land_crouch: buildFoot(false, 'land_crouch'),
    },
    pickaxe: buildPickaxe(),
    placeCube: buildPlaceCube(),
    fishingRod: buildFishingRod(),
  };
}

let cachedDefaultParts: CharacterPartTextures | null = null;

export function getCharacterPartTextures(_shirtColor?: string): CharacterPartTextures {
  if (!cachedDefaultParts) {
    cachedDefaultParts = buildDefaultNakedPartTextures();
  }
  return cachedDefaultParts;
}

/**
 * Computes decoupled sub-layer transforms and texture variants for Head, Face, Torso, Hands, and Feet.
 * - Broad-shouldered, stocky proportions: Torso spans [-16..+16] (32px), and the 14px-wide Hands
 *   connect at the left and right shoulder sockets (x = -13 and +13, pivot = 7, 5), overlapping
 *   the Torso by 4px while extending outward to [-20..+20] so the upper body looks solid and connected.
 * - Full directional animation range for both breaking and placing toward (aimX, aimY).
 */
export function computeModularPlayerRig(
  drawX: number,
  drawY: number,
  params: CharacterAnimParams
): ModularPlayerRigState {
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
    placeProgress = 0.5,
    actionKind = 'punch',
    aimX,
    aimY,
    landing = false,
    fishingState = 'none',
  } = params;

  const isWalking = grounded && Math.abs(vx) > 15 && !punching && !placing;
  const speedRatio = isWalking ? Math.min(1, Math.abs(vx) / 225) : 0;
  const walkTheta = (walkPhase / 8) * Math.PI * 2;

  const blinkMod = nowMs % 3600;
  const isBlinking = !punching && !placing && grounded && !isWalking && blinkMod > 3450;

  let faceExpr: FaceExpression = 'neutral';
  if (punching || fishingState === 'reel') faceExpr = 'effort';
  else if (placing || fishingState === 'hold') faceExpr = 'focus';
  else if (!grounded) faceExpr = vy < 0 ? 'jump' : 'fall';
  else if (landing) faceExpr = 'land';
  else if (isWalking) faceExpr = 'walk';
  else if (isBlinking) faceExpr = 'blink';

  let torsoVariant: TorsoVariant = 'neutral';
  let frontHandVariant: HandVariant = 'rest';
  let backHandVariant: HandVariant = 'rest';
  let frontFootVariant: FootVariant = 'stand';
  let backFootVariant: FootVariant = 'stand';

  let scaleX = 1;
  let scaleY = 1;

  const breath = Math.sin(nowMs * 0.0036);
  let torsoBobY = grounded && !isWalking && !landing ? breath * 1.0 : 0;
  let torsoAngle = 0;
  let headAngle = 0;
  let headLagX = 0;
  let headBobY = grounded && !isWalking && !landing ? Math.sin(nowMs * 0.0036 - 0.45) * 0.8 : 0;

  // Shoulder sockets on the lateral edges of the 32px-wide Torso (x = -16..+16).
  // Anchoring the 14px-wide Hand module (pivotX = 7, pivotY = 5) at x = -12 (front) and x = +12 (back)
  // makes the inner 3px of each shoulder overlap directly onto the Torso's shoulder block while
  // giving a broad 38px shoulder-to-shoulder silhouette!
  const baseShoulderY = -63 + torsoBobY * 0.9;
  let frontHandX = -12;
  let frontHandY = baseShoulderY;
  let frontHandAngle = -0.04 - breath * 0.03;

  let backHandX = 12;
  let backHandY = baseShoulderY;
  let backHandAngle = 0.04 + breath * 0.03;

  // Hip sockets overlapping into the bottom of the 28px-wide Pelvis (y = -32)
  let frontFootX = -6;
  let frontFootY = -31;
  let frontFootAngle = 0;

  let backFootX = 6;
  let backFootY = -31;
  let backFootAngle = 0;

  if (isWalking) {
    const stride = Math.sin(walkTheta);
    const liftFront = Math.max(0, Math.cos(walkTheta));
    const liftBack = Math.max(0, -Math.cos(walkTheta));

    torsoBobY = -Math.abs(Math.cos(walkTheta)) * 2.8 * speedRatio;
    torsoAngle = 0.065 * speedRatio;
    torsoVariant = Math.abs(stride) > 0.55 ? 'twist' : 'neutral';

    headAngle = -0.025 * speedRatio;
    headLagX = -1.0 * speedRatio;
    headBobY = Math.sin(walkTheta * 2 - 0.4) * 1.1 * speedRatio;

    // Feet elliptical stride connected at hip sockets
    frontFootX = -5 + stride * 9.0 * speedRatio;
    frontFootY = -31 - liftFront * 5.0 * speedRatio;
    frontFootAngle = -stride * 0.3 * speedRatio;
    frontFootVariant =
      stride > 0.3 ? 'stride_fwd' : stride < -0.3 ? 'stride_back' : 'stand';

    backFootX = 5 - stride * 9.0 * speedRatio;
    backFootY = -31 - liftBack * 5.0 * speedRatio;
    backFootAngle = stride * 0.3 * speedRatio;
    backFootVariant =
      -stride > 0.3 ? 'stride_fwd' : -stride < -0.3 ? 'stride_back' : 'stand';

    // Opposing arm pendulums rotating from the overlapping shoulder sockets
    frontHandX = -11 - stride * 2.5 * speedRatio;
    frontHandY = -63 + torsoBobY;
    frontHandAngle = stride * 0.55 * speedRatio;
    frontHandVariant =
      stride < -0.25 ? 'swing_fwd' : stride > 0.25 ? 'swing_back' : 'rest';

    backHandX = 11 + stride * 2.5 * speedRatio;
    backHandY = -63 + torsoBobY;
    backHandAngle = -stride * 0.52 * speedRatio;
    backHandVariant =
      stride > 0.25 ? 'swing_fwd' : stride < -0.25 ? 'swing_back' : 'rest';
  } else if (!grounded) {
    if (vy < 0) {
      torsoVariant = 'stretch';
      frontHandVariant = 'raise';
      backHandVariant = 'raise';
      frontFootVariant = 'jump_tuck';
      backFootVariant = 'stride_back';

      torsoBobY = -2;
      torsoAngle = -0.04;
      headAngle = -0.05;
      frontHandX = -12;
      backHandX = 12;
      frontHandY = -64;
      backHandY = -64;
      frontHandAngle = -0.82;
      backHandAngle = -0.92;
      frontFootX = -6;
      backFootX = 6;
      frontFootY = -33;
      backFootY = -32;
      frontFootAngle = 0.18;
      backFootAngle = -0.15;
    } else {
      torsoVariant = 'neutral';
      frontHandVariant = 'raise';
      backHandVariant = 'swing_back';
      frontFootVariant = 'stride_fwd';
      backFootVariant = 'jump_tuck';

      torsoBobY = -1;
      torsoAngle = 0.05;
      headAngle = 0.05;
      frontHandX = -12;
      backHandX = 12;
      frontHandY = -63;
      backHandY = -63;
      frontHandAngle = -1.08;
      backHandAngle = 0.65;
      frontFootX = -7;
      backFootX = 7;
      frontFootY = -32;
      backFootY = -33;
      frontFootAngle = -0.16;
      backFootAngle = 0.2;
    }
  } else if (landing) {
    scaleX = 1.04;
    scaleY = 0.95;
    torsoVariant = 'twist';
    frontFootVariant = 'land_crouch';
    backFootVariant = 'land_crouch';
    frontHandVariant = 'swing_fwd';
    backHandVariant = 'swing_back';

    torsoBobY = 3.0;
    headBobY = 2.0;
    frontFootX = -7;
    backFootX = 7;
    frontHandY = -60;
    backHandY = -60;
    frontHandAngle = 0.3;
    backHandAngle = -0.3;
  }

  // Directional pitch in local rig space (+X is forward toward facing, +Y is downward)
  const hasAim =
    typeof aimX === 'number' &&
    typeof aimY === 'number' &&
    (Math.abs(aimX) > 0.01 || Math.abs(aimY) > 0.01);
  const localAimX = hasAim ? Math.max(4, Math.abs(aimX!)) : 48;
  const localAimY = hasAim ? aimY! : 0;
  const aimPitch = Math.max(
    -Math.PI * 0.48,
    Math.min(Math.PI * 0.48, Math.atan2(localAimY, localAimX))
  );
  const aimedArmAngle = -Math.PI * 0.5 + aimPitch;
  const aimDirCos = Math.cos(aimPitch);
  const aimDirSin = Math.sin(aimPitch);

  if (punching) {
    const p = Math.max(0, Math.min(1, punchProgress));
    torsoVariant = 'twist';
    frontHandVariant = actionKind === 'mine' && p < 0.28 ? 'raise' : 'strike';
    backHandVariant = 'swing_back';
    if (grounded && !isWalking) {
      frontFootVariant = 'stride_fwd';
      backFootVariant = 'stride_back';
      frontFootX = -7;
      backFootX = 7;
    }

    if (p < 0.22) {
      const t = p / 0.22;
      torsoAngle = (-0.12 + aimPitch * 0.12) * t;
      headAngle = (-0.04 + aimPitch * 0.24) * t;
      frontHandX = -11 - 2 * t;
      frontHandY = -63 + torsoBobY;
      const windupTarget = actionKind === 'mine' ? aimedArmAngle - 0.95 : aimedArmAngle + 0.65;
      frontHandAngle = windupTarget * t;
      backHandAngle = (0.42 - aimPitch * 0.2) * t;
    } else if (p < 0.68) {
      const t = (p - 0.22) / 0.46;
      const drive = Math.sin(t * Math.PI * 0.5);
      torsoAngle = -0.12 + (0.24 + aimPitch * 0.18) * drive;
      headAngle = aimPitch * 0.26 * drive;
      frontHandX = -10 + aimDirCos * 5.0 * drive;
      frontHandY = -63 + torsoBobY + aimDirSin * 4.5 * drive;
      if (actionKind === 'mine') {
        const startAng = aimedArmAngle - 0.95;
        const endAng = aimedArmAngle + 0.38;
        frontHandAngle = startAng + (endAng - startAng) * drive;
      } else {
        const startAng = aimedArmAngle + 0.55;
        frontHandAngle = startAng + (aimedArmAngle - startAng) * drive;
      }
      backHandAngle = 0.48 * drive - aimPitch * 0.18;
    } else {
      const t = (p - 0.68) / 0.32;
      const relax = 1 - t;
      torsoAngle = (0.12 + aimPitch * 0.15) * relax;
      headAngle = aimPitch * 0.22 * relax;
      frontHandX = -10 + aimDirCos * 4.0 * relax;
      frontHandY = -63 + torsoBobY + aimDirSin * 3.5 * relax;
      frontHandAngle = aimedArmAngle * relax;
      backHandAngle = 0.45 * relax;
    }
  } else if (placing) {
    const pp = Math.max(0, Math.min(1, placeProgress));
    const reachCurve = Math.sin(pp * Math.PI);
    const blend = Math.max(0.35, reachCurve);
    torsoVariant = 'twist';
    frontHandVariant = 'strike';
    backHandVariant = 'swing_back';
    torsoAngle = (0.08 + aimPitch * 0.16) * blend;
    headAngle = aimPitch * 0.26 * blend;
    frontHandX = -10 + aimDirCos * 4.5 * blend;
    frontHandY = -63 + torsoBobY + aimDirSin * 4.0 * blend;
    frontHandAngle = aimedArmAngle * blend;
    backHandAngle = 0.35 * blend;
  } else if (fishingState === 'hold') {
    frontHandVariant = 'swing_fwd';
    torsoAngle = -0.04;
    frontHandX = -10;
    frontHandY = -63 + torsoBobY;
    frontHandAngle = -0.95;
  } else if (fishingState === 'reel') {
    torsoVariant = 'twist';
    frontHandVariant = 'raise';
    torsoAngle = -0.15;
    headAngle = -0.06;
    frontHandX = -10;
    frontHandY = -63 + torsoBobY;
    frontHandAngle = -1.25 - Math.sin(nowMs * 0.025) * 0.16;
  }

  let activeProp: ModularPlayerRigState['activeProp'] = 'none';
  if (punching && actionKind === 'mine') activeProp = 'pickaxe';
  else if (placing) activeProp = 'placeCube';
  else if (fishingState !== 'none') activeProp = 'fishingRod';

  const centerX = drawX + PLAYER_LOGICAL_W * 0.5;
  const groundBottomY = drawY + PLAYER_LOGICAL_H;
  const hipY = -32 + torsoBobY;
  const neckY = -69 + torsoBobY + headBobY;

  return {
    centerX,
    groundBottomY,
    topBoxY: drawY,
    facing,
    scaleX,
    scaleY,
    faceExpr,
    torsoVariant,
    frontHandVariant,
    backHandVariant,
    frontFootVariant,
    backFootVariant,
    head: {
      x: headLagX,
      y: neckY,
      pivotX: 20,
      pivotY: 36,
      angleRad: headAngle,
    },
    faceOffsetX: -12,
    faceOffsetY: -24,
    torso: {
      x: 0,
      y: hipY,
      pivotX: 16,
      pivotY: 38,
      angleRad: torsoAngle,
    },
    handBack: {
      x: backHandX,
      y: backHandY,
      pivotX: 7,
      pivotY: 5,
      angleRad: backHandAngle,
    },
    handFront: {
      x: frontHandX,
      y: frontHandY,
      pivotX: 7,
      pivotY: 5,
      angleRad: frontHandAngle,
    },
    footBack: {
      x: backFootX,
      y: backFootY,
      pivotX: 7,
      pivotY: 5,
      angleRad: backFootAngle,
    },
    footFront: {
      x: frontFootX,
      y: frontFootY,
      pivotX: 7,
      pivotY: 5,
      angleRad: frontFootAngle,
    },
    activeProp,
  };
}

export function drawSubLayerPart(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  transform: SubLayerTransform
) {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  if (Math.abs(transform.angleRad) > 0.002) {
    ctx.rotate(transform.angleRad);
  }
  ctx.drawImage(img, Math.round(-transform.pivotX), Math.round(-transform.pivotY));
  ctx.restore();
}

export function drawModularCharacter(
  ctx: CanvasRenderingContext2D,
  drawX: number,
  drawY: number,
  params: CharacterAnimParams
): number {
  const parts = getCharacterPartTextures(params.shirtColor);
  const rig = computeModularPlayerRig(drawX, drawY, params);

  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(rig.centerX, rig.groundBottomY);
  ctx.scale(rig.facing * rig.scaleX, rig.scaleY);

  // 1. Back Hand Sub-Layer (connected to back shoulder socket)
  drawSubLayerPart(ctx, parts.handsBack[rig.backHandVariant], rig.handBack);

  // 2. Feet Sub-Layer (Back Foot then Front Foot connected to hip sockets)
  drawSubLayerPart(ctx, parts.feetBack[rig.backFootVariant], rig.footBack);
  drawSubLayerPart(ctx, parts.feetFront[rig.frontFootVariant], rig.footFront);

  // 3. Torso Sub-Layer
  drawSubLayerPart(ctx, parts.torsos[rig.torsoVariant], rig.torso);

  // 4. Head Sub-Layer
  drawSubLayerPart(ctx, parts.head, rig.head);

  // 5. Face Sub-Layer (decoupled expression anchored to Head transform)
  ctx.save();
  ctx.translate(rig.head.x, rig.head.y);
  if (Math.abs(rig.head.angleRad) > 0.002) {
    ctx.rotate(rig.head.angleRad);
  }
  ctx.drawImage(
    parts.faces[rig.faceExpr],
    Math.round(rig.faceOffsetX),
    Math.round(rig.faceOffsetY)
  );
  ctx.restore();

  // 6. Front Hand Sub-Layer (overlapping & connected to front shoulder socket + Held Action Prop)
  ctx.save();
  ctx.translate(rig.handFront.x, rig.handFront.y);
  if (Math.abs(rig.handFront.angleRad) > 0.002) {
    ctx.rotate(rig.handFront.angleRad);
  }
  ctx.drawImage(
    parts.handsFront[rig.frontHandVariant],
    Math.round(-rig.handFront.pivotX),
    Math.round(-rig.handFront.pivotY)
  );
  if (rig.activeProp === 'pickaxe') {
    ctx.drawImage(parts.pickaxe, -2, 16);
  } else if (rig.activeProp === 'placeCube') {
    ctx.drawImage(parts.placeCube, -3, 20);
  } else if (rig.activeProp === 'fishingRod') {
    ctx.drawImage(parts.fishingRod, -2, 12);
  }
  ctx.restore();

  ctx.restore();
  ctx.imageSmoothingEnabled = prevSmoothing;
  return rig.topBoxY;
}

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
    nowMs: pose === 'idle7' ? 3500 : 400,
    punchProgress: isPunch || isMine ? Math.min(0.95, idx / 3.2) : 0,
    placeProgress: pose === 'place' ? 0.5 : 0,
    actionKind: isMine ? 'mine' : 'punch',
    landing: pose === 'land',
    fishingState:
      pose === 'fish_reel' ? 'reel' : pose === 'fish_hold' || pose === 'fish_cast' ? 'hold' : 'none',
  });
  return c;
}

export const drawPlayerSpriteHD = renderHighDefPlayerSprite;
