import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpawner } from '../src/game/spawner.js';
import { mulberry32 } from '../src/game/rng.js';
import { STATION } from '../config/gameplay.js';

function makeRows(seed, fromStation, count) {
  const rng = mulberry32(seed);
  const sp = createSpawner(rng);
  const rows = [];
  let z = (fromStation - 1) * STATION.DISTANCE_M + 8;
  for (let i = 0; i < count; i += 1) {
    rows.push(sp.row(z, z));
    z += 18;
  }
  return rows;
}

test('每一障碍行至少留一条安全车道', () => {
  for (let st = 1; st <= 12; st += 1) {
    const rows = makeRows(100 + st, st, 60);
    for (const row of rows) {
      if (row.type === 'hazard') {
        const blocked = row.obstacles.map((o) => o.lane);
        assert.ok(blocked.length <= 2, `station ${st} 一行堵满 3 条道`);
        assert.equal(new Set(blocked).size, blocked.length, '同行车道不重复');
      }
    }
  }
});

test('窄缝站（3/8/9/11/12）每行都堵 2 条道', () => {
  for (const st of [3, 8, 9, 11, 12]) {
    const rng = mulberry32(500 + st);
    const sp = createSpawner(rng);
    const z = (st - 1) * STATION.DISTANCE_M + 10; // 固定在该站里程内
    for (let i = 0; i < 40; i += 1) {
      const row = sp.row(z, z);
      if (row.type === 'hazard') {
        assert.equal(row.obstacles.length, 2, `station ${st} 窄缝应堵 2 条道`);
      }
    }
  }
});

test('闸机站（4/8/10/12）会出现成行闸机', () => {
  for (const st of [4, 8, 10, 12]) {
    const rows = makeRows(700 + st, st, 200);
    assert.ok(rows.some((r) => r.type === 'gate'), `station ${st} 应出现闸机`);
  }
});

test('拾取物只出现在安全车道', () => {
  for (let st = 1; st <= 12; st += 1) {
    const rows = makeRows(900 + st, st, 60);
    for (const row of rows) {
      if (row.type === 'hazard') {
        const blocked = new Set(row.obstacles.map((o) => o.lane));
        for (const p of row.pickups) {
          assert.ok(!blocked.has(p.lane), '拾取物不能放在被堵车道');
        }
      }
    }
  }
});

test('第一行必含宝石、第二行必含气球（教学保证）', () => {
  const rng = mulberry32(42);
  const sp = createSpawner(rng);
  const a = sp.row(8, 8);
  const b = sp.row(26, 26);
  assert.ok(a.pickups.some((p) => p.kind === 'gem'));
  assert.ok(b.pickups.some((p) => p.kind === 'balloon'));
});

test('闸机只有红/绿两种状态', () => {
  const rows = makeRows(1234, 4, 200);
  for (const row of rows) {
    if (row.type === 'gate') {
      assert.ok(row.gate.state === 'red' || row.gate.state === 'green');
    }
  }
});
