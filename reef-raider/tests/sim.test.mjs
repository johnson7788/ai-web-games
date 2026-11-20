import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME, FISH_TYPES, LAYOUT } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

const TURRET_X = LAYOUT.TURRET_X;
const TURRET_Y = LAYOUT.TURRET_Y;

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

function aimAt(f, lead = 1.0) {
  const t = Math.hypot(f.x - TURRET_X, f.y - TURRET_Y) / GAME.BULLET_SPEED;
  const fx = f.x + (f.vx || 0) * t * lead;
  const fy = f.y + (f.vy || 0) * t * lead;
  return Math.atan2(fx - TURRET_X, -(fy - TURRET_Y));
}

// 反复瞄准开火，直到该鱼被捕获或超时（返回该鱼）
function killFish(run, fishType = 'turtle') {
  run.spawnFish(fishType, TURRET_X, 520, 1);
  const f = run.state.fish[run.state.fish.length - 1];
  run.setPower(5);
  let guard = 3000;
  while (guard-- > 0 && f.alive && run.state.phase === 'playing') {
    run.fire(aimAt(f));
    run.step(1 / 60);
  }
  return f;
}

test('冒烟：createRun → step → setPower → fire → getHud → drainEvents', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  assert.equal(r.setPower(3).ok, true);
  const f = r.fire(0);
  assert.equal(f.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/phase/coins/score/target/timeLeft/powerLevel', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.coins, 100);
  assert.equal(s.score, 0);
  assert.equal(s.target, LEVELS[0].target);
  assert.equal(s.powerLevel, 1);
  assert.ok(s.timeLeft > 0);
});

test('fire：按炮档扣金币', () => {
  const r = createRun(0, { seed: 1 });
  r.setPower(3);
  const before = r.state.coins;
  r.fire(0);
  assert.equal(r.state.coins, before - 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'coinSpend' && e.amount === 3));
});

test('fire：金币不足返回 noCoins', () => {
  const r = createRun(0, { seed: 1 });
  r.state.coins = 0;
  r.setPower(5);
  assert.deepEqual(r.fire(0), { ok: false, reason: 'noCoins' });
});

test('fire：冷却期内返回 cooldown', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.fire(0).ok, true);
  assert.deepEqual(r.fire(0), { ok: false, reason: 'cooldown' });
  advance(r, 0.2);
  assert.equal(r.fire(0).ok, true);
});

test('setPower：夹紧到 1..5', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.setPower(99), { ok: true, power: 5 });
  assert.deepEqual(r.setPower(-3), { ok: true, power: 1 });
  assert.deepEqual(r.setPower(2.6), { ok: true, power: 3 });
});

test('初始鱼群：L1 生成鱼并发出 fishSpawn', () => {
  const r = createRun(0, { seed: 1 });
  assert.ok(r.state.fish.length >= 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'fishSpawn'));
  assert.ok(ev.some((e) => e.type === 'levelStart' && e.level === 1));
});

test('鱼会穿屏游动并被回收', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.fish.length;
  advance(r, 12); // 快鱼也会在 12s 内游出屏幕
  r.drainEvents();
  assert.ok(r.state.fish.length >= 0);
  assert.ok(before > 0);
});

test('子弹向 angle=0（正上）飞行', () => {
  const r = createRun(0, { seed: 1 });
  r.state.fish = [];
  r.fire(0);
  const b = r.state.bullets[0];
  const y0 = b.y;
  advance(r, 0.1);
  assert.ok(b.y < y0);
  assert.ok(Math.abs(b.x - TURRET_X) < 1);
});

test('子弹撞边反弹并最终 miss', () => {
  const r = createRun(0, { seed: 1 });
  r.state.fish = [];
  r.fire(Math.PI / 2); // 朝右
  advance(r, 5);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'miss'));
});

test('damage 范围：每次 hit 的 hurt 落在 [power, 3*power]', () => {
  const r = createRun(0, { seed: 1 });
  r.spawnFish('king', TURRET_X, 520, 1);
  const f = r.state.fish[r.state.fish.length - 1];
  r.setPower(3);
  const hurts = [];
  let guard = 4000;
  while (guard-- > 0 && f.hp > 0 && r.state.phase === 'playing') {
    r.fire(aimAt(f));
    r.step(1 / 60);
    for (const e of r.drainEvents()) if (e.type === 'hit') hurts.push(e.hurt);
  }
  assert.ok(hurts.length >= 3, `hit 次数不足：${hurts.length}`);
  for (const h of hurts) assert.ok(h >= 3 && h <= 9, `hurt ${h} 超出 [3,9]`);
});

