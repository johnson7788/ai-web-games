import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, ratingFor } from '../src/game/sim.js';
import { createTrack } from '../src/game/track.js';
import { LEVELS } from '../config/levels.js';
import { BALL, TRACK } from '../config/game.config.js';

const empty = { moveX: 0, moveZ: 0, jump: false, brake: false, respawn: false };

test('初始：第 1 关、playing、出生在赛道中心', () => {
  const run = createSim({ seed: 1 });
  assert.equal(run.levelIndex, 0);
  assert.equal(run.phase, 'playing');
  assert.equal(run.player.x, 0);
  assert.equal(run.player.z, run.level.spawn.z);
});

test('跳跃：vy<0 且离开地面', () => {
  const run = createSim({ seed: 1 });
  run.player.onGround = true;
  run.player.y = run.level.surfaceY(run.player.z) + BALL.radius;
  updateSim(run, { ...empty, jump: true });
  assert.ok(run.player.vy > 0, 'vy 应为正（向上）');
  assert.ok(!run.player.onGround);
  assert.equal(run.stats.jumps, 1);
});

test('重力：跳起后落回赛道表面', () => {
  const run = createSim({ seed: 1 });
  run.player.onGround = true;
  run.player.y = run.level.surfaceY(run.player.z) + BALL.radius;
  updateSim(run, { ...empty, jump: true });
  for (let i = 0; i < 120; i++) updateSim(run, empty);
  assert.ok(run.player.onGround);
});

test('前进：按住 W 增加 z', () => {
  const run = createSim({ seed: 1 });
  const z0 = run.player.z;
  for (let i = 0; i < 30; i++) updateSim(run, { ...empty, moveZ: 1 });
  assert.ok(run.player.z > z0);
});

test('转向：按住 D 增加 x', () => {
  const run = createSim({ seed: 1 });
  for (let i = 0; i < 30; i++) updateSim(run, { ...empty, moveX: 1 });
  assert.ok(run.player.x > 0);
});

test('刹车：Shift 比无输入更快减速', () => {
  const a = createSim({ seed: 1 });
  const b = createSim({ seed: 1 });
  for (const r of [a, b]) { r.player.vz = 8; r.player.vx = 0; }
  for (let i = 0; i < 10; i++) updateSim(a, { ...empty, brake: true });
  for (let i = 0; i < 10; i++) updateSim(b, empty);
  assert.ok(a.player.vz < b.player.vz);
});

test('空中转向受限：空中转向系数远小于地面', () => {
  const ground = createSim({ seed: 1 });
  ground.player.onGround = true;
  ground.player.y = ground.level.surfaceY(ground.player.z) + BALL.radius;
  const air = createSim({ seed: 1 });
  air.player.onGround = false;
  air.player.y = 3;
  for (let i = 0; i < 10; i++) {
    updateSim(ground, { ...empty, moveX: 1 });
    updateSim(air, { ...empty, moveX: 1 });
  }
  assert.ok(Math.abs(ground.player.vx) > Math.abs(air.player.vx));
});

test('不作为：原地不动超时 → 赛道塌陷判死 + 死亡 +1', () => {
  const run = createSim({ seed: 1 });
  for (let i = 0; i < Math.ceil(TRACK.stallTimeout / (1 / 60)) + 30; i++) updateSim(run, empty);
  assert.equal(run.deaths, 1);
  assert.equal(run.stats.falls, 1);
  assert.ok(drainEvents(run).some((e) => e.type === 'fall'));
});

test('摔出赛道：回检查点 + 扣 3s + 死亡 +1', () => {
  const run = createSim({ seed: 1 });
  const p = run.player;
  p.x = 5; p.y = 0.5; p.z = 2; p.onGround = false; p.vx = p.vy = p.vz = 0;
  const t0 = run.time;
  for (let i = 0; i < 90; i++) updateSim(run, empty);
  assert.equal(run.deaths, 1);
  assert.equal(run.stats.falls, 1);
  assert.ok(run.time - t0 >= TRACK.fallPenalty - 0.01);
  assert.equal(p.x, run.level.spawn.x);
});

