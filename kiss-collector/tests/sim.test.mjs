// tests/sim.test.mjs — 谜题引擎纯逻辑测试（无 DOM / 无 localStorage / 无 Date.now）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';

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

test('第 1 关：点中爱心解锁（tap）', () => {
  const run = createRun();
  run.applyGesture({ kind: 'tap', x: 640, y: 400 });
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 3);
  assert.ok(first(run, 'levelClear'));
});

test('点错物体：失误数 +1，发 wrong 事件', () => {
  const run = createRun();
  run.applyGesture({ kind: 'tap', x: 360, y: 400 }); // 云朵是错的
  assert.equal(run.failCount, 1);
  assert.ok(first(run, 'wrong'));
});

test('累计 3 次失误解锁「丘比特帮你」', () => {
  const run = createRun();
  run.applyGesture({ kind: 'tap', x: 360, y: 400 });
  run.applyGesture({ kind: 'tap', x: 360, y: 400 });
  assert.equal(run.ls.helpUnlocked, false);
  run.applyGesture({ kind: 'tap', x: 360, y: 400 });
  assert.equal(run.ls.helpUnlocked, true);
  assert.ok(first(run, 'helpUnlocked'));
});

test('丘比特帮你：未解锁时拒绝，解锁后 1 星通关', () => {
  const run = createRun();
  assert.equal(run.cupidHelp(), false);
  for (let i = 0; i < 3; i += 1) run.applyGesture({ kind: 'tap', x: 360, y: 400 });
  assert.equal(run.cupidHelp(), true);
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 1);
});

test('提示：hintUsed 后通关只 2 星', () => {
  const run = createRun();
  assert.equal(run.useHint(), true);
  run.applyGesture({ kind: 'tap', x: 640, y: 400 });
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 2);
});

test('第 2 关：把巧克力拖进礼物盒（dragTo）', () => {
  const run = createRun({ levelIndex: 1 });
  run.applyGesture({ kind: 'drag', id: 'choco', fromX: 380, fromY: 420, toX: 920, toY: 420 });
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[1], 3);
});

test('第 3 关：被海报盖住的爱心不可点，掀开后可点', () => {
  const run = createRun({ levelIndex: 2 });
  run.applyGesture({ kind: 'tap', x: 640, y: 470 }); // 点到海报（盖住爱心）
  assert.equal(run.phase, 'playing');
  assert.equal(run.failCount, 1);
  run.applyGesture({ kind: 'drag', id: 'poster', fromX: 640, fromY: 470, toX: 900, toY: 300 });
  run.applyGesture({ kind: 'tap', x: 640, y: 470 }); // 现在点到真爱心
  assert.equal(run.phase, 'solved');
});

test('第 4 关：长按神灯解锁（hold，本作新增）', () => {
  const run = createRun({ levelIndex: 3 });
  run.applyGesture({ kind: 'hold', x: 640, y: 400 });
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[3], 3);
  assert.ok(first(run, 'hold'));
});

test('第 5 关：连点脸颊 3 次（tapN）', () => {
  const run = createRun({ levelIndex: 4 });
  run.applyGesture({ kind: 'tap', x: 640, y: 400 });
  run.applyGesture({ kind: 'tap', x: 640, y: 400 });
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'tap', x: 640, y: 400 });
  assert.equal(run.phase, 'solved');
});

test('第 6 关：按顺序点（tapSeq，本作新增），点错顺序重置', () => {
  const run = createRun({ levelIndex: 5 });
  run.applyGesture({ kind: 'tap', x: 640, y: 420 }); // 先点纸杯蛋糕（错，应点棒棒糖）
  assert.equal(run.phase, 'playing');
  assert.equal(run.failCount, 1);
  run.applyGesture({ kind: 'tap', x: 360, y: 420 }); // 棒棒糖
  run.applyGesture({ kind: 'tap', x: 640, y: 420 }); // 纸杯蛋糕
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'tap', x: 920, y: 420 }); // 爱心
  assert.equal(run.phase, 'solved');
});

test('第 8 关：连点灯泡 2 次 + 点影子解锁', () => {
  const run = createRun({ levelIndex: 7 });
  run.applyGesture({ kind: 'tap', x: 640, y: 340 });
  run.applyGesture({ kind: 'tap', x: 640, y: 340 });
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'tap', x: 700, y: 470 }); // 影子
  assert.equal(run.phase, 'solved');
});

