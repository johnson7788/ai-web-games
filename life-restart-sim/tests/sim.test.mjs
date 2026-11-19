import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, checkCondition } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

function setup(seed = 42) {
  const run = createRun({ seed, times: 0, achievements: 0 });
  return run;
}

function readyToLife(seed = 42) {
  const run = setup(seed);
  for (const i of [0, 1, 2]) run.pickTalent(i);
  assert.equal(run.confirmTalents().ok, true);
  run.autoAllocate();
  assert.equal(run.startLife(run.state.alloc).ok, true);
  return run;
}

test('createRun 从 talent 阶段开始，候选池 10 个', () => {
  const run = setup();
  assert.equal(run.state.phase, 'talent');
  assert.equal(run.state.talentPool.length, GAME.TALENT_OFFER);
});

test('pickTalent 可切换选中状态', () => {
  const run = setup();
  assert.equal(run.pickTalent(0).ok, true);
  assert.ok(run.state.selectedIndices.includes(0));
  run.pickTalent(0);
  assert.ok(!run.state.selectedIndices.includes(0));
});

test('confirmTalents 必须选满 3 个', () => {
  const run = setup();
  run.pickTalent(0);
  run.pickTalent(1);
  assert.equal(run.confirmTalents().ok, false);
  run.pickTalent(2);
  assert.equal(run.confirmTalents().ok, true);
  assert.equal(run.state.phase, 'allocate');
});

test('allocPoints = 20 + 天赋加成（≥20）', () => {
  const run = setup();
  for (const i of [0, 1, 2]) run.pickTalent(i);
  run.confirmTalents();
  assert.ok(run.state.allocPoints >= GAME.ALLOC_POINTS);
});

test('autoAllocate 用完所有点数', () => {
  const run = setup();
  for (const i of [0, 1, 2]) run.pickTalent(i);
  run.confirmTalents();
  run.autoAllocate();
  const used = run.state.alloc.CHR + run.state.alloc.INT + run.state.alloc.STR + run.state.alloc.MNY;
  assert.equal(used, run.state.allocPoints);
});

test('startLife 进入 life 阶段且 SPR 为基础值起步', () => {
  const run = readyToLife();
  assert.equal(run.state.phase, 'life');
  // SPR 基础值为 5，天赋可能额外加成，故 ≥ 5
  assert.ok(run.state.props.SPR >= GAME.SPR_BASE);
});

test('nextYear 递增年龄', () => {
  const run = readyToLife();
  run.nextYear();
  assert.equal(run.state.age, 0);
  run.nextYear();
  assert.ok(run.state.age >= 1);
});

test('命运抉择在里程碑年龄触发', () => {
  const run = readyToLife();
  let guard = 50;
  while (guard-- > 0 && run.state.phase === 'life' && !run.state.pendingChoice && run.state.age < 6) {
    run.nextYear();
  }
  assert.equal(run.state.age, 6);
  assert.ok(run.state.pendingChoice, '6 岁应触发命运抉择');
  const before = { ...run.state.props };
  run.resolveChoice('a');
  assert.equal(run.state.pendingChoice, null);
  assert.ok(run.state.props.CHR !== before.CHR || run.state.props.INT !== before.INT, '抉择后属性应变化');
});

test('checkCondition 支持比较与包含运算', () => {
  const property = { get: (p) => (p === 'AGE' ? 18 : p === 'TLT' ? [1001, 1102] : 0) };
  assert.equal(checkCondition(property, 'AGE>=18'), true);
  assert.equal(checkCondition(property, 'AGE<18'), false);
  assert.equal(checkCondition(property, 'TLT?[1001]'), true);
  assert.equal(checkCondition(property, 'TLT?[9999]'), false);
});

test('fastLife 能走完一生并产生结算', () => {
  const run = readyToLife();
  let guard = 500;
  while (guard-- > 0 && run.state.phase === 'life') {
    if (run.state.pendingChoice) run.resolveChoice('a');
    else run.nextYear();
  }
  assert.equal(run.state.phase, 'summary');
  assert.equal(run.state.completed, true);
  assert.equal(run.state.deaths, 1);
  assert.ok(typeof run.state.summary.score === 'number');
  assert.ok(run.state.stars >= 0 && run.state.stars <= 3);
});

test('结算后会解锁至少一条成就', () => {
  const run = readyToLife();
  let guard = 500;
  while (guard-- > 0 && run.state.phase === 'life') {
    if (run.state.pendingChoice) run.resolveChoice('a');
    else run.nextYear();
  }
  assert.ok(run.state.records.length >= 1, '应至少解锁 First Reincarnation');
});

test('事件管道 drainEvents 有内容', () => {
  const run = readyToLife();
  run.nextYear();
  const events = run.drainEvents();
  assert.ok(events.length >= 1);
  assert.ok(events.some((e) => e.type === 'year'));
});

test('低体质出生会胎死腹中', () => {
  const run = setup();
  for (const i of [0, 1, 2]) run.pickTalent(i);
  run.confirmTalents();
  run.startLife({ CHR: 0, INT: 0, STR: -3, MNY: 0 });
  run.nextYear();
  assert.equal(run.state.phase, 'summary');
  assert.equal(run.state.summary.age, 0);
});
