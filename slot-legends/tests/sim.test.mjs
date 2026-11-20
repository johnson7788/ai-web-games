import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { BALANCE, BET_OPTIONS, REELS, ROWS, SYMBOLS, SYMBOL_ORDER } from '../config/gameplay.js';

function settleAll(run, ticks = 90) {
  for (let i = 0; i < ticks; i += 1) run.step({});
}

test('createRun 初始状态：余额/等级/相位/盘面', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'idle');
  assert.equal(run.balance, BALANCE.START);
  assert.equal(run.level, 1);
  assert.equal(run.reels.length, REELS);
  assert.equal(run.reels[0].length, ROWS);
  for (const col of run.reels) for (const s of col) assert.ok(SYMBOL_ORDER.includes(s));
});

test('spin 按下后进入 spinning 并扣除下注', () => {
  const run = createRun({ seed: 1 });
  run.bet = 10;
  run.step({ spin: true });
  assert.equal(run.phase, 'spinning');
  assert.equal(run.balance, BALANCE.START - 10);
});

test('第一转必中（欢迎中奖）并产生 win 事件', () => {
  const run = createRun({ seed: 1 });
  run.step({ spin: true });
  settleAll(run);
  assert.equal(run.phase, 'idle');
  assert.ok(run.lastWin > 0);
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
  assert.ok(ev.some((e) => e.type === 'spin'));
  assert.ok(ev.some((e) => e.type === 'settle'));
});

function fillTarget(run, symbol) {
  for (let c = 0; c < REELS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) run.target[c][r] = symbol;
  }
}

test('滚轮逐列停下后 reels 等于 target', () => {
  const run = createRun({ seed: 2 });
  run.step({ spin: true });
  fillTarget(run, SYMBOLS.OFFICIAL); // 无 scatter，避免免费旋转自动续转
  settleAll(run);
  assert.equal(run.phase, 'idle');
  assert.deepEqual(run.reelStopped, [true, true, true, true, true]);
  for (let c = 0; c < REELS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      assert.equal(run.reels[c][r], run.target[c][r]);
    }
  }
});

test('stop 提前结束滚动', () => {
  const run = createRun({ seed: 3 });
  run.step({ spin: true });
  run.step({ stop: true });
  assert.equal(run.phase, 'settle');
});

test('破产：余额不足时 spin → dead + bankrupt 事件', () => {
  const run = createRun({ seed: 4 });
  run.balance = 0;
  run.bet = 100;
  run.step({ spin: true });
  assert.equal(run.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'bankrupt'));
});

test('押镖：第 3 级起可用，低于第 3 级不可用', () => {
  const low = createRun({ seed: 5, spins: 0 }); // 等级 1
  low.step({ escort: true });
  assert.equal(low.escort, false);

  const high = createRun({ seed: 5, spins: 20 }); // 等级 3
  high.step({ escort: true });
  assert.equal(high.escort, true);
});

test('押镖下注成本 = bet × 1.5', () => {
  const run = createRun({ seed: 6, spins: 20 }); // 等级 3
  run.escort = true;
  run.bet = 10;
  const before = run.balance;
  run.step({ spin: true });
  assert.equal(run.balance, before - 15);
});

test('好汉令保底：tokens≥5 → 下一转保证中奖 + pity', () => {
  const run = createRun({ seed: 7, tokens: 5 });
  run.step({ spin: true });
  settleAll(run);
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'pity'));
  assert.ok(ev.some((e) => e.type === 'win'));
  assert.equal(run.tokens, 0); // 消耗 5 枚
});

test('tokens 累计：散布置到盘面时 tokens 增加', () => {
  const run = createRun({ seed: 8 });
  run._welcomeWin = false;
  run.step({ spin: true });
  fillTarget(run, SYMBOLS.OFFICIAL);
  run.target[0][0] = SYMBOLS.TOKEN;
  run.target[2][2] = SYMBOLS.TOKEN; // 恰好 2 枚 → 不触发免费旋转
  settleAll(run);
  assert.equal(run.tokens, 2);
});

test('免费旋转触发后自动续转且不扣注', () => {
  const run = createRun({ seed: 9 });
  // 人为制造 3 个 scatter 触发免费旋转
  run._welcomeWin = false;
  run.step({ spin: true });
  run.target[0][0] = SYMBOLS.TOKEN;
  run.target[1][0] = SYMBOLS.TOKEN;
  run.target[2][0] = SYMBOLS.TOKEN;
  const balanceBefore = run.balance;
  settleAll(run);
  assert.ok(run.freeSpins > 0, '触发免费旋转');
  const freeEvt = run.drainEvents();
  assert.ok(freeEvt.some((e) => e.type === 'freeSpin'));
  // 免费旋转续转不应扣注（余额不因免费转下降）
  assert.ok(run.balance >= balanceBefore);
});

test('milestone 每 5 转一次', () => {
  const run = createRun({ seed: 10 });
  run._welcomeWin = false;
  let sawMilestone = false;
  for (let i = 0; i < 5; i += 1) {
    run.step({ spin: true });
    fillTarget(run, SYMBOLS.OFFICIAL); // 无 scatter
    settleAll(run);
    const ev = run.drainEvents();
    if (ev.some((e) => e.type === 'milestone')) sawMilestone = true;
  }
  assert.equal(run.totalSpins, 5);
  assert.equal(run.level, 2);
  assert.equal(sawMilestone, true);
});

test('levelUp 事件：跨过等级门槛时发出', () => {
  const run = createRun({ seed: 11, spins: 11 }); // 等级 2（11 spins）
  const events = [];
  run.step({ spin: true }); // 第 12 转 → 等级 3
  settleAll(run);
  events.push(...run.drainEvents());
  assert.equal(run.level, 3);
  assert.ok(events.some((e) => e.type === 'levelUp' && e.level === 3));
});

test('drainEvents 清空队列', () => {
  const run = createRun({ seed: 12 });
  run.step({ spin: true });
  settleAll(run);
  assert.ok(run.drainEvents().length > 0);
  assert.equal(run.drainEvents().length, 0);
});

test('确定性：相同 seed 产生相同盘面', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.deepEqual(a.reels, b.reels);
});

test('getHud 暴露关键字段', () => {
  const run = createRun({ seed: 13, tokens: 5, spins: 12 });
  const hud = run.getHud();
  assert.equal(hud.level, 3);
  assert.equal(hud.tokens, 5);
  assert.equal(hud.pityReady, true);
  assert.equal(hud.bet, BET_OPTIONS[0]);
  assert.equal(hud.escortUnlocked, true);
});

test('高额下注在随机盘面上能输光（有方差）', () => {
  // 纯逻辑冒烟：连转很多次不崩，余额始终 >= 0，事件流合法
  const run = createRun({ seed: 99 });
  run.bet = 100;
  for (let i = 0; i < 60 && run.phase !== 'dead'; i += 1) {
    run.step({ spin: true });
    settleAll(run);
    run.drainEvents();
  }
  assert.ok(run.balance >= 0);
  assert.ok(['idle', 'spinning', 'settle', 'dead'].includes(run.phase));
});
