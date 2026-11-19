import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

function drain(run) {
  const evs = run.drainEvents();
  return evs;
}

function start(run) {
  let guard = 200;
  while (run.state.phase === 'countdown' && guard-- > 0) {
    run.step(1 / 60);
    drain(run);
  }
  return run.state.phase;
}

function settle(run) {
  let guard = 60000;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && guard-- > 0) {
    run.step(1 / 60);
    drain(run);
  }
  return run.state.phase;
}

test('创建对局：初始 phase 为 countdown，level 0，速度按关卡换算', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'countdown');
  assert.equal(run.state.level, 0);
  assert.equal(run.state.speed, LEVELS[0].speed * GAME.SPEED_SCALE);
});

test('倒计时结束后进入 running 并发 start 事件', () => {
  const run = createRun(0, { seed: 1 });
  let sawStart = false;
  for (let i = 0; i < 80; i += 1) {
    run.step(1 / 60);
    if (run.drainEvents().some((e) => e.type === 'start')) sawStart = true;
    if (run.state.phase === 'running') break;
  }
  assert.equal(run.state.phase, 'running');
  assert.ok(sawStart, '应发出 start 事件');
});

test('拐角处点击转向：seg 递增、方向改变、发 turn 事件', () => {
  const run = createRun(0, { seed: 1 });
  start(run);
  const before = run.state.seg;
  // 推进到拐角窗口
  let turned = false;
  for (let i = 0; i < 6000; i += 1) {
    if (run.state.phase !== 'running') break;
    if (run.hint() === 'turn') { run.tap(); turned = true; break; }
    run.step(1 / 60);
    drain(run);
  }
  assert.ok(turned, '应触发转向');
  assert.equal(run.state.seg, before + 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'turn'));
});

test('不点击：拐角 overshoot 撞墙失败', () => {
  const run = createRun(0, { seed: 2 });
  start(run);
  const phase = settle(run);
  assert.equal(phase, 'lost');
  assert.equal(run.state.result.reason, 'wall');
});

test('中途乱点：veer 后撞墙失败', () => {
  const run = createRun(0, { seed: 3 });
  start(run);
  const res = run.tap(); // 还在段中 → veer
  assert.equal(res.type, 'veer');
  assert.equal(run.state.veered, true);
  settle(run);
  assert.equal(run.state.phase, 'lost');
});

test('greedy 提示策略能 3 星通关第一关', () => {
  const run = createRun(0, { seed: 3 });
  start(run);
  let guard = 40000;
  while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
    const h = run.hint();
    if (h) run.tap();
    run.step(1 / 60);
    drain(run);
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.rating, 3);
  assert.equal(run.state.orbsCollected, run.state.orbsTotal);
});

test('收集星尘会加分并提升连击', () => {
  const run = createRun(0, { seed: 4 });
  start(run);
  let scoreBefore = run.state.score;
  let collected = false;
  for (let i = 0; i < 20000; i += 1) {
    if (run.state.phase !== 'running') break;
    const h = run.hint();
    if (h) run.tap();
    run.step(1 / 60);
    const evs = drain(run);
    if (evs.some((e) => e.type === 'star')) { collected = true; break; }
  }
  assert.ok(collected, '应收集到星尘');
  assert.ok(run.state.orbsCollected >= 1);
  assert.ok(run.state.score > scoreBefore);
  assert.ok(run.state.combo >= 2);
});

test('撞岩石会重置连击并扣分（第 3 关）', () => {
  const run = createRun(2, { seed: 5 });
  assert.ok(run.state.rockTotal >= 1, '第 3 关应有岩石');
  start(run);
  // 故意不 bash，等撞上岩石
  let hit = false;
  for (let i = 0; i < 40000; i += 1) {
    if (run.state.phase !== 'running') break;
    // 只在拐角转，不做 bash（用 hint 但跳过 bash 也不行——这里手动只在拐角转）
    if (run.state.seg < run.view().dirs.length - 1
        && run.state.dist >= run.view().lens[run.state.seg] - 2
        && run.state.dist >= 0) {
      run.tap();
    }
    run.step(1 / 60);
    if (run.drainEvents().some((e) => e.type === 'rockHit')) { hit = true; break; }
  }
  assert.ok(hit, '应撞到岩石');
  assert.equal(run.state.combo, 1);
});

test('岩石壳击：在 bash 窗口点击击碎加分', () => {
  const run = createRun(2, { seed: 6 });
  start(run);
  let bashed = false;
  for (let i = 0; i < 40000; i += 1) {
    if (run.state.phase !== 'running') break;
    const h = run.hint();
    if (h) run.tap();
    run.step(1 / 60);
    if (run.drainEvents().some((e) => e.type === 'bash')) { bashed = true; break; }
  }
  assert.ok(bashed, '应壳击岩石');
  assert.equal(run.state.rocksBashed, 1);
});

test('全 30 关都有段落与至少 1 颗星尘', () => {
  assert.equal(LEVEL_COUNT, 30);
  for (const lv of LEVELS) {
    assert.ok(lv.list.length >= 9, `关卡 ${lv.index} 段落数`);
    assert.ok(lv.orbs.length >= 1, `关卡 ${lv.index} 星尘数`);
    assert.ok(lv.speed >= 6 && lv.speed <= 14);
    // 方向不能连续相同（保证每段都需转向）
    for (let i = 1; i < lv.list.length; i += 1) {
      assert.notEqual(lv.list[i].str, lv.list[i - 1].str, `关卡 ${lv.index} 段 ${i} 连续同向`);
    }
  }
});

test('第 3 关起有岩石，前两关无岩石', () => {
  assert.equal(LEVELS[0].rocks.length, 0);
  assert.equal(LEVELS[1].rocks.length, 0);
  assert.ok(LEVELS[2].rocks.length >= 1);
});

test('mulberry32 可复现', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('星级评级：满星尘 + 无撞岩 = 3 星', () => {
  const run = createRun(2, { seed: 7 });
  start(run);
  let guard = 40000;
  while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
    const h = run.hint();
    if (h) run.tap();
    run.step(1 / 60);
    drain(run);
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.rating, 3);
});
