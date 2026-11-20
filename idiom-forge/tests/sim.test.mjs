import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { PROPS, TIMER, FORGE, SCORE } from '../config/gameplay.js';

function types(events) {
  return events.map((e) => e.type);
}

function correctIndex(run) {
  const hud = run.getHud();
  const q = hud.question;
  const want = q.answer[q.blanks[hud.currentBlank]];
  return hud.grid.indexOf(want);
}

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

// 只解掉当前这一道题（答对全部空格后自动进入下一题，key 变化即停）；不 drain 事件，交给调用方
function solveQuestion(run) {
  const startKey = run.question.key;
  let guard = 0;
  while (run.phase === 'playing' && guard < 8) {
    const hud = run.getHud();
    if (hud.question.key !== startKey) break;
    run.step({ pick: correctIndex(run) });
    guard += 1;
  }
}

// ---------- 契约 / 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1, lang: 'zh' });
  assert.equal(run.phase, 'playing');
  assert.equal(run.getLevel(), 1);
  assert.equal(run.score, 0);
  assert.equal(run.combo, 0);
  assert.equal(run.hints, PROPS.START_HINTS);
  assert.equal(run.resets, PROPS.START_RESETS);
  assert.equal(run.slag, 0);
  assert.ok(run.question, '开局应有一道题');
  assert.ok(run.grid.length >= 8, '开局应有候选字格');
  assert.equal(run.drainEvents()[0].type, 'questionStart', '开局即发出首题事件');
});

test('getHud 契约字段齐全且 question/grid 可读', () => {
  const run = createRun({ seed: 2, lang: 'en' });
  const hud = run.getHud();
  assert.equal(hud.phase, 'playing');
  assert.equal(hud.level, 1);
  assert.equal(hud.scene, 0);
  assert.ok(hud.question);
  assert.ok(Array.isArray(hud.grid));
  assert.equal(typeof hud.timeLeft, 'number');
  assert.equal(typeof hud.score, 'number');
});

test('同 seed 同输入 → 同结果（随机种子确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.deepEqual(a.question.answer, b.question.answer);
  assert.deepEqual(a.grid, b.grid);
  stepN(a, 30, {});
  stepN(b, 30, {});
  assert.equal(a.timeLeft, b.timeLeft);
});

// ---------- 填字判定 ----------
test('答对：填字 + charCorrect + solve + comboUp', () => {
  const run = createRun({ seed: 3, lang: 'zh' });
  run.step({ pick: correctIndex(run) });
  const evs = run.drainEvents();
  assert.ok(types(evs).includes('tileTap'));
  assert.ok(types(evs).includes('charCorrect'));
  assert.ok(types(evs).includes('solve'));
  assert.ok(types(evs).includes('comboUp'));
  assert.equal(run.combo, 1);
  assert.ok(run.score >= SCORE.CORRECT, `score=${run.score}`);
});

test('答错：charWrong + 扣时 + 炉渣 + 连击中断', () => {
  const run = createRun({ seed: 4, lang: 'zh' });
  const before = run.timeLeft;
  const wrongIdx = run.grid.findIndex((c) => c !== run.question.answer[run.question.blanks[0]]);
  run.step({ pick: wrongIdx });
  const evs = run.drainEvents();
  assert.ok(types(evs).includes('charWrong'));
  assert.ok(types(evs).includes('slag'));
  assert.ok(Math.abs(run.timeLeft - (before - (1 / 60) - TIMER.WRONG_PENALTY)) < 1e-9, `timeLeft=${run.timeLeft}`);
  assert.equal(run.slag, 1);
});

test('连击计分：连续答对第 2 题有额外连击分', () => {
  const run = createRun({ seed: 5, lang: 'zh' });
  solveQuestion(run);
  run.drainEvents();
  const s1 = run.score;
  const comboBefore = run.combo;
  assert.equal(comboBefore, 1);
  solveQuestion(run);
  run.drainEvents();
  assert.equal(run.combo, 2);
  const gained = run.score - s1;
  assert.equal(gained, SCORE.CORRECT + SCORE.COMBO_BONUS, `连击额外分 gain=${gained}`);
});

test('炉渣熔炼：集满 3 个错字换 1 提示', () => {
  const run = createRun({ seed: 6, lang: 'zh' });
  const hintsBefore = run.hints;
  for (let i = 0; i < 3; i += 1) {
    const wrongIdx = run.grid.findIndex((c) => c !== run.question.answer[run.question.blanks[run.currentBlank]]);
    run.step({ pick: wrongIdx });
    run.drainEvents();
  }
  assert.equal(run.slag, 0);
  assert.equal(run.hints, hintsBefore + 1);
});

