import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CATALOG,
  FARMABLE_SPECS,
  GEM_STORE_LISTINGS,
  isCropSeed,
  isFarmableMiscItem,
  isFarmableSeed,
  ITEM_IDS,
} from '../src/game/catalog.ts';
import { drawCatalogItem30 } from '../src/game/catalogArt30.ts';
import {
  drawFarmableBlockRaw48,
  drawFarmableSeedRaw48,
  drawFarmableTierFrame48,
  FARMABLE_TIER_FRAME_COLORS,
} from '../src/game/farmableArt.ts';
import {
  computeModularPlayerRig,
  drawModularCharacter,
  DRAGON_BONE_WINGS_IMG_SRC,
  DRAGON_BONE_WINGS_SPRITE_FRAMES,
  getDragonBoneWingFrameIndex,
  getWearableExtraTopClearance,
  getWearableLocalization,
  WEARABLE_LOCALIZATION,
} from '../src/game/playerSpriteHD.ts';
import { canPlaceTile } from '../src/game/rules.ts';
import { generateWorld } from '../src/game/worldGen.ts';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';

function createMockCanvas2D(): CanvasRenderingContext2D {
  return {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D;
}

interface TrackedCanvas {
  width: number;
  height: number;
  pixels: (string | null)[];
  getContext: () => CanvasRenderingContext2D;
}

function makeTrackedCanvas(w = 48, h = 105, onFill?: (color: string) => void): TrackedCanvas {
  const canvas: TrackedCanvas = {
    width: w,
    height: h,
    pixels: new Array(w * h).fill(null),
    getContext: () => {
      const ctx = createMockCanvas2D() as unknown as Record<string, unknown>;
      ctx.fillStyle = '#000000';
      ctx.fillRect = (x: number, y: number, rw: number, rh: number) => {
        onFill?.(String(ctx.fillStyle));
        const x0 = Math.max(0, Math.round(x));
        const y0 = Math.max(0, Math.round(y));
        const x1 = Math.min(canvas.width, Math.round(x + rw));
        const y1 = Math.min(canvas.height, Math.round(y + rh));
        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            canvas.pixels[py * canvas.width + px] = String(ctx.fillStyle);
          }
        }
      };
      ctx.drawImage = (src: TrackedCanvas, dx = 0, dy = 0) => {
        if (!src?.pixels) return;
        for (let sy = 0; sy < src.height; sy++) {
          for (let sx = 0; sx < src.width; sx++) {
            const col = src.pixels[sy * src.width + sx];
            if (!col) continue;
            const tx = Math.round(dx + sx);
            const ty = Math.round(dy + sy);
            if (tx >= 0 && tx < canvas.width && ty >= 0 && ty < canvas.height) {
              canvas.pixels[ty * canvas.width + tx] = col;
            }
          }
        }
      };
      return ctx as unknown as CanvasRenderingContext2D;
    },
  };
  return canvas;
}

