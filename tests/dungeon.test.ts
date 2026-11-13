import test from 'node:test';
import assert from 'node:assert/strict';
import { GATE_KEYS } from '../src/game/expansion.ts';
import {
  createDungeonMap,
  DUNGEON_HEIGHT,
  DUNGEON_WIDTH,
  getDungeonEnemyStats,
  getDungeonKey,
  getDungeonOreReward,
  isDungeonWalkable,
} from '../src/game/dungeon.ts';

test('dungeon room generation is deterministic and uses the expected arena dimensions', () => {
  const first = createDungeonMap(3, 2, 123456);
  const second = createDungeonMap(3, 2, 123456);
  assert.deepEqual(first, second);
  assert.equal(first.length, DUNGEON_HEIGHT);
  assert.ok(first.every((row) => row.length === DUNGEON_WIDTH));
  assert.equal(first[5][1], '<');
  assert.equal(first[5][DUNGEON_WIDTH - 2], '>');
});

test('dungeon arena keeps a connected central route between entrance and exit', () => {
  const map = createDungeonMap(5, 6, 98765);
  const queue: Array<[number, number]> = [[1, 5]];
  const seen = new Set(['1,5']);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const key = nx + ',' + ny;
      if (!seen.has(key) && isDungeonWalkable(map[ny]?.[nx] ?? '#')) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  assert.ok(seen.has((DUNGEON_WIDTH - 2) + ',5'));
});

test('all five Gate Key tiers map to the blueprint room counts and level gates', () => {
  assert.equal(GATE_KEYS.length, 5);
  for (const key of GATE_KEYS) {
    assert.equal(getDungeonKey(key.tier)?.id, key.id);
    assert.ok(key.rooms >= 3 && key.rooms <= 7);
    assert.ok(key.minLevel >= 1);
  }
  assert.equal(getDungeonKey(6), null);
});

test('enemy scaling and ore rewards stay within safe configured bounds', () => {
  for (let tier = 1; tier <= 5; tier++) {
    const normal = getDungeonEnemyStats(tier, false);
    const boss = getDungeonEnemyStats(tier, true);
    assert.ok(normal.hp > 0 && boss.hp > normal.hp);
    assert.ok(normal.damage > 0 && boss.damage > normal.damage);
    const reward = getDungeonOreReward(tier);
    assert.equal(reward.length, 1);
    assert.ok(reward[0].qty >= 1 && reward[0].qty <= 4);
    assert.ok([201, 202, 203, 204].includes(reward[0].itemId));
  }
});
