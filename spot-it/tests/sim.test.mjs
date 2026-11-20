import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { BATTERY, TIME, SCORE } from '../config/gameplay.js';
import { LEVEL_COUNT } from '../config/levels.js';

function firstTarget(run) {
  return run.items.find((i) => i.isTarget && !i.found);
}
function firstFiller(run) {
  return run.items.find((i) => !i.isTarget && !i.isDecoy && !i.found);
}
function firstDecoy(run) {
  return run.items.find((i) => i.isDecoy && !i.found);
}

function drain(run) { return run.drainEvents(); }

test('createRun 初始状态：playing、满电、有时间', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.battery, BATTERY.MAX);
  assert.ok(run.timeLeft > 0);
  assert.ok(run.items.length > 0);
  assert.ok(run.checklist.length >= 3);
});

test('点中目标：计数 + 回充 + 得分', () => {
  const run = createRun({ seed: 2 });
  // 先流失一些电量，验证回充
  for (let i = 0; i < 240; i += 1) run.step({});
  drain(run);
  const t = firstTarget(run);
  const before = run.battery;
  const beforeScore = run.score;
  run.step({ click: { x: t.x, y: t.y } });
  const evs = drain(run);
  assert.ok(t.found, '目标应被标记找到');
  assert.ok(run.battery > before, '应回充');
  assert.ok(run.score > beforeScore, '应得分');
  assert.ok(evs.some((e) => e.type === 'find'), '应发 find 事件');
  assert.ok(evs.some((e) => e.type === 'batteryUp'));
});

test('点错普通物品：扣时', () => {
  const run = createRun({ seed: 3 });
  const f = firstFiller(run);
  const before = run.timeLeft;
  run.step({ click: { x: f.x, y: f.y } });
  drain(run);
  assert.ok(run.timeLeft < before, '应扣时');
  const lost = before - run.timeLeft;
  assert.ok(lost >= TIME.WRONG_PENALTY && lost <= TIME.WRONG_PENALTY + 0.05, `扣时 ${lost} 应为 WRONG_PENALTY（含 1 帧计时）`);
});

test('点中诱饵：双倍扣时（≥ 普通扣时）', () => {
  const run = createRun({ seed: 4, startLevel: 8 });
  const d = firstDecoy(run);
  assert.ok(d, '第 8 关应有诱饵');
  const before = run.timeLeft;
  run.step({ click: { x: d.x, y: d.y } });
  drain(run);
  assert.ok(before - run.timeLeft >= TIME.WRONG_PENALTY * 2 - 1e-6, '诱饵扣时应 ≥ 普通两倍');
});

test('电池随时间流失', () => {
  const run = createRun({ seed: 5 });
  const before = run.battery;
  for (let i = 0; i < 60; i += 1) run.step({});
  drain(run);
  assert.ok(run.battery < before, '电池应流失');
});

test('找齐清单过关：关卡推进 + 新场景事件', () => {
  const run = createRun({ seed: 6, startLevel: 1 });
  let cleared = false;
  for (let i = 0; i < 60 * 120 && !cleared; i += 1) {
    const t = firstTarget(run);
    run.step(t ? { click: { x: t.x, y: t.y } } : {});
    const evs = drain(run);
    if (evs.some((e) => e.type === 'levelClear')) cleared = true;
  }
  assert.ok(cleared, '应过关');
  assert.equal(run.level, 2, '应推进到第 2 关');
  assert.ok(run.stats.levelsReached >= 2);
});

test('超时失败：phase=failed', () => {
  const run = createRun({ seed: 7, startLevel: 1 });
  for (let i = 0; i < 60 * 120 && run.phase === 'playing'; i += 1) {
    run.step({});
    drain(run);
  }
  assert.equal(run.phase, 'failed');
});

test('greedy bot（查物品位置表）推进到第 3 关以上', () => {
  const run = createRun({ seed: 123 });
  for (let i = 0; i < 60 * 300 && run.phase === 'playing'; i += 1) {
    const t = firstTarget(run);
    run.step(t ? { click: { x: t.x, y: t.y } } : {});
    drain(run);
  }
  assert.ok(run.stats.levelsReached >= 3, `只到第 ${run.stats.levelsReached} 关`);
  assert.ok(run.phase !== 'failed', 'greedy 不应失败');
});

test('通关 12 关：phase=won', () => {
  const run = createRun({ seed: 999, startLevel: 1 });
  for (let i = 0; i < 60 * 600 && run.phase === 'playing'; i += 1) {
    const t = firstTarget(run);
    run.step(t ? { click: { x: t.x, y: t.y } } : {});
    drain(run);
  }
  assert.equal(run.phase, 'won');
  assert.equal(run.stats.levelsReached, LEVEL_COUNT);
});

test('getHud 返回完整形状', () => {
  const run = createRun({ seed: 10 });
  const hud = run.getHud();
  assert.ok('level' in hud);
  assert.ok('timeLeft' in hud);
  assert.ok('battery' in hud);
  assert.ok('radius' in hud);
  assert.ok('score' in hud);
  assert.ok(Array.isArray(hud.checklist));
  assert.ok('scenePack' in hud);
});

test('事件种类 ≥8（fun-report 事件密度来源）', () => {
  const kinds = new Set();
  const run = createRun({ seed: 11, startLevel: 4 });
  for (let i = 0; i < 60 * 60 && kinds.size < 8; i += 1) {
    const t = firstTarget(run);
    run.step(t ? { click: { x: t.x, y: t.y } } : {});
    for (const e of drain(run)) kinds.add(e.type);
  }
  // 至少：scan / find / checklist / batteryUp / levelClear / newScene / levelStart / scoreMilestone
  assert.ok(kinds.size >= 8, `只有 ${kinds.size} 种：${[...kinds].join(',')}`);
});

test('连击：连续找对 streak 递增并有奖励', () => {
  const run = createRun({ seed: 12, startLevel: 5 });
  const scoreBefore = run.score;
  for (let i = 0; i < 3; i += 1) {
    const t = firstTarget(run);
    if (!t) break;
    run.step({ click: { x: t.x, y: t.y } });
    drain(run);
  }
  assert.ok(run.stats.bestStreak >= 1);
  assert.ok(run.score >= scoreBefore + SCORE.FIND * 3);
});
