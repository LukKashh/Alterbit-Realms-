import assert from 'node:assert/strict';
import test from 'node:test';
import { CRACK_STAGE_COUNT, getCrackOverlay } from '../src/game/pixelArt.ts';
import {
  DEFAULT_DATASET_VALUE_CONFIG,
  resolveDatasetLevelRequirement,
  sanitizeDatasetValueConfig,
  sanitizeGameConfig,
  setActiveDatasetConfig,
} from '../src/game/config.ts';
import {
  addMasteryXp,
  addWorldXp,
  addXp,
  getCropMasteryRequiredLevel,
  getFarmableMasteryRequiredLevel,
  masteryXpForNextLevel,
  worldXpForNextLevel,
  xpForNextLevel,
} from '../src/game/rules.ts';
import { ITEM_IDS } from '../src/game/catalog.ts';
import {
  getRemainingOpeningFrameTicks,
  guardOpeningFrameTick,
  isOpeningFrameTickLocked,
  openingFrameTick,
  resetOpeningFrameTick,
  stepOpeningFrameTick,
} from '../src/game/openingFrameTick.ts';
import { isEphemeralTestWorldName } from '../server/worldStore.ts';

interface MockCanvasWithPixels {
  width: number;
  height: number;
  __nonEmptyWrites: number;
  __colors: Set<string>;
  getContext: (contextId: string) => CanvasRenderingContext2D | null;
}

function installCanvasMock() {
  const g = globalThis as unknown as { document?: { createElement: (tag: string) => unknown } };
  g.document = {
    createElement(tagName: string) {
      if (tagName.toLowerCase() === 'canvas') {
        const canvas: MockCanvasWithPixels = {
          width: 0,
          height: 0,
          __nonEmptyWrites: 0,
          __colors: new Set<string>(),
          getContext(contextId: string) {
            if (contextId !== '2d') return null;
            let currentFill = '#000000';
            return {
              imageSmoothingEnabled: false,
              get fillStyle() {
                return currentFill;
              },
              set fillStyle(val: string) {
                currentFill = String(val);
              },
              fillRect(_x: number, _y: number, w: number, h: number) {
                if (w > 0 && h > 0) {
                  canvas.__nonEmptyWrites += w * h;
                  canvas.__colors.add(currentFill);
                }
              },
              clearRect() {},
              drawImage(img: unknown) {
                const src = img as MockCanvasWithPixels;
                if (src && typeof src.__nonEmptyWrites === 'number') {
                  canvas.__nonEmptyWrites += src.__nonEmptyWrites;
                  for (const c of src.__colors) {
                    canvas.__colors.add(c);
                  }
                }
              },
            } as unknown as CanvasRenderingContext2D;
          },
        };
        return canvas;
      }
      return {};
    },
  };
}

test('High-Definition 8-stage cracking animation renders progressive 30-bit fracture overlays', () => {
  installCanvasMock();
  assert.equal(CRACK_STAGE_COUNT, 8);
  let prevWrites = 0;
  for (let stage = 1; stage <= CRACK_STAGE_COUNT; stage++) {
    const overlay = getCrackOverlay(stage) as unknown as MockCanvasWithPixels;
    assert.equal(overlay.width, 60);
    assert.equal(overlay.height, 60);
    assert.ok(
      overlay.__nonEmptyWrites > prevWrites,
      `Expected stage ${stage} writes (${overlay.__nonEmptyWrites}) > stage ${stage - 1} (${prevWrites})`
    );
    assert.ok(overlay.__colors.size >= 3);
    prevWrites = overlay.__nonEmptyWrites;
  }
});

test('OpeningFrameTick blocks rapid click-through across progressive UI transitions and unlocks after frame ticks', () => {
  resetOpeningFrameTick();
  let triggeredCount = 0;
  const handleProgressiveAction = guardOpeningFrameTick(
    () => {
      triggeredCount += 1;
      return triggeredCount;
    },
    { ticks: 3 }
  );

  assert.equal(handleProgressiveAction(), 1);
  assert.equal(isOpeningFrameTickLocked(), true);
  assert.equal(getRemainingOpeningFrameTicks(), 3);

  // Immediate double-click / synthetic click on newly mounted UI is blocked
  assert.equal(handleProgressiveAction(), undefined);
  assert.equal(triggeredCount, 1);

  // Step 2 frames -> still locked on tick 3
  stepOpeningFrameTick(2);
  assert.equal(isOpeningFrameTickLocked(), true);
  assert.equal(handleProgressiveAction(), undefined);

  // Step final tick -> unlocked
  stepOpeningFrameTick(1);
  assert.equal(isOpeningFrameTickLocked(), false);
  assert.equal(handleProgressiveAction(), 2);

  openingFrameTick(4);
  assert.equal(getRemainingOpeningFrameTicks(), 4);
  resetOpeningFrameTick();
  assert.equal(isOpeningFrameTickLocked(), false);
});