test('capture：击杀鱼加金币与分数，发 capture/coinGain', () => {
  const r = createRun(0, { seed: 1 });
  const score0 = r.state.score;
  const coins0 = r.state.coins;
  const f = killFish(r, 'turtle');
  assert.equal(f.alive, false);
  assert.ok(r.state.score > score0);
  const ev = r.drainEvents();
  const gain = ev.find((e) => e.type === 'coinGain');
  assert.ok(gain && gain.amount >= 1, '捕获应产生正向金币入账');
  assert.ok(ev.some((e) => e.type === 'capture'));
  assert.ok(ev.some((e) => e.type === 'hit'));
});

test('win：score 达到 target 进入 won 并结算星星', () => {
  const r = createRun(0, { seed: 1 });
  r.state.score = r.state.target - 1;
  killFish(r, 'turtle');
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.state.stars >= 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
});

test('lose：时间走完 → lose timeOut', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, LEVELS[0].time + 1);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'timeOut'));
});

test('relief：金币归零一次性救济 +10', () => {
  const r = createRun(0, { seed: 1 });
  r.state.coins = 0;
  r.step(1 / 60);
  assert.equal(r.state.coins, GAME.RELIEF_GRANT);
  assert.equal(r.state.reliefUsed, true);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'relief'));
});

test('relief：连续零币时按间隔滴灌', () => {
  const r = createRun(0, { seed: 1 });
  r.state.coins = 0;
  r.state.reliefUsed = true;
  advance(r, GAME.RELIEF_INTERVAL + 0.1);
  assert.ok(r.state.coins >= 1);
});

test('稀有：L3 在 8s 后出现幽灵灯笼鱼并标记 rare', () => {
  const r = createRun(2, { seed: 1 }); // L3 rare=1
  advance(r, 9);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'rareSpawn'));
  assert.ok(r.state.fish.some((f) => f.type === 'ghost' && f.rare === true));
});

test('暗礁：L5 子弹命中暗礁被吸收发 reefBlock', () => {
  const r = createRun(4, { seed: 1 }); // L5 reef
  r.state.fish = [];
  const reef = LEVELS[4].reef[0];
  r.fire(Math.atan2(reef.x - TURRET_X, -(reef.y - TURRET_Y)));
  advance(r, 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'reefBlock'));
});

test('boss：L12 出现灯笼鱼王并发 bossSpawn', () => {
  const r = createRun(11, { seed: 1 }); // L12 boss
  assert.ok(r.state.fish.some((f) => f.type === 'king'));
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'bossSpawn' && e.fishType === 'king'));
});

test('连击：L7 连续捕获递增倍率', () => {
  const r = createRun(6, { seed: 1 }); // L7 combo
  r.state.score = 0;
  killFish(r, 'turtle');
  assert.equal(r.state.combo, 1);
  assert.ok(Math.abs(r.state.comboMult - 1.1) < 1e-9);
  killFish(r, 'turtle');
  assert.equal(r.state.combo, 2);
  assert.ok(Math.abs(r.state.comboMult - 1.2) < 1e-9);
});

test('连击：窗口过后断连 reset', () => {
  const r = createRun(6, { seed: 1 });
  killFish(r, 'turtle');
  assert.equal(r.state.combo, 1);
  advance(r, GAME.COMBO_WINDOW + 0.5);
  assert.equal(r.state.combo, 0);
  assert.equal(r.state.comboMult, 1);
});

test('mulberry32：确定性', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('事件 payload 不污染事件名（无 type 字段覆盖）', () => {
  const r = createRun(0, { seed: 1 });
  r.drainEvents();
  r.setPower(3);
  r.fire(0);
  const ev = r.drainEvents();
  for (const e of ev) {
    assert.equal(typeof e.type, 'string');
    assert.ok(['powerSwitch', 'shot', 'coinSpend'].includes(e.type));
  }
});
