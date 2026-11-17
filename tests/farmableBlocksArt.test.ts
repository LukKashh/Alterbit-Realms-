import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG,
  FARMABLE_SPECS,
  isFarmableMiscItem,
  isFarmableSeed,
} from '../src/game/catalog.ts';
import {
  drawFarmableBlock32,
  drawFarmableSeed32,
  drawFarmableBlock48,
  drawFarmableSeed48,
  drawFarmableBlockRaw48,
  drawFarmableSeedRaw48,
  drawFarmableTierFrame48,
  FARMABLE_TIER_FRAME_COLORS,
} from '../src/game/farmableArt.ts';

const EXPECTED_TIER_BLOCKS: Record<number, string[]> = {
  1: ['Clay Soil', 'Packed Earth', 'Natural Log', 'Wood Plank', 'Reinforced Timber'],
  2: ['Quarry Stone', 'Chiseled Stone', 'Fired Brick', 'Patterned Brick', 'Stone Paver'],
  3: ['Smooth Basalt', 'Veined Granite', 'Glazed Ceramic', 'Ceramic Mosaic', 'Polished Terrazzo'],
  4: ['Raw Iron', 'Riveted Iron', 'Stainless Steel', 'Fluted Brass', 'Engraved Bronze'],
  5: ['Clear Glass', 'Frosted Glass', 'Beveled Crystal', 'Stained Glass', 'Prismatic Quartz'],
  6: ['Polished Pine', 'Striped Teak', 'Rich Mahogany', 'Ebony Timber', 'Amber Wood'],
  7: ['Carrara Marble', 'Nero Marquina', 'Malachite Slab', 'Lapis Lazuli', 'Imperial Jade'],
  8: ['14K Gold Block', '24K Gold Monolith', 'Platinum Lattice', 'Diamond Obsidian', 'Imperial Monolith'],
};

const EXPECTED_TIER_RATES: Record<number, { blockBack: number; itsDrop: number }> = {
  1: { blockBack: 0.085, itsDrop: 0.0305 },
  2: { blockBack: 0.06825, itsDrop: 0.02825 },
  3: { blockBack: 0.05375, itsDrop: 0.02205 },
  4: { blockBack: 0.04015, itsDrop: 0.01745 },
  5: { blockBack: 0.02915, itsDrop: 0.01105 },
  6: { blockBack: 0.01785, itsDrop: 0.00505 },
  7: { blockBack: 0.01155, itsDrop: 0.00225 },
  8: { blockBack: 0.00575, itsDrop: 0.00075 },
};

test('All 40 Farmablocks and 40 replica Miscellaneous items are properly registered across 8 tiers', () => {
  assert.equal(FARMABLE_SPECS.length, 40, 'Must have exactly 40 farmable specs');

  const tierCount: Record<number, number> = {};
  for (let t = 1; t <= 8; t++) {
    tierCount[t] = 0;
    assert.ok(FARMABLE_TIER_FRAME_COLORS[t], `Missing tier outline palette for T${t}`);
  }

  for (let i = 0; i < 40; i++) {
    const blockId = 900 + i;
    const miscId = 950 + i;

    const blockDef = CATALOG[blockId];
    const miscDef = CATALOG[miscId];
    const spec = FARMABLE_SPECS[i];

    assert.ok(blockDef, `Missing catalog entry for block ID ${blockId}`);
    assert.ok(miscDef, `Missing catalog entry for misc ID ${miscId}`);
    assert.ok(spec, `Missing farmable spec at index ${i}`);

    assert.equal(spec.id, blockId);
    assert.equal(spec.seedId, miscId);
    assert.equal(blockDef.category, 'farmable');
    assert.equal(blockDef.seedId, undefined);
    assert.equal(miscDef.category, 'misc');
    assert.equal(miscDef.placeable, false);
    assert.equal(miscDef.producesTileId, undefined);
    assert.equal(miscDef.wearableSlot, undefined);
    assert.equal(isFarmableSeed(miscId), false);
    assert.equal(isFarmableMiscItem(miscId), true);

    const expectedTier = Math.floor(i / 5) + 1;
    assert.equal(spec.tier, expectedTier, `Spec tier mismatch for ${spec.name}`);
    assert.equal(blockDef.farmableTier, expectedTier, `Block tier mismatch for ${blockDef.name}`);
    assert.equal(miscDef.farmableTier, expectedTier, `Misc tier mismatch for ${miscDef.name}`);

    const rates = EXPECTED_TIER_RATES[expectedTier];
    assert.equal(spec.blockDropRate, rates.blockBack);
    assert.equal(spec.seedDropRate, rates.itsDrop);
    assert.deepEqual(blockDef.drops, [
      { itemId: blockId, chance: rates.blockBack, minQty: 1, maxQty: 1 },
      { itemId: miscId, chance: rates.itsDrop, minQty: 1, maxQty: 1 },
    ]);

    tierCount[expectedTier]++;

    const tierList = EXPECTED_TIER_BLOCKS[expectedTier];
    const expectedName = tierList[i % 5];
    assert.equal(spec.name, expectedName, `Block name must match spec: ${spec.name} !== ${expectedName}`);
    assert.equal(blockDef.name, expectedName, `Catalog name must match expected: ${blockDef.name} !== ${expectedName}`);
    assert.equal(miscDef.name, `${expectedName} Specimen`, `Misc replica name must match expected: ${miscDef.name}`);
  }

  for (let t = 1; t <= 8; t++) {
    assert.equal(tierCount[t], 5, `Tier ${t} must contain exactly 5 farmable blocks`);
  }
});

test('Mock Canvas Context executes 32-bit, tier-framed Block and replica Specimen renderers without error for all 40 items', () => {
  // Headless mock context to verify every drawing branch
  function createMockCtx(): CanvasRenderingContext2D {
    return {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      globalAlpha: 1,
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

  const mockCtx = createMockCtx();

  for (let i = 0; i < 40; i++) {
    const blockId = 900 + i;
    const miscId = 950 + i;
    const blockDef = CATALOG[blockId];
    const miscDef = CATALOG[miscId];

    // Test 32-bit wrapper renderers
    assert.equal(drawFarmableBlock32(mockCtx, blockId, blockDef), true);
    assert.equal(drawFarmableSeed32(mockCtx, miscId, miscDef), true);

    // Test backward-compatible 48 aliases
    assert.equal(drawFarmableBlock48(mockCtx, blockId, blockDef), true);
    assert.equal(drawFarmableSeed48(mockCtx, miscId, miscDef), true);

    // Test raw high-detail art engines and tier frame outline
    assert.equal(drawFarmableBlockRaw48(mockCtx, blockId, blockDef), true);
    drawFarmableTierFrame48(mockCtx, blockId, blockDef);
    assert.equal(drawFarmableSeedRaw48(mockCtx, miscId, miscDef), true);
  }
});

