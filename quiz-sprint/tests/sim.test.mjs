import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { STAMINA, PLAYER } from '../config/gameplay.js';
import { LEVEL_COUNT } from '../config/levels.js';

function drainTypes(run) {
  return run.drainEvents().map((e) => e.type);
}

// 强制在下一 tick 出题
function presentNext(run) {
  run.nextQuestionAt = run.race.time;
  run.step({});
}

function answerCorrect(run) {
  run.nextQuestionAt = run.race.time;
  run.step({});
  const ans = run.question.answerIndex;
  run.step({ choose: ans });
}

// ---------- 契约 / 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.stamina, STAMINA.MAX);
  assert.equal(run.combo, 0);
  assert.equal(run.level, 1);
  assert.equal(run.stats.levelsReached, 1);
  assert.equal(run.playerDist, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'raceStart'), '创建即发 raceStart');
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  for (const key of ['phase', 'level', 'stamina', 'staminaMax', 'combo', 'rank', 'distance', 'raceDistance', 'question', 'wins', 'losses']) {
    assert.ok(key in hud, `缺少 ${key}`);
  }
  assert.equal(hud.staminaMax, STAMINA.MAX);
  assert.equal(hud.rank, 1);
});

test('同 seed 同输入 → 同结果（随机种子确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  for (let i = 0; i < 30; i += 1) {
    a.step({ hover: i % 4, choose: null });
    b.step({ hover: i % 4, choose: null });
  }
  assert.equal(a.playerDist, b.playerDist);
  assert.equal(a.combo, b.combo);
  assert.equal(a.ai[0].dist, b.ai[0].dist);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

// ---------- 出题 / 作答 ----------
test('开局第一 tick 即出题', () => {
  const run = createRun({ seed: 3 });
  run.step({});
  assert.ok(run.question, '应已出题');
  assert.equal(run.question.qIndex, 0);
  assert.equal(typeof run.question.answerIndex, 'number');
});

test('答对：冲刺前进 + 体力回 + 连击 +1', () => {
  const run = createRun({ seed: 4 });
  run.step({});
  run.playerDist = 10;
  run.stamina = 50;
  const ans = run.question.answerIndex;
  run.step({ choose: ans });
  assert.ok(run.playerDist > 10, '答对应前进');
  assert.equal(run.combo, 1);
  assert.ok(Math.abs(run.stamina - (50 + STAMINA.GAIN_CORRECT)) < 0.5, `stamina=${run.stamina}`);
  assert.ok(drainTypes(run).includes('answerCorrect'));
});

test('答错：后退 + 掉体力 + 连击清零', () => {
  const run = createRun({ seed: 5 });
  run.step({});
  run.playerDist = 10;
  run.stamina = 80;
  const wrong = (run.question.answerIndex + 1) % 4;
  run.step({ choose: wrong });
  assert.ok(run.playerDist < 10, '答错应后退');
  assert.equal(run.combo, 0);
  assert.ok(run.stamina < 80, '答错应掉体力');
  assert.ok(drainTypes(run).includes('answerWrong'));
});

test('超时按答错处理（answerWrong.timeout）', () => {
  const run = createRun({ seed: 6 });
  run.step({});
  run.question.timer = 0.01;
  run.step({});
  const evs = run.drainEvents();
  const wrong = evs.find((e) => e.type === 'answerWrong');
  assert.ok(wrong && wrong.timeout === true);
});

// ---------- 连击 / 学霸冲刺 ----------
test('连对 2 题建立连击（comboUp.combo=2）', () => {
  const run = createRun({ seed: 7, startLevel: 8 });
  answerCorrect(run);
  answerCorrect(run);
  assert.equal(run.combo, 2);
  const ups = run.drainEvents().filter((e) => e.type === 'comboUp');
  assert.equal(ups.length, 2);
  assert.equal(ups[1].combo, 2);
});

test('5 连对触发学霸冲刺（scholarSprint.on）', () => {
  const run = createRun({ seed: 8, startLevel: 8 });
  for (let i = 0; i < 5; i += 1) answerCorrect(run);
  assert.equal(run.combo, 5);
  assert.equal(run.scholarActive, true);
  assert.ok(run.drainEvents().some((e) => e.type === 'scholarSprint' && e.on === true));
});

