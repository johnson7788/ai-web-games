import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/game/sim.js';
import { CONFIG, STEP } from '../config/game.config.js';
import { CLOUD_RING } from '../config/arenas.js';
import { CHARACTERS } from '../config/characters.js';
import { createInput } from '../src/game/input.js';

const makeSim = (bots = 0) => createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots, seed: 42 });
const idle = () => ({ mx: 0, mz: 0, jump: false, dash: false, punch: false, grab: false, charge: false });
const moving = (patch = {}) => ({ ...idle(), ...patch });

test('角色受重力落到 y=0，不穿透', () => {
  const sim = makeSim();
  const fighter = sim.fighters[0];
  fighter.pos.y = 2;
  fighter.onGround = false;
  for (let i = 0; i < 120; i++) sim.step(STEP, new Map([['f0', idle()]]));
  assert.equal(fighter.pos.y, 0);
  assert.equal(fighter.vel.y, 0);
  assert.equal(fighter.onGround, true);
});

test('走 1 秒符合加速度曲线且不超过最大速度', () => {
  const sim = makeSim();
  const fighter = sim.fighters[0];
  const startX = fighter.pos.x;
  for (let i = 0; i < 60; i++) sim.step(STEP, new Map([['f0', moving({ mx: 1 })]]));
  const distance = Math.abs(fighter.pos.x - startX);
  assert.ok(distance > 0);
  assert.ok(distance <= CONFIG.physics.maxSpeed * 1.05);
  assert.ok(Math.hypot(fighter.vel.x, fighter.vel.z) <= CONFIG.physics.maxSpeed * 1.001);
});

test('重量比圆碰撞把两个完全重叠角色推开', () => {
  const sim = makeSim(1);
  const [first, second] = sim.fighters;
  first.pos = { x: 0, y: 0, z: 0 };
  second.pos = { x: 0, y: 0, z: 0 };
  const intents = new Map([['f0', idle()], ['f1', idle()]]);
  sim.step(STEP, intents);
  const distance = Math.hypot(second.pos.x - first.pos.x, second.pos.z - first.pos.z);
  assert.ok(distance >= first.radius + second.radius);
  const firstTravel = Math.hypot(first.pos.x, first.pos.z);
  const secondTravel = Math.hypot(second.pos.x, second.pos.z);
  assert.ok(firstTravel < secondTravel, '同重量时本次对称占位；猫更轻时位移分配仍由重量决定');
});

test('M6.6 物理尺寸与移动速度配置', () => {
  assert.deepEqual([
    CONFIG.physics.fighterRadius,
    CONFIG.physics.fighterHeight,
    CONFIG.physics.edgeMargin,
    CONFIG.physics.maxSpeed,
    CONFIG.physics.dashSpeed,
    CONFIG.physics.jumpVelocity,
    CONFIG.physics.collisionIterations,
  ], [0.72, 1.9, 0.6, 5.7, 12.2, 8.8, 24]);
});

test('1v1 中心距 1.5m 时身体碰撞圆不重叠', () => {
  const sim = makeSim(1);
  const [first, second] = sim.fighters;
  first.pos = { x: -0.75, y: 0, z: 0 };
  second.pos = { x: 0.75, y: 0, z: 0 };
  const intents = new Map([['f0', idle()], ['f1', idle()]]);
  sim.step(STEP, intents);
  const distance = Math.hypot(second.pos.x - first.pos.x, second.pos.z - first.pos.z);
  assert.ok(Math.abs(distance - 1.5) < 1e-9);
  assert.ok(distance >= first.radius + second.radius);
});

test('8 人重叠占位解算后所有碰撞圆分离', () => {
  const sim = makeSim(7);
  for (const fighter of sim.fighters) fighter.pos = { x: 0, y: 0, z: 0 };
  const intents = new Map(sim.fighters.map((fighter) => [fighter.id, idle()]));
  for (let frame = 0; frame < 60; frame++) sim.step(STEP, intents);
  for (let a = 0; a < sim.fighters.length; a++) {
    for (let b = a + 1; b < sim.fighters.length; b++) {
      const first = sim.fighters[a];
      const second = sim.fighters[b];
      const distance = Math.hypot(second.pos.x - first.pos.x, second.pos.z - first.pos.z);
      assert.ok(distance + 1e-8 >= first.radius + second.radius, `${first.id}/${second.id}: ${distance}`);
    }
  }
});

test('出界向外滑落，低于阈值进入 falling 并按时重生', () => {
  const sim = makeSim();
  const fighter = sim.fighters[0];
  fighter.pos = { x: CLOUD_RING.radius + 0.1, y: 0, z: 0 };
  sim.step(STEP, new Map([['f0', idle()]]));
  assert.ok(fighter.vel.x > 0);
  fighter.pos.y = CONFIG.physics.fallY - 0.01;
  fighter.onGround = false;
  sim.step(STEP, new Map([['f0', idle()]]));
  assert.equal(fighter.state, 'falling');
  for (let i = 0; i < Math.ceil(CONFIG.physics.respawnDelay / STEP) + 1; i++) sim.step(STEP);
  assert.equal(fighter.state, 'idle');
  assert.equal(fighter.pos.y, 0);
  assert.deepEqual(fighter.pos, { x: fighter.spawn.x, y: 0, z: fighter.spawn.z });
});

test('同样输入跑 60 帧结果完全确定', () => {
  const first = makeSim(7);
  const second = makeSim(7);
  for (let i = 0; i < 60; i++) {
    const intents = new Map([['f0', moving({ mx: Math.sin(i * 0.05), mz: 0.5, jump: i === 8, dash: i === 20 })]]);
    first.step(STEP, intents);
    second.step(STEP, intents);
  }
  assert.deepEqual(first.fighters, second.fighters);
  assert.equal(first.time, second.time);
});

test('冲刺距离与冷却由配置驱动', () => {
  const sim = makeSim();
  const fighter = sim.fighters[0];
  const start = { ...fighter.pos };
  sim.step(STEP, new Map([['f0', moving({ mx: 1, dash: true })]]));
  assert.ok(fighter.vel.x > CONFIG.physics.maxSpeed);
  assert.equal(fighter.dashCd, CONFIG.physics.dashCooldown);
  for (let i = 0; i < 10; i++) sim.step(STEP, new Map([['f0', moving({ mx: 1 })]]));
  assert.ok(Math.hypot(fighter.pos.x - start.x, fighter.pos.z - start.z) > CONFIG.physics.maxSpeed * CONFIG.physics.dashDuration * 0.8);
});

test('step 拒绝非固定步长', () => {
  const sim = makeSim();
  assert.throws(() => sim.step(1 / 30), RangeError);
});

test('输入把相机相对方向转换为世界方向', () => {
  const input = createInput();
  input.setKey('KeyW', true);
  const azimuth = Math.PI / 2;
  const intent = input.poll({ azimuth });
  assert.ok(Math.abs(intent.mx + 1) < 1e-9);
  assert.ok(Math.abs(intent.mz) < 1e-9);
  input.clear();
  input.setKey('Space', true);
  assert.equal(input.poll().jump, true);
  assert.equal(input.poll().jump, false, '跳跃只在按下沿触发');
});
