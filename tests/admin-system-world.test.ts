import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, getItemDef, ITEM_IDS, SPLICE_RECIPES } from '../src/game/catalog.ts';
import { isSystemWorld } from '../src/game/expansion.ts';
import { canBreakTile, canPlaceTile, tileIndexIn } from '../src/game/rules.ts';
import { generateWorld } from '../src/game/worldGen.ts';

test('System worlds reject regular player edits but allow adminWorldEdit modifications', () => {
  for (const worldName of ['NEXUS', 'DWELLER', 'FISHING', 'STATION']) {
    assert.equal(isSystemWorld(worldName), true);
    const world = generateWorld(worldName);
    const tx = 15;
    const ty = 15;
    world.fg[tileIndexIn(world, tx, ty)] = ITEM_IDS.GP_DIRT;

    const regularPlayer = {
      id: 'player_1',
      x: (tx - 1) * 48,
      y: ty * 48,
    };
    const regularBreak = canBreakTile(world, regularPlayer, tx, ty, 3);
    assert.equal(regularBreak.ok, false);
    assert.equal(regularBreak.reason, 'System worlds are indestructible.');

    const regularPlace = canPlaceTile(world, regularPlayer, ITEM_IDS.GP_BRICKS, tx + 1, ty - 2, 3);
    assert.equal(regularPlace.ok, false);
    assert.equal(regularPlace.reason, 'System worlds do not allow block placement.');

    const adminPlayer = {
      id: 'admin_1',
      x: 2 * 48,
      y: ty * 48,
      adminWorldEdit: true,
    };
    // Extended reach + bypass system world protection
    const adminBreak = canBreakTile(world, adminPlayer, tx, ty, 14);
    assert.equal(adminBreak.ok, true);

    // Admin can even place blocks mid-air without adjacent support or overlap blocking
    const adminPlace = canPlaceTile(world, adminPlayer, ITEM_IDS.GP_BRICKS, tx + 1, ty - 4, 16);
    assert.equal(adminPlace.ok, true);

    // Absolute bottom bedrock edge remains protected against breaking
    const bottomBreak = canBreakTile(world, adminPlayer, 2, world.height - 1, 100);
    assert.equal(bottomBreak.ok, false);
  }
});

test('Seediary recipes resolve cleanly to valid catalogue items', () => {
  assert.ok(SPLICE_RECIPES.length > 0);
  for (const recipe of SPLICE_RECIPES) {
    const seedA = getItemDef(recipe.seedA);
    const seedB = getItemDef(recipe.seedB);
    const result = CATALOG[recipe.resultSeedId];
    assert.ok(seedA && seedA.name, `Missing Seed A definition for ${recipe.seedA}`);
    assert.ok(seedB && seedB.name, `Missing Seed B definition for ${recipe.seedB}`);
    assert.ok(result && result.name, `Missing Result definition for ${recipe.resultSeedId}`);
  }
});
