import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, findHint } from '../src/game/sim.js';

const DIFFICULTIES = [1, 1.5, 2.2, 2.8, 3.2, 3.5, 4.2, 4.6, 5.0, 5.4, 6.0, 6.5];

test('关卡表：12 关、index 连续、难度锯齿与契约一致', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.equal(lv.difficulty, DIFFICULTIES[i]);
  });
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.rows === 10 && lv.cols === 8, `L${lv.index} 网格应为 10x8`);
    assert.ok(lv.moves > 0);
    assert.ok(lv.time > 0);
    assert.ok(lv.target > 0);
    assert.ok(Array.isArray(lv.rocks));
    assert.ok(typeof lv.newElement === 'string' && lv.newElement.trim().length > 0);
  }
});

test('关卡表：rock 坐标在界内、hp 合法、不重复、不重叠', () => {
  for (const lv of LEVELS) {
    const seen = new Set();
    for (const [r, c, hp] of lv.rocks) {
      assert.ok(r >= 0 && r < lv.rows && c >= 0 && c < lv.cols, `L${lv.index} rock 越界`);
      assert.ok(hp === 1 || hp === 2, `L${lv.index} rock hp 非法`);
      const k = `${r},${c}`;
      assert.ok(!seen.has(k), `L${lv.index} rock 重复`);
      seen.add(k);
    }
  }
});

test('关卡表：每关 newElement 唯一', () => {
  const elements = LEVELS.map((l) => l.newElement.trim());
  assert.equal(new Set(elements).size, elements.length);
});

test('关卡表：难度单调不减，目标分/步数随关卡递增', () => {
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].difficulty >= LEVELS[i - 1].difficulty);
    assert.ok(LEVELS[i].target > LEVELS[i - 1].target);
    assert.ok(LEVELS[i].moves >= LEVELS[i - 1].moves);
  }
});

test('可解性：12 关全部开局至少存在一步可消', () => {
  for (let i = 0; i < LEVELS.length; i += 1) {
    const r = createRun(i, { seed: 100 + i });
    assert.ok(findHint(r.state.grid, r.state.rows, r.state.cols), `L${i + 1} 开局无可消步`);
  }
});

test('L1 教学关：无岩石，目标与步数最宽松', () => {
  assert.equal(LEVELS[0].rocks.length, 0);
  assert.equal(LEVELS[0].tutorial, true);
  assert.ok(LEVELS[0].target === Math.min(...LEVELS.map((l) => l.target)));
});

test('L3 起引入冰封岩石，L4 出现双层岩石', () => {
  assert.equal(LEVELS[0].rocks.length, 0);
  assert.equal(LEVELS[1].rocks.length, 0);
  assert.ok(LEVELS[2].rocks.length > 0);
  assert.ok(LEVELS[3].rocks.some(([, , hp]) => hp === 2));
});
