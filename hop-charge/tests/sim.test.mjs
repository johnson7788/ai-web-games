import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, greedyCharge, platformX, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

// 步进 sec 秒
function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

// 执行一跳：蓄力到给定秒数后松手，再飞到落地
function doJump(run, charge) {
  run.press();
  while (run.state.phase === 'charging' && run.state.player.charge < charge) run.step(1 / 60);
  run.release();
  while (run.state.phase === 'jumping') run.step(1 / 60);
}

// 贪心自解一关（用 greedyCharge 重算，落地即续跳直到结算）
function solveLevel(levelIndex, seed = 1) {
  const run = createRun(levelIndex, { seed });
  let guard = 2000;
  while (run.state.phase === 'ready' || run.state.phase === 'charging' || run.state.phase === 'jumping') {
    if (--guard <= 0) break;
    if (run.state.phase === 'ready') { run.press(); continue; }
    if (run.state.phase === 'charging') {
      const gc = greedyCharge(run);
      if (!gc) { run.release(); continue; }
      if (run.state.player.charge >= gc.charge) run.release();
      else run.step(1 / 60);
      continue;
    }
    run.step(1 / 60);
  }
  return run;
}

test('冒烟：createRun → step → press → step → release → step → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  assert.equal(r.press().ok, true);
  r.step(1 / 60);
  assert.equal(r.release().ok, true);
  r.step(1 / 60);
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/phase/platforms/goalJumps/player 落第 0 台', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'ready');
  assert.equal(s.goalJumps, 3);
  assert.ok(s.platforms.length >= 3 + 8);
  assert.equal(s.player.platformIndex, 0);
  assert.equal(s.player.x, s.platforms[0].x);
  assert.equal(s.wind, false);
});

test('蓄力：press 后 step 累加 charge，封顶 MAX_CHARGE', () => {
  const r = createRun(0, { seed: 1 });
  r.press();
  advance(r, 5);
  assert.equal(r.state.phase, 'charging');
  assert.ok(r.state.player.charge <= GAME.MAX_CHARGE + 1e-9);
  assert.ok(Math.abs(r.state.player.charge - GAME.MAX_CHARGE) < 1e-6);
});

test('松手起跳：release 进入 jumping 并发 jump 事件', () => {
  const r = createRun(0, { seed: 1 });
  r.press();
  advance(r, 0.3);
  const before = r.state.player.charge;
  assert.ok(before > 0);
  const res = r.release();
  assert.equal(res.ok, true);
  assert.equal(r.state.phase, 'jumping');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'jump'));
});

test('完美落点：按 greedyCharge 蓄力落进中心 → perfect + combo=1', () => {
  const r = createRun(0, { seed: 1 });
  const gc = greedyCharge(r);
  assert.ok(gc && gc.charge > 0 && gc.charge <= GAME.MAX_CHARGE);
  doJump(r, gc.charge);
  assert.equal(r.state.jumps, 1);
  assert.equal(r.state.perfects, 1);
  assert.equal(r.state.combo, 1);
  assert.equal(r.state.nearMisses, 0);
  assert.equal(r.state.phase, 'ready');
});

test('普通落点：蓄力偏一点落台面 → normal + 连击清零', () => {
  const r = createRun(0, { seed: 1 });
  const spacing = r.state.platforms[1].x - r.state.player.x;
  const off = (GAME.NORMAL_RATIO * 60); // 落在中心与边缘之间
  const charge = (spacing + off) / GAME.CHARGE_SPEED;
  doJump(r, charge);
  assert.equal(r.state.jumps, 1);
  assert.equal(r.state.perfects, 0);
  assert.equal(r.state.nearMisses, 1);
  assert.equal(r.state.combo, 0);
});

test('踏空：蓄力不足直接坠落 → lose fall', () => {
  const r = createRun(0, { seed: 1 });
  doJump(r, 0.08);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'fall');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'fall'));
  assert.ok(ev.some((e) => e.type === 'lose'));
});

