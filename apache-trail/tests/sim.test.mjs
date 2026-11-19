import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { PLAYER, WORLD } from '../config/game.config.js';

const stepN = (run, n, fn) => {
  for (let i = 0; i < n; i += 1) {
    if (fn) fn(i);
    run.step(1 / 60);
  }
};

test('起步：静止在出生点地面上', () => {
  const r = createRun(0);
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.player.onGround, true);
  assert.equal(r.state.level, 1);
  assert.equal(r.state.timeLeft, LEVELS[0].time);
});

test('向右移动：x 随步数增加', () => {
  const r = createRun(0);
  const x0 = r.state.player.x;
  r.setMove(1);
  stepN(r, 30);
  assert.ok(r.state.player.x > x0, 'x 应增加');
  assert.equal(r.state.player.state, 'run');
});

test('跳跃：按跳后 vy < 0 且离地', () => {
  const r = createRun(0);
  r.pressJump();
  r.step(1 / 60);
  assert.ok(r.state.player.vy < 0, 'vy 应为负（向上）');
  assert.equal(r.state.player.onGround, false);
});

test('二段跳：空中再按跳进入 doubleJump', () => {
  const r = createRun(0);
  r.pressJump();
  r.step(1 / 60);
  r.pressJump();
  r.step(1 / 60);
  assert.equal(r.state.player.state, 'doubleJump');
});

test('落地：跳起后多步回落地面', () => {
  const r = createRun(0);
  r.pressJump();
  stepN(r, 120);
  assert.equal(r.state.player.onGround, true);
  assert.equal(r.state.player.state, 'idle');
});

test('重力：坠落时 vy 逐渐为正且受上限约束', () => {
  const r = createRun(0);
  r.pressJump();
  stepN(r, 300);
  assert.ok(r.state.player.vy <= PLAYER.MAX_FALL + 0.001, '下落速度不超过上限');
});

test('收集：碰到水晶后计数增加并触发 collect 事件', () => {
  const r = createRun(0);
  // 直接把玩家搬到第一颗水晶处（x=150）
  r.debug.setPos(140, 616);
  const before = r.state.crystalsCollected;
  stepN(r, 20);
  assert.ok(r.state.crystalsCollected > before, '水晶计数应增加');
});

test('连击：3 秒内连吃两颗触发 combo 事件', () => {
  const r = createRun(0);
  r.debug.setPos(140, 616);
  r.setMove(1);
  stepN(r, 40);
  const events = r.drainEvents().map((e) => e.type);
  assert.ok(events.includes('collect'), '应有 collect');
  assert.ok(events.includes('combo'), '连吃应有 combo');
});

test('仙人掌刺：无护盾碰到即死亡', () => {
  const r = createRun(0);
  // L1 刺在 x=360
  r.debug.setPos(358, 616);
  stepN(r, 6);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.reason, 'hazard');
});

test('护盾：拾取后能抵挡一次致命机关', () => {
  const r = createRun(0);
  // 先搬到护盾处（x=250）吃护盾
  r.debug.setPos(240, 616);
  stepN(r, 20);
  assert.equal(r.state.player.shield, 1, '应拾取护盾');
  // 再撞刺
  r.debug.setPos(358, 616);
  stepN(r, 6);
  assert.equal(r.state.player.shield, 0, '护盾应被消耗');
  assert.equal(r.state.phase, 'playing', '护盾挡住一次死亡');
});

test('超时：倒计时耗尽判负', () => {
  const r = createRun(0);
  r.state.timeLeft = 0.05;
  stepN(r, 6);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.reason, 'timeOut');
});

test('过关：抵达终点图腾判胜并计星', () => {
  const r = createRun(0);
  r.debug.setPos(LEVELS[0].end.x - 20, 616);
  stepN(r, 6);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1, '至少 1 星');
});

test('事件：开局即产生 start 事件', () => {
  const r = createRun(0);
  const ev = r.drainEvents().map((e) => e.type);
  assert.ok(ev.includes('start'));
});

test('风：进入风区产生 wind 事件', () => {
  const r = createRun(1);
  // 把玩家放到 L2 风区左缘（x=880，站在地面上，身体与风区重叠）
  r.debug.setPos(880, 616);
  stepN(r, 120);
  const ev = r.drainEvents().map((e) => e.type);
  assert.ok(ev.includes('wind'), '风区应产生 wind');
});

test('弹簧：踩弹簧产生 spring 事件并弹起', () => {
  const r = createRun(1);
  // 玩家放到 L2 弹簧上方（x=200,y=644，脚落在弹簧上）
  r.debug.setPos(190, 560);
  stepN(r, 40);
  const ev = r.drainEvents().map((e) => e.type);
  assert.ok(ev.includes('spring'), '踩弹簧应产生 spring');
});
