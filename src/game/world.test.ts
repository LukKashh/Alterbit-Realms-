import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEDROCK_ROWS,
  PLAYABLE_ROWS,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_TILE_COUNT,
  WORLD_WIDTH,
} from './constants.ts';
import { ACHIEVEMENTS, GEM_STORE_LISTINGS, ITEM_IDS } from './catalog.ts';
import { generateMineShaft, generateWorld } from './worldGen.ts';
import {
  ensureFluidArrays,
  floodFillLiquidDepth,
  stepFluidFrontier,
} from './fluids.ts';
import {
  addXp,
  canBreakTile,
  canEnterWorld,
  canPlaceTile,
  getCoveringAreaLock,
  getPlantGrowthState,
  hasAreaLockConflict,
  hasEditPermission,
  resolveSplice,
  tileIndex,
  tileIndexIn,
  validateWorldName,
} from './rules.ts';
import { createPlayerBody, stepPlayerPhysics } from './physics.ts';

test('world dimensions are strictly 100x60 with 6 bottom rows of bedrock', () => {
  assert.equal(WORLD_WIDTH, 100);
  assert.equal(WORLD_HEIGHT, 60);
  assert.equal(BEDROCK_ROWS, 6);
  assert.equal(PLAYABLE_ROWS, 54);
  assert.equal(WORLD_TILE_COUNT, 6000);

  const world = generateWorld('START');
  assert.equal(world.fg.length, 6000);
  assert.equal(world.bg.length, 6000);

  for (let y = 54; y < 60; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      assert.equal(world.fg[tileIndex(x, y)], ITEM_IDS.BEDROCK, `row ${y} col ${x} must be bedrock`);
    }
  }
});

test('world generation is deterministic from world name seed', () => {
  const w1 = generateWorld('meadow');
  const w2 = generateWorld('MEADOW');
  assert.equal(w1.seed, w2.seed);
  assert.deepEqual(w1.fg, w2.fg);
  assert.deepEqual(w1.bg, w2.bg);
  assert.equal(w1.spawnX, w2.spawnX);
  assert.equal(w1.spawnY, w2.spawnY);
});

test('bedrock and entrance portal cannot be broken while soil can be broken', () => {
  const world = generateWorld('START');
  const player = { id: 'p1', x: world.spawnX * TILE_SIZE, y: world.spawnY * TILE_SIZE };

  // Bedrock check at row 54
  const bedrockRes = canBreakTile(
    world,
    { id: 'p1', x: 50 * TILE_SIZE, y: 52 * TILE_SIZE },
    50,
    54
  );
  assert.equal(bedrockRes.ok, false);

  // Portal check
  const portalRes = canBreakTile(world, player, world.spawnX, world.spawnY);
  assert.equal(portalRes.ok, false);

  // Surface turf check right beside spawn
  const turfRes = canBreakTile(world, player, world.spawnX + 1, world.spawnY + 1);
  assert.equal(turfRes.ok, true);
  assert.equal(turfRes.layer, 'fg');
});

test('foreground placement rejects self-overlap and respects background separation', () => {
  const world = generateWorld('START');
  const body = createPlayerBody(world.spawnX, world.spawnY);
  const player = { id: 'p1', x: body.x, y: body.y };

  // Cannot place solid block on player's own tile
  const selfRes = canPlaceTile(world, player, ITEM_IDS.GP_WOOD_BLOCK, world.spawnX, world.spawnY);
  assert.equal(selfRes.ok, false);

  // Can place wood block adjacent to ground beside spawn
  const placeFg = canPlaceTile(world, player, ITEM_IDS.GP_WOOD_BLOCK, world.spawnX + 2, world.spawnY);
  assert.equal(placeFg.ok, true);
  assert.equal(placeFg.layer, 'fg');

  // Can place background wall at same spot independently
  const placeBg = canPlaceTile(world, player, ITEM_IDS.GP_WOODEN_BACKGROUND, world.spawnX + 2, world.spawnY);
  assert.equal(placeBg.ok, true);
  assert.equal(placeBg.layer, 'bg');
});

test('player physics lands on ground, collides with walls, and ignores background tiles', () => {
  const world = generateWorld('START');
  const body = createPlayerBody(world.spawnX, world.spawnY - 2);
  const idleInput = { left: false, right: false, jumpHeld: false, jumpJustPressed: false, down: false };

  // Simulate falling onto spawn terrace
  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(body, world, idleInput, 1 / 60);
  }
  assert.equal(body.grounded, true);

  // Place background wall in front of player -> should NOT block movement
  const aheadX = Math.floor(body.x / TILE_SIZE) + 1;
  const aheadY = Math.floor(body.y / TILE_SIZE);
  world.bg[tileIndex(aheadX, aheadY)] = ITEM_IDS.GP_WOODEN_BACKGROUND;

  const startX = body.x;
  for (let i = 0; i < 15; i++) {
    stepPlayerPhysics(body, world, { ...idleInput, right: true }, 1 / 60);
  }
  assert.ok(body.x > startX + 30, 'background wall must not block player movement');
});

