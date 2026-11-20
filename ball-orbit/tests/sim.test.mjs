import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WAVES, waveAt } from '../config/waves.js';
import { ASTEROID, COMET, SHOT, STEP } from '../config/gameplay.js';

// 逐 tick step + drain，收集全部事件，满足 pred 即停
function stepUntil(run, pred, maxTicks = 3000, input = {}) {
  const all = [];
  for (let i = 0; i < maxTicks; i += 1) {
    run.step(input);
    const evs = run.drainEvents();
    all.push(...evs);
    if (pred(run, evs, all)) return { ok: true, ticks: i + 1, evs: all };
  }
  return { ok: false, evs: all };
}

function firstEvent(run, type, maxTicks = 2000, input = {}) {
  return stepUntil(run, (_r, _e, all) => all.some((e) => e.type === type), maxTicks, input);
}

function singleAsteroid(over = {}) {
  return [{
    id: 9999, col: 4, rowY: 600, x: 640, y: 600, ox: 0, tilt: 0,
    hardness: 1, initial: 1, kind: 'normal', moving: false, vx: 0,
    ...over,
  }];
}

test('createRun：初始状态正确', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.wave, 1);
  assert.equal(run.scene, 'dust');
  const w = waveAt(1);
  assert.ok(run.asteroids.length > 0);
  assert.ok(run.asteroids.length <= w.rows * w.cols);
  assert.equal(run.ballsPerShot, SHOT.BALLS_START);
  assert.equal(run.canFire, true);
});

test('step：无输入推进 time，不崩', () => {
  const run = createRun({ seed: 1 });
  const t0 = run.time;
  for (let i = 0; i < 10; i += 1) run.step({});
  assert.ok(run.time > t0);
});

test('发射：fire 后产生流星，canFire 变 false', () => {
  const run = createRun({ seed: 2 });
  run.step({ aimAngle: 0, fire: true });
  run.drainEvents();
  for (let i = 0; i < 3; i += 1) run.step({});
  assert.ok(run.balls.length >= 1, 'fire 后应有流星在飞');
  assert.equal(run.canFire, false);
});

test('回收：流星落底后 canFire 恢复', () => {
  const run = createRun({ seed: 3 });
  run.step({ aimAngle: 0, fire: true });
  run.drainEvents();
  const res = stepUntil(run, (r) => r.canFire && r.balls.length === 0, 1200);
  assert.ok(res.ok, '应回收完成');
});

test('瞄准角度被 clamp 到合法范围', () => {
  const run = createRun({ seed: 4 });
  run.step({ aimAngle: 99 });
  assert.ok(run.aimAngle <= 1.15);
  run.step({ aimAngle: -99 });
  assert.ok(run.aimAngle >= -1.15);
});

test('直射击碎一颗低值陨石（asteroidBreak）', () => {
  const run = createRun({ seed: 5 });
  run.asteroids = singleAsteroid({ y: 400, rowY: 400, hardness: 1 });
  const res = firstEvent(run, 'asteroidBreak', 1200, { aimAngle: 0, fire: true });
  assert.ok(res.ok, '应出现 asteroidBreak');
  assert.equal(run.score, 1);
});

test('score = 清除硬度累计，stats 同步', () => {
  const run = createRun({ seed: 6 });
  run.asteroids = singleAsteroid({ y: 400, rowY: 400, hardness: 3, initial: 3 });
  firstEvent(run, 'asteroidBreak', 2400, { aimAngle: 0, fire: true });
  assert.equal(run.score, 3);
  assert.equal(run.stats.hardnessCleared, 3);
});

test('addBall 道具 +1 流星', () => {
  const run = createRun({ seed: 7 });
  run.asteroids = singleAsteroid({ y: 400, rowY: 400, kind: 'addBall' });
  const before = run.ballsPerShot;
  const res = firstEvent(run, 'addBall', 1200, { aimAngle: 0, fire: true });
  assert.ok(res.ok);
  assert.equal(run.ballsPerShot, before + 1);
});

test('护盾砖：普通流星撞不破（shieldBlock）', () => {
  const run = createRun({ seed: 8 });
  run.asteroids = singleAsteroid({ y: 400, rowY: 400, kind: 'shield', hardness: 3, initial: 3 });
  const res = firstEvent(run, 'shieldBlock', 1200, { aimAngle: 0, fire: true });
  assert.ok(res.ok, '应出现 shieldBlock');
  assert.equal(run.asteroids.length, 1, '护盾不应被普通流星击碎');
});