test('Admin DataSet Value Panel progression curves, level-to-level step changes, and level overrides work live', () => {
  setActiveDatasetConfig(DEFAULT_DATASET_VALUE_CONFIG);
  assert.equal(xpForNextLevel(1), 50);
  assert.equal(xpForNextLevel(2), 85);
  assert.equal(masteryXpForNextLevel(1, 'crop'), 40);
  assert.equal(masteryXpForNextLevel(2, 'crop'), 70);
  assert.equal(masteryXpForNextLevel(1, 'farmablock'), 40);
  assert.equal(worldXpForNextLevel(1), 100);
  assert.equal(worldXpForNextLevel(2), 175);

  const cfg = sanitizeGameConfig({
    datasets: {
      ...DEFAULT_DATASET_VALUE_CONFIG,
      playerMainXp: {
        ...DEFAULT_DATASET_VALUE_CONFIG.playerMainXp,
        baseAmount: 100,
        levelStepAmount: 50,
        growthFactor: 1,
        levelOverrides: {
          3: 999,
        },
      },
      cropMastery: {
        ...DEFAULT_DATASET_VALUE_CONFIG.cropMastery,
        baseAmount: 60,
        levelStepAmount: 40,
        unlockLevelOverrides: {
          [ITEM_IDS.CROP_SEED_MELON]: 12,
        },
      },
      farmablockMastery: {
        ...DEFAULT_DATASET_VALUE_CONFIG.farmablockMastery,
        baseAmount: 80,
        levelStepAmount: 20,
        unlockLevelOverrides: {
          8: 20,
        },
      },
      worldCoreXp: {
        ...DEFAULT_DATASET_VALUE_CONFIG.worldCoreXp,
        baseAmount: 200,
        levelStepAmount: 100,
      },
      customDatasets: [
        {
          id: 'custom_fishing_xp',
          label: 'Fishing Mastery XP',
          unitLabel: 'Fish XP',
          description: 'Custom progression dataset for angler ranks.',
          baseAmount: 30,
          levelStepAmount: 15,
          growthFactor: 1,
          maxLevel: 40,
          levelOverrides: { 2: 75 },
        },
      ],
    },
  });

  assert.equal(xpForNextLevel(1), 100);
  assert.equal(xpForNextLevel(2), 150);
  assert.equal(xpForNextLevel(3), 999);

  const pLevelUp = addXp(1, 0, 260);
  assert.equal(pLevelUp.level, 3);
  assert.equal(pLevelUp.xp, 10);
  assert.equal(pLevelUp.leveledUp, true);

  assert.equal(masteryXpForNextLevel(1, 'crop'), 60);
  assert.equal(masteryXpForNextLevel(1, 'farmablock'), 80);
  assert.equal(getCropMasteryRequiredLevel(ITEM_IDS.CROP_SEED_MELON), 12);
  assert.equal(getFarmableMasteryRequiredLevel(939), 20);

  const farmProgress = addMasteryXp(1, 0, 95, 'farmablock');
  assert.equal(farmProgress.level, 2);
  assert.equal(farmProgress.xp, 15);

  assert.equal(worldXpForNextLevel(1), 200);
  const wProgress = addWorldXp(1, 0, 225);
  assert.equal(wProgress.level, 2);
  assert.equal(wProgress.xp, 25);

  const customCurve = cfg.datasets?.customDatasets[0];
  assert.equal(customCurve?.label, 'Fishing Mastery XP');
  assert.equal(resolveDatasetLevelRequirement(customCurve, 1), 30);
  assert.equal(resolveDatasetLevelRequirement(customCurve, 2), 75);
  assert.equal(resolveDatasetLevelRequirement(customCurve, 3), 60);

  const cleanDefault = sanitizeDatasetValueConfig(DEFAULT_DATASET_VALUE_CONFIG);
  setActiveDatasetConfig(cleanDefault);
  assert.equal(xpForNextLevel(1), 50);
});

test('Admin Worlds Browser ephemeral test world filter excludes unit-test worlds and preserves real worlds', () => {
  assert.equal(isEphemeralTestWorldName('ATMUSER_0478ZL'), true);
  assert.equal(isEphemeralTestWorldName('BFGTEST_9KZGV'), true);
  assert.equal(isEphemeralTestWorldName('FARM_8X9A12'), true);
  assert.equal(isEphemeralTestWorldName('VOWNER_ABCD12'), true);

  assert.equal(isEphemeralTestWorldName('START'), false);
  assert.equal(isEphemeralTestWorldName('NEXUS'), false);
  assert.equal(isEphemeralTestWorldName('FARM'), false);
  assert.equal(isEphemeralTestWorldName('FORTRESS_SECRET'), false);
  assert.equal(isEphemeralTestWorldName('KINGDOM_ALPHA'), false);
  assert.equal(isEphemeralTestWorldName('MYWORLD'), false);
});
