import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { generateLevel, isSolvable, solveOrder, mulberry32 } from '../src/game/level.js';

test('关卡表：12 关、index 连续、场景三章循环', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  const scenes = ['vault', 'tomb', 'dragon'];
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(scenes.includes(lv.scene), `L${lv.index} 场景非法`);
  });
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.types >= 6 && lv.types <= 12);
    assert.ok(lv.trayCap >= 6 && lv.trayCap <= 7);
    assert.ok(lv.time > 0);
    assert.ok(['pyramid', 'wedge', 'block', 'well', 'dual'].includes(lv.shape));
    assert.ok(Number.isInteger(lv.grid.x) && Number.isInteger(lv.grid.z));
    assert.equal(typeof lv.items.undo, 'number');
    assert.equal(typeof lv.items.shuffle, 'number');
    assert.ok(lv.revives >= 0);
    assert.equal(typeof lv.timed, 'boolean');
    assert.equal(typeof lv.fakeLock, 'boolean');
  }
});

test('三轴推进：品类 6→12、槽位 7→6、层数 2→6', () => {
  assert.equal(LEVELS[0].types, 6);
  assert.equal(LEVELS[LEVEL_COUNT - 1].types, 12);
  assert.equal(LEVELS[0].trayCap, 7);
  assert.equal(LEVELS[LEVEL_COUNT - 1].trayCap, 6);
  const maxLayers = Math.max(...LEVELS.map((l) => l.layers));
  assert.equal(maxLayers, 6);
  // 品类单调不减
  for (let i = 1; i < LEVEL_COUNT; i += 1) assert.ok(LEVELS[i].types >= LEVELS[i - 1].types);
});

test('生成：12 关总块数均为 3 的倍数，且品类数量均为 3 的倍数', () => {
  for (const lv of LEVELS) {
    const gen = generateLevel(lv);
    assert.equal(gen.total % 3, 0, `L${lv.index} 总块数 ${gen.total} 不是 3 的倍数`);
    const byType = new Map();
    for (const t of gen.tiles) byType.set(t.type, (byType.get(t.type) || 0) + 1);
    for (const [ty, n] of byType) {
      assert.equal(n % 3, 0, `L${lv.index} 品类 ${ty} 数量 ${n} 不是 3 的倍数`);
    }
    assert.ok(byType.size <= lv.types);
  }
});

test('生成：块坐标合法、id 连续、无重复位置', () => {
  for (const lv of LEVELS) {
    const gen = generateLevel(lv);
    const seen = new Set();
    const ids = new Set();
    for (const t of gen.tiles) {
      assert.ok(t.x >= 0 && t.x < lv.grid.x && t.z >= 0 && t.z < lv.grid.z && t.y >= 0);
      const k = `${t.x},${t.z},${t.y}`;
      assert.ok(!seen.has(k), `L${lv.index} 位置重复 ${k}`);
      seen.add(k);
      ids.add(t.id);
    }
    assert.equal(ids.size, gen.total);
  }
});

test('可解性：12 关全部无道具可解（生成器+回溯求解器）', () => {
  for (const lv of LEVELS) {
    const gen = generateLevel(lv);
    assert.equal(isSolvable(gen.tiles, lv.trayCap), true, `L${lv.index} 无解`);
    const order = solveOrder(gen.tiles, lv.trayCap);
    assert.ok(order, `L${lv.index} 求解器无解`);
    assert.equal(order.length, gen.total);
  }
});

test('可解性：解的顺序中每步都是自由块且槽不溢出', () => {
  for (const lv of LEVELS) {
    const gen = generateLevel(lv);
    const order = solveOrder(gen.tiles, lv.trayCap);
    const byId = new Map(gen.tiles.map((t) => [t.id, t]));
    const posSet = new Set(gen.tiles.map((t) => `${t.x},${t.z},${t.y}`));
    const tray = [];
    const trayCount = new Map();
    for (const id of order) {
      const t = byId.get(id);
      assert.ok(!posSet.has(`${t.x},${t.z},${t.y + 1}`), `L${lv.index} 解中拾取被压块`);
      const c = trayCount.get(t.type) || 0;
      assert.ok(!(tray.length >= lv.trayCap && c < 2), `L${lv.index} 解中槽溢出`);
      posSet.delete(`${t.x},${t.z},${t.y}`);
      tray.push(t.type);
      trayCount.set(t.type, c + 1);
      if (trayCount.get(t.type) >= 3) {
        trayCount.set(t.type, c - 2);
        let removed = 0;
        const next = [];
        for (const ty of tray) { if (ty === t.type && removed < 3) removed += 1; else next.push(ty); }
        tray.length = 0; tray.push(...next);
      }
    }
  }
});

test('求解器：可检测出无解局面（槽过小）', () => {
  const tiles = [
    { id: 0, type: 0, x: 0, z: 0, y: 0 },
    { id: 1, type: 1, x: 1, z: 0, y: 0 },
    { id: 2, type: 2, x: 2, z: 0, y: 0 },
  ];
  assert.equal(isSolvable(tiles, 2), false);
  assert.equal(solveOrder(tiles, 2), null);
  assert.equal(isSolvable(tiles, 3), true);
});

test('RNG：mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('生成：同一 seed 稳定产出相同关卡', () => {
  const a = generateLevel(LEVELS[0]);
  const b = generateLevel(LEVELS[0]);
  assert.deepEqual(a, b);
});
