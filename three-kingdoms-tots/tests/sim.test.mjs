import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { CARDS, LEVELS, LEVEL_COUNT } from '../config/levels.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

function unit(side, cardId, x, hp) {
  return { id: 1000 + (side === 'player' ? 0 : 1), side, kind: 'unit', cardId, lane: 0, x, hp, maxHp: hp, atk: 20, range: 40, cd: 1, cdLeft: 0, speed: 60, aoe: 0, slowUntil: 0 };
}

test('冒烟：createRun → step → deploy → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const d = r.deploy('militia', 0, 400);
  assert.equal(d.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.equal(hud.deployCount, 1);
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：主城/箭塔/卡牌/能量', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.phase, 'playing');
  assert.equal(s.player.keep.hp, LEVELS[0].keepPlayerHp);
  assert.equal(s.enemy.keep.hp, LEVELS[0].keepEnemyHp);
  assert.equal(s.player.towers.length, 2);
  assert.equal(s.enemy.towers.length, 2);
  assert.equal(s.cards.length, CARDS.length);
  assert.equal(s.energy, 5);
  assert.equal(s.maxEnergy, 10);
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
});

test('deploy：能量扣除 + 冷却 + 出兵事件', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.energy;
  const d = r.deploy('militia', 0, 400);
  assert.equal(d.ok, true);
  assert.equal(r.state.energy, before - 1);
  assert.equal(r.state.player.units.length, 1);
  assert.equal(r.state.player.units[0].cardId, 'militia');
  const slot = r.state.cards.find((c) => c.id === 'militia');
  assert.ok(slot.cd > 0);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'spawn' && e.side === 'player'));
});

test('deploy：能量不足 / 冷却中 / 未知卡', () => {
  const r = createRun(0, { seed: 1 });
  r.state.energy = 0;
  assert.deepEqual(r.deploy('militia', 0, 400), { ok: false, reason: 'energy' });
  r.state.energy = 5;
  r.deploy('general', 0, 400);
  assert.deepEqual(r.deploy('general', 0, 400), { ok: false, reason: 'cooldown' });
  assert.deepEqual(r.deploy('nope', 0, 400), { ok: false, reason: 'unknown' });
});

test('能量恢复 + 能量事件', () => {
  const r = createRun(0, { seed: 1 });
  r.state.energy = 3;
  advance(r, 2);
  assert.ok(r.state.energy > 3);
  assert.ok(r.state.energy <= r.state.maxEnergy);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'energy'));
});

test('单位朝敌方前进', () => {
  const r = createRun(0, { seed: 1 });
  r.deploy('militia', 0, 400);
  const u = r.state.player.units[0];
  const x0 = u.x;
  advance(r, 1);
  assert.ok(r.state.player.units[0].x > x0);
});

test('战斗：近身攻击敌方箭塔', () => {
  const r = createRun(0, { seed: 1 });
  const tower = r.state.enemy.towers[0];
  const before = tower.hp;
  r.state.player.units.push(unit('player', 'militia', tower.x - 20, 500));
  advance(r, 2);
  assert.ok(r.state.enemy.towers[0].hp < before);
});

test('连击：击杀敌方单位 → combo+1', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.units.push(unit('player', 'militia', 500, 500));
  r.state.enemy.units.push(unit('enemy', 'militia', 520, 1));
  r.step(1 / 60);
  assert.equal(r.state.combo, 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'combo' && e.combo === 1));
});

test('法术：火攻对敌方造成伤害', () => {
  const r = createRun(0, { seed: 1 });
  const enemyUnit = unit('enemy', 'militia', 700, 200);
  r.state.enemy.units.push(enemyUnit);
  const before = enemyUnit.hp;
  const d = r.deploy('fire', 0, 400);
  assert.equal(d.ok, true);
  assert.ok(r.state.enemy.units[0].hp < before);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'spell' && e.cardId === 'fire'));
});

test('法术：回春恢复主城血量', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.keep.hp = 100;
  const d = r.deploy('heal', 0, 400);
  assert.equal(d.ok, true);
  assert.ok(r.state.player.keep.hp > 100);
});

test('建筑：岩壁落在己方半场并存活', () => {
  const r = createRun(0, { seed: 1 });
  const d = r.deploy('rock', 0, 500);
  assert.equal(d.ok, true);
  const rock = r.state.player.units.find((u) => u.cardId === 'rock');
  assert.ok(rock);
  assert.equal(rock.kind, 'building');
  assert.ok(rock.x >= 100 && rock.x <= 620);
});

test('胜利：摧毁敌方主城 → won + 星级', () => {
  const r = createRun(0, { seed: 1 });
  r.state.enemy.keep.hp = 5;
  for (const t of r.state.enemy.towers) t.hp = 0;
  r.state.player.units.push(unit('player', 'general', r.state.enemy.keep.x - 20, 1000));
  advance(r, 2);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1);
  assert.equal(r.state.result.won, true);
});

test('失败：己方主城被摧毁 → lost', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.keep.hp = 5;
  for (const t of r.state.player.towers) t.hp = 0;
  r.state.enemy.units.push(unit('enemy', 'general', r.state.player.keep.x + 20, 1000));
  advance(r, 2);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
});

test('超时判定：时间耗尽未破城 → 攻城方战败', () => {
  const r = createRun(0, { seed: 1 });
  r.state.time = 0.005;
  r.state.player.keep.hp = 800;
  r.state.enemy.keep.hp = 400;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'timeUp');
});

test('卡牌冷却随时间衰减', () => {
  const r = createRun(0, { seed: 1 });
  r.deploy('general', 0, 400);
  const slot = r.state.cards.find((c) => c.id === 'general');
  const cd0 = slot.cd;
  advance(r, 1);
  assert.ok(r.state.cards.find((c) => c.id === 'general').cd < cd0);
});

test('第 3 战预置岩石', () => {
  const r = createRun(2, { seed: 1 });
  const rocks = r.state.enemy.units.filter((u) => u.cardId === 'rock');
  assert.equal(rocks.length, LEVELS[2].preRocks);
});
