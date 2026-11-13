import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld } from '../src/game/worldGen.ts';
import { canEnterWorld, getCoveringShareLock, hasEditPermission, hasShareLockConflict } from '../src/game/rules.ts';
import { SHARE_LOCK_SPECS, DEFAULT_SHARE_LOCK_PERMISSIONS } from '../src/game/shareLocks.ts';

test('Share Lock catalogue uses the agreed dimensions and prices', () => {
  assert.deepEqual(SHARE_LOCK_SPECS.map(({ width, height, gemPrice }) => [width, height, gemPrice]), [
    [3, 2, 500],
    [5, 5, 1500],
    [7, 10, 3500],
  ]);
});

test('Share Lock grants access only inside its rectangle and respects individual permissions', () => {
  const world = generateWorld('SHARETEST');
  world.worldLock = {
    x: 50, y: 24, lockItemId: 100, ownerId: 'owner', ownerName: 'Owner',
    editors: [], editorNames: {}, publicAccess: false,
  };
  world.shareLocks = {
    '10,10': {
      x: 10, y: 10, itemId: 150, width: 3, height: 2,
      ownerId: 'owner', ownerName: 'Owner',
      access: {
        builder: { playerName: 'Builder', permissions: { ...DEFAULT_SHARE_LOCK_PERMISSIONS, break: false } },
      },
    },
  };

  assert.equal(canEnterWorld(world, 'builder').ok, true);
  assert.equal(canEnterWorld(world, 'stranger').ok, false);
  assert.equal(getCoveringShareLock(world, 12, 11)?.ownerId, 'owner');
  assert.equal(getCoveringShareLock(world, 13, 11), null);
  assert.equal(hasEditPermission(world, 'builder', 10, 10, 'build'), true);
  assert.equal(hasEditPermission(world, 'builder', 10, 10, 'break'), false);
  assert.equal(hasEditPermission(world, 'builder', 10, 10, 'interact'), true);
  assert.equal(hasEditPermission(world, 'builder', 14, 11, 'build'), false);
  assert.equal(hasEditPermission(world, 'owner', 14, 11, 'build'), true);
});

test('Share Lock rectangles cannot overlap', () => {
  const world = generateWorld('SHAREOVERLAP');
  world.shareLocks = {
    '10,10': {
      x: 10, y: 10, itemId: 150, width: 3, height: 2,
      ownerId: 'owner', ownerName: 'Owner', access: {},
    },
  };
  assert.equal(hasShareLockConflict(world, 12, 11, 5, 5), true);
  assert.equal(hasShareLockConflict(world, 13, 10, 3, 2), false);
});
