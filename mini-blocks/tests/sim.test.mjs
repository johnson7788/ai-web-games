import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, getBlock, raycast, lookDir, makeRng } from '../src/game/sim.js';
import { SX, SY, SZ, HOTBAR, PLAYER } from '../config/game.config.js';

const step = (run, n, input = {}) => { for (let i = 0; i < n; i++) tick(run, 1 / 60, input); };

test('创建：世界尺寸正确，玩家在地表上方', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.world.length, SX * SY * SZ);
  assert.equal(run.phase, 'play');
  assert.ok(run.inventory[2] >= 16);
  assert.ok(run.player.onGround);
});

test('地形：地表非空，上方空气，下方实心', () => {
  const run = createRun({ seed: 2 });
  const x = 16, z = 16;
  let surface = -1;
  for (let y = SY - 1; y >= 0; y--) if (getBlock(run, x, y, z) !== 0) { surface = y; break; }
  assert.ok(surface > 0);
  assert.equal(getBlock(run, x, surface + 1, z), 0);
  assert.ok(getBlock(run, x, 0, z) !== 0);
});

test('移动：前进使玩家位移', () => {
  const run = createRun({ seed: 1 });
  const p = run.player;
  const z0 = p.z;
  step(run, 20, { forward: true, yaw: 0, pitch: 0 });
  assert.ok(Math.abs(p.z - z0) > 0.3);
});

test('跳跃与重力：跳起后落回', () => {
  const run = createRun({ seed: 1 });
  const y0 = run.player.y;
  step(run, 2, { jump: true });
  assert.ok(run.player.y > y0);
  step(run, 120, {});
  assert.ok(run.player.onGround);
});

test('碰撞：站立不穿过地面', () => {
  const run = createRun({ seed: 1 });
  const y0 = run.player.y;
  step(run, 60, {});
  assert.ok(Math.abs(run.player.y - y0) < 0.01);
});

test('挖掘：低头挖掉脚下方块', () => {
  const run = createRun({ seed: 1 });
  const before = run.mined;
  step(run, 60, { mining: true, pitch: -1.4, yaw: 0 });
  assert.ok(run.mined > before);
});

test('放置：向前下方放置方块消耗库存', () => {
  const run = createRun({ seed: 1 });
  run.inventory[2] = 5;
  const before = run.placed;
  step(run, 6, { placing: true, pitch: -0.5, yaw: 0 });
  assert.ok(run.placed > before);
  assert.ok(run.inventory[2] < 5);
});

test('视线：lookDir 单位向量', () => {
  const run = createRun({ seed: 1 });
  run.player.yaw = 0; run.player.pitch = 0;
  const d = lookDir(run.player);
  assert.ok(Math.abs(d.z + 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-6);
});

test('选择：切换快捷栏', () => {
  const run = createRun({ seed: 1 });
  run.selected = 3;
  assert.equal(getHud(run).selected, 3);
});

test('RNG：同种子世界一致', () => {
  const a = createRun({ seed: 42 }), b = createRun({ seed: 42 });
  for (let i = 0; i < a.world.length; i += 97) assert.equal(a.world[i], b.world[i]);
});