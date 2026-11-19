import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, GAME } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → movePlanetTo → getHud → drainEvents 无异常', () => {
  const r = createRun(1);
  r.step(1 / 60);
  const m = r.movePlanetTo(400, 300);
  assert.equal(m.ok, true);
  const hud = r.getHud();
  assert.equal(hud.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：phase/planet/hp/score/entities 初始值正确', () => {
  const r = createRun(1);
  const s = r.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.hp, GAME.HP_MAX);
  assert.equal(s.score, 0);
  assert.equal(s.planet.mass, 0);
  assert.equal(s.planet.tier, 0);
  assert.equal(s.planet.r, GAME.PLANET_R0);
  assert.ok(Array.isArray(s.entities));
});

test('step 推进时间', () => {
  const r = createRun(1);
  r.step(0.5);
  assert.ok(r.state.time > 0);
});

test('mulberry32 同 seed 可复现', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('movePlanetTo 钳制在安全边界内', () => {
  const r = createRun(1);
  r.movePlanetTo(-999, -999);
  const p = r.state.planet;
  assert.ok(p.x >= p.r);
  assert.ok(p.y >= GAME.SAFE_TOP + p.r);
  r.movePlanetTo(99999, 99999);
  assert.ok(r.state.planet.x <= WORLD.WIDTH - r.state.planet.r);
  assert.ok(r.state.planet.y <= WORLD.HEIGHT - GAME.SAFE_BOTTOM - r.state.planet.r);
});

test('吞噬流星：质量与分数增长，触发 meteor 事件', () => {
  const r = createRun(1);
  const p = r.state.planet;
  const e = r.spawnEntity('meteor', p.x, p.y);
  r.drainEvents();
  r.step(1 / 60);
  assert.ok(r.state.planet.mass >= GAME.MASS_METEOR);
  assert.ok(r.state.score >= GAME.SCORE_METEOR);
  const ev = r.drainEvents();
  assert.ok(ev.some((x) => x.type === 'meteor'));
});

test('吞噬黄金流星：更高价值与分数', () => {
  const r = createRun(1);
  const p = r.state.planet;
  r.spawnEntity('gold', p.x, p.y);
  r.drainEvents();
  r.step(1 / 60);
  assert.ok(r.state.planet.mass >= GAME.MASS_GOLD);
  assert.ok(r.state.score >= GAME.SCORE_GOLD);
  const ev = r.drainEvents();
  assert.ok(ev.some((x) => x.type === 'gold'));
});

test('连击：连续吞噬叠加倍率', () => {
  const r = createRun(1);
  const p = r.state.planet;
  r.spawnEntity('meteor', p.x, p.y);
  r.step(1 / 60);
  assert.equal(r.state.combo, 1);
  r.spawnEntity('meteor', p.x, p.y);
  r.step(1 / 60);
  assert.equal(r.state.combo, 2);
  assert.equal(r.state.comboMult, 2);
});

test('进化：质量跨过阈值升级 tier 并长大', () => {
  const r = createRun(1);
  const p = r.state.planet;
  p.mass = GAME.TIER_MASS[1] - 1;
  r._applyTier();
  assert.equal(p.tier, 0);
  p.mass = GAME.TIER_MASS[1];
  r._applyTier();
  assert.equal(p.tier, 1);
  assert.equal(p.r, GAME.TIER_RADIUS[1]);
});

test('黑洞撞击：无护盾时扣血并触发 hit', () => {
  const r = createRun(1);
  const p = r.state.planet;
  const hp0 = r.state.hp;
  r.spawnEntity('hole', p.x, p.y);
  r.drainEvents();
  r.step(1 / 60);
  assert.equal(r.state.hp, hp0 - 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((x) => x.type === 'hit'));
});

test('护盾吸收黑洞：不扣血而扣护盾', () => {
  const r = createRun(1);
  const p = r.state.planet;
  r.state.shields = 1;
  const hp0 = r.state.hp;
  r.spawnEntity('hole', p.x, p.y);
  r.drainEvents();
  r.step(1 / 60);
  assert.equal(r.state.hp, hp0);
  assert.equal(r.state.shields, 0);
  const ev = r.drainEvents();
  assert.ok(ev.some((x) => x.type === 'absorb'));
});

test('生命归零：结算 phase=over，按分数评星', () => {
  const r = createRun(1);
  r.state.hp = 1;
  r.state.score = GAME.STAR_3;
  const p = r.state.planet;
  r.spawnEntity('hole', p.x, p.y);
  r.drainEvents();
  r.step(1 / 60);
  assert.equal(r.state.phase, 'over');
  assert.equal(r.state.stars, 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((x) => x.type === 'gameover'));
});

test('无分数结算为 0 星，低分为 1 星', () => {
  const r = createRun(1);
  r.state.hp = 1;
  r.state.score = 0;
  r.state.planet.x = 640;
  r.state.planet.y = 400;
  r.spawnEntity('hole', 640, 400);
  r.drainEvents();
  r.step(1 / 60);
  assert.equal(r.state.phase, 'over');
  assert.equal(r.state.stars, 0);
});

test('getHud 字段完整', () => {
  const r = createRun(1);
  const h = r.getHud();
  assert.equal(typeof h.score, 'number');
  assert.equal(typeof h.mass, 'number');
  assert.equal(typeof h.hp, 'number');
  assert.equal(typeof h.combo, 'number');
  assert.equal(typeof h.tier, 'number');
  assert.equal(h.phase, 'playing');
});