test('Farmablocks T1-T8 have distinct visible tier outline frames, exact drop rates, preserved XP/Gems, and non-seed Misc replicas 950..989', () => {
  const expectedTierDrops: Record<number, { blockBack: number; itsDrop: number }> = {
    1: { blockBack: 0.085, itsDrop: 0.0305 },
    2: { blockBack: 0.06825, itsDrop: 0.02825 },
    3: { blockBack: 0.05375, itsDrop: 0.02205 },
    4: { blockBack: 0.04015, itsDrop: 0.01745 },
    5: { blockBack: 0.02915, itsDrop: 0.01105 },
    6: { blockBack: 0.01785, itsDrop: 0.00505 },
    7: { blockBack: 0.01155, itsDrop: 0.00225 },
    8: { blockBack: 0.00575, itsDrop: 0.00075 },
  };

  // Verify 8 distinct tier border colors exist for T1..T8
  const borderColors = new Set<string>();
  for (let t = 1; t <= 8; t++) {
    const palette = FARMABLE_TIER_FRAME_COLORS[t];
    assert.ok(palette, `Tier ${t} frame palette missing`);
    borderColors.add(palette.border);
  }
  assert.equal(borderColors.size, 8, 'All 8 Farmablock tiers must have distinct tier frame colors');

  const frameRectColors = new Set<string>();
  const mockCtx = createMockCanvas2D();
  (mockCtx as unknown as { fillRect: (...args: number[]) => void }).fillRect = () => {
    frameRectColors.add(String(mockCtx.fillStyle));
  };

  for (const spec of FARMABLE_SPECS) {
    const rates = expectedTierDrops[spec.tier];
    assert.equal(spec.blockDropRate, rates.blockBack, `T${spec.tier} blockDropRate mismatch`);
    assert.equal(spec.seedDropRate, rates.itsDrop, `T${spec.tier} itsDrop mismatch`);

    const blockDef = CATALOG[spec.id];
    const miscDef = CATALOG[spec.seedId];
    assert.equal(blockDef.xpValue, spec.xpValue, `Block #${spec.id} must retain its XP value`);
    assert.equal(blockDef.gemValue, spec.gemValue, `Block #${spec.id} must retain its Gem value`);

    assert.equal(miscDef.category, 'misc');
    assert.equal(miscDef.placeable, false);
    assert.equal(miscDef.buffEffect, undefined);
    assert.equal(miscDef.wearableSlot, undefined);
    assert.equal(isFarmableSeed(miscDef.id), false);
    assert.equal(isCropSeed(miscDef.id), false);
    assert.equal(isFarmableMiscItem(miscDef.id), true);

    assert.equal(drawFarmableBlockRaw48(mockCtx, spec.id, blockDef), true);
    drawFarmableTierFrame48(mockCtx, spec.id, blockDef);
    assert.equal(drawFarmableSeedRaw48(mockCtx, spec.seedId, miscDef), true);
  }

  for (let t = 1; t <= 8; t++) {
    assert.ok(
      frameRectColors.has(FARMABLE_TIER_FRAME_COLORS[t].border),
      `Tier ${t} frame border color must be rendered`
    );
  }

  // Verify world rules & store reject placing or equipping any 950..989 Miscellaneous item
  const testWorld = generateWorld('TEST_MISC', false, { isPersonalWorld: true });
  const placeRes = canPlaceTile(
    testWorld,
    { id: 'u1', x: testWorld.spawnX * 48, y: testWorld.spawnY * 48, adminWorldEdit: true },
    ITEM_IDS.SEED_FARM_SUGAR_CANE,
    testWorld.spawnX + 1,
    testWorld.spawnY,
    8
  );
  assert.equal(placeRes.ok, false, 'Miscellaneous item #950 must not be placeable even with adminEdit');

  const store = new AuthoritativeWorldStore();
  const suffix = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `misc_${suffix}@example.com`,
    username: `Misc_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (reg.ok) {
    store.addInventory(reg.account, ITEM_IDS.SEED_FARM_SUGAR_CANE, 1);
    const equipRes = store.handleEquipWearable(reg.account, ITEM_IDS.SEED_FARM_SUGAR_CANE);
    assert.equal(equipRes.ok, false, 'Miscellaneous item #950 must not be equippable as a wearable');
  }
});

test('Wearables localize strictly to modular body parts and render attached to head/face/back transforms', () => {
  const crown = getWearableLocalization(401);
  const hat = getWearableLocalization(402);
  const visor = getWearableLocalization(403);
  const wings = getWearableLocalization(404);

  assert.equal(crown?.bodyPart, 'head');
  assert.equal(crown?.parentPart, 'head');
  assert.equal(crown?.layer, 'on_head');

  assert.equal(hat?.bodyPart, 'head');
  assert.equal(hat?.parentPart, 'head');
  assert.equal(hat?.layer, 'on_head');

  assert.equal(visor?.bodyPart, 'face');
  assert.equal(visor?.parentPart, 'head');
  assert.equal(visor?.layer, 'on_face');

  assert.equal(wings?.bodyPart, 'back');
  assert.equal(wings?.parentPart, 'torso');
  assert.equal(wings?.layer, 'behind_character');

  assert.equal(Object.keys(WEARABLE_LOCALIZATION).length >= 4, true);
  assert.equal(getWearableExtraTopClearance({ head: 401 }), 12);
  assert.equal(getWearableExtraTopClearance({ face: 403, back: 404 }), 0);

  // Stub minimal browser document canvas factory so drawModularCharacter exercises wearable drawing in Node
  const origDoc = (globalThis as { document?: unknown }).document;
  const drawnImages: Array<{ w: number; h: number }> = [];
  (globalThis as { document?: unknown }).document = {
    createElement: () => makeTrackedCanvas(48, 48),
  };

  try {
    const mainCtx = createMockCanvas2D();
    (mainCtx as unknown as { drawImage: (img: { width: number; height: number }) => void }).drawImage = (img) => {
      drawnImages.push({ w: img.width, h: img.height });
    };

    const rig = computeModularPlayerRig(100, 200, {
      facing: 1,
      vx: 160,
      vy: 0,
      grounded: true,
      punching: false,
      placing: false,
      shirtColor: '#38bdf8',
      walkPhase: 2.1,
      nowMs: 1200,
      punchProgress: 0,
      equipped: { head: 401, face: 403, back: 404 },
    });
    assert.ok(rig.head.x !== undefined && rig.torso.x !== undefined);

    const bareTopY = drawModularCharacter(mainCtx, 100, 200, {
      facing: 1,
      vx: 0,
      vy: 0,
      grounded: true,
      punching: false,
      placing: false,
      shirtColor: '#38bdf8',
      walkPhase: 0,
      nowMs: 1200,
      punchProgress: 0,
    });
    const bareDrawCount = drawnImages.length;

    const crownedTopY = drawModularCharacter(mainCtx, 100, 200, {
      facing: 1,
      vx: 160,
      vy: -120,
      grounded: false,
      punching: false,
      placing: false,
      shirtColor: '#38bdf8',
      walkPhase: 2.1,
      nowMs: 1200,
      punchProgress: 0,
      equipped: { head: 401, face: 403, back: 404 },
    });
    const clothedDrawCount = drawnImages.length - bareDrawCount;

    // Bare character draws 7 sub-layers (back hand, back foot, front foot, torso, head, face, front hand = 7)
    // Wearing crown + visor + split left/right wings adds 4 modular wearable sub-layers (11 total)
    assert.equal(clothedDrawCount - bareDrawCount, 4, 'Must draw Crown, Visor, and separate Left/Right Wing sub-layers on their body parts');
    assert.ok(crownedTopY < bareTopY, 'Crown must expand top clearance smoothly for floating nameplates');
  } finally {
    if (origDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  }
});

test('Alteria Sci-Fi branding, removed TitleScreen bottom controls box, Starry Night backdrop, and 28-bit OST are configured', () => {
  const root = process.cwd();
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const titleScreen = fs.readFileSync(path.join(root, 'src/components/TitleScreen.tsx'), 'utf8');
  const modeSelection = fs.readFileSync(path.join(root, 'src/components/ModeSelection.tsx'), 'utf8');
  const engineSrc = fs.readFileSync(path.join(root, 'src/game/engine.ts'), 'utf8');
  const audioSrc = fs.readFileSync(path.join(root, 'src/game/audio.ts'), 'utf8');

  assert.match(indexHtml, /Alteria — 2D-MMO Sandbox Platformer Concept/);
  assert.match(titleScreen, /ALTERIA/);
  assert.match(titleScreen, /2D-MMO SANDBOX PLATFORMER CONCEPT/i);
  assert.equal(titleScreen.includes('A/D or Arrows Move'), false, 'Bottom controls bar must be omitted from TitleScreen');
  assert.match(modeSelection, /ALTERIA REALMS/);
  assert.match(engineSrc, /drawTitleStarryNightBackdrop/);
  assert.match(audioSrc, /28-bit/i);
});

test('Full 5-piece Astronaut EVA Wardrobe Set (405..409) renders in 30-bit pixel art, equips per slot, and attaches seamlessly across body modules', () => {
  const expectedSet = [
    { id: ITEM_IDS.WEAR_SPACE_HELMET, name: 'Space Helmet', slot: 'head', bodyPart: 'head', layer: 'on_head' },
    { id: ITEM_IDS.WEAR_ASTRO_SUIT, name: 'Astro Suit', slot: 'torso', bodyPart: 'torso', layer: 'on_torso' },
    { id: ITEM_IDS.WEAR_ASTRO_PANTS, name: 'Astro Pants', slot: 'legs', bodyPart: 'legs', layer: 'on_torso' },
    { id: ITEM_IDS.WEAR_ASTRO_BOOTS, name: 'Astro Boots', slot: 'feet', bodyPart: 'feet', layer: 'on_feet' },
    { id: ITEM_IDS.WEAR_LIFESUP_BACKPACK, name: 'Lifesup Backpack', slot: 'back', bodyPart: 'back', layer: 'behind_torso' },
  ] as const;

  const astroBundle = GEM_STORE_LISTINGS.find((l) => l.id === 'store_astro_set');
  assert.ok(astroBundle, 'Full Astronaut EVA Suit Set must be listed in Gem Store');
  assert.equal(astroBundle?.grants.length, 5);

  const helmetColorsUsed: string[] = [];
  const artCtx = createMockCanvas2D();
  (artCtx as unknown as { fillRect: () => void }).fillRect = () => {
    helmetColorsUsed.push(String(artCtx.fillStyle));
  };

  for (const piece of expectedSet) {
    const def = CATALOG[piece.id];
    assert.ok(def, `Missing catalog item #${piece.id}`);
    assert.equal(def.name, piece.name);
    assert.equal(def.category, 'wearable');
    assert.equal(def.placeable, false);
    assert.equal(def.wearableSlot, piece.slot);

    const loc = getWearableLocalization(piece.id);
    assert.equal(loc?.slot, piece.slot);
    assert.equal(loc?.bodyPart, piece.bodyPart);
    assert.equal(loc?.layer, piece.layer);

    assert.equal(drawCatalogItem30(artCtx, piece.id, def, 30, 30), true);
  }

  assert.equal(
    helmetColorsUsed.some((c) => c.startsWith('rgba(')),
    true,
    'Space Helmet 30-bit texture must use translucent rgba tint for its see-through visor'
  );

  // Server equips all 5 Astronaut EVA slots simultaneously onto player account
  const store = new AuthoritativeWorldStore();
  const suffix = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `astro_${suffix}@example.com`,
    username: `Astro_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  for (const piece of expectedSet) {
    store.addInventory(reg.account, piece.id, 1);
    const eqRes = store.handleEquipWearable(reg.account, piece.id);
    assert.equal(eqRes.ok, true, `Failed equipping ${piece.name}`);
  }
  assert.deepEqual(reg.account.equipped, {
    head: ITEM_IDS.WEAR_SPACE_HELMET,
    torso: ITEM_IDS.WEAR_ASTRO_SUIT,
    legs: ITEM_IDS.WEAR_ASTRO_PANTS,
    feet: ITEM_IDS.WEAR_ASTRO_BOOTS,
    back: ITEM_IDS.WEAR_LIFESUP_BACKPACK,
  });

  // Render full Astronaut Suit across walk, jump, punch, and idle poses in Node headless canvas
  const origDoc = (globalThis as { document?: unknown }).document;
  const subLayerCalls: string[] = [];
  (globalThis as { document?: unknown }).document = {
    createElement: () => makeTrackedCanvas(48, 48, (col) => subLayerCalls.push(col)),
  };

  try {
    const mainCtx = createMockCanvas2D();
    let drawnLayers = 0;
    (mainCtx as unknown as { drawImage: () => void }).drawImage = () => {
      drawnLayers += 1;
    };

    const topWalk = drawModularCharacter(mainCtx, 120, 200, {
      facing: 1,
      vx: 180,
      vy: 0,
      grounded: true,
      punching: false,
      placing: false,
      shirtColor: '#38bdf8',
      walkPhase: 3.4,
      nowMs: 1400,
      punchProgress: 0,
      equipped: reg.account.equipped,
    });
    const walkCount = drawnLayers;
    drawnLayers = 0;

    drawModularCharacter(mainCtx, 120, 200, {
      facing: -1,
      vx: 0,
      vy: -200,
      grounded: false,
      punching: true,
      placing: false,
      shirtColor: '#38bdf8',
      walkPhase: 0,
      nowMs: 1500,
      punchProgress: 0.45,
      aimX: 32,
      aimY: -12,
      equipped: reg.account.equipped,
    });
    const jumpPunchCount = drawnLayers;

    // 7 base layers + 4 overlay layers (Lifesup Backpack behind torso, Astro Pants belt + Astro Suit torso on_torso, Space Helmet on_head)
    // plus Astro Suit linked sleeve/gloves on front/back hands & Astro Pants/Boots composited onto front/back feet!
    assert.equal(walkCount, 11);
    assert.equal(jumpPunchCount, 11);
    assert.ok(topWalk < 200, 'Space Helmet must include top clearance above base player box');
    assert.ok(
      subLayerCalls.some((c) => c.includes('0.44') || c.includes('0.56')),
      'Space Helmet body-part overlay must use slightly see-through visor alpha'
    );
  } finally {
    if (origDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  }
});

test('Live engine delegates drawCharacter to drawModularCharacter and Astro Set covers 100% of leg/foot/hand texels across poses', () => {
  const engineSrc = fs.readFileSync(path.join(process.cwd(), 'src/game/engine.ts'), 'utf8');
  assert.match(engineSrc, /return drawModularCharacter\(ctx, drawX, drawY,/);
  assert.equal(
    engineSrc.includes('drawPlayerFeetSubLayer'),
    false,
    'engine.ts must not duplicate stale bare sub-layer drawers'
  );

  // Track a real 2D boolean coverage mask for each generated offscreen texel canvas
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => makeTrackedCanvas(48, 105),
  };

  const BARE_SKIN_COLORS = new Set([
    '#fff3df',
    '#fbd7b5',
    '#f0be93',
    '#e0a373',
    '#c98655',
    '#ad6b3d',
    '#854b24',
    '#b37041',
    '#99592e',
    '#7d441f',
    '#5e3013',
  ]);

  try {
    const mainCanvas = makeTrackedCanvas(48, 105);
    const mainCtx = mainCanvas.getContext();
    const recordedLayers: TrackedCanvas[] = [];
    const origDrawImage = mainCtx.drawImage.bind(mainCtx);
    (mainCtx as unknown as { drawImage: (img: TrackedCanvas, x: number, y: number) => void }).drawImage = (
      img,
      x,
      y
    ) => {
      recordedLayers.push(img);
      origDrawImage(img as unknown as CanvasImageSource, x, y);
    };

    const fullAstro = {
      head: ITEM_IDS.WEAR_SPACE_HELMET,
      torso: ITEM_IDS.WEAR_ASTRO_SUIT,
      legs: ITEM_IDS.WEAR_ASTRO_PANTS,
      feet: ITEM_IDS.WEAR_ASTRO_BOOTS,
      back: ITEM_IDS.WEAR_LIFESUP_BACKPACK,
    };

    // Exercise idle, walking strides, jumping, falling, landing, and punching
    const poses = [
      { vx: 0, vy: 0, grounded: true, punching: false, walkPhase: 0, punchProgress: 0, landing: false },
      { vx: 200, vy: 0, grounded: true, punching: false, walkPhase: 1.5, punchProgress: 0, landing: false },
      { vx: 200, vy: 0, grounded: true, punching: false, walkPhase: 5.5, punchProgress: 0, landing: false },
      { vx: 0, vy: -220, grounded: false, punching: false, walkPhase: 0, punchProgress: 0, landing: false },
      { vx: 0, vy: 0, grounded: true, punching: false, walkPhase: 0, punchProgress: 0, landing: true },
      { vx: 0, vy: 0, grounded: true, punching: true, walkPhase: 0, punchProgress: 0.45, landing: false },
    ];

    for (const p of poses) {
      recordedLayers.length = 0;
      drawModularCharacter(mainCtx, 0, 0, {
        facing: 1,
        placing: false,
        shirtColor: '#38bdf8',
        nowMs: 1200,
        aimX: 30,
        aimY: 0,
        equipped: fullAstro,
        ...p,
      });

      // Verify NO drawn leg/foot layer (indices 2 and 3) or hand layer (indices 0 and 10) leaves ANY bare skin pixel exposed!
      // Order: 0=backHand, 1=backPack, 2=backFoot, 3=frontFoot, 4=torso, 5=pantsGirdle, 6=suitTorso, 7=head, 8=face, 9=helmet, 10=frontHand
      const limbIndices = [0, 2, 3, 10];
      for (const idx of limbIndices) {
        const layerCanvas = recordedLayers[idx];
        assert.ok(layerCanvas, `Missing limb layer ${idx}`);
        const skinPixels = layerCanvas.pixels.filter((col) => col !== null && BARE_SKIN_COLORS.has(col));
        assert.equal(
          skinPixels.length,
          0,
          `Limb layer ${idx} still has ${skinPixels.length} exposed bare skin pixel(s)`
        );
      }
    }
  } finally {
    if (origDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  }
});

test('Dragon Bone Wings (410) render in 30-bit pixel art, localize behind torso, equip cleanly, and animate with wing flapping', () => {
  const def = CATALOG[ITEM_IDS.WEAR_DRAGON_BONE_WINGS];
  assert.ok(def, 'Missing Dragon Bone Wings in CATALOG');
  assert.equal(ITEM_IDS.WEAR_DRAGON_BONE_WINGS, 410);
  assert.equal(def.name, 'Dragon Bone Wings');
  assert.equal(def.category, 'wearable');
  assert.equal(def.wearableSlot, 'back');
  assert.equal(def.placeable, false);

  const storeListing = GEM_STORE_LISTINGS.find((l) => l.id === 'store_dragon_bone_wings');
  assert.ok(storeListing, 'Dragon Bone Wings must be listed in Gem Store');
  assert.equal(storeListing?.grants[0]?.itemId, ITEM_IDS.WEAR_DRAGON_BONE_WINGS);

  const loc = getWearableLocalization(410);
  assert.equal(loc?.slot, 'back');
  assert.equal(loc?.bodyPart, 'back');
  assert.equal(loc?.parentPart, 'torso');
  assert.equal(loc?.layer, 'behind_character');

  const artColors = new Set<string>();
  const artCtx = createMockCanvas2D();
  (artCtx as unknown as { fillRect: () => void }).fillRect = () => {
    artColors.add(String(artCtx.fillStyle));
  };
  assert.equal(drawCatalogItem30(artCtx, ITEM_IDS.WEAR_DRAGON_BONE_WINGS, def, 30, 30), true);
  assert.ok(artColors.has('#fff7ea'), '30-bit icon must include cream bone highlights');
  assert.ok(artColors.has('#70584e'), '30-bit icon must include smoky umber membrane webbing');

  const store = new AuthoritativeWorldStore();
  const suffix = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `dragon_${suffix}@example.com`,
    username: `Dragon_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  store.addInventory(reg.account, ITEM_IDS.WEAR_DRAGON_BONE_WINGS, 1);
  const eqRes = store.handleEquipWearable(reg.account, ITEM_IDS.WEAR_DRAGON_BONE_WINGS);
  assert.equal(eqRes.ok, true);
  assert.equal(reg.account.equipped.back, ITEM_IDS.WEAR_DRAGON_BONE_WINGS);

  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => makeTrackedCanvas(48, 48),
  };

  try {
    const captureFlapTransforms = (nowMs: number, grounded: boolean) => {
      const rotations: number[] = [];
      const scales: Array<[number, number]> = [];
      let leftWingRot: number | undefined;
      let rightWingRot: number | undefined;
      let leftWingScale: [number, number] | undefined;
      let rightWingScale: [number, number] | undefined;
      let drawCount = 0;
      const ctx = createMockCanvas2D();
      (ctx as unknown as { rotate: (rad: number) => void }).rotate = (rad) => {
        rotations.push(rad);
      };
      (ctx as unknown as { scale: (sx: number, sy: number) => void }).scale = (sx, sy) => {
        scales.push([sx, sy]);
      };
      (ctx as unknown as { drawImage: () => void }).drawImage = () => {
        // Order: 0 = left wing half, 1 = right wing half, 2 = backHand ... (wings completely behind character)
        if (drawCount === 0) {
          leftWingRot = rotations[rotations.length - 1];
          leftWingScale = scales[scales.length - 1];
        } else if (drawCount === 1) {
          rightWingRot = rotations[rotations.length - 1];
          rightWingScale = scales[scales.length - 1];
        }
        drawCount += 1;
      };

      drawModularCharacter(ctx, 100, 200, {
        facing: 1,
        vx: 0,
        vy: grounded ? 0 : -150,
        grounded,
        punching: false,
        placing: false,
        shirtColor: '#38bdf8',
        walkPhase: 0,
        nowMs,
        punchProgress: 0,
        equipped: { back: ITEM_IDS.WEAR_DRAGON_BONE_WINGS },
      });
      return { leftWingRot, rightWingRot, leftWingScale, rightWingScale, drawCount };
    };

    const g1 = captureFlapTransforms(0, true);
    const g2 = captureFlapTransforms(260, true);
    const air1 = captureFlapTransforms(0, false);
    const air2 = captureFlapTransforms(190, false);

    assert.equal(g1.drawCount, 9, '7 base parts + 2 symmetric behind_torso Dragon Bone Wing halves');
    assert.ok(g1.leftWingRot !== undefined && g1.rightWingRot !== undefined, 'Both wing halves must emit shoulder flap rotations');
    assert.ok(g1.leftWingRot > 0 && g1.rightWingRot < 0, 'Left wing rotates +up/out and right wing rotates -up/out (never pointing downwards)');
    assert.equal(g1.leftWingRot, -g1.rightWingRot, 'Left and right wings must flap symmetrically');
    assert.notEqual(g1.leftWingRot, g2.leftWingRot, 'Grounded wing flap frames must step over time');

    assert.ok(air1.leftWingRot !== undefined && air2.leftWingRot !== undefined);
    assert.ok(air2.leftWingRot > 0 && (air2.rightWingRot ?? 0) < 0, 'Airborne flap frames must lift upward/outward without pointing downwards');
    assert.notEqual(air1.leftWingRot, air2.leftWingRot, 'Airborne wing flap cycle must advance through frames');
    assert.ok(
      air2.leftWingScale && (air2.leftWingScale[0] !== 1 || air2.leftWingScale[1] !== 1),
      'Airborne peak flap frame must apply subtle spread scaling'
    );

    // Verify 6-frame sprite sheet and jump extension state sequence
    assert.equal(DRAGON_BONE_WINGS_SPRITE_FRAMES.length, 6, 'Sprite sheet must contain exactly 6 frame tiers (rows 0..5)');
    assert.match(DRAGON_BONE_WINGS_IMG_SRC, /file_000000004b548246aa191527fbd08976_acc22d5c\.png$/);

    // Grounded: resting/breathing between frame 1 and 2
    const gFrame1 = getDragonBoneWingFrameIndex(0, true, 0, false);
    const gFrame2 = getDragonBoneWingFrameIndex(500, true, 0, false);
    assert.ok(gFrame1 === 1 || gFrame1 === 2);
    assert.ok(gFrame2 === 1 || gFrame2 === 2);

    // Jumping upward (vy < -100): extends rapidly through wide frames up to Frame 5 (fully extended)
    const jumpFrames = new Set<number>();
    for (let t = 0; t <= 300; t += 75) {
      jumpFrames.add(getDragonBoneWingFrameIndex(t, false, -180, false));
    }
    assert.ok(jumpFrames.has(5), 'Jumping must extend wings into fully extended Frame 5');
    assert.ok(jumpFrames.has(4) || jumpFrames.has(3), 'Jumping must transition through extending frames');

    // Landing: tucks back to frame 1
    assert.equal(getDragonBoneWingFrameIndex(100, true, 0, true), 1);
  } finally {
    if (origDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  }
});


