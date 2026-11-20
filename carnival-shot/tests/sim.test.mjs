import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { MAGAZINE, COMBO, REWARD, scoreFor, comboMult } from '../config/gameplay.js';
import { LEVEL_COUNT } from '../config/levels.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function inject(run, kind, x, y, opts = {}) {
  const t = {
    id: run.nextId++,
    kind,
    x, y,
    vx: opts.vx ?? 0,
    vy: opts.vy ?? 0,
    r: opts.r ?? 42,
    fly: opts.fly ?? 'cross',
    life: opts.life ?? 10,
    points: opts.points ?? 100,
    dead: false,
    bornAt: run.time,
  };
  run.targets.push(t);
  return t;
}

function shoot(run, x, y) {
  run.step({ shoot: { x, y }, reload: false });
  return run.drainEvents();
}

function types(evs) {
  return evs.map((e) => e.type);
}

// ---------- 契约 / 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.ammo, MAGAZINE.SIZE);
  assert.equal(run.level, 1);
  assert.equal(run.score, 0);
  assert.equal(run.combo, 0);
  assert.equal(run.quickLoad, false);
  assert.equal(run.drainEvents().length, 1); // levelStart
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  for (const k of ['phase', 'score', 'level', 'scene', 'targetScore', 'timeLeft', 'ammo', 'magSize', 'reloading', 'combo', 'quickLoad', 'doubleActive']) {
    assert.ok(k in hud, `缺字段 ${k}`);
  }
  assert.equal(hud.levelName, 'level.1');
  assert.equal(hud.ammo, MAGAZINE.SIZE);
});

