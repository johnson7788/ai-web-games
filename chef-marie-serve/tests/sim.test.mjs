import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, starRating } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { WORLD, PLAYER } from '../config/game.config.js';

function runSteps(run, n, input) {
  for (let i = 0; i < n; i += 1) {
    run.state.input.left = !!input.left;
    run.state.input.right = !!input.right;
    run.state.input.jump = !!input.jump;
    run.step(1 / 60);
    input.jump = false;
  }
}

test('起跳：按跳后 vy 为负且离地', () => {
  const run = createRun(0);
  run.state.input.jump = true;
  run.step(1 / 60);
  assert.ok(run.state.player.vy < 0, 'vy 应为负（向上）');
  assert.equal(run.state.player.onGround, false);
});

test('落地：跳起后多次更新会落回地面', () => {
  const run = createRun(0);
  runSteps(run, 1, { jump: true });
  runSteps(run, 120, {});
  assert.ok(run.state.player.onGround, '应回到地面');
  assert.ok(run.state.player.y <= run.state.spawn.y, '不应低于出生高度');
});

test('移动：按右向右移动', () => {
  const run = createRun(0);
  const sx = run.state.player.x;
  runSteps(run, 20, { right: true });
  assert.ok(run.state.player.x > sx, 'x 应增加');
});

test('边界：不能超出左边界', () => {
  const run = createRun(0);
  run.state.player.x = 0;
  runSteps(run, 10, { left: true });
  assert.ok(run.state.player.x >= 0, 'x 不能小于 0');
});

test('收集食材加分', () => {
  const run = createRun(0);
  const ing = run.state.ingredients[0];
  run.state.player.x = ing.x - 20;
  run.state.player.y = ing.y - 30;
  runSteps(run, 2, {});
  assert.equal(run.state.ingredients[0].taken, true);
  assert.ok(run.state.score >= 10, '收集应加分');
  assert.equal(run.state.collected, 1);
});

test('空中连击提升倍率', () => {
  const run = createRun(0);
  const a = run.state.ingredients[0];
  const b = run.state.ingredients[1];
  run.state.player.x = a.x - 20; run.state.player.y = a.y - 30;
  run.state.player.vy = 50; // 保持下落态
  runSteps(run, 1, {});
  run.state.player.x = b.x - 20; run.state.player.y = b.y - 30;
  run.state.player.vy = 50;
  runSteps(run, 1, {});
  assert.ok(run.state.bestCombo >= 2, '应产生连击');
  assert.ok(run.state.score >= 30, `连击加分应更高，实际 ${run.state.score}`);
});

test('踩敌人：下落踩顶击杀并弹起', () => {
  const run = createRun(0);
  const e = run.state.enemies[0];
  run.state.player.x = e.x - 10;
  run.state.player.y = e.y - 40;
  run.state.player.vy = 200;
  run.step(1 / 60);
  assert.equal(e.alive, false, '敌人应被踩死');
  assert.ok(run.state.player.vy < 0, '踩后应向上弹起');
});

test('侧碰敌人死亡', () => {
  const run = createRun(0);
  const e = run.state.enemies[0];
  run.state.player.x = e.x + 5;
  run.state.player.y = e.y + 5;
  run.state.player.vy = 0;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'dead');
  assert.equal(run.state.deaths, 1);
});

test('掉坑死亡', () => {
  const run = createRun(0);
  run.state.player.y = WORLD.DEATH_Y + 10;
  run.state.player.vy = 100;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'dead');
});

test('香料冲刺撞飞敌人', () => {
  const run = createRun(0);
  const s = run.state.spices[0];
  run.state.player.x = s.x - 10; run.state.player.y = s.y - 30;
  runSteps(run, 1, {});
  assert.equal(s.taken, true, '应吃到香料');
  const e = run.state.enemies[0];
  run.state.player.x = e.x + 5; run.state.player.y = e.y + 5;
  run.state.player.vy = 0;
  run.step(1 / 60);
  assert.equal(e.alive, false, '冲刺期间应撞飞敌人');
  assert.equal(run.state.phase, 'playing', '不应死亡');
});

test('抵达上菜台胜利并给星', () => {
  const run = createRun(0);
  run.state.player.x = run.state.end.x + 4;
  run.state.player.y = run.state.end.y - 2;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.phase === 'won');
});

test('星级按收集率计算', () => {
  assert.equal(starRating(0, 10), 1);
  assert.equal(starRating(5, 10), 2);
  assert.equal(starRating(9, 10), 3);
  assert.equal(starRating(10, 10), 3);
});

test('三关都存在且元素不同', () => {
  assert.equal(LEVELS.length, 3);
  assert.ok(LEVELS[0].ingredients.length > 0);
  assert.ok(LEVELS[1].enemies.some((e) => e.kind === 'fly'), 'L2 应有飞行敌人');
  assert.ok(LEVELS[2].hazards.length > 0, 'L3 应有热锅危害');
});

test('跑动产生 move/jump/land 事件', () => {
  const run = createRun(0);
  run.state.input.jump = true;
  run.step(1 / 60);
  run.state.input.right = true;
  run.step(1 / 60);
  const evs = run.drainEvents();
  const types = evs.map((e) => e.type);
  assert.ok(types.includes('jump'), '应有 jump 事件');
  assert.ok(types.includes('move'), '应有 move 事件');
});
