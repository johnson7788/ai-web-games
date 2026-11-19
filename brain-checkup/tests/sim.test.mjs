import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, matchesAnswer, requiredTaps } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

test('levels 完整性：30 关，每关有 kind 与中英 prompt', () => {
  assert.equal(LEVEL_COUNT, 30);
  for (const lv of LEVELS) {
    assert.ok(lv.kind, `L${lv.id} 缺 kind`);
    assert.ok(lv.prompt?.en && lv.prompt?.zh, `L${lv.id} 缺 prompt`);
    assert.ok(lv.custom?.en && lv.custom?.zh, `L${lv.id} 缺 custom`);
  }
});

test('startLevel 设置关卡/阶段/计时', () => {
  const r = createRun();
  r.startLevel(0);
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.level, 1);
  assert.ok(r.state.timeLeft > 0);
  assert.equal(r.state.mistakes, 0);
});

test('act(true) 累积进度并发出 correct 事件', () => {
  const r = createRun();
  r.startLevel(0);
  const res = r.act(true);
  assert.equal(res.ok, true);
  assert.equal(res.correct, true);
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'correct'));
});

test('tap 关：taps 次正确操作后通关并给星', () => {
  const r = createRun();
  r.startLevel(0); // L1 tap taps=3
  for (let i = 0; i < 3; i += 1) r.act(true);
  assert.equal(r.state.phase, 'won');
  const win = r.drainEvents().find((e) => e.type === 'win');
  assert.ok(win);
  assert.ok(win.stars >= 1);
});

test('错误操作：mistakes 累加、连击清零、发 wrong 事件', () => {
  const r = createRun();
  r.startLevel(0);
  r.act(true);
  r.act(false);
  assert.equal(r.state.mistakes, 1);
  assert.equal(r.state.combo, 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'wrong'));
});

test('input 关：submit 正确答案通关、错误答案罚错', () => {
  const r = createRun();
  r.startLevel(9); // L10 input answer '14'
  const bad = r.submit('13');
  assert.equal(bad.correct, false);
  assert.equal(r.state.mistakes, 1);
  const good = r.submit('14');
  assert.equal(good.correct, true);
  assert.equal(r.state.phase, 'won');
});

test('matchesAnswer 手势类（无 answer）只认 true', () => {
  const lv = LEVELS[3]; // L4 flip
  assert.equal(matchesAnswer(lv, true), true);
  assert.equal(matchesAnswer(lv, false), false);
  assert.equal(requiredTaps(LEVELS[0]), 3); // tap
  assert.equal(requiredTaps(LEVELS[1]), 1); // hold
});

test('提示扣智慧，不足时拒绝', () => {
  const r = createRun();
  r.state.wisdom = 20;
  assert.equal(r.hint(), false);
  r.state.wisdom = 100;
  assert.equal(r.hint(), true);
  assert.equal(r.state.wisdom, 75);
});

test('跳关扣 50 智慧并判过（0 星）', () => {
  const r = createRun();
  r.startLevel(5);
  assert.equal(r.skip(), true);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.wisdom, 50);
  assert.equal(r.state.stars[r.state.level], 0);
});

test('连击 ≥3 触发 combo 事件并加额外智慧', () => {
  const r = createRun();
  for (const i of [0, 1, 2]) {
    r.startLevel(i);
    r.submit(LEVELS[i].answer ?? true);
  }
  assert.ok(r.state.combo >= 3);
  assert.ok(r.state.bestCombo >= 3);
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'combo'));
  // 3 连胜：3*5 基础 + 第 3 连胜额外 3
  assert.equal(r.state.wisdom, 118);
});

test('星星规则：无错且时间足 = 3 星；超时丢时间星', () => {
  const a = createRun();
  a.startLevel(1); // hold
  a.submit(true);
  assert.equal(a.state.stars[2], 3);

  const b = createRun();
  b.startLevel(1);
  b.step(31); // 超时
  b.submit(true);
  assert.ok(b.state.stars[2] <= 2);
});

test('完成最后一关标记 completed 并发 complete 事件', () => {
  const r = createRun({ totalLevels: 2 });
  r.startLevel(0);
  r.submit(LEVELS[0].answer ?? true);
  r.startLevel(1);
  r.submit(LEVELS[1].answer ?? true);
  assert.equal(r.state.completed, true);
  assert.ok(r.drainEvents().some((e) => e.type === 'complete'));
});
