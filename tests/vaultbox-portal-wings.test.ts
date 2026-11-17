import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_IDS } from '../src/game/catalog.ts';
import {
  getModularRenderLayerOrder,
  isWingWearable,
} from '../src/game/playerSpriteHD.ts';
import {
  canBreakTile,
  canPlaceTile,
  canPlaceWorldCoreVaultbox,
  getEntrancePortalAt,
  isWithinWorldCoreRadius,
  tileIndexIn,
  VAULTBOX_PLACEMENT_RADIUS,
  VAULTBOX_UPGRADE_DIGIBITS_COST,
  VAULTBOX_UPGRADE_MIN_LEVEL,
} from '../src/game/rules.ts';
import { generateWorld, VAULTBOX_SLOT_COUNT } from '../src/game/worldGen.ts';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';

test('Wing wearables resolve as left/right shoulder-linked modules behind entire character while preserving hand priority', () => {
  assert.equal(isWingWearable(ITEM_IDS.WEAR_SKY_WINGS), true);
  assert.equal(isWingWearable(ITEM_IDS.WEAR_DRAGON_BONE_WINGS), true);
  assert.equal(isWingWearable(ITEM_IDS.WEAR_LIFESUP_BACKPACK), false);

  const wingOrder = getModularRenderLayerOrder({
    head: ITEM_IDS.WEAR_GOLD_CROWN,
    back: ITEM_IDS.WEAR_SKY_WINGS,
  });
  const wingIdx = wingOrder.indexOf('back_wings');
  const backHandIdx = wingOrder.indexOf('back_hand');
  const frontHandIdx = wingOrder.indexOf('front_hand');

  assert.equal(wingIdx, 0, 'Wings must render first behind the entire character model');
  assert.ok(wingIdx < backHandIdx, 'Wings must render behind back_hand');
  assert.equal(frontHandIdx, wingOrder.length - 1, 'front_hand must remain top-most priority layer');

  // Non-wing back items keep back_pack behind torso & in front of back_hand
  const packOrder = getModularRenderLayerOrder({
    back: ITEM_IDS.WEAR_LIFESUP_BACKPACK,
  });
  assert.ok(
    packOrder.indexOf('back_hand') < packOrder.indexOf('back_pack'),
    'Non-wing back pack stays between back_hand and torso'
  );
});

test('Entrance Portal occupies 1x2 tiles (spawnX, spawnY - 1 .. spawnY) and prevents breaking or overwriting either tile', () => {
  const world = generateWorld('PORTAL_1X2', false, { isPersonalWorld: true });
  const sx = world.spawnX;
  const sy = world.spawnY;

  assert.equal(world.fg[tileIndexIn(world, sx, sy)], ITEM_IDS.ENTRANCE_PORTAL);
  assert.deepEqual(
    getEntrancePortalAt(world, sx, sy),
    { anchorX: sx, topY: sy - 1, bottomY: sy },
    'Bottom portal tile must match'
  );
  assert.deepEqual(
    getEntrancePortalAt(world, sx, sy - 1),
    { anchorX: sx, topY: sy - 1, bottomY: sy },
    'Top portal tile (1x2) must match'
  );
  assert.equal(getEntrancePortalAt(world, sx, sy - 2), null, 'Tile above 1x2 frame must not match');

  const actor = {
    id: world.worldLock?.ownerId ?? 'owner1',
    x: sx * 48,
    y: sy * 48,
    adminWorldEdit: false,
  };

  assert.equal(canBreakTile(world, actor, sx, sy, 8).ok, false, 'Cannot break bottom Entrance Portal tile');
  assert.equal(canBreakTile(world, actor, sx, sy - 1, 8).ok, false, 'Cannot break top Entrance Portal tile');
  assert.equal(
    canPlaceTile(world, actor, ITEM_IDS.GP_DIRT, sx, sy - 1, 8).ok,
    false,
    'Cannot overwrite top half of 1x2 Entrance Portal'
  );
});

