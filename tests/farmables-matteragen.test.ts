import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG,
  FARMABLE_SPECS,
  FURNACE_RECIPES,
  GEM_STORE_LISTINGS,
  getMatteragenBranch,
  getMatteragenIntervalMs,
  isFarmableSeed,
  ITEM_IDS,
  MATTERAGEN_UPGRADE_COSTS,
} from '../src/game/catalog.ts';
import { BEDROCK_ROWS, TILE_SIZE } from '../src/game/constants.ts';
import { canPlaceTile, tileIndexIn } from '../src/game/rules.ts';
import { generateWorld } from '../src/game/worldGen.ts';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';

test('40 Farmable Crops registry synced with catalog and general block seeds retired', () => {
  assert.equal(FARMABLE_SPECS.length, 40);

  const ids = new Set<number>();
  const seedIds = new Set<number>();
  const branches = new Set<string>();
  const tiers = new Set<number>();

  for (const spec of FARMABLE_SPECS) {
    assert.ok(spec.id >= 900 && spec.id <= 939, `Unexpected farmable block ID ${spec.id}`);
    assert.ok(spec.seedId >= 950 && spec.seedId <= 989, `Unexpected farmable seed ID ${spec.seedId}`);
    assert.equal(ids.has(spec.id), false);
    assert.equal(seedIds.has(spec.seedId), false);
    ids.add(spec.id);
    seedIds.add(spec.seedId);
    branches.add(spec.branch);
    tiers.add(spec.tier);

    const blockDef = CATALOG[spec.id];
    const seedDef = CATALOG[spec.seedId];
    assert.ok(blockDef, `Missing catalog block for ${spec.name}`);
    assert.ok(seedDef, `Missing catalog seed for ${spec.name}`);
    assert.equal(blockDef.category, 'farmable');
    assert.equal(seedDef.category, 'seed');
    assert.equal(seedDef.placeable, true);
    assert.equal(seedDef.producesTileId, spec.id);
    assert.equal(seedDef.growthTimeMs, spec.growthTimeSec * 1000);
    assert.equal(blockDef.hardness, spec.hardness);
    assert.equal(blockDef.gemValue, spec.gemValue);
    assert.equal(blockDef.xpValue, spec.xpValue);
    assert.equal(blockDef.treeHarvestYield?.minBlocks, spec.minBlocks);
    assert.equal(blockDef.treeHarvestYield?.maxBlocks, spec.maxBlocks);
    assert.equal(blockDef.treeHarvestYield?.seedChance, spec.seedDropRate);
    assert.equal(isFarmableSeed(spec.seedId), true);
  }

  assert.deepEqual(
    Array.from(branches).sort(),
    ['arcane', 'botanical', 'cosmic', 'geomineral', 'luminescent']
  );
  assert.deepEqual(Array.from(tiers).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);

  // All non-farmable seeds are disabled & purged from general block drops
  assert.equal(CATALOG[ITEM_IDS.GP_SEED_DIRT].placeable, false);
  assert.equal(CATALOG[ITEM_IDS.SEED_DESERT_SAND].placeable, false);
  assert.equal(isFarmableSeed(ITEM_IDS.GP_SEED_DIRT), false);

  const dirtDrops = CATALOG[ITEM_IDS.GP_DIRT].drops ?? [];
  assert.equal(
    dirtDrops.some((d) => CATALOG[d.itemId]?.category === 'seed'),
    false,
    'General dirt block must not drop non-farmable seeds'
  );
});

