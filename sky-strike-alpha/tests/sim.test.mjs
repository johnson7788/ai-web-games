import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME, WORLD } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

function playingRun(seed = 1, level = 0) {
  const run = createRun(level, { seed });
  run.setHold(true);   // ready → playing
  run.setHold(false);
  run.drainEvents();
  return run;
}

function injectObstacle(run, opts = {}) {
  const s = run.state;
  const gap = opts.gap ?? 235;
  const offsetY = opts.offsetY ?? 200;
  const o = {
    id: 999,
    kind: opts.kind || 'gate',
    x: GAME.PLAYER_X,
    halfW: 22,
    speed: 235,
    gap,
    baseY: s.player.y + offsetY,
    gapY: s.player.y + offsetY,
    minGapY: 0,
    maxGapY: 1000,
    oscAmp: 0,
    oscFreq: 0.6,
    phase: 0,
    passed: false,
    checked: false,
    removed: false,
    core: opts.core ?? null,
    shieldPick: opts.shieldPick ?? null,
  };
  s.obstacles.push(o);
  return o;
}

test('createRun 初始处于 ready（悬停）', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'ready');
  assert.equal(run.state.level, 1);
});

test('首输入 hold 触发起飞并发出 start', () => {
  const run = createRun(0, { seed: 1 });
  run.setHold(true);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.drainEvents().some((e) => e.type === 'start'));
});

test('按住爬升：y 减小（向上）', () => {
  const run = playingRun();
  const y0 = run.state.player.y;
  run.setHold(true);
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.ok(run.state.player.y < y0, '按住应上升');
});

test('松开俯冲：y 增大（向下）', () => {
  const run = playingRun();
  const y0 = run.state.player.y;
  run.setHold(false);
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.ok(run.state.player.y > y0, '松开应下降');
});

test('坠地死亡：crashGround', () => {
  const run = playingRun();
  run.state.player.y = WORLD.HEIGHT - GAME.PLAYER_R - 1;
  run.setHold(false);
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'crashGround');
});

test('跃迁耗尽获胜：至少 1 星', () => {
  const run = playingRun();
  run.state.warp = 0;
  run.setHold(true);
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
});

test('收核加分并累积连击', () => {
  const run = playingRun();
  const s = run.state;
  injectObstacle(run, { offsetY: 0, core: { r: 11, offsetY: 0, collected: false } });
  s.coresSpawned += 1;
  run.step(1 / 60);
  assert.ok(s.score > 0, '收核应得分');
  assert.equal(s.coresCollected, 1);
  assert.ok(s.combo >= 2, '连击应累积');
  assert.ok(run.drainEvents().some((e) => e.type === 'score'));
});

test('漏核连击归 1 并发出 comboBreak', () => {
  const run = playingRun();
  const s = run.state;
  s.combo = 5;
  injectObstacle(run, { offsetY: 200, core: { r: 11, offsetY: 0, collected: false } });
  s.coresSpawned += 1;
  // 让障碍越过玩家（核心未收集）
  run.state.obstacles[0].x = GAME.PLAYER_X - 80;
  run.state.obstacles[0].halfW = 10;
  run.step(1 / 60);
  assert.equal(s.combo, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'comboBreak'));
});

test('护盾抵挡一次撞击（shieldBlock，不死亡）', () => {
  const run = playingRun();
  const s = run.state;
  s.shieldHits = 1;
  injectObstacle(run, { offsetY: 200 });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  assert.equal(s.shieldHits, 0);
  assert.equal(s.hitsTaken, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'shieldBlock'));
});

test('无护盾撞墙死亡：crashWall', () => {
  const run = playingRun();
  injectObstacle(run, { offsetY: 200 });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'crashWall');
});

test('撞击陨石死亡：crashRock', () => {
  const run = playingRun();
  injectObstacle(run, { kind: 'rock', offsetY: 200 });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'crashRock');
});

test('贴边掠过触发 nearMiss', () => {
  const run = playingRun();
  const gap = 235;
  const offsetY = gap / 2 - GAME.PLAYER_R - 5;
  injectObstacle(run, { offsetY });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.drainEvents().some((e) => e.type === 'nearMiss'));
});

test('三星评级：无伤 + 收满核心', () => {
  const run = playingRun();
  const s = run.state;
  s.coresSpawned = 4;
  s.coresCollected = 4;
  s.hitsTaken = 0;
  s.warp = 0;
  run.setHold(true);
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3);
});

test('同 seed 可复现（确定性）', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  a.setHold(true); a.setHold(false);
  b.setHold(true); b.setHold(false);
  for (let i = 0; i < 120; i += 1) {
    a.setHold(i % 2 === 0);
    b.setHold(i % 2 === 0);
    a.step(1 / 60);
    b.step(1 / 60);
  }
  assert.equal(a.state.player.y, b.state.player.y);
  assert.equal(a.state.score, b.state.score);
});

test('mulberry32 同 seed 同序列', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  for (let i = 0; i < 10; i += 1) assert.equal(r1(), r2());
});

test('障碍按关卡间隔生成，且带核心或护盾', () => {
  const run = playingRun();
  for (let i = 0; i < 200; i += 1) run.step(1 / 60);
  assert.ok(run.state.obstacles.length >= 1);
  const hasPickup = run.state.obstacles.some((o) => o.core || o.shieldPick);
  assert.ok(hasPickup);
});

test('关卡定义：6 关且每关新元素唯一', () => {
  assert.equal(LEVEL_COUNT, 6);
  const elements = LEVELS.map((l) => l.newElement);
  assert.equal(new Set(elements).size, elements.length);
});
