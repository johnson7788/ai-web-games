import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, talentCount, mulberry32 } from '../src/game/sim.js';
import { GAME, SUBJECTS, STUDENTS } from '../config/game.config.js';
import { LEVEL_COUNT, levelOf } from '../config/levels.js';

// 以 1/60 步长结算一整周（含事件）
function settleWeek(run, optionIndex = 0) {
  let guard = 0;
  while (run.state.phase === 'resolving' && guard++ < 3000) {
    if (run.state.activeEvent) run.chooseEvent(optionIndex);
    run.step(1 / 60);
  }
  return run.state;
}

function playWeek(run, subjects, optionIndex = 0) {
  for (const s of subjects) assert.equal(run.assign(s).ok, true);
  assert.equal(run.endWeek().ok, true);
  return settleWeek(run, optionIndex);
}

test('冒烟：createRun → step → assign → endWeek → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  assert.equal(r.assign('study').ok, true);
  const hud = r.getHud();
  assert.equal(hud.week, 1);
  assert.equal(hud.phase, 'planning');
  assert.ok(Array.isArray(r.drainEvents()));
  assert.equal(r.endWeek().ok, true);
});

test('state 形状：week/phase/coins/energy/attrs/slots', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.week, 1);
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'planning');
  assert.equal(s.coins, GAME.START_COINS);
  assert.equal(s.energy, GAME.START_ENERGY);
  assert.deepEqual(s.attrs, GAME.START_ATTRS);
  assert.equal(s.slotsPerWeek, 5);
  assert.equal(s.slots.length, 0);
});

test('assign study：成绩+5（基础3+天赋2）、心情-1、体力-20', () => {
  const r = createRun(0, { seed: 1 });
  const before = { ...r.state.attrs };
  assert.equal(r.assign('study').ok, true);
  assert.equal(r.state.attrs.grades, before.grades); // 分配时不动属性，结算才动
  assert.equal(r.state.energy, GAME.START_ENERGY - 20);
  r.endWeek();
  settleWeek(r);
  assert.equal(r.state.attrs.grades, before.grades + 5);
  // 结算含周目标失败的心情 -3
  assert.equal(r.state.attrs.mood, before.mood - 1 - 3);
});

test('assign 消耗体力/金币并校验边界', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.assign('trip').ok, true);
  assert.equal(r.state.coins, GAME.START_COINS - 40);
  assert.equal(r.state.energy, GAME.START_ENERGY - 15);
  r.state.energy = 0;
  assert.deepEqual(r.assign('martial'), { ok: false, reason: 'noEnergy' });
  r.state.energy = 100;
  r.state.coins = 0;
  assert.deepEqual(r.assign('trip'), { ok: false, reason: 'noCoins' });
  // 已占 1 个（trip），再排 4 个 rest 即满 5 槽
  r.state.coins = 2000;
  for (let i = 0; i < 4; i += 1) assert.equal(r.assign('rest').ok, true);
  assert.deepEqual(r.assign('rest'), { ok: false, reason: 'noSlots' });
});

test('unassign 退还体力与金币', () => {
  const r = createRun(0, { seed: 1 });
  r.assign('study');
  r.assign('trip');
  const energyAfter = r.state.energy;
  const coinsAfter = r.state.coins;
  assert.equal(r.unassign(1).ok, true);
  assert.equal(r.state.energy, energyAfter + 15);
  assert.equal(r.state.coins, coinsAfter + 40);
  assert.equal(r.state.slots.length, 1);
});

test('rest：回体力+25、心情+5，无属性成长', () => {
  const r = createRun(0, { seed: 1 });
  r.state.energy = 50;
  r.assign('rest');
  r.endWeek();
  settleWeek(r);
  assert.equal(r.state.energy, Math.min(100, 50 + 25 + GAME.WEEKLY_ENERGY_REGEN));
  assert.equal(r.state.attrs.mood, 60 + 5 - 3); // rest +5，周目标失败 -3
  assert.equal(r.state.attrs.grades, 30);
  assert.equal(r.state.attrs.reputation, 20);
});

test('天赋加成：study 2 名天赋生 → +5；martial 2 名 → +5；trip 1 名 → +5', () => {
  assert.equal(talentCount('study'), 2);
  assert.equal(talentCount('martial'), 2);
  assert.equal(talentCount('trip'), 1);
  assert.equal(SUBJECTS.study.base + SUBJECTS.study.talentBonus * 2, 5);
  assert.equal(SUBJECTS.trip.base + SUBJECTS.trip.talentBonus * 1, 5);
});

test('第 4 周天赋加成翻倍：study +7', () => {
  const r = createRun(0, { seed: 1 });
  r.state.week = 4;
  r.state.level = 4;
  r.assign('study');
  r.endWeek();
  settleWeek(r);
  assert.equal(r.state.attrs.grades, 30 + 7);
});

test('第 5 周游学窗口：trip 占双课时且声望翻倍', () => {
  const r = createRun(0, { seed: 1 });
  r.state.week = 5;
  r.state.level = 5;
  r.state.eventQueue = [];
  assert.equal(r.assign('trip').ok, true);
  assert.equal(r.state.slots.length, 2);
  assert.equal(r.state.coins, GAME.START_COINS - 80);
  assert.equal(r.state.energy, GAME.START_ENERGY - 30);
  r.endWeek();
  settleWeek(r);
  // 每槽声望 = (4 + 1*1*2天赋) * 2窗口 = 12，两槽 = 24
  assert.equal(r.state.attrs.reputation, 20 + 24);
});

