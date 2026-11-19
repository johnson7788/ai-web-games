import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  step,
  tap,
  hint,
  drainEvents,
  mulberry32,
  ITEMS,
  ROUNDS,
  ROUND_TIME,
  ODD_TIME_BONUS,
  CORRECT_SCORE,
  COMBO_MAX,
} from '../src/game/sim.js';
import { CATEGORIES, NEED, HINT_COUNT } from '../config/game.config.js';

const CAT_IDS = CATEGORIES.map((c) => c.id);

// 贪婪求解：每回合先点异类、再逐个点对任务类别，直到整局结束
function greedySolve(run, maxSteps = 5000) {
  let guard = 0;
  while (!run.finished && guard < maxSteps) {
    guard += 1;
    for (let i = 0; i < run.items.length; i += 1) {
      const it = run.items[i];
      if (it.odd && !it.oddResolved) { tap(run, i); break; }
    }
    let did = false;
    for (let i = 0; i < run.items.length; i += 1) {
      const it = run.items[i];
      if (!it.collected && it.cat === run.task.cat && !(it.odd && !it.oddResolved)) {
        tap(run, i);
        did = true;
        break;
      }
    }
    step(run, 1 / 60);
    if (!did) break;
  }
  return run;
}

test('createRun：5 回合、25 个物品、playing 阶段', () => {
  const run = createRun(1);
  assert.equal(run.phase, 'playing');
  assert.equal(run.totalRounds, ROUNDS);
  assert.equal(run.items.length, ITEMS.length);
  assert.equal(run.round, 1);
});

test('任务：need 数量与类别合法', () => {
  const run = createRun(2);
  assert.ok(CAT_IDS.includes(run.task.cat), '任务类别应在 5 类内');
  assert.equal(run.task.need, NEED[0], '第一回合数量应为 NEED[0]');
  assert.equal(run.task.found, 0);
});

test('异类：每回合恰好 1 个，且不属于任务类别', () => {
  const run = createRun(3);
  const oddItems = run.items.filter((it) => it.odd);
  assert.equal(oddItems.length, 1);
  assert.notEqual(oddItems[0].cat, run.task.cat, '异类不能是任务类别');
});

test('点对：found+1、combo+1、kind=correct', () => {
  const run = createRun(4);
  const idx = run.items.findIndex((it) => it.cat === run.task.cat && !it.odd);
  const before = run.task.found;
  const comboBefore = run.combo;
  const res = tap(run, idx);
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'correct');
  assert.equal(run.task.found, before + 1);
  assert.equal(run.combo, comboBefore + 1);
});

test('点错：combo 重置为 1、kind=wrong、扣分不扣时间', () => {
  const run = createRun(5);
  const idx = run.items.findIndex((it) => it.cat !== run.task.cat && !it.odd);
  const timeBefore = run.timeLeft;
  const res = tap(run, idx);
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'wrong');
  assert.equal(run.combo, 1);
  assert.equal(run.timeLeft, timeBefore, '点错不应扣时间');
});

test('点异类：+时间、+分、连击不变、kind=odd', () => {
  const run = createRun(6);
  const idx = run.items.findIndex((it) => it.odd);
  const timeBefore = run.timeLeft;
  const comboBefore = run.combo;
  const res = tap(run, idx);
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'odd');
  assert.equal(run.oddFoundTotal, 1);
  assert.equal(run.timeLeft, Math.min(ROUND_TIME, timeBefore + ODD_TIME_BONUS));
  assert.equal(run.combo, comboBefore, '异类不改变连击');
});

test('重复点已收集：ok=false kind=done', () => {
  const run = createRun(7);
  const idx = run.items.findIndex((it) => it.cat === run.task.cat && !it.odd);
  tap(run, idx);
  const res = tap(run, idx);
  assert.equal(res.ok, false);
  assert.equal(res.kind, 'done');
});

test('完成一回合：round+1、roundsWon+1、事件含 roundWin', () => {
  const run = createRun(8);
  // 点满本回合需要数量
  let need = run.task.need;
  let guard = 0;
  while (need > 0 && guard < 50) {
    guard += 1;
    const idx = run.items.findIndex((it) => it.cat === run.task.cat && !it.collected && !it.odd);
    if (idx < 0) break;
    tap(run, idx);
    need -= 1;
  }
  assert.equal(run.round, 2);
  assert.equal(run.roundsWon, 1);
  const events = drainEvents(run);
  assert.ok(events.some((e) => e.type === 'roundWin'), '应发出 roundWin 事件');
});

test('提示：返回任务类别物品、hintLeft 减一', () => {
  const run = createRun(9);
  const before = run.hintLeft;
  const res = hint(run);
  assert.equal(res.ok, true);
  assert.ok(run.items[res.index].cat === run.task.cat, '提示应是任务类别');
  assert.equal(run.hintLeft, before - 1);
});

test('noinput：多回合后整局结束、判负（roundsLost>roundsWon）', () => {
  const run = createRun(10);
  let guard = 0;
  while (!run.finished && guard < (ROUND_TIME + 10) * 60 * ROUNDS) {
    step(run, 1 / 60);
    guard += 1;
  }
  assert.equal(run.finished, true);
  assert.ok(run.roundsLost > run.roundsWon, '无输入应判负');
  assert.equal(run.won, false);
});

test('greedy：完赛、判胜、三星', () => {
  const run = greedySolve(createRun(11));
  assert.equal(run.finished, true);
  assert.equal(run.won, true);
  assert.equal(run.roundsWon, ROUNDS);
  assert.equal(run.stars, 3, '全胜 + 找到异类 + 高连击应三星');
});

test('连击上限：连续点对不超过 COMBO_MAX', () => {
  const run = createRun(12);
  let need = run.task.need;
  let guard = 0;
  while (need > 0 && guard < 50) {
    guard += 1;
    const idx = run.items.findIndex((it) => it.cat === run.task.cat && !it.collected && !it.odd);
    if (idx < 0) break;
    tap(run, idx);
    need -= 1;
  }
  assert.ok(run.combo <= COMBO_MAX, `combo ${run.combo} 不应超过 ${COMBO_MAX}`);
});

test('确定性：同 seed 的任务与物品顺序一致', () => {
  const a = createRun(42);
  const b = createRun(42);
  assert.equal(a.task.cat, b.task.cat, '同 seed 任务类别应一致');
  assert.deepEqual(a.items.map((i) => i.uid), b.items.map((i) => i.uid), '同 seed 物品顺序应一致');
});

test('mulberry32：确定性输出', () => {
  const r1 = mulberry32(99);
  const r2 = mulberry32(99);
  assert.equal(r1(), r2());
});
