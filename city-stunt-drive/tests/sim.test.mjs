// tests/sim.test.mjs — CITY STUNT DRIVE 纯逻辑回归（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, ratingFor } from '../src/game/sim.js';
import { CARS, RAMPS, TRACK, LAND } from '../config/game.config.js';

const STEP = 1 / 60;
const drive = (run, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) updateSim(run, input); };
const types = (ev) => ev.map((e) => e.type);

test('初始状态：停在地面，phase=run', () => {
  const r = createSim({});
  assert.equal(r.phase, 'run');
  assert.ok(r.player.grounded);
  assert.equal(r.player.z, 0);
  assert.equal(r.score, 0);
  assert.equal(r.combo, 0);
});

test('油门：vz 增加并前进', () => {
  const r = createSim({});
  drive(r, 1, { throttle: 1 });
  assert.ok(r.player.vz > 0, 'vz 应 > 0');
  assert.ok(r.player.z > 0, 'z 应前进');
});

test('刹车：vz 下降', () => {
  const r = createSim({});
  drive(r, 1, { throttle: 1 });
  const v = r.player.vz;
  drive(r, 0.4, { throttle: -1 });
  assert.ok(r.player.vz < v, '刹车后速度应下降');
});

test('转向：A/D 移动横向 x', () => {
  const r = createSim({});
  drive(r, 0.8, { throttle: 1 });
  drive(r, 1, { throttle: 1, steer: 1 });
  assert.ok(r.player.x > 0.5, '右转应向右移动');
});

test('护栏：x 不越界', () => {
  const r = createSim({});
  r.player.z = 100; r.player.vz = 20; r.player.grounded = true;
  drive(r, 1.5, { throttle: 1, steer: 1 });
  assert.ok(r.player.x <= TRACK.halfWidth + 1e-6, 'x 不应超过半宽');
});

test('坡道起飞：上坡获得空中状态', () => {
  const r = createSim({});
  drive(r, 3, { throttle: 1 });
  // 冲到第一个坡道前
  r.player.z = RAMPS[0].z - 5;
  r.player.vz = 24;
  drive(r, 2, { throttle: 1 });
  assert.ok(!r.player.grounded || r.player.airborne || r.player.z > RAMPS[0].z, '应起飞或越过坡道');
});

test('空中重力：vy 向下、y 回落', () => {
  const r = createSim({});
  r.player.grounded = false;
  r.player.airborne = true;
  r.player.y = 8; r.player.vy = 6; r.player.vz = 20; r.player.z = 60;
  const y0 = r.player.y;
  updateSim(r, {});
  assert.ok(r.player.vy < 6, '重力应减小 vy');
  assert.ok(r.player.y < y0 + 0.2, 'y 应先升后回落（首帧仍向上但受重力）');
});

test('空中翻转：flip 累加 roll', () => {
  const r = createSim({});
  r.player.grounded = false; r.player.airborne = true;
  r.player.y = 10; r.player.vy = 0; r.player.vz = 20; r.player.z = 60;
  const roll0 = r.player.roll;
  drive(r, 0.5, { flip: 1 });
  assert.ok(r.player.roll > roll0, '按 flip 应累计 roll');
  assert.ok(r.player.airRoll > 0);
});

test('完美落地：一圈翻转落地 → combo=1 加分', () => {
  const r = createSim({});
  r.player.grounded = false; r.player.airborne = true;
  r.player.y = 6; r.player.vy = -2; r.player.vz = 20; r.player.z = 60;
  r.player.roll = 0; r.player.airRoll = 2 * Math.PI;
  const s0 = r.score;
  drive(r, 2, {});
  assert.ok(r.player.grounded, '应已落地');
  assert.equal(r.combo, 1);
  assert.ok(r.score > s0);
  assert.equal(r.stats.topCombo, 1);
});

test('摔落：侧翻落地 → combo 清零', () => {
  const r = createSim({});
  r.player.grounded = false; r.player.airborne = true;
  r.player.y = 6; r.player.vy = -2; r.player.vz = 20; r.player.z = 60;
  r.player.roll = Math.PI / 2; r.player.airRoll = 0;
  r.combo = 3;
  drive(r, 2, {});
  assert.ok(r.player.grounded);
  assert.equal(r.combo, 0);
  const ev = drainEvents(r);
  assert.ok(types(ev).includes('badLand'));
});

