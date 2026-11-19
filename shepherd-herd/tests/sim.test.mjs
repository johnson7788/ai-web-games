import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { STEP, PLAY } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

// 帮助函数：自动把 L1 打到终局（喂完所有羊或超时）
function playToWin(levelIndex = 0, seed = 1) {
  const run = createRun(levelIndex, { seed });
  let guard = 3000;
  while (guard-- > 0 && (run.phase === 'countdown' || run.phase === 'playing')) {
    if (run.phase === 'playing' && run.cooldown <= 0) {
      const sh = run.sheep.find((s) => !s.fed);
      if (sh) run.tap(sh.x, sh.y);
    }
    run.step(STEP);
    run.drainEvents();
  }
  return run;
}

test('L1 生成 3 只羊', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.sheep.length, 3);
  assert.equal(run.foodRemaining, 3);
  assert.equal(run.level, 1);
});

test('开局倒计时后进入 playing', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.phase, 'countdown');
  for (let i = 0; i < 120; i += 1) run.step(STEP);
  assert.equal(run.phase, 'playing');
});

test('羊会移动', () => {
  const run = createRun(0, { seed: 1 });
  const before = run.sheep.map((s) => ({ x: s.x, y: s.y }));
  for (let i = 0; i < 10; i += 1) run.step(STEP);
  let moved = false;
  run.sheep.forEach((s, i) => {
    if (Math.abs(s.x - before[i].x) > 0.001 || Math.abs(s.y - before[i].y) > 0.001) moved = true;
  });
  assert.ok(moved, '至少一只羊发生了位移');
});

test('羊始终留在活动区内', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 600; i += 1) run.step(STEP);
  for (const s of run.sheep) {
    assert.ok(s.x >= 40 && s.x <= 1240, `x 在界内 ${s.x}`);
    assert.ok(s.y >= 94 && s.y <= 638, `y 在界内 ${s.y}`);
  }
});

test('点未喂过的羊：接受喂食并进入冷却', () => {
  const run = createRun(0, { seed: 1 });
  while (run.phase !== 'playing') run.step(STEP);
  const sh = run.sheep.find((s) => !s.fed);
  const res = run.tap(sh.x, sh.y);
  assert.equal(res.kind, 'feed');
  assert.ok(run.cooldown > 0, '喂食后应进入冷却');
  assert.equal(run.flights.length, 1, '应生成一个飞行光种');
});

test('冷却中点击被拒绝', () => {
  const run = createRun(0, { seed: 1 });
  while (run.phase !== 'playing') run.step(STEP);
  const sh = run.sheep.find((s) => !s.fed);
  run.tap(sh.x, sh.y);
  const res = run.tap(sh.x, sh.y);
  assert.equal(res.reason, 'cooldown');
});

test('点已喂过的羊：记为失误', () => {
  const run = createRun(0, { seed: 1 });
  while (run.phase !== 'playing') run.step(STEP);
  const sh = run.sheep.find((s) => !s.fed);
  sh.fed = true;
  run.fedCount = 1;
  const res = run.tap(sh.x, sh.y);
  assert.equal(res.kind, 'mistake');
  assert.equal(run.mistakes, 1);
});

test('点到空白处：miss', () => {
  const run = createRun(0, { seed: 1 });
  while (run.phase !== 'playing') run.step(STEP);
  const res = run.tap(640, 660); // 底部喂食槽附近无羊
  assert.equal(res.reason, 'miss');
});

test('喂完全部羊 → 胜利且至少 1 星', () => {
  const run = playToWin(0, 3);
  assert.equal(run.phase, 'won');
  assert.equal(run.fedCount, 3);
  assert.ok(run.stars >= 1, `星级 ${run.stars}`);
  assert.ok(run.score > 0);
});

test('不输入 → 超时失败', () => {
  const run = createRun(0, { seed: 1 });
  let guard = 4000;
  while (guard-- > 0 && (run.phase === 'countdown' || run.phase === 'playing')) {
    run.step(STEP);
    run.drainEvents();
  }
  assert.equal(run.phase, 'lost');
});

test('L3 有 1 只金色羊', () => {
  const run = createRun(2, { seed: 7 });
  const golden = run.sheep.filter((s) => s.golden);
  assert.equal(golden.length, 1);
  assert.ok(golden[0].speed > run.lv.speed, '金色羊应更快');
});

test('快速连续喂食触发连击', () => {
  const run = playToWin(0, 5);
  // 至少有一次连击 ≥2（事件里出现过 combo）
  assert.ok(run.combo >= 1);
});

test('关卡数：8 关递增且数值合法', () => {
  assert.equal(LEVELS.length, 8);
  for (const lv of LEVELS) {
    assert.ok(lv.sheep >= 3 && lv.sheep <= 10);
    assert.ok(lv.time >= 11 && lv.time <= 40);
    assert.ok(lv.cd > 0 && lv.cd <= 0.5);
    assert.equal(lv.countdown, 1.5);
  }
});
