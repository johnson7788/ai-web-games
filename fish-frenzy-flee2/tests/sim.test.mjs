import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME, STEP } from '../config/game.config.js';

const preyAt = (x, y) => ({ kind: 'prey', x, y, dir: 0, speed: 0, turnT: 99, t: 0 });
const predAt = (x, y, r = 28) => ({ kind: 'predator', x, y, r, dir: 0, speed: 120, nearFlag: false });
const rockAt = (x, y, r = 30) => ({ kind: 'rock', x, y, r, verts: 7, rot: 0, driftDir: 0 });
const starAt = (x, y) => ({ kind: 'star', x, y, ph: 0 });
const coinAt = (x, y) => ({ kind: 'coin', x, y, ph: 0 });

function eventsOf(run, types) {
  const all = run.drainEvents();
  return all.filter((e) => types.includes(e.type));
}

test('初始状态：playing / 1 条鱼 / 0 分 / 第 1 关', () => {
  const run = createRun(1);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.school.size, 1);
  assert.equal(run.state.score, 0);
  assert.equal(run.state.stage, 1);
});

test('step 推进时间', () => {
  const run = createRun(1);
  run.step(STEP);
  assert.ok(run.state.time > 0);
});

test('setDirection 让朝向转向目标', () => {
  const run = createRun(1);
  run.state.school.dir = 0;
  run.setDirection(Math.PI / 2);
  for (let i = 0; i < 30; i += 1) run.step(STEP);
  assert.ok(Math.abs(run.state.school.dir - Math.PI / 2) < 0.6);
});

test('撞到小鱼：队伍变大并发 join 事件', () => {
  const run = createRun(1);
  run.state.prey.push(preyAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.school.size, 2);
  assert.equal(run.state.score, 1);
  assert.equal(eventsOf(run, ['join']).length, 1);
});

test('撞到红鲨：掉一条鱼并发 eat 事件', () => {
  const run = createRun(1);
  run.state.school.size = 3;
  run.state.school.members = [{}, {}, {}];
  run.state.predators.push(predAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.school.size, 2);
  assert.equal(eventsOf(run, ['eat']).length, 1);
});

test('最后一条鱼被吃：进入 over 并发 lose', () => {
  const run = createRun(1);
  run.state.predators.push(predAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.phase, 'over');
  assert.equal(run.state.school.size, 0);
  assert.equal(eventsOf(run, ['lose']).length, 1);
});

test('撞暗礁（多条鱼）：甩掉一条并生成可追回小鱼', () => {
  const run = createRun(1);
  run.state.school.size = 3;
  run.state.school.members = [{}, {}, {}];
  run.state.rocks.push(rockAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.school.size, 2);
  assert.equal(eventsOf(run, ['rockHit']).length, 1);
  assert.ok(run.state.prey.length >= 1);
});

test('撞暗礁（仅剩一条）：只弹开不致死', () => {
  const run = createRun(1);
  run.state.rocks.push(rockAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.school.size, 1);
});

test('吃星触发狂暴，狂暴期反吃鲨鱼不掉鱼', () => {
  const run = createRun(1);
  run.state.stars.push(starAt(0, 0));
  run.step(STEP);
  assert.ok(run.state.frenzy > 0);
  assert.equal(eventsOf(run, ['frenzyStart']).length, 1);
  run.state.predators.push(predAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.school.size, 1);
  assert.equal(eventsOf(run, ['eatPred']).length, 1);
});

test('连续吞并叠连击，第 4 连触发 comboUp', () => {
  const run = createRun(1);
  for (let i = 0; i < 4; i += 1) run.state.prey.push(preyAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.combo, 4);
  assert.equal(eventsOf(run, ['comboUp']).length, 1);
});

test('存活满 20 秒升到第 2 关', () => {
  const run = createRun(1);
  run.state.school.invuln = 999; // 只测计时，不测死亡
  const n = Math.ceil(GAME.STAGE_TIME / STEP);
  for (let i = 0; i < n; i += 1) run.step(STEP);
  assert.ok(run.state.stage >= 2);
  assert.equal(eventsOf(run, ['stageUp']).length >= 1, true);
});

test('捡金币：金币数 +1', () => {
  const run = createRun(1);
  run.state.coins.push(coinAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.gold, 1);
  assert.equal(eventsOf(run, ['coin']).length, 1);
});

test('game over 后可复活，且只能复活一次', () => {
  const run = createRun(1);
  run.state.predators.push(predAt(0, 0));
  run.step(STEP);
  assert.equal(run.state.phase, 'over');
  assert.equal(run.tryRevive(), true);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.school.size, 1);
  assert.equal(eventsOf(run, ['revive']).length, 1);
  run.state.phase = 'over';
  assert.equal(run.tryRevive(), false);
});

test('mulberry32 固定种子可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('同种子两次 createRun 初始小鱼位置一致', () => {
  const r1 = createRun(7);
  const r2 = createRun(7);
  assert.deepEqual(
    r1.state.prey.map((p) => [Math.round(p.x), Math.round(p.y)]),
    r2.state.prey.map((p) => [Math.round(p.x), Math.round(p.y)]),
  );
});