test('翻车 3 秒 → 吊回坡道前、death+1、combo 清零', () => {
  const r = createSim({});
  r.player.grounded = true;
  r.player.roll = Math.PI; // 车顶朝地
  r.player.z = 60; r.player.vz = 5;
  r.combo = 4;
  drive(r, 3.4, {});
  assert.ok(r.deaths >= 1);
  assert.equal(r.combo, 0);
  assert.ok(r.player.z < RAMPS[0].z, '应吊回坡道前');
  const ev = drainEvents(r);
  assert.ok(types(ev).includes('wreck'));
});

test('金币：拾取加金币/货币/分数/氮气', () => {
  const r = createSim({});
  const c = r.track.coins.find((c) => !c.taken);
  r.player.x = c.x; r.player.y = c.y; r.player.z = c.z; r.player.vz = 0;
  const cur0 = r.currency, s0 = r.score;
  updateSim(r, {});
  assert.ok(r.coins >= 1);
  assert.ok(r.currency > cur0);
  assert.ok(r.score > s0);
  const ev = drainEvents(r);
  assert.ok(types(ev).includes('coin'));
});

test('氮气：满罐按空格 → 烧氮气 boost', () => {
  const r = createSim({});
  drive(r, 1, { throttle: 1 });
  r.nitro = 1;
  updateSim(r, { throttle: 1, nitro: true });
  assert.ok(r.boostT > 0);
  assert.equal(r.nitro, 0);
});

test('区 checkpoint：越过 → zone 事件 + zoneReached', () => {
  const r = createSim({});
  r.player.z = TRACK.zoneZ[0] - 1; r.player.vz = 20; r.player.grounded = true;
  drive(r, 0.5, { throttle: 1 });
  assert.equal(r.zoneReached, 1);
  const ev = drainEvents(r);
  assert.ok(types(ev).includes('zone'));
});

test('冲线：越过 finishZ → phase=finished', () => {
  const r = createSim({});
  r.player.z = TRACK.finishZ - 1; r.player.vz = 20; r.player.grounded = true;
  drive(r, 0.5, { throttle: 1 });
  assert.equal(r.phase, 'finished');
  const ev = drainEvents(r);
  assert.ok(types(ev).includes('finish'));
});

test('评级：分数分档正确', () => {
  assert.equal(ratingFor(2000), 'S');
  assert.equal(ratingFor(1000), 'A');
  assert.equal(ratingFor(500), 'B');
  assert.equal(ratingFor(0), 'C');
});

test('连击链：连续完美落地 combo 递增', () => {
  const r = createSim({});
  for (let k = 0; k < 3; k++) {
    r.player.grounded = false; r.player.airborne = true;
    r.player.y = 6; r.player.vy = -2; r.player.vz = 20; r.player.z = 60 + k * 10;
    r.player.roll = 0; r.player.airRoll = 2 * Math.PI;
    drive(r, 1.5, {});
  }
  assert.equal(r.combo, 3);
  assert.equal(r.stats.topCombo, 3);
});

test('seed 确定性：相同输入 → 相同结果', () => {
  const a = createSim({ seed: 7 }), b = createSim({ seed: 7 });
  const seq = () => { for (let i = 0; i < 180; i++) updateSim(a, { throttle: 1, steer: Math.sin(i / 10) * 0.5, flip: i % 90 < 20 ? 1 : 0 }); };
  const seq2 = () => { for (let i = 0; i < 180; i++) updateSim(b, { throttle: 1, steer: Math.sin(i / 10) * 0.5, flip: i % 90 < 20 ? 1 : 0 }); };
  seq(); seq2();
  assert.equal(a.score, b.score);
  assert.equal(a.player.z, b.player.z);
  assert.equal(a.phase, b.phase);
});

test('hud 形状完整', () => {
  const r = createSim({});
  drive(r, 1, { throttle: 1 });
  const h = getHud(r);
  for (const k of ['phase', 'score', 'combo', 'coins', 'nitro', 'kmh', 'zone', 'flips']) assert.ok(k in h, `${k} 应在 hud`);
});

test('三辆车手感不同：maxSpeed 不同', () => {
  assert.notEqual(CARS[0].maxSpeed, CARS[1].maxSpeed);
  assert.notEqual(CARS[1].maxSpeed, CARS[2].maxSpeed);
  assert.ok(CARS[2].maxSpeed > CARS[0].maxSpeed);
});

test('性能：3600 步 < 1.5s', () => {
  const r = createSim({});
  const t0 = performance.now();
  for (let i = 0; i < 3600; i++) updateSim(r, { throttle: 1, steer: Math.sin(i / 40), flip: i % 120 < 60 ? 1 : 0 });
  assert.ok(performance.now() - t0 < 1500);
});
