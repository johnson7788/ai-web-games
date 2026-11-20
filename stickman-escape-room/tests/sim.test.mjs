import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

function drain(run) {
  const ev = run.drainEvents();
  return ev;
}

function advance(run, maxSteps = 800) {
  const initialLevel = run.state.level;
  let guard = maxSteps;
  while (guard-- > 0) {
    run.step(1 / 20);
    const s = run.state;
    if (s.phase === 'won' || s.phase === 'lost') break;
    if (s.level !== initialLevel) break; // 已存活进入下一关
  }
  return run.state;
}

test('初始化：9 列、玩家在第 4 列、倒计时阶段、第 1 关', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.columns, 9);
  assert.equal(run.state.playerIndex, GAME.PLAYER_START);
  assert.equal(run.state.phase, 'countdown');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.countdown, run.state.countdownMax);
});

test('右移一列 + 左移一列', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  const r = run.move(1);
  assert.ok(r.ok);
  assert.equal(run.state.playerIndex, 5);
  const l = run.move(-1);
  assert.ok(l.ok);
  assert.equal(run.state.playerIndex, 4);
});

test('左右边界夹紧', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.playerIndex = 0;
  assert.equal(run.move(-1).ok, false, '左边界不可再左');
  run.state.playerIndex = 8;
  assert.equal(run.move(1).ok, false, '右边界不可再右');
});

test('岩石柱挡路：不能走上去', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.rocks[5] = true;
  const res = run.move(1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'rock');
  assert.equal(run.state.playerIndex, 4);
});

test('冲刺跳两列并消耗次数', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.boost = 1;
  const res = run.boost(1);
  assert.ok(res.ok);
  assert.equal(run.state.playerIndex, 6);
  assert.equal(run.state.boost, 0);
  assert.equal(run.boost(1).ok, false, '没有冲刺次数');
});

test('冲刺可越过岩石', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.rocks[5] = true;
  run.state.boost = 1;
  const res = run.boost(1);
  assert.ok(res.ok);
  assert.equal(run.state.playerIndex, 6);
});

test('踩到宝石：得分 +10 并清除宝石', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.powers = new Array(9).fill(null);
  run.state.powers[5] = 'gem';
  const before = run.state.score;
  run.move(1);
  assert.equal(run.state.score, before + GAME.SCORE_GEM);
  assert.equal(run.state.powers[5], null);
  assert.ok(drain(run).some((e) => e.type === 'collect' && e.kind === 'gem'));
});

test('站在安全缺口：天花板落下后存活、连击 +1、进入下一关', () => {
  const run = createRun(0, { seed: 1 });
  const idx = run.state.safe.findIndex((v) => v && !run.state.hazards[v]);
  assert.ok(idx >= 0, '存在安全缺口');
  run.state.playerIndex = idx;
  run.state.rocks = new Array(9).fill(false);
  advance(run);
  assert.ok(run.state.phase === 'countdown' || run.state.phase === 'descending');
  assert.equal(run.state.level, 2);
  assert.equal(run.state.combo, 1);
  assert.ok(run.state.totalStars >= 1);
});

test('站在非安全柱：天花板落下后被压扁', () => {
  const run = createRun(0, { seed: 1 });
  const bad = run.state.safe.findIndex((v) => !v && !run.state.hazards[v]);
  run.state.playerIndex = bad;
  advance(run);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.combo, 0);
});

test('站在熔岩柱：天花板落下即塌陷（lose）', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.hazards = new Array(9).fill(false);
  run.state.safe = new Array(9).fill(false);
  run.state.hazards[3] = true;
  run.state.playerIndex = 3;
  advance(run);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'lava');
});

test('护盾：站在非安全柱时自动挡下一次压扁', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.hazards = new Array(9).fill(false);
  run.state.safe = new Array(9).fill(false);
  run.state.safe[6] = true;
  run.state.shield = 1;
  run.state.playerIndex = 2; // 非安全
  advance(run);
  assert.equal(run.state.phase, 'countdown');
  assert.equal(run.state.level, 2, '护盾挡下后存活进入下一关');
  assert.equal(run.state.shield, 0);
});

test('减速道具：延长本次天花板下落时长', () => {
  const run = createRun(0, { seed: 1 });
  run.state.slow = 1;
  const base = run.state.descendTime;
  while (run.state.phase === 'countdown') run.step(1 / 20);
  assert.equal(run.state.slow, 0);
  assert.equal(run.state.descendTime, +(base * 1.8).toFixed(8), '下落时长被拉长');
  assert.ok(drain(run).some((e) => e.type === 'slowUsed'));
});

test('通关：第 8 关存活 → phase=won，roomsCleared=8', () => {
  const run = createRun(7, { seed: 2 }); // 第 8 关（0-based 7）
  const idx = run.state.safe.findIndex((v) => v && !run.state.hazards[v]);
  run.state.playerIndex = idx;
  advance(run);
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.result.roomsCleared, 8);
});

test('提前就位 + 连击 ≥3 可拿 3 星', () => {
  const run = createRun(0, { seed: 1 });
  run.state.rocks = new Array(9).fill(false);
  run.state.hazards = new Array(9).fill(false);
  run.state.safe = new Array(9).fill(false);
  run.state.safe[4] = true;
  run.state.playerIndex = 4;
  run.state.combo = 2; // 这次存活后 combo=3
  run.state.countdown = 1; // 提前就位
  run.state.settled = true;
  const before = run.state.totalStars;
  advance(run);
  assert.ok(run.state.level === 2);
  assert.equal(run.state.totalStars, before + 3);
});

test('同一种子布局可复现（确定性）', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  assert.deepEqual(a.state.safe, b.state.safe);
  assert.deepEqual(a.state.heights, b.state.heights);
  const c = createRun(0, { seed: 43 });
  assert.notDeepEqual(a.state.heights, c.state.heights);
});

test('mulberry32 产生稳定序列', () => {
  const r = mulberry32(7);
  const s = mulberry32(7);
  for (let i = 0; i < 5; i += 1) assert.equal(r(), s());
});