test('第 14 关：拖旋转把手倒置场景解锁（invert）', () => {
  const run = createRun({ levelIndex: 13 });
  assert.equal(run.ls.sceneRotated, false);
  run.applyGesture({ kind: 'drag', id: 'handle', fromX: 1040, fromY: 540, toX: 1040, toY: 540 });
  assert.equal(run.ls.sceneRotated, true);
  assert.equal(run.phase, 'solved');
});

test('第 18 关（strict 混合）：戒指进盒后长按盒子', () => {
  const run = createRun({ levelIndex: 17 });
  run.applyGesture({ kind: 'hold', x: 920, y: 420 }); // 先长按盒子（顺序错）
  assert.equal(run.failCount, 1);
  assert.equal(run.phase, 'playing');
  run.applyGesture({ kind: 'drag', id: 'ring', fromX: 380, fromY: 420, toX: 920, toY: 420 });
  run.applyGesture({ kind: 'hold', x: 920, y: 420 });
  assert.equal(run.phase, 'solved');
});

test('第 24 关（最终 Boss）：严格顺序通关后 complete', () => {
  const run = createRun({ levelIndex: 23 });
  run.applyGesture({ kind: 'drag', id: 'card', fromX: 340, fromY: 320, toX: 640, toY: 300 });
  run.applyGesture({ kind: 'tap', x: 640, y: 540 });
  run.applyGesture({ kind: 'drag', id: 'handle', fromX: 1120, fromY: 580, toX: 1120, toY: 580 });
  run.applyGesture({ kind: 'hold', x: 1040, y: 400 });
  assert.equal(run.phase, 'complete');
  assert.ok(first(run, 'complete'));
});

test('solveCurrent：调试直解，3 星，发 levelClear + roast + kiss', () => {
  const run = createRun();
  assert.equal(run.solveCurrent(), true);
  assert.equal(run.phase, 'solved');
  assert.equal(run.stars[0], 3);
  assert.ok(first(run, 'levelClear'));
  assert.ok(first(run, 'roast'));
  assert.ok(first(run, 'kiss'));
});

test('亲亲收集 + 连击：连续零失误通关累积，连击 ≥3 额外 +1', () => {
  const run = createRun();
  run.solveCurrent();
  assert.equal(run.streak, 1);
  assert.equal(run.kisses, 3);
  run.nextLevel();
  run.solveCurrent();
  assert.equal(run.streak, 2);
  assert.equal(run.kisses, 6);
  run.nextLevel();
  run.solveCurrent();
  assert.equal(run.streak, 3);
  assert.equal(run.kisses, 10); // 3 + 3 + (3+1)
  const kissEvents = run.events.filter((e) => e.type === 'kiss');
  const kissEv = kissEvents[kissEvents.length - 1];
  assert.ok(kissEv && kissEv.total === 10 && kissEv.bonus === 1);
});

test('失误会打断连击', () => {
  const run = createRun();
  run.solveCurrent();
  assert.equal(run.streak, 1);
  run.nextLevel();
  run.applyGesture({ kind: 'tap', x: 100, y: 600 }); // 空点不算失误（无物体）
  run.applyGesture({ kind: 'tap', x: 360, y: 400 }); // 第 2 关点巧克力（应拖，点它算失误）
  assert.equal(run.streak, 0);
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
  run.applyGesture({ kind: 'tap', x: 360, y: 400 });
  assert.equal(run.ls.failThisLevel, 1);
  run.resetLevel();
  assert.equal(run.phase, 'playing');
  assert.equal(run.ls.failThisLevel, 0);
  assert.equal(run.failCount, 1);
});

test('getHud：返回关卡/章节/目标/星数/亲亲/连击等字段', () => {
  const run = createRun();
  const h = run.getHud();
  assert.equal(h.levelNumber, 1);
  assert.equal(h.totalLevels, 24);
  assert.equal(h.chapter, 1);
  assert.ok(h.goal.en && h.goal.zh);
  assert.equal(typeof h.elapsedMs, 'number');
  assert.equal(h.kisses, 0);
  assert.equal(h.streak, 0);
});