test('彗星：清 50 硬度蓄一颗', () => {
  const run = createRun({ seed: 9 });
  run.cometCharge = COMET.CHARGE_PER - 1;
  run.comets = 0;
  run.asteroids = singleAsteroid({ y: 400, rowY: 400, hardness: 2, initial: 2 });
  const res = firstEvent(run, 'cometCharge', 1200, { aimAngle: 0, fire: true });
  assert.ok(res.ok, '应触发 cometCharge');
  assert.equal(run.comets, 1);
});

test('彗星：cometFire 且 ×3 一击碎 3 硬度', () => {
  const run = createRun({ seed: 10 });
  run.comets = 1;
  run.asteroids = singleAsteroid({ y: 400, rowY: 400, hardness: 3, initial: 3 });
  run.step({ aimAngle: 0, fire: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'cometFire'));
  const res = firstEvent(run, 'asteroidBreak', 1200, { aimAngle: 0 });
  assert.ok(res.ok, '彗星应一击击碎 3 硬度陨石');
  assert.equal(run.score, 3);
});

test('下坠：回合结束后陨石整体下移一行（且只一行）', () => {
  const run = createRun({ seed: 11 });
  run.step({ aimAngle: 0, fire: true });
  run.drainEvents();
  const res = stepUntil(run, (r) => r.canFire && r.balls.length === 0, 800);
  assert.ok(res.ok, '应回收');
  assert.equal(run.rowsCleared, 1, '只应下坠一行（不应触发空闲下坠）');
});

test('波次推进：足够下坠后 wave 递增', () => {
  const run = createRun({ seed: 12, startWave: 1 });
  for (let d = 0; d < 3; d += 1) {
    run.step({ aimAngle: 0, fire: true });
    run.drainEvents();
    stepUntil(run, (r) => r.canFire && r.balls.length === 0, 800);
  }
  assert.ok(run.wave >= 2, `wave 应推进，实际 ${run.wave}`);
});

test('判负：护盾陨石触底 → death', () => {
  const run = createRun({ seed: 13 });
  run.asteroids = singleAsteroid({ y: ASTEROID.DANGER_Y - ASTEROID.H / 2 - 1, rowY: ASTEROID.DANGER_Y - ASTEROID.H / 2 - 1, kind: 'shield', hardness: 3, initial: 3 });
  run.step({ aimAngle: 0, fire: true });
  run.drainEvents();
  const res = stepUntil(run, (r) => r.phase === 'dead', 900);
  assert.ok(res.ok, '应判负');
});

test('引力涟漪：清整行 → rowClear', () => {
  const run = createRun({ seed: 14 });
  run.asteroids = singleAsteroid({ y: 400, rowY: 400, hardness: 1 });
  const res = firstEvent(run, 'rowClear', 1200, { aimAngle: 0, fire: true });
  assert.ok(res.ok, '应触发 rowClear');
});

test('确定性：同 seed 同结果', () => {
  const a = createRun({ seed: 99 });
  const b = createRun({ seed: 99 });
  for (let i = 0; i < 200; i += 1) {
    a.step({ aimAngle: 0.3, fire: i % 50 === 0 });
    b.step({ aimAngle: 0.3, fire: i % 50 === 0 });
    a.drainEvents();
    b.drainEvents();
  }
  assert.equal(a.score, b.score);
  assert.equal(a.rowsCleared, b.rowsCleared);
  assert.equal(a.wave, b.wave);
});

test('getHud 字段齐全', () => {
  const run = createRun({ seed: 15 });
  const hud = run.getHud();
  for (const k of ['wave', 'scene', 'score', 'ballsPerShot', 'comets', 'cometProgress', 'planets', 'phase']) {
    assert.ok(k in hud, `缺少 ${k}`);
  }
});

test('drainEvents 清空队列', () => {
  const run = createRun({ seed: 16 });
  run.step({ aimAngle: 0.1 });
  run.step({ aimAngle: 0.2 });
  const evs = run.drainEvents();
  assert.ok(evs.length >= 1);
  assert.equal(run.drainEvents().length, 0);
});

test('移动陨石：横移在边界内反弹', () => {
  const run = createRun({ seed: 17 });
  run.asteroids = singleAsteroid({ x: 10, y: 300, rowY: 300, moving: true, vx: -ASTEROID.MOVE_SPEED });
  for (let i = 0; i < 60; i += 1) run.step({});
  assert.ok(run.asteroids[0].x >= ASTEROID.W / 2 - 1e-6, '不应越左界');
  assert.ok(run.asteroids[0].vx > 0, '应反向');
});

test('波次上限 clamp 到 12', () => {
  const run = createRun({ seed: 18, startWave: 99 });
  assert.equal(run.wave, WAVES.length);
});
