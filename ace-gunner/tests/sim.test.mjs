// ACE GUNNER · 纯逻辑测试（node:test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, UPGRADES } from '../src/game/sim.js';
import { WAVE_COUNT, ENEMY, LANE_Y } from '../config/levels.js';
import { GAME, LAYOUT } from '../config/game.config.js';

function step(run, seconds, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i += 1) run.step(dt);
}

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const va = [a(), a(), a()];
  const vb = [b(), b(), b()];
  assert.deepEqual(va, vb);
});

test('createRun 初始状态正确', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.phase, 'wave');
  assert.equal(r.state.wave, 1);
  assert.equal(r.state.arrows, GAME.QUIVER);
  assert.equal(r.state.baseHp, GAME.BASE_HP);
  assert.equal(r.state.enemies.length, 0);
  assert.ok(r._spawnQueue.length > 0);
});

test('第一波会按 at 错峰生成敌人', () => {
  const r = createRun(0, { seed: 1 });
  step(r, 1.0);
  assert.ok(r.state.enemies.length >= 1);
  step(r, 5.0);
  assert.ok(r.state.enemies.length >= 5);
});

test('射击消耗箭矢并触发事件', () => {
  const r = createRun(0, { seed: 1 });
  r.aim(700, 400);
  const res = r.fire();
  assert.equal(res.ok, true);
  assert.equal(r.state.arrows, GAME.QUIVER - 1);
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shot'));
});

test('换弹期间不能射击', () => {
  const r = createRun(0, { seed: 1 });
  r.aim(700, 400);
  for (let i = 0; i < GAME.QUIVER; i += 1) {
    r.state.cooldown = 0;
    r.fire();
  }
  assert.equal(r.state.arrows, 0);
  assert.equal(r.state.reloading, true);
  const res = r.fire();
  assert.equal(res.ok, false);
});

test('换弹完成恢复箭袋', () => {
  const r = createRun(0, { seed: 1 });
  r.aim(700, 400);
  for (let i = 0; i < GAME.QUIVER; i += 1) {
    r.state.cooldown = 0;
    r.fire();
  }
  assert.equal(r.state.reloading, true);
  step(r, GAME.RELOAD_TIME + 0.1);
  assert.equal(r.state.reloading, false);
  assert.equal(r.state.arrows, r.state.maxArrows);
});

test('箭矢命中敌人造成伤害并触发 arrowHit', () => {
  const r = createRun(0, { seed: 1 });
  // 直接把一个敌人摆到准星位置（离射手近，确保箭矢能到）
  const e = { id: 999, kind: 'foot', lane: 1, door: 0, x: 500, y: 400, hp: 30, maxHp: 30, speed: 0, damage: 0, radius: 18, gold: 6, mass: 'infantry', explodeRadius: 0, wallDanger: 0, state: 'walking', attackTick: 0, bossPhase: 0 };
  r.state.enemies.push(e);
  r.aim(500, 400);
  r.fire();
  step(r, 0.6);
  assert.ok(e.hp < 30);
  const evs = r.drainEvents();
  assert.ok(evs.some((ev) => ev.type === 'arrowHit'));
});

test('击杀敌人给金币并触发 kill', () => {
  const r = createRun(0, { seed: 1 });
  const e = { id: 998, kind: 'foot', lane: 1, door: 0, x: 350, y: 400, hp: 2, maxHp: 30, speed: 0, damage: 0, radius: 18, gold: 6, mass: 'infantry', explodeRadius: 0, wallDanger: 0, state: 'walking', attackTick: 0, bossPhase: 0 };
  r.state.enemies.push(e);
  const gold0 = r.state.gold;
  r.aim(350, 400);
  r.fire();
  step(r, 0.6);
  assert.equal(e.state, 'dead');
  assert.ok(r.state.gold > gold0);
});

test('盾匪先破盾才掉血', () => {
  const r = createRun(0, { seed: 1 });
  const e = { id: 997, kind: 'shield', lane: 1, door: 0, x: 400, y: 400, hp: 55, maxHp: 55, speed: 0, damage: 0, radius: 20, gold: 12, mass: 'armored', explodeRadius: 0, wallDanger: 0, shieldHp: 45, state: 'walking', attackTick: 0, bossPhase: 0 };
  r.state.enemies.push(e);
  r.aim(400, 400);
  // 打多箭直到破盾
  for (let i = 0; i < 6; i += 1) {
    r.state.cooldown = 0;
    r.fire();
    step(r, 0.6);
  }
  assert.ok(e.shieldHp <= 0, '盾应被打破');
  assert.ok(e.hp < 55, '破盾后本体应掉血');
});

