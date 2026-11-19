import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT, SIZE, applySwap, makeCell } from '../config/levels.js';

test('网格是 7x7 = 49 格', () => {
  const run = createRun(0);
  assert.equal(run.state.size, SIZE);
  assert.equal(run.state.cells.length, SIZE * SIZE);
});

test('12 个关卡都定义且可解（逆向打乱序列必通关）', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (const level of LEVELS) {
    const run = createRun(level.index - 1);
    const seq = [...run.state.scramble].reverse();
    for (const idx of seq) run.click(idx);
    assert.equal(run.state.phase, 'won', `level ${level.index} 应该可解`);
    assert.equal(run.state.matched, run.state.targetCount);
  }
});

test('每关初始可动阴格数 == 目标数（换色守恒）', () => {
  for (const level of LEVELS) {
    const run = createRun(level.index - 1);
    let yin = 0;
    for (const c of run.state.cells) if (c.movable && c.color === 'yin') yin += 1;
    assert.equal(yin, level.targetCount, `level ${level.index} 守恒`);
  }
});

test('点格互换左右邻居', () => {
  const cells = Array.from({ length: 49 }, () => makeCell('yang', true));
  cells[10].color = 'yin';
  cells[12].color = 'yang';
  applySwap(cells, 11);
  assert.equal(cells[10].color, 'yang');
  assert.equal(cells[12].color, 'yin');
});

test('点格互换上下邻居', () => {
  const cells = Array.from({ length: 49 }, () => makeCell('yang', true));
  cells[4].color = 'yin';
  cells[18].color = 'yang';
  applySwap(cells, 11);
  assert.equal(cells[4].color, 'yang');
  assert.equal(cells[18].color, 'yin');
});

test('锁石不可点', () => {
  const run = createRun(2); // L3 Stream 有锁石
  const rock = run.state.rocks[0].i;
  const res = run.click(rock);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'locked');
});

test('越界点击返回 bounds', () => {
  const run = createRun(0);
  assert.equal(run.click(49).reason, 'bounds');
  assert.equal(run.click(-1).reason, 'bounds');
});

test('步数超上限判负', () => {
  const run = createRun(0);
  const center = 24;
  let guard = 200;
  while (guard-- > 0 && run.state.phase === 'playing') {
    run.click(center);
  }
  assert.equal(run.state.phase, 'lost');
});

test('撤销回退一步并回退步数', () => {
  const run = createRun(0);
  const before = run.state.cells.map((c) => c.color);
  run.click(24);
  assert.equal(run.state.moves, 1);
  const res = run.undo();
  assert.equal(res.ok, true);
  assert.equal(run.state.moves, 0);
  assert.deepEqual(run.state.cells.map((c) => c.color), before);
});

test('通关按步数给星：逆解恰为 par 步 → 3 星', () => {
  const run = createRun(0);
  const seq = [...run.state.scramble].reverse();
  for (const idx of seq) run.click(idx);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.moves <= run.state.par, `moves=${run.state.moves} <= par=${run.state.par}`);
  assert.equal(run.state.stars, 3);
});

test('事件表包含 levelStart 与 win', () => {
  const run = createRun(0);
  const first = run.drainEvents();
  assert.equal(first[0].type, 'levelStart');
  for (const idx of [...run.state.scramble].reverse()) run.click(idx);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'win'));
  assert.ok(evs.some((e) => e.type === 'star'));
});
