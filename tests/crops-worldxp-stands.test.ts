import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG,
  CROP_SPECS,
  getItemDef,
  isCropBlock,
  isCropItem,
  isCropSeed,
  isForegroundSolid,
  isStandardBaselineBlock,
  ITEM_IDS,
  SPLICE_RECIPES,
  validateCatalogReferences,
} from '../src/game/catalog.ts';
import {
  canBreakTile,
  canPlaceTile,
  canPlowTile,
  getMarketStandAt,
  isIndestructiblePregenTile,
  tileIndexIn,
  worldXpForNextLevel,
} from '../src/game/rules.ts';
import { generateWorld, NEXUS_LAYOUT_VERSION } from '../src/game/worldGen.ts';
import { TILE_SIZE } from '../src/game/constants.ts';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';

test('Seed Pruning, Splicing Removal & 12.5% Standard Block Baseline Integrity', () => {
  // 1. Startup reference validator passes with zero dangling IDs
  const refCheck = validateCatalogReferences();
  assert.equal(refCheck.valid, true, `Expected zero dangling catalog references, got: ${refCheck.warnings.join('; ')}`);

  // 2. Splicing recipes are completely removed
  assert.equal(SPLICE_RECIPES.length, 0, 'SPLICE_RECIPES should be empty');

  // 3. Only Crop Seeds (1000..1005) and Farmable Seeds (950..989) exist in CATALOG
  const allSeeds = Object.values(CATALOG).filter((item) => item.category === 'seed');
  assert.equal(allSeeds.length, 46, 'Expected exactly 40 Farmable Seeds + 6 Crop Seeds');
  for (const seed of allSeeds) {
    const isAllowed =
      (seed.id >= 950 && seed.id <= 989) || (seed.id >= 1000 && seed.id <= 1005);
    assert.equal(isAllowed, true, `Unexpected non-farmable/non-crop seed still in CATALOG: #${seed.id} (${seed.name})`);
  }

  // 4. Standard baseline blocks have 12.5% self-drop, 0 Gems, 1 XP, and no seedId
  for (const item of Object.values(CATALOG)) {
    if (isStandardBaselineBlock(item)) {
      assert.equal(item.seedId, undefined, `${item.name} should not have a parent seedId`);
      assert.equal(item.gemValue ?? 0, 0, `${item.name} should have 0 gemValue`);
      assert.equal(item.xpValue ?? 1, 1, `${item.name} should have 1 xpValue`);
      assert.ok(item.drops && item.drops.length === 1, `${item.name} should have 1 self-drop entry`);
      assert.equal(item.drops![0].itemId, item.id);
      assert.equal(item.drops![0].chance, 0.125);
    }
  }
});

test('All placeable signs are walkthrough (collision: none) while remaining placeable & breakable', () => {
  const signIds = [
    ITEM_IDS.GP_SIGN,
    ITEM_IDS.GP_CRAPPY_SIGN,
    ITEM_IDS.GP_POINTY_SIGN,
    ITEM_IDS.GP_DANGER_SIGN,
  ];
  for (const id of signIds) {
    const def = getItemDef(id);
    assert.ok(def, `Sign definition missing for ID ${id}`);
    assert.equal(def.collision, 'none', `${def.name} should have collision 'none'`);
    assert.equal(isForegroundSolid(id), false, `${def.name} should not block player movement`);
    assert.equal(def.placeable, true, `${def.name} should remain placeable`);
    assert.equal(def.breakable, true, `${def.name} should remain breakable`);
  }
});

test('NEXUS Sci-Fi Floating Platform Hub spawns Center Entry Deck, West Market Deck, East Steward Deck & Upper Command Deck', () => {
  const nexus = generateWorld('NEXUS');
  assert.equal(nexus.width, 100);
  assert.equal(nexus.height, 60);
  assert.equal(nexus.spawnX, 50);
  assert.equal(nexus.spawnY, 29);
  assert.equal(nexus.nexusLayoutVersion, NEXUS_LAYOUT_VERSION);

  // Center Entry Portal at (50, 29), Single Multi-Way Background Door at (53, 29), and adjacent pass-through WOODEN_SIGN blocks
  assert.equal(nexus.fg[tileIndexIn(nexus, 50, 29)], ITEM_IDS.ENTRANCE_PORTAL);
  assert.equal(nexus.bg[tileIndexIn(nexus, 53, 29)], ITEM_IDS.SCIFI_AIRLOCK_DOOR);
  assert.equal(nexus.fg[tileIndexIn(nexus, 53, 29)], ITEM_IDS.AIR);
  assert.equal(nexus.fg[tileIndexIn(nexus, 47, 29)], ITEM_IDS.WOODEN_SIGN);
  assert.equal(nexus.fg[tileIndexIn(nexus, 52, 29)], ITEM_IDS.WOODEN_SIGN);
  assert.equal(nexus.fg[tileIndexIn(nexus, 55, 29)], ITEM_IDS.WOODEN_SIGN);
  assert.equal(nexus.signs?.['47,29'], '← Fresh Greens');
  assert.equal(nexus.signs?.['52,29'], '↑ Global Exchange');
  assert.equal(nexus.signs?.['55,29'], 'Realm Steward →');

  // Return background doors on West (31, 27), East (69, 27), and Upper (51, 17) decks
  assert.equal(nexus.bg[tileIndexIn(nexus, 31, 27)], ITEM_IDS.SCIFI_AIRLOCK_DOOR);
  assert.equal(nexus.bg[tileIndexIn(nexus, 69, 27)], ITEM_IDS.SCIFI_AIRLOCK_DOOR);
  assert.equal(nexus.bg[tileIndexIn(nexus, 51, 17)], ITEM_IDS.SCIFI_AIRLOCK_DOOR);

  // West Marketplace Deck: Fresh Greens Vendor at (25, 27)
  const greensAnchorX = 25;
  const greensAnchorY = 27;
  assert.equal(
    nexus.fg[tileIndexIn(nexus, greensAnchorX, greensAnchorY)],
    ITEM_IDS.GREENS_VENDOR_NPC,
    'Fresh Greens Vendor NPC anchor should be at (25, 27) on the West Deck'
  );

  // East Realm Steward Deck: Landlord NPC at (75, 27)
  const landlordAnchorX = 75;
  const landlordAnchorY = 27;
  assert.equal(
    nexus.fg[tileIndexIn(nexus, landlordAnchorX, landlordAnchorY)],
    ITEM_IDS.LANDLORD_NPC,
    'Landlord NPC anchor should be at (75, 27) on the East Deck'
  );

  // Upper Command Deck: Global Exchange Terminal at (43, 17); Stone Furnace removed from NEXUS
  assert.equal(nexus.fg[tileIndexIn(nexus, 43, 17)], ITEM_IDS.EXCHANGE_TERMINAL);
  assert.equal(nexus.fg[tileIndexIn(nexus, 57, 17)], ITEM_IDS.AIR);

  // Verify 3x2 market stand hitboxes on West and East decks
  for (let dy = -1; dy <= 0; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const lStand = getMarketStandAt(nexus, landlordAnchorX + dx, landlordAnchorY + dy);
      assert.ok(lStand);
      assert.equal(lStand.kind, 'landlord');

      const gStand = getMarketStandAt(nexus, greensAnchorX + dx, greensAnchorY + dy);
      assert.ok(gStand);
      assert.equal(gStand.kind, 'greens_vendor');
    }
  }
});

