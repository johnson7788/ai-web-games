import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, FORGE, ARENA, SPARK, SOLDIER } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

const seed = 7;
const stepN = (run, n) => { for (let i = 0; i < n; i += 1) run.step(1 / 60); };

test('创建对局：初始状态正确', () => {
  const run = createRun(0, { seed });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.target, LEVELS[0].target);
  assert.equal(run.state.ants.length, LEVELS[0].ants);
  assert.equal(run.state.timeLeft, LEVELS[0].time);
});

test('step 推进时间并扣减倒计时', () => {
  const run = createRun(0, { seed });
  run.step(1);
  assert.ok(run.state.time >= 0.9);
  assert.ok(run.state.timeLeft < LEVELS[0].time);
});

test('tap 在有效区域生成火种', () => {
  const run = createRun(0, { seed });
  const before = run.state.orbs.length;
  const res = run.tap(640, 400);
  assert.equal(res.ok, true);
  assert.equal(run.state.orbs.length, before + 1);
});

test('tap 在熔炉上被拒绝', () => {
  const run = createRun(0, { seed });
  assert.equal(run.tap(FORGE.x, FORGE.y).ok, false);
});

test('tap 在 HUD 区/场外被拒绝', () => {
  const run = createRun(0, { seed });
  assert.equal(run.tap(640, 20).ok, false);
  assert.equal(run.tap(5, 400).ok, false);
  assert.equal(run.tap(640, WORLD.HEIGHT - 10).ok, false);
});

test('火蚁会把火种搬进熔炉并增加热量', () => {
  const run = createRun(0, { seed });
  // 在熔炉上方连续投放，火蚁会自动取货并交付
  for (let i = 0; i < 6; i += 1) run.tap(560 + i * 32, 500);
  stepN(run, 60 * 20);
  assert.ok(run.state.heat > 0, `heat=${run.state.heat}`);
  assert.ok(run.state.stats.deliveries > 0);
});

test('热量达标后判胜', () => {
  const run = createRun(0, { seed });
  run.state.heat = run.state.target;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('倒计时结束判负', () => {
  const run = createRun(0, { seed });
  run.state.timeLeft = 0;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'lose'));
});

test('没有黄蜂时火兵无法投放', () => {
  const run = createRun(0, { seed });
  assert.equal(run.dropSoldier(640, 400).ok, false);
});

test('火兵能烧掉黄蜂并奖励热量', () => {
  const run = createRun(0, { seed });
  run.state.wasps.push({ id: 500, x: 640, y: 300, hp: 1, speed: 60 });
  const heatBefore = run.state.heat;
  const res = run.dropSoldier(640, 300);
  assert.equal(res.ok, true);
  stepN(run, 60 * 2);
  assert.equal(run.state.wasps.length, 0, '黄蜂应被烧掉');
  assert.equal(run.state.stats.kills, 1);
  assert.equal(run.state.heat, heatBefore + SOLDIER.bonusHeat);
});

test('火兵充能耗尽后无法再投放', () => {
  const run = createRun(0, { seed });
  for (let i = 0; i < SOLDIER.max; i += 1) {
    run.state.wasps.push({ id: 600 + i, x: 640, y: 250, hp: 1, speed: 60 });
    assert.equal(run.dropSoldier(640, 250).ok, true);
  }
  run.state.wasps.push({ id: 700, x: 640, y: 250, hp: 1, speed: 60 });
  assert.equal(run.dropSoldier(640, 250).ok, false);
});

test('火花表蓄满触发特殊事件', () => {
  const run = createRun(0, { seed });
  for (let i = 0; i < SPARK.max; i += 1) run.tap(400 + i * 20, 400);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'special'));
});

test('连击倍率随连续交付上升', () => {
  const run = createRun(0, { seed });
  for (let i = 0; i < 8; i += 1) run.tap(560 + i * 30, 500);
  stepN(run, 60 * 30);
  assert.ok(run.state.bestCombo >= 2, `bestCombo=${run.state.bestCombo}`);
  assert.ok(run.state.stats.combos >= 1);
});

test('drainEvents 会清空事件队列', () => {
  const run = createRun(0, { seed });
  run.tap(640, 400);
  assert.ok(run.drainEvents().length > 0);
  assert.equal(run.drainEvents().length, 0);
});

test('mulberry32 确定性随机', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
