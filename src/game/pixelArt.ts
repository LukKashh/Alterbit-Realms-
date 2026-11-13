import { CATALOG, ITEM_IDS } from './catalog.ts';

export type PlayerPose = 'idle' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'jump' | 'fall' | 'punch';

export interface EquippedWearables {
  head?: number;
  face?: number;
  back?: number;
}

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

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawTile16(itemId: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(16, 16);
  const def = CATALOG[itemId];
  if (!def) return c;

  switch (itemId) {
    case ITEM_IDS.BEDROCK: {
      px(ctx, 0, 0, '#1c1f29', 16, 16);
      px(ctx, 0, 0, '#2c3140', 16, 2);
      for (let i = 0; i < 16; i += 4) {
        px(ctx, i, 4, '#272b38', 3, 3);
        px(ctx, (i + 2) % 16, 10, '#12141b', 3, 4);
        px(ctx, (i + 1) % 16, 6, '#434a5e', 1, 1);
      }
      break;
    }
    case ITEM_IDS.MEADOW_TURF: {
      px(ctx, 0, 4, '#7d5133', 16, 12);
      px(ctx, 2, 7, '#5c3922', 2, 2);
      px(ctx, 10, 9, '#5c3922', 3, 2);
      px(ctx, 5, 12, '#996745', 2, 2);
      px(ctx, 0, 0, '#4aa64d', 16, 5);
      px(ctx, 0, 0, '#7de063', 16, 2);
      px(ctx, 1, 5, '#3b873e', 2, 2);
      px(ctx, 6, 5, '#3b873e', 3, 1);
      px(ctx, 11, 5, '#3b873e', 2, 2);
      px(ctx, 3, 1, '#a9f589', 2, 1);
      px(ctx, 11, 1, '#a9f589', 3, 1);
      break;
    }
    case ITEM_IDS.RICH_SOIL: {
      px(ctx, 0, 0, '#7d5133', 16, 16);
      px(ctx, 0, 0, '#8f603e', 16, 1);
      px(ctx, 2, 3, '#5c3922', 3, 2);
      px(ctx, 11, 5, '#5c3922', 2, 3);
      px(ctx, 6, 10, '#5c3922', 4, 2);
      px(ctx, 3, 12, '#9e6b48', 2, 2);
      px(ctx, 12, 12, '#9e6b48', 2, 1);
      break;
    }
    case ITEM_IDS.GRANITE_STONE: {
      px(ctx, 0, 0, '#6a7482', 16, 16);
      px(ctx, 0, 0, '#8d98a8', 16, 1);
      px(ctx, 0, 0, '#8d98a8', 1, 16);
      px(ctx, 0, 15, '#464e59', 16, 1);
      px(ctx, 15, 0, '#464e59', 16, 16);
      px(ctx, 3, 3, '#525b69', 5, 3);
      px(ctx, 10, 8, '#525b69', 4, 4);
      px(ctx, 2, 10, '#8792a3', 3, 2);
      break;
    }
    case ITEM_IDS.BASALT: {
      px(ctx, 0, 0, '#3a3e4d', 16, 16);
      px(ctx, 0, 0, '#52576b', 16, 1);
      px(ctx, 2, 2, '#272a36', 4, 5);
      px(ctx, 9, 4, '#272a36', 5, 4);
      px(ctx, 4, 10, '#4f5569', 6, 3);
      break;
    }
    case ITEM_IDS.CRYSTAL_VEIN: {
      px(ctx, 0, 0, '#455163', 16, 16);
      px(ctx, 2, 2, '#303947', 12, 12);
      px(ctx, 3, 4, '#1eb8ba', 4, 7);
      px(ctx, 4, 3, '#7ef9f2', 2, 6);
      px(ctx, 9, 6, '#1eb8ba', 4, 6);
      px(ctx, 10, 5, '#7ef9f2', 2, 4);
      px(ctx, 6, 11, '#4ce6e3', 3, 3);
      break;
    }
    case ITEM_IDS.MAGMA_ROCK: {
      px(ctx, 0, 0, '#2e1e21', 16, 16);
      px(ctx, 2, 2, '#452829', 5, 4);
      px(ctx, 9, 8, '#452829', 5, 5);
      px(ctx, 1, 7, '#d9481c', 14, 2);
      px(ctx, 6, 1, '#d9481c', 2, 14);
      px(ctx, 3, 7, '#ffaa3b', 4, 1);
      px(ctx, 6, 4, '#ffaa3b', 1, 5);
      break;
    }
    case ITEM_IDS.TIMBER_PLANK: {
      px(ctx, 0, 0, '#b57743', 16, 16);
      for (let y = 0; y < 16; y += 4) {
        px(ctx, 0, y, '#cf9057', 16, 1);
        px(ctx, 0, y + 3, '#6e4220', 16, 1);
      }
      px(ctx, 7, 0, '#6e4220', 1, 4);
      px(ctx, 3, 4, '#6e4220', 1, 4);
      px(ctx, 11, 8, '#6e4220', 1, 4);
      px(ctx, 6, 12, '#6e4220', 1, 4);
      break;
    }
    case ITEM_IDS.COBBLE_BRICK: {
      px(ctx, 0, 0, '#543531', 16, 16);
      const drawBrick = (bx: number, by: number, bw: number, bh: number) => {
        px(ctx, bx, by, '#946156', bw, bh);
        px(ctx, bx, by, '#b57c70', bw, 1);
        px(ctx, bx, by + bh - 1, '#6b423a', bw, 1);
      };
      drawBrick(0, 0, 7, 4);
      drawBrick(8, 0, 8, 4);
      drawBrick(0, 5, 3, 5);
      drawBrick(4, 5, 8, 5);
      drawBrick(13, 5, 3, 5);
      drawBrick(0, 11, 7, 5);
      drawBrick(8, 11, 8, 5);
      break;
    }
    case ITEM_IDS.SUNLIT_GLASS: {
      px(ctx, 0, 0, '#4d92b5', 16, 16);
      px(ctx, 1, 1, '#9be0fa', 14, 14);
      px(ctx, 2, 2, '#c7f1ff', 12, 12);
      px(ctx, 3, 3, '#ffffff', 4, 1);
      px(ctx, 3, 4, '#ffffff', 2, 3);
      px(ctx, 10, 10, '#ffffff', 2, 2);
      break;
    }
    case ITEM_IDS.CLOUD_PLATFORM: {
      px(ctx, 0, 0, '#c79256', 16, 5);
      px(ctx, 0, 0, '#f2c185', 16, 2);
      px(ctx, 0, 4, '#6b4523', 16, 2);
      px(ctx, 2, 6, '#573619', 2, 4);
      px(ctx, 12, 6, '#573619', 2, 4);
      break;
    }
    case ITEM_IDS.OAK_TRUNK: {
      px(ctx, 4, 0, '#6d4428', 8, 16);
      px(ctx, 5, 0, '#8c5a37', 2, 16);
      px(ctx, 10, 0, '#4a2b17', 2, 16);
      px(ctx, 6, 4, '#4a2b17', 2, 4);
      px(ctx, 8, 10, '#4a2b17', 2, 4);
      break;
    }
    case ITEM_IDS.MEADOW_LEAVES: {
      px(ctx, 1, 1, '#27632d', 14, 14);
      px(ctx, 0, 3, '#3f9147', 16, 10);
      px(ctx, 2, 0, '#3f9147', 12, 15);
      px(ctx, 3, 2, '#73cc68', 4, 4);
      px(ctx, 9, 4, '#73cc68', 4, 3);
      px(ctx, 5, 9, '#5db853', 5, 3);
      break;
    }
    case ITEM_IDS.RUBY_BLOCK: {
      px(ctx, 0, 0, '#7a1924', 16, 16);
      px(ctx, 1, 1, '#d9384a', 14, 14);
      px(ctx, 2, 2, '#ff6e7e', 12, 2);
      px(ctx, 2, 2, '#ff6e7e', 2, 12);
      px(ctx, 4, 4, '#a62131', 8, 8);
      px(ctx, 5, 5, '#ff96a3', 4, 4);
      break;
    }
    case ITEM_IDS.GOLD_BRICK: {
      px(ctx, 0, 0, '#8c5a08', 16, 16);
      px(ctx, 1, 1, '#f2b738', 14, 6);
      px(ctx, 1, 2, '#fff0a6', 12, 2);
      px(ctx, 1, 9, '#f2b738', 6, 6);
      px(ctx, 8, 9, '#f2b738', 7, 6);
      px(ctx, 2, 10, '#fff0a6', 4, 2);
      px(ctx, 9, 10, '#fff0a6', 5, 2);
      break;
    }
    case ITEM_IDS.LANTERN_LIGHT: {
      px(ctx, 7, 0, '#382e24', 2, 3);
      px(ctx, 4, 3, '#5c4b3b', 8, 2);
      px(ctx, 5, 5, '#ffcf54', 6, 8);
      px(ctx, 6, 6, '#fff8d6', 4, 6);
      px(ctx, 4, 13, '#5c4b3b', 8, 2);
      break;
    }
    case ITEM_IDS.ENTRANCE_PORTAL: {
      px(ctx, 2, 1, '#5e564a', 12, 15);
      px(ctx, 1, 3, '#7d7364', 14, 13);
      px(ctx, 4, 3, '#1e3547', 8, 13);
      px(ctx, 5, 4, '#38b5db', 6, 11);
      px(ctx, 6, 5, '#a6f3ff', 4, 8);
      px(ctx, 7, 1, '#f2c75c', 2, 2);
      break;
    }
    case ITEM_IDS.WORLD_LOCK: {
      px(ctx, 0, 0, '#8f5f14', 16, 16);
      px(ctx, 1, 1, '#f2b738', 14, 14);
      px(ctx, 2, 2, '#ffd966', 12, 3);
      px(ctx, 6, 5, '#4f3206', 4, 4);
      px(ctx, 7, 9, '#4f3206', 2, 4);
      break;
    }
    case ITEM_IDS.SMALL_LOCK: {
      px(ctx, 1, 1, '#1e523a', 14, 14);
      px(ctx, 2, 2, '#52b888', 12, 12);
      px(ctx, 3, 3, '#a8f5d0', 10, 2);
      px(ctx, 6, 6, '#133826', 4, 4);
      px(ctx, 7, 10, '#133826', 2, 3);
      break;
    }
    case ITEM_IDS.VENDING_MACHINE: {
      px(ctx, 1, 0, '#1c4166', 14, 16);
      px(ctx, 2, 1, '#3b82c4', 12, 14);
      // Display glass window
      px(ctx, 3, 2, '#a6f0ff', 7, 7);
      px(ctx, 4, 3, '#ffffff', 3, 2);
      // Coin slot & dispenser
      px(ctx, 11, 3, '#f2b738', 2, 3);
      px(ctx, 11, 7, '#52b888', 2, 2);
      px(ctx, 3, 11, '#0f253d', 10, 3);
      break;
    }
    case ITEM_IDS.SIGN_POST: {
      px(ctx, 7, 9, '#5c3922', 2, 7);
      px(ctx, 1, 2, '#734a22', 14, 8);
      px(ctx, 2, 3, '#c48a4f', 12, 6);
      px(ctx, 3, 4, '#f2cfa7', 8, 1);
      px(ctx, 3, 6, '#f2cfa7', 10, 1);
      break;
    }
    case ITEM_IDS.BG_SOIL_WALL: {
      px(ctx, 0, 0, '#473021', 16, 16);
      px(ctx, 2, 3, '#362216', 4, 3);
      px(ctx, 10, 9, '#362216', 4, 4);
      px(ctx, 5, 11, '#593d2b', 3, 2);
      break;
    }
    case ITEM_IDS.BG_STONE_WALL: {
      px(ctx, 0, 0, '#353b47', 16, 16);
      px(ctx, 1, 2, '#282c36', 6, 4);
      px(ctx, 9, 7, '#282c36', 5, 5);
      px(ctx, 3, 10, '#454c5c', 4, 3);
      break;
    }
    case ITEM_IDS.BG_TIMBER_WALL: {
      px(ctx, 0, 0, '#694326', 16, 16);
      for (let x = 0; x < 16; x += 4) {
        px(ctx, x, 0, '#4a2e18', 1, 16);
        px(ctx, x + 1, 0, '#7d5231', 1, 16);
      }
      break;
    }
    case ITEM_IDS.BG_BRICK_WALL: {
      px(ctx, 0, 0, '#3d2522', 16, 16);
      px(ctx, 0, 0, '#5e3c37', 7, 7);
      px(ctx, 8, 0, '#5e3c37', 8, 7);
      px(ctx, 0, 8, '#5e3c37', 4, 8);
      px(ctx, 5, 8, '#5e3c37', 11, 8);
      break;
    }
    case ITEM_IDS.FIST: {
      px(ctx, 4, 5, '#c9824f', 8, 7);
      px(ctx, 5, 4, '#f2b880', 7, 6);
      px(ctx, 4, 9, '#f2b880', 4, 3);
      px(ctx, 6, 5, '#ffe2c2', 4, 2);
      break;
    }
    case ITEM_IDS.WRENCH: {
      px(ctx, 3, 10, '#586d80', 3, 4);
      px(ctx, 5, 8, '#9bb4c9', 4, 4);
      px(ctx, 7, 5, '#9bb4c9', 4, 4);
      px(ctx, 9, 2, '#d4e6f5', 5, 5);
      px(ctx, 11, 2, '#1e293b', 2, 2);
      break;
    }
    case ITEM_IDS.WEAR_GOLD_CROWN: {
      px(ctx, 2, 8, '#99620c', 12, 5);
      px(ctx, 3, 6, '#f2b738', 10, 6);
      px(ctx, 3, 4, '#ffd966', 2, 3);
      px(ctx, 7, 3, '#ffd966', 2, 4);
      px(ctx, 11, 4, '#ffd966', 2, 3);
      px(ctx, 7, 8, '#ff4f5e', 2, 2);
      break;
    }
    case ITEM_IDS.WEAR_EXPLORER_HAT: {
      px(ctx, 1, 9, '#523018', 14, 3);
      px(ctx, 4, 4, '#8c5630', 8, 6);
      px(ctx, 4, 8, '#e6b85c', 8, 1);
      break;
    }
    case ITEM_IDS.WEAR_CYBER_VISOR: {
      px(ctx, 2, 6, '#164e63', 12, 5);
      px(ctx, 3, 7, '#38e8d8', 10, 3);
      px(ctx, 4, 7, '#ffffff', 4, 1);
      break;
    }
    case ITEM_IDS.WEAR_SKY_WINGS: {
      px(ctx, 1, 3, '#3b82c4', 6, 10);
      px(ctx, 9, 3, '#3b82c4', 6, 10);
      px(ctx, 2, 4, '#9ce5ff', 4, 8);
      px(ctx, 10, 4, '#9ce5ff', 4, 8);
      px(ctx, 3, 5, '#ffffff', 2, 4);
      px(ctx, 11, 5, '#ffffff', 2, 4);
      break;
    }
    default: {
      if (def.category === 'seed') {
        px(ctx, 4, 4, def.colorSecondary, 8, 9);
        px(ctx, 5, 3, def.colorPrimary, 6, 9);
        px(ctx, 6, 5, def.colorAccent, 3, 3);
        px(ctx, 7, 2, '#7fe06c', 2, 2);
      } else {
        px(ctx, 0, 0, def.colorPrimary, 16, 16);
        px(ctx, 2, 2, def.colorSecondary, 12, 12);
        px(ctx, 4, 4, def.colorAccent, 4, 4);
      }
    }
  }

  return c;
}

