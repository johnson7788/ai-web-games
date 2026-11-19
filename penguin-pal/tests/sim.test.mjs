import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, computeWish, xpNeed } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

test('初始状态：等级 1、满体、金币 15、未胜利', () => {
  const r = createRun();
  assert.equal(r.state.level, 1);
  assert.equal(r.state.xp, 0);
  assert.equal(r.state.gold, 15);
  assert.equal(r.state.won, false);
  assert.equal(r.state.phase, 'playing');
});

test('喂食降低饥饿并夹在 [0,100]', () => {
  const r = createRun();
  r.state.hunger = 30;
  r.act('feed');
  assert.ok(r.state.hunger < 30, '饥饿应下降');
  assert.ok(r.state.hunger >= 0);
});

test('洗澡提升清洁，且不超过 100', () => {
  const r = createRun();
  r.act('wash');
  assert.equal(r.state.clean, 100);
});

test('休息恢复体力', () => {
  const r = createRun();
  r.state.energy = 20;
  r.act('rest');
  assert.ok(r.state.energy > 20);
});

test('玩耍提升心情', () => {
  const r = createRun();
  r.state.mood = 30;
  r.act('play');
  assert.ok(r.state.mood > 30);
});

test('学习增加经验', () => {
  const r = createRun();
  r.act('train');
  assert.ok(r.state.xp > 0);
});

test('打工增加金币', () => {
  const r = createRun();
  const before = r.state.gold;
  r.act('work');
  assert.ok(r.state.gold > before);
});

test('自然衰减：饥饿上升、清洁下降、体力回复', () => {
  const r = createRun();
  const h0 = r.state.hunger;
  const c0 = r.state.clean;
  const e0 = r.state.energy;
  r.step(1);
  assert.ok(r.state.hunger > h0);
  assert.ok(r.state.clean < c0);
  assert.ok(r.state.energy > e0);
});

test('环境事件：连续推进 3 秒会发出 ambient', () => {
  const r = createRun();
  r.step(3);
  const events = r.drainEvents();
  assert.ok(events.some((e) => e.type === 'ambient'));
});

test('心愿满足会累积连击', () => {
  const r = createRun();
  r.state.wish = 'feed';
  r.act('feed');
  assert.equal(r.state.combo, 1);
});

test('做非心愿动作会清零连击', () => {
  const r = createRun();
  r.state.wish = 'feed';
  r.act('feed');
  assert.equal(r.state.combo, 1);
  r.act('wash');
  assert.equal(r.state.combo, 0);
});

test('心愿计算：饥饿高时想吃饭', () => {
  const r = createRun();
  r.state.hunger = 90;
  assert.equal(computeWish(r.state), 'feed');
});

test('经验足够时升级并触发 levelup 事件', () => {
  const r = createRun();
  r.grantXp(xpNeed(1));
  assert.equal(r.state.level, 2);
  const events = r.drainEvents();
  assert.ok(events.some((e) => e.type === 'levelup'));
});

test('升到 3 级达成目标：won + win 事件 + 1~3 星', () => {
  const r = createRun();
  r.grantXp(xpNeed(1) + xpNeed(2) + 10);
  assert.equal(r.state.won, true);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.level >= GAME.GOAL_LEVEL);
  assert.ok(r.state.stars >= 1 && r.state.stars <= 3);
  const events = r.drainEvents();
  assert.ok(events.some((e) => e.type === 'win'));
});

test('金币不足时购买失败', () => {
  const r = createRun();
  r.state.gold = 0;
  const res = r.buy('fish');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'noGold');
});

test('金币足够时购买成功并扣款', () => {
  const r = createRun();
  r.state.gold = 30;
  const res = r.buy('fish');
  assert.equal(res.ok, true);
  assert.ok(r.state.gold < 30);
});

test('getHud 返回完整快照', () => {
  const r = createRun();
  const h = r.getHud();
  assert.equal(typeof h.level, 'number');
  assert.equal(typeof h.hunger, 'number');
  assert.equal(typeof h.gold, 'number');
  assert.equal(typeof h.wish, 'string');
});