test('seed growth stages, splicing recipes, world name validation, and XP leveling', () => {
  const plant = {
    x: 52,
    y: 23,
    seedId: ITEM_IDS.GP_SEED_GRASS,
    plantedAt: 1000,
    maturityAt: 11000,
    ownerId: 'p1',
  };
  assert.equal(getPlantGrowthState(plant, 1500).stage, 'planted');
  assert.equal(getPlantGrowthState(plant, 2500).stage, 'sprout');
  assert.equal(getPlantGrowthState(plant, 6000).stage, 'young');
  assert.equal(getPlantGrowthState(plant, 9000).stage, 'developing');
  assert.equal(getPlantGrowthState(plant, 12000).stage, 'mature');

  assert.equal(resolveSplice(ITEM_IDS.GP_SEED_DIRT, ITEM_IDS.GP_SEED_ROCK), ITEM_IDS.GP_SEED_GRASS);
  assert.equal(resolveSplice(ITEM_IDS.GP_SEED_ROCK, ITEM_IDS.GP_SEED_DIRT), ITEM_IDS.GP_SEED_GRASS);
  assert.equal(resolveSplice(ITEM_IDS.GP_SEED_ROCK, ITEM_IDS.GP_SEED_GRASS), ITEM_IDS.GP_SEED_BRICKS);
  assert.equal(resolveSplice(ITEM_IDS.GP_SEED_GRASS, ITEM_IDS.GP_SEED_GRASS), null);

  assert.equal(validateWorldName('My_World1').ok, true);
  assert.equal(validateWorldName('My_World1').normalized, 'MY_WORLD1');
  assert.equal(validateWorldName('admin').ok, false);
  assert.equal(validateWorldName('a').ok, false);

  const xpRes = addXp(1, 40, 20);
  assert.equal(xpRes.level, 2);
  assert.equal(xpRes.xp, 10);
  assert.equal(xpRes.leveledUp, true);
});

test('world lock, share lock permissions, restricted entry, and vending machine protection', () => {
  const world = generateWorld('TRADE');
  const lx = world.spawnX + 2;
  const ly = world.spawnY;

  world.shareLocks = world.shareLocks ?? {};
  world.vendingMachines = world.vendingMachines ?? {};

  // Assign WorldCore ownership to p1 with private access
  world.worldLock = {
    lockItemId: ITEM_IDS.WORLD_CORE,
    ownerId: 'p1',
    ownerName: 'OwnerOne',
    x: world.spawnX,
    y: world.spawnY + 1,
    editors: [],
    editorNames: {},
    publicAccess: false,
  };

  // Place a 5x5 Small-Share Lock owned by p1 granting p2 build/break/interact access
  world.fg[tileIndex(lx, ly)] = ITEM_IDS.SMALL_SHARE_LOCK;
  world.shareLocks[`${lx},${ly}`] = {
    ownerId: 'p1',
    ownerName: 'OwnerOne',
    x: lx,
    y: ly,
    itemId: ITEM_IDS.SMALL_SHARE_LOCK,
    width: 5,
    height: 5,
    access: {
      p2: {
        playerName: 'BuilderTwo',
        permissions: { build: true, break: true, interact: true },
      },
    },
  };

  // Owner (p1) and authorized Share Lock builder (p2) can edit inside rectangle, stranger (p3) cannot
  assert.equal(hasEditPermission(world, 'p1', lx + 1, ly), true);
  assert.equal(hasEditPermission(world, 'p2', lx + 1, ly), true);
  assert.equal(hasEditPermission(world, 'p3', lx + 1, ly), false);

  // Outside the 5x5 Share Lock, only the world owner (p1) can edit
  assert.equal(hasEditPermission(world, 'p1', lx + 10, ly), true);
  assert.equal(hasEditPermission(world, 'p2', lx + 10, ly), false);
  assert.equal(hasEditPermission(world, 'p3', lx + 10, ly), false);

  assert.equal(canEnterWorld(world, 'p1').ok, true);
  assert.equal(canEnterWorld(world, 'p2').ok, true);
  assert.equal(canEnterWorld(world, 'p3').ok, false);

  // Stocked vending machine cannot be broken until emptied
  const vx = world.spawnX + 1;
  const vy = world.spawnY;
  world.fg[tileIndex(vx, vy)] = ITEM_IDS.VENDING_MACHINE;
  world.vendingMachines[`${vx},${vy}`] = {
    ownerId: 'p1',
    ownerName: 'OwnerOne',
    x: vx,
    y: vy,
    stockItemId: ITEM_IDS.GP_DIRT,
    stockQty: 5,
    priceItemId: ITEM_IDS.SMALL_LOCK,
    priceQty: 1,
    earningsQty: 0,
  };
  const breakStocked = canBreakTile(
    world,
    { id: 'p1', x: world.spawnX * TILE_SIZE, y: world.spawnY * TILE_SIZE },
    vx,
    vy
  );
  assert.equal(breakStocked.ok, false);

  // Once emptied, owner can break it
  world.vendingMachines[`${vx},${vy}`].stockQty = 0;
  const breakEmpty = canBreakTile(
    world,
    { id: 'p1', x: world.spawnX * TILE_SIZE, y: world.spawnY * TILE_SIZE },
    vx,
    vy
  );
  assert.equal(breakEmpty.ok, true);

  // Verify Gem Store listings and Achievements are populated
  assert.ok(GEM_STORE_LISTINGS.length >= 8);
  assert.ok(ACHIEVEMENTS.length >= 8);
});

import {
  DEFAULT_VIEW_SCALE,
  MAX_REACH_TILES,
  PLAYER_HEIGHT,
  PLAYER_HEIGHT_TILES,
  PLAYER_WIDTH,
  PLAYER_WIDTH_TILES,
} from './constants.ts';
import {
  applyFarmabilityTier,
  buildFarmabilityOverride,
  calculateFarmabilityProfile,
  DEFAULT_GAME_CONFIG,
  getEffectiveItemDef,
  sanitizeGameConfig,
} from './config.ts';
import { isWithinReach } from './rules.ts';
import { AuthoritativeWorldStore } from '../../server/worldStore.ts';