test('WorldCore Lv.7 Vaultbox upgrade validates 5-tile radius, 1,750 Digibits, and persists per-world ownership access', () => {
  assert.equal(VAULTBOX_UPGRADE_MIN_LEVEL, 7);
  assert.equal(VAULTBOX_UPGRADE_DIGIBITS_COST, 1750);
  assert.equal(VAULTBOX_PLACEMENT_RADIUS, 5);
  assert.equal(VAULTBOX_SLOT_COUNT, 6);

  const world = generateWorld('VC_VAULT_RULES', false, { isPersonalWorld: true });
  const core = {
    x: world.spawnX + 1,
    y: world.spawnY,
    lockItemId: ITEM_IDS.WORLD_CORE,
    ownerId: 'owner_test',
    ownerName: 'OwnerTest',
    editors: [] as string[],
    publicAccess: false,
  };
  world.worldLock = core;

  // Within 5-tile Euclidean/Chebyshev radius passes isWithinWorldCoreRadius
  assert.equal(isWithinWorldCoreRadius(world, core.x + 3, core.y - 4, 5), true);
  assert.equal(isWithinWorldCoreRadius(world, core.x + 6, core.y, 5), false);

  // Clear a target tile within radius and place Vaultbox rules check
  const validTx = core.x + 2;
  const validTy = core.y - 1;
  world.fg[tileIndexIn(world, validTx, validTy)] = ITEM_IDS.AIR;
  world.bg[tileIndexIn(world, validTx, validTy)] = ITEM_IDS.BG_SKY;
  assert.equal(canPlaceWorldCoreVaultbox(world, validTx, validTy).ok, true);

  // WorldCore tile itself, out-of-radius tile, or tile with foreground block cannot receive Vaultbox
  assert.equal(canPlaceWorldCoreVaultbox(world, core.x, core.y).ok, false);
  assert.equal(canPlaceWorldCoreVaultbox(world, core.x + 7, core.y).ok, false);
  world.fg[tileIndexIn(world, core.x + 1, core.y)] = ITEM_IDS.GP_DIRT;
  assert.equal(canPlaceWorldCoreVaultbox(world, core.x + 1, core.y).ok, false);

  // Verify foreground placement on top of Vaultbox background is blocked
  world.bg[tileIndexIn(world, validTx, validTy)] = ITEM_IDS.VAULTBOX;
  const ownerCtx = { id: core.ownerId, x: validTx * 48, y: validTy * 48 };
  assert.equal(
    canPlaceTile(world, ownerCtx, ITEM_IDS.GP_RED_BRICKS, validTx, validTy, 8).ok,
    false,
    'Foreground blocks cannot cover Vaultbox background block'
  );

  // Verify persistence & dynamic per-world ownership access control via AuthoritativeWorldStore
  const store = new AuthoritativeWorldStore();
  const sfx = Math.random().toString(36).slice(2, 8);
  const regA = store.registerAccount({ email: `a_${sfx}@ex.com`, username: `OwnerA_${sfx}`, password: 'password123' });
  const regB = store.registerAccount({ email: `b_${sfx}@ex.com`, username: `OwnerB_${sfx}`, password: 'password123' });
  assert.equal(regA.ok && regB.ok, true);
  if (!regA.ok || !regB.ok) return;

  const wName = `PV_${sfx.toUpperCase()}`;
  assert.equal(store.createOwnedWorld(regA.account, wName).ok, true);
  const joined = store.joinWorld(regA.account, wName);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  const live = joined.world;
  const wc = live.state.worldLock!;
  const ptx = wc.x + 2;
  const pty = wc.y - 1;
  live.state.fg[tileIndexIn(live.state, ptx, pty)] = ITEM_IDS.AIR;
  live.state.bg[tileIndexIn(live.state, ptx, pty)] = ITEM_IDS.BG_SKY;
  live.state.worldLevel = 7;
  regA.account.alterbits = 2000;

  assert.equal(store.unlockWorldCoreVaultbox(regA.account, wName, ptx, pty).ok, true);
  store.addInventory(regA.account, ITEM_IDS.GP_DIRT, 12);
  assert.equal(
    store.handleConfigureVaultbox(live, regA.account, ptx, pty, {
      action: 'deposit',
      itemId: ITEM_IDS.GP_DIRT,
      qty: 10,
    }).ok,
    true
  );

  // Transfer World Lock ownership to OwnerB: OwnerA loses access, OwnerB gains access to world-stored Vaultbox!
  wc.ownerId = regB.account.id;
  wc.ownerName = regB.account.name;
  assert.equal(
    store.handleConfigureVaultbox(live, regA.account, ptx, pty, { action: 'withdraw', slotIndex: 0 }).ok,
    false,
    'Previous owner must lose Vaultbox access if World Ownership changes'
  );
  assert.equal(
    store.handleConfigureVaultbox(live, regB.account, ptx, pty, { action: 'withdraw', slotIndex: 0, qty: 4 }).ok,
    true,
    'Current World Owner must be able to manage Vaultbox contents'
  );
  assert.equal(live.state.vaultboxes?.[`${ptx},${pty}`]?.slots[0]?.qty, 6);

  store.leaveWorld(wName, regA.account.id, true);
});
