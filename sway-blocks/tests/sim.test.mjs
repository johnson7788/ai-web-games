import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

// greedy 驱动：完美时机松手直到终局
function driveGreedy(levelIndex) {
  const run = createRun(levelIndex);
  for (let i = 0; i < 8000; i += 1) {
    if (run.state.phase === 'swinging' && run.state.currentBlock && Math.abs(run.state.ropeAngle) < 0.03) {
      run.drop();
    }
    run.step(1 / 60);
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
  }
  return run;
}

test('创建 run：首块立刻出现，phase=swinging', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'swinging');
  assert.equal(run.state.total, 3);
  assert.ok(run.state.currentBlock, '应有当前摆动块');
  assert.equal(run.state.blocks.length, 1);
});

test('drop：松手后 placed+1，绳断开', () => {
  const run = createRun(0);
  const r = run.drop();
  assert.ok(r.ok, 'drop 应成功');
  assert.equal(run.state.placed, 1);
  assert.equal(run.state.currentBlock, null);
  assert.equal(run.world.joints.filter((j) => j.b === run.state.blocks[0].body).length, 0);
});

test('step：推进物理与时间', () => {
  const run = createRun(0);
  run.step(1 / 60);
  assert.ok(run.state.time > 0);
  assert.ok(run.state.blocks[0].body.y > 0);
});

test('greedy 完美时机能通关 L1 且 3 星', () => {
  const run = driveGreedy(0);
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3);
  assert.equal(run.state.perfects, 3);
});

test('greedy 能连闯 L1→L3（推进到第 3 关）', () => {
  for (const lv of [0, 1, 2]) {
    const run = driveGreedy(lv);
    assert.equal(run.state.phase, 'won', `L${lv + 1} 应通关`);
  }
});

test('noinput 自动松手最终失败（死亡存在性）', () => {
  const run = createRun(0);
  for (let i = 0; i < 8000; i += 1) {
    run.step(1 / 60);
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
  }
  assert.equal(run.state.phase, 'lost');
});

test('getHud 返回核心字段', () => {
  const run = createRun(0);
  const h = run.getHud();
  assert.equal(h.level, 1);
  assert.equal(h.total, 3);
  assert.ok('score' in h && 'combo' in h && 'balanceTime' in h);
});

test('事件：spawn 已入队，perfect 事件带 combo', () => {
  const run = createRun(0);
  const initial = run.drainEvents();
  assert.ok(initial.some((e) => e.type === 'spawn'), '应有 spawn 事件');
  // 逼到近竖直再松手
  let dropped = false;
  for (let i = 0; i < 8000; i += 1) {
    if (run.state.currentBlock && Math.abs(run.state.ropeAngle) < 0.03) {
      run.drop();
      dropped = true;
      break;
    }
    run.step(1 / 60);
  }
  assert.ok(dropped, '应在近竖直处松手');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'perfect'), '应有 perfect 事件');
});

test('平衡阶段：greedy 会经过 balancing 再通关', () => {
  const run = createRun(0);
  let sawBalance = false;
  let guard = 8000;
  while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
    if (run.state.phase === 'swinging' && run.state.currentBlock && Math.abs(run.state.ropeAngle) < 0.03) run.drop();
    run.step(1 / 60);
    if (run.state.phase === 'balancing') sawBalance = true;
  }
  assert.ok(sawBalance, '应经过平衡阶段');
  assert.equal(run.state.phase, 'won');
});

test('mulberry32 确定性（同 seed 同序列）', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
