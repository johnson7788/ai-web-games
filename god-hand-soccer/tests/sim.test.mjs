import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, LANE_X, GAME } from '../config/game.config.js';

function playingEndless(seed = 1) {
  const run = createRun(-1, { seed });
  run.start();
  return run;
}

test('mulberry32 同种子可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('初始为 ready，start() 进入 playing', () => {
  const run = createRun(-1);
  assert.equal(run.state.phase, 'ready');
  assert.equal(run.start().ok, true);
  assert.equal(run.state.phase, 'playing');
});

test('左/右手切换前锋内外侧车道', () => {
  const run = playingEndless();
  assert.equal(run.state.leftInner, false);
  run.input('left');
  assert.equal(run.state.leftInner, true);
  run.input('right');
  assert.equal(run.state.rightInner, true);
});

test('step 推进距离（米）', () => {
  const run = playingEndless();
  for (let i = 0; i < 60; i += 1) run.step();
  assert.ok(run.state.distance > 0, '距离应增长');
  assert.ok(Math.abs(run.state.time - 1) < 1e-6, '60 步 = 1 秒');
});

test('撞墙 → lost 且 deaths+1', () => {
  const run = playingEndless();
  run.state.walls.push({ half: 'L', lane: 0, x: LANE_X[0], y: WORLD.STRIKER_Y - 10, h: GAME.WALL_H, kind: 'wall', passed: false, nearMissDone: false });
  run.step();
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.deaths, 1);
});

test('墙在另一条车道 → dodge 事件，不死亡', () => {
  const run = playingEndless();
  run.state.walls.push({ half: 'L', lane: 1, x: LANE_X[1], y: WORLD.STRIKER_Y - 10, h: GAME.WALL_H, kind: 'wall', passed: false, nearMissDone: false });
  run.step();
  assert.equal(run.state.phase, 'playing');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'dodge'), '应触发 dodge');
});

test('晶片收集 + 分数 + 连击', () => {
  const run = playingEndless();
  run.state.orbs.push({ half: 'L', lane: 0, x: LANE_X[0], y: WORLD.STRIKER_Y, r: GAME.ORB_R, collected: false });
  run.step();
  assert.equal(run.state.orbsCollected, 1);
  assert.ok(run.state.score > 0);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'orb'));
});

test('护盾吸收碰撞不死亡', () => {
  const run = playingEndless();
  run.state.effects.shield = 2;
  run.state.walls.push({ half: 'L', lane: 0, x: LANE_X[0], y: WORLD.STRIKER_Y - 10, h: GAME.WALL_H, kind: 'wall', passed: false, nearMissDone: false });
  run.step();
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.drainEvents().some((e) => e.type === 'shieldBlock'));
});

test('关卡到终点 → won 且星级 ≥1', () => {
  const run = createRun(0, { seed: 7 });
  run.start();
  run.state.distance = run.state.targetM - 0.05;
  for (let i = 0; i < 30 && run.state.phase === 'playing'; i += 1) run.step();
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'win'));
});

test('第三关会出现滚动岩石', () => {
  const run = createRun(2, { seed: 5 });
  run.start();
  for (let i = 0; i < 60 * 30; i += 1) {
    run.state.effects.shield = 1; // 保持存活，专注验证岩石生成
    run.step();
    if (run.state.walls.some((w) => w.kind === 'rock')) break;
  }
  assert.ok(run.state.walls.some((w) => w.kind === 'rock'), '30 秒内应出现岩石');
});

test('减速效果让速度减半', () => {
  const run = playingEndless();
  run.state.effects.slow = 2;
  const before = run.state.distance;
  for (let i = 0; i < 60; i += 1) run.step();
  const slowDist = run.state.distance - before;
  run.state.effects.slow = 0;
  const b2 = run.state.distance;
  for (let i = 0; i < 60; i += 1) run.step();
  const normalDist = run.state.distance - b2;
  assert.ok(slowDist < normalDist, '减速时前进更慢');
});

test('getHud 返回距离/分数/连击/道具', () => {
  const run = playingEndless();
  const hud = run.getHud();
  assert.equal(typeof hud.distance, 'number');
  assert.equal(typeof hud.score, 'number');
  assert.equal(typeof hud.combo, 'number');
  assert.ok(hud.effects && typeof hud.effects.shield === 'number');
});
