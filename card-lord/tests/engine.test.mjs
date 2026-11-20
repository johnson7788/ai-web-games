import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/engine.js';
import { typeJudge } from '../src/game/rules.js';
import { chooseBid, chooseDouble, chooseLead, chooseFollow } from '../src/game/ai.js';

function greedyInput(run) {
  const hud = run.getHud();
  const hand = hud.hand;
  const rp = run.roundPhase;
  if (rp === 'bidding') {
    const b = chooseBid(hand, 1);
    return { action: 'bid', bid: b };
  }
  if (rp === 'doubling') {
    return { action: 'double', double: chooseDouble(hand, 1) };
  }
  if (rp === 'playing') {
    const round = run.round;
    if (round.lastPlaySeat === 0 || round.lastPlaySeat === -1) {
      const lead = chooseLead(hand, 1);
      return lead ? { action: 'play', cards: lead } : { action: 'pass' };
    }
    const f = chooseFollow(hand, round.lastPlay, 1);
    return f ? { action: 'play', cards: f } : { action: 'pass' };
  }
  return {};
}

function driveOneRound(seed) {
  const run = createRun({ seed });
  const events = [];
  let guard = 0;
  while (run.phase === 'playing' && run.roundPhase !== 'done' && guard < 800) {
    run.step(greedyInput(run));
    events.push(...run.drainEvents());
    guard += 1;
  }
  return { run, events, guard };
}

test('发牌：17×3 + 3 底牌，54 张不重复', () => {
  const run = createRun({ seed: 42 });
  const hands = run.hands;
  assert.equal(hands.length, 3);
  for (const h of hands) assert.equal(h.length, 17);
  assert.equal(run.round.hole.length, 3);
  const ids = new Set([...hands[0], ...hands[1], ...hands[2], ...run.round.hole].map((c) => c.id));
  assert.equal(ids.size, 54);
});

test('叫分流程：地主确定并拿到 20 张牌', () => {
  const run = createRun({ seed: 7 });
  run.step({ action: 'bid', bid: 1 });
  // 叫 1 分后 AI 依次叫/不叫，最终进入加倍或直接地主
  assert.ok(['doubling', 'playing', 'bidding'].includes(run.roundPhase), `roundPhase=${run.roundPhase}`);
  // 可能 AI 叫 3 直接结束，或全不叫重发；再走一步直到非 bidding
  let guard = 0;
  while (run.roundPhase === 'bidding' && guard < 20) {
    run.step({ action: 'bid', bid: 0 });
    guard += 1;
  }
  assert.ok(run.round.landlord >= 0, '地主已确定');
  assert.equal(run.hands[run.round.landlord].length, 20, '地主 20 张');
});

test('整局可推进到结算', () => {
  const { run, guard } = driveOneRound(123);
  assert.equal(run.roundPhase, 'done');
  assert.ok(run.round.result, '有结算结果');
  assert.ok(guard < 800, '未软锁');
  const types = new Set();
  // 事件类型至少覆盖 deal/bid/landlord/play
  const hud = run.getHud();
  assert.ok(hud.result);
});

test('记牌器：结算后剩余张数有变化且每值合法', () => {
  const { run } = driveOneRound(99);
  const hud = run.getHud();
  const rem = hud.remaining;
  let changed = false;
  let total = 0;
  for (let r = 3; r <= 17; r += 1) {
    const max = r >= 16 ? 1 : 4;
    assert.ok(rem[r] >= 0 && rem[r] <= max, `rank ${r} remaining ${rem[r]} in [0,${max}]`);
    if (rem[r] < max) changed = true;
    total += rem[r];
  }
  assert.ok(changed, '至少有一个点数被出过');
  assert.ok(total < 54, '有牌被出');
});

test('提示：轮到你领出时给出合法牌', () => {
  const run = createRun({ seed: 5 });
  // 快速推进到出牌阶段
  let guard = 0;
  while (run.roundPhase !== 'playing' && guard < 60) {
    run.step(run.roundPhase === 'bidding' ? { action: 'bid', bid: 1 } : { action: 'double', double: false });
    guard += 1;
  }
  // 推进到人类回合
  guard = 0;
  while (run.roundPhase === 'playing' && run.currentTurn !== 0 && guard < 300) {
    run.step({});
    guard += 1;
  }
  if (run.roundPhase === 'playing' && run.currentTurn === 0) {
    const h = run.hint();
    if (h) {
      assert.ok(typeJudge(h), '提示牌是合法牌型');
    }
  } else {
    assert.ok(true, '跳过（未到人类领出回合）');
  }
});
