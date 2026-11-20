import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { findSolution, findCleanSolution, isSolvable } from '../src/game/level.js';
import { createRun } from '../src/game/sim.js';

const SCENES = ['dawn-apiary', 'noon-workshop', 'dusk-cellar'];
const H = 'honey';
const B = 'bubble';

test('关卡表：12 关、index 连续、场景分三章', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(SCENES.includes(lv.scene));
  });
  assert.ok(LEVELS.slice(0, 4).every((l) => l.scene === 'dawn-apiary'));
  assert.ok(LEVELS.slice(4, 8).every((l) => l.scene === 'noon-workshop'));
  assert.ok(LEVELS.slice(8, 12).every((l) => l.scene === 'dusk-cellar'));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.rows >= 4 && lv.cols >= 1);
    assert.ok(lv.par >= 1);
    assert.ok(Array.isArray(lv.beads) && lv.beads.length >= 1);
    assert.ok(Array.isArray(lv.gates) && lv.gates.length >= 1);
    assert.ok(Array.isArray(lv.bottles) && lv.bottles.length >= 1);
    assert.ok(lv.beads.every((b) => b.type === H || b.type === B));
    // 每关至少有一滴蜂蜜
    assert.ok(lv.beads.some((b) => b.type === H));
  }
});

test('关卡表：坐标在界内、闸/瓶/排口不越界', () => {
  for (const lv of LEVELS) {
    const inGrid = (r, c) => r >= 0 && r < lv.rows && c >= 0 && c < lv.cols;
    for (const b of lv.beads) assert.ok(inGrid(b.r, b.c), `L${lv.index} bead 越界`);
    for (const g of lv.gates) assert.ok(inGrid(g.r, g.c), `L${lv.index} gate 越界`);
    for (const [r, c] of lv.bottles) assert.ok(inGrid(r, c), `L${lv.index} bottle 越界`);
    for (const [r, c] of lv.drains) assert.ok(inGrid(r, c), `L${lv.index} drain 越界`);
    for (const [r, c] of [...(lv.walls || []), ...(lv.combs || []), ...(lv.screens || [])]) {
      assert.ok(inGrid(r, c), `L${lv.index} 障碍越界`);
    }
  }
});

test('可解性：12 关全部存在获胜顺序', () => {
  for (const lv of LEVELS) {
    const sol = findSolution(lv.index - 1);
    assert.ok(sol, `L${lv.index} 无可解顺序`);
    assert.ok(sol.length <= lv.gates.length);
  }
});

test('干净解：findCleanSolution 长度等于 par', () => {
  for (const lv of LEVELS) {
    const clean = findCleanSolution(lv.index - 1);
    assert.ok(clean, `L${lv.index} 无干净解`);
    assert.equal(clean.length, lv.par, `L${lv.index} 干净解长度与 par 不符`);
  }
});

test('初始静止：每关不拉闸步进，珠子不动且不误判', () => {
  for (const lv of LEVELS) {
    const r = createRun(lv.index - 1, { seed: 1 });
    const before = r.state.beads.filter((b) => !b.done).map((b) => `${b.type}@${b.r},${b.c}`).sort().join('|');
    for (let i = 0; i < 12 && r.state.phase === 'playing'; i += 1) r.tick();
    const after = r.state.beads.filter((b) => !b.done).map((b) => `${b.type}@${b.r},${b.c}`).sort().join('|');
    assert.equal(after, before, `L${lv.index} 初始状态发生位移`);
    assert.equal(r.state.phase, 'playing', `L${lv.index} 初始即结束`);
  }
});

test('isSolvable 与 findSolution 一致', () => {
  for (const lv of LEVELS) {
    assert.equal(isSolvable(lv.index - 1), findSolution(lv.index - 1) !== null);
  }
});

test('L1 是教学关', () => {
  const lv = LEVELS[0];
  assert.equal(lv.tutorial, true);
  assert.equal(lv.par, 1);
  assert.equal(lv.beads.length, 1);
  assert.equal(lv.beads[0].type, H);
});

test('难度整体递增（锯齿允许局部回落，但首尾递增）', () => {
  assert.ok(LEVELS[0].difficulty < LEVELS[LEVEL_COUNT - 1].difficulty);
  assert.ok(LEVELS[LEVEL_COUNT - 1].difficulty > 6);
});