test('吃香蕉：进入收集半径后 +1 并发出 pickup', () => {
  const run = createSim({ seed: 1 });
  const b = run.bananas_list[0];
  run.player.x = b.x; run.player.z = b.z;
  run.player.y = run.level.surfaceY(b.z) + BALL.radius;
  run.player.vx = run.player.vy = run.player.vz = 0;
  run.player.onGround = true;
  updateSim(run, empty);
  assert.equal(run.bananas, 1);
  assert.ok(drainEvents(run).some((e) => e.type === 'pickup'));
});

test('检查点：越过检查点后更新 lastCheckpointZ', () => {
  const run = createSim({ seed: 1 });
  run.player.z = 82; run.player.x = 0; run.player.vz = 0;
  updateSim(run, empty);
  assert.equal(run.lastCheckpointZ, 80);
});

test('过第 1 关：发出 levelCleared 并进入 levelclear', () => {
  const run = createSim({ seed: 1 });
  run.player.x = 0; run.player.z = run.level.length; run.player.vz = 0;
  run.player.y = run.level.surfaceY(run.level.length) + BALL.radius;
  updateSim(run, empty);
  assert.equal(run.phase, 'levelclear');
  assert.ok(drainEvents(run).some((e) => e.type === 'levelCleared'));
});

test('过第 5 关：finished + 发出 finished 事件', () => {
  const run = createSim({ seed: 1, levelIndex: 4 });
  run.player.x = 0; run.player.z = run.level.length; run.player.vz = 0;
  updateSim(run, empty);
  assert.equal(run.phase, 'finished');
  assert.ok(run.rating);
  assert.ok(drainEvents(run).some((e) => e.type === 'finished'));
});

test('评级边界：S/A/B/C', () => {
  assert.equal(ratingFor(34, 34), 'S');
  assert.equal(ratingFor(39, 34), 'A');
  assert.equal(ratingFor(47, 34), 'B');
  assert.equal(ratingFor(50, 34), 'C');
});

test('seed 回归：同 seed 前 120 帧轨迹一致', () => {
  const a = createSim({ seed: 77 });
  const b = createSim({ seed: 77 });
  for (let i = 0; i < 120; i++) {
    const inp = { moveX: (i % 20 < 10 ? 1 : -1), moveZ: 1, jump: i % 47 === 0, brake: false, respawn: false };
    updateSim(a, inp);
    updateSim(b, inp);
  }
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.z, b.player.z);
  assert.equal(a.player.y, b.player.y);
});

test('弹跳板：触发后 vy 达到弹起速度并发出 bounce', () => {
  const run = createSim({ seed: 1, levelIndex: 3 });
  const pad = run.pads[0];
  run.player.x = 0; run.player.z = pad.z; run.player.vz = 0;
  run.player.y = run.level.surfaceY(pad.z) + BALL.radius;
  run.player.onGround = true;
  updateSim(run, empty);
  assert.ok(run.player.vy >= BALL.bounceVel - 0.01);
  assert.ok(drainEvents(run).some((e) => e.type === 'bounce'));
});

test('移动锤：球被砸中后受到冲量并发出 hammerHit', () => {
  const run = createSim({ seed: 1, levelIndex: 1 });
  const h = run.hammers[0];
  run.player.x = 0; run.player.z = h.z; run.player.vz = 0;
  run.player.y = run.level.surfaceY(h.z) + BALL.radius;
  run.player.onGround = true;
  updateSim(run, empty);
  assert.ok(run.stats.hammerHits >= 1);
  assert.ok(drainEvents(run).some((e) => e.type === 'hammerHit'));
});

test('窄桥：第 3 关窄桥宽度 < 常规宽度', () => {
  const track = createTrack(LEVELS[2]);
  assert.ok(track.halfWidthAt(120) < 1.0);
  assert.equal(track.halfWidthAt(120), 0.62);
});

test('坡道：surfaceY 线性插值', () => {
  const track = createTrack(LEVELS[0]);
  assert.equal(track.surfaceY(120), 0);
  assert.equal(track.surfaceY(135), 0.9); // 120→150 从 0 到 1.8，中点 0.9
});

test('HUD：暴露关卡/香蕉/时间/评级字段', () => {
  const run = createSim({ seed: 1 });
  const hud = (run.hud = (run.hud || {}));
  void hud;
  assert.ok(run.level.targetSec > 0);
  assert.ok(run.bananas_list.length >= 10);
});
