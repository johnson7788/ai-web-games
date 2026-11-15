import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSim, updateSim, getHud, drainEvents, crashNow, ratingFor, segmentIndex, laneIndex,
} from '../src/game/sim.js';
import { MOTO, ROAD, NEARMISS, TRAFFIC, CHECKPOINT_EVERY, CRASH, STEP } from '../config/game.config.js';

const noInput = { steer: 0, throttle: false, brake: false, nitro: false };
const fullThrottle = { steer: 0, throttle: true, brake: false, nitro: false };

function placeCar(sim, { x, z = 0, dir = 1, hw = TRAFFIC.carHW, len = TRAFFIC.carLen } = {}) {
  sim.traffic.length = 0;
  sim.traffic.push({ lane: 2, dir, x, z, speed: 20, hw, len, isTruck: false, nearMissed: false, passed: false, color: 0 });
  return sim.traffic[0];
}

test('初始：running 阶段 + start 事件 + 最右同向车道起步', () => {
  const sim = createSim();
  assert.equal(sim.phase, 'running');
  assert.equal(sim.player.lane, 3);
  assert.equal(sim.player.distance, 0);
  assert.deepEqual(drainEvents(sim).map((e) => e.type), ['start']);
});

test('油门：速度向 topSpeed 加速', () => {
  const sim = createSim();
  const v0 = sim.player.speed;
  for (let i = 0; i < 30; i++) updateSim(sim, fullThrottle);
  assert.ok(sim.player.speed > v0, '速度应上升');
  assert.ok(sim.player.speed <= MOTO.topSpeed, '不超过极速');
});

test('无油门：巡航速度趋向 baseSpeed（自动推进）', () => {
  const sim = createSim();
  for (let i = 0; i < 300; i++) updateSim(sim, noInput);
  assert.ok(sim.player.distance > 20, '不输入也会前进');
  assert.ok(Math.abs(sim.player.speed - MOTO.baseSpeed) < 1, '应巡航在 baseSpeed 附近');
});

test('刹车：速度下降且不低于 minSpeed', () => {
  const sim = createSim();
  for (let i = 0; i < 60; i++) updateSim(sim, fullThrottle);
  const v = sim.player.speed;
  for (let i = 0; i < 60; i++) updateSim(sim, { ...noInput, brake: true });
  assert.ok(sim.player.speed < v, '刹车后速度下降');
  assert.ok(sim.player.speed >= MOTO.minSpeed - 1e-6, '不低于 minSpeed');
});

test('氮气：boost 事件 + 消耗 + 停用后回充', () => {
  const sim = createSim();
  updateSim(sim, { ...noInput, nitro: true });
  const types = drainEvents(sim).map((e) => e.type);
  assert.ok(types.includes('boost'), '应有 boost 事件');
  assert.ok(sim.player.nitro < MOTO.nitroMax, '氮气被消耗');
  for (let i = 0; i < 60; i++) updateSim(sim, noInput);
  assert.ok(sim.player.nitro > 0.05, '停用后回充');
});

test('转向：D 变道 x 增大，且被夹在道路边界内', () => {
  const sim = createSim();
  for (let i = 0; i < 40; i++) updateSim(sim, { ...noInput, steer: 1 });
  assert.ok(sim.player.x > ROAD.laneX[3], '右转向 x 增大');
  for (let i = 0; i < 500; i++) updateSim(sim, { ...noInput, steer: 1 });
  assert.ok(sim.player.x <= ROAD.xMax + 1e-6, '不越右边界');
});

test('变道：跨车道发 lane 事件', () => {
  const sim = createSim();
  drainEvents(sim);
  for (let i = 0; i < 60; i++) updateSim(sim, { ...noInput, steer: -1 });
  const types = drainEvents(sim).map((e) => e.type);
  assert.ok(types.includes('lane'), '跨车道应有 lane 事件');
});

test('擦身：侧向 30cm 内纵向重叠触发 nearMiss 加分', () => {
  const sim = createSim();
  const dx = MOTO.halfW + TRAFFIC.carHW + NEARMISS.gap * 0.5;
  placeCar(sim, { x: sim.player.x + dx, z: 0.5 });
  const score0 = sim.score;
  updateSim(sim, noInput);
  const events = drainEvents(sim);
  assert.ok(events.some((e) => e.type === 'nearMiss'), '应有 nearMiss');
  assert.ok(sim.nearMisses === 1, 'nearMiss 计数 +1');
  assert.ok(sim.score > score0, '得分增加');
});

