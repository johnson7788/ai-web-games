// tests/sim.test.mjs — 谜题引擎纯逻辑测试（无 DOM / 无 localStorage / 无 Date.now）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';

function events(run) { return run.drainEvents(); }

function first(run, type) {
  return run.events.find((e) => e.type === type) || null;
}

test('createRun：开局在 playing，第 1 关，发 levelEnter', () => {
  const run = createRun();
  assert.equal(run.phase, 'playing');
  assert.equal(run.levelIndex, 0);
  const ev = first(run, 'levelEnter');
  assert.ok(ev && ev.levelNumber === 1);
});

test('step 推进固定步长时间', () => {
  const run = createRun();
  const t0 = run.time;
  run.step({});
  run.step({});
  assert.ok(run.time > t0);
  assert.ok(run.time - t0 < 0.1);
});

test('第 1 关：把温度计拖进冰水解锁（dragTo）', () => {
  const run = createRun();
  run.applyGesture({ kind: 'drag', id: 'thermo', fromX: 380, fromY: 420, toX: 920, toY: 420 });
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 3);
  assert.ok(first(run, 'levelClear'));
});

test('点错物体：失误数 +1，发 wrong 事件', () => {
  const run = createRun();
  // 第 1 关目标是拖温度计；直接点它（不是拖）算失误
  run.applyGesture({ kind: 'tap', x: 380, y: 420 });
  assert.equal(run.failCount, 1);
  assert.ok(first(run, 'wrong'));
});

test('累计 3 次失误解锁「博士帮你」', () => {
  const run = createRun();
  run.applyGesture({ kind: 'tap', x: 380, y: 420 });
  run.applyGesture({ kind: 'tap', x: 380, y: 420 });
  assert.equal(run.ls.helpUnlocked, false);
  run.applyGesture({ kind: 'tap', x: 380, y: 420 });
  assert.equal(run.ls.helpUnlocked, true);
  assert.ok(first(run, 'helpUnlocked'));
});

test('博士帮你：未解锁时拒绝，解锁后 1 星通关', () => {
  const run = createRun();
  assert.equal(run.doctorSolve(), false);
  for (let i = 0; i < 3; i += 1) run.applyGesture({ kind: 'tap', x: 380, y: 420 });
  assert.equal(run.doctorSolve(), true);
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 1);
});

test('提示：hintUsed 后通关只 2 星', () => {
  const run = createRun();
  assert.equal(run.useHint(), true);
  run.applyGesture({ kind: 'drag', id: 'thermo', fromX: 380, fromY: 420, toX: 920, toY: 420 });
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 2);
});

test('第 2 关：连点灯泡 2 次 + 点影子解锁', () => {
  const run = createRun({ levelIndex: 1 });
  run.applyGesture({ kind: 'tap', x: 640, y: 360 });
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'tap', x: 640, y: 360 });
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'tap', x: 700, y: 470 });
  assert.equal(run.phase, 'solved');
});

test('第 3 关：被海报盖住的真按钮不可点，掀开后可点', () => {
  const run = createRun({ levelIndex: 2 });
  run.applyGesture({ kind: 'tap', x: 440, y: 560 }); // 点到海报
  assert.equal(run.phase, 'playing');
  assert.equal(run.failCount, 1);
  run.applyGesture({ kind: 'drag', id: 'poster', fromX: 440, fromY: 560, toX: 900, toY: 300 });
  run.applyGesture({ kind: 'tap', x: 440, y: 560 }); // 现在点到真按钮
  assert.equal(run.phase, 'solved');
});

test('第 4 关：拖旋转把手倒置场景解锁（invert）', () => {
  const run = createRun({ levelIndex: 3 });
  assert.equal(run.ls.sceneRotated, false);
  run.applyGesture({ kind: 'drag', id: 'handle', fromX: 1040, fromY: 540, toX: 1040, toY: 540 });
  assert.equal(run.ls.sceneRotated, true);
  assert.equal(run.phase, 'solved');
});

test('第 6 关（strict 多步）：必须按闹钟→掀毯→戳助手顺序', () => {
  const run = createRun({ levelIndex: 5 });
  // 先戳助手（被毯子盖住，且顺序不对）→ 失误
  run.applyGesture({ kind: 'tap', x: 880, y: 440 });
  assert.equal(run.failCount, 1);
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'tap', x: 380, y: 340 }); // 闹钟
  run.applyGesture({ kind: 'drag', id: 'blanket', fromX: 880, fromY: 440, toX: 300, toY: 200 });
  run.applyGesture({ kind: 'tap', x: 880, y: 440 }); // 助手
  assert.equal(run.phase, 'solved');
});

test('solveCurrent：调试直解，3 星，发 levelClear + roast', () => {
  const run = createRun();
  assert.equal(run.solveCurrent(), true);
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 3);
  assert.ok(first(run, 'levelClear'));
  assert.ok(first(run, 'roast'));
});

test('nextLevel：推进到第 2 关并重置关卡状态', () => {
  const run = createRun();
  run.solveCurrent();
  run.nextLevel();
  assert.equal(run.levelIndex, 1);
  assert.equal(run.phase, 'playing');
  assert.equal(run.ls.failThisLevel, 0);
});

test('resetLevel：重试当前关，失误不清零但本关计数清零', () => {
  const run = createRun();
  run.applyGesture({ kind: 'tap', x: 380, y: 420 });
  assert.equal(run.ls.failThisLevel, 1);
  run.resetLevel();
  assert.equal(run.phase, 'playing');
  assert.equal(run.ls.failThisLevel, 0);
  assert.equal(run.failCount, 1); // 累计失误保留
});

test('第 22 关：三颗星全部拖进星座槽解锁', () => {
  const run = createRun({ levelIndex: 21 });
  run.applyGesture({ kind: 'drag', id: 'star1', fromX: 340, fromY: 300, toX: 1040, toY: 420 });
  run.applyGesture({ kind: 'drag', id: 'star2', fromX: 520, fromY: 520, toX: 1040, toY: 420 });
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'drag', id: 'star3', fromX: 700, fromY: 300, toX: 1040, toY: 420 });
  assert.equal(run.phase, 'solved');
});

test('第 24 关（最终 Boss）：严格顺序通关后 complete', () => {
  const run = createRun({ levelIndex: 23 });
  run.applyGesture({ kind: 'drag', id: 'keycard', fromX: 340, fromY: 320, toX: 640, toY: 300 });
  run.applyGesture({ kind: 'tap', x: 640, y: 540 });
  run.applyGesture({ kind: 'drag', id: 'handle', fromX: 1120, fromY: 580, toX: 1120, toY: 580 });
  run.applyGesture({ kind: 'tap', x: 1040, y: 400 });
  assert.equal(run.phase, 'complete');
  assert.ok(first(run, 'complete'));
});

test('getHud：返回关卡/章节/目标/星数/用时等字段', () => {
  const run = createRun();
  const h = run.getHud();
  assert.equal(h.levelNumber, 1);
  assert.equal(h.totalLevels, 24);
  assert.equal(h.chapter, 1);
  assert.ok(h.goal.en && h.goal.zh);
  assert.equal(typeof h.elapsedMs, 'number');
});