test('personal world generation is 30x50 with ~20% underground fill, WorldCore lock, and 1 per user limit', () => {
  const personal = generateWorld('MY_SANCTUARY', false, { isPersonalWorld: true });
  assert.equal(personal.width, 30);
  assert.equal(personal.height, 50);
  assert.equal(personal.fg.length, 1500);
  assert.equal(personal.bg.length, 1500);

  // Measure underground block fill ratio below surface horizon up to bedrock
  const undergroundStartY = Math.max(personal.spawnY + 2, 16);
  const undergroundEndY = personal.height - BEDROCK_ROWS;
  let totalUnderground = 0;
  let solidUnderground = 0;
  for (let y = undergroundStartY; y < undergroundEndY; y++) {
    for (let x = 0; x < personal.width; x++) {
      totalUnderground++;
      if (personal.fg[tileIndexIn(personal, x, y)] !== ITEM_IDS.AIR) {
        solidUnderground++;
      }
    }
  }
  const fillRatio = solidUnderground / totalUnderground;
  assert.ok(
    fillRatio >= 0.14 && fillRatio <= 0.27,
    `Underground fill ratio should be ~20% (got ${(fillRatio * 100).toFixed(1)}%)`
  );

  // Store enforces 1 personal sanctuary per user and locks via WorldCore
  const store = new AuthoritativeWorldStore();
  const suffix = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `owner_${suffix}@example.com`,
    username: `Owner_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const firstRealmName = `REALM1_${suffix.toUpperCase()}`;
  const secondRealmName = `REALM2_${suffix.toUpperCase()}`;
  const c1 = store.createOwnedWorld(reg.account, firstRealmName);
  assert.equal(c1.ok, true);
  assert.equal(store.getUserPersonalWorld(reg.account.id), firstRealmName);

  const c2 = store.createOwnedWorld(reg.account, secondRealmName);
  assert.equal(c2.ok, false, 'User must not be allowed to create a second personal sanctuary');
  assert.match(c2.message, /limited to 1 per user/i);

  const joined = store.joinWorld(reg.account, firstRealmName);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal(joined.world.state.width, 30);
  assert.equal(joined.world.state.height, 50);
  assert.equal(joined.world.state.worldLock?.lockItemId, ITEM_IDS.WORLD_CORE);
  assert.equal(joined.world.state.worldLock?.ownerId, reg.account.id);

  // Acquirable legacy locks (WORLD_LOCK, SMALL_LOCK) are not sold or placeable
  assert.equal(
    GEM_STORE_LISTINGS.some((l) =>
      l.grants.some((g) => g.itemId === ITEM_IDS.WORLD_LOCK || g.itemId === ITEM_IDS.SMALL_LOCK)
    ),
    false
  );
  store.leaveWorld(firstRealmName, reg.account.id, true);
});

test('Seed Pots cost 500 Gems with no crafting recipe and strictly hold 1 farmable seed at a time', () => {
  const seedPotListing = GEM_STORE_LISTINGS.find((l) => l.id === 'store_seed_pot');
  assert.ok(seedPotListing, 'Seed Pot must exist in GEM_STORE_LISTINGS');
  assert.equal(seedPotListing?.gemPrice, 500);
  assert.equal(seedPotListing?.grants[0]?.itemId, ITEM_IDS.SEED_POT);
  assert.equal(
    FURNACE_RECIPES.some((r) => r.outputItemId === ITEM_IDS.SEED_POT),
    false,
    'Seed Pot must have NO crafting recipe'
  );

  const store = new AuthoritativeWorldStore();
  const suffix = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `farmer_${suffix}@example.com`,
    username: `Farmer_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const acct = reg.account;
  acct.gems = 600;
  // Seed legacy inventory with a retired general seed & verify hydration purges it
  acct.inventory.push({ itemId: ITEM_IDS.GP_SEED_DIRT, qty: 12 });
  // Re-login hydrates defaults and strips non-farmable seeds
  const relogin = store.loginAccount({ identifier: acct.email, password: 'password123' });
  assert.equal(relogin.ok, true);
  if (!relogin.ok) return;
  assert.equal(
    relogin.account.inventory.some((s) => s.itemId === ITEM_IDS.GP_SEED_DIRT),
    false,
    'Non-farmable seeds must be cleared from player inventory'
  );

  const buyPot = store.handleBuyGemStore(relogin.account, 'store_seed_pot', `pot_${suffix}`);
  assert.equal(buyPot.ok, true);
  assert.equal(relogin.account.gems, 100);
  assert.equal(relogin.account.inventory.find((s) => s.itemId === ITEM_IDS.SEED_POT)?.qty, 1);

  const realmName = `FARM_${suffix.toUpperCase()}`;
  const created = store.createOwnedWorld(relogin.account, realmName);
  assert.equal(created.ok, true);
  const joined = store.joinWorld(relogin.account, realmName);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  const tx = joined.world.state.spawnX + 2;
  const ty = joined.world.state.spawnY;
  // Ensure clear tile above solid turf
  joined.world.state.fg[tileIndexIn(joined.world.state, tx, ty)] = ITEM_IDS.AIR;
  joined.world.state.fg[tileIndexIn(joined.world.state, tx, ty + 1)] = ITEM_IDS.GP_DIRT;

  store.addInventory(relogin.account, ITEM_IDS.SEED_FARM_SUGAR_CANE, 3);
  store.addInventory(relogin.account, ITEM_IDS.SEED_FARM_PEPPER_BUSH, 2);

  // Cannot plant without a Seed Pot
  const plantNoPot = store.handlePlaceTile(
    joined.world,
    relogin.account,
    ITEM_IDS.SEED_FARM_SUGAR_CANE,
    tx,
    ty
  );
  assert.equal(plantNoPot.ok, false);
  assert.match(plantNoPot.reason ?? '', /Seed Pot/i);

  // Place Seed Pot, then plant first Farmable Seed
  const placePot = store.handlePlaceTile(joined.world, relogin.account, ITEM_IDS.SEED_POT, tx, ty);
  assert.equal(placePot.ok, true);

  const plantFirst = store.handlePlaceTile(
    joined.world,
    relogin.account,
    ITEM_IDS.SEED_FARM_SUGAR_CANE,
    tx,
    ty
  );
  assert.equal(plantFirst.ok, true);
  assert.equal(joined.world.state.seedPots?.[`${tx},${ty}`]?.hasPlant, true);

  // Reject planting a second seed into an occupied Seed Pot (no splicing allowed)
  const plantSecond = store.handlePlaceTile(
    joined.world,
    relogin.account,
    ITEM_IDS.SEED_FARM_PEPPER_BUSH,
    tx,
    ty
  );
  assert.equal(plantSecond.ok, false);

  // Mature the tree & punch to harvest -> drops farmables while Seed Pot remains empty
  joined.world.state.plants[`${tx},${ty}`].plantedAt = Date.now() - 20000;
  joined.world.state.plants[`${tx},${ty}`].maturityAt = Date.now() - 1000;
  store['lastPunchAt'].delete(relogin.account.id);
  const harvest = store.handlePunchTile(joined.world, relogin.account, tx, ty);
  assert.equal(harvest.ok, true);
  if (harvest.ok) {
    assert.equal(harvest.broken, true);
    assert.equal(harvest.layer, 'plant');
    assert.ok(harvest.drops.length >= 1);
  }
  assert.equal(joined.world.state.plants[`${tx},${ty}`], undefined);
  assert.equal(joined.world.state.fg[tileIndexIn(joined.world.state, tx, ty)], ITEM_IDS.SEED_POT);
  assert.equal(joined.world.state.seedPots?.[`${tx},${ty}`]?.hasPlant, false);

  store.leaveWorld(realmName, relogin.account.id, true);
});