test('撞击：重叠即 crash，慢镜头后进入 over', () => {
  const sim = createSim();
  placeCar(sim, { x: sim.player.x, z: 0 });
  updateSim(sim, noInput);
  assert.equal(sim.phase, 'crashed');
  assert.ok(drainEvents(sim).some((e) => e.type === 'crash'));
  const frames = Math.ceil(CRASH.slowmoTime / STEP) + 2;
  for (let i = 0; i < frames; i++) updateSim(sim, noInput);
  assert.equal(sim.phase, 'over');
  assert.ok(drainEvents(sim).some((e) => e.type === 'gameover'));
});

test('连击：3s 内连续擦身 combo 递增', () => {
  const sim = createSim();
  const dx = MOTO.halfW + TRAFFIC.carHW + NEARMISS.gap * 0.4;
  placeCar(sim, { x: sim.player.x + dx, z: 1 });
  updateSim(sim, noInput);
  drainEvents(sim);
  placeCar(sim, { x: sim.player.x + dx, z: 1 });
  updateSim(sim, noInput);
  assert.equal(sim.combo, 2, '第二次擦身应连击 ×2');
  assert.equal(sim.topCombo, 2);
  assert.ok(drainEvents(sim).some((e) => e.type === 'combo'));
});

test('检查点 + 视觉段：过 500m 发 checkpoint/segment', () => {
  const sim = createSim();
  drainEvents(sim);
  sim.player.distance = CHECKPOINT_EVERY;
  updateSim(sim, fullThrottle);
  const types = drainEvents(sim).map((e) => e.type);
  assert.ok(types.includes('checkpoint'), '应有 checkpoint');
  assert.ok(types.includes('segment'), '应有 segment');
  assert.equal(segmentIndex(sim.player.distance), 1);
});

test('评级：按距离分档', () => {
  assert.equal(ratingFor(2100), 'S');
  assert.equal(ratingFor(1600), 'A');
  assert.equal(ratingFor(1100), 'B');
  assert.equal(ratingFor(600), 'C');
  assert.equal(ratingFor(100), 'D');
});

test('HUD：levelsReached 随距离推进', () => {
  const sim = createSim();
  sim.player.distance = 1000;
  assert.equal(getHud(sim).levelsReached, 3);
  assert.equal(getHud(sim).meters, 1000);
});

test('laneIndex：x 映射到 4 车道', () => {
  assert.equal(laneIndex(-5.4), 0);
  assert.equal(laneIndex(-1.8), 1);
  assert.equal(laneIndex(1.8), 2);
  assert.equal(laneIndex(5.4), 3);
});

test('seed 回归：同 seed 车流一致', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  const za = a.traffic.map((c) => [c.x.toFixed(2), c.z.toFixed(2)]);
  const zb = b.traffic.map((c) => [c.x.toFixed(2), c.z.toFixed(2)]);
  assert.deepEqual(za, zb);
});

test('crashNow：调试口立即进入 crashed', () => {
  const sim = createSim();
  crashNow(sim);
  assert.equal(sim.phase, 'crashed');
});

test('对向车通过：发 oncoming 事件（事件密度基线）', () => {
  const sim = createSim();
  sim.traffic.length = 0;
  sim.traffic.push({ lane: 0, dir: -1, x: -5.4, z: 3, speed: 40, hw: TRAFFIC.carHW, len: TRAFFIC.carLen, isTruck: false, nearMissed: false, passed: false, color: 0 });
  const types = [];
  for (let i = 0; i < 20; i++) { updateSim(sim, noInput); types.push(...drainEvents(sim).map((e) => e.type)); }
  assert.ok(types.includes('oncoming'), '对向车通过应发 oncoming');
});

test('车流不越上限 max', () => {
  const sim = createSim();
  sim.player.distance = 5000;
  for (let i = 0; i < 2000; i++) updateSim(sim, fullThrottle);
  assert.ok(sim.traffic.length <= TRAFFIC.max + 1, '车流不超上限');
});
