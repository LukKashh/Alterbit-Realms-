import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';
import { ITEM_IDS } from '../src/game/catalog.ts';
import { PLAYER_HEIGHT, PLAYER_WIDTH, TILE_SIZE } from '../src/game/constants.ts';
import { tileIndexIn } from '../src/game/rules.ts';

test('Server worlds listing exposes lastSeen, dimensions, and realm metadata', () => {
  const store = new AuthoritativeWorldStore();
  const id = Math.random().toString(36).slice(2, 8);
  const reg = store.registerAccount({
    email: `adm_user_${id}@example.com`,
    username: `Admin_${id}`,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) throw new Error('register failed');

  const worldName = `GROVE_${id.toUpperCase()}`;
  const cw = store.createOwnedWorld(reg.account, worldName);
  assert.equal(cw.ok, true);

  const worlds = store.listWorlds();
  assert.ok(worlds.length > 0);

  const foundWorld = worlds.find((w) => w.name === worldName);
  assert.ok(foundWorld, `Expected to find world ${worldName} in listWorlds`);
  assert.equal(foundWorld?.ownerName, `Admin_${id}`);
  assert.ok(typeof foundWorld?.lastSeen === 'number');
  assert.ok(foundWorld!.lastSeen! > 0);
  assert.equal(foundWorld?.width, 50);
  assert.equal(foundWorld?.height, 40);
  assert.equal(foundWorld?.isPersonalRealm, true);
});

test('Admin player profile returns comprehensive stats, inventory counts, and currency', () => {
  const store = new AuthoritativeWorldStore();
  const id = Math.random().toString(36).slice(2, 8);
  const uname = `Farmer_${id}`;
  const reg = store.registerAccount({
    email: `farmer_${id}@example.com`,
    username: uname,
    password: 'password123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) throw new Error('register failed');

  reg.account.gems = 1500;
  reg.account.alterbits = 250;
  reg.account.stats.blocksBroken = 42;
  reg.account.stats.blocksPlaced = 88;
  reg.account.stats.fishCaught = 12;
  reg.account.stats.treesHarvested = 35;
  store.savePlayer(reg.account);

  const profile = store.getAdminPlayerProfile(uname);
  assert.ok(profile, 'Admin player profile should resolve by username');
  assert.equal(profile?.name, uname);
  assert.equal(profile?.email, `farmer_${id}@example.com`);
  assert.equal(profile?.gems, 1500);
  assert.equal(profile?.alterbits, 250);
  assert.equal(profile?.stats.blocksBroken, 42);
  assert.equal(profile?.stats.blocksPlaced, 88);
  assert.equal(profile?.stats.fishCaught, 12);
  assert.equal(profile?.stats.treesHarvested, 35);
  assert.ok(profile!.inventorySlots >= 10);
});

test('Admin bypasses world locks and player limits on world entry', () => {
  const store = new AuthoritativeWorldStore();
  const id = Math.random().toString(36).slice(2, 8);

  const ownerReg = store.registerAccount({
    email: `owner_${id}@example.com`,
    username: `Owner_${id}`,
    password: 'password123',
  });
  assert.equal(ownerReg.ok, true);
  if (!ownerReg.ok) throw new Error('owner register failed');

  const adminReg = store.registerAccount({
    email: `admin_${id}@example.com`,
    username: `Admin_${id}`,
    password: 'password123',
  });
  assert.equal(adminReg.ok, true);
  if (!adminReg.ok) throw new Error('admin register failed');
  adminReg.account.role = 'admin';
  store.savePlayer(adminReg.account);

  const strangerReg = store.registerAccount({
    email: `stranger_${id}@example.com`,
    username: `Stranger_${id}`,
    password: 'password123',
  });
  assert.equal(strangerReg.ok, true);
  if (!strangerReg.ok) throw new Error('stranger register failed');

  const lockWorldName = `LOCK_${id.toUpperCase()}`;
  store.createOwnedWorld(ownerReg.account, lockWorldName);
  const joined = store.joinWorld(ownerReg.account, lockWorldName);
  assert.equal(joined.ok, true);
  if (!joined.ok) throw new Error('join failed');

  // Lock the world
  joined.world.state.worldLock = {
    lockItemId: 200,
    ownerId: ownerReg.account.id,
    ownerName: ownerReg.account.name,
    editors: [],
    publicAccess: false,
    x: 10,
    y: 10,
  };

  // Stranger should NOT be allowed to enter locked world
  const strangerJoin = store.joinWorld(strangerReg.account, lockWorldName);
  assert.equal(strangerJoin.ok, false);

  // Admin MUST be allowed to enter (AdminEnter bypassing locks)
  const adminJoin = store.joinWorld(adminReg.account, lockWorldName);
  assert.equal(adminJoin.ok, true);
});

test('Entity Management lists active players & NPCs, teleports to coords, and summons to admin', () => {
  const store = new AuthoritativeWorldStore();
  const id = Math.random().toString(36).slice(2, 8);

  const adminReg = store.registerAccount({
    email: `ent_adm_${id}@example.com`,
    username: `EntAdm_${id}`,
    password: 'password123',
  });
  const playerReg = store.registerAccount({
    email: `ent_plr_${id}@example.com`,
    username: `EntPlr_${id}`,
    password: 'password123',
  });
  assert.equal(adminReg.ok && playerReg.ok, true);
  if (!adminReg.ok || !playerReg.ok) return;

  adminReg.account.role = 'admin';
  store.savePlayer(adminReg.account);

  // Join NEXUS so both active players and Landlord + Fresh Greens Vendor NPCs are present
  const admJoin = store.joinWorld(adminReg.account, 'NEXUS');
  const plrJoin = store.joinWorld(playerReg.account, 'NEXUS');
  assert.equal(admJoin.ok && plrJoin.ok, true);
  if (!admJoin.ok || !plrJoin.ok) return;

  const live = admJoin.world;
  const adminRemote = live.players.get(adminReg.account.id)!;
  adminRemote.x = 18 * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
  adminRemote.y = (30 + 1) * TILE_SIZE - PLAYER_HEIGHT;

  const listed = store.listWorldEntities(live, adminReg.account);
  assert.equal(listed.worldName, 'NEXUS');
  assert.equal(listed.adminTx, 18);
  assert.equal(listed.adminTy, 30);

  const playerEntity = listed.entities.find(
    (e) => e.kind === 'player' && e.entityId === playerReg.account.id
  );
  const landlordNpc = listed.entities.find(
    (e) => e.kind === 'npc' && e.itemId === ITEM_IDS.LANDLORD_NPC
  );
  const vendorNpc = listed.entities.find(
    (e) => e.kind === 'npc' && e.itemId === ITEM_IDS.GREENS_VENDOR_NPC
  );
  assert.ok(playerEntity, 'Active player must appear in Entity Management list');
  assert.ok(landlordNpc, 'Landlord NPC must appear in Entity Management list');
  assert.ok(vendorNpc, 'Greens Vendor NPC must appear in Entity Management list');

  // Non-admin cannot teleport entities
  const denied = store.handleAdminTeleportEntity(playerReg.account, live, {
    entityKind: 'player',
    entityId: adminReg.account.id,
    targetTx: 12,
    targetTy: 12,
  });
  assert.equal(denied.ok, false);

  // Teleport active player to chosen coordinate (25, 32)
  const tpPlayer = store.handleAdminTeleportEntity(adminReg.account, live, {
    entityKind: 'player',
    entityId: playerReg.account.id,
    targetTx: 25,
    targetTy: 32,
    summon: false,
  });
  assert.equal(tpPlayer.ok, true);
  if (!tpPlayer.ok || tpPlayer.kind !== 'player') return;
  assert.equal(tpPlayer.tx, 25);
  assert.equal(tpPlayer.ty, 32);
  const updatedPlr = live.players.get(playerReg.account.id)!;
  assert.equal(Math.floor((updatedPlr.x + PLAYER_WIDTH * 0.5) / TILE_SIZE), 25);
  assert.equal(Math.floor((updatedPlr.y + PLAYER_HEIGHT - 4) / TILE_SIZE), 32);

  // Summon active player directly to Admin's coordinate (18, 30)
  const sumPlayer = store.handleAdminTeleportEntity(adminReg.account, live, {
    entityKind: 'player',
    entityId: playerReg.account.id,
    summon: true,
  });
  assert.equal(sumPlayer.ok, true);
  if (!sumPlayer.ok || sumPlayer.kind !== 'player') return;
  assert.equal(sumPlayer.tx, 18);
  assert.equal(sumPlayer.ty, 30);

  // Teleport an NPC onto an empty (AIR) tile nearby and verify old vs new tile state
  const targetNpcTx = 20;
  const targetNpcTy = 25;
  live.state.fg[tileIndexIn(live.state, targetNpcTx, targetNpcTy)] = ITEM_IDS.AIR;
  const tpNpc = store.handleAdminTeleportEntity(adminReg.account, live, {
    entityKind: 'npc',
    entityId: vendorNpc.entityId,
    targetTx: targetNpcTx,
    targetTy: targetNpcTy,
    summon: false,
  });
  assert.equal(tpNpc.ok, true);
  if (!tpNpc.ok || tpNpc.kind !== 'npc') return;
  assert.equal(
    live.state.fg[tileIndexIn(live.state, vendorNpc.tx, vendorNpc.ty)],
    ITEM_IDS.AIR,
    'Old NPC anchor tile must be cleared to AIR'
  );
  assert.equal(
    live.state.fg[tileIndexIn(live.state, targetNpcTx, targetNpcTy)],
    ITEM_IDS.GREENS_VENDOR_NPC,
    'New target coordinate must hold relocated NPC'
  );

  // Summon NPC directly to Admin's open tile (18, 30)
  live.state.fg[tileIndexIn(live.state, 18, 30)] = ITEM_IDS.AIR;
  const movedVendor = tpNpc.snapshot.entities.find(
    (e) => e.kind === 'npc' && e.itemId === ITEM_IDS.GREENS_VENDOR_NPC
  )!;
  const sumNpc = store.handleAdminTeleportEntity(adminReg.account, live, {
    entityKind: 'npc',
    entityId: movedVendor.entityId,
    summon: true,
  });
  assert.equal(sumNpc.ok, true);
  if (!sumNpc.ok || sumNpc.kind !== 'npc') return;
  assert.equal(sumNpc.tx, 18);
  assert.equal(sumNpc.ty, 30);
  assert.equal(live.state.fg[tileIndexIn(live.state, 18, 30)], ITEM_IDS.GREENS_VENDOR_NPC);
});