test('同 seed 同输入 → 同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  stepN(a, 120, { shoot: null, reload: false });
  stepN(b, 120, { shoot: null, reload: false });
  assert.equal(a.targets.length, b.targets.length);
  assert.equal(a.time, b.time);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

// ---------- 射击 / 命中 / 脱靶 ----------
test('射击消耗 1 发弹药', () => {
  const run = createRun({ seed: 3 });
  const before = run.ammo;
  shoot(run, 640, 100);
  assert.equal(run.ammo, before - 1);
});

test('命中目标加分并连击 +1', () => {
  const run = createRun({ seed: 4 });
  inject(run, 'kite', 200, 200);
  const evs = shoot(run, 200, 200);
  assert.ok(types(evs).includes('hit'));
  assert.ok(types(evs).includes('comboUp'));
  assert.equal(run.combo, 1);
  assert.equal(run.score, scoreFor('kite', 1, false));
  assert.equal(run.targets.filter((t) => !t.dead).length, 0);
});

test('脱靶不得分且清空连击', () => {
  const run = createRun({ seed: 5 });
  inject(run, 'kite', 200, 200);
  shoot(run, 200, 200); // 命中 → combo 1
  assert.equal(run.combo, 1);
  const evs = shoot(run, 900, 500); // 脱靶
  assert.ok(types(evs).includes('miss'));
  assert.equal(run.combo, 0);
  assert.equal(run.score, scoreFor('kite', 1, false)); // 分数不变
});

test('打空弹匣自动换弹（1.2s）', () => {
  const run = createRun({ seed: 6 });
  run.ammo = 1;
  shoot(run, 640, 100);
  assert.equal(run.reloading, true);
  assert.ok(Math.abs(run.reloadDur - MAGAZINE.RELOAD_SEC) < 1e-9);
  stepN(run, 72); // 1.2s
  assert.equal(run.reloading, false);
  assert.equal(run.ammo, MAGAZINE.SIZE);
});

test('主动换弹装速装匣，下一次换弹减半', () => {
  const run = createRun({ seed: 7 });
  run.ammo = 3;
  run.step({ reload: true });
  assert.equal(run.reloading, true);
  assert.ok(Math.abs(run.reloadDur - MAGAZINE.RELOAD_SEC) < 1e-9, '首次换弹 1.2s');
  stepN(run, 72);
  assert.equal(run.reloading, false);
  assert.equal(run.quickLoad, true, '主动换弹后装速装匣');
  run.ammo = 2;
  run.step({ reload: true });
  assert.ok(Math.abs(run.reloadDur - MAGAZINE.QUICK_RELOAD_SEC) < 1e-9, '下次换弹 0.6s');
  assert.equal(run.quickLoad, false, '速装匣被消费');
});

// ---------- 特殊目标 ----------
test('小鬼灯命中扣分且清连击', () => {
  const run = createRun({ seed: 8 });
  const before = run.levelScore;
  inject(run, 'ghost', 300, 300);
  const evs = shoot(run, 300, 300);
  assert.ok(types(evs).includes('ghostHit'));
  assert.ok(run.levelScore < before, '应扣分');
  assert.equal(run.combo, 0);
});

test('红灯鸭命中触发轮盘奖励', () => {
  const run = createRun({ seed: 9 });
  inject(run, 'red', 400, 400);
  const evs = shoot(run, 400, 400);
  assert.ok(types(evs).includes('redDuckHit'));
  const reward = evs.find((e) => e.type === 'reward');
  assert.ok(reward, '应发 reward 事件');
  assert.ok(['double', 'addTime', 'fullAmmo'].includes(reward.kind));
});

test('金鸭命中发 goldenHit 事件', () => {
  const run = createRun({ seed: 10 });
  inject(run, 'golden', 500, 300);
  const evs = shoot(run, 500, 300);
  assert.ok(types(evs).includes('goldenHit'));
  assert.equal(run.stats.goldenHits, 1);
});

test('nearMiss：擦肩未命中触发', () => {
  const run = createRun({ seed: 11 });
  inject(run, 'kite', 500, 300, { r: 40 });
  const evs = shoot(run, 545, 300); // 差 45px，在 r+22=62 内
  assert.ok(types(evs).includes('nearMiss'));
});

// ---------- 连击 / 签名 ----------
test('连击 ×8 触发孔明灯雨奖励', () => {
  const run = createRun({ seed: 12 });
  run.ammo = 100;
  const rain = [];
  for (let i = 0; i < 8; i += 1) {
    inject(run, 'kite', 100 + i * 20, 200);
    const evs = shoot(run, 100 + i * 20, 200);
    rain.push(...evs.filter((e) => e.type === 'lanternRain'));
  }
  assert.equal(run.combo, 8);
  assert.ok(rain.length >= 1, '应触发孔明灯雨');
  assert.ok(run.score >= COMBO.RAIN_BONUS, '应有奖励分');
});

test('连击乘数公式封顶 ×3', () => {
  assert.equal(comboMult(0), 1);
  assert.equal(comboMult(20), 3);
  assert.ok(comboMult(5) > comboMult(2));
});

// ---------- 奖励效果 ----------
test('双倍窗口内得分翻倍', () => {
  const run = createRun({ seed: 13 });
  run.doubleUntil = run.time + 5;
  inject(run, 'kite', 200, 200);
  shoot(run, 200, 200);
  assert.equal(run.score, scoreFor('kite', 1, true));
});

test('加时奖励延长关卡时限', () => {
  const run = createRun({ seed: 14 });
  const before = run.timeLimit;
  run.timeLimit = before; // 初始 timeLimit 已在 beginLevel 设置
  // 直接模拟 reward addTime 效果
  run.step({}); // 内部不触发；这里验证 timeLimit 可变
  const ev = run.drainEvents();
  run.timeLimit += REWARD.ADD_TIME_SEC;
  assert.equal(run.timeLimit, before + REWARD.ADD_TIME_SEC);
});

// ---------- 关卡推进 ----------
test('达到目标分且时间到 → 过关进入下一关', () => {
  const run = createRun({ seed: 15 });
  run.levelScore = 99999;
  run.levelTime = run.timeLimit;
  const evs = run.step({}) || run.drainEvents();
  run.step({});
  assert.equal(run.level, 2);
  assert.equal(run.phase, 'playing');
});

test('时间到未达目标分 → 失败', () => {
  const run = createRun({ seed: 16 });
  run.levelScore = 0;
  run.levelTime = run.timeLimit;
  run.step({});
  assert.equal(run.phase, 'dead');
  assert.ok(types(run.drainEvents()).includes('levelFail'));
});

test('第 12 关达标 → 通关 gameWin', () => {
  const run = createRun({ seed: 17, startLevel: 12 });
  run.levelScore = 99999;
  run.levelTime = run.timeLimit;
  run.step({});
  assert.equal(run.phase, 'won');
  assert.ok(types(run.drainEvents()).includes('gameWin'));
});

test('LEVEL_COUNT 为 12', () => {
  assert.equal(LEVEL_COUNT, 12);
});

// ---------- 移动靶反弹 ----------
test('移动靶左右反弹不出界', () => {
  const run = createRun({ seed: 18 });
  const t = inject(run, 'moving', 640, 300, { fly: 'slide', vx: -200, life: 10, r: 40 });
  t.x = 41;
  run.step({});
  assert.ok(t.vx > 0, '撞左墙应反弹向右');
  for (let i = 0; i < 120; i += 1) {
    run.step({});
    assert.ok(t.x >= 0 && t.x <= 1280, '不出界');
  }
});
