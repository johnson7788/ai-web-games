import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { CLAW, ITEM, POWER } from '../config/game.config.js';

function swingTo(run, angle) {
  const h = run.state.hook;
  if (h.phase !== 'swinging') h.phase = 'swinging';
  for (let i = 0; i < 2000; i += 1) {
    const before = h.angle;
    run.step(1 / 60);
    const after = h.angle;
    const d = h.dir;
    if (d === 1 && before < angle && after >= angle) return true;
    if (d === -1 && before > angle && after <= angle) return true;
  }
  return false;
}

function grab(run, item) {
  if (!swingTo(run, item.angle)) return false;
  run.drop();
  let guard = 0;
  while (run.state.hook.phase !== 'swinging' && guard++ < 800) run.step(1 / 60);
  return run.state.hook.phase === 'swinging';
}

function find(run, kind) {
  return run.state.items.find((it) => it.kind === kind && it.alive);
}

test('createRun：初始状态与物品数量正确', () => {
  const run = createRun(0, { seed: 7 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.timeLeft, LEVELS[0].time);
  const expected = Object.values(LEVELS[0].counts).reduce((a, b) => a + b, 0);
  assert.equal(run.state.items.length, expected);
});

test('同 seed 物品布局可复现', () => {
  const a = createRun(0, { seed: 42 }).state.items;
  const b = createRun(0, { seed: 42 }).state.items;
  assert.deepEqual(a.map((i) => [i.x, i.y, i.kind]), b.map((i) => [i.x, i.y, i.kind]));
});

test('摆角始终在 ±swingMax 内', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 300; i += 1) {
    run.step(1 / 60);
    assert.ok(Math.abs(run.state.hook.angle) <= CLAW.swingMax + 1e-6);
  }
});

test('drop：进入下放状态并发出 drop 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.state.hook.phase = 'swinging';
  const res = run.drop();
  assert.equal(res.ok, true);
  assert.equal(run.state.hook.phase, 'extending');
  assert.ok(run.drainEvents().some((e) => e.type === 'drop'));
});

test('抓金子：得分增加、物品失效', () => {
  const run = createRun(0, { seed: 7 });
  const gold = find(run, 'gold1');
  assert.ok(gold, '有金块');
  const before = run.state.score;
  assert.equal(grab(run, gold), true);
  assert.ok(run.state.score > before, '得分应增加');
  assert.equal(gold.alive, false);
});

test('抓石头：扣分且不为负、发 rockHit', () => {
  const run = createRun(0, { seed: 7 });
  // 先得点分，再抓石头
  const gold = find(run, 'gold1');
  grab(run, gold);
  const rock = find(run, 'rock');
  const before = Math.max(0, run.state.score);
  const events = [];
  run._events = [];
  grab(run, rock);
  events.push(...run.drainEvents());
  assert.ok(events.some((e) => e.type === 'rockHit'));
  assert.ok(run.state.score < before || run.state.score === 0);
  assert.ok(run.state.score >= 0);
});

test('抓胡萝卜：充满能量并 powerReady', () => {
  const run = createRun(0, { seed: 7 });
  const carrot = find(run, 'carrot');
  assert.ok(carrot);
  grab(run, carrot);
  assert.equal(run.state.powerMeter, 1);
  assert.equal(run.state.powerReady, true);
});

test('power：触发黄金狂热', () => {
  const run = createRun(0, { seed: 7 });
  grab(run, find(run, 'carrot'));
  const res = run.power();
  assert.equal(res.ok, true);
  assert.equal(run.state.fever.active, true);
  assert.equal(run.state.fever.tLeft, POWER.feverDuration);
});

test('狂热期间金价翻倍', () => {
  const run = createRun(0, { seed: 7 });
  grab(run, find(run, 'carrot'));
  run.power();
  const gold = find(run, 'gold2');
  assert.ok(gold);
  const before = run.state.score;
  grab(run, gold);
  const gained = run.state.score - before;
  assert.ok(gained >= ITEM.gold2.value * POWER.feverMultiplier, `应 ≥ ${ITEM.gold2.value * 2}，实际 ${gained}`);
});

test('连击：连续抓金累计 combo', () => {
  const run = createRun(0, { seed: 7 });
  const g1 = find(run, 'gold1');
  const g2 = run.state.items.find((i) => i.kind === 'gold1' && i.alive && i.id !== g1.id);
  assert.ok(g2, '至少两块金');
  grab(run, g1);
  grab(run, g2);
  assert.ok(run.state.combo >= 2, '连击应 ≥2');
});

test('miss：空钩回combo 清零', () => {
  const run = createRun(0, { seed: 7 });
  const g1 = find(run, 'gold1');
  grab(run, g1);
  const g2 = run.state.items.find((i) => i.kind === 'gold1' && i.alive && i.id !== g1.id);
  grab(run, g2);
  assert.ok(run.state.combo >= 2);
  // 清空所有物品 → 下放必然落空
  for (const it of run.state.items) it.alive = false;
  run.state.hook.phase = 'swinging';
  run.state.hook.angle = 0;
  run.drop();
  let guard = 0;
  while (run.state.hook.phase !== 'swinging' && guard++ < 800) run.step(1 / 60);
  assert.equal(run.state.combo, 0);
});

test('时间到且未达标 → lose；达标 → win', () => {
  const lose = createRun(0, { seed: 7 });
  lose.state.timeLeft = 0.001;
  lose.step(1 / 60);
  assert.equal(lose.state.phase, 'lost');

  const win = createRun(0, { seed: 7 });
  win.state.score = win.state.target;
  win.state.timeLeft = 0.001;
  win.step(1 / 60);
  assert.equal(win.state.phase, 'won');
  assert.ok(win.state.stars >= 1);
});

test('bank：未达标失败，达标即胜', () => {
  const run = createRun(0, { seed: 7 });
  assert.equal(run.bank().ok, false);
  run.state.score = run.state.target;
  assert.equal(run.bank().ok, true);
  assert.equal(run.state.phase, 'won');
});

test('getHud：返回关键字段', () => {
  const run = createRun(0, { seed: 7 });
  const h = run.getHud();
  assert.equal(h.level, 1);
  assert.equal(typeof h.timeLeft, 'number');
  assert.equal(typeof h.score, 'number');
  assert.equal(typeof h.combo, 'number');
  assert.equal(typeof h.powerReady, 'boolean');
});