test('50x40 Personal World Preset, Indestructible Pregen Foundation, Starter Supply Lootbox & Pure-Digibits Farming Loop', () => {
  const store = new AuthoritativeWorldStore();
  const suffix = Date.now().toString(36);
  const farmer = store.getOrCreatePlayer(`farmer_crop_${suffix}`, 'CropFarmer');
  const visitor = store.getOrCreatePlayer(`visitor_crop_${suffix}`, 'Visitor');

  // 1. Conjure a 50x40 Personal World via Landlord
  const realmName = `FARM_${suffix.slice(-6).toUpperCase()}`;
  const created = store.createOwnedWorld(farmer, realmName, false);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const joinRes = store.joinWorld(farmer, created.worldName);
  assert.equal(joinRes.ok, true);
  if (!joinRes.ok) return;
  const live = joinRes.world;

  // Verify 50x40 dimensions & Pregen structure
  assert.equal(live.state.width, 50);
  assert.equal(live.state.height, 40);
  assert.equal(live.state.spawnX, 25);
  assert.equal(live.state.spawnY, 19);

  // Lower 5-wide platform (x = 23..27, y = 20) and Upper 5-wide platform (x = 23..27, y = 16) with WORLD_CORE at (25, 16)
  for (let x = 23; x <= 27; x++) {
    assert.equal(live.state.fg[tileIndexIn(live.state, x, 20)], ITEM_IDS.GP_ROCK);
    assert.equal(isIndestructiblePregenTile(live.state, x, 20), true);
    assert.equal(isIndestructiblePregenTile(live.state, x, 16), true);
  }
  assert.equal(live.state.fg[tileIndexIn(live.state, 25, 16)], ITEM_IDS.WORLD_CORE);
  assert.equal(live.state.fg[tileIndexIn(live.state, 25, 19)], ITEM_IDS.ENTRANCE_PORTAL);
  assert.equal(live.state.fg[tileIndexIn(live.state, 26, 19)], ITEM_IDS.STARTER_LOOTBOX);

  // Even the world owner cannot break the Indestructible Pregen Foundation
  const pState = live.players.get(farmer.id)!;
  pState.x = 25 * TILE_SIZE;
  pState.y = 19 * TILE_SIZE;
  const breakPregen = canBreakTile(live.state, { id: farmer.id, x: pState.x, y: pState.y }, 25, 20);
  assert.equal(breakPregen.ok, false, 'Owner must not be able to break Indestructible Pregen Foundation');

  // Visitor cannot break the owner's Starter Supply Lootbox even if given Share Lock / public access
  live.state.worldLock!.publicAccess = true;
  live.state.worldLock!.editors.push(visitor.id);
  const visitorLootboxCheck = canBreakTile(
    live.state,
    { id: visitor.id, x: pState.x, y: pState.y },
    26,
    19
  );
  assert.equal(visitorLootboxCheck.ok, false, 'Visitors must not be able to break the Starter Supply Lootbox');

  // 2. Owner breaks Starter Supply Lootbox at (26, 19) -> receives 1x Hoe, 25x Dirt, 3x Radish Seeds
  for (let hit = 0; hit < 4; hit++) {
    (store as unknown as { lastPunchAt: Map<string, number> }).lastPunchAt.clear();
    const res = store.handlePunchTile(live, farmer, 26, 19, ITEM_IDS.FIST);
    assert.equal(res.ok, true);
    if (res.ok && res.broken) break;
  }
  assert.equal(live.state.fg[tileIndexIn(live.state, 26, 19)], ITEM_IDS.AIR);
  assert.equal(farmer.hasClaimedStarterLootbox, true);
  assert.ok(farmer.inventory.some((s) => s.itemId === ITEM_IDS.FARMING_HOE && s.qty >= 1));
  assert.ok(farmer.inventory.some((s) => s.itemId === ITEM_IDS.GP_DIRT && s.qty >= 25));
  assert.ok(farmer.inventory.some((s) => s.itemId === ITEM_IDS.CROP_SEED_RADISH && s.qty >= 3));

  // 3. Plow a non-pregen Dirt tile at x = 28, y = 20 and sow Radish Seed at (28, 19)
  const tx = 28;
  const groundY = 20;
  const plantY = 19;
  pState.x = 27 * TILE_SIZE;
  pState.y = 19 * TILE_SIZE;

  const plowRes = store.handlePlowTile(live, farmer, tx, groundY);
  assert.equal(plowRes.ok, true);
  assert.equal(live.state.fg[tileIndexIn(live.state, tx, groundY)], ITEM_IDS.PLOWED_DIRT_SOIL);

  const radishSpec = CROP_SPECS[0];
  const placeSeedRes = store.handlePlaceTile(live, farmer, radishSpec.seedId, tx, plantY);
  assert.equal(placeSeedRes.ok, true);

  // 4. Mature crop & harvest -> spawns Crop Block -> mine Crop Block -> pick up Crops -> sell for Digibits
  const plantKey = `${tx},${plantY}`;
  live.state.plants[plantKey].maturityAt = Date.now() - 1000;
  (store as unknown as { lastPunchAt: Map<string, number> }).lastPunchAt.clear();
  const harvestRes = store.handlePunchTile(live, farmer, tx, plantY, ITEM_IDS.FIST);
  assert.equal(harvestRes.ok, true);
  assert.equal(live.state.fg[tileIndexIn(live.state, tx, plantY)], radishSpec.blockId);
  assert.equal(isCropBlock(live.state.fg[tileIndexIn(live.state, tx, plantY)]), true);

  let mineRes = harvestRes;
  for (let hit = 0; hit < 4; hit++) {
    (store as unknown as { lastPunchAt: Map<string, number> }).lastPunchAt.clear();
    const step = store.handlePunchTile(live, farmer, tx, plantY, ITEM_IDS.FIST);
    assert.equal(step.ok, true);
    if (step.ok) {
      mineRes = step;
      if (step.broken) break;
    }
  }
  assert.equal(mineRes.ok && mineRes.broken, true);
  const cropDrops = mineRes.ok ? mineRes.drops.filter((d) => !d.isGem) : [];
  assert.equal(cropDrops.length, 1);
  assert.equal(cropDrops[0].itemId, radishSpec.cropItemId);
  assert.equal(isCropItem(cropDrops[0].itemId), true);

  const pickupRes = store.handlePickupDrop(live, farmer, cropDrops[0].id);
  assert.equal(pickupRes.ok, true);
  const harvestedQty = cropDrops[0].qty;

  const sellRes = store.handleVendorAction(farmer, { action: 'sell_all_crops' });
  assert.equal(sellRes.ok, true);
  assert.equal(farmer.alterbits, harvestedQty * radishSpec.sellAlterbits);

  // 5. Buy Crop Seeds using Digibits
  farmer.alterbits += 160;
  const buyCarrotSeed = store.handleVendorAction(farmer, {
    action: 'buy_seed',
    itemId: ITEM_IDS.CROP_SEED_CARROT,
    qty: 2,
    currency: 'digibits',
  });
  assert.equal(buyCarrotSeed.ok, true);
  assert.ok(farmer.inventory.some((s) => s.itemId === ITEM_IDS.CROP_SEED_CARROT && s.qty === 2));

  // 6. Verify 0-DB emergency Hoe Reclaim if Hoe is missing
  farmer.inventory = farmer.inventory.filter((s) => s.itemId !== ITEM_IDS.FARMING_HOE);
  const reclaimRes = store.handleVendorAction(farmer, { action: 'reclaim_hoe' });
  assert.equal(reclaimRes.ok, true);
  assert.ok(farmer.inventory.some((s) => s.itemId === ITEM_IDS.FARMING_HOE && s.qty === 1));
});

