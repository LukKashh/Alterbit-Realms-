import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlantGrowthState } from '../src/game/rules.ts';
import { sanitizeGameConfig } from '../src/game/config.ts';

const plant = {
  x: 4,
  y: 8,
  seedId: 1,
  plantedAt: 10_000,
  maturityAt: 20_000,
  ownerId: 'test-player',
};

test('tree growth progresses through all five configured stages', () => {
  assert.equal(getPlantGrowthState(plant, 10_000).stage, 'planted');
  assert.equal(getPlantGrowthState(plant, 11_000).stage, 'sprout');
  assert.equal(getPlantGrowthState(plant, 13_000).stage, 'young');
  assert.equal(getPlantGrowthState(plant, 16_000).stage, 'developing');
  assert.equal(getPlantGrowthState(plant, 20_000).stage, 'mature');
});

test('mature trees report full progress and no remaining growth time', () => {
  assert.deepEqual(getPlantGrowthState(plant, 20_000), {
    stage: 'mature',
    progress: 1,
    remainingMs: 0,
  });
});

test('growth state clamps times before planting and after maturity', () => {
  const beforePlanting = getPlantGrowthState(plant, 5_000);
  assert.equal(beforePlanting.progress, 0);
  assert.equal(beforePlanting.remainingMs, 10_000);
  const afterMaturity = getPlantGrowthState(plant, 25_000);
  assert.equal(afterMaturity.progress, 1);
  assert.equal(afterMaturity.remainingMs, 0);
});

test('tree harvest overrides are clamped and kept internally consistent', () => {
  const config = sanitizeGameConfig({
    itemOverrides: {
      1: {
        treeHarvestYield: { minBlocks: 9, maxBlocks: 2, seedChance: 1.5 },
        bonusHarvestDrops: [{ itemId: 1, chance: 0.4, minQty: 2, maxQty: 5 }],
      },
    },
  });
  const override = config.itemOverrides[1];
  assert.ok(override);
  assert.deepEqual(override.treeHarvestYield, {
    minBlocks: 9,
    maxBlocks: 9,
    seedChance: 1,
  });
  assert.deepEqual(override.bonusHarvestDrops, [
    { itemId: 1, chance: 0.4, minQty: 2, maxQty: 5 },
  ]);
});
