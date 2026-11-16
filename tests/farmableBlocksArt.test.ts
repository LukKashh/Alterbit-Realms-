import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG,
  FARMABLE_SPECS,
  ITEM_IDS,
  isFarmableSeed,
} from '../src/game/catalog.ts';
import {
  drawFarmableBlock32,
  drawFarmableSeed32,
  drawFarmableBlock48,
  drawFarmableSeed48,
  drawFarmableBlockRaw48,
  drawFarmableSeedRaw48,
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

test('All 40 Farmable Blocks and 40 Seeds are properly registered and structured across 8 tiers', () => {
  assert.equal(FARMABLE_SPECS.length, 40, 'Must have exactly 40 farmable specs');

  const tierCount: Record<number, number> = {};
  for (let t = 1; t <= 8; t++) {
    tierCount[t] = 0;
  }

  for (let i = 0; i < 40; i++) {
    const blockId = 900 + i;
    const seedId = 950 + i;

    const blockDef = CATALOG[blockId];
    const seedDef = CATALOG[seedId];
    const spec = FARMABLE_SPECS[i];

    assert.ok(blockDef, `Missing catalog entry for block ID ${blockId}`);
    assert.ok(seedDef, `Missing catalog entry for seed ID ${seedId}`);
    assert.ok(spec, `Missing farmable spec at index ${i}`);

    assert.equal(spec.id, blockId);
    assert.equal(spec.seedId, seedId);
    assert.equal(blockDef.category, 'farmable');
    assert.equal(seedDef.category, 'seed');
    assert.equal(seedDef.producesTileId, blockId);
    assert.equal(blockDef.seedId, seedId);
    assert.equal(isFarmableSeed(seedId), true);

    const expectedTier = Math.floor(i / 5) + 1;
    assert.equal(spec.tier, expectedTier, `Spec tier mismatch for ${spec.name}`);
    assert.equal(blockDef.farmableTier, expectedTier, `Block tier mismatch for ${blockDef.name}`);
    assert.equal(seedDef.farmableTier, expectedTier, `Seed tier mismatch for ${seedDef.name}`);

    tierCount[expectedTier]++;

    const tierList = EXPECTED_TIER_BLOCKS[expectedTier];
    const expectedName = tierList[i % 5];
    assert.equal(spec.name, expectedName, `Block name must match spec: ${spec.name} !== ${expectedName}`);
    assert.equal(blockDef.name, expectedName, `Catalog name must match expected: ${blockDef.name} !== ${expectedName}`);
    assert.equal(seedDef.name, `${expectedName} Seed`, `Seed name must match expected: ${seedDef.name}`);
  }

  for (let t = 1; t <= 8; t++) {
    assert.equal(tierCount[t], 5, `Tier ${t} must contain exactly 5 farmable blocks`);
  }
});

test('Mock Canvas Context executes 32-bit and raw Block and Seed renderers without error for all 40 items', () => {
  // Headless mock context to verify every drawing branch
  function createMockCtx(): CanvasRenderingContext2D {
    return {
      fillStyle: '#000000',
      fillRect: () => {},
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
    const seedId = 950 + i;
    const blockDef = CATALOG[blockId];
    const seedDef = CATALOG[seedId];

    // Test 32-bit wrapper renderers
    assert.equal(drawFarmableBlock32(mockCtx, blockId, blockDef), true);
    assert.equal(drawFarmableSeed32(mockCtx, seedId, seedDef), true);

    // Test backward-compatible 48 aliases
    assert.equal(drawFarmableBlock48(mockCtx, blockId, blockDef), true);
    assert.equal(drawFarmableSeed48(mockCtx, seedId, seedDef), true);

    // Test raw high-detail art engines
    assert.equal(drawFarmableBlockRaw48(mockCtx, blockId, blockDef), true);
    assert.equal(drawFarmableSeedRaw48(mockCtx, seedId, seedDef), true);
  }
});