test('答错打断学霸冲刺（scholarSprint.off + comboBreak）', () => {
  const run = createRun({ seed: 9, startLevel: 8 });
  for (let i = 0; i < 5; i += 1) answerCorrect(run);
  run.nextQuestionAt = run.race.time;
  run.step({});
  const wrong = (run.question.answerIndex + 1) % 4;
  run.step({ choose: wrong });
  assert.equal(run.scholarActive, false);
  assert.equal(run.combo, 0);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'scholarSprint' && e.on === false));
  assert.ok(evs.some((e) => e.type === 'comboBreak'));
});

// ---------- 体力 ----------
test('体力空进入 exhausted 状态', () => {
  const run = createRun({ seed: 10 });
  run.step({});
  run.stamina = 5;
  const wrong = (run.question.answerIndex + 1) % 4;
  run.step({ choose: wrong }); // 掉体力到 0
  assert.equal(run.exhausted, true);
  assert.ok(run.drainEvents().some((e) => e.type === 'exhausted' && e.on === true));
});

// ---------- 赌注题 ----------
test('第 4 题为赌注题（wager=true）且可跳过', () => {
  const run = createRun({ seed: 11, startLevel: 12 });
  for (let i = 0; i < 3; i += 1) answerCorrect(run);
  run.nextQuestionAt = run.race.time;
  run.step({});
  assert.equal(run.question.wager, true);
  run.stamina = 50;
  run.step({ choose: 'skip' });
  assert.ok(Math.abs(run.stamina - (50 + STAMINA.SKIP)) < 0.5, `stamina=${run.stamina}`);
  assert.ok(run.drainEvents().some((e) => e.type === 'wagerSkip'));
});

test('赌注题答对双倍回体力与双倍前进', () => {
  const run = createRun({ seed: 12, startLevel: 12 });
  for (let i = 0; i < 3; i += 1) answerCorrect(run);
  run.nextQuestionAt = run.race.time;
  run.step({});
  assert.equal(run.question.wager, true);
  run.stamina = 40;
  run.playerDist = 20;
  const ans = run.question.answerIndex;
  run.step({ choose: ans });
  assert.ok(Math.abs(run.stamina - (40 + STAMINA.GAIN_WAGER)) < 0.5, `stamina=${run.stamina}`);
  assert.ok(run.playerDist > 20 + PLAYER.SURGE_DIST, '双倍前进');
});

// ---------- 赛段 / 推进 ----------
test('冲过终点 → raceFinish 名次 1 并推进关卡', () => {
  const run = createRun({ seed: 13, startLevel: 1 });
  run.playerDist = run.race.distance;
  run.step({});
  const evs = run.drainEvents();
  const fin = evs.find((e) => e.type === 'raceFinish');
  assert.ok(fin, '应结束赛段');
  assert.equal(fin.rank, 1);
  assert.equal(fin.won, true);
  assert.equal(run.level, 2);
  assert.equal(run.stats.levelsReached, 2);
});

test('落后 AI → raceFinish 名次 >1（败）', () => {
  const run = createRun({ seed: 14, startLevel: 1 });
  run.ai[0].dist = 999;
  run.ai[1].dist = 999;
  run.ai[2].dist = 999;
  run.race.time = run.race.maxTimeSec;
  run.step({});
  const evs = run.drainEvents();
  const fin = evs.find((e) => e.type === 'raceFinish');
  assert.ok(fin);
  assert.equal(fin.rank, 4);
  assert.equal(fin.won, false);
  assert.equal(run.stats.losses, 1);
});

test('跑完 12 赛 → marathonEnd + phase finished', () => {
  const run = createRun({ seed: 15, startLevel: 12 });
  for (let i = 0; i < 6; i += 1) answerCorrect(run);
  assert.equal(run.phase, 'finished');
  assert.ok(run.drainEvents().some((e) => e.type === 'marathonEnd'));
});

test('AI 随时间前进', () => {
  const run = createRun({ seed: 16 });
  const before = run.ai[0].dist;
  for (let i = 0; i < 60; i += 1) run.step({});
  assert.ok(run.ai[0].dist > before);
});

test('事件密度：1 秒内至少有一个事件（timerTick/distanceMilestone）', () => {
  const run = createRun({ seed: 17 });
  run.step({});
  run.drainEvents();
  let saw = false;
  for (let i = 0; i < 60; i += 1) {
    run.step({});
    if (run.drainEvents().length > 0) { saw = true; break; }
  }
  assert.equal(saw, true, '1 秒内应有可感知事件');
});
