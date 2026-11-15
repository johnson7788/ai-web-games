// tests/sim.test.mjs — 纯逻辑回归（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, pickUpgrade, ratingFor } from '../src/game/sim.js';
import { ARENA, FIGHTER, WEAPONS, MATCH, BOT } from '../config/game.config.js';

const step = (r, n, inp = {}) => { for (let i = 0; i < n; i++) updateSim(r, inp); };
const empty = { mx: 0, mz: 0, punch: false, grab: false, ult: false };

test('createSim: 8 名布偶（1 玩家 + 7 bot），默认第 1 场', () => {
  const r = createSim({ seed: 1 });
  assert.equal(r.fighters.length, MATCH.fighters);
  assert.equal(r.fighters.filter((f) => f.isPlayer).length, 1);
  assert.equal(r.fighters.filter((f) => !f.isPlayer).length, 7);
  assert.equal(r.phase, 'match');
  assert.equal(r.match, 1);
  assert.equal(getHud(r).alive, 8);
});

test('updateSim 推进时间', () => {
  const r = createSim({ seed: 1 });
  const t0 = r.time;
  updateSim(r, empty);
  assert.ok(r.time > t0);
});

test('drainEvents 清空事件队列并含 start/matchStart', () => {
  const r = createSim({ seed: 1 });
  const evs = drainEvents(r);
  assert.ok(evs.some((e) => e.type === 'start'));
  assert.ok(evs.some((e) => e.type === 'matchStart'));
  assert.equal(r.events.length, 0);
});

test('拳：命中正前方敌人并造成基础伤害', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0;
  b.x = 1.5; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.equal(b.hp, 100 - FIGHTER.punch.dmg);
});

test('拳：超出射程打不中', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0;
  b.x = 3.5; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.equal(b.hp, 100);
});

test('拳：有冷却，命中后进入硬直', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0;
  b.x = 1.5; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.ok(p.punchCd > 0);
});

test('拳：受击者瘫软（ragdoll）0.8s', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0;
  b.x = 1.5; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.ok(b.ragdollT > 0.7 && b.ragdollT <= 0.8);
});

test('球棒：伤害 ×2', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0; p.weapon = 'bat'; p.weaponDur = 10;
  b.x = 1.5; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.equal(b.hp, 100 - FIGHTER.punch.dmg * WEAPONS.defs.bat.dmgMul);
});

test('拳套：攻速 ×1.5（冷却缩短）', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0; p.weapon = 'glove'; p.weaponDur = 10;
  b.x = 1.5; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.ok(p.punchCd < FIGHTER.punch.cd * 0.75);
});

test('武器：耐久耗尽自动损坏', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0; p.weapon = 'bat'; p.weaponDur = 1;
  b.x = 1.5; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.equal(p.weapon, null);
});

test('武器：走上去拾取', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0];
  r.weapons = [{ type: 'bat', x: p.x, z: p.z, respawnT: 0 }];
  updateSim(r, empty);
  assert.equal(p.weapon, 'bat');
});

test('抓：抓住最近敌人；再按扔出（腾空）', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0;
  b.x = 1; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: false, grab: true, ult: false });
  assert.equal(p.grabbing, b.id);
  step(r, 20, empty); // 冷却 0.3s
  updateSim(r, { mx: 0, mz: 0, punch: false, grab: true, ult: false });
  assert.equal(p.grabbing, null);
  assert.ok(b.airborne);
});

test('扔出场外：边缘扔出即淘汰（fall）', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = ARENA.R - 3; p.z = 0; p.facing = 0;
  b.x = p.x - 1; b.z = 0; b.hp = 100; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: false, grab: true, ult: false });
  step(r, 20, empty);
  updateSim(r, { mx: 0, mz: 0, punch: false, grab: true, ult: false });
  step(r, 150, empty);
  assert.equal(b.alive, false);
  assert.equal(r.stats.falls, 1);
});

test('HP 归零：淘汰（kill）并回血（lifesteal）', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0; p.hp = 50;
  b.x = 1.5; b.z = 0; b.hp = 10; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.equal(b.alive, false);
  assert.equal(r.stats.kills, 1);
  assert.ok(p.hp > 50); // 回血
});

test('大招：范围伤害 + 冷却', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1], c = r.fighters[2];
  r.fighters = [p, b, c];
  p.x = 0; p.z = 0;
  b.x = 2; b.z = 0; b.hp = 100; b.alive = true;
  c.x = 8; c.z = 0; c.hp = 100; c.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: false, grab: false, ult: true });
  assert.equal(b.hp, 100 - FIGHTER.ult.dmg);
  assert.equal(c.hp, 100); // 超出范围
  assert.ok(p.ultCd > 0);
});

test('bot AI：追向最近敌人', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  r.weapons = [];
  p.x = 0; p.z = 0;
  b.x = 10; b.z = 0; b.hp = 100;
  const d0 = Math.hypot(b.x - p.x, b.z - p.z);
  step(r, 30, empty);
  const d1 = Math.hypot(b.x - p.x, b.z - p.z);
  assert.ok(d1 < d0);
});

test('超时按 HP 排名：玩家血低则判负', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.hp = 10; b.hp = 50; b.alive = true;
  r.time = MATCH.time;
  updateSim(r, empty);
  assert.equal(r.phase, 'lost');
});

test('淘汰全部对手：赢下第 1 场进入升级', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0], b = r.fighters[1];
  r.fighters = [p, b];
  p.x = 0; p.z = 0; p.facing = 0;
  b.x = 1.5; b.z = 0; b.hp = 5; b.alive = true;
  updateSim(r, { mx: 0, mz: 0, punch: true, grab: false, ult: false });
  assert.equal(r.phase, 'upgrade');
  assert.equal(r.upgradeChoices.length, 3);
});

test('升级：三选一应用并推进到下一场', () => {
  const r = createSim({ seed: 1 });
  r.phase = 'upgrade';
  r.match = 1;
  r.upgradeChoices = ['hp10', 'punch-dmg', 'move-speed'];
  assert.ok(pickUpgrade(r, 'hp10'));
  assert.equal(r.match, 2);
  assert.equal(r.phase, 'match');
  assert.ok(r.upgrades.has('hp10'));
  assert.equal(r.fighters[0].maxHp, FIGHTER.hp + 10);
});

test('seed 确定性：同 seed 结果一致', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  step(a, 120, empty);
  step(b, 120, empty);
  assert.deepEqual(a.fighters.map((f) => [f.x, f.z, f.hp]), b.fighters.map((f) => [f.x, f.z, f.hp]));
});

test('决胜圈：第 5 场场地收缩', () => {
  const r = createSim({ seed: 1 });
  r.match = MATCH.rounds;
  r.time = 62;
  r.phase = 'match';
  updateSim(r, empty);
  assert.ok(r.arenaR < ARENA.R);
});

test('受控者不能自行走出场外', () => {
  const r = createSim({ seed: 1 });
  const p = r.fighters[0];
  p.x = ARENA.R - 0.5; p.z = 0;
  updateSim(r, { mx: 1, mz: 0, punch: false, grab: false, ult: false });
  assert.ok(Math.hypot(p.x, p.z) <= ARENA.R);
});

test('ratingFor 评级分档', () => {
  assert.equal(ratingFor(1300), 'S');
  assert.equal(ratingFor(800), 'A');
  assert.equal(ratingFor(500), 'B');
  assert.equal(ratingFor(0), 'C');
});
