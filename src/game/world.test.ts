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
import { generateWorld } from './worldGen.ts';
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
  const selfRes = canPlaceTile(world, player, ITEM_IDS.TIMBER_PLANK, world.spawnX, world.spawnY);
  assert.equal(selfRes.ok, false);

  // Can place timber plank adjacent to ground beside spawn
  const placeFg = canPlaceTile(world, player, ITEM_IDS.TIMBER_PLANK, world.spawnX + 2, world.spawnY);
  assert.equal(placeFg.ok, true);
  assert.equal(placeFg.layer, 'fg');

  // Can place background wall at same spot independently
  const placeBg = canPlaceTile(world, player, ITEM_IDS.BG_TIMBER_WALL, world.spawnX + 2, world.spawnY);
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
  world.bg[tileIndex(aheadX, aheadY)] = ITEM_IDS.BG_TIMBER_WALL;

  const startX = body.x;
  for (let i = 0; i < 15; i++) {
    stepPlayerPhysics(body, world, { ...idleInput, right: true }, 1 / 60);
  }
  assert.ok(body.x > startX + 20, 'background wall must not block player movement');
});

test('seed growth stages, splicing recipes, world name validation, and XP leveling', () => {
  const plant = {
    x: 52,
    y: 23,
    seedId: ITEM_IDS.SEED_TURF,
    plantedAt: 1000,
    maturityAt: 11000,
    ownerId: 'p1',
  };
  assert.equal(getPlantGrowthState(plant, 1500).stage, 'planted');
  assert.equal(getPlantGrowthState(plant, 6000).stage, 'sprout');
  assert.equal(getPlantGrowthState(plant, 12000).stage, 'mature');

  assert.equal(resolveSplice(ITEM_IDS.SEED_STONE, ITEM_IDS.SEED_SOIL), ITEM_IDS.SEED_BRICK);
  assert.equal(resolveSplice(ITEM_IDS.SEED_SOIL, ITEM_IDS.SEED_STONE), ITEM_IDS.SEED_BRICK);
  assert.equal(resolveSplice(ITEM_IDS.SEED_CRYSTAL, ITEM_IDS.SEED_BRICK), ITEM_IDS.SEED_GOLD);
  assert.equal(resolveSplice(ITEM_IDS.SEED_TURF, ITEM_IDS.SEED_TURF), null);

  assert.equal(validateWorldName('My_World1').ok, true);
  assert.equal(validateWorldName('My_World1').normalized, 'MY_WORLD1');
  assert.equal(validateWorldName('admin').ok, false);
  assert.equal(validateWorldName('a').ok, false);

  const xpRes = addXp(1, 40, 20);
  assert.equal(xpRes.level, 2);
  assert.equal(xpRes.xp, 10);
  assert.equal(xpRes.leveledUp, true);
});

