import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';
import { TILE_SIZE } from '../src/game/constants.ts';
import {
  GEM_DENOMINATIONS,
  GEM_RED_BASELINE_PREV,
  GEM_RED_RESCALED_EXACT,
  GEM_TIER_STEP_RATIO,
  GEM_TIERS,
  GEM_TIERS_ASCENDING,
  decomposeGemValue,
  getGemTierSpec,
  rollGemDropPositionInTile,
} from '../src/game/gems.ts';

test('Gem visual sizes follow +9% per tier from Yellow(1) to Purple(100) with Red rescaled by 0.85 * 0.85', () => {
  assert.deepEqual(
    GEM_TIERS_ASCENDING.map((t) => [t.tier, t.value]),
    [
      ['yellow', 1],
      ['blue', 5],
      ['red', 10],
      ['green', 50],
      ['purple', 100],
    ]
  );

  // Red is 24 * 0.85 * 0.85 = 17.34
  assert.ok(
    Math.abs(GEM_TIERS.red.exactSize - GEM_RED_BASELINE_PREV * 0.85 * 0.85) < 1e-6,
    `Expected Red exactSize to be ${GEM_RED_RESCALED_EXACT}, got ${GEM_TIERS.red.exactSize}`
  );

  // Each consecutive tier is strictly 9% larger in exact size
  for (let i = 0; i < GEM_TIERS_ASCENDING.length - 1; i++) {
    const cur = GEM_TIERS_ASCENDING[i];
    const next = GEM_TIERS_ASCENDING[i + 1];
    const ratio = next.exactSize / cur.exactSize;
    assert.ok(
      Math.abs(ratio - GEM_TIER_STEP_RATIO) < 1e-6,
      `Expected ${next.tier}/${cur.tier} ratio to be 1.09, got ${ratio}`
    );
    assert.ok(
      next.size > cur.size,
      `Expected snapped integer size of ${next.tier} (${next.size}) > ${cur.tier} (${cur.size})`
    );
  }

  assert.equal(getGemTierSpec(1).tier, 'yellow');
  assert.equal(getGemTierSpec(5).tier, 'blue');
  assert.equal(getGemTierSpec(10).tier, 'red');
  assert.equal(getGemTierSpec(50).tier, 'green');
  assert.equal(getGemTierSpec(100).tier, 'purple');
});

test('decomposeGemValue automatically sorts any gem total into exact denominations (e.g. 67 -> 1 green, 1 red, 1 blue, 2 yellow)', () => {
  assert.deepEqual(decomposeGemValue(67), [50, 10, 5, 1, 1]);
  assert.deepEqual(decomposeGemValue(167), [100, 50, 10, 5, 1, 1]);
  assert.deepEqual(decomposeGemValue(4), [1, 1, 1, 1]);
  assert.deepEqual(decomposeGemValue(15), [10, 5]);
  assert.deepEqual(decomposeGemValue(250), [100, 100, 50]);
  assert.deepEqual(decomposeGemValue(0), []);

  for (let total = 1; total <= 315; total++) {
    const parts = decomposeGemValue(total);
    const sum = parts.reduce((acc, v) => acc + v, 0);
    assert.equal(sum, total, `Sum mismatch for ${total}`);
    for (const p of parts) {
      assert.ok((GEM_DENOMINATIONS as readonly number[]).includes(p));
    }
  }
});

test('Gem drops spawn strictly randomized within their exact origin tile (tx, ty)', () => {
  const store = new AuthoritativeWorldStore();
  const reg = store.registerAccount({
    email: `gemtest_${Date.now()}@example.com`,
    username: `GemTester${Math.floor(Math.random() * 10000)}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const joined = store.joinWorld(reg.account, 'START');
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  const tx = 14;
  const ty = 22;

  // Test 67 gem spawn sorting + tile origin containment
  const drops67 = store.spawnSortedGemDrops(joined.world, 67, tx, ty, 'test67');
  assert.deepEqual(
    drops67.map((d) => d.qty),
    [50, 10, 5, 1, 1]
  );
  assert.equal(drops67.reduce((s, d) => s + d.qty, 0), 67);

  for (const drop of drops67) {
    assert.equal(drop.isGem, true);
    assert.equal(Math.floor(drop.x / TILE_SIZE), tx, `Drop x=${drop.x} escaped tile tx=${tx}`);
    assert.equal(Math.floor(drop.y / TILE_SIZE), ty, `Drop y=${drop.y} escaped tile ty=${ty}`);
  }

  // Verify positions are genuinely randomized across invocations (not static center/table)
  const samples = Array.from({ length: 12 }, () => rollGemDropPositionInTile(tx, ty));
  const uniqueCoords = new Set(samples.map((p) => `${p.x},${p.y}`));
  assert.ok(uniqueCoords.size >= 8, `Expected randomized coordinates within tile, got ${uniqueCoords.size}`);

  store.leaveWorld('START', reg.account.id, true);
});