test('边缘失足：落在台面边缘 → lose slip', () => {
  const r = createRun(0, { seed: 1 });
  const w = r.state.platforms[1].w;
  const spacing = r.state.platforms[1].x - r.state.player.x;
  const off = w / 2 - 7; // 落在边缘判定带（普通半径之外、台面之内）
  const charge = (spacing + off) / GAME.CHARGE_SPEED;
  doJump(r, charge);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'slip');
});

test('连击翻倍：连续两次完美 → combo=2，score=1+2=3', () => {
  const r = createRun(0, { seed: 1 });
  let gc = greedyCharge(r);
  doJump(r, gc.charge);
  assert.equal(r.state.combo, 1);
  gc = greedyCharge(r);
  doJump(r, gc.charge);
  assert.equal(r.state.combo, 2);
  assert.equal(r.state.score, 3);
  assert.equal(r.state.maxCombo, 2);
});

test('冰面台：greedyCharge 瞄准近边缘，滑动后仍落进中心', () => {
  const r = createRun(5, { seed: 1 }); // L6 ice，typeCycle ['normal','ice']
  // 第一跳落到普通台
  let gc = greedyCharge(r);
  doJump(r, gc.charge);
  assert.equal(r.state.perfects, 1);
  // 下一台是冰面台，贪心助手应提前瞄准近边缘
  assert.equal(r.state.platforms[2].type, 'ice');
  gc = greedyCharge(r);
  doJump(r, gc.charge);
  assert.equal(r.state.perfects, 2, '瞄准近边缘应落进中心（perfect）');
});

test('弹簧台：落上弹射，jumps 至少 +2，不坠落', () => {
  const r = createRun(4, { seed: 3 }); // L5 spring
  const gc = greedyCharge(r);
  doJump(r, gc.charge);
  if (r.state.platforms[1].type === 'spring') {
    assert.ok(r.state.jumps >= 2, '弹簧应弹射到再下一台');
    assert.notEqual(r.state.phase, 'lost');
  } else {
    assert.equal(r.state.jumps, 1); // 首台不是 spring，正常落
  }
});

test('移动台：platformX 随时间变化（缓动）', () => {
  const r = createRun(3, { seed: 1 }); // L4 moving
  const m = r.state.platforms.find((p) => p.type === 'moving');
  assert.ok(m, 'L4 应含移动台');
  const a = platformX(m, 0);
  const b = platformX(m, 1.0);
  assert.notEqual(a, b);
});

test('贪心助手：greedyCharge 返回有限且 ≤ MAX_CHARGE', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = createRun(3, { seed });
    const gc = greedyCharge(r);
    assert.ok(gc);
    assert.ok(Number.isFinite(gc.charge));
    assert.ok(gc.charge >= 0 && gc.charge <= GAME.MAX_CHARGE + 1e-9);
  }
});

test('超时：不操作直到夜息耗尽 → lose timeOut', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, LEVELS[0].timeLimit + 1);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'timeOut');
});

test('通关：贪心自解 L1 → won，3 星', () => {
  const r = solveLevel(0, 1);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.equal(r.state.stars, 3);
  assert.ok(r.state.jumps >= r.state.goalJumps);
});

test('mulberry32 可复现：同 seed 平台序列一致', () => {
  const a = createRun(0, { seed: 7 });
  const b = createRun(0, { seed: 7 });
  assert.deepEqual(a.state.platforms.map((p) => p.x), b.state.platforms.map((p) => p.x));
});

test('事件密度：完整一跳产生 ≥4 类事件（chargeStart/chargeTick/jump/land/perfect）', () => {
  const r = createRun(0, { seed: 1 });
  const gc = greedyCharge(r);
  r.press();
  while (r.state.phase === 'charging' && r.state.player.charge < gc.charge) r.step(1 / 60);
  r.release();
  while (r.state.phase === 'jumping') r.step(1 / 60);
  const types = new Set(r.drainEvents().map((e) => e.type));
  for (const t of ['chargeStart', 'jump', 'land', 'perfect']) assert.ok(types.has(t), `缺 ${t}`);
});

test('drainEvents 清空队列', () => {
  const r = createRun(0, { seed: 1 });
  r.press();
  assert.ok(r.drainEvents().length > 0);
  assert.equal(r.drainEvents().length, 0);
});
