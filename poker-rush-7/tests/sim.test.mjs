import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, createSim, mulberry32, SUITS, RANKS, COLORS } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

function advance(run, seconds) {
  for (let i = 0; i < seconds; i += 1) run.step(1);
}

function toPlaying(run) {
  advance(run, 5); // countdown 1.5 + reveal 2.6 → playing
}

test('关卡数据完整：20 关，速度/目标率单调递增', () => {
  assert.equal(LEVEL_COUNT, 20);
  for (let i = 1; i < LEVEL_COUNT; i += 1) {
    assert.ok(LEVELS[i].speed >= LEVELS[i - 1].speed);
    assert.ok(LEVELS[i].targetRate >= LEVELS[i - 1].targetRate);
  }
});

test('初始状态：倒计时阶段，4 泳道 × 5 张卡', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'countdown');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.cards.length, GAME.LANE_COUNT * GAME.INITIAL_PER_LANE);
});

test('阶段机：countdown → reveal → playing', () => {
  const run = createRun(0, { seed: 2 });
  advance(run, 2);
  assert.equal(run.state.phase, 'reveal');
  advance(run, 3);
  assert.equal(run.state.phase, 'playing');
});

test('目标卡点中：连击 + 分数增加', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  const target = run.state.cards.find((c) => c.ok && !c.rock);
  assert.ok(target, '应存在目标卡');
  const res = run.tap(target.id);
  assert.equal(res.ok, true);
  assert.equal(res.correct, true);
  assert.equal(run.state.combo, 1);
  assert.ok(run.state.score > 0);
});

test('重复点同一张卡：返回 used 无效', () => {
  const run = createRun(0, { seed: 4 });
  toPlaying(run);
  const target = run.state.cards.find((c) => c.ok && !c.rock);
  run.tap(target.id);
  const again = run.tap(target.id);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'used');
});

test('点干扰卡：记错误，L1 容错 0 直接判负', () => {
  const run = createRun(0, { seed: 5 });
  toPlaying(run);
  const disturb = run.state.cards.find((c) => !c.ok && !c.rock);
  assert.ok(disturb, '应存在干扰卡');
  const res = run.tap(disturb.id);
  assert.equal(res.ok, true);
  assert.equal(res.correct, false);
  assert.equal(run.state.phase, 'lost'); // L1 canErrorCount=0
});

test('漏接检测：目标卡滚出屏幕累计 missCount', () => {
  const run = createRun(0, { seed: 6 });
  toPlaying(run);
  const target = run.state.cards.find((c) => c.ok && !c.use);
  const before = run.state.missCount;
  target.x = 999999; // 移出屏幕（方向 right）
  run.step(1 / 60);
  assert.equal(run.state.missCount, before + 1);
});

test('漏接超限：判负 lose/miss', () => {
  const run = createRun(0, { seed: 7 });
  toPlaying(run);
  run.state.missCount = run.state.canMissCount; // 顶到上限
  const target = run.state.cards.find((c) => c.ok && !c.use);
  target.x = 999999;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'miss');
});

test('时间走完：过关胜利，至少 1 星', () => {
  const run = createRun(0, { seed: 8 });
  toPlaying(run);
  run.state.timeLeft = 0.01;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1);
  assert.equal(run.state.result.won, true);
});

test('三星判定：高连击 + 0 漏接 → 3 星', () => {
  const run = createRun(0, { seed: 9 });
  toPlaying(run);
  run.state.maxCombo = GAME.STAR_COMBO_3;
  run.state.missCount = 0;
  run.state.timeLeft = 0.01;
  run.step(1 / 60);
  assert.equal(run.state.stars, 3);
});

test('确定性：同 seed 产生相同目标', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  assert.deepEqual(a.state.target, b.state.target);
  assert.deepEqual(a.state.cards.map((c) => c.ok), b.state.cards.map((c) => c.ok));
});

test('岩石卡：L3 起出现，点击记错误', () => {
  const run = createRun(2, { seed: 10 }); // 第 3 关（index 2）
  assert.ok(run._level.rockRate > 0);
  toPlaying(run);
  const rock = run.state.cards.find((c) => c.rock);
  if (rock) {
    const res = run.tap(rock.id);
    assert.equal(res.rock, true);
    assert.equal(res.correct, false);
  }
});

test('RNG / 花色点数颜色数据完整', () => {
  assert.equal(SUITS.length, 4);
  assert.equal(RANKS.length, 13);
  assert.equal(COLORS.length, 7);
  const rng = mulberry32(1);
  assert.ok(rng() >= 0 && rng() < 1);
});

test('createSim 别名：返回可 step 的 run', () => {
  const sim = createSim();
  assert.equal(typeof sim.step, 'function');
  assert.equal(sim.state.phase, 'countdown');
});