test('world lock, area lock permissions, restricted entry, and vending machine protection', () => {
  const world = generateWorld('TRADE');
  const lx = world.spawnX + 2;
  const ly = world.spawnY;

  world.areaLocks = world.areaLocks ?? {};
  world.vendingMachines = world.vendingMachines ?? {};

  // Place a 7x7 Area Lock owned by p1
  world.fg[tileIndex(lx, ly)] = ITEM_IDS.SMALL_LOCK;
  world.areaLocks[`${lx},${ly}`] = {
    ownerId: 'p1',
    ownerName: 'OwnerOne',
    x: lx,
    y: ly,
    radius: 3,
    editors: ['p2'],
    editorNames: { p2: 'BuilderTwo' },
  };

  assert.ok(getCoveringAreaLock(world, lx + 2, ly));
  assert.equal(getCoveringAreaLock(world, lx + 10, ly), null);
  assert.equal(hasAreaLockConflict(world, lx + 1, ly, 3), true);

  // Owner (p1) and authorized builder (p2) can edit inside radius, stranger (p3) cannot
  assert.equal(hasEditPermission(world, 'p1', lx + 1, ly), true);
  assert.equal(hasEditPermission(world, 'p2', lx + 1, ly), true);
  assert.equal(hasEditPermission(world, 'p3', lx + 1, ly), false);

  // Stranger (p3) can still edit outside the 7x7 area lock when no World Lock is present
  assert.equal(hasEditPermission(world, 'p3', lx + 10, ly), true);

  // Add World Lock with publicAccess = false
  world.worldLock = {
    lockItemId: ITEM_IDS.WORLD_LOCK,
    ownerId: 'p1',
    ownerName: 'OwnerOne',
    x: world.spawnX - 1,
    y: world.spawnY,
    editors: ['p2'],
    editorNames: { p2: 'BuilderTwo' },
    publicAccess: false,
  };
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
    stockItemId: ITEM_IDS.RICH_SOIL,
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
import { getEffectiveItemDef, sanitizeGameConfig } from './config.ts';
import { isWithinReach } from './rules.ts';
import { AuthoritativeWorldStore } from '../../server/worldStore.ts';

test('player hitbox is strictly 0.8 wide x 1.75 tall and requires 2-tile doorway', () => {
  assert.equal(PLAYER_WIDTH_TILES, 0.8);
  assert.equal(PLAYER_HEIGHT_TILES, 1.75);
  assert.equal(PLAYER_WIDTH, 25.6);
  assert.equal(PLAYER_HEIGHT, 56);
  assert.equal(DEFAULT_VIEW_SCALE, 1.5);
  assert.equal(MAX_REACH_TILES, 3.05);

  const world = generateWorld('HITBOX');
  // Clear an open flat corridor at row 30 (floor at row 31)
  for (let x = 40; x <= 60; x++) {
    world.fg[tileIndex(x, 28)] = ITEM_IDS.AIR;
    world.fg[tileIndex(x, 29)] = ITEM_IDS.AIR;
    world.fg[tileIndex(x, 30)] = ITEM_IDS.AIR;
    world.fg[tileIndex(x, 31)] = ITEM_IDS.RICH_SOIL;
  }

  // Place a ceiling block at x=48, y=29 leaving only a 1-tile gap at y=30
  world.fg[tileIndex(48, 29)] = ITEM_IDS.GRANITE_STONE;

  const body = createPlayerBody(46, 30);
  body.grounded = true;
  const moveRight = { left: false, right: true, jumpHeld: false, jumpJustPressed: false, down: false };
  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(body, world, moveRight, 1 / 60);
  }
  assert.ok(body.x + PLAYER_WIDTH <= 48 * TILE_SIZE + 0.05, '1.75-tall player must be blocked by 1-tile gap');

  // Open row 29 leaving 2-tile vertical clearance (y=29..30)
  world.fg[tileIndex(48, 29)] = ITEM_IDS.AIR;
  world.fg[tileIndex(48, 28)] = ITEM_IDS.GRANITE_STONE;
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
      [ITEM_IDS.RICH_SOIL]: {
        hardness: 1,
        gemValue: 5,
        xpValue: 10,
        drops: [{ itemId: ITEM_IDS.CRYSTAL_VEIN, chance: 1, minQty: 2, maxQty: 2 }],
      },
    },
  });
  const def = getEffectiveItemDef(ITEM_IDS.RICH_SOIL, cfg);
  assert.equal(def?.hardness, 1);
  assert.equal(def?.drops?.[0].itemId, ITEM_IDS.CRYSTAL_VEIN);
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
      // Set hardness 1 override momentarily to test single-punch break and drop coords
      const prevCfg = store.getGameConfig();
      const testCfg = sanitizeGameConfig({
        ...prevCfg,
        mechanics: { ...prevCfg.mechanics, punchCooldownMs: 60 },
        itemOverrides: {
          ...prevCfg.itemOverrides,
          [ITEM_IDS.MEADOW_TURF]: {
            hardness: 1,
            drops: [{ itemId: ITEM_IDS.MEADOW_TURF, chance: 1, minQty: 1, maxQty: 1 }],
          },
        },
      });
      store.updateGameConfig(adminLogin.account, testCfg);
      const punch = store.handlePunchTile(joined.world, adminLogin.account, tx, ty);
      assert.equal(punch.ok, true);
      if (punch.ok && punch.broken) {
        assert.ok(punch.drops.length >= 1);
        const firstDrop = punch.drops[0];
        assert.equal(firstDrop.x, tx * TILE_SIZE + 16);
        assert.equal(firstDrop.y, ty * TILE_SIZE + 16);
      }
      store.updateGameConfig(adminLogin.account, prevCfg);
      store.leaveWorld('START', adminLogin.account.id);
    }
  }
});