test('player hitbox is strictly 0.8 wide x 1.75 tall with upscaled 60px tiles', () => {
  assert.ok(TILE_SIZE >= 55, 'TILE_SIZE must be upscaled for 25% larger scale');
  assert.equal(TILE_SIZE, 60);
  assert.equal(PLAYER_WIDTH_TILES, 0.8);
  assert.equal(PLAYER_HEIGHT_TILES, 1.75);
  assert.equal(PLAYER_WIDTH, 48);
  assert.equal(PLAYER_HEIGHT, 105);
  assert.equal(DEFAULT_VIEW_SCALE, 1.5);
  assert.equal(MAX_REACH_TILES, 3.05);

  const world = generateWorld('HITBOX');
  // Clear an open flat corridor at row 30 (floor at row 31)
  for (let x = 40; x <= 60; x++) {
    world.fg[tileIndex(x, 28)] = ITEM_IDS.AIR;
    world.fg[tileIndex(x, 29)] = ITEM_IDS.AIR;
    world.fg[tileIndex(x, 30)] = ITEM_IDS.AIR;
    world.fg[tileIndex(x, 31)] = ITEM_IDS.GP_DIRT;
  }

  // Place a ceiling block at x=48, y=29 leaving only a 1-tile gap at y=30
  world.fg[tileIndex(48, 29)] = ITEM_IDS.GP_ROCK;

  const body = createPlayerBody(46, 30);
  body.grounded = true;
  const moveRight = { left: false, right: true, jumpHeld: false, jumpJustPressed: false, down: false };
  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(body, world, moveRight, 1 / 60);
  }
  assert.ok(body.x + PLAYER_WIDTH <= 48 * TILE_SIZE + 0.05, '1.75-tall player must be blocked by 1-tile gap');

  // Open row 29 leaving 2-tile vertical clearance (y=29..30)
  world.fg[tileIndex(48, 29)] = ITEM_IDS.AIR;
  world.fg[tileIndex(48, 28)] = ITEM_IDS.GP_ROCK;
  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(body, world, moveRight, 1 / 60);
  }
  assert.ok(body.x > 48 * TILE_SIZE, '1.75-tall player must pass cleanly through a 2-tile gap');
});

test('interaction reach is strictly 3 blocks by default and honors GameConfig drop overrides', () => {
  const player = { id: 'p1', x: 50 * TILE_SIZE, y: 23 * TILE_SIZE };
  assert.equal(isWithinReach(player, 53, 23), true, '3 blocks away should be reachable');
  assert.equal(isWithinReach(player, 54, 23), false, '4 blocks away must be out of reach');

  const cfg = sanitizeGameConfig({
    mechanics: { viewScale: 1.5, reachTiles: 3.05, globalGemDropChance: 1 } as never,
    itemOverrides: {
      [ITEM_IDS.GP_DIRT]: {
        hardness: 1,
        gemValue: 5,
        xpValue: 10,
        drops: [{ itemId: ITEM_IDS.GP_RED_BRICKS, chance: 1, minQty: 2, maxQty: 2 }],
      },
    },
  });
  const def = getEffectiveItemDef(ITEM_IDS.GP_DIRT, cfg);
  assert.equal(def?.hardness, 1);
  assert.equal(def?.drops?.[0].itemId, ITEM_IDS.GP_RED_BRICKS);
  assert.equal(def?.drops?.[0].minQty, 2);
});

