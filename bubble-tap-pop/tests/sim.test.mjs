import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  COLORS,
  starRating,
  levelForScore,
  gainForCombo,
  roundTtlFor,
} from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

function correctBubble(run) {
  return run.state.bubbles.find((b) => b.kind === 'bubble' && b.color === run.state.target);
}
function wrongBubble(run) {
  return run.state.bubbles.find((b) => b.kind === 'bubble' && b.color !== run.state.target);
}
function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → tap → getHud → drainEvents 无异常', () => {
  const r = createRun({ seed: 1 });
  r.step(1 / 60);
  const b = correctBubble(r);
  const res = r.tap(b.id);
  assert.equal(res.ok, true);
  const hud = r.getHud();
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('初始状态：phase=playing、3 命、0 分、5 个泡泡', () => {
  const r = createRun({ seed: 2 });
  const s = r.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.lives, 3);
  assert.equal(s.score, 0);
  assert.equal(s.bubbles.length, 5);
  assert.ok(COLORS.includes(s.target));
});

test('每轮 5 个泡泡：一个颜色一个，且泡泡上的文字 ≠ 自身颜色（斯特鲁普）', () => {
  const r = createRun({ seed: 3 });
  const colors = r.state.bubbles.map((b) => b.color).sort();
  assert.deepEqual(colors, [...COLORS].sort());
  for (const b of r.state.bubbles) {
    assert.notEqual(b.label, b.color, '泡泡文字应是干扰色');
  }
});

test('点对：得分 +1、连击 +1、生成新一轮', () => {
  const r = createRun({ seed: 4 });
  const prevRound = r.state.round;
  const res = r.tap(correctBubble(r).id);
  assert.equal(res.ok, true);
  assert.ok(res.gain >= 1);
  assert.equal(r.state.score, 1);
  assert.equal(r.state.combo, 1);
  assert.equal(r.state.round, prevRound + 1);
});

test('点错：扣 1 命、连击清零', () => {
  const r = createRun({ seed: 5 });
  r.tap(correctBubble(r).id);
  assert.equal(r.state.combo, 1);
  r.tap(wrongBubble(r).id);
  assert.equal(r.state.lives, 2);
  assert.equal(r.state.combo, 0);
});

test('连击得分上限为 MAX_GAIN', () => {
  const r = createRun({ seed: 6 });
  r.state.combo = 99;
  const b = correctBubble(r);
  const res = r.tap(b.id);
  assert.equal(res.gain, GAME.MAX_GAIN);
  assert.equal(gainForCombo(999), GAME.MAX_GAIN);
});

test('超时：ROUND_TTL 内不操作会扣命', () => {
  const r = createRun({ seed: 7 });
  advance(r, GAME.ROUND_TTL + 0.1);
  assert.equal(r.state.lives, 2);
  assert.equal(r.state.combo, 0);
});

test('三条命耗尽 → phase=over 且给出星级', () => {
  const r = createRun({ seed: 8 });
  advance(r, (GAME.ROUND_TTL + 0.2) * 4);
  assert.equal(r.state.phase, 'over');
  assert.ok([0, 1, 2, 3].includes(r.state.stars));
  assert.ok(r.state.result);
});

test('岩石陷阱：score≥ROCK_UNLOCK_SCORE 且 round%3==0 时出现，点它扣命断连击', () => {
  const r = createRun({ seed: 9 });
  // 连续点对 8 次 → score=8 → level=2 → 下一轮(round 9)出现岩石
  for (let i = 0; i < 8; i += 1) {
    const b = correctBubble(r);
    if (!b) break;
    r.tap(b.id);
  }
  assert.ok(r.state.score >= GAME.ROCK_UNLOCK_SCORE);
  assert.ok(r.state.level >= 2);
  const rock = r.state.bubbles.find((b) => b.kind === 'rock');
  assert.ok(rock, '应出现岩石泡泡');
  const livesBefore = r.state.lives;
  r.state.combo = 5;
  r.tap(rock.id);
  assert.equal(r.state.lives, livesBefore - 1);
  assert.equal(r.state.combo, 0);
});

test('等级随分数提升：level = 1 + floor(score/LEVEL_EVERY)', () => {
  assert.equal(levelForScore(0), 1);
  assert.equal(levelForScore(7), 1);
  assert.equal(levelForScore(8), 2);
  assert.equal(levelForScore(16), 3);
});

test('星级阈值：0/1/2/3 星分界正确', () => {
  assert.equal(starRating(0), 0);
  assert.equal(starRating(4), 0);
  assert.equal(starRating(5), 1);
  assert.equal(starRating(15), 2);
  assert.equal(starRating(30), 3);
});

test('等级越高每轮时限越短，且不低于下限', () => {
  assert.equal(roundTtlFor(1), GAME.ROUND_TTL);
  assert.ok(roundTtlFor(3) < GAME.ROUND_TTL);
  assert.ok(roundTtlFor(99) >= GAME.MIN_ROUND_TTL);
});

test('drainEvents 返回数组并清空', () => {
  const r = createRun({ seed: 10 });
  const first = r.drainEvents();
  assert.ok(Array.isArray(first));
  assert.ok(first.length > 0);
  assert.equal(r.drainEvents().length, 0);
});
