import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { DIFFICULTIES } from '../config/idioms.js';

function solveCurrent(run) {
  const a = run.current.answer;
  for (const ch of Array.from(a)) run.step({ type: ch });
  run.step({ submit: true });
  return run.drainEvents();
}

test('开局即出第一题且状态为 playing', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.ok(run.current, '应该有当前题目');
  assert.equal(run.current.timer, DIFFICULTIES[run.difficulty].timeSec);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'riddleShow'));
});

test('逐字输入并提交正确答案：得分/连击/推进', () => {
  const run = createRun({ seed: 2, difficulty: 1 });
  const evs = solveCurrent(run);
  assert.equal(run.riddlesSolved, 1);
  assert.equal(run.combo, 1);
  assert.equal(run.score, 1);
  assert.ok(evs.some((e) => e.type === 'answerCorrect'));
  assert.ok(evs.some((e) => e.type === 'star'));
});

test('答错打断连击且保留原题', () => {
  const run = createRun({ seed: 3, difficulty: 1 });
  const before = run.current.riddleId;
  run.step({ submitText: '错错错错' });
  run.drainEvents();
  assert.equal(run.combo, 0);
  assert.equal(run.score, 0);
  assert.equal(run.riddlesSolved, 0);
  assert.equal(run.current.riddleId, before, '答错应保留同一题');
});

test('连击达到 2 时基础分乘 1.2（easy）', () => {
  const run = createRun({ seed: 4, difficulty: 1 });
  solveCurrent(run);
  solveCurrent(run);
  assert.equal(run.combo, 2);
  assert.equal(run.score, 2.2);
});

test('中等难度基础分为 1.5', () => {
  const run = createRun({ seed: 5, difficulty: 2 });
  solveCurrent(run);
  assert.equal(run.score, 1.5);
});

test('困难难度基础分为 2', () => {
  const run = createRun({ seed: 6, difficulty: 3 });
  solveCurrent(run);
  assert.equal(run.score, 2);
});

test('累计 5 基础分得 1 张提示笺，可用后揭示释义', () => {
  const run = createRun({ seed: 7, difficulty: 1 });
  for (let i = 0; i < 4; i += 1) solveCurrent(run);
  assert.equal(run.hints, 1, '第 4 题驿站奖励 1 张');
  assert.equal(run.hintProgress, 4);
  solveCurrent(run); // 第 5 题：累计 5 基础分再得 1 张
  assert.equal(run.hints, 2);
  assert.equal(run.current.hinted, false);
  run.step({ hint: true });
  const evs = run.drainEvents();
  assert.equal(run.current.hinted, true);
  assert.equal(run.hints, 1);
  assert.ok(evs.some((e) => e.type === 'hintUsed'));
});

test('无提示笺时用提示不生效', () => {
  const run = createRun({ seed: 8, difficulty: 1 });
  run.step({ hint: true });
  run.drainEvents();
  assert.equal(run.current.hinted, false);
});

test('超时结束：phase=finished 且 losses=1', () => {
  const run = createRun({ seed: 9, difficulty: 1 });
  for (let i = 0; i < 15 * 60 + 5; i += 1) run.step({});
  const evs = run.drainEvents();
  assert.equal(run.phase, 'finished');
  assert.equal(run.stats.losses, 1);
  assert.ok(evs.some((e) => e.type === 'gameOver'));
});

test('题库打穿（全对）→ win 结算', () => {
  const run = createRun({ seed: 10, difficulty: 1 });
  const total = run._deck.length;
  const allEvents = [];
  for (let i = 0; i < total; i += 1) allEvents.push(...solveCurrent(run));
  assert.equal(run.phase, 'finished');
  assert.equal(run.stats.wins, 1);
  assert.ok(allEvents.some((e) => e.type === 'win'));
});

test('驿站里程碑：每 4 题前进一驿并奖励提示笺', () => {
  const run = createRun({ seed: 11, difficulty: 1 });
  const hintsBefore = run.hints;
  for (let i = 0; i < 4; i += 1) solveCurrent(run);
  assert.equal(run.waystations, 2);
  assert.equal(run.stats.levelsReached, 2);
  assert.ok(run.hints >= hintsBefore + 1, '驿站奖励应 +1 提示笺');
});

test('getHud 返回核心字段', () => {
  const run = createRun({ seed: 12, difficulty: 2 });
  const hud = run.getHud();
  assert.equal(hud.difficulty, 2);
  assert.equal(typeof hud.score, 'number');
  assert.ok(hud.current);
  assert.equal(typeof hud.current.timer, 'number');
});

test('同 seed 洗牌顺序可复现', () => {
  const a = createRun({ seed: 123, difficulty: 1 });
  const b = createRun({ seed: 123, difficulty: 1 });
  assert.deepEqual(a._deck, b._deck);
});

test('不同 seed 洗牌顺序不同', () => {
  const a = createRun({ seed: 123, difficulty: 1 });
  const b = createRun({ seed: 124, difficulty: 1 });
  assert.notDeepEqual(a._deck, b._deck);
});