export function getTileSprite(itemId: number): HTMLCanvasElement {
  let cached = tileCache.get(itemId);
  if (!cached) {
    cached = drawTile16(itemId);
    tileCache.set(itemId, cached);
  }
  return cached;
}

export function getItemIconUrl(itemId: number): string {
  let url = iconDataUrls.get(itemId);
  if (!url) {
    const sprite = getTileSprite(itemId);
    const [out, ctx] = makeCanvas(32, 32);
    ctx.drawImage(sprite, 0, 0, 32, 32);
    url = out.toDataURL();
    iconDataUrls.set(itemId, url);
  }
  return url;
}

export function getCrackOverlay(stage: number): HTMLCanvasElement {
  if (crackFrames.length === 0) {
    for (let s = 1; s <= 4; s++) {
      const [c, ctx] = makeCanvas(16, 16);
      ctx.fillStyle = 'rgba(15, 20, 30, 0.72)';
      ctx.fillRect(7, 7, 2, 2);
      if (s >= 1) {
        ctx.fillRect(6, 5, 1, 2);
        ctx.fillRect(9, 9, 1, 2);
      }
      if (s >= 2) {
        ctx.fillRect(4, 3, 2, 2);
        ctx.fillRect(10, 11, 2, 2);
        ctx.fillRect(9, 5, 2, 1);
      }
      if (s >= 3) {
        ctx.fillRect(2, 2, 2, 1);
        ctx.fillRect(11, 3, 2, 2);
        ctx.fillRect(3, 11, 2, 2);
        ctx.fillRect(12, 12, 2, 2);
      }
      if (s >= 4) {
        ctx.fillRect(1, 7, 3, 1);
        ctx.fillRect(12, 7, 3, 1);
        ctx.fillRect(7, 1, 1, 3);
        ctx.fillRect(7, 12, 1, 3);
      }
      crackFrames.push(c);
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
  const key = `${pose}:${facing}:${shirtColor}:${eqKey}`;
  let cached = playerFrames.get(key);
  if (cached) return cached;

  // 20x34 pixel canvas proportional to 0.8 x 1.75 tile hitbox (+headgear margin)
  const [c, ctx] = makeCanvas(20, 34);
  ctx.save();
  if (facing === -1) {
    ctx.translate(20, 0);
    ctx.scale(-1, 1);
  }

  // Back wearable (Sky Wings) behind character body
  if (equipped?.back === ITEM_IDS.WEAR_SKY_WINGS) {
    px(ctx, 1, 11, '#3b82c4', 5, 13);
    px(ctx, 2, 12, '#9ce5ff', 3, 10);
    px(ctx, 2, 14, '#ffffff', 2, 5);
  }

  // Hair & Head
  px(ctx, 6, 4, '#4a2b18', 8, 3);
  px(ctx, 5, 5, '#4a2b18', 2, 4);
  px(ctx, 6, 7, '#f2c199', 8, 7); // Taller expressive face
  px(ctx, 11, 9, '#1a202c', 2, 3); // Eye facing right
  px(ctx, 11, 9, '#ffffff', 1, 1);

  // Face wearable (Cyber Visor)
  if (equipped?.face === ITEM_IDS.WEAR_CYBER_VISOR) {
    px(ctx, 7, 8, '#164e63', 8, 4);
    px(ctx, 8, 9, '#38e8d8', 7, 2);
    px(ctx, 9, 9, '#ffffff', 3, 1);
  }

  // Head wearable (Crown or Hat)
  if (equipped?.head === ITEM_IDS.WEAR_GOLD_CROWN) {
    px(ctx, 6, 2, '#f2b738', 8, 3);
    px(ctx, 6, 0, '#ffd966', 2, 2);
    px(ctx, 9, 0, '#ffd966', 2, 2);
    px(ctx, 12, 0, '#ffd966', 2, 2);
    px(ctx, 9, 3, '#ff4f5e', 2, 1);
  } else if (equipped?.head === ITEM_IDS.WEAR_EXPLORER_HAT) {
    px(ctx, 4, 4, '#523018', 12, 2);
    px(ctx, 6, 1, '#8c5630', 8, 3);
    px(ctx, 6, 3, '#e6b85c', 8, 1);
  }

  // Torso tunic (9px tall)
  px(ctx, 6, 14, shirtColor, 8, 9);
  px(ctx, 7, 14, '#ffffff', 6, 1);
  px(ctx, 6, 22, '#2b3240', 8, 2); // Belt

  // Legs & boots (10px tall: y=24..33)
  const legOffset =
    pose === 'walk1' ? -1 : pose === 'walk3' ? 1 : pose === 'jump' ? -1 : pose === 'fall' ? 1 : 0;
  if (pose === 'walk1' || pose === 'walk3') {
    px(ctx, 6 + legOffset, 24, '#364459', 3, 7);
    px(ctx, 11 - legOffset, 24, '#283242', 3, 7);
    px(ctx, 6 + legOffset, 31, '#593722', 3, 3);
    px(ctx, 11 - legOffset, 31, '#422818', 3, 3);
  } else if (pose === 'jump') {
    px(ctx, 6, 24, '#364459', 3, 5);
    px(ctx, 11, 22, '#283242', 3, 5);
    px(ctx, 6, 29, '#593722', 3, 3);
    px(ctx, 11, 27, '#422818', 3, 3);
  } else {
    px(ctx, 6, 24, '#364459', 3, 7);
    px(ctx, 11, 24, '#283242', 3, 7);
    px(ctx, 6, 31, '#593722', 3, 3);
    px(ctx, 11, 31, '#422818', 3, 3);
  }

  // Arm / Punching pose
  if (pose === 'punch') {
    px(ctx, 12, 15, shirtColor, 3, 3);
    px(ctx, 15, 15, '#f2c199', 4, 3);
  } else if (pose === 'jump') {
    px(ctx, 4, 13, '#f2c199', 2, 5);
    px(ctx, 14, 13, '#f2c199', 2, 5);
  } else {
    px(ctx, 5, 15, '#e0ac82', 2, 6);
    px(ctx, 13, 15 + (pose === 'walk1' ? -1 : 0), '#f2c199', 2, 6);
  }

  ctx.restore();
  playerFrames.set(key, c);
  return c;
}
