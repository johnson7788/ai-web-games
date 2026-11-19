import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LAYOUT, BALANCE } from '../config/game.config.js';

// 放到「落地时正好滑到 x」的位置：落地耗时 dropTime 内蛋筒会右移 beltSpeed*dropTime
const LEAD = 50;
function placeCone(run, x, kind = 'cone', golden = false) {
  run.state.items.push({
    id: Math.floor(Math.random() * 1e6) + 1,
    kind, color: 'red', golden, x: x - LEAD, y: LAYOUT.BELT_Y - LAYOUT.ITEM_HALF, state: 'sliding', topped: false,
  });
}

function resolve(run) {
  // 丢球并推进到落地判定（dropTime ≈ 0.72s < 1s）
  run.launch();
  for (let i = 0; i < 60; i += 1) run.step(1 / 60);
}

function types(run) {
  return run.drainEvents().map((e) => e.type);
}

test('start：重置状态并进入 playing', () => {
  const run = createRun({ seed: 1 });
  run.start('classic');
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.score, 0);
  assert.equal(run.state.lives, BALANCE.lives);
  assert.equal(run.state.level, 1);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.timeLeft, null);
});

test('start(crazy)：带 130s 倒计时', () => {
  const run = createRun({ seed: 2 });
  run.start('crazy');
  assert.equal(run.state.mode, 'crazy');
  assert.equal(run.state.timeLeft, BALANCE.crazyTimeLimit);
});

test('launch：在飞一球时拒绝再次发射', () => {
  const run = createRun({ seed: 3 });
  run.start('classic');
  run.state.spawnTimer = 999;
  assert.equal(run.launch().ok, true);
  assert.equal(run.launch().ok, false);
});

test('launch：非 playing 拒绝发射', () => {
  const run = createRun({ seed: 4 });
  assert.equal(run.launch().ok, false);
  run.start('classic');
  run.pause();
  assert.equal(run.launch().ok, false);
});

test('step：蛋筒从管道落下并滑上传送带', () => {
  const run = createRun({ seed: 5 });
  run.start('classic');
  run.state.spawnTimer = 0.01;
  run.step(1 / 60);
  assert.ok(run.state.items.length > 0, '应该生成物品');
  const it = run.state.items[0];
  assert.equal(it.state, 'falling');
  for (let i = 0; i < 120; i += 1) run.step(1 / 60);
  assert.equal(it.state, 'sliding', '应落到传送带并滑动');
  assert.equal(it.y, LAYOUT.BELT_Y - LAYOUT.ITEM_HALF);
});

test('catch：球落在蛋筒上得分并加连击', () => {
  const run = createRun({ seed: 6 });
  run.start('classic');
  run.state.spawnTimer = 999;
  placeCone(run, LAYOUT.SNOWMAN_X);
  resolve(run);
  const evs = types(run);
  assert.ok(evs.includes('catch'), '应有 catch 事件');
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.mult, 1);
  assert.equal(run.state.score, BALANCE.coneValue);
  assert.equal(run.state.lives, BALANCE.lives);
});

test('catch：连续接住叠到 ×2 倍率', () => {
  const run = createRun({ seed: 7 });
  run.start('classic');
  run.state.spawnTimer = 999;
  placeCone(run, LAYOUT.SNOWMAN_X);
  resolve(run);
  run.drainEvents();
  placeCone(run, LAYOUT.SNOWMAN_X);
  resolve(run);
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.mult, 2);
  assert.equal(run.state.score, 1 + 2);
});

test('miss：落空掉一条命并清空连击', () => {
  const run = createRun({ seed: 8 });
  run.start('classic');
  run.state.spawnTimer = 999;
  run.state.combo = 3;
  run.state.mult = 3;
  resolve(run); // 落点无物品
  const evs = types(run);
  assert.ok(evs.includes('miss'), '应有 miss 事件');
  assert.equal(run.state.lives, BALANCE.lives - 1);
  assert.equal(run.state.combo, 0);
});

test('rock：砸中岩石掉命并清空连击', () => {
  const run = createRun({ seed: 9 });
  run.start('classic');
  run.state.spawnTimer = 999;
  run.state.combo = 2;
  placeCone(run, LAYOUT.SNOWMAN_X, 'rock');
  resolve(run);
  const evs = types(run);
  assert.ok(evs.includes('rock'), '应有 rock 事件');
  assert.equal(run.state.lives, BALANCE.lives - 1);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.score, 0, '砸岩石不加分');
});

test('golden：金蛋筒加分并回 1 命', () => {
  const run = createRun({ seed: 10 });
  run.start('classic');
  run.state.spawnTimer = 999;
  run.state.lives = 2;
  placeCone(run, LAYOUT.SNOWMAN_X, 'cone', true);
  resolve(run);
  const evs = types(run);
  assert.ok(evs.includes('golden'), '应有 golden 事件');
  assert.equal(run.state.lives, 3);
  assert.equal(run.state.score, BALANCE.goldenValue);
});

test('levelup：接满 6 个升关', () => {
  const run = createRun({ seed: 11 });
  run.start('classic');
  run.state.spawnTimer = 999;
  for (let i = 0; i < BALANCE.catchesPerLevel; i += 1) {
    placeCone(run, LAYOUT.SNOWMAN_X);
    resolve(run);
    run.drainEvents();
  }
  assert.equal(run.state.level, 2);
});

test('gameover：5 命耗尽进入 result 并发出 lose', () => {
  const run = createRun({ seed: 12 });
  run.start('classic');
  run.state.spawnTimer = 999;
  run.state.lives = 1;
  resolve(run); // 落空 → lives 0
  const evs = types(run);
  assert.ok(evs.includes('lose'), '应有 lose 事件');
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.reason, 'lives');
});

test('crazy 超时：倒计时归零判负', () => {
  const run = createRun({ seed: 13 });
  run.start('crazy');
  run.state.spawnTimer = 999;
  run.state.timeLeft = 0.01;
  run.step(1 / 60);
  const evs = types(run);
  assert.ok(evs.includes('lose'), '应有 lose 事件');
  assert.equal(run.state.reason, 'time');
});

test('auto-launch：空转超时自动发射（noinput 会死亡）', () => {
  const run = createRun({ seed: 14 });
  run.start('classic');
  run.state.spawnTimer = 999;
  run.state.items = [];
  let launched = false;
  for (let i = 0; i < 400; i += 1) {
    run.step(1 / 60);
    if (run.drainEvents().some((e) => e.type === 'launch')) { launched = true; break; }
  }
  assert.equal(launched, true);
});

test('pause/resume 状态切换', () => {
  const run = createRun({ seed: 15 });
  run.start('classic');
  run.pause();
  assert.equal(run.state.phase, 'paused');
  run.resume();
  assert.equal(run.state.phase, 'playing');
});
