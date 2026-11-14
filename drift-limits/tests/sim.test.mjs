// tests/sim.test.mjs — 纯逻辑回归（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, ratingFor } from '../src/game/sim.js';
import { createTrack } from '../src/game/track.js';
import { TRACK_DEF, POLICE, SCORE } from '../config/game.config.js';

const STEP = 1 / 60;
const drive = (run, sec, input = {}) => { for (let i = 0; i < sec * 60; i++) updateSim(run, input); };
const types = (ev) => ev.map((e) => e.type);

test('track: 闭合样条等弧长采样 sane', () => {
  const t = createTrack(TRACK_DEF);
  assert.ok(t.length > 1000 && t.length < 3000);
  assert.ok(Math.abs(t.toWorld(0, 0).x - t.at(0).x) < 1e-6);
  const a = t.at(100), b = t.at(100 + t.length);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
  assert.ok(Number.isFinite(t.curvatureAt(123)));
});

test('lights: 红灯抢跑 = jump，警车初始更近', () => {
  const r = createSim({ seed: 7 });
  assert.equal(r.phase, 'lights');
  updateSim(r, { launch: true });
  assert.equal(r.launch.result, 'jump');
  drive(r, 3.2);
  assert.equal(r.phase, 'race');
  assert.ok(Math.abs((r.player.s - r.cops[0].s) - POLICE.gapJump) < 3);
});

test('lights: 绿灯瞬间按 = perfect，有 boost 与额外氮气', () => {
  const r = createSim({ seed: 7 });
  drive(r, 3.05); // 到 green
  assert.equal(r.phase, 'race');
  updateSim(r, { launch: true });
  assert.equal(r.launch.result, 'perfect');
  assert.ok(r.boostT > 0);
  assert.ok(r.nitro >= 0.4);
});

test('drift: 攒分攒氮，连击叠倍率', () => {
  const r = createSim({ seed: 3 });
  drive(r, 3.1); // green
  drive(r, 2.5, { steer: 0 }); // 提速
  const s0 = r.score;
  drive(r, 1.2, { steer: 1, drift: true });
  assert.ok(r.player.drifting);
  assert.ok(r.score > s0);
  assert.ok(r.nitro > 0);
  const m1 = r.mult;
  drive(r, 0.4, { steer: 0 }); // 松漂移
  drive(r, 1.0, { steer: 1, drift: true }); // 窗口内再漂
  assert.ok(r.mult >= m1);
  assert.ok(r.stats.topMult >= 2);
});

test('crash: 撞车流倍率归零 + 警车逼近', () => {
  const r = createSim({ seed: 3 });
  drive(r, 3.1);
  drive(r, 2.5);
  drive(r, 1.0, { steer: 1, drift: true });
  r.traffic = []; r.spawnT = 999;
  r.mult = 5;
  const gap0 = r.player.s - r.cops[0].s;
  r.traffic.push({ id: 999, s: r.player.s + 1, t: r.player.t, speed: 25, passed: false });
  updateSim(r, {});
  const ev = drainEvents(r);
  assert.ok(types(ev).includes('crash'));
  assert.equal(r.mult, 1);
  assert.ok(r.player.s - r.cops[0].s < gap0);
});

test('ghost-bump: 第一次撞车保留倍率', () => {
  const r = createSim({ seed: 3, perks: ['ghost-bump'] });
  drive(r, 3.1); drive(r, 2.5);
  r.traffic = []; r.spawnT = 999;
  r.mult = 6;
  r.traffic.push({ id: 999, s: r.player.s + 1, t: r.player.t, speed: 25, passed: false });
  updateSim(r, {});
  assert.equal(r.mult, 6);
  r.crashCd = 0; r.mult = 6;
  r.traffic.push({ id: 998, s: r.player.s + 1, t: r.player.t, speed: 25, passed: false });
  updateSim(r, {});
  assert.equal(r.mult, 1);
});

test('nearMiss: 贴身超车加分充氮', () => {
  const r = createSim({ seed: 3 });
  drive(r, 3.1); drive(r, 2.5);
  r.traffic = []; r.spawnT = 999;
  const n0 = r.stats.nearMisses;
  r.traffic.push({ id: 997, s: r.player.s + 2, t: r.player.t + 2.6, speed: 22, passed: false });
  drive(r, 0.5);
  assert.ok(r.stats.nearMisses > n0);
});

test('noDrift 衰减 vs chain-lock', () => {
  const a = createSim({ seed: 3 });
  drive(a, 3.1); drive(a, 2.5); drive(a, 1, { steer: 1, drift: true });
  a.traffic = []; a.spawnT = 999; a.cops[0].s = a.player.s - 500;
  a.mult = 4;
  drive(a, 7);
  assert.equal(a.mult, 1);
  const b = createSim({ seed: 3, perks: ['chain-lock'] });
  drive(b, 3.1); drive(b, 2.5); drive(b, 1, { steer: 1, drift: true });
  b.traffic = []; b.spawnT = 999; b.cops[0].s = b.player.s - 500;
  b.mult = 4;
  drive(b, 7);
  assert.equal(b.mult, 4);
});

test('busted: 被贴尾 1.2s 结束', () => {
  const r = createSim({ seed: 3 });
  drive(r, 3.1);
  r.cops[0].s = r.player.s - 1; // gap 1 < bustGap
  r.player.speed = 0;
  drive(r, 2.0, { brake: true });
  assert.equal(r.phase, 'busted');
  const ev = drainEvents(r);
  assert.ok(types(ev).includes('busted'));
});

test('laps/heat: 三圈完赛，heat2 双警车，heat3 路障', () => {
  const r = createSim({ seed: 3 });
  drive(r, 3.1);
  const L = r.track.length;
  r.player.s = L - 5; r.player.speed = 60;
  drive(r, 0.5);
  assert.equal(r.heat, 2);
  assert.equal(r.cops.length, 2);
  r.player.s = 2 * L - 5;
  drive(r, 0.5);
  assert.equal(r.heat, 3);
  assert.ok(r.blocks.length === 3);
  r.player.s = 3 * L - 5;
  drive(r, 0.5);
  assert.equal(r.phase, 'finished');
});

test('rating: 分档与 busted 封顶', () => {
  assert.equal(ratingFor(20000, false), 'S');
  assert.equal(ratingFor(20000, true), 'B');
  assert.equal(ratingFor(7000, false), 'B');
  assert.equal(ratingFor(100, false), 'C');
});

test('hud 形状完整', () => {
  const r = createSim({ seed: 1 });
  drive(r, 4);
  const h = getHud(r);
  for (const k of ['phase', 'kmh', 'score', 'mult', 'nitro', 'gap', 'lap', 'heat']) assert.ok(k in h);
});

test('perf: 3600 步 < 1.5s', () => {
  const r = createSim({ seed: 5 });
  const t0 = performance.now();
  for (let i = 0; i < 3600; i++) updateSim(r, { steer: Math.sin(i / 40), drift: i % 120 < 60, nitro: i % 300 === 0 });
  assert.ok(performance.now() - t0 < 1500);
});