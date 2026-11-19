import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const advance = (run, sec) => {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
};

test('冒烟：createRun → step → setMove → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const mv = r.setMove(-1);
  assert.equal(mv.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/phase/player/score/killGoal 合法', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.killGoal, LEVELS[0].killGoal);
  assert.equal(s.player.hp, LEVELS[0].playerHp);
  assert.equal(s.player.maxHp, LEVELS[0].playerHp);
  assert.equal(s.score, 0);
  assert.equal(s.kills, 0);
  assert.equal(s.combo, 1);
});

test('RNG：mulberry32 同种子可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test('玩家：setMove 改变方向并夹在安全边内', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.setMove(1).changed, true);
  assert.equal(r.state.player.moveDir, 1);
  assert.equal(r.setMove(1).changed, false);
  // 向左冲到边界不越界
  r.setMove(-1);
  advance(r, 5);
  assert.ok(r.state.player.x >= 34);
  // 向右冲
  r.setMove(1);
  advance(r, 5);
  assert.ok(r.state.player.x <= 1280 - 34);
});

test('自动开火：推进后产生 shot 事件与玩家子弹', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, 0.3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'shot'));
  assert.ok(r.state.bullets.length > 0);
});

test('敌机：随时间生成并下移', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.enemies.length, 0);
  advance(r, 2);
  assert.ok(r.state.enemies.length > 0);
});

test('无输入基线：敌机漏过底线 → lose escape', () => {
  const r = createRun(0, { seed: 3 });
  let t = 0;
  while (r.state.phase === 'playing' && t < 120) { r.step(1 / 60); t += 1 / 60; }
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'escape');
  assert.equal(r.state.result.won, false);
});

test('击落：子弹命中敌机 → kills/combo/score 递增', () => {
  const r = createRun(0, { seed: 1 });
  r.state.enemies = [{ id: 1, x: 640, y: 300, baseX: 640, moveT: 0, hp: 1, maxHp: 1, type: 'grunt', fireCd: 999, r: 26 }];
  r.state.bullets = [{ x: 640, y: 300, r: 7 }];
  r.step(1 / 60);
  assert.equal(r.state.kills, 1);
  assert.equal(r.state.combo, 2);
  assert.ok(r.state.score >= 10);
});

test('受击：敌弹命中玩家 → 掉血并重置连击', () => {
  const r = createRun(0, { seed: 1 });
  const hp0 = r.state.player.hp;
  r.state.combo = 5;
  r.state.enemyBullets = [{ x: 640, y: 640, vx: 0, vy: 0, r: 6 }];
  r.step(1 / 60);
  assert.ok(r.state.player.hp < hp0);
  assert.equal(r.state.combo, 1);
});

test('连击衰减：不杀敌一段时间后 combo 归 1', () => {
  const r = createRun(0, { seed: 1 });
  // 隔离：不生成敌机、不自动开火，只测连击计时器衰减
  r.state.spawnCd = 999;
  r.state.asteroidCd = 999;
  r.state.player.fireCd = 999;
  r.state.combo = 4;
  r.state.comboTimer = 0.2;
  advance(r, 1);
  assert.equal(r.state.combo, 1);
});

test('forceWin：进入 won、≥1 星、result.won', () => {
  const r = createRun(0, { seed: 1 });
  r.forceWin();
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1);
  assert.equal(r.state.result.won, true);
});

test('forceLose：进入 lost、result.won=false', () => {
  const r = createRun(0, { seed: 1 });
  r.forceLose('destroyed');
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  assert.equal(r.state.result.reason, 'destroyed');
});

test('小行星：仅 L2+ 出现，击碎大岩石会分裂', () => {
  const r = createRun(1, { seed: 1 }); // L2
  assert.ok(LEVELS[1].asteroidInterval > 0);
  // 直接放一颗大岩石并射击
  r.state.asteroids = [{ id: 9, x: 640, y: 300, vy: 0, size: 2, hp: 1, r: 30, spin: 0, spinV: 0 }];
  r.state.bullets = [{ x: 640, y: 300, r: 7 }];
  r.step(1 / 60);
  // 大岩石 hp 打到 0 → 分裂成 2 个小岩石（size 1）
  assert.ok(r.state.asteroids.length >= 2);
  assert.ok(r.state.asteroids.every((a) => a.size < 2));
});

test('getHud：返回完整 HUD 字段', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const h = r.getHud();
  for (const k of ['level', 'phase', 'time', 'score', 'kills', 'killGoal', 'hp', 'maxHp', 'combo', 'comboPeak', 'stars']) {
    assert.ok(k in h, `HUD 缺字段 ${k}`);
  }
});
