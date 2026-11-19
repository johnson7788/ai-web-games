import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { parseLevel, solveLevel, getPar, isSolvable } from '../src/game/level.js';

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.moveLimit > 0);
    assert.ok(lv.undo > 0);
    assert.ok(typeof lv.par === 'number' && lv.par > 0);
    assert.ok(Array.isArray(lv.map) && lv.map.length >= 4);
    assert.ok(lv.name && lv.name.en && lv.name.zh);
  }
});

test('每关箱子数 == 目标数（可解前提）', () => {
  for (const lv of LEVELS) {
    const p = parseLevel(lv);
    assert.equal(p.boxes.length, p.targets.size, `L${lv.index} 箱子/目标数不一致`);
    assert.ok(p.player, `L${lv.index} 缺少玩家`);
  }
});

test('可解性：12 关全部存在最优解', () => {
  for (const lv of LEVELS) {
    const sol = solveLevel(lv);
    assert.ok(sol, `L${lv.index} 不可解`);
  }
});

test('par：硬编码值与 A* 最优解一致', () => {
  for (const lv of LEVELS) {
    assert.equal(getPar(lv.index - 1), lv.par, `L${lv.index} par 不一致`);
  }
});

test('isSolvable 与 solveLevel 一致', () => {
  for (const lv of LEVELS) {
    assert.equal(isSolvable(lv), solveLevel(lv) !== null);
  }
});

test('玩家/箱子/目标均在界内，岩石不压玩家起点', () => {
  for (const lv of LEVELS) {
    const p = parseLevel(lv);
    const inGrid = (r, c) => r >= 0 && r < p.rows && c >= 0 && c < p.cols;
    assert.ok(inGrid(p.player.r, p.player.c), `L${lv.index} 玩家越界`);
    for (const b of p.boxes) assert.ok(inGrid(b.r, b.c), `L${lv.index} 箱子越界`);
    for (const k of p.rocks) {
      const [r, c] = k.split(',').map(Number);
      assert.ok(inGrid(r, c), `L${lv.index} 岩石越界`);
      assert.notEqual(k, `${p.player.r},${p.player.c}`, `L${lv.index} 岩石压玩家`);
    }
  }
});

test('首关教学：L1 单箱且 par=2', () => {
  const lv = LEVELS[0];
  assert.equal(lv.par, 2);
  const p = parseLevel(lv);
  assert.equal(p.boxes.length, 1);
  assert.equal(p.targets.size, 1);
});

test('岩石机制：至少 3 关含岩石，且逐关出现', () => {
  const withRocks = LEVELS.filter((lv) => parseLevel(lv).rocks.size > 0);
  assert.ok(withRocks.length >= 3);
  // L1 无岩石，L2 起首次出现
  assert.equal(parseLevel(LEVELS[0]).rocks.size, 0);
  assert.ok(parseLevel(LEVELS[1]).rocks.size > 0);
});
