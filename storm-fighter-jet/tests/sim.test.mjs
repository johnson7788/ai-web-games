import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD, GAME } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

test('初始状态：playing / 0 分 / 第 1 波', () => {
  const run = createRun(1);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.score, 0);
  assert.equal(run.state.level, 1);
});

test('step 推进时间', () => {
  const run = createRun(1);
  run.step(0.5);
  assert.ok(run.state.time > 0.49);
});

test('steer 改变目标方向且被接受', () => {
  const run = createRun(1);
  const res = run.steer(1, 0);
  assert.equal(res.ok, true);
  assert.ok(run.state.plane.target);
  assert.ok(Math.abs(run.state.plane.target.x - 1) < 1e-6);
});

test('战机按速度移动', () => {
  const run = createRun(1);
  run.steer(1, 0);
  const x0 = run.state.plane.x;
  for (let i = 0; i < 60; i += 1) run.step(1 / 60);
  assert.ok(run.state.plane.x > x0, '向右转向后 x 应增加');
});

test('导弹按间隔生成', () => {
  const run = createRun(1);
  for (let i = 0; i < 120; i += 1) run.step(1 / 60); // 2 秒
  run.drainEvents();
  assert.ok(run.state.missiles.length >= 1, '1 秒后应有导弹');
});

test('导弹追踪玩家（向玩家靠近）', () => {
  const run = createRun(1);
  run.state.missiles.push({ x: 0, y: 0, vx: 0, vy: 0, type: 1, speed: 200, turn: 1, life: 10, nearFlag: false, warn: false });
  run.state.plane.x = WORLD.WIDTH / 2;
  run.state.plane.y = WORLD.HEIGHT / 2;
  const d0 = Math.hypot(run.state.missiles[0].x - run.state.plane.x, run.state.missiles[0].y - run.state.plane.y);
  for (let i = 0; i < 10; i += 1) run.step(1 / 60);
  const d1 = Math.hypot(run.state.missiles[0].x - run.state.plane.x, run.state.missiles[0].y - run.state.plane.y);
  assert.ok(d1 < d0, '导弹应靠近玩家');
});

test('吃金币加分并触发连击', () => {
  const run = createRun(1);
  const p = run.state.plane;
  run.state.coins.push({ x: p.x, y: p.y, vx: 0, vy: 0 });
  run.step(1 / 60);
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'coin'));
  assert.ok(run.state.score >= GAME.COIN_SCORE);
  assert.equal(run.state.combo, 1);
});

test('连击倍率随连击数提升', () => {
  const run = createRun(1);
  run.state.combo = GAME.COMBO_STEP - 1;
  const p = run.state.plane;
  run.state.coins.push({ x: p.x, y: p.y, vx: 0, vy: 0 });
  run.step(1 / 60);
  assert.ok(run.state.comboMult >= 2, '连击达到步长后倍率应≥2');
});

test('护盾拾取后 shield=true', () => {
  const run = createRun(1);
  const p = run.state.plane;
  run.state.shields.push({ x: p.x, y: p.y, vx: 0, vy: 0 });
  run.step(1 / 60);
  assert.equal(run.state.shield, true);
});

test('护盾挡下撞击后消耗且不死', () => {
  const run = createRun(1);
  run.state.shield = true;
  const p = run.state.plane;
  run.state.missiles.push({ x: p.x, y: p.y, vx: 0, vy: 0, type: 1, speed: 0, turn: 0, life: 10, nearFlag: false, warn: false });
  run.step(1 / 60);
  assert.equal(run.state.shield, false);
  assert.equal(run.state.phase, 'playing');
});

test('无护盾被导弹击中后游戏结束', () => {
  const run = createRun(1);
  const p = run.state.plane;
  run.state.missiles.push({ x: p.x, y: p.y, vx: 0, vy: 0, type: 1, speed: 0, turn: 0, life: 10, nearFlag: false, warn: false });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'over');
  assert.ok(run.state.deaths >= 1);
});

test('第 3 波起岩石生成', () => {
  const run = createRun(1);
  run.state.level = 3;
  run._levelConfig();
  run.state.rockTimer = 0;
  run.step(1 / 60);
  assert.ok(run.state.rocks.length >= 1);
});

test('每秒存活得分 tick 事件', () => {
  const run = createRun(1);
  run.step(1.0);
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'tick'));
});

test('波次时间到自动升级', () => {
  const run = createRun(1);
  run.state.levelTime = LEVELS[0].duration - 0.01;
  run.step(1 / 60);
  assert.equal(run.state.level, 2);
});

test('drainEvents 清空事件队列', () => {
  const run = createRun(1);
  run.step(1.0);
  const first = run.drainEvents();
  assert.ok(first.length > 0);
  assert.equal(run.drainEvents().length, 0);
});

test('星星按分数门槛计算', () => {
  const run = createRun(1);
  assert.equal(run._computeStars(GAME.STAR_SCORES[0] - 1), 0);
  assert.equal(run._computeStars(GAME.STAR_SCORES[0]), 1);
  assert.equal(run._computeStars(GAME.STAR_SCORES[2]), 3);
});
