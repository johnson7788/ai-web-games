import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, MAX_FAULTS } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

test('关卡数据：12 关，每关都有 type 和 items', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (const lv of LEVELS) {
    assert.ok(lv.type, 'type 缺失');
    assert.ok(Array.isArray(lv.items) && lv.items.length >= 3, 'items 太少');
  }
});

test('sequence：按顺序点可通关', () => {
  const run = createRun(0);
  assert.equal(run.state.type, 'sequence');
  for (const id of run.solutionTaps()) run.tap(id);
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3);
});

test('sequence：点错会加失误并重置进度', () => {
  const run = createRun(0);
  // 第一正确节点是 'b'（order=1），故意点错 'a'
  run.tap('a');
  assert.equal(run.state.faults, 1);
  assert.equal(run.state.seq, 0);
  assert.equal(run.state.combo, 0);
});

test('select：点异类通关', () => {
  const run = createRun(2);
  const correct = run.level.items.find((x) => x.isCorrect);
  run.tap(correct.id);
  assert.equal(run.state.phase, 'won');
});

test('select：点普通项失误', () => {
  const run = createRun(2);
  const wrong = run.level.items.find((x) => !x.isCorrect);
  run.tap(wrong.id);
  assert.equal(run.state.faults, 1);
  assert.equal(run.state.phase, 'playing');
});

test('sum：凑到目标通关', () => {
  const run = createRun(4);
  assert.equal(run.level.target, 10);
  for (const id of run.solutionTaps()) run.tap(id);
  assert.equal(run.state.phase, 'won');
});

test('sum：超过目标会失误并清零', () => {
  const run = createRun(4);
  const big = run.level.items.find((x) => x.value === 8);
  run.tap(big.id);
  run.tap(run.level.items.find((x) => x.value === 6).id);
  assert.equal(run.state.faults, 1);
  assert.equal(run.state.sum, 0);
  assert.equal(run.state.picked.length, 0);
});

test('pair：配对成功消除，全部消除通关', () => {
  const run = createRun(6);
  for (const id of run.solutionTaps()) run.tap(id);
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.cleared.length, run.level.items.length);
});

test('pair：配错失误', () => {
  const run = createRun(6);
  // 点 m1 的第一个，再点 m2 的第一个（不匹配）
  const m1 = run.level.items.find((x) => x.match === 'm1');
  const m2 = run.level.items.find((x) => x.match === 'm2');
  run.tap(m1.id);
  run.tap(m2.id);
  assert.equal(run.state.faults, 1);
});

test('rotation：按解法旋转到统一朝向通关', () => {
  const run = createRun(8);
  for (const id of run.solutionTaps()) run.tap(id);
  assert.equal(run.state.phase, 'won');
});

test('rotation：旋转会改变朝向并保持 0-360', () => {
  const run = createRun(8);
  const it = run.level.items[1];
  const before = run.state.rot[it.id];
  run.tap(it.id);
  assert.equal(run.state.rot[it.id], (before + 90) % 360);
});

test('星级：0 失误 3 星，1 失误 2 星', () => {
  const clean = createRun(2);
  clean.tap(clean.level.items.find((x) => x.isCorrect).id);
  assert.equal(clean.state.stars, 3);

  const once = createRun(2);
  once.tap(once.level.items.find((x) => !x.isCorrect).id);
  once.tap(once.level.items.find((x) => x.isCorrect).id);
  assert.equal(once.state.stars, 2);
});

test('失误达上限即失败', () => {
  const run = createRun(2);
  const wrong = run.level.items.find((x) => !x.isCorrect);
  for (let i = 0; i < MAX_FAULTS; i += 1) run.tap(wrong.id);
  assert.equal(run.state.phase, 'lost');
});

test('连击：连续正确会累积，错误会清零', () => {
  const run = createRun(0);
  const taps = run.solutionTaps();
  run.tap(taps[0]);
  run.tap(taps[1]);
  assert.ok(run.state.combo >= 2);
  assert.ok(run.state.bestCombo >= 2);
  // 故意点错
  run.tap(run.level.items.find((x) => x.order === 4).id);
  assert.equal(run.state.combo, 0);
});

test('限时：倒计时到 0 失败', () => {
  const run = createRun(10); // L11 timeLimit 45
  assert.ok(run.state.timeLimit > 0);
  for (let i = 0; i < 46 * 60; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
});

test('提示：消耗一次失误机会并给出下一步 id', () => {
  const run = createRun(0);
  const before = run.state.hints;
  const res = run.hint();
  assert.equal(res.ok, true);
  assert.equal(run.state.hints, before - 1);
  assert.equal(run.state.faults, 1);
  assert.equal(res.id, 'b'); // 下一步正确答案
});

test('非进行中状态拒绝操作', () => {
  const run = createRun(2);
  run.tap(run.level.items.find((x) => x.isCorrect).id); // 通关
  const res = run.tap(run.level.items[0].id);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'notPlaying');
});

test('drainEvents：取出事件后清空', () => {
  const run = createRun(0);
  run.tap('b');
  const evs = run.drainEvents();
  assert.ok(evs.length >= 2);
  assert.equal(run.drainEvents().length, 0);
});