test('Matteragen Engines: 5 tiers/intervals, LV1-5 upgrades, 20 total world cap, single-yield latch & punch collect', () => {
  assert.equal(getMatteragenIntervalMs(ITEM_IDS.MATTERAGEN_BOTANICAL), 10 * 60 * 1000);
  assert.equal(getMatteragenIntervalMs(ITEM_IDS.MATTERAGEN_GEOMINERAL), 30 * 60 * 1000);
  assert.equal(getMatteragenIntervalMs(ITEM_IDS.MATTERAGEN_LUMINESCENT), 60 * 60 * 1000);
  assert.equal(getMatteragenIntervalMs(ITEM_IDS.MATTERAGEN_ARCANE), 120 * 60 * 1000);
  assert.equal(getMatteragenIntervalMs(ITEM_IDS.MATTERAGEN_COSMIC), 300 * 60 * 1000);

  assert.equal(getMatteragenBranch(ITEM_IDS.MATTERAGEN_BOTANICAL), 'botanical');
  assert.equal(getMatteragenBranch(ITEM_IDS.MATTERAGEN_GEOMINERAL), 'geomineral');
  assert.equal(getMatteragenBranch(ITEM_IDS.MATTERAGEN_LUMINESCENT), 'luminescent');
  assert.equal(getMatteragenBranch(ITEM_IDS.MATTERAGEN_ARCANE), 'arcane');
  assert.equal(getMatteragenBranch(ITEM_IDS.MATTERAGEN_COSMIC), 'cosmic');
  assert.deepEqual(MATTERAGEN_UPGRADE_COSTS, { 1: 250, 2: 500, 3: 1000, 4: 2000 });

  const store = new AuthoritativeWorldStore();
  const suffix = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `eng_${suffix}@example.com`,
    username: `Eng_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const acct = reg.account;
  acct.gems = 10000;
  const realmName = `MGEN_${suffix.toUpperCase()}`;
  assert.equal(store.createOwnedWorld(acct, realmName).ok, true);
  const joined = store.joinWorld(acct, realmName);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  const world = joined.world;
  const pState = world.players.get(acct.id)!;
  const baseTx = Math.max(4, world.state.spawnX - 10);
  const ty = world.state.spawnY;

  // Give mixed Matteragen Engines and place 20 across the floor
  store.addInventory(acct, ITEM_IDS.MATTERAGEN_BOTANICAL, 10);
  store.addInventory(acct, ITEM_IDS.MATTERAGEN_GEOMINERAL, 10);
  store.addInventory(acct, ITEM_IDS.MATTERAGEN_COSMIC, 2);

  for (let i = 0; i < 20; i++) {
    const rawTx = baseTx + i;
    const tx = rawTx >= world.state.spawnX ? rawTx + 1 : rawTx;
    world.state.fg[tileIndexIn(world.state, tx, ty)] = ITEM_IDS.AIR;
    world.state.fg[tileIndexIn(world.state, tx, ty + 1)] = ITEM_IDS.GP_DIRT;
    pState.x = (tx - 1) * TILE_SIZE;
    pState.y = (ty - 2) * TILE_SIZE;
    const typeId = i < 10 ? ITEM_IDS.MATTERAGEN_BOTANICAL : ITEM_IDS.MATTERAGEN_GEOMINERAL;
    const placed = store.handlePlaceTile(world, acct, typeId, tx, ty);
    assert.equal(placed.ok, true, `Failed placing engine #${i + 1}: ${placed.ok ? '' : placed.reason}`);
  }

  assert.equal(Object.keys(world.state.matteragenEngines ?? {}).length, 20);

  // 21st engine (even of a different tier) must be rejected by the 20-engine total cap
  const extraTx = baseTx + 22;
  world.state.fg[tileIndexIn(world.state, extraTx, ty)] = ITEM_IDS.AIR;
  world.state.fg[tileIndexIn(world.state, extraTx, ty + 1)] = ITEM_IDS.GP_DIRT;
  const blocked21 = canPlaceTile(
    world.state,
    { id: acct.id, x: (extraTx - 1) * TILE_SIZE, y: (ty - 2) * TILE_SIZE },
    ITEM_IDS.MATTERAGEN_COSMIC,
    extraTx,
    ty
  );
  assert.equal(blocked21.ok, false);
  assert.match(blocked21.reason ?? '', /20 Matteragen Engines/i);

  // Test upgrading one Botanical engine from LV 1 -> LV 5
  const firstKey = Object.keys(world.state.matteragenEngines!)[0];
  const targetEng = world.state.matteragenEngines![firstKey];
  for (let expectedLvl = 2; expectedLvl <= 5; expectedLvl++) {
    const up = store.upgradeMatteragenEngine(acct, realmName, targetEng.x, targetEng.y);
    assert.equal(up.ok, true);
    if (up.ok) assert.equal(up.level, expectedLvl);
  }
  const overUpgrade = store.upgradeMatteragenEngine(acct, realmName, targetEng.x, targetEng.y);
  assert.equal(overUpgrade.ok, false);

  // Single-yield synthesis latch + punch collection
  const interval = getMatteragenIntervalMs(targetEng.typeId);
  const baseTime = Date.now();
  targetEng.lastHarvestMs = baseTime - interval - 1000;
  const tick1 = store.tickAllWorlds(baseTime);
  assert.ok(
    tick1.completedEngines.some((e) => e.tx === targetEng.x && e.ty === targetEng.y),
    'Engine must complete cycle once interval elapses'
  );
  assert.equal(targetEng.isReady, true);
  const firstDropsSnapshot = JSON.stringify(targetEng.storedDrops);
  assert.ok((targetEng.storedDrops?.length ?? 0) >= 1);

  // Verify branch correctness of generated drops
  for (const d of targetEng.storedDrops ?? []) {
    const spec = FARMABLE_SPECS.find((s) => s.id === d.itemId || s.seedId === d.itemId);
    assert.equal(spec?.branch, getMatteragenBranch(targetEng.typeId));
  }

  // Subsequent ticks do NOT generate past the single yield until collected
  const tick2 = store.tickAllWorlds(baseTime + interval * 3);
  assert.equal(
    tick2.completedEngines.some((e) => e.tx === targetEng.x && e.ty === targetEng.y),
    false
  );
  assert.equal(JSON.stringify(targetEng.storedDrops), firstDropsSnapshot);

  // Move player within reach & punch ready engine -> collects drops, keeps engine, clears isReady
  pState.x = targetEng.x * TILE_SIZE;
  pState.y = (targetEng.y - 1) * TILE_SIZE;
  store['lastPunchAt'].delete(acct.id);
  const collectPunch = store.handlePunchTile(world, acct, targetEng.x, targetEng.y);
  assert.equal(collectPunch.ok, true);
  if (collectPunch.ok) {
    assert.equal(collectPunch.broken, false, 'Punching a ready engine collects yield without breaking engine');
    assert.ok(collectPunch.drops.length >= 1);
  }
  assert.equal(targetEng.isReady, false);
  assert.deepEqual(targetEng.storedDrops, []);
  assert.equal(
    world.state.fg[tileIndexIn(world.state, targetEng.x, targetEng.y)],
    targetEng.typeId
  );

  store.leaveWorld(realmName, acct.id, true);
});
