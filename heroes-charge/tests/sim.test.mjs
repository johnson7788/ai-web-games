import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { PLAYER, TOTAL_LEVELS } from '../config/gameplay.js';

test('smoke：createRun / step / getHud / drainEvents', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  r.step({});
  const hud = r.getHud();
  assert.ok(hud && typeof hud === 'object');
  assert.equal(hud.level, 1);
  const evs = r.drainEvents();
  assert.ok(Array.isArray(evs));
});

test('开局：3 敌人、满血、满冲刺能量、等级 1', () => {
  const r = createRun({ seed: 2 });
  assert.equal(r.enemies.length, 3);
  assert.equal(r.player.hp, PLAYER.MAX_HP);
  assert.equal(r.player.dashMeter, 1);
  assert.equal(r.level, 1);
  assert.equal(r.levelsReached, 1);
});

test('移动：按住右移后 x 增加', () => {
  const r = createRun({ seed: 3 });
  const x0 = r.player.x;
  for (let i = 0; i < 10; i += 1) r.step({ right: true });
  assert.ok(r.player.x > x0, 'x 应增加');
});

test('跳跃：按跳后 vy > 0 且离地', () => {
  const r = createRun({ seed: 4 });
  r.step({ jump: true });
  assert.ok(r.player.vy > 0, 'vy 应向上');
  assert.ok(!r.player.onGround, '应离地');
  assert.equal(r.player.jumpCount, 1);
});

test('落地：跳跃后多次更新落回地面并重置二段跳', () => {
  const r = createRun({ seed: 5 });
  r.step({ jump: true });
  for (let i = 0; i < 90; i += 1) r.step({});
  assert.ok(r.player.onGround, '应回到地面');
  assert.equal(r.player.y, 0);
  assert.equal(r.player.jumpCount, 0);
});

test('二段跳：空中可再跳一次，第三次无效', () => {
  const r = createRun({ seed: 6 });
  r.step({ jump: true });
  r.step({});
  r.step({ jump: true });
  assert.equal(r.player.jumpCount, 2);
  r.step({});
  r.step({ jump: true });
  assert.equal(r.player.jumpCount, 2, '第三次跳跃不应生效');
});

test('冲刺：消耗能量并显著前进', () => {
  const r = createRun({ seed: 7 });
  const m0 = r.player.dashMeter;
  const x0 = r.player.x;
  r.step({ dash: true });
  assert.ok(r.player.dashMeter < m0, '冲刺应消耗能量');
  for (let i = 0; i < PLAYER.DASH_FRAMES; i += 1) r.step({});
  assert.ok(r.player.x - x0 > 80, '冲刺应显著位移');
});

test('普攻：命中前方敌人并造成伤害', () => {
  const r = createRun({ seed: 8 });
  const e = r.enemies[0];
  // 把敌人放到玩家正前方
  r.player.x = 300;
  e.x = 340;
  const hp0 = e.hp;
  r.step({ attack: true });
  assert.ok(e.hp < hp0, '敌人应受伤');
  assert.equal(r.player.combo, 1, '命中应累计连击');
});

test('击杀：敌人 hp 归零后计数 + 掉落能量球', () => {
  const r = createRun({ seed: 9 });
  const e = r.enemies[0];
  r.player.x = 300;
  e.x = 340;
  e.hp = PLAYER.ATTACK_DAMAGE;
  r.step({ attack: true });
  assert.ok(e.dead, '敌人应死亡');
  assert.equal(r.kills, 1);
  assert.ok(r.orbs.some((o) => o.type === 'energy'), '应掉落能量球');
});

test('能量球：拾取后补冲刺能量', () => {
  const r = createRun({ seed: 10 });
  r.player.dashMeter = 0.2;
  r.orbs.push({ x: r.player.x, y: -40, type: 'energy', t: 0 });
  r.step({});
  assert.ok(r.player.dashMeter > 0.2, '拾取能量球后冲刺能量应回复');
});

test('护盾：敌人攻击被护盾挡下且不掉血', () => {
  const r = createRun({ seed: 11 });
  const e = r.enemies[0];
  r.player.x = 200;
  e.x = 230;
  e.state = 'chase';
  e.atkCd = 0;
  r.player.shield = true;
  const hp0 = r.player.hp;
  r.step({});
  assert.equal(r.player.hp, hp0, '护盾应挡下伤害');
  assert.equal(r.player.shield, false, '护盾应破碎');
});

test('失败：血量归零 → phase=dead', () => {
  const r = createRun({ seed: 12 });
  const e = r.enemies[0];
  r.player.x = 200;
  e.x = 230;
  e.state = 'chase';
  e.atkCd = 0;
  r.player.hp = 1;
  r.player.hurtT = 0;
  r.step({});
  assert.equal(r.phase, 'dead');
  assert.equal(r.player.hp, 0);
});

test('过关：清空敌人 → 推进到第 2 关', () => {
  const r = createRun({ seed: 13 });
  for (const e of r.enemies) { e.dead = true; e.state = 'dead'; }
  r.step({});
  r.step({});
  // 过关倒计时后推进
  let guard = 0;
  while (r.level === 1 && guard < 200) { guard += 1; r.step({}); }
  assert.equal(r.level, 2);
  assert.equal(r.levelsReached, 2);
});

test('通关：清空最后一关 → phase=victory', () => {
  const r = createRun({ seed: 14 });
  r.jumpTo(TOTAL_LEVELS);
  for (const e of r.enemies) { e.dead = true; e.state = 'dead'; }
  let guard = 0;
  while (r.phase === 'playing' && guard < 300) { guard += 1; r.step({}); }
  assert.equal(r.phase, 'victory');
});

test('jumpTo：跳关会重建敌人并保持可玩', () => {
  const r = createRun({ seed: 15 });
  r.jumpTo(2);
  assert.equal(r.level, 2);
  assert.equal(r.enemies.length, 4);
  assert.equal(r.phase, 'playing');
  r.step({ right: true });
  assert.equal(r.phase, 'playing');
});

test('事件：攻击/冲刺/跳跃都会产出对应事件', () => {
  const a = createRun({ seed: 16 });
  a.step({ attack: true });
  assert.ok(a.drainEvents().map((e) => e.type).includes('attack'), '应有 attack 事件');

  const d = createRun({ seed: 17 });
  d.step({ dash: true });
  assert.ok(d.drainEvents().map((e) => e.type).includes('dash'), '应有 dash 事件');

  const j = createRun({ seed: 18 });
  j.step({ jump: true });
  assert.ok(j.drainEvents().map((e) => e.type).includes('jump'), '应有 jump 事件');
});
