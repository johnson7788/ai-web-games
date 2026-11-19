import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, mulberry32, bounceXAt, starsFor, waveFor, coreRadiusFor,
} from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → state 形状 → step → fire → drainEvents', () => {
  const r = createRun({ seed: 1 });
  const s = r.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.lives, GAME.LIVES);
  assert.equal(s.score, 0);
  assert.equal(s.wave, 1);
  assert.ok(s.core && s.core.radius > 0);
  r.step(1 / 60);
  assert.ok(s.time > 0);
  assert.equal(r.fire().ok, true);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'fire'));
});

test('fire：已发射时再次 fire 返回 fired', () => {
  const r = createRun({ seed: 1 });
  r.fire();
  assert.deepEqual(r.fire(), { ok: false, reason: 'fired' });
});

test('noinput：不发射 → 下沉到底部尖刺掉一条命并重生', () => {
  const r = createRun({ seed: 1 });
  advance(r, 3);
  const s = r.state;
  assert.equal(s.lives, GAME.LIVES - 1);
  assert.equal(s.phase, 'playing'); // 还有命，继续
  assert.equal(s.blade.fired, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'die' && e.reason === 'bottomSpike'));
});

test('三条命耗尽 → lost + result + lose 事件', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < GAME.LIVES; i += 1) {
    r.state.lives = GAME.LIVES - i;
    r._die('topSpike');
  }
  const s = r.state;
  assert.equal(s.phase, 'lost');
  assert.ok(s.result && s.result.won === false);
  assert.equal(s.result.score, s.score);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose'));
});

test('命中：score 递增、combo 递增、发 hit 事件', () => {
  const r = createRun({ seed: 1 });
  r.state.core.x = GAME.BLADE_X;
  r._onHit(true);
  const s = r.state;
  assert.ok(s.score > 0);
  assert.equal(s.combo, 1);
  assert.equal(s.hits, 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'hit'));
  assert.ok(ev.some((e) => e.type === 'perfect'));
});

test('连击：连续命中 combo 递增，死亡后归零', () => {
  const r = createRun({ seed: 1 });
  r.state.core.x = GAME.BLADE_X;
  r._onHit(true);
  r.state.core.x = GAME.BLADE_X;
  r._onHit(true);
  assert.equal(r.state.combo, 2);
  assert.equal(r.state.maxCombo, 2);
  r.state.lives = GAME.LIVES;
  r._die('topSpike');
  assert.equal(r.state.combo, 0);
});

test('波次：每 4 次命中进一波', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < GAME.HITS_PER_WAVE; i += 1) {
    r.state.core.x = GAME.BLADE_X;
    r._onHit(true);
  }
  assert.equal(r.state.wave, 2);
  assert.equal(waveFor(r.state.hits), 2);
});

test('核心缩小：命中后半径下降且有下限', () => {
  const r = createRun({ seed: 1 });
  const r0 = r.state.core.radius;
  r.state.core.x = GAME.BLADE_X;
  r._onHit(true);
  assert.ok(r.state.core.radius < r0);
  assert.equal(coreRadiusFor(999), GAME.CORE_RADIUS_MIN);
});

test('宝石：wave≥2 生成，收集加分数并发 gem 事件', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < GAME.HITS_PER_WAVE; i += 1) {
    r.state.core.x = GAME.BLADE_X;
    r._onHit(true);
  }
  assert.ok(r.state.pickups.length > 0, 'wave2 应生成宝石');
  const before = r.state.score;
  r.state.blade.y = r.state.pickups[0].y;
  r._collectGem(r.state.pickups[0]);
  assert.equal(r.state.gems, 1);
  assert.ok(r.state.score > before);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'gem'));
});

test('岩石：wave≥3 生成一颗', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < GAME.HITS_PER_WAVE * 2; i += 1) {
    r.state.core.x = GAME.BLADE_X;
    r._onHit(true);
  }
  assert.equal(r.state.wave, 3);
  assert.ok(r.state.rocks.length >= 1);
});

test('burst：飞行太早返回 tooEarly；命中核心为 GOOD；落空掉命', () => {
  const r = createRun({ seed: 1 });
  r.fire();
  assert.deepEqual(r.burst(), { ok: false, reason: 'tooEarly' });
  // 模拟已飞行：把核心放到爆发半径内
  r.state.blade.flightT = 0.5;
  r.state.blade.y = 300;
  r.state.core.x = GAME.BLADE_X;
  r.state.core.y = 300;
  const res = r.burst();
  assert.equal(res.ok, true);
  assert.equal(res.hit, 'core');
  assert.equal(r.state.combo, 1); // GOOD 命中也算一次命中
});

test('burst：落空 → die（原因 burst）', () => {
  const r = createRun({ seed: 1 });
  r.fire();
  r.state.blade.flightT = 0.5;
  r.state.blade.y = 300;
  r.state.core.x = 10000; // 远离
  r.state.core.y = 10000;
  r.state.pickups = [];
  r.state.rocks = [];
  const res = r.burst();
  assert.equal(res.ok, true);
  assert.equal(res.hit, null);
  assert.equal(r.state.lives, GAME.LIVES - 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'die' && e.reason === 'burst'));
});

test('星级阈值：0/1/2/3', () => {
  assert.equal(starsFor(0), 0);
  assert.equal(starsFor(GAME.STAR_1), 1);
  assert.equal(starsFor(GAME.STAR_2), 2);
  assert.equal(starsFor(GAME.STAR_3), 3);
});

test('bounceXAt：恒定速度反弹预测可复现', () => {
  const p0 = bounceXAt(640, 200, 100, 1180, 0);
  assert.equal(p0.x, 640);
  const p1 = bounceXAt(640, 200, 100, 1180, 3);
  assert.ok(p1.x >= 100 - 1e-6 && p1.x <= 1180 + 1e-6);
  // 确定性
  assert.equal(bounceXAt(640, 200, 100, 1180, 3).x, p1.x);
});

test('mulberry32：同种子同序列', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('forceEnd：直接结束本局', () => {
  const r = createRun({ seed: 1 });
  r.forceEnd('rock');
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'rock');
});
