// MAHJONG ROOM · sim 逻辑测试（node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, isWinning, bestDiscard, tileUtility, toCounts, tSuit, tRank,
} from '../src/game/sim.js';

test('tSuit/tRank 映射正确', () => {
  assert.equal(tSuit(0), 0); assert.equal(tRank(0), 1);   // 1万
  assert.equal(tSuit(8), 0); assert.equal(tRank(8), 9);   // 9万
  assert.equal(tSuit(9), 1); assert.equal(tRank(9), 1);   // 1条
  assert.equal(tSuit(26), 2); assert.equal(tRank(26), 9); // 9筒
  assert.equal(tSuit(27), 3); assert.equal(tRank(27), 1); // 东
  assert.equal(tSuit(33), 3); assert.equal(tRank(33), 7); // 白
});

test('isWinning：标准 4 面子 + 1 对（无刻杠）', () => {
  // 123万 456万 789万 123条 + 55筒
  const hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22, 22];
  assert.equal(isWinning(hand, []), true);
});

test('isWinning：碰牌面子后仍能胡', () => {
  // 已碰 1万（3张），手牌 123条 456条 + 55筒 + 789筒（11 张 = 3 面子 + 1 对）
  const hand = [9, 10, 11, 12, 13, 14, 22, 22, 24, 25, 26];
  assert.equal(isWinning(hand, [{ kind: 'peng', t: 0 }]), true);
});

test('isWinning：不胡的例子（差一张）', () => {
  const hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22, 23];
  assert.equal(isWinning(hand, []), false);
});

test('isWinning：字牌不能组成顺子', () => {
  // 东东东 南南南 西西西 北北北 + 中中 —— 字牌全刻子 + 对，可胡
  const hand = [27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30, 30, 31, 31];
  assert.equal(isWinning(hand, []), true);
  // 东东南 (27,27,28) 试图组成顺子是不行的 —— 东东南 + 3组刻 + 对也不成立
  const bad = [27, 27, 28, 29, 29, 29, 30, 30, 30, 31, 31, 31, 32, 32];
  assert.equal(isWinning(bad, []), false);
});

test('isWinning：暗杠后补牌可胡（杠计一个面子）', () => {
  // 杠 1万（4张，hidden），手牌 123条 456条 789筒 + 55筒（11 张 = 3 面子 + 1 对）
  const hand = [9, 10, 11, 12, 13, 14, 24, 25, 26, 22, 22];
  assert.equal(isWinning(hand, [{ kind: 'gang', t: 0, hidden: true }]), true);
});

test('toCounts 正确统计', () => {
  const c = toCounts([0, 0, 0, 0, 5]);
  assert.equal(c[0], 4);
  assert.equal(c[5], 1);
  assert.equal(c[1], 0);
});

test('tileUtility：孤张字牌价值最低，刻子最高', () => {
  assert.equal(tileUtility(27, toCounts([27])), 2);
  assert.equal(tileUtility(0, toCounts([0, 0, 0])), 12);
  const withPair = tileUtility(0, toCounts([0, 0]));
  assert.equal(withPair, 7);
});

test('bestDiscard：优先打孤张字牌', () => {
  // 一手牌带一个孤张东，bestDiscard 应打东（t=27）
  const hand = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 5, 6, 7];
  assert.equal(bestDiscard(hand), 27);
});

test('createRun：初始 13+1 张，庄家先出牌，状态合法', () => {
  const run = createRun({ seed: 42 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.round, 1);
  assert.equal(run.state.hands[0].length, 14); // 庄家摸 14
  assert.equal(run.state.hands[1].length, 13);
  assert.equal(run.state.wall.length, 136);
});

test('createRun：跑完一整局不抛异常，进入 won/lost', () => {
  const run = createRun({ seed: 7 });
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 200000) {
    guard += 1;
    if (run.state.decider === 0) {
      const hu = run.state.options.find((o) => o.kind === 'hu');
      if (hu) { run.act({ kind: 'hu' }); continue; }
      const ag = run.state.options.find((o) => o.kind === 'angang');
      if (ag) { run.act({ kind: 'angang', t: ag.t }); continue; }
      const peng = run.state.options.find((o) => o.kind === 'peng');
      if (peng) { run.act({ kind: 'peng' }); continue; }
      const mg = run.state.options.find((o) => o.kind === 'minggang');
      if (mg) { run.act({ kind: 'minggang' }); continue; }
      const d = run.state.options.find((o) => o.kind === 'discard');
      if (d) { run.act({ kind: 'discard', t: d.t }); continue; }
      run.act({ kind: 'pass' });
    } else {
      run.step(1 / 60);
    }
  }
  assert.ok(run.state.phase === 'won' || run.state.phase === 'lost');
  assert.equal(run.state.round, 3);
});

test('createRun：noinput 超时自动出牌也能终局', () => {
  const run = createRun({ seed: 9 });
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 400000) {
    run.step(1 / 60);
    guard += 1;
  }
  assert.ok(run.state.phase === 'won' || run.state.phase === 'lost');
});

test('lucky：能量满 3 才可换牌', () => {
  const run = createRun({ seed: 11 });
  // 能量初始为 0，不能换
  const r = run.lucky();
  assert.equal(r.ok, false);
});
