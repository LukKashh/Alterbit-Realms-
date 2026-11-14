import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATM_MAX_GEMS,
  ATM_MAX_INTERVAL_MS,
  ATM_MIN_GEMS,
  ATM_MIN_INTERVAL_MS,
  CATALOG,
  GEM_STORE_LISTINGS,
  ITEM_IDS,
  rollAtmGems,
  rollAtmIntervalMs,
} from '../src/game/catalog.ts';
import { PLAYER_HEIGHT, TILE_SIZE } from '../src/game/constants.ts';
import { createPlayerBody, stepPlayerPhysics } from '../src/game/physics.ts';
import { tileIndexIn } from '../src/game/rules.ts';
import { generateWorld, VAULTBOX_SLOT_COUNT } from '../src/game/worldGen.ts';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';

function registerAndEnterPersonalWorld(store: AuthoritativeWorldStore, prefix: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `${prefix}_${suffix}@example.com`,
    username: `${prefix}_${suffix}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) throw new Error('register failed');
  const acct = reg.account;

  const worldName = `${prefix.toUpperCase()}_${suffix.toUpperCase()}`;
  const cw = store.createOwnedWorld(acct, worldName);
  assert.equal(cw.ok, true);

  const joined = store.joinWorld(acct, worldName);
  assert.equal(joined.ok, true);
  if (!joined.ok) throw new Error('join failed');

  return { acct, live: joined.world, worldName };
}

test('ATM Machine store price (10,000 G), single type, 30m-1.5h random interval, 5-125 Gems yield', () => {
  // Verify only one ATM block type in catalog & store
  const atmDefs = Object.values(CATALOG).filter((d) => d.key.includes('atm'));
  assert.equal(atmDefs.length, 1);
  assert.equal(atmDefs[0].id, ITEM_IDS.ATM_MACHINE);

  const listing = GEM_STORE_LISTINGS.find((l) => l.id === 'store_atm_machine');
  assert.ok(listing, 'ATM Machine listing must exist in GEM_STORE_LISTINGS');
  assert.equal(listing?.gemPrice, 10000);
  assert.equal(listing?.grants.length, 1);
  assert.equal(listing?.grants[0]?.itemId, ITEM_IDS.ATM_MACHINE);
  assert.equal(listing?.grants[0]?.qty, 1);

  assert.equal(ATM_MIN_INTERVAL_MS, 30 * 60 * 1000);
  assert.equal(ATM_MAX_INTERVAL_MS, 90 * 60 * 1000);
  assert.equal(ATM_MIN_GEMS, 5);
  assert.equal(ATM_MAX_GEMS, 125);

  for (let i = 0; i < 40; i++) {
    const iv = rollAtmIntervalMs();
    assert.ok(iv >= ATM_MIN_INTERVAL_MS && iv <= ATM_MAX_INTERVAL_MS, `Interval ${iv} out of bounds`);
    const g = rollAtmGems();
    assert.ok(g >= ATM_MIN_GEMS && g <= ATM_MAX_GEMS && Number.isInteger(g), `Gems ${g} out of bounds`);
  }

  const store = new AuthoritativeWorldStore();
  const { acct, live, worldName } = registerAndEnterPersonalWorld(store, 'atmuser');
  const p = live.players.get(acct.id)!;

  // Buy ATM Machine from store for 10,000 Gems
  acct.gems = 12000;
  const buyRes = store.handleBuyGemStore(acct, 'store_atm_machine', `tx_atm_${Date.now()}`);
  assert.equal(buyRes.ok, true);
  assert.equal(acct.gems, 2000);
  assert.equal(acct.inventory.find((s) => s.itemId === ITEM_IDS.ATM_MACHINE)?.qty, 1);

  const tx = Math.max(2, Math.floor(p.x / TILE_SIZE) + 1);
  const ty = Math.floor(p.y / TILE_SIZE);
  live.state.fg[tileIndexIn(live.state, tx, ty)] = ITEM_IDS.AIR;
  live.state.fg[tileIndexIn(live.state, tx, ty + 1)] = ITEM_IDS.GP_DIRT;

  const placed = store.handlePlaceTile(live, acct, ITEM_IDS.ATM_MACHINE, tx, ty);
  assert.equal(placed.ok, true);

  const key = `${tx},${ty}`;
  const atm = live.state.atmMachines?.[key];
  assert.ok(atm, 'AtmMachineRecord must be created on placement');
  assert.equal(atm.isReady, false);
  assert.ok(atm.intervalMs >= ATM_MIN_INTERVAL_MS && atm.intervalMs <= ATM_MAX_INTERVAL_MS);

  // Ticking before interval completes keeps isReady = false
  store.tickAllWorlds(atm.lastHarvestMs + atm.intervalMs - 1000);
  assert.equal(atm.isReady, false);
  assert.equal(atm.storedGems, 0);

  // Ticking once interval elapses marks ATM ready with 5..125 Gems
  const readyAt = atm.lastHarvestMs + atm.intervalMs + 500;
  store.tickAllWorlds(readyAt);
  assert.equal(atm.isReady, true);
  assert.ok(atm.storedGems >= ATM_MIN_GEMS && atm.storedGems <= ATM_MAX_GEMS);
  const expectedGems = atm.storedGems;

  // Subsequent ticks must NOT generate a second payout until collected
  store.tickAllWorlds(readyAt + 3 * 60 * 60 * 1000);
  assert.equal(atm.isReady, true);
  assert.equal(atm.storedGems, expectedGems);

  // Punching ready ATM collects/spawns Gem drop & resets cycle without breaking ATM
  const punch = store.handlePunchTile(live, acct, tx, ty, ITEM_IDS.FIST);
  assert.equal(punch.ok, true);
  if (!punch.ok) return;
  assert.equal(punch.broken, false);
  assert.equal(punch.gemsGained, expectedGems);
  assert.equal(atm.isReady, false);
  assert.equal(atm.storedGems, 0);
  assert.ok(atm.intervalMs >= ATM_MIN_INTERVAL_MS && atm.intervalMs <= ATM_MAX_INTERVAL_MS);
  assert.equal(
    punch.drops.some((d) => d.isGem && d.qty === expectedGems),
    true,
    'Punching ready ATM must drop the generated Gem payout'
  );

  store.leaveWorld(worldName, acct.id, true);
});

test('Vaultbox costs 1,750 G, provides 10 empty owner-only storage tiles, and blocks breaking when non-empty', () => {
  const listing = GEM_STORE_LISTINGS.find((l) => l.id === 'store_vaultbox');
  assert.ok(listing, 'Vaultbox listing must exist in GEM_STORE_LISTINGS');
  assert.equal(listing?.gemPrice, 1750);
  assert.equal(listing?.grants[0]?.itemId, ITEM_IDS.VAULTBOX);
  assert.equal(CATALOG[ITEM_IDS.VAULTBOX]?.storePrice, 1750);
  assert.equal(VAULTBOX_SLOT_COUNT, 10);

  const store = new AuthoritativeWorldStore();
  const { acct: owner, live, worldName } = registerAndEnterPersonalWorld(store, 'vowner');

  // Register a second visitor account
  const visitorSuffix = Math.random().toString(36).slice(2, 8);
  const visReg = store.registerAccount({
    email: `visitor_${visitorSuffix}@example.com`,
    username: `Visitor_${visitorSuffix}`,
    password: 'password123',
  });
  assert.equal(visReg.ok, true);
  if (!visReg.ok) return;
  const visitor = visReg.account;

  owner.gems = 3000;
  const buyRes = store.handleBuyGemStore(owner, 'store_vaultbox', `tx_vb_${Date.now()}`);
  assert.equal(buyRes.ok, true);
  assert.equal(owner.gems, 1250);

  const op = live.players.get(owner.id)!;
  const tx = Math.max(2, Math.floor(op.x / TILE_SIZE) + 1);
  const ty = Math.floor(op.y / TILE_SIZE);
  live.state.fg[tileIndexIn(live.state, tx, ty)] = ITEM_IDS.AIR;
  live.state.fg[tileIndexIn(live.state, tx, ty + 1)] = ITEM_IDS.GP_DIRT;

  const placed = store.handlePlaceTile(live, owner, ITEM_IDS.VAULTBOX, tx, ty);
  assert.equal(placed.ok, true);

  const key = `${tx},${ty}`;
  const vb = live.state.vaultboxes?.[key];
  assert.ok(vb, 'VaultboxRecord must be created');
  assert.equal(vb.ownerId, owner.id);
  assert.equal(vb.slots.length, 10);
  assert.equal(vb.slots.every((s) => s === null), true, 'New Vaultbox must start with 10 empty tiles');

  // Cannot store Fist or Wrench
  const fistRes = store.handleConfigureVaultbox(live, owner, tx, ty, {
    action: 'deposit',
    itemId: ITEM_IDS.FIST,
    qty: 1,
  });
  assert.equal(fistRes.ok, false);

  // Give owner 10 distinct items (using farmable item IDs 900..909) + 1 extra (910) to test 10-slot limit
  for (let i = 0; i < 11; i++) {
    store.addInventory(owner, 900 + i, 5);
  }

  for (let i = 0; i < 10; i++) {
    const dep = store.handleConfigureVaultbox(live, owner, tx, ty, {
      action: 'deposit',
      itemId: 900 + i,
      qty: 3,
    });
    assert.equal(dep.ok, true);
    assert.equal(owner.inventory.find((s) => s.itemId === 900 + i)?.qty, 2);
    assert.equal(vb.slots[i]?.itemId, 900 + i);
    assert.equal(vb.slots[i]?.qty, 3);
  }

  // 11th distinct item fails because all 10 Vaultbox storage tiles are occupied
  const overfill = store.handleConfigureVaultbox(live, owner, tx, ty, {
    action: 'deposit',
    itemId: 910,
    qty: 1,
  });
  assert.equal(overfill.ok, false);
  assert.equal(owner.inventory.find((s) => s.itemId === 910)?.qty, 5);

  // Non-owner cannot deposit or withdraw from Vaultbox
  store.addInventory(visitor, 900, 2);
  const visDeposit = store.handleConfigureVaultbox(live, visitor, tx, ty, {
    action: 'deposit',
    itemId: 900,
    qty: 1,
  });
  assert.equal(visDeposit.ok, false);

  const visWithdraw = store.handleConfigureVaultbox(live, visitor, tx, ty, {
    action: 'withdraw',
    slotIndex: 0,
  });
  assert.equal(visWithdraw.ok, false);

  // Cannot break non-empty Vaultbox
  const punchBlocked = store.handlePunchTile(live, owner, tx, ty, ITEM_IDS.FIST);
  assert.equal(punchBlocked.ok, false);

  // Withdraw all 10 slots back to owner inventory
  for (let i = 0; i < 10; i++) {
    const wd = store.handleConfigureVaultbox(live, owner, tx, ty, {
      action: 'withdraw',
      slotIndex: i,
    });
    assert.equal(wd.ok, true);
    assert.equal(owner.inventory.find((s) => s.itemId === 900 + i)?.qty, 5);
    assert.equal(vb.slots[i], null);
  }

  // Empty Vaultbox can be broken and drops 1x VAULTBOX
  const hardness = CATALOG[ITEM_IDS.VAULTBOX].hardness;
  const punchTracker = (store as unknown as { lastPunchAt: Map<string, number> }).lastPunchAt;
  let broke = false;
  for (let hit = 0; hit < hardness + 2; hit++) {
    punchTracker.delete(owner.id);
    const res = store.handlePunchTile(live, owner, tx, ty, ITEM_IDS.FIST);
    assert.equal(res.ok, true);
    if (res.ok && res.broken) {
      broke = true;
      assert.equal(res.drops.some((d) => d.itemId === ITEM_IDS.VAULTBOX && d.qty === 1), true);
      break;
    }
  }
  assert.equal(broke, true);
  assert.equal(live.state.vaultboxes?.[key], undefined);

  store.leaveWorld(worldName, owner.id, true);
});

test('Builders Mix includes 10 pass-through Platform blocks supporting jump-through from below and drop-through', () => {
  const mix = GEM_STORE_LISTINGS.find((l) => l.id === 'store_builders_mix');
  assert.ok(mix, 'Builders Mix listing must exist in GEM_STORE_LISTINGS');
  const platGrant = mix?.grants.find((g) => g.itemId === ITEM_IDS.GP_WOODEN_PLATFORM);
  assert.ok(platGrant, 'Builders Mix must grant GP_WOODEN_PLATFORM');
  assert.equal(platGrant?.qty, 10);
  assert.equal(CATALOG[ITEM_IDS.GP_WOODEN_PLATFORM].collision, 'platform');

  // Verify one-way platform physics in stepPlayerPhysics
  const world = generateWorld('PLAT_TEST');
  const platX = 10;
  const platY = 18;
  for (let y = 10; y < 22; y++) {
    for (let x = 8; x <= 12; x++) {
      world.fg[tileIndexIn(world, x, y)] = ITEM_IDS.AIR;
    }
  }
  // Solid floor at y = 22, platform at y = 18
  for (let x = 8; x <= 12; x++) {
    world.fg[tileIndexIn(world, x, 22)] = ITEM_IDS.GP_DIRT;
  }
  world.fg[tileIndexIn(world, platX, platY)] = ITEM_IDS.GP_WOODEN_PLATFORM;

  // 1. Rising player passes unobstructed upward through platform from underneath
  const risingBody = createPlayerBody(platX, platY + 1);
  risingBody.vy = -720;
  const platTopPx = platY * TILE_SIZE;
  let passedAbove = false;
  for (let i = 0; i < 45; i++) {
    stepPlayerPhysics(
      risingBody,
      world,
      { left: false, right: false, down: false, jumpHeld: true, jumpJustPressed: false },
      1 / 60
    );
    if (risingBody.y + PLAYER_HEIGHT < platTopPx) {
      passedAbove = true;
      break;
    }
  }
  assert.equal(passedAbove, true, 'Player jumping from under a Platform must pass through upward');

  // 2. Falling player above platform lands cleanly on top of the platform
  const fallingBody = createPlayerBody(platX, platY - 2);
  fallingBody.grounded = false;
  fallingBody.vy = 140;
  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(
      fallingBody,
      world,
      { left: false, right: false, down: false, jumpHeld: false, jumpJustPressed: false },
      1 / 60
    );
    if (fallingBody.grounded) break;
  }
  assert.equal(fallingBody.grounded, true);
  assert.equal(Math.round(fallingBody.y + PLAYER_HEIGHT), platTopPx);

  // 3. Holding down on the platform lets the player drop through onto the floor below
  for (let i = 0; i < 20; i++) {
    stepPlayerPhysics(
      fallingBody,
      world,
      { left: false, right: false, down: true, jumpHeld: false, jumpJustPressed: false },
      1 / 60
    );
  }
  assert.ok(
    fallingBody.y + PLAYER_HEIGHT > platTopPx,
    'Holding down on a Platform should drop the player through'
  );
});
