import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shanten, canWinStandard, canWinTriplets, winPattern, computeFan, fanScore, isSevenPairs, tingList, countOf } from '../src/game/hand.js';
import { createRun, step, drainEvents, greedyDecide } from '../src/game/sim.js';
import { TOTAL_TILES, SEATS, ABILITY } from '../config/rules.js';

function count(arr) {
  const c = new Int8Array(30);
  for (const t of arr) c[t] += 1;
  return c;
}

// ---------- 向听数 ----------

test('向听：一手 3 副 + 1 搭 = 1', () => {
  const c = count([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 27, 28]);
  assert.equal(shanten(c, 0), 1);
});

test('向听：听牌（3 副 + 1 对 + 1 搭） = 0', () => {
  const c = count([0, 0, 0, 1, 1, 1, 2, 2, 2, 4, 4, 6, 7]);
  assert.equal(shanten(c, 0), 0);
});

test('向听：已胡（4 副 + 1 对） = -1', () => {
  const c = count([0, 0, 0, 1, 1, 1, 2, 2, 2, 4, 4, 6, 7, 8]);
  assert.equal(shanten(c, 0), -1);
});

// ---------- 胡牌判定 ----------

test('胡牌：标准 4 副 + 1 对', () => {
  const c = count([0, 0, 0, 1, 1, 1, 2, 2, 2, 4, 4, 6, 7, 8]);
  assert.equal(canWinStandard(c, 0), true);
  assert.equal(winPattern(c, 0), 'normal');
});

test('胡牌：七对', () => {
  const c = count([0, 0, 3, 3, 6, 6, 9, 9, 12, 12, 15, 15, 27, 27]);
  assert.equal(isSevenPairs(c), true);
  assert.equal(winPattern(c, 0), '7pairs');
});

test('胡牌：对对胡（全刻子）', () => {
  const c = count([0, 0, 0, 3, 3, 3, 6, 6, 6, 9, 9, 9, 27, 27]);
  assert.equal(canWinTriplets(c, 0), true);
  assert.equal(winPattern(c, 0), 'duidui');
});

test('胡牌：三元不能组成顺子', () => {
  const c = count([27, 28, 29, 0, 1, 2, 9, 9, 9, 12, 13, 14, 3, 3]);
  assert.equal(canWinStandard(c, 0), false);
});

test('听牌列表：找出所有等张', () => {
  const holds = [0, 0, 0, 1, 1, 1, 2, 2, 2, 4, 4, 6, 7];
  const waits = tingList(holds, 0);
  assert.ok(waits.includes(5) && waits.includes(8), '等 5/8');
});

// ---------- 番数 ----------

test('番数：卡五星 +1 番', () => {
  // 3-4-5 顺子（win tile=4 为五星），其余刻子 + 对
  const c = count([3, 4, 5, 6, 6, 6, 9, 9, 9, 12, 12, 12, 27, 27]);
  const fan = computeFan({ countWithWin: c, winTile: 4, pattern: 'normal', meldTiles: [], pengs: [], holdsLen: 14, type: 'xykwx' });
  assert.equal(fan, 1);
});

test('番数：清一色 + 对对胡 = 3 番', () => {
  const c = count([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 8, 8]);
  const fan = computeFan({ countWithWin: c, winTile: 8, pattern: 'duidui', meldTiles: [], pengs: [], holdsLen: 14, type: 'xykwx' });
  assert.equal(fan, 3);
});

test('番数：七对基础 2 番', () => {
  const c = count([0, 0, 3, 3, 6, 6, 9, 9, 12, 12, 15, 15, 27, 27]);
  const fan = computeFan({ countWithWin: c, winTile: 27, pattern: '7pairs', meldTiles: [], pengs: [], holdsLen: 14, type: 'xykwx' });
  assert.equal(fan, 2);
});

test('番数：封顶 MAX_FAN', () => {
  const fan = computeFan({ countWithWin: count([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4]), winTile: 4, pattern: 'duidui', meldTiles: [], pengs: [], holdsLen: 14, type: 'sykwx', gangBonus: true, isHaiDi: true });
  assert.ok(fan <= 8);
});

test('分数：2^fan × 底注', () => {
  assert.equal(fanScore(0, 2), 2);
  assert.equal(fanScore(3, 2), 16);
  assert.equal(fanScore(5, 1), 32);
});

// ---------- 牌局流程 ----------

test('发牌：庄家 14 张，闲家 13 张，牌墙 84 张', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.seats[0].holds.length, 14);
  assert.equal(run.seats[1].holds.length, 13);
  assert.equal(run.seats[2].holds.length, 13);
  assert.equal(run.wall.length, TOTAL_TILES);
});

test('观星：看牌堆顶 3 张并扣次数', () => {
  const run = createRun({ seed: 7 });
  let turns = 0;
  while (!(run.pending?.kind === 'turnStart' && run.pending.seat === 0) && turns < 5000) {
    step(run, null);
    turns += 1;
  }
  assert.equal(run.pending?.kind, 'turnStart');
  const before = run.stargazeLeft;
  step(run, { action: 'stargaze' });
  assert.equal(run.stargazeLeft, before - 1);
  assert.equal(run.peeks.length, ABILITY.stargazePeek);
});

test('换星：弃 1 换 1 后仍进入摸牌', () => {
  const run = createRun({ seed: 11 });
  let turns = 0;
  while (!(run.pending?.kind === 'turnStart' && run.pending.seat === 0) && turns < 5000) {
    step(run, null);
    turns += 1;
  }
  const holdsBefore = run.seats[0].holds.length;
  const foldsBefore = run.seats[0].folds.length;
  const tile = run.seats[0].holds[0];
  step(run, { action: 'swap', tile });
  assert.equal(run.seats[0].folds.length, foldsBefore + 1);
  assert.equal(run.swapLeft, ABILITY.swap - 1);
  // 弃 1 后摸 1，随后进入正常摸牌 → 弃牌决策
  assert.ok(holdsBefore === run.seats[0].holds.length || run.pending?.kind === 'discard');
});

test('greedy：12 局打满，胜+负+荒庄=12', () => {
  const run = createRun({ seed: 123 });
  let ticks = 0;
  while (run.phase === 'playing' && ticks < 40000) {
    if (run.pending?.seat === 0) step(run, greedyDecide(run, run.pending));
    else step(run, null);
    ticks += 1;
  }
  assert.equal(run.phase, 'sessionEnd');
  assert.equal(run.stats.roundsWon + run.stats.roundsLost + run.stats.roundsDrawn, 12);
});

test('noinput：不操作也会自动推进（不会卡死）', () => {
  const run = createRun({ seed: 789 });
  let ticks = 0;
  while (run.round < 2 && run.phase === 'playing' && ticks < 5000) {
    step(run, null);
    ticks += 1;
  }
  assert.equal(run.round, 2);
});

test('事件：胡牌/弃牌/摸牌事件会被 drain 清空', () => {
  const run = createRun({ seed: 123 });
  let ticks = 0;
  let sawDraw = false;
  while (ticks < 100 && !sawDraw) {
    if (run.pending?.seat === 0) step(run, greedyDecide(run, run.pending));
    else step(run, null);
    const ev = drainEvents(run);
    if (ev.some((e) => e.type === 'draw')) sawDraw = true;
    ticks += 1;
  }
  assert.equal(sawDraw, true);
});

test('计数：countOf 与 tiles 计数一致', () => {
  const c = countOf([0, 0, 5, 27, 27, 27]);
  assert.equal(c[0], 2);
  assert.equal(c[5], 1);
  assert.equal(c[27], 3);
});
