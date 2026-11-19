import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import {
  WORLD,
  LANES_X,
  PLAYER_Y,
  PLAYER_R,
  BASE_SPEED,
  ENTITY_R,
  RUSH_SPARKS,
} from '../config/game.config.js';

function stepFor(run, seconds, fn) {
  const n = Math.round(seconds * 60);
  const events = [];
  for (let i = 0; i < n; i += 1) {
    if (fn) fn(i);
    run.step(1 / 60);
    events.push(...run.drainEvents());
  }
  return events;
}

test('创建 run：初始状态在左道、playing、速度 BASE_SPEED', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.lane, 0);
  assert.equal(run.state.speed, BASE_SPEED);
  assert.equal(run.state.tier, 1);
});

test('tap：切到另一条车道并返回 ok', () => {
  const run = createRun({ seed: 1 });
  const res = run.tap();
  assert.equal(res.ok, true);
  assert.equal(run.state.lane, 1);
  const res2 = run.tap();
  assert.equal(res2.ok, true);
  assert.equal(run.state.lane, 0);
});

test('moveLane：同车道不算有效动作', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.moveLane(0).ok, false);
  assert.equal(run.moveLane(1).ok, true);
  assert.equal(run.moveLane(1).ok, false);
});

test('首生成固定：第一个是左道仙人掌，第二个（1 秒后）是左道香蕉', () => {
  const run = createRun({ seed: 1 });
  run.step(1 / 60);
  run.drainEvents();
  assert.equal(run.state.entities[0].kind, 'cactus');
  assert.equal(run.state.entities[0].lane, 0);
  // 1 秒后第二个生成出现
  for (let i = 0; i < 60; i += 1) { run.step(1 / 60); run.drainEvents(); }
  const banana = run.state.entities.find((e) => e.kind === 'banana');
  assert.ok(banana, '第二个生成应是香蕉');
  assert.equal(banana.lane, 0);
});

test('noinput：不切道会被障碍撞死', () => {
  const run = createRun({ seed: 1 });
  const events = stepFor(run, 6);
  assert.equal(run.state.phase, 'over');
  assert.ok(events.some((e) => e.type === 'death'));
});

test('吃香蕉：加分、连击递增、maxCombo 记录', () => {
  const run = createRun({ seed: 1 });
  // 手动放一根香蕉在玩家正上方，一步即可吃到
  run.state.entities = [{ kind: 'banana', lane: 0, x: LANES_X[0], y: PLAYER_Y, vy: 0, size: ENTITY_R.banana }];
  run.step(1 / 60);
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'collect'));
  assert.ok(run.state.combo >= 1);
  assert.ok(run.state.maxCombo >= 1);
});

test('吃护盾：获得无敌时间', () => {
  const run = createRun({ seed: 1 });
  run.state.entities = [{ kind: 'shield', lane: 0, x: LANES_X[0], y: PLAYER_Y, vy: 0, size: ENTITY_R.shield }];
  run.step(1 / 60);
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'shield'));
  assert.ok(run.state.invincible > 0);
});

test('无敌时撞障碍：障碍被撞碎（smash）而不是死亡', () => {
  const run = createRun({ seed: 1 });
  run.state.invincible = 3;
  run.state.entities = [{ kind: 'cactus', lane: 0, x: LANES_X[0], y: PLAYER_Y, vy: 0, size: ENTITY_R.cactus }];
  run.step(1 / 60);
  const events = run.drainEvents();
  assert.equal(run.state.phase, 'playing');
  assert.ok(events.some((e) => e.type === 'smash'));
});

test('集满火花：触发冲刺事件', () => {
  const run = createRun({ seed: 1 });
  run.state.sparks = RUSH_SPARKS - 1;
  run.state.entities = [{ kind: 'spark', lane: 0, x: LANES_X[0], y: PLAYER_Y, vy: 0, size: ENTITY_R.spark }];
  run.step(1 / 60);
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'rushStart'));
  assert.ok(run.state.rush > 0);
});

test('分数累计：step 推进后 distance 与 score 增长', () => {
  const run = createRun({ seed: 1 });
  const before = run.state.distance;
  stepFor(run, 1);
  assert.ok(run.state.distance > before);
  assert.ok(run.state.score >= 0);
});

test('升档：分数达到阈值后 tier 提升、速度提升', () => {
  const run = createRun({ seed: 1 });
  run.state.score = 100;
  run.step(1 / 60);
  run.drainEvents();
  assert.equal(run.state.tier, 2);
  assert.ok(run.state.speed > BASE_SPEED);
});

test('drainEvents：消费后清空', () => {
  const run = createRun({ seed: 1 });
  run.tap();
  run.drainEvents();
  assert.equal(run.drainEvents().length, 0);
});

test('mulberry32：同 seed 同序列，异 seed 异序列', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
  const c = mulberry32(8);
  assert.notEqual(b(), c());
});

test('getHud：返回 score/tier/speed/combo/sparks/rush/invincible', () => {
  const run = createRun({ seed: 1 });
  const hud = run.getHud();
  for (const k of ['score', 'tier', 'speed', 'combo', 'sparks', 'rush', 'invincible', 'distance']) {
    assert.ok(k in hud, `hud 缺少 ${k}`);
  }
});
