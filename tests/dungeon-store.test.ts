import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DungeonStore } from '../server/dungeonStore.ts';
import type { AuthoritativeWorldStore, PlayerAccount } from '../server/worldStore.ts';
import { ITEM_IDS } from '../src/game/catalog.ts';
import { GATE_KEYS } from '../src/game/expansion.ts';

function createHarness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'alterbit-dungeon-'));
  const accounts = new Map<string, PlayerAccount>();
  const mockStore = {
    addInventory(account: PlayerAccount, itemId: number, qty: number) {
      const slot = account.inventory.find((entry) => entry.itemId === itemId);
      if (slot) slot.qty += qty;
      else account.inventory.push({ itemId, qty });
      return true;
    },
    consumeInventory(account: PlayerAccount, itemId: number, qty: number) {
      const slot = account.inventory.find((entry) => entry.itemId === itemId);
      if (!slot || slot.qty < qty) return false;
      slot.qty -= qty;
      if (slot.qty <= 0) account.inventory = account.inventory.filter((entry) => entry.itemId !== itemId);
      return true;
    },
    savePlayer() {},
    getOrCreatePlayer(id: string) {
      const account = accounts.get(id);
      if (!account) throw new Error('missing mock account');
      return account;
    },
  } as unknown as AuthoritativeWorldStore;
  const store = new DungeonStore(mockStore, directory);
  const makeAccount = (id: string, level = 1): PlayerAccount => {
    const account = {
      id, name: 'Explorer ' + id, level, xp: 0, gems: 1000,
      inventory: [{ itemId: ITEM_IDS.WORLD_LOCK, qty: 10 }],
      processedTxIds: [],
    } as unknown as PlayerAccount;
    accounts.set(id, account);
    return account;
  };
  return { store, makeAccount, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

test('Gate Key purchase charges only the selected currency and is idempotent', () => {
  const h = createHarness();
  try {
    const account = h.makeAccount('buyer');
    const first = h.store.buyGateKey(account, 1, 'gems', 'gate-buy-001');
    assert.equal(first.ok, true);
    assert.equal(account.gems, 950);
    assert.equal(account.inventory.find((slot) => slot.itemId === ITEM_IDS.WORLD_LOCK)?.qty, 10);
    assert.equal(account.inventory.find((slot) => slot.itemId === ITEM_IDS.GATE_KEY_I)?.qty, 1);
    const duplicate = h.store.buyGateKey(account, 1, 'gems', 'gate-buy-001');
    assert.equal(duplicate.ok, true);
    assert.equal(account.gems, 950);
    assert.equal(account.inventory.find((slot) => slot.itemId === ITEM_IDS.GATE_KEY_I)?.qty, 1);
    const lockPayment = h.store.buyGateKey(account, 1, 'world_locks', 'gate-buy-002');
    assert.equal(lockPayment.ok, true);
    assert.equal(account.gems, 950);
    assert.equal(account.inventory.find((slot) => slot.itemId === ITEM_IDS.WORLD_LOCK)?.qty, 9);
  } finally { h.cleanup(); }
});

test('Gate Key purchase and activation enforce tier level and consume exactly one key', () => {
  const h = createHarness();
  try {
    const account = h.makeAccount('runner', 1);
    assert.equal(h.store.buyGateKey(account, 2, 'gems', 'gate-buy-locked').ok, false);
    assert.equal(h.store.buyGateKey(account, 1, 'gems', 'gate-buy-003').ok, true);
    const created = h.store.createRun(account, 1, 'solo');
    assert.equal(created.ok, true);
    assert.equal(created.snapshot?.partyMode, 'solo');
    assert.equal(account.inventory.find((slot) => slot.itemId === ITEM_IDS.GATE_KEY_I), undefined);
    assert.equal(h.store.createRun(account, 1, 'solo').ok, false);
  } finally { h.cleanup(); }
});

test('solo and cooperative dungeon instances enforce their selected access model', () => {
  const h = createHarness();
  try {
    const soloOwner = h.makeAccount('solo');
    h.store.buyGateKey(soloOwner, 1, 'gems', 'solo-key');
    const solo = h.store.createRun(soloOwner, 1, 'solo');
    assert.equal(solo.ok, true);
    const visitor = h.makeAccount('visitor');
    assert.equal(h.store.joinRun(visitor, solo.snapshot!.code).ok, false);
    const coopOwner = h.makeAccount('coop');
    h.store.buyGateKey(coopOwner, 1, 'gems', 'coop-key');
    const coop = h.store.createRun(coopOwner, 1, 'cooperative');
    assert.equal(coop.ok, true);
    const partner = h.makeAccount('partner');
    const joined = h.store.joinRun(partner, coop.snapshot!.code);
    assert.equal(joined.ok, true);
    assert.equal(joined.snapshot?.players.length, 2);
  } finally { h.cleanup(); }
});

test('continuous diagonal movement is normalized and wall collision is server-enforced', () => {
  const h = createHarness();
  try {
    const account = h.makeAccount('mover');
    h.store.buyGateKey(account, 1, 'gems', 'move-key');
    const created = h.store.createRun(account, 1, 'solo');
    const initial = created.snapshot!.players[0];
    const moved = h.store.act(account, 'move', 1, -1, Date.now() + 1000);
    assert.equal(moved.ok, true);
    const current = moved.snapshot!.players[0];
    assert.ok(Math.abs(Math.hypot(current.x - initial.x, current.y - initial.y) - 0.18) < 0.0001);
    let now = Date.now() + 2000;
    for (let i = 0; i < 20; i++) {
      const result = h.store.act(account, 'move', -1, 0, now);
      now += 100;
      if (!result.ok) break;
    }
    const after = h.store.resume(account).snapshot!.players[0];
    assert.ok(after.x >= 1.22);
  } finally { h.cleanup(); }
});

test('extraction requires the final cleared room and returns the configured XP and raw ore pool once', () => {
  const h = createHarness();
  try {
    const account = h.makeAccount('extractor');
    h.store.buyGateKey(account, 1, 'gems', 'extract-key');
    const created = h.store.createRun(account, 1, 'solo');
    const runs = (h.store as unknown as { runs: Map<string, any> }).runs;
    const run = runs.get(created.snapshot!.runId);
    run.roomIndex = GATE_KEYS[0].rooms - 1;
    run.phase = 'cleared';
    run.players[account.id].x = 15.5;
    run.players[account.id].y = 5.5;
    run.enemies = [];
    const extracted = h.store.act(account, 'extract', 0, 0, Date.now() + 1000);
    assert.equal(extracted.ok, true);
    assert.equal(extracted.snapshot?.phase, 'completed');
    assert.equal(extracted.rewards?.[0].xp, GATE_KEYS[0].xp);
    assert.ok(extracted.rewards?.[0].items[0].itemId >= 830 && extracted.rewards?.[0].items[0].itemId <= 841);
    assert.equal(h.store.act(account, 'extract', 0, 0, Date.now() + 2000).ok, false);
  } finally { h.cleanup(); }
});
