import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, simulateShot, mulberry32, LEVELS, LEVEL_COUNT } from '../src/game/sim.js';
import { WORLD, PHYS } from '../config/game.config.js';

test('createRun 初始化：发球点、踢球次数、星级、阶段', () => {
  const run = createRun(0);
  assert.equal(run.state.level, 1);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.shotsLeft, LEVELS[0].par);
  assert.equal(run.state.shotsUsed, 0);
  assert.equal(run.state.stars, 0);
  assert.equal(run.state.ball.x, LEVELS[0].tee.x);
  assert.equal(run.state.ball.y, LEVELS[0].tee.y);
  assert.equal(run.state.ball.active, false);
});

test('flick 发射并消耗一次踢球', () => {
  const run = createRun(0);
  const res = run.flick(500, 400);
  assert.equal(res.ok, true);
  assert.equal(run.state.ball.active, true);
  assert.equal(run.state.shotsUsed, 1);
  assert.equal(run.state.shotsLeft, LEVELS[0].par - 1);
});

test('飞行中不能再次踢球', () => {
  const run = createRun(0);
  run.flick(500, 400);
  const res2 = run.flick(100, 100);
  assert.equal(res2.ok, false);
  assert.equal(res2.reason, 'inFlight');
});

test('重力使球下落并最终停球', () => {
  const run = createRun(0);
  run.flick(300, 300);
  let guard = 0;
  while (run.state.ball.active && run.state.phase === 'playing' && guard < 1200) {
    run.step(1 / 60);
    guard += 1;
  }
  assert.equal(run.state.ball.active, false);
  assert.ok(run.state.ball.y >= WORLD.GROUND_Y + WORLD.BALL_R - 1e-6);
});

test('力度过小拒绝踢球', () => {
  const run = createRun(0);
  assert.equal(run.flick(0, 0).ok, false);
});

test('debugWin 直接结算为胜', () => {
  const run = createRun(0);
  const r = run.debugWin();
  assert.equal(r.ok, true);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.result && run.state.result.won === true);
});

test('exhaust 耗尽次数判负', () => {
  const run = createRun(0);
  run.exhaust();
  assert.equal(run.state.phase, 'lost');
  assert.ok(run.state.result && run.state.result.won === false);
});

test('三关都能被物理解算器进球（从发球点）', () => {
  for (const lv of LEVELS) {
    const res = simulateShot(lv, lv.tee.x, lv.tee.y, 700, 500);
    // 用网格搜索验证可解（与 selfplay 同策略）
    const speeds = [500, 700, 900, 1100, 1300, 1500];
    let reached = false;
    for (const sp of speeds) {
      for (let a = 0; a < 360 && !reached; a += 6) {
        const rad = a * Math.PI / 180;
        const r2 = simulateShot(lv, lv.tee.x, lv.tee.y, Math.cos(rad) * sp, Math.sin(rad) * sp);
        if (r2.reachedGoal) { reached = true; break; }
      }
      if (reached) break;
    }
    assert.ok(reached, `L${lv.index} 应可进球`);
    assert.ok(res.t >= 0);
  }
});

test('simulateShot 可吃到星与能量球', () => {
  const lv = LEVELS[0];
  const star = lv.stars[0];
  const speeds = [500, 700, 900, 1100, 1300, 1500];
  let hit = false;
  for (const sp of speeds) {
    for (let a = 0; a < 360 && !hit; a += 6) {
      const rad = a * Math.PI / 180;
      const res = simulateShot(lv, lv.tee.x, lv.tee.y, Math.cos(rad) * sp, Math.sin(rad) * sp, { watch: star });
      if (res.watchHit) { hit = true; break; }
    }
    if (hit) break;
  }
  assert.ok(hit, '应能命中第一颗星');
});

test('吃星触发连击窗口', () => {
  const run = createRun(0);
  const s = run.state;
  s.ball.active = true;
  s.ball.vx = 0; s.ball.vy = 0;
  s.ball.x = run._level.stars[0].x;
  s.ball.y = run._level.stars[0].y;
  run.step(1 / 60);
  assert.equal(s.stars, 1);
  assert.equal(s.combo, 1);
  // 第二颗星（3 秒窗口内）
  s.ball.active = true;
  s.ball.x = run._level.stars[1].x;
  s.ball.y = run._level.stars[1].y;
  s.time = 1;
  run.step(1 / 60);
  assert.equal(s.stars, 2);
  assert.equal(s.combo, 2);
});

test('时间星阈值：10/20/30 秒三档', () => {
  const run = createRun(0);
  run.state.time = 5;
  assert.equal(run._timeStarCount(), 3);
  run.state.time = 15;
  assert.equal(run._timeStarCount(), 2);
  run.state.time = 25;
  assert.equal(run._timeStarCount(), 1);
  run.state.time = 31;
  assert.equal(run._timeStarCount(), 0);
});

test('LEVEL_COUNT 为 3', () => {
  assert.equal(LEVEL_COUNT, 3);
  assert.equal(LEVELS.length, 3);
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
  assert.ok(a() >= 0 && a() <= 1);
});
