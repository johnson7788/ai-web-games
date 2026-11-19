import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, HANDS, BEATS, COUNTER_OF, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

// 打满 count 次正确回合并结算到下一回合（用 counter，不走 qi）
function winRounds(run, count) {
  for (let i = 0; i < count; i += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    if (run.state.phase === 'playing') run.choose(COUNTER_OF[run.state.bossHand]);
    run.step(1); // 结算 settle → 下一回合
  }
}

test('冒烟：createRun → start → choose → getHud → drainEvents', () => {
  const r = createRun({ seed: 1 });
  r.start();
  const c = COUNTER_OF[r.state.bossHand];
  const res = r.choose(c);
  assert.equal(res.ok, true);
  const hud = r.getHud();
  assert.equal(hud.phase, 'settle');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：start 后 playing、round=1、怒气 1、分数 0、手牌合法', () => {
  const r = createRun({ seed: 2 });
  r.start();
  const s = r.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.round, 1);
  assert.equal(s.roundsDone, 0);
  assert.equal(s.anger, GAME.ANGER_START);
  assert.equal(s.score, 0);
  assert.equal(s.combo, 0);
  assert.equal(s.qi, 0);
  assert.ok(HANDS.includes(s.bossHand));
});

test('胜负表：石克剪、剪克布、布克石 + COUNTER_OF 互为反', () => {
  assert.equal(BEATS.rock, 'scissors');
  assert.equal(BEATS.scissors, 'paper');
  assert.equal(BEATS.paper, 'rock');
  assert.equal(COUNTER_OF.rock, 'paper');
  assert.equal(COUNTER_OF.scissors, 'rock');
  assert.equal(COUNTER_OF.paper, 'scissors');
  for (const h of HANDS) assert.equal(BEATS[COUNTER_OF[h]], h);
});

test('胜：分数+1、连击+1、怒气不涨、last.won=true', () => {
  const r = createRun({ seed: 3 });
  r.start();
  const before = r.state.anger;
  r.choose(COUNTER_OF[r.state.bossHand]);
  assert.equal(r.state.score, 1);
  assert.equal(r.state.combo, 1);
  assert.equal(r.state.anger, before);
  assert.equal(r.state.last.won, true);
  assert.equal(r.state.last.outcome, 'win');
});

test('败：怒气+1、连击清零', () => {
  const r = createRun({ seed: 4 });
  r.start();
  const wrong = HANDS.find((h) => BEATS[h] !== r.state.bossHand);
  r.choose(wrong);
  assert.equal(r.state.anger, GAME.ANGER_START + 1);
  assert.equal(r.state.combo, 0);
  assert.equal(r.state.last.won, false);
});

test('连击：两连胜 combo=2、score=2、maxCombo=2', () => {
  const r = createRun({ seed: 5 });
  r.start();
  winRounds(r, 2);
  assert.equal(r.state.combo, 2);
  assert.equal(r.state.maxCombo, 2);
  assert.equal(r.state.score, 2);
});

test('超时：倒计时走完怒气+1 并发 timeout 事件', () => {
  const r = createRun({ seed: 6 });
  r.start();
  r.drainEvents();
  advance(r, GAME.ROUND_TIME_BASE + 0.2);
  assert.equal(r.state.anger, GAME.ANGER_START + 1);
  assert.equal(r.state.combo, 0);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'timeout'));
});

test('游戏结束：连错 4 次怒气到 5 → phase=lost', () => {
  const r = createRun({ seed: 7 });
  r.start();
  for (let i = 0; i < 4; i += 1) {
    const wrong = HANDS.find((h) => BEATS[h] !== r.state.bossHand);
    r.choose(wrong);
    r.step(1);
  }
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.anger, GAME.ANGER_MAX);
  assert.equal(r.state.result.won, false);
});

test('通关：打满 TOTAL_ROUNDS 全对 → phase=won、3 星', () => {
  const r = createRun({ seed: 8 });
  r.start();
  winRounds(r, GAME.TOTAL_ROUNDS);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.equal(r.state.score, GAME.TOTAL_ROUNDS);
  assert.equal(r.state.result.stars, 3);
  assert.equal(r.state.result.rounds, GAME.TOTAL_ROUNDS);
});

test('气：5 胜攒满 → useQi 自动赢当前回合并清空气', () => {
  const r = createRun({ seed: 9 });
  r.start();
  winRounds(r, 5);
  assert.equal(r.state.qi, GAME.QI_MAX);
  const res = r.useQi();
  assert.equal(res.ok, true);
  assert.equal(r.state.qi, 0);
  assert.equal(r.state.last.outcome, 'qi');
  assert.equal(r.state.score, 6);
  assert.equal(r.state.combo, 6);
});

test('气不足：useQi 返回 noQi', () => {
  const r = createRun({ seed: 10 });
  r.start();
  assert.deepEqual(r.useQi(), { ok: false, reason: 'noQi' });
});

test('非法输入：choose 非手牌 / 非 playing 阶段', () => {
  const r = createRun({ seed: 11 });
  r.start();
  assert.deepEqual(r.choose('banana'), { ok: false, reason: 'hand' });
  const idle = createRun({ seed: 12 });
  assert.deepEqual(idle.choose('rock'), { ok: false, reason: 'phase' });
});

test('倒计时数值：score≤10=3.0；score>10 随怒气 2.5/2.0/1.5', () => {
  const r = createRun({ seed: 13 });
  r.state.score = 5;
  assert.equal(r._roundTime(), 3.0);
  r.state.score = 11;
  r.state.anger = 1;
  assert.equal(r._roundTime(), 2.5);
  r.state.anger = 3;
  assert.equal(r._roundTime(), 2.0);
  r.state.anger = 4;
  assert.equal(r._roundTime(), 1.5);
});

test('随机可复现：同 seed 两次首轮出手一致', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  a.start();
  b.start();
  assert.equal(a.state.bossHand, b.state.bossHand);
});

test('星级：败局 maxCombo≥6 → 2 星；0 分 → 0 星', () => {
  const r = createRun({ seed: 14 });
  r.start();
  r.state.score = 10;
  r.state.maxCombo = 6;
  assert.equal(r._stars(false), 2);
  r.state.score = 0;
  r.state.maxCombo = 0;
  assert.equal(r._stars(false), 0);
  r.state.score = 3;
  assert.equal(r._stars(false), 1);
});

test('mulberry32：稳定输出 [0,1)', () => {
  const rng = mulberry32(1);
  const v1 = rng();
  const v2 = rng();
  assert.ok(v1 >= 0 && v1 < 1);
  assert.ok(v2 >= 0 && v2 < 1);
  const rng2 = mulberry32(1);
  assert.equal(rng2(), v1);
});