test('World Leveling: Owner actions inside owned world grant World XP and level up the World', () => {
  const store = new AuthoritativeWorldStore();
  const suffix = Date.now().toString(36);
  const owner = store.getOrCreatePlayer(`world_xp_owner_${suffix}`, 'RealmOwner');
  const visitor = store.getOrCreatePlayer(`world_xp_visitor_${suffix}`, 'Visitor');

  const realmName = `XPW_${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const created = store.createOwnedWorld(owner, realmName, false);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const joinOwner = store.joinWorld(owner, created.worldName);
  assert.equal(joinOwner.ok, true);
  if (!joinOwner.ok) return;
  const live = joinOwner.world;

  assert.equal(live.state.worldLevel, 1);
  assert.equal(live.state.worldXp, 0);

  const pState = live.players.get(owner.id)!;
  const tx = 28; // Outside the 5-wide pregen platform (23..27)
  const ty = live.state.spawnY;
  pState.x = 27 * TILE_SIZE;
  pState.y = live.state.spawnY * TILE_SIZE;

  live.state.fg[tileIndexIn(live.state, tx, ty)] = ITEM_IDS.GP_DIRT;
  for (let i = 0; i < 4; i++) {
    (store as unknown as { lastPunchAt: Map<string, number> }).lastPunchAt.clear();
    const res = store.handlePunchTile(live, owner, tx, ty, ITEM_IDS.FIST);
    if (res.ok && res.broken) {
      assert.ok(res.worldXpUpdate, 'Breaking block as owner inside owned world should return worldXpUpdate');
      break;
    }
  }
  assert.ok((live.state.worldXp ?? 0) > 0, 'World XP should increase after owner breaks block');

  // Non-owner breaking a block inside the world must NOT grant World XP
  const xpBeforeVisitor = live.state.worldXp ?? 0;
  live.state.worldLock!.publicAccess = true;
  live.state.worldLock!.editors.push(visitor.id);
  const joinVisitor = store.joinWorld(visitor, created.worldName);
  assert.equal(joinVisitor.ok, true);
  const vState = live.players.get(visitor.id)!;
  vState.x = pState.x;
  vState.y = pState.y;

  live.state.fg[tileIndexIn(live.state, tx, ty)] = ITEM_IDS.GP_DIRT;
  for (let i = 0; i < 4; i++) {
    (store as unknown as { lastPunchAt: Map<string, number> }).lastPunchAt.clear();
    const res = store.handlePunchTile(live, visitor, tx, ty, ITEM_IDS.FIST);
    if (res.ok && res.broken) {
      assert.equal(res.worldXpUpdate, null, 'Non-owner actions must not grant World XP');
      break;
    }
  }
  assert.equal(live.state.worldXp, xpBeforeVisitor, 'World XP must remain unchanged after non-owner action');

  const needed = worldXpForNextLevel(1);
  assert.equal(needed, 100);
});

test('SysEdit bypasses System World, Indestructible Pregen, and Locked World restrictions for any selected item or tool', () => {
  const store = new AuthoritativeWorldStore();
  const suffix = Date.now().toString(36);
  const owner = store.getOrCreatePlayer(`lock_owner_${suffix}`, 'LockOwner');
  const admin = store.getOrCreatePlayer(`admin_sys_${suffix}`, 'GameDev');
  admin.role = 'admin';

  const realmName = `LOCK_${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const created = store.createOwnedWorld(owner, realmName, false);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const joinAdmin = store.joinWorld(admin, created.worldName);
  assert.equal(joinAdmin.ok, true);
  if (!joinAdmin.ok) return;
  const live = joinAdmin.world;
  const aState = live.players.get(admin.id)!;
  const tx = 28;
  const ty = live.state.spawnY;
  aState.x = 27 * TILE_SIZE;
  aState.y = live.state.spawnY * TILE_SIZE;
  live.state.fg[tileIndexIn(live.state, tx, ty)] = ITEM_IDS.AIR;

  // Without SysEdit (adminEdit = false), admin is blocked by the owner's lock
  assert.equal(
    canPlaceTile(live.state, { id: admin.id, x: aState.x, y: aState.y, adminWorldEdit: false }, ITEM_IDS.GP_BRICKS, tx, ty).ok,
    false
  );

  // With SysEdit (adminEdit = true), admin can place and break blocks and signs freely
  const placeBricks = store.handlePlaceTile(live, admin, ITEM_IDS.GP_BRICKS, tx, ty, true);
  assert.equal(placeBricks.ok, true);
  assert.equal(live.state.fg[tileIndexIn(live.state, tx, ty)], ITEM_IDS.GP_BRICKS);

  (store as unknown as { lastPunchAt: Map<string, number> }).lastPunchAt.clear();
  const breakBricks = store.handlePunchTile(live, admin, tx, ty, ITEM_IDS.FIST, true);
  assert.equal(breakBricks.ok, true);
  assert.equal(live.state.fg[tileIndexIn(live.state, tx, ty)], ITEM_IDS.AIR);

  const placeSign = store.handlePlaceTile(live, admin, ITEM_IDS.GP_SIGN, tx, ty, true);
  assert.equal(placeSign.ok, true);
  const editSign = store.handleConfigureSign(live, admin, tx, ty, 'Admin Welcome Sign');
  assert.equal(editSign.ok, true);
});

test('Doors as Background Gateway Blocks, Gem Store Pot-Only Farming Listings, Core Tokens (0.85%-10% Owner-Only), and Admin Inventory Slot Deletion', async () => {
  const {
    CORE_TOKEN_MAX_CHANCE,
    CORE_TOKEN_MIN_CHANCE,
    GEM_STORE_LISTINGS,
    getCoreTokenSpawnChance,
    MATTERAGEN_UPGRADE_COSTS,
  } = await import('../src/game/catalog.ts');

  // 1. Doors are Background blocks with collision 'none'
  const doorDef = getItemDef(ITEM_IDS.GP_DOOR);
  const dungeonDoorDef = getItemDef(ITEM_IDS.GP_DUNGEON_DOOR);
  assert.ok(doorDef && dungeonDoorDef);
  assert.equal(doorDef.category, 'background');
  assert.equal(doorDef.collision, 'none');
  assert.equal(dungeonDoorDef.category, 'background');
  assert.equal(dungeonDoorDef.collision, 'none');

  // 2. Gem Store Farming ('seeds') section keeps ONLY the two Seed Pot listings
  const farmingListings = GEM_STORE_LISTINGS.filter((l) => l.section === 'seeds');
  assert.deepEqual(
    farmingListings.map((l) => l.id),
    ['store_seed_pot', 'store_seed_pot_bundle'],
    'Gem Store Farming section must contain only the two Seed Pot listings'
  );

  // 3. Core Token spawn odds strictly bounded between 0.85% (0.0085) and 10.0% (0.10)
  assert.equal(getCoreTokenSpawnChance({ kind: 'block_break' }), CORE_TOKEN_MIN_CHANCE);
  assert.equal(CORE_TOKEN_MIN_CHANCE, 0.0085);
  assert.equal(CORE_TOKEN_MAX_CHANCE, 0.10);

  let prevCropChance = 0;
  for (const tier of [1, 2, 3, 4, 5, 6] as const) {
    const ch = getCoreTokenSpawnChance({ kind: 'soil_crop', tier });
    assert.ok(ch >= CORE_TOKEN_MIN_CHANCE && ch <= CORE_TOKEN_MAX_CHANCE);
    assert.ok(ch > prevCropChance, `Crop tier ${tier} chance should exceed tier ${tier - 1}`);
    prevCropChance = ch;
  }

  let prevFarmableChance = 0;
  for (const tier of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    const ch = getCoreTokenSpawnChance({ kind: 'farmable_harvest', tier });
    assert.ok(ch >= CORE_TOKEN_MIN_CHANCE && ch <= CORE_TOKEN_MAX_CHANCE);
    assert.ok(ch > prevFarmableChance, `Farmable tier ${tier} chance should exceed tier ${tier - 1}`);
    prevFarmableChance = ch;
  }

  const maxEngineChance = getCoreTokenSpawnChance({
    kind: 'matteragen_harvest',
    branchTier: 5,
    level: 5,
  });
  assert.equal(maxEngineChance, 0.10, 'Wealthiest source (Cosmic Engine Lv.5) should cap at 10%');

  // 4. Core Tokens are world-relative, earned only by the World Owner (+1 per proc), and used to upgrade Matteragen Engines
  const store = new AuthoritativeWorldStore();
  const suffix = Date.now().toString(36);
  const owner = store.getOrCreatePlayer(`ct_owner_${suffix}`, 'TokenOwner');
  const visitor = store.getOrCreatePlayer(`ct_visitor_${suffix}`, 'TokenVisitor');
  const admin = store.getOrCreatePlayer(`ct_admin_${suffix}`, 'TokenAdmin');
  admin.role = 'admin';

  const created = store.createOwnedWorld(owner, `CT_${suffix.slice(-5).toUpperCase()}`, false);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const joinRes = store.joinWorld(owner, created.worldName);
  assert.equal(joinRes.ok, true);
  if (!joinRes.ok) return;
  const live = joinRes.world;
  assert.equal(live.state.coreTokens ?? 0, 0);

  // Forced rng = 0.001 (< 0.0085) awards exactly +1 Core Token to the world for the owner, and 0 for visitor
  const vAward = store.tryAwardCoreToken(live, visitor, { kind: 'soil_crop', tier: 6 }, () => 0.0001);
  assert.equal(vAward, false, 'Non-owner must never earn Core Tokens for the world');
  assert.equal(live.state.coreTokens ?? 0, 0);

  const oAward = store.tryAwardCoreToken(live, owner, { kind: 'soil_crop', tier: 1 }, () => 0.0001);
  assert.equal(oAward, true, 'Owner proc must award strictly +1 Core Token');
  assert.equal(live.state.coreTokens, 1);

  // Place a Matteragen Engine and upgrade it using World Core Tokens (not player Gems)
  const pState = live.players.get(owner.id)!;
  const engX = 28;
  const engY = live.state.spawnY;
  pState.x = 27 * TILE_SIZE;
  pState.y = engY * TILE_SIZE;
  owner.inventory.push({ itemId: ITEM_IDS.MATTERAGEN_BOTANICAL, qty: 1 });
  const placeEng = store.handlePlaceTile(live, owner, ITEM_IDS.MATTERAGEN_BOTANICAL, engX, engY);
  assert.equal(placeEng.ok, true);

  // Upgrading Lv.1 -> Lv.2 requires MATTERAGEN_UPGRADE_COSTS[1] (3 Core Tokens)
  const lv2Cost = MATTERAGEN_UPGRADE_COSTS[1];
  assert.equal(lv2Cost, 3);
  const failUpg = store.upgradeMatteragenEngine(owner, created.worldName, engX, engY);
  assert.equal(failUpg.ok, false, 'Upgrade should fail when WorldCore has only 1 Core Token');

  live.state.coreTokens = 5;
  const okUpg = store.upgradeMatteragenEngine(owner, created.worldName, engX, engY);
  assert.equal(okUpg.ok, true);
  assert.equal(live.state.coreTokens, 5 - lv2Cost);
  assert.equal(live.state.matteragenEngines![`${engX},${engY}`].level, 2);

  // 5. Place a Background Door and link it as a Gateway
  owner.inventory.push({ itemId: ITEM_IDS.GP_DOOR, qty: 1 });
  const doorX = 29;
  const doorY = live.state.spawnY;
  pState.x = 28 * TILE_SIZE;
  const placeDoor = store.handlePlaceTile(live, owner, ITEM_IDS.GP_DOOR, doorX, doorY);
  assert.equal(placeDoor.ok, true);
  assert.equal(live.state.bg[tileIndexIn(live.state, doorX, doorY)], ITEM_IDS.GP_DOOR);

  const cfgDoor = store.handleConfigureDoor(live, owner, doorX, doorY, 25, 15, 'Upper Platform');
  assert.equal(cfgDoor.ok, true);
  const useDoor = store.handleUseDoor(live, owner, doorX, doorY);
  assert.equal(useDoor.ok, true);
  if (useDoor.ok) {
    assert.equal(useDoor.targetX, 25);
    assert.equal(useDoor.targetY, 15);
  }

  // 6. Admin delete_inventory_slot & clear_inventory
  admin.inventory.push({ itemId: ITEM_IDS.GP_DIRT, qty: 20 });
  admin.inventory.push({ itemId: ITEM_IDS.GP_ROCK, qty: 10 });
  const delSlot = store.handleAdminAction(admin, live, {
    action: 'delete_inventory_slot',
    itemId: ITEM_IDS.GP_DIRT,
  });
  assert.equal(delSlot.ok, true);
  assert.equal(admin.inventory.some((s) => s.itemId === ITEM_IDS.GP_DIRT), false);
  assert.equal(admin.inventory.some((s) => s.itemId === ITEM_IDS.GP_ROCK), true);

  const clearInv = store.handleAdminAction(admin, live, { action: 'clear_inventory' });
  assert.equal(clearInv.ok, true);
  assert.deepEqual(
    admin.inventory.map((s) => s.itemId),
    [ITEM_IDS.FIST, ITEM_IDS.WRENCH],
    'Clearing inventory must leave only FIST and WRENCH'
  );
});

test('Backpack 20-slot cap, 500-unit unique-stack ceiling, Trash item & Crop Mastery unlocks', async () => {
  const { MAX_INVENTORY_SLOTS, MAX_INVENTORY_STACK } = await import('../src/game/constants.ts');
  const { getCropMasteryRequiredLevel } = await import('../src/game/rules.ts');
  assert.equal(MAX_INVENTORY_SLOTS, 20);
  assert.equal(MAX_INVENTORY_STACK, 500);

  const store = new AuthoritativeWorldStore();
  const suffix = Date.now().toString(36);
  const reg = store.registerAccount({
    email: `cap_${suffix}@example.com`,
    username: `Cap_${suffix.slice(-6)}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  const acct = reg.account;

  const realmName = `CAP_${suffix.slice(-5).toUpperCase()}`;
  assert.equal(store.createOwnedWorld(acct, realmName).ok, true);
  const joined = store.joinWorld(acct, realmName);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  const live = joined.world;

  // Fill 20 unique bag slots (using Farmable IDs 900..919)
  for (let i = 0; i < 20; i++) {
    const added = store.addInventoryPartial(acct, 900 + i, 500).added;
    assert.equal(added, 500);
  }
  // 21st unique item is rejected when bag already holds 20 non-default slots
  const overSlot = store.addInventoryPartial(acct, 920, 1).added;
  assert.equal(overSlot, 0, '21st unique item must not fit into 20-slot Backpack');

  // Adding more of item 900 (already at 500) must NOT create a duplicate second slot
  const dupAdd = store.addInventoryPartial(acct, 900, 25).added;
  assert.equal(dupAdd, 0, 'Duplicate item beyond 500 stack must be blocked');
  assert.equal(acct.inventory.filter((s) => s.itemId === 900).length, 1);

  // Trash item 900 to free space and verify pickup works again
  const trashRes = store.trashInventoryItem(acct, { itemId: 900 });
  assert.equal(trashRes.ok, true);
  assert.equal(acct.inventory.some((s) => s.itemId === 900), false);
  const afterTrashAdd = store.addInventoryPartial(acct, 920, 40).added;
  assert.equal(afterTrashAdd, 40);

  // Crop Mastery gates Cabbage Seed at Lv.2
  assert.equal(getCropMasteryRequiredLevel(ITEM_IDS.CROP_SEED_CABBAGE), 2);
  acct.alterbits = 500;
  acct.cropMasteryLevel = 1;
  const lockedBuy = store.handleVendorAction(acct, {
    action: 'buy_seed',
    itemId: ITEM_IDS.CROP_SEED_CABBAGE,
    qty: 1,
    currency: 'digibits',
  });
  assert.equal(lockedBuy.ok, false);

  acct.cropMasteryLevel = 2;
  assert.equal(store.trashInventoryItem(acct, { itemId: 901 }).ok, true);
  const unlockedBuy = store.handleVendorAction(acct, {
    action: 'buy_seed',
    itemId: ITEM_IDS.CROP_SEED_CABBAGE,
    qty: 1,
    currency: 'digibits',
  });
  assert.equal(unlockedBuy.ok, true);
  store.leaveWorld(realmName, acct.id, true);
});

test('Auto-sort inventory by category, Jump Height +1.25 blocks, NEXUS door panel-only, Entrance Portal reset & Sign/Door access restrictions', async () => {
  const { JUMP_VELOCITY, GRAVITY, TILE_SIZE: TS } = await import('../src/game/constants.ts');
  const { getInventorySortRank } = await import('../src/game/rules.ts');
  assert.equal(JUMP_VELOCITY, -769);
  const maxJumpPx = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
  const jumpBlocks = maxJumpPx / TS;
  assert.ok(
    jumpBlocks >= 3.3 && jumpBlocks <= 3.36,
    `Expected ~3.33 blocks jump height (+1.25 over 2.08), got ${jumpBlocks.toFixed(2)}`
  );

  const store = new AuthoritativeWorldStore();
  const suffix = Date.now().toString(36);
  const ownerReg = store.registerAccount({
    email: `sort_${suffix}@example.com`,
    username: `Owner_${suffix.slice(-5)}`,
    password: 'password123',
  });
  const guestReg = store.registerAccount({
    email: `guest_${suffix}@example.com`,
    username: `Guest_${suffix.slice(-5)}`,
    password: 'password123',
  });
  assert.equal(ownerReg.ok && guestReg.ok, true);
  if (!ownerReg.ok || !guestReg.ok) return;
  const owner = ownerReg.account;
  const guest = guestReg.account;

  // Add mixed categories in random order (wearable, background, seed, tool, crop, foreground)
  store.addInventoryPartial(owner, ITEM_IDS.WEAR_GOLD_CROWN, 1);
  store.addInventoryPartial(owner, ITEM_IDS.GP_WOODEN_BACKGROUND, 5);
  store.addInventoryPartial(owner, ITEM_IDS.CROP_SEED_CARROT, 3);
  store.addInventoryPartial(owner, ITEM_IDS.GP_DIRT, 10);
  store.addInventoryPartial(owner, ITEM_IDS.IRON_PICKAXE, 1);
  store.addInventoryPartial(owner, ITEM_IDS.CROP_RADISH, 4);

  // Verify Fist stays slot 0, Wrench stays slot 1, and remaining items are ordered by getInventorySortRank
  assert.equal(owner.inventory[0].itemId, ITEM_IDS.FIST);
  assert.equal(owner.inventory[1].itemId, ITEM_IDS.WRENCH);
  for (let i = 1; i < owner.inventory.length; i++) {
    assert.ok(
      getInventorySortRank(owner.inventory[i - 1].itemId) <= getInventorySortRank(owner.inventory[i].itemId),
      `Inventory slot ${i - 1} (${owner.inventory[i - 1].itemId}) should sort before slot ${i} (${owner.inventory[i].itemId})`
    );
  }

  // NEXUS Door never teleports via handleUseDoor & has zero doorLinks
  const nexusJoin = store.joinWorld(owner, 'NEXUS');
  assert.equal(nexusJoin.ok, true);
  if (!nexusJoin.ok) return;
  assert.deepEqual(nexusJoin.world.state.doorLinks, {});
  const nexusUseDoor = store.handleUseDoor(nexusJoin.world, owner, 53, 29);
  assert.equal(nexusUseDoor.ok, false);

  // Save a custom pose inside NEXUS, join owned world, clearSavedPose -> joining NEXUS again spawns at NEXUS Entry (50, 29)
  store.recordPlayerPose('NEXUS', owner.id, {
    x: 20 * TS,
    y: 26 * TS,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
  });
  store.clearSavedPose('NEXUS', owner.id);
  const freshNexusJoin = store.joinWorld(owner, 'NEXUS');
  assert.equal(freshNexusJoin.ok, true);
  if (freshNexusJoin.ok) {
    assert.equal(freshNexusJoin.resumed, false);
    assert.equal(Math.floor((freshNexusJoin.remote.x + 24) / TS), 50);
  }

  // Player World Door Data & Sign editing restricted to owner/authorized users
  const worldName = `DRS_${suffix.slice(-5).toUpperCase()}`;
  assert.equal(store.createOwnedWorld(owner, worldName).ok, true);
  const ownedJoin = store.joinWorld(owner, worldName);
  assert.equal(ownedJoin.ok, true);
  if (!ownedJoin.ok) return;
  const liveOwned = ownedJoin.world;
  liveOwned.state.bg[tileIndexIn(liveOwned.state, 28, 19)] = ITEM_IDS.GP_DOOR;
  liveOwned.state.fg[tileIndexIn(liveOwned.state, 29, 19)] = ITEM_IDS.WOODEN_SIGN;

  liveOwned.state.worldLock!.publicAccess = true;
  const guestJoined = store.joinWorld(guest, worldName);
  assert.equal(guestJoined.ok, true);
  assert.equal(store.handleConfigureDoor(liveOwned, guest, 28, 19, 25, 19, 'Denied').ok, false);
  assert.equal(store.handleConfigureSign(liveOwned, guest, 29, 19, 'Denied').ok, false);
  assert.equal(store.handleConfigureDoor(liveOwned, owner, 28, 19, 25, 19, 'Spawn').ok, true);
  assert.equal(store.handleConfigureSign(liveOwned, owner, 29, 19, 'Welcome').ok, true);

  const guestUseDoor = store.handleUseDoor(liveOwned, guest, 28, 19);
  assert.equal(guestUseDoor.ok, true, 'Guests should be able to use a linked Door even without edit permission');
});

test('Sci-fi Infusion 15-item catalog pack & same-tile floating drop merging strictly within origin tile (tx, ty)', async () => {
  const { isDoorBlock } = await import('../src/game/rules.ts');

  // 1. Verify 15 Sci-fi Infusion items (1100..1114): 6 solid fg blocks, 6 bg walls, 1 door, 2 platforms
  const scifiIds = Array.from({ length: 15 }, (_, idx) => 1100 + idx);
  for (const id of scifiIds) {
    const def = getItemDef(id);
    assert.ok(def, `Missing Sci-fi Infusion item #${id}`);
    assert.equal(def.gemValue ?? 0, 0, `${def.name} should follow baseline 0 gems`);
    assert.equal(def.xpValue ?? 1, 1, `${def.name} should follow baseline 1 XP`);
    assert.ok(def.drops && def.drops.length === 1 && def.drops[0].itemId === id && def.drops[0].chance === 0.125);
  }

  for (let id = 1100; id <= 1105; id++) {
    const def = getItemDef(id)!;
    assert.equal(def.category, 'foreground');
    assert.equal(def.collision, 'solid');
  }
  for (let id = 1106; id <= 1111; id++) {
    const def = getItemDef(id)!;
    assert.equal(def.category, 'background');
    assert.equal(def.collision, 'none');
  }
  assert.equal(isDoorBlock(ITEM_IDS.SCIFI_AIRLOCK_DOOR), true);
  assert.equal(getItemDef(ITEM_IDS.SCIFI_AIRLOCK_DOOR)?.category, 'background');
  assert.equal(getItemDef(1113)?.collision, 'platform');
  assert.equal(getItemDef(1114)?.collision, 'platform');

  // 2. Verify spawnDrop merges identical drops ONLY on the exact same origin tile (tx, ty)
  const store = new AuthoritativeWorldStore();
  const suffix = Date.now().toString(36);
  const reg = store.registerAccount({
    email: `drop_${suffix}@example.com`,
    username: `Drop_${suffix.slice(-5)}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  const acct = reg.account;
  const worldName = `DRP_${suffix.slice(-5).toUpperCase()}`;
  assert.equal(store.createOwnedWorld(acct, worldName).ok, true);
  const joined = store.joinWorld(acct, worldName);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  const live = joined.world;

  const createDropFn = (store as unknown as {
    createDrop: (
      w: typeof live,
      itemId: number,
      qty: number,
      tx: number,
      ty: number,
      slotIndex?: number
    ) => { id: string; qty: number };
  }).createDrop.bind(store);

  const d1 = createDropFn(live, ITEM_IDS.GP_DIRT, 2, 10, 15);
  const d2 = createDropFn(live, ITEM_IDS.GP_DIRT, 3, 10, 15);
  assert.equal(d1.id, d2.id, 'Same-tile identical drop must merge into one drop stack');
  assert.equal(d2.qty, 5);

  const dAdj = createDropFn(live, ITEM_IDS.GP_DIRT, 4, 11, 15);
  assert.notEqual(dAdj.id, d1.id, 'Adjacent tile drop (tx+1) must NOT merge across tiles');
  assert.equal(dAdj.qty, 4);
  assert.equal(
    Array.from(live.drops.values()).filter((d) => d.itemId === ITEM_IDS.GP_DIRT).length,
    2
  );

  store.leaveWorld(worldName, acct.id, true);
});

test('35-DB Crop Rebalance, 1x2 Pixobyte Digichange Background Terminal in NEXUS, 26-bit Pixobyte Coin & Pixostatic Market Exchange', async () => {
  const { getPixobyteDigichangeAt } = await import('../src/game/rules.ts');
  const {
    PIXOBYTE_BASE_RATE,
    PIXOBYTE_MIN_RATE,
    PIXOBYTE_MAX_RATE,
    getPixostaticMarketSnapshot,
  } = await import('../src/game/pixobyteMarket.ts');
  const { PIXOBYTE_COIN_RESOLUTION } = await import('../src/components/PixobyteIcon.tsx');

  // 1. Verify 26-bit resolution Pixobyte coin icon
  assert.equal(PIXOBYTE_COIN_RESOLUTION, 26);

  // 2. Verify Crop Rebalance baseline (starting seed cost = 35 DigiBits) and progressive scaling
  assert.equal(CROP_SPECS[0].seedAlterbitPrice, 35);
  assert.deepEqual(
    CROP_SPECS.map((s) => s.seedAlterbitPrice),
    [35, 90, 225, 540, 1250, 2800]
  );
  assert.deepEqual(
    CROP_SPECS.map((s) => s.sellAlterbits),
    [16, 36, 80, 172, 400, 1015]
  );

  // 3. Verify 1x2 Pixobyte Digichange background terminal placement in NEXUS
  const nexus = generateWorld('NEXUS');
  const digiConcourseTop = getPixobyteDigichangeAt(nexus, 48, 28);
  const digiConcourseBot = getPixobyteDigichangeAt(nexus, 48, 29);
  assert.ok(digiConcourseTop && digiConcourseBot, 'Pixobyte Digichange 1x2 should exist at x=48, y=28..29');
  assert.equal(digiConcourseTop.anchorX, 48);
  assert.equal(digiConcourseTop.topY, 28);
  assert.equal(digiConcourseTop.bottomY, 29);
  assert.equal(digiConcourseBot.bottomY, 29);

  const digiUpperTop = getPixobyteDigichangeAt(nexus, 57, 16);
  const digiUpperBot = getPixobyteDigichangeAt(nexus, 57, 17);
  assert.ok(digiUpperTop && digiUpperBot, 'Pixobyte Digichange 1x2 should exist at x=57, y=16..17');
  assert.equal(digiUpperTop.anchorX, 57);
  assert.equal(digiUpperTop.topY, 16);
  assert.equal(digiUpperTop.bottomY, 17);

  // 4. Verify Pixostatic Market rate bounds around 1,325 DB midpoint (-29.5% floor = 935, +17.5% ceiling = 1,556)
  assert.equal(PIXOBYTE_BASE_RATE, 1325);
  assert.equal(PIXOBYTE_MIN_RATE, 935);
  assert.equal(PIXOBYTE_MAX_RATE, 1556);
  for (let i = 0; i < 60; i++) {
    const snap = getPixostaticMarketSnapshot(1_700_000_000_000 + i * 7000);
    assert.ok(
      snap.currentRate >= PIXOBYTE_MIN_RATE && snap.currentRate <= PIXOBYTE_MAX_RATE,
      `Rate ${snap.currentRate} out of [-29.5%, +17.5%] bounds`
    );
    assert.ok(snap.deviationPct >= -29.5 && snap.deviationPct <= 17.5);
  }

  // 5. Verify one-way DigiBits -> Pixobyte acquisition via store.handleVendorAction
  const store = new AuthoritativeWorldStore();
  const buyer = store.getOrCreatePlayer(`pxb_buyer_${Date.now().toString(36)}`, 'PxbTrader');
  assert.equal(buyer.pixobytes, 0);
  buyer.alterbits = 5000;
  const buyPxb = store.handleVendorAction(buyer, {
    action: 'buy_pixobyte',
    qty: 2,
  });
  assert.equal(buyPxb.ok, true);
  assert.equal(buyer.pixobytes, 2);
  assert.ok(buyer.alterbits <= 5000 - 2 * PIXOBYTE_MIN_RATE && buyer.alterbits >= 5000 - 2 * PIXOBYTE_MAX_RATE);
});

