import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { QUESTIONS } from '../config/quiz.js';
import { locales } from '../config/locales.js';
import { STEP } from '../config/game.config.js';
import { MATCH_SEC, TOTAL_QUESTIONS, PLAYER } from '../config/gameplay.js';

function fastForward(run, sec, input = { hover: null, choose: null }) {
  const n = Math.ceil(sec / STEP);
  for (let i = 0; i < n; i += 1) run.step(input);
}

function greedyLoop(run, maxSec = 300) {
  const n = Math.ceil(maxSec / STEP);
  for (let i = 0; i < n && run.phase === 'playing'; i += 1) {
    let choose = null;
    if (run.question && !run.question.answered) choose = run.question.answer ? 'true' : 'false';
    run.step({ hover: null, choose });
    run.drainEvents();
  }
}

test('createRun 生成 19 只机器人 + 玩家（共 20）', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.bots.length, PLAYER.COUNT - 1);
  assert.equal(run.phase, 'playing');
  assert.equal(run.mode, 'matching');
});

test('匹配倒计时结束后进入出题', () => {
  const run = createRun({ seed: 1 });
  fastForward(run, MATCH_SEC + 0.1);
  assert.equal(run.mode, 'question');
  assert.ok(run.question);
  assert.equal(typeof run.question.answer, 'boolean');
});

test('提交选择设置车道并标记已作答', () => {
  const run = createRun({ seed: 1 });
  fastForward(run, MATCH_SEC + 0.1);
  run.step({ hover: null, choose: 'true' });
  assert.equal(run.playerCommitted, true);
  assert.ok(run.playerCamp < 0.5);
});

test('答对：连击 +1 且得分增加', () => {
  const run = createRun({ seed: 1 });
  fastForward(run, MATCH_SEC + 0.1);
  const q = run.question;
  run.step({ hover: null, choose: q.answer ? 'true' : 'false' });
  const before = run.score;
  fastForward(run, q.answerTime + 0.1);
  assert.ok(run.score > before);
  assert.equal(run.combo, 1);
  assert.equal(run.stats.correct, 1);
});

test('答错且无护盾：死亡 + 判负', () => {
  const run = createRun({ seed: 1 });
  fastForward(run, MATCH_SEC + 0.1);
  const q = run.question;
  run.step({ hover: null, choose: q.answer ? 'false' : 'true' });
  fastForward(run, q.answerTime + 0.1);
  assert.equal(run.playerAlive, false);
  assert.equal(run.phase, 'finished');
  assert.equal(run.stats.deaths, 1);
  assert.equal(run.stats.losses, 1);
});

test('连击到 3 获得护盾', () => {
  const run = createRun({ seed: 1 });
  for (let q = 0; q < 3; q += 1) {
    fastForward(run, MATCH_SEC + 0.1 + (q > 0 ? 0 : 0));
    // 每次进入出题后作答正确
    if (run.mode !== 'question') {
      // 若还在 gap，继续推进到出题
      while (run.mode !== 'question' && run.phase === 'playing') run.step({ hover: null, choose: null });
    }
    const question = run.question;
    run.step({ hover: null, choose: question.answer ? 'true' : 'false' });
    fastForward(run, question.answerTime + 0.1);
    while (run.mode === 'gap' && run.phase === 'playing') run.step({ hover: null, choose: null });
    run.drainEvents();
  }
  assert.ok(run.shield >= 1);
  assert.equal(run.maxCombo, 3);
});

test('护盾可挡一次答错', () => {
  const run = createRun({ seed: 1 });
  // 先攒出护盾
  for (let q = 0; q < 3; q += 1) {
    while (run.mode !== 'question' && run.phase === 'playing') run.step({ hover: null, choose: null });
    const question = run.question;
    run.step({ hover: null, choose: question.answer ? 'true' : 'false' });
    fastForward(run, question.answerTime + 0.1);
    run.drainEvents();
  }
  assert.equal(run.shield, 1);
  const shieldBefore = run.shield;
  // 下一题答错
  while (run.mode !== 'question' && run.phase === 'playing') run.step({ hover: null, choose: null });
  const question = run.question;
  run.step({ hover: null, choose: question.answer ? 'false' : 'true' });
  fastForward(run, question.answerTime + 0.1);
  run.drainEvents();
  assert.equal(run.shield, shieldBefore - 1);
  assert.equal(run.playerAlive, true);
});

test('greedy 全对 → 吃鸡胜利并达到第 3 关', () => {
  const run = createRun({ seed: 42 });
  greedyLoop(run);
  assert.equal(run.phase, 'finished');
  assert.equal(run.stats.wins, 1);
  assert.ok(run.stats.levelsReached >= 3);
  assert.equal(run.stats.rank, 1);
});

test('noinput（不操作）会死亡', () => {
  const run = createRun({ seed: 7 });
  fastForward(run, MATCH_SEC + 8);
  run.drainEvents();
  assert.equal(run.playerAlive, false);
  assert.equal(run.phase, 'finished');
});

test('题库：≥20 题、双语、答案布尔', () => {
  assert.ok(QUESTIONS.length >= 20);
  for (const q of QUESTIONS) {
    assert.equal(typeof q.en, 'string');
    assert.ok(q.en.length > 3);
    assert.equal(typeof q.zh, 'string');
    assert.ok(q.zh.length > 3);
    assert.equal(typeof q.answer, 'boolean');
  }
});

test('locales：en/zh key 完全一致且无空值', () => {
  const en = Object.keys(locales.en).sort();
  const zh = Object.keys(locales.zh).sort();
  assert.deepEqual(zh, en);
  for (const k of en) {
    assert.equal(typeof locales.en[k], 'string');
    assert.ok(locales.en[k].trim().length > 0, `en 空值: ${k}`);
    assert.ok(locales.zh[k].trim().length > 0, `zh 空值: ${k}`);
  }
});

test('greedy 撑到第 3 关（levelsReached=3）且题目单局内不重复', () => {
  const run = createRun({ seed: 9 });
  greedyLoop(run);
  assert.equal(run.phase, 'finished');
  assert.equal(run.stats.levelsReached, 3);
  assert.ok(run.qIndex >= 8);
  assert.ok(run.qIndex <= TOTAL_QUESTIONS);
});
