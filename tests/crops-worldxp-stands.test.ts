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
  assert.equal(nexus.bg[tileIndexIn(nexus, 53, 29)], ITEM_IDS.GP_DOOR);
  assert.equal(nexus.fg[tileIndexIn(nexus, 53, 29)], ITEM_IDS.AIR);
  assert.equal(nexus.fg[tileIndexIn(nexus, 47, 29)], ITEM_IDS.WOODEN_SIGN);
  assert.equal(nexus.fg[tileIndexIn(nexus, 52, 29)], ITEM_IDS.WOODEN_SIGN);
  assert.equal(nexus.fg[tileIndexIn(nexus, 55, 29)], ITEM_IDS.WOODEN_SIGN);
  assert.equal(nexus.signs?.['47,29'], '← Fresh Greens');
  assert.equal(nexus.signs?.['52,29'], '↑ Exchange & Furnace');
  assert.equal(nexus.signs?.['55,29'], 'Realm Steward →');

  // Return background doors on West (31, 27), East (69, 27), and Upper (51, 17) decks
  assert.equal(nexus.bg[tileIndexIn(nexus, 31, 27)], ITEM_IDS.GP_DOOR);
  assert.equal(nexus.bg[tileIndexIn(nexus, 69, 27)], ITEM_IDS.GP_DOOR);
  assert.equal(nexus.bg[tileIndexIn(nexus, 51, 17)], ITEM_IDS.GP_DOOR);

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

  // Upper Command Deck: Global Exchange Terminal at (43, 17) & Stone Furnace at (57, 17)
  assert.equal(nexus.fg[tileIndexIn(nexus, 43, 17)], ITEM_IDS.EXCHANGE_TERMINAL);
  assert.equal(nexus.fg[tileIndexIn(nexus, 57, 17)], ITEM_IDS.STONE_FURNACE);

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
  farmer.alterbits += 50;
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

