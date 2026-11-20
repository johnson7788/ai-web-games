import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { stageAt, radiusAt, FINAL_STAGE } from '../config/stages.js';
import { WORLD } from '../config/gameplay.js';

function fishAt(stage, x, y, toxic = false) {
  return { id: 9000, x, y, vx: 0, vy: 0, r: radiusAt(stage), stage, toxic, wanderAngle: 0, wanderTimer: 2, hue: 200 };
}

function setStage(run, mass) {
  run.player.mass = mass;
  run.player.stage = stageAt(mass);
  run.player.r = radiusAt(run.player.stage);
}

function drainTypes(run) {
  const types = new Set();
  for (const e of run.drainEvents()) types.add(e.type);
  return types;
}

test('createRun：初始 phase=playing、阶段 0', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.player.stage, 0);
  assert.ok(run.foods.length > 0);
  assert.ok(run.fish.length > 0);
});

test('step：朝目标移动（x 逼近 steerX）', () => {
  const run = createRun({ seed: 2 });
  const startX = run.player.x;
  for (let i = 0; i < 60; i += 1) run.step({ steerX: 300, steerY: run.player.y });
  assert.ok(run.player.x < startX || run.player.x < 400, '应向左逼近');
});

test('吃食物：mass 增加并发出 eatFood', () => {
  const run = createRun({ seed: 3 });
  run.foods = [{ id: 1, x: run.player.x + 2, y: run.player.y, vx: 0, vy: 0, r: 4, kind: 'food', hue: 180 }];
  const before = run.player.mass;
  run.step({ steerX: run.player.x, steerY: run.player.y });
  assert.ok(run.player.mass > before);
  assert.ok(drainTypes(run).has('eatFood'));
});

test('吃更小的鱼：涨质量', () => {
  const run = createRun({ seed: 4 });
  setStage(run, 200); // 阶段 4
  run.fish = [fishAt(0, run.player.x + 3, run.player.y)];
  const before = run.player.mass;
  run.step({ steerX: run.player.x, steerY: run.player.y });
  assert.ok(run.player.mass > before);
});

test('吃同级鱼：触发光链（lightChain）', () => {
  const run = createRun({ seed: 5 });
  setStage(run, 200);
  run.fish = [fishAt(4, run.player.x + 3, run.player.y)];
  run.step({ steerX: run.player.x, steerY: run.player.y });
  assert.ok(drainTypes(run).has('lightChain'));
});

test('碰更大的鱼：死亡', () => {
  const run = createRun({ seed: 6 });
  run.fish = [fishAt(6, run.player.x, run.player.y)];
  run.step({ steerX: null, steerY: null });
  assert.equal(run.phase, 'dead');
});

test('毒刺鱼：可吃但掉体型', () => {
  const run = createRun({ seed: 7 });
  setStage(run, 200);
  run.fish = [fishAt(1, run.player.x + 2, run.player.y, true)];
  const before = run.player.mass;
  run.step({ steerX: run.player.x, steerY: run.player.y });
  assert.ok(run.player.mass < before);
  assert.ok(drainTypes(run).has('eatToxic'));
});

test('noinput 且被大鱼贴脸：必死', () => {
  const run = createRun({ seed: 8 });
  run.fish = [fishAt(5, run.player.x + 2, run.player.y)];
  run.step({ steerX: null, steerY: null });
  assert.equal(run.phase, 'dead');
});

test('进化：mass 跨越阈值发出 evolve', () => {
  const run = createRun({ seed: 9 });
  run.player.mass = 19; // 阶段 0，差 1 到阶段 1
  run.player.stage = stageAt(19);
  run.player.r = radiusAt(run.player.stage);
  run.foods = [{ id: 1, x: run.player.x + 1, y: run.player.y, vx: 0, vy: 0, r: 4, kind: 'food', hue: 180 }];
  run.step({ steerX: run.player.x, steerY: run.player.y });
  assert.equal(run.player.stage, 1);
  assert.ok(drainTypes(run).has('evolve'));
});

test('水母共生：贴 3 秒获得护体毒刺', () => {
  const run = createRun({ seed: 10 });
  setStage(run, 180); // 阶段 4（水母可用）
  run.player.invulnUntil = Infinity;
  run.jellies = [{ id: 1, x: run.player.x, y: run.player.y, vx: 0, vy: 0, r: 30, kind: 'jelly', phase: 0 }];
  const types = new Set();
  for (let i = 0; i < 181; i += 1) {
    run.step({ steerX: run.player.x, steerY: run.player.y });
    for (const e of run.drainEvents()) types.add(e.type);
  }
  assert.ok(types.has('stingGain'));
  assert.ok(run.player.stingUntil > run.time);
});

test('毒刺护体：可吞大一级', () => {
  const run = createRun({ seed: 11 });
  setStage(run, 180); // 阶段 4（r 25）
  run.player.stingUntil = run.time + 999;
  run.fish = [fishAt(5, run.player.x + 2, run.player.y)]; // 阶段 5（r 29）更大
  run.step({ steerX: run.player.x, steerY: run.player.y });
  assert.equal(run.phase, 'playing', '有毒刺不应死');
  assert.ok(run.player.mass > 180, '应吞掉大一级');
});

test('到达顶级阶段：胜利', () => {
  const run = createRun({ seed: 12 });
  run.player.mass = 1100;
  run.player.stage = stageAt(1100);
  run.player.r = radiusAt(run.player.stage);
  run.step({ steerX: run.player.x, steerY: run.player.y });
  assert.equal(run.phase, 'won');
  assert.equal(run.player.stage, FINAL_STAGE);
});

test('事件流：milestone 心跳保证事件密度', () => {
  const run = createRun({ seed: 13 });
  run.player.invulnUntil = Infinity;
  const types = new Set();
  for (let i = 0; i < 70; i += 1) {
    run.step({ steerX: run.player.x, steerY: run.player.y });
    for (const e of run.drainEvents()) types.add(e.type);
  }
  assert.ok(types.has('milestone'));
});
