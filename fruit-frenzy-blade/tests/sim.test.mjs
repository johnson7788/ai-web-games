import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, FRUIT, LIVES, STARS } from '../config/game.config.js';

function placeFruit(run, type = 'fruit', x = 400, y = 300) {
  run.state.fruits.push({
    id: run.state.nextId++,
    type,
    x, y, vx: 0, vy: 0, rotation: 0, rotSpeed: 0,
    radius: FRUIT.radius, color: '#ff5d5d', state: 'flying',
  });
  return run.state.fruits[run.state.fruits.length - 1];
}

test('初始状态：3 命 / 0 分 / playing', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.lives, LIVES);
  assert.equal(run.state.score, 0);
  assert.equal(run.state.wave, 1);
});

test('mulberry32 同 seed 可复现', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('step 推进时间并最终生成水果', () => {
  const run = createRun({ seed: 2 });
  for (let i = 0; i < 90; i += 1) run.step(1 / 60);
  assert.ok(run.state.spawned >= 1, '应至少生成一个水果');
  assert.ok(run.state.fruits.length >= 1);
});

test('重力：水果 vy 随 step 增大（下落）', () => {
  const run = createRun({ seed: 3 });
  const f = placeFruit(run);
  f.vy = 0;
  run.step(1 / 60);
  assert.ok(f.vy > 0, 'vy 应增大（重力向下）');
});

test('切中普通水果 +1 分并产生 split', () => {
  const run = createRun({ seed: 4 });
  placeFruit(run, 'fruit', 400, 300);
  const n = run.cut(399, 299, 401, 301);
  assert.equal(n, 1);
  assert.equal(run.state.score, 1);
  assert.equal(run.state.stats.sliced, 1);
  assert.equal(run.state.splits.length, 2);
});

test('连续切两刀产生连击 2 分（1+2）', () => {
  const run = createRun({ seed: 5 });
  placeFruit(run, 'fruit', 400, 300);
  run.cut(400, 300, 400, 300);
  placeFruit(run, 'fruit', 500, 300);
  run.cut(500, 300, 500, 300);
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.score, 1 + 2);
});

test('连击窗口超时清零', () => {
  const run = createRun({ seed: 6 });
  placeFruit(run, 'fruit', 400, 300);
  run.cut(400, 300, 400, 300);
  assert.equal(run.state.combo, 1);
  for (let i = 0; i < Math.ceil((FRUIT.comboWindow + 0.1) / 0.1); i += 1) run.step(0.1);
  assert.equal(run.state.combo, 0);
});

test('切中炸弹立即 game over', () => {
  const run = createRun({ seed: 7 });
  placeFruit(run, 'bomb', 400, 300);
  run.cut(400, 300, 400, 300);
  assert.equal(run.state.phase, 'gameover');
  assert.equal(run.state.stats.bombsHit, 1);
});

test('切中岩石断连但不掉命', () => {
  const run = createRun({ seed: 8 });
  placeFruit(run, 'fruit', 400, 300);
  run.cut(400, 300, 400, 300);
  assert.equal(run.state.combo, 1);
  placeFruit(run, 'rock', 500, 300);
  run.cut(500, 300, 500, 300);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.lives, LIVES);
  assert.equal(run.state.stats.rocksHit, 1);
});

test('漏掉普通水果扣 1 命', () => {
  const run = createRun({ seed: 9 });
  const f = placeFruit(run, 'fruit', 400, 720 + 120);
  f.y = 720 + 120;
  f.vy = 1000;
  run.step(1 / 60);
  assert.equal(run.state.lives, LIVES - 1);
  assert.equal(run.state.stats.missed, 1);
});

test('漏掉炸弹/岩石不掉命', () => {
  const run = createRun({ seed: 10 });
  const b = placeFruit(run, 'bomb', 200, 720 + 120);
  b.vy = 1000;
  const r = placeFruit(run, 'rock', 600, 720 + 120);
  r.vy = 1000;
  run.step(1 / 60);
  assert.equal(run.state.lives, LIVES);
});

test('3 次漏掉水果触发 game over', () => {
  const run = createRun({ seed: 11 });
  for (let i = 0; i < 3; i += 1) {
    const f = placeFruit(run, 'fruit', 400, 720 + 120);
    f.vy = 1000;
    run.step(1 / 60);
  }
  assert.equal(run.state.phase, 'gameover');
});

test('金果基础分 5', () => {
  const run = createRun({ seed: 12 });
  placeFruit(run, 'golden', 400, 300);
  run.cut(400, 300, 400, 300);
  assert.equal(run.state.score, 5);
  assert.equal(run.state.stats.golden, 1);
});

test('连击到 5 触发暴走', () => {
  const run = createRun({ seed: 13 });
  for (let i = 0; i < 5; i += 1) {
    placeFruit(run, 'fruit', 300 + i * 20, 300);
    run.cut(300 + i * 20, 300, 300 + i * 20, 300);
  }
  assert.equal(run.state.combo, 5);
  assert.equal(run.state.frenzy, true);
});

test('暴走期间得分翻倍', () => {
  const run = createRun({ seed: 14 });
  for (let i = 0; i < 5; i += 1) {
    placeFruit(run, 'fruit', 300 + i * 20, 300);
    run.cut(300 + i * 20, 300, 300 + i * 20, 300);
  }
  assert.equal(run.state.frenzy, true);
  const before = run.state.score;
  placeFruit(run, 'fruit', 600, 300);
  run.cut(600, 300, 600, 300);
  // 连击第 6 刀：6 * 1 * 2 = 12
  assert.equal(run.state.score - before, 12);
});

test('星级按分数阈值 5/25/60', () => {
  const run = createRun({ seed: 15 });
  assert.equal(run.starsFor(4), 0);
  assert.equal(run.starsFor(5), 1);
  assert.equal(run.starsFor(25), 2);
  assert.equal(run.starsFor(60), 3);
});

test('drainEvents 清空事件队列', () => {
  const run = createRun({ seed: 16 });
  placeFruit(run, 'fruit', 400, 300);
  run.cut(400, 300, 400, 300);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'fruitSliced'));
  assert.equal(run.drainEvents().length, 0);
});

test('波次随生成数量推进', () => {
  const run = createRun({ seed: 17 });
  for (let i = 0; i < 10; i += 1) run.spawnFruit();
  assert.equal(run.state.wave, 2);
  for (let i = 0; i < 10; i += 1) run.spawnFruit();
  assert.equal(run.state.wave, 3);
});

test('step 结束态不再推进', () => {
  const run = createRun({ seed: 18 });
  run.doGameOver();
  const t = run.state.time;
  run.step(1 / 60);
  assert.equal(run.state.time, t);
});

test('暴走结束与冷却就绪事件', () => {
  const run = createRun({ seed: 19 });
  run.state.frenzy = true;
  run.state.frenzyTimer = 0.1;
  run.state.frenzyCooldown = 0.1;
  run.drainEvents();
  run.step(0.1);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'frenzyEnd'));
  assert.ok(evs.some((e) => e.type === 'frenzyReady'));
});