test('结算：本周目标达标发 weekGoalPass 并 +1 星 +100 金币', () => {
  const r = createRun(0, { seed: 1 });
  const events = [];
  r._events = [];
  const collect = () => { for (const e of r.drainEvents()) events.push(e); };
  // W1 目标 grades≥40：两节 study = +10 → 40
  playWeek(r, ['study', 'study']);
  collect();
  assert.ok(events.some((e) => e.type === 'weekGoalPass' && e.week === 1));
  assert.equal(r.state.stars, 1);
  assert.equal(r.state.coins, GAME.START_COINS + GAME.GOAL_COIN_REWARD); // study 不花金币
  assert.equal(r.state.week, 2);
});

test('结算：目标未达标发 weekGoalFail 并心情 -3', () => {
  const r = createRun(0, { seed: 1 });
  const events = [];
  const collect = () => { for (const e of r.drainEvents()) events.push(e); };
  playWeek(r, ['rest']);
  collect();
  assert.ok(events.some((e) => e.type === 'weekGoalFail'));
  assert.equal(r.state.attrs.mood, 60 + 5 - 3); // rest +5, 失败 -3
});

test('事件：第 2 周必发 cold，选 0 花金币买药', () => {
  const r = createRun(0, { seed: 1 });
  playWeek(r, ['study', 'study']); // 过 W1 到 W2
  assert.equal(r.state.week, 2);
  const queue = r.state.eventQueue;
  assert.ok(queue.length >= 1);
  assert.equal(queue[0].id, 'cold');
  r.assign('study');
  r.endWeek();
  // 结算到事件出现
  let sawEvent = null;
  let guard = 0;
  while (r.state.phase === 'resolving' && guard++ < 3000) {
    if (r.state.activeEvent) { sawEvent = r.state.activeEvent; break; }
    r.step(1 / 60);
  }
  assert.equal(sawEvent.id, 'cold');
  const coinsBefore = r.state.coins;
  assert.equal(r.chooseEvent(0).ok, true);
  assert.equal(r.state.coins, coinsBefore - 50);
  settleWeek(r);
});

test('seeded 确定性：同 seed 玩到第 3 周状态一致', () => {
  function runToWeek3(seed) {
    const r = createRun(0, { seed });
    for (const subjects of [['study', 'study', 'rest'], ['martial', 'martial', 'rest'], ['study', 'rest', 'rest']]) {
      playWeek(r, subjects);
    }
    return JSON.stringify({ attrs: r.state.attrs, coins: r.state.coins, energy: r.state.energy, week: r.state.week });
  }
  assert.equal(runToWeek3(7), runToWeek3(7));
});

test('mulberry32：同 seed 序列一致', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('第 8 周连轴周：进入时体力上限 +20', () => {
  const r = createRun(0, { seed: 1 });
  r.state.week = 7;
  r.state.level = 7;
  r.assign('rest');
  r.endWeek();
  settleWeek(r);
  assert.equal(r.state.week, 8);
  assert.equal(r.state.energyMax, GAME.ENERGY_MAX + GAME.ENERGY_MAX_UP);
});

test('第 9 周冲刺周：进入时补助 +200 金币', () => {
  const r = createRun(0, { seed: 1 });
  r.state.week = 8;
  r.state.level = 8;
  r.state.energyMax = 120;
  const coinsBefore = r.state.coins;
  r.assign('rest');
  r.endWeek();
  settleWeek(r);
  assert.equal(r.state.week, 9);
  assert.equal(r.state.coins, coinsBefore + 200);
});

test('第 11 周模拟考：达标发 mockExam', () => {
  const r = createRun(0, { seed: 1 });
  r.state.week = 11;
  r.state.level = 11;
  r.state.attrs = { grades: 60, fitness: 50, mood: 45, reputation: 45 };
  const events = [];
  r.assign('rest');
  r.endWeek();
  settleWeek(r);
  for (const e of r.drainEvents()) events.push(e);
  assert.ok(events.some((e) => e.type === 'mockExam' && e.passed === true));
});

test('大考：核心两门达标 → win，四门全过 → 3 星', () => {
  const r = createRun(0, { seed: 1 });
  r.state.week = 12;
  r.state.level = 12;
  r.state.attrs = { grades: 75, fitness: 65, mood: 50, reputation: 60 };
  r.state.eventQueue = [];
  r.endWeek();
  settleWeek(r);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.equal(r.state.result.all4, true);
  assert.equal(r.state.result.stars, 3);
});

test('大考：核心未达标 → lose，且有名次名单', () => {
  const r = createRun(0, { seed: 1 });
  r.state.week = 12;
  r.state.level = 12;
  r.state.attrs = { grades: 40, fitness: 45, mood: 50, reputation: 60 };
  r.state.eventQueue = [];
  r.endWeek();
  settleWeek(r);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  assert.ok(Array.isArray(r.state.result.ranking));
  assert.equal(r.state.result.ranking.length, STUDENTS.length);
});

test('关卡表：12 周、index 连续、目标字段合法', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const lv = levelOf(i + 1);
    assert.equal(lv.index, i + 1);
    assert.ok(['spring', 'summer', 'winter'].includes(lv.scene));
    assert.ok(['grades', 'fitness', 'mood', 'reputation'].includes(lv.goal.attr));
    assert.ok(lv.goal.threshold > 0);
    assert.equal(typeof lv.feature, 'string');
  }
});
