import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, beginStage, betMultFor } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';
import { resolveBead, bucketMult, bucketIndexToX, laneCenterX } from '../src/game/board.js';
import { DICE, BOARD, TRIPLE_BONUS, RUNES, faceToLane } from '../config/gameplay.js';
import { stageAt } from '../config/levels.js';

function advance(run, sec) {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i += 1) run.step({});
}

test('rng：同 seed 同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
});

test('faceToLane：骰面映射到 3 个入珠区', () => {
  assert.equal(faceToLane(1), 0);
  assert.equal(faceToLane(2), 0);
  assert.equal(faceToLane(3), 1);
  assert.equal(faceToLane(4), 1);
  assert.equal(faceToLane(5), 2);
  assert.equal(faceToLane(6), 2);
});

test('resolveBead：落桶在 0..6，弹跳序列长度 = 行数', () => {
  const rng = mulberry32(7);
  for (let lane = 0; lane < 3; lane += 1) {
    for (let k = 0; k < 50; k += 1) {
      const r = resolveBead(lane, rng);
      assert.ok(r.bucket >= 0 && r.bucket < BOARD.BUCKETS);
      assert.equal(r.bounces.length, BOARD.ROWS);
    }
  }
});

test('resolveBead：确定性（同 rng 状态同结果）', () => {
  const a = mulberry32(9);
  const b = mulberry32(9);
  assert.deepEqual(resolveBead(1, a), resolveBead(1, b));
});

test('bucketMult：边缘 4×，中央 1×', () => {
  assert.equal(bucketMult(0), 4);
  assert.equal(bucketMult(3), 1);
  assert.equal(bucketMult(6), 4);
});

test('betMultFor：0/1/2/3 命中 → 1/2/3/3 倍', () => {
  assert.equal(betMultFor(0), 1);
  assert.equal(betMultFor(1), 2);
  assert.equal(betMultFor(2), 3);
  assert.equal(betMultFor(3), 3);
});

test('createRun：初始状态正确（第 1 关 / 0 底分 / 满投掷）', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.stageIndex, 0);
  assert.equal(run.pot, 0);
  assert.equal(run.rollsLeft, stageAt(0).rollsMax);
  assert.equal(run.diceCount, stageAt(0).diceCount);
});

test('roll：掷出 diceCount 颗骰并消耗一次投掷', () => {
  const run = createRun({ seed: 2 });
  const before = run.rollsLeft;
  run.roll();
  assert.equal(run.lastRoll.faces.length, run.diceCount);
  assert.equal(run.rollsLeft, before - 1);
  assert.equal(run.rolling, true);
});

test('roll：lastRoll 记录 faces/beads/total', () => {
  const run = createRun({ seed: 3 });
  run.roll();
  assert.ok(Array.isArray(run.lastRoll.faces));
  assert.ok(Array.isArray(run.lastRoll.beads));
  assert.equal(run.lastRoll.beads.length, run.diceCount);
  assert.equal(typeof run.lastRoll.total, 'number');
});

test('toggleBet：加入骰位并发出 betToggle 事件', () => {
  const run = createRun({ seed: 4 });
  assert.equal(run.toggleBet(0), true);
  assert.ok(run.betSel.includes(0));
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'betToggle'));
});

test('roll：押注成本从底分扣除（lastRoll.cost）', () => {
  const run = createRun({ seed: 5 });
  beginStage(run, 1); // 第 2 关 betCost=3, diceCount=2
  run.pot = 10;
  run.setBets([0]);
  run.roll();
  assert.equal(run.lastRoll.cost, stageAt(1).betCost);
});

test('bank：达到目标收手 → 过关、分数入账、进入下一关', () => {
  const run = createRun({ seed: 6 });
  run.pot = 999;
  assert.equal(run.bank(), true);
  assert.equal(run.stageIndex, 1);
  assert.ok(run.score > 0);
  assert.equal(run.pot, 0);
});

test('stageFail：投掷用尽且未达目标 → 死亡', () => {
  const run = createRun({ seed: 7 });
  run.rollsLeft = 1;
  run.pot = 0;
  run.roll();
  advance(run, 2);
  assert.equal(run.phase, 'dead');
});

test('auto-roll：无输入自动推进（noinput 基线）', () => {
  const run = createRun({ seed: 8, autoRoll: true });
  const before = run.rollsLeft;
  advance(run, 7);
  assert.ok(run.rollsLeft < before);
});

test('rune.extraRoll：符文等级 1 → 每关 +1 投掷', () => {
  const run = createRun({ seed: 9, runeLevel: 1 });
  assert.equal(run.rollsLeft, stageAt(0).rollsMax + 1);
});

test('rune.strongStart：符文等级 6 → 每关开局 +30 底分', () => {
  const run = createRun({ seed: 10, runeLevel: 6 });
  assert.equal(run.pot, 30);
});

test('诅咒骰：第 4 关面 1 变为负点', () => {
  const run = createRun({ seed: 11 });
  beginStage(run, 3); // 第 4 关 cursed=true
  run.rng = () => 0; // 强制面 1
  run.pot = 100;
  run.roll();
  assert.equal(run.lastRoll.faces[0], 1);
  assert.equal(run.lastRoll.beads[0].faceValue, stageAt(3).cursedValue);
  assert.ok(run.lastRoll.total < 0);
});

test('三连符文：3 骰同面 → signature 奖励', () => {
  const run = createRun({ seed: 12 });
  beginStage(run, 2); // 第 3 关 diceCount=3
  run.rng = () => 0; // 强制三骰同面 1
  run.pot = 100;
  run.roll();
  assert.equal(run.lastRoll.triple, true);
  assert.equal(run.lastRoll.tripleBonus, TRIPLE_BONUS);
  assert.equal(run.stats.triples, 1);
});

test('几何：桶 x 单调递增且落在板内', () => {
  let prev = -Infinity;
  for (let b = 0; b < BOARD.BUCKETS; b += 1) {
    const x = bucketIndexToX(b);
    assert.ok(x > prev);
    assert.ok(x >= BOARD.BOARD_LEFT && x <= BOARD.BOARD_RIGHT);
    prev = x;
  }
});

test('几何：3 个入珠区 x 互不相同', () => {
  const xs = [0, 1, 2].map((l) => laneCenterX(l));
  assert.equal(new Set(xs).size, 3);
});