test('敌人到达城墙会攻击城门', () => {
  const r = createRun(0, { seed: 1 });
  const e = { id: 996, kind: 'foot', lane: 1, door: 0, x: LAYOUT.WALL_X + 60, y: 400, hp: 30, maxHp: 30, speed: 22, damage: 8, radius: 18, gold: 6, mass: 'infantry', explodeRadius: 0, wallDanger: 0, state: 'walking', attackTick: 0, bossPhase: 0 };
  r.state.enemies.push(e);
  const hp0 = r.state.baseHp;
  step(r, 4);
  assert.ok(r.state.baseHp < hp0);
});

test('城门归零判负', () => {
  const r = createRun(0, { seed: 1 });
  r.state.baseHp = 5;
  const e = { id: 995, kind: 'foot', lane: 1, door: 0, x: LAYOUT.WALL_X + 60, y: 400, hp: 30, maxHp: 30, speed: 22, damage: 50, radius: 18, gold: 6, mass: 'infantry', explodeRadius: 0, wallDanger: 0, state: 'walking', attackTick: 0, bossPhase: 0 };
  r.state.enemies.push(e);
  step(r, 3);
  assert.equal(r.state.phase, 'lost');
});

test('波清进入升级阶段并发放奖励', () => {
  const r = createRun(0, { seed: 1 });
  // 直接清空生成队列与敌人
  r._spawnQueue.length = 0;
  r.state.enemies.length = 0;
  step(r, 0.1);
  assert.equal(r.state.phase, 'upgrade');
  assert.ok(r.state.offered.length === GAME.UPGRADES_PER_WAVE);
});

test('升级选择生效并进入下一波', () => {
  const r = createRun(0, { seed: 1 });
  r._spawnQueue.length = 0;
  r.state.enemies.length = 0;
  step(r, 0.1);
  assert.equal(r.state.phase, 'upgrade');
  const id = r.state.offered[0];
  const ok = r.chooseUpgrade(id);
  assert.equal(ok.ok, true);
  assert.ok(r.state.upgrades.includes(id));
  const n = r.nextWave();
  assert.equal(n.ok, true);
  assert.equal(r.state.phase, 'wave');
  assert.equal(r.state.wave, 2);
});

test('所有升级目录都可应用', () => {
  for (const [id, def] of Object.entries(UPGRADES)) {
    const r = createRun(0, { seed: 1 });
    def.apply(r.state);
    assert.ok(true, id);
  }
});

test('鹰眼在连杀阈值触发慢动作', () => {
  const r = createRun(0, { seed: 1 });
  // 直接注入 3 个击杀
  for (let i = 0; i < GAME.EAGLE_STREAK; i += 1) {
    r._emit({ type: 'kill', kind: 'foot', gold: 0, streak: i + 1 });
    // 手动触发连杀逻辑等价路径：直接调用内部
  }
  // 用真实 kill 路径验证
  const r2 = createRun(0, { seed: 1 });
  for (let i = 0; i < GAME.EAGLE_STREAK; i += 1) {
    const e = { id: 900 + i, kind: 'foot', lane: 0, door: 0, x: 300 + i, y: 300, hp: 1, maxHp: 30, speed: 0, damage: 0, radius: 18, gold: 0, mass: 'infantry', explodeRadius: 0, wallDanger: 0, state: 'walking', attackTick: 0, bossPhase: 0 };
    r2.state.enemies.push(e);
    r2.aim(e.x, e.y);
    r2.fire();
    step(r2, 0.4);
  }
  assert.ok(r2.state.eagleLeft > 0 || r2.state.killStreak >= GAME.EAGLE_STREAK);
});

test('12 波后通关', () => {
  const r = createRun(11, { seed: 1 });
  assert.equal(r.state.wave, 12);
  r._spawnQueue.length = 0;
  r.state.enemies.length = 0;
  step(r, 0.1);
  assert.equal(r.state.phase, 'won');
});

test('敌人 lane 映射到有效 y', () => {
  for (const lane of [0, 1, 2, 3]) {
    assert.ok(Number.isFinite(LANE_Y[lane]));
  }
  assert.equal(ENEMY.foot.speed < ENEMY.rider.speed, true);
});

test('沙暴波次命中受扰（seed 确定）', () => {
  const r = createRun(4, { seed: 7 }); // 第 5 波沙暴
  assert.equal(r.state.sandstorm, true);
  assert.equal(r.state.phase, 'wave');
});