test('seeded admin login, empty Fist+Wrench starter inventory, and centered tile drop origin', () => {
  const store = new AuthoritativeWorldStore();

  // Preexisting Admin login by email and username
  const adminLogin = store.loginAccount({ identifier: 'puncisters@gmail.com', password: '123456' });
  assert.equal(adminLogin.ok, true);
  if (adminLogin.ok) {
    assert.equal(adminLogin.account.role, 'admin');
    assert.equal(adminLogin.account.name, 'GameDev');
    assert.equal(adminLogin.account.email, 'puncisters@gmail.com');
  }

  // Register fresh non-admin player with unique email/username -> Fist + Wrench only, 0 gems
  const suffix = Math.random().toString(36).slice(2, 7);
  const reg = store.registerAccount({
    email: `test_${suffix}@example.com`,
    username: `User_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (reg.ok) {
    assert.equal(reg.account.role, 'player');
    assert.equal(reg.account.gems, 0);
    assert.equal(reg.account.inventory.length, 2);
    assert.deepEqual(
      reg.account.inventory.map((s) => s.itemId),
      [ITEM_IDS.FIST, ITEM_IDS.WRENCH]
    );

    // Non-admin cannot change game config
    const denied = store.updateGameConfig(reg.account, {});
    assert.equal(denied.ok, false);
  }

  // Verify broken tile drop spawns centered where tile originated
  if (adminLogin.ok) {
    const joined = store.joinWorld(adminLogin.account, 'START');
    assert.equal(joined.ok, true);
    if (joined.ok) {
      const tx = joined.world.state.spawnX + 1;
      const ty = joined.world.state.spawnY + 1;
      const surfaceId = joined.world.state.fg[tileIndex(tx, ty)];
      // Set hardness 1 override momentarily to test single-punch break and drop coords
      const prevCfg = store.getGameConfig();
      const testCfg = sanitizeGameConfig({
        ...prevCfg,
        mechanics: { ...prevCfg.mechanics, punchCooldownMs: 60 },
        itemOverrides: {
          ...prevCfg.itemOverrides,
          [surfaceId]: {
            hardness: 1,
            drops: [{ itemId: surfaceId, chance: 1, minQty: 1, maxQty: 1 }],
          },
        },
      });
      store.updateGameConfig(adminLogin.account, testCfg);
      const punch = store.handlePunchTile(joined.world, adminLogin.account, tx, ty);
      assert.equal(punch.ok, true);
      if (punch.ok && punch.broken) {
        assert.ok(punch.drops.length >= 1);
        const firstDrop = punch.drops[0];
        assert.equal(firstDrop.x, tx * TILE_SIZE + TILE_SIZE * 0.5);
        assert.equal(firstDrop.y, ty * TILE_SIZE + TILE_SIZE * 0.5);
      }
      store.updateGameConfig(adminLogin.account, prevCfg);
      store.leaveWorld('START', adminLogin.account.id);
    }
  }
});

test('admin store editor customization, live store purchase, and in-world landscape restriction gating', () => {
  const store = new AuthoritativeWorldStore();
  const adminLogin = store.loginAccount({ identifier: 'puncisters@gmail.com', password: '123456' });
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;

  // Custom listing in GameConfig
  const customListing = {
    id: 'store_test_special',
    section: 'blocks' as const,
    name: 'Special Test Bundle',
    description: 'Grant 33 Red Bricks for 15 Gems',
    iconItemId: ITEM_IDS.GP_RED_BRICKS,
    gemPrice: 15,
    grants: [{ itemId: ITEM_IDS.GP_RED_BRICKS, qty: 33 }],
  };

  const prevCfg = store.getGameConfig();
  const updatedCfg = sanitizeGameConfig({
    ...prevCfg,
    storeListings: [...(prevCfg.storeListings ?? []), customListing],
  });

  const applied = store.updateGameConfig(adminLogin.account, updatedCfg);
  assert.equal(applied.ok, true);

  // Register player, grant gems, and purchase custom store listing
  const suffix = Math.random().toString(36).slice(2, 7);
  const reg = store.registerAccount({
    email: `store_${suffix}@example.com`,
    username: `Shopper_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  reg.account.gems = 50;
  const buyRes = store.handleBuyGemStore(reg.account, 'store_test_special', 'tx_store_test_1');
  assert.equal(buyRes.ok, true);
  assert.equal(reg.account.gems, 35); // 50 - 15 = 35
  const brickSlot = reg.account.inventory.find((s) => s.itemId === ITEM_IDS.GP_RED_BRICKS);
  assert.equal(brickSlot?.qty, 33);

  // Restore config
  store.updateGameConfig(adminLogin.account, prevCfg);

  // Portrait view is unrestricted across every screen including in-world
  const isBlockedByOrientation = (_state: string, _isPortrait: boolean) => false;
  for (const state of ['auth', 'loading', 'hub', 'playing', 'paused']) {
    assert.equal(isBlockedByOrientation(state, true), false, `${state} must allow portrait view`);
    assert.equal(isBlockedByOrientation(state, false), false, `${state} must allow landscape view`);
  }

  // Movement & punch pacing constants are tuned smoother & slower
  const cfg = store.getGameConfig();
  assert.ok(cfg.mechanics.moveSpeed <= 240, 'move speed must be smoothed/slowed <= 240 px/s');
  assert.ok(cfg.mechanics.punchCooldownMs >= 280, 'punch cooldown must be calmer >= 280 ms');
});

test('calculated Farmability system function determines positive block yield ranges and assigns tiers accurately', () => {
  // 1. Non-farmable general blocks (Dirt #500, Desert Sand #700) no longer have seed cycles
  const dirtDefault = calculateFarmabilityProfile(ITEM_IDS.GP_DIRT, DEFAULT_GAME_CONFIG);
  assert.equal(dirtDefault.hasSeedCycle, false);
  assert.equal(dirtDefault.linkedSeedId, null);

  // 2. Farmable blocks from the 40-crop registry have full seed cycles and positive block yield
  for (const farmId of [
    ITEM_IDS.FARM_SUGAR_CANE,
    ITEM_IDS.FARM_CHANDELIER,
    ITEM_IDS.FARM_STARLIGHT_PRISM,
    ITEM_IDS.FARM_OMEGA_MONOLITH,
  ]) {
    const baseProfile = calculateFarmabilityProfile(farmId, DEFAULT_GAME_CONFIG);
    assert.equal(baseProfile.hasSeedCycle, true);
    assert.ok(baseProfile.expectedBlockYield > 1.0, `Farmable block #${farmId} must have positive yield`);

    const { targetItemId, override } = buildFarmabilityOverride(farmId, 'farmable', DEFAULT_GAME_CONFIG);
    assert.equal(targetItemId, farmId);
    assert.ok(override.drops && override.drops.length >= 1);

    const nextCfg = applyFarmabilityTier(DEFAULT_GAME_CONFIG, [farmId], 'farmable');
    const farmProfile = calculateFarmabilityProfile(farmId, nextCfg);
    assert.ok(
      farmProfile.expectedBlockYield >= 1.3,
      `Farmable block #${farmId} farmable override must produce positive block yield >= 1.3x (got ${farmProfile.expectedBlockYield})`
    );
    assert.equal(farmProfile.isPositiveYield, true);
  }

  // Assign Sink vs Balanced vs Farmable vs Abundant to Sugar Cane
  const sinkCfg = applyFarmabilityTier(DEFAULT_GAME_CONFIG, [ITEM_IDS.FARM_SUGAR_CANE], 'sink');
  const caneSink = calculateFarmabilityProfile(ITEM_IDS.FARM_SUGAR_CANE, sinkCfg);
  assert.ok(caneSink.expectedBlockYield < 1.0, 'Sink tier must yield < 1.0x');
  assert.equal(caneSink.isPositiveYield, false);

  const balancedCfg = applyFarmabilityTier(DEFAULT_GAME_CONFIG, [ITEM_IDS.FARM_SUGAR_CANE], 'balanced');
  const caneBalanced = calculateFarmabilityProfile(ITEM_IDS.FARM_SUGAR_CANE, balancedCfg);
  assert.ok(caneBalanced.expectedBlockYield > 1.0 && caneBalanced.expectedBlockYield < 1.2);
  assert.equal(caneBalanced.isPositiveYield, true);

  const farmableCfg = applyFarmabilityTier(DEFAULT_GAME_CONFIG, [ITEM_IDS.FARM_SUGAR_CANE], 'farmable');
  const caneFarmable = calculateFarmabilityProfile(ITEM_IDS.FARM_SUGAR_CANE, farmableCfg);
  assert.ok(caneFarmable.expectedBlockYield >= 1.25, 'Farmable tier must yield >= 1.25x positive block yield');
  assert.equal(caneFarmable.isPositiveYield, true);

  const abundantCfg = applyFarmabilityTier(DEFAULT_GAME_CONFIG, [ITEM_IDS.FARM_SUGAR_CANE], 'abundant');
  const caneAbundant = calculateFarmabilityProfile(ITEM_IDS.FARM_SUGAR_CANE, abundantCfg);
  assert.ok(caneAbundant.expectedBlockYield >= 1.65, 'Abundant tier must yield >= 1.65x');

  // Direct non-seed item (Stone Furnace #120) has no seed cycle
  const furnaceProfile = calculateFarmabilityProfile(ITEM_IDS.STONE_FURNACE, DEFAULT_GAME_CONFIG);
  assert.equal(furnaceProfile.hasSeedCycle, false);
});

test('dynamic fluids CA gravity, lateral flow, depth BFS tiers, and parkour/hazard physics', () => {
  const world = generateWorld('FLUIDS');
  ensureFluidArrays(world);

  // Carve a basin from x=20..30, y=20..25 with solid stone floor at y=26 and walls at x=19,31
  for (let x = 20; x <= 30; x++) {
    for (let y = 18; y <= 25; y++) {
      world.fg[tileIndexIn(world, x, y)] = ITEM_IDS.AIR;
    }
    world.fg[tileIndexIn(world, x, 26)] = ITEM_IDS.GP_ROCK;
  }
  for (let y = 18; y <= 26; y++) {
    world.fg[tileIndexIn(world, 19, y)] = ITEM_IDS.GP_ROCK;
    world.fg[tileIndexIn(world, 31, y)] = ITEM_IDS.GP_ROCK;
  }

  // Place a Water Source at (25, 20) and step frontier
  world.fg[tileIndexIn(world, 25, 20)] = ITEM_IDS.WATER_SOURCE;
  const frontier = new Set<string>(['25,20']);
  let totalDeltas = 0;
  for (let step = 0; step < 30; step++) {
    const deltas = stepFluidFrontier(world, frontier, 220);
    totalDeltas += deltas.length;
  }
  assert.ok(totalDeltas > 0, 'Water source must produce fluid deltas');
  assert.equal(world.fluidType![tileIndexIn(world, 25, 25)], 1, 'Water must fall to basin floor');
  assert.ok(world.fluidLevel![tileIndexIn(world, 24, 25)] > 0, 'Water must spread laterally');

  const pool = floodFillLiquidDepth(world, 25, 25);
  assert.equal(pool.fluidType, 1);
  assert.ok(pool.depth >= 4 && (pool.depthTier === 'deep' || pool.depthTier === 'abyssal'));

  // Test Acid pool tier detection & physics hazard
  world.fluidType![tileIndexIn(world, 15, 25)] = 2;
  world.fluidLevel![tileIndexIn(world, 15, 25)] = 4;
  assert.equal(floodFillLiquidDepth(world, 15, 25).depthTier, 'acid');

  // Test Bounce Pad high upward launch and Blue Ice low-friction slide
  const bounceX = 40;
  const bounceY = 30;
  world.fg[tileIndexIn(world, bounceX, bounceY)] = ITEM_IDS.BOUNCE_PAD;
  world.fg[tileIndexIn(world, bounceX, bounceY - 1)] = ITEM_IDS.AIR;
  world.fg[tileIndexIn(world, bounceX, bounceY - 2)] = ITEM_IDS.AIR;
  const body = createPlayerBody(bounceX, bounceY - 1);
  const idleInput = { left: false, right: false, jumpHeld: false, jumpJustPressed: false, down: false };
  let minVy = 0;
  for (let i = 0; i < 20; i++) {
    stepPlayerPhysics(body, world, idleInput, 1 / 60);
    if (body.vy < minVy) minVy = body.vy;
  }
  assert.ok(minVy < -600, `Bounce pad must launch player strongly upward (minVy=${minVy})`);

  // Blue Ice slide test
  for (let x = 50; x <= 62; x++) {
    world.fg[tileIndexIn(world, x, 30)] = ITEM_IDS.BLUE_ICE;
    world.fg[tileIndexIn(world, x, 29)] = ITEM_IDS.AIR;
    world.fg[tileIndexIn(world, x, 28)] = ITEM_IDS.AIR;
  }
  const iceBody = createPlayerBody(52, 28);
  for (let i = 0; i < 25; i++) {
    stepPlayerPhysics(iceBody, world, { ...idleInput, right: true }, 1 / 60);
  }
  const speedOnIce = Math.abs(iceBody.vx);
  for (let i = 0; i < 8; i++) {
    stepPlayerPhysics(iceBody, world, idleInput, 1 / 60);
  }
  assert.ok(Math.abs(iceBody.vx) > speedOnIce * 0.65, 'Blue Ice should preserve horizontal slide momentum');

  // Acid hazard trigger
  world.fg[tileIndexIn(world, 15, 26)] = ITEM_IDS.GP_ROCK;
  world.fg[tileIndexIn(world, 15, 25)] = ITEM_IDS.AIR;
  world.fg[tileIndexIn(world, 15, 24)] = ITEM_IDS.AIR;
  const acidBody = createPlayerBody(15, 24);
  let hazardSeen: string | null = null;
  for (let i = 0; i < 25; i++) {
    const res = stepPlayerPhysics(acidBody, world, idleInput, 1 / 60);
    if (res.hazardHit) hazardSeen = res.hazardHit;
  }
  assert.equal(hazardSeen, 'acid');
});

test('mining shaft 50x150 isolation (0 Gems), pickaxe durability + furnace crafting/repair & fishing', () => {
  const shaft = generateMineShaft('MINE_TEST', 'Tester');
  assert.equal(shaft.width, 50);
  assert.equal(shaft.height, 150);
  assert.equal(shaft.worldKind, 'mine_shaft');
  assert.equal(shaft.fg.length, 7500);

  const store = new AuthoritativeWorldStore();
  const suffix = Math.random().toString(36).slice(2, 7);
  const reg = store.registerAccount({
    email: `miner_${suffix}@example.com`,
    username: `Miner_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  const acct = reg.account;

  // Give Mining Scroll + Stone Pickaxe + Bamboo Rod + Furnace + Copper Fragments + Coal + Glacier Trout
  store.addInventory(acct, ITEM_IDS.MINING_SCROLL, 1);
  store.addInventory(acct, ITEM_IDS.STONE_PICKAXE, 1);
  store.addInventory(acct, ITEM_IDS.BAMBOO_ROD, 1);
  store.addInventory(acct, ITEM_IDS.STONE_FURNACE, 1);
  store.addInventory(acct, ITEM_IDS.COPPER_FRAGMENT, 3);
  store.addInventory(acct, ITEM_IDS.COAL_FUEL, 2);
  store.addInventory(acct, ITEM_IDS.FISH_GLACIER_TROUT, 2);

  // Activate Mining Scroll -> creates ephemeral MINE_* shaft
  const scrollRes = store.handleUseConsumable(acct, ITEM_IDS.MINING_SCROLL);
  assert.equal(scrollRes.ok, true);
  if (!scrollRes.ok || !scrollRes.mineWorldName) return;

  const joined = store.joinWorld(acct, scrollRes.mineWorldName);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  // Break an ore/stone tile inside shaft using Stone Pickaxe -> 0 Gems, durability decrements
  const tx = joined.world.state.spawnX + 1;
  const ty = joined.world.state.spawnY + 1;
  joined.world.state.fg[tileIndexIn(joined.world.state, tx, ty)] = ITEM_IDS.COPPER_VEIN;
  const pickSlotBefore = acct.inventory.find((s) => s.itemId === ITEM_IDS.STONE_PICKAXE);
  const durBefore = pickSlotBefore?.durability ?? 0;
  assert.ok(durBefore > 0);

  for (let i = 0; i < 6; i++) {
    store['lastPunchAt'].delete(acct.id);
    const punch = store.handlePunchTile(joined.world, acct, tx, ty, ITEM_IDS.STONE_PICKAXE);
    if (punch.ok && punch.broken) {
      assert.equal(punch.gemsGained, 0, 'Mining shafts must award 0 standard Gems');
      assert.ok(!punch.drops.some((d) => d.isGem), 'Mining shaft drops must not spawn Gems');
      break;
    }
  }
  const durAfter = acct.inventory.find((s) => s.itemId === ITEM_IDS.STONE_PICKAXE)?.durability ?? 0;
  assert.equal(durAfter, durBefore - 1, 'Pickaxe durability must decrement by 1 per broken foreground tile');

  // Leave mine shaft & verify furnace smelting + repair + culinary buff in a dedicated test world
  store.leaveWorld(scrollRes.mineWorldName, acct.id);
  const testWorldName = `CRAFT_${suffix.toUpperCase()}`;
  const startJoined = store.joinWorld(acct, testWorldName);
  assert.equal(startJoined.ok, true);
  if (!startJoined.ok) return;

  const fTx = startJoined.world.state.spawnX + 2;
  const fTy = startJoined.world.state.spawnY;
  startJoined.world.state.fg[tileIndexIn(startJoined.world.state, fTx, fTy)] = ITEM_IDS.AIR;
  const placeFurnace = store.handlePlaceTile(startJoined.world, acct, ITEM_IDS.STONE_FURNACE, fTx, fTy);
  assert.equal(placeFurnace.ok, true);

  // Repair Stone Pickaxe using Rock
  store.addInventory(acct, ITEM_IDS.GP_ROCK, 10);
  const repairRes = store.handleConfigureFurnace(startJoined.world, acct, fTx, fTy, {
    action: 'repair',
    toolItemId: ITEM_IDS.STONE_PICKAXE,
  });
  assert.equal(repairRes.ok, true);
  const pickAfterRepair = acct.inventory.find((s) => s.itemId === ITEM_IDS.STONE_PICKAXE);
  assert.equal(pickAfterRepair?.durability, pickAfterRepair?.maxDurability);

  // Smelt Copper Ingot & fast-forward finish timestamp
  const craftRes = store.handleConfigureFurnace(startJoined.world, acct, fTx, fTy, {
    action: 'craft',
    recipeId: 'smelt_copper',
  });
  assert.equal(craftRes.ok, true);
  startJoined.world.state.furnaces![`${fTx},${fTy}`].finishesAt = Date.now() - 100;
  const collectRes = store.handleConfigureFurnace(startJoined.world, acct, fTx, fTy, {
    action: 'collect',
  });
  assert.equal(collectRes.ok, true);
  assert.ok((acct.inventory.find((s) => s.itemId === ITEM_IDS.COPPER_INGOT)?.qty ?? 0) >= 1);

  // Cook & consume Glacier Fillet for move_speed buff
  const cookRes = store.handleConfigureFurnace(startJoined.world, acct, fTx, fTy, {
    action: 'craft',
    recipeId: 'cook_glacier_fillet',
  });
  assert.equal(cookRes.ok, true);
  startJoined.world.state.furnaces![`${fTx},${fTy}`].finishesAt = Date.now() - 100;
  store.handleConfigureFurnace(startJoined.world, acct, fTx, fTy, { action: 'collect' });
  const buffRes = store.handleUseConsumable(acct, ITEM_IDS.BUFF_GLACIER_FILLET);
  assert.equal(buffRes.ok, true);
  assert.ok(acct.activeBuffs.some((b) => b.buffType === 'move_speed' && b.bonusPct > 0));

  // Cast & reel fishing inside Water pool (0 Gems awarded)
  const wTx = startJoined.world.state.spawnX - 2;
  const wTy = startJoined.world.state.spawnY;
  ensureFluidArrays(startJoined.world.state);
  startJoined.world.state.fg[tileIndexIn(startJoined.world.state, wTx, wTy)] = ITEM_IDS.AIR;
  startJoined.world.state.fluidType![tileIndexIn(startJoined.world.state, wTx, wTy)] = 1;
  startJoined.world.state.fluidLevel![tileIndexIn(startJoined.world.state, wTx, wTy)] = 4;

  const gemsBeforeFish = acct.gems;
  const castRes = store.handleCastFishing(startJoined.world, acct, wTx, wTy, ITEM_IDS.BAMBOO_ROD);
  assert.equal(castRes.ok, true);
  const castObj = startJoined.world.activeCasts.get(acct.id);
  assert.ok(castObj);
  if (castObj) castObj.biting = true;
  let reelRes = store.handleReelFishing(startJoined.world, acct);
  let safetyPulls = 0;
  while (reelRes.ok && !reelRes.finished && safetyPulls < 12) {
    if (castObj) castObj.lastReelAt = 0;
    reelRes = store.handleReelFishing(startJoined.world, acct);
    safetyPulls++;
  }
  assert.equal(reelRes.ok, true);
  if (reelRes.ok) {
    assert.equal(reelRes.caught, true);
    assert.ok(reelRes.caughtItemId);
  }
  assert.equal(acct.gems, gemsBeforeFish, 'Fishing must yield fish/XP without standard Gems');

  store.leaveWorld(testWorldName, acct.id);
});

test('Global WL Exchange escrow, 5% WL sink, 10-Gem clearing fee, Claim Vault & BFG Auto-Collector', () => {
  const store = new AuthoritativeWorldStore();
  const s1 = Math.random().toString(36).slice(2, 7);
  const s2 = Math.random().toString(36).slice(2, 7);
  const sellerReg = store.registerAccount({
    email: `seller_${s1}@example.com`,
    username: `Seller_${s1}`,
    password: 'password123',
  });
  const buyerReg = store.registerAccount({
    email: `buyer_${s2}@example.com`,
    username: `Buyer_${s2}`,
    password: 'password123',
  });
  assert.equal(sellerReg.ok && buyerReg.ok, true);
  if (!sellerReg.ok || !buyerReg.ok) return;

  const seller = sellerReg.account;
  const buyer = buyerReg.account;
  store.addInventory(seller, ITEM_IDS.IRON_INGOT, 20);
  store.addInventory(buyer, ITEM_IDS.WORLD_LOCK, 25);
  seller.gems = 20;

  // 1. 1-WL listing charges 10-Gem anti-spam clearing fee per bundle
  const oneWlPost = store.handleExchangeAction(seller, {
    action: 'post',
    itemId: ITEM_IDS.IRON_INGOT,
    bundleSize: 5,
    bundles: 1,
    priceWl: 1,
  });
  assert.equal(oneWlPost.ok, true);
  assert.equal(seller.gems, 10);
  assert.ok(store.getExchangeSnapshot().totalGemsCleared >= 10);

  // 2. 20-WL listing applies 5% WL sink (1 WL burned, 19 WL in Claim Vault)
  const twentyWlPost = store.handleExchangeAction(seller, {
    action: 'post',
    itemId: ITEM_IDS.IRON_INGOT,
    bundleSize: 10,
    bundles: 1,
    priceWl: 20,
  });
  assert.equal(twentyWlPost.ok, true);
  const targetListing = store
    .getExchangeSnapshot()
    .listings.find((l) => l.sellerId === seller.id && l.priceWl === 20);
  assert.ok(targetListing);
  if (!targetListing) return;

  const burnedBefore = store.getExchangeSnapshot().totalWlBurned;
  const buyRes = store.handleExchangeAction(buyer, {
    action: 'buy',
    listingId: targetListing.id,
    txId: `tx_ex_${Date.now()}`,
  });
  assert.equal(buyRes.ok, true);
  assert.equal(store.getExchangeSnapshot().totalWlBurned, burnedBefore + 1);
  assert.equal(buyer.inventory.find((s) => s.itemId === ITEM_IDS.IRON_INGOT)?.qty, 10);
  assert.equal(buyer.inventory.find((s) => s.itemId === ITEM_IDS.WORLD_LOCK)?.qty, 5);
  assert.equal(seller.unclaimedWl, 19);

  // Seller claims World Locks from Claim Vault
  const claimRes = store.handleExchangeAction(seller, { action: 'claim_wl' });
  assert.equal(claimRes.ok, true);
  assert.equal(seller.unclaimedWl, 0);
  assert.equal(seller.inventory.find((s) => s.itemId === ITEM_IDS.WORLD_LOCK)?.qty, 19);

  // 3. BFG Auto-Collector requires locked world & harvests/magnets into buffer
  const bfgWorldName = `BFGTEST_${s1.toUpperCase()}`;
  const joinedBfg = store.joinWorld(seller, bfgWorldName);
  assert.equal(joinedBfg.ok, true);
  if (!joinedBfg.ok) return;

  const bTx = joinedBfg.world.state.spawnX + 2;
  const bTy = joinedBfg.world.state.spawnY;
  joinedBfg.world.state.fg[tileIndexIn(joinedBfg.world.state, bTx, bTy)] = ITEM_IDS.AIR;
  joinedBfg.world.state.fg[tileIndexIn(joinedBfg.world.state, bTx - 1, bTy)] = ITEM_IDS.AIR;

  const unlockedCheck = canPlaceTile(
    joinedBfg.world.state,
    { id: seller.id, x: joinedBfg.world.state.spawnX * TILE_SIZE, y: joinedBfg.world.state.spawnY * TILE_SIZE },
    ITEM_IDS.BFG_COLLECTOR,
    bTx,
    bTy
  );
  assert.equal(unlockedCheck.ok, false, 'BFG Auto-Collector must reject placement in unlocked world');

  // Assign WorldCore ownership to seller then place BFG Auto-Collector
  joinedBfg.world.state.worldLock = {
    x: joinedBfg.world.state.spawnX,
    y: joinedBfg.world.state.spawnY + 1,
    lockItemId: ITEM_IDS.WORLD_CORE,
    ownerId: seller.id,
    ownerName: seller.name,
    editors: [],
    editorNames: {},
    publicAccess: false,
  };

  store.addInventory(seller, ITEM_IDS.BFG_COLLECTOR, 1);
  const bfgPlace = store.handlePlaceTile(joinedBfg.world, seller, ITEM_IDS.BFG_COLLECTOR, bTx, bTy);
  assert.equal(bfgPlace.ok, true);

  // Plant a mature farmable tree 2 tiles away -> BFG tick harvests & stores it
  const treeTx = bTx + 2;
  joinedBfg.world.state.plants[`${treeTx},${bTy}`] = {
    x: treeTx,
    y: bTy,
    seedId: ITEM_IDS.SEED_FARM_SUGAR_CANE,
    plantedAt: 1000,
    maturityAt: 2000,
    ownerId: seller.id,
  };
  store.tickBfgCollectors(Date.now());
  const bfgRec = joinedBfg.world.state.bfgCollectors![`${bTx},${bTy}`];
  assert.ok(bfgRec.storedItems.length >= 1, 'BFG tick must buffer harvested blocks');
  assert.ok(bfgRec.storedGems >= 2, 'BFG tick must buffer harvest Gems');

  const withdrawRes = store.handleConfigureBfg(joinedBfg.world, seller, bTx, bTy, {
    action: 'withdraw',
  });
  assert.equal(withdrawRes.ok, true);
  assert.equal(bfgRec.storedGems, 0);
  assert.equal(bfgRec.storedItems.length, 0);

  store.leaveWorld(bfgWorldName, seller.id, true);
});

test('16. Live connectivity & reconnect resumes exact player coordinates and preserves active mine shafts', () => {
  const store = new AuthoritativeWorldStore();
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const reg = store.registerAccount({
    email: `res_${suffix}@test.local`,
    username: `Res_${suffix.slice(0, 8)}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  const account = reg.account;

  // 1. Join START, move to custom coordinates, and simulate transient disconnect (explicitExit = false)
  const j1 = store.joinWorld(account, 'START');
  assert.equal(j1.ok, true);
  if (!j1.ok) return;
  assert.equal(j1.resumed, false);

  const customX = (j1.world.state.spawnX + 6) * TILE_SIZE;
  const customY = j1.world.state.spawnY * TILE_SIZE;
  const pState = j1.world.players.get(account.id)!;
  pState.x = customX;
  pState.y = customY;
  pState.facing = -1;
  store.recordPlayerPose('START', account.id, {
    x: customX,
    y: customY,
    vx: 0,
    vy: 0,
    facing: -1,
    grounded: true,
  });

  // Transient disconnect (explicitExit = false) saves lastKnownPositions
  store.leaveWorld('START', account.id, false);

  // Re-joining START without client resumePosition still restores server-side lastKnownPositions
  const j2 = store.joinWorld(account, 'START');
  assert.equal(j2.ok, true);
  if (!j2.ok) return;
  assert.equal(j2.resumed, true, 'Reconnecting player should resume previous position');
  const resumedPlayer = j2.world.players.get(account.id)!;
  assert.equal(resumedPlayer.x, customX);
  assert.equal(resumedPlayer.y, customY);
  assert.equal(resumedPlayer.facing, -1);

  // 2. Client-supplied resumePosition on reconnect is validated and restored
  const clientResumeX = (j2.world.state.spawnX + 4) * TILE_SIZE;
  const j3 = store.joinWorld(account, 'START', {
    x: clientResumeX,
    y: customY,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
  });
  assert.equal(j3.ok, true);
  if (!j3.ok) return;
  assert.equal(j3.resumed, true);
  assert.equal(j3.world.players.get(account.id)?.x, clientResumeX);

  // 3. Ephemeral Mine Shaft survives transient socket disconnect (explicitExit = false)
  store.addInventory(account, ITEM_IDS.MINING_SCROLL, 1);
  const mineRes = store.handleUseConsumable(account, ITEM_IDS.MINING_SCROLL);
  assert.equal(mineRes.ok, true);
  if (!mineRes.ok || !mineRes.mineWorldName) return;
  const mineName = mineRes.mineWorldName;
  store.leaveWorld('START', account.id, true);

  const mineJoin1 = store.joinWorld(account, mineName);
  assert.equal(mineJoin1.ok, true);
  if (!mineJoin1.ok) return;

  // Simulate transient disconnect inside mine shaft
  store.leaveWorld(mineName, account.id, false);

  // Reconnect into the same mine shaft succeeds because transient disconnect keeps it alive
  const mineJoin2 = store.joinWorld(account, mineName);
  assert.equal(mineJoin2.ok, true, 'Mine shaft must remain in memory across transient disconnect');

  // Explicit exit cleans up empty mine shaft
  store.leaveWorld(mineName, account.id, true);
  const mineJoinAfterExit = store.joinWorld(account, mineName);
  assert.equal(mineJoinAfterExit.ok, false, 'Explicit exit should clean up empty mine shaft');

  // Flush dirty worlds without throwing
  store.flushDirtyWorlds();
});



