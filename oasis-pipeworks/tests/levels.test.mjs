import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { isSolvable, findPath, pathRequirements } from '../src/game/level.js';

const DIFFICULTIES = [1, 1.5, 2.2, 2.8, 3.2, 3.5, 4.2, 4.6, 5, 5.4, 6, 6.5];

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
    assert.ok(lv.rows >= 3 && lv.cols >= 4);
    assert.ok(lv.time > 0);
    assert.ok(lv.blockTime > 0);
    assert.ok(lv.queueCap >= 3);
    assert.ok(['dawn-desert', 'dusk-canyon', 'night-oasis'].includes(lv.scene));
    assert.ok(Array.isArray(lv.rocks) && Array.isArray(lv.blooms));
    assert.ok(lv.start && lv.end);
    assert.ok(['top', 'down', 'left', 'right'].includes(lv.start.entrance));
    assert.ok(['top', 'down', 'left', 'right'].includes(lv.end.entrance));
    assert.equal(typeof lv.dig, 'boolean');
    assert.equal(typeof lv.lock, 'boolean');
  }
});

test('关卡表：start/end 在界内，rocks 不压 start/end，blooms 不落 rock/start/end', () => {
  for (const lv of LEVELS) {
    const inGrid = (r, c) => r >= 0 && r < lv.rows && c >= 0 && c < lv.cols;
    assert.ok(inGrid(lv.start.r, lv.start.c), `L${lv.index} start 越界`);
    assert.ok(inGrid(lv.end.r, lv.end.c), `L${lv.index} end 越界`);
    const rockSet = new Set(lv.rocks.map(([r, c]) => `${r},${c}`));
    for (const [r, c] of lv.rocks) {
      assert.ok(inGrid(r, c), `L${lv.index} rock 越界`);
      assert.notEqual(`${r},${c}`, `${lv.start.r},${lv.start.c}`, `L${lv.index} rock 压 start`);
      assert.notEqual(`${r},${c}`, `${lv.end.r},${lv.end.c}`, `L${lv.index} rock 压 end`);
    }
    for (const [r, c] of lv.blooms) {
      assert.ok(inGrid(r, c), `L${lv.index} bloom 越界`);
      assert.ok(!rockSet.has(`${r},${c}`), `L${lv.index} bloom 落 rock`);
      assert.notEqual(`${r},${c}`, `${lv.start.r},${lv.start.c}`, `L${lv.index} bloom 压 start`);
      assert.notEqual(`${r},${c}`, `${lv.end.r},${lv.end.c}`, `L${lv.index} bloom 压 end`);
    }
  }
});

test('可解性：12 关全部存在 start→end 通路（岩石不可穿）', () => {
  for (const lv of LEVELS) {
    const path = findPath(lv);
    assert.ok(path, `L${lv.index} 无可解通路`);
    assert.deepEqual([path[0].r, path[0].c], [lv.start.r, lv.start.c]);
    assert.deepEqual([path[path.length - 1].r, path[path.length - 1].c], [lv.end.r, lv.end.c]);
    // 通路不得穿越岩石
    const rockSet = new Set(lv.rocks.map(([r, c]) => `${r},${c}`));
    for (const { r, c } of path) assert.ok(!rockSet.has(`${r},${c}`), `L${lv.index} 通路穿过岩石`);
  }
});

test('可解性：通路相邻（四连通）且不重复', () => {
  for (const lv of LEVELS) {
    const path = findPath(lv);
    const seen = new Set();
    for (let i = 0; i < path.length; i += 1) {
      const k = `${path[i].r},${path[i].c}`;
      assert.ok(!seen.has(k), `L${lv.index} 通路重复经过 ${k}`);
      seen.add(k);
      if (i > 0) {
        const manhattan = Math.abs(path[i].r - path[i - 1].r) + Math.abs(path[i].c - path[i - 1].c);
        assert.equal(manhattan, 1, `L${lv.index} 通路不连续`);
      }
    }
  }
});

test('L1 failSafe：最短路长度 ≤ rows+cols（无岩石阻挡）', () => {
  const lv = LEVELS[0];
  assert.equal(lv.failSafe, true);
  assert.equal(lv.rocks.length, 0);
  const path = findPath(lv);
  assert.ok(path);
  assert.ok(path.length - 1 <= lv.rows + lv.cols, 'L1 最短路超过 rows+cols');
  // L1 教学元数据
  assert.equal(lv.tutorial, true);
  assert.deepEqual(lv.teachSteps, ['grab', 'place', 'flow']);
});

test('pathRequirements：中间格所需管件均为合法管型', () => {
  for (const lv of LEVELS) {
    const req = pathRequirements(lv);
    assert.ok(req);
    for (const piece of req.values()) {
      assert.ok(['E', 'N', 'UL', 'UR', 'LL', 'LR'].includes(piece), `L${lv.index} 出现非法管件 ${piece}`);
    }
  }
});

test('solver 导出：isSolvable 与 findPath 一致', () => {
  for (const lv of LEVELS) {
    assert.equal(isSolvable(lv), findPath(lv) !== null);
  }
});

test('第 6 关起终点对调：start 右下 / end 左上', () => {
  const lv = LEVELS[5];
  assert.deepEqual([lv.start.r, lv.start.c], [lv.rows - 1, lv.cols - 1]);
  assert.deepEqual([lv.end.r, lv.end.c], [0, 0]);
});

test('水速关：L8/L12 blockTime 3（×1.3 提速），其余默认 4（L1=3.5 failSafe）', () => {
  assert.equal(LEVELS[0].blockTime, 3.5);
  assert.equal(LEVELS[7].blockTime, 3);
  assert.equal(LEVELS[11].blockTime, 3);
  for (let i = 1; i < 7; i += 1) assert.equal(LEVELS[i].blockTime, 4);
  for (let i = 8; i < 11; i += 1) assert.equal(LEVELS[i].blockTime, 4);
});

test('锁定件：仅 L10+ 开启 lock，且解锁阈值=3', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.lock, lv.index >= 10);
  }
});

test('铲除解锁：L3 起 dig=true', () => {
  assert.equal(LEVELS[0].dig, false);
  assert.equal(LEVELS[1].dig, false);
  for (let i = 2; i < 12; i += 1) assert.equal(LEVELS[i].dig, true);
});