test('提示：消耗 1 提示并亮出正确字，不计连击加成', () => {
  const run = createRun({ seed: 7, lang: 'zh' });
  const hintsBefore = run.hints;
  run.step({ hint: true });
  const evs = run.drainEvents();
  assert.equal(run.hints, hintsBefore - 1);
  assert.ok(types(evs).includes('hint'));
  assert.ok(types(evs).includes('solve'));
  assert.equal(run.combo, 0, '用提示不该增加连击');
});

test('重置：消耗 1 重置并换题，中断连击', () => {
  const run = createRun({ seed: 8, lang: 'zh' });
  const keyBefore = run.question.key;
  run.step({ reset: true });
  const evs = run.drainEvents();
  assert.equal(run.resets, PROPS.START_RESETS - 1);
  assert.ok(types(evs).includes('reset'));
  assert.notEqual(run.question.key, keyBefore);
});

// ---------- 铸兵器 ----------
test('每答对 5 题铸一件神兵（forge 事件）', () => {
  const run = createRun({ seed: 9, lang: 'zh' });
  const forges = [];
  for (let i = 0; i < 5; i += 1) {
    solveQuestion(run);
    for (const e of run.drainEvents()) if (e.type === 'forge') forges.push(e);
  }
  assert.equal(forges.length, 1);
  assert.equal(run.weaponsForged, 1);
  assert.equal(run.weapons.length, 1);
});

// ---------- 关卡推进 ----------
test('过关：答满 level.questions 题进入下一关并换场景时间', () => {
  const run = createRun({ seed: 10, lang: 'en' });
  const level = run.getLevel();
  const n = run.getHud().totalQuestions;
  for (let i = 0; i < n; i += 1) {
    solveQuestion(run);
    run.drainEvents();
  }
  assert.equal(run.getLevel(), level + 1);
  assert.equal(run.questionIndex, 0);
});

test('通关：打完 12 关 phase=won 并发 win', () => {
  const run = createRun({ seed: 11, lang: 'en' });
  let guard = 0;
  while (run.phase === 'playing' && guard < 500) {
    solveQuestion(run);
    run.drainEvents();
    guard += 1;
  }
  assert.equal(run.phase, 'won');
  assert.equal(run.getLevel(), 12);
  assert.equal(run.weaponsForged, 12, '12 关至少铸满 12 件神兵');
});

test('时间耗尽：phase=dead 并发 death', () => {
  const run = createRun({ seed: 12, lang: 'zh' });
  const level = run.getHud();
  stepN(run, Math.ceil(level.timeMax / (1 / 60)) + 5, {});
  assert.equal(run.phase, 'dead');
  assert.ok(types(run.drainEvents()).includes('death'));
});

// ---------- 字谜 ----------
test('字谜模式：riddle 事件 + 分×2', () => {
  const run = createRun({ seed: 13, lang: 'zh' });
  // 用 rng 直接推一个必出字谜的 run：反复造题直到遇到 riddle
  let found = null;
  for (let s = 14; s < 500 && !found; s += 1) {
    const r = createRun({ seed: s, lang: 'zh' });
    if (r.question.riddle) found = r;
  }
  assert.ok(found, '应存在字谜 seed');
  const scoreBefore = found.score;
  found.step({ pick: correctIndex(found) });
  const evs = found.drainEvents();
  assert.ok(types(evs).includes('riddle') || found.questionIndex > 0, '开局 riddle 事件或推进');
  const gained = found.score - scoreBefore;
  assert.equal(gained, SCORE.CORRECT * 2, `字谜分应为 ×2，实际 ${gained}`);
});

// ---------- 倒计时脉冲 ----------
test('每秒发 second 事件（倒计时可感知）', () => {
  const run = createRun({ seed: 15, lang: 'zh' });
  stepN(run, 61, {});
  const evs = run.drainEvents();
  assert.ok(types(evs).includes('second'), '应有 second 事件');
});

// ---------- 同关不重复出题 ----------
test('同关内不出重复题（used 集合生效）', () => {
  const run = createRun({ seed: 16, lang: 'zh', startLevel: 9 });
  const seen = new Set();
  let dup = false;
  // 重置道具最多 1 次，直接通过内部 nextQuestion 观察：连做 20 题不重复
  for (let i = 0; i < 20 && run.phase === 'playing'; i += 1) {
    if (seen.has(run.question.key)) { dup = true; break; }
    seen.add(run.question.key);
    solveQuestion(run);
    run.drainEvents();
  }
  assert.equal(dup, false);
});
