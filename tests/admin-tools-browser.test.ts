import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthoritativeWorldStore } from '../server/worldStore.ts';
import { canEnterWorld } from '../src/game/rules.ts';

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

  const worldName = `WLD_${id.toUpperCase()}`;
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

