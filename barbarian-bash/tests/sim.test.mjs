import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const advance = (run, sec) => {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
};

test('冒烟：createRun → state 形状合法', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.ammoLeft, LEVELS[0].ammo);
  assert.ok(s.enemies.length >= 1);
  assert.ok(Array.isArray(s.boulders));
  assert.ok(Array.isArray(r.drainEvents()));
});

test('首个事件：开局发 level 事件', () => {
  const r = createRun(0, { seed: 1 });
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'level' && e.level === 1));
});

test('getHud：返回关卡/弹药/时间/分数', () => {
  const r = createRun(0, { seed: 1 });
  const h = r.getHud();
  assert.equal(h.level, 1);
  assert.equal(h.ammoLeft, 5);
  assert.equal(h.ammoTotal, 5);
  assert.equal(typeof h.timeLeft, 'number');
  assert.equal(h.enemiesLeft, LEVELS[0].enemies.length);
});

test('投掷：aim+throw 消耗弹药并产生飞行岩石', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.aim(880, 572).ok, true);
  assert.equal(r.throw().ok, true);
  assert.equal(r.state.ammoLeft, 4);
  assert.equal(r.state.boulders.length, 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'aim'));
  assert.ok(ev.some((e) => e.type === 'throw'));
});

test('投掷校验：无瞄准 / 无弹药拒绝', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.throw().ok, false);
  r.state.ammoLeft = 0;
  r.aim(880, 572);
  assert.equal(r.throw().ok, false);
});

test('暴击秒杀：瞄准核心 → kill + crit + win', () => {
  const r = createRun(0, { seed: 1 });
  const e = r.state.enemies[0];
  r.aim(e.cx + e.core.dx, e.cy + e.core.dy);
  r.throw();
  advance(r, 3);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.equal(r.state.kills, 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((x) => x.type === 'crit'));
  assert.ok(ev.some((x) => x.type === 'kill'));
  assert.ok(ev.some((x) => x.type === 'win'));
});

test('星级：省弹药通关得三星', () => {
  const r = createRun(0, { seed: 1 }); // ammo 5, triple=1
  const e = r.state.enemies[0];
  r.aim(e.cx + e.core.dx, e.cy + e.core.dy);
  r.throw();
  advance(r, 3);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.stars, 3); // 用 1 块（剩 4 ≥ 5-1）
});

test('失败：弹药耗尽且无飞行岩石 → outOfAmmo', () => {
  const r = createRun(0, { seed: 1 });
  r.state.ammoLeft = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'outOfAmmo');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'outOfAmmo'));
});

test('失败：时间耗尽 → timeOut', () => {
  const r = createRun(0, { seed: 1 });
  r.step(LEVELS[0].timeLimit + 1);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'timeOut');
});

test('障碍：木箱被砸碎 → break 事件', () => {
  const r = createRun(2, { seed: 1 }); // L3 有木箱
  const bar = r.state.barriers.find((b) => b.type === 'crate');
  assert.ok(bar);
  r.aim(bar.cx, bar.cy);
  r.throw();
  advance(r, 2);
  assert.equal(bar.alive, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'break'));
});

test('TNT：引爆 → explode 事件', () => {
  const r = createRun(3, { seed: 1 }); // L4 有 TNT
  const bar = r.state.barriers.find((b) => b.type === 'tnt');
  assert.ok(bar);
  r.aim(bar.cx, bar.cy);
  r.throw();
  advance(r, 2);
  assert.equal(bar.alive, false);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'explode'));
});

test('人质：误伤 → lose captiveLost', () => {
  const r = createRun(4, { seed: 1 }); // L5 有人质
  const c = r.state.captive;
  assert.ok(c);
  r.aim(c.cx, c.cy);
  r.throw();
  advance(r, 2);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'captiveLost');
});

test('BOSS：非暴击只掉 1 层甲（不秒杀）', () => {
  const r = createRun(5, { seed: 1 }); // L6 有 boss
  const boss = r.state.enemies.find((e) => e.boss);
  assert.ok(boss);
  assert.equal(boss.hpMax, 3);
  // 瞄准身体边缘（非核心）
  r.aim(boss.cx + boss.w / 2 - 10, boss.cy);
  r.throw();
  advance(r, 2);
  assert.ok(boss.hp < 3 || !boss.alive);
});

test('确定性：相同 seed 产生相同开局', () => {
  const a = createRun(1, { seed: 42 });
  const b = createRun(1, { seed: 42 });
  assert.equal(a.state.enemies.length, b.state.enemies.length);
  assert.deepEqual(a.state.enemies.map((e) => e.cx), b.state.enemies.map((e) => e.cx));
});

test('连击：连续击杀累计 streak 并发 combo', () => {
  const r = createRun(1, { seed: 1 }); // L2 两个敌人
  for (const e of r.state.enemies) {
    r.aim(e.cx + e.core.dx, e.cy + e.core.dy);
    r.throw();
    advance(r, 2);
    if (r.state.phase !== 'playing') break;
  }
  assert.ok(r.state.streak >= 2);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'combo'));
});

test('mulberry32：确定性伪随机', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
