import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { BIRD, WALL, STEP } from '../config/game.config.js';

test('flap：ready → playing 且获得上升速度', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'ready');
  const res = run.flap();
  assert.equal(res.ok, true);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.state.bird.vy < 0, 'vy 应为负（向上）');
});

test('重力逐帧把 vy 拉向下', () => {
  const run = createRun(0, { seed: 1 });
  run.flap();
  const vy0 = run.state.bird.vy;
  run.step(STEP);
  assert.ok(run.state.bird.vy > vy0, 'vy 应增大（下坠加速）');
});

test('俯冲会更快下坠', () => {
  const a = createRun(0, { seed: 1 });
  a.flap();
  a.state.bird.vy = 0;
  a.setDive(true);
  a.step(STEP);
  const b = createRun(0, { seed: 1 });
  b.flap();
  b.state.bird.vy = 0;
  b.step(STEP);
  assert.ok(a.state.bird.vy > b.state.bird.vy, '俯冲重力应更大');
});

test('无输入会撞地死亡', () => {
  const run = createRun(0, { seed: 1 });
  run.flap();
  for (let i = 0; i < 600 && run.state.phase === 'playing'; i += 1) run.step(STEP);
  assert.equal(run.state.phase, 'lost');
  assert.ok(run.drainEvents().some((e) => e.type === 'lose'));
});

test('穿过城墙缺口：计数 + 得分 + 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.flap();
  const w = run.state.walls[0];
  w.x = BIRD.X - BIRD.R - WALL.WIDTH - 1;
  w.baseY = run.state.bird.y - run.state.gapH / 2;
  w.passed = false;
  run.step(STEP);
  assert.equal(run.state.passed, 1);
  assert.ok(run.state.score > 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'score'));
});

test('撞墙死亡', () => {
  const run = createRun(0, { seed: 1 });
  run.flap();
  run.state.bird.y = 400;
  const w = run.state.walls[0];
  w.x = BIRD.X - 5;
  w.baseY = 100;
  run.step(STEP);
  assert.equal(run.state.phase, 'lost');
});

test('连击里程碑：第 5 道墙触发 combo 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.flap();
  for (let k = 0; k < 5; k += 1) {
    const w = run.state.walls[0];
    w.x = BIRD.X - BIRD.R - WALL.WIDTH - 1;
    w.baseY = run.state.bird.y - run.state.gapH / 2;
    w.passed = false;
    run.step(STEP);
  }
  assert.equal(run.state.combo, 5);
  assert.equal(run.state.passed, 5);
  assert.ok(run.drainEvents().some((e) => e.type === 'combo'));
});

test('forceWin → won 且至少 1 星', () => {
  const run = createRun(0, { seed: 1 });
  run.flap();
  run.forceWin();
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'win'));
});

test('满连击 → 3 星', () => {
  const run = createRun(0, { seed: 1 });
  run.flap();
  run.state.bestCombo = 10;
  run.forceWin();
  assert.equal(run.state.stars, 3);
});

test('投石只在 L3+ 出现', () => {
  assert.equal(createRun(1, { seed: 1 }).state.hasRocks, false); // L2
  assert.equal(createRun(2, { seed: 1 }).state.hasRocks, true);  // L3
});

test('护盾道具只在 L4+ 出现', () => {
  assert.equal(createRun(2, { seed: 1 }).state.hasShield, false); // L3
  assert.equal(createRun(3, { seed: 1 }).state.hasShield, true);  // L4
});

test('哨兵敌机只在 L5+ 出现', () => {
  assert.equal(createRun(3, { seed: 1 }).state.hasSentry, false); // L4
  assert.equal(createRun(4, { seed: 1 }).state.hasSentry, true);  // L5
});

test('拾取护盾 → shielded', () => {
  const run = createRun(3, { seed: 1 }); // L4
  run.flap();
  run.state.shieldItem.active = true;
  run.state.shieldItem.x = BIRD.X;
  run.state.shieldItem.y = run.state.bird.y;
  run.step(STEP);
  assert.equal(run.state.bird.shielded, true);
});

test('护盾吃掉飞石并清空连击', () => {
  const run = createRun(2, { seed: 1 }); // L3
  run.flap();
  run.state.bird.shielded = true;
  run.state.combo = 5;
  run.state.rocks.push({ x: BIRD.X, y: run.state.bird.y, vx: 0, vy: 0, passedBird: false });
  run.step(STEP);
  assert.equal(run.state.bird.shielded, false);
  assert.equal(run.state.combo, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'shieldUse'));
});

test('同 seed 的城墙布局一致（确定性）', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  assert.deepEqual(a.state.walls.map((w) => w.baseY), b.state.walls.map((w) => w.baseY));
});

test('mulberry32 确定性', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
