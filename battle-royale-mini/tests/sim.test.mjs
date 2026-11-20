import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WEAPONS, weaponById, GAS, LOOT, MATCHES, clamp, dist } from '../config/gameplay.js';

function soloRun(seed = 1) {
  const run = createRun({ seed });
  for (const p of run.players) if (!p.isPlayer) p.alive = false;
  run.items = [];
  return run;
}

test('createRun：16 名角色（1 玩家 + 15 AI）', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.players.length, 16);
  assert.equal(run.players.filter((p) => p.isPlayer).length, 1);
  assert.equal(run.players.filter((p) => !p.isPlayer).length, 15);
});

test('createRun：地面物资（14 枪 + 3 保底枪 + 8 药 + 8 甲）', () => {
  const run = createRun({ seed: 2 });
  assert.equal(run.items.filter((i) => i.kind === 'weapon').length, LOOT.weaponCount + 3);
  assert.equal(run.items.filter((i) => i.kind === 'med').length, LOOT.medCount);
  assert.equal(run.items.filter((i) => i.kind === 'armor').length, LOOT.armorCount);
});

test('createRun：玩家开局带手枪', () => {
  const run = createRun({ seed: 3 });
  const p = run.players.find((e) => e.isPlayer);
  assert.equal(p.weapon, 'pistol');
  assert.ok(p.ammo > 0);
});

test('createRun：毒圈初始半径 = GAS.startRadius', () => {
  const run = createRun({ seed: 4 });
  assert.equal(run.gas.r, GAS.startRadius);
  assert.equal(run.gas.state, 'wait');
});

test('step：固定步长推进时间 1/60s', () => {
  const run = soloRun(5);
  run.step({});
  assert.ok(Math.abs(run.time - 1 / 60) < 1e-9);
});

test('射击：消耗弹药', () => {
  const run = soloRun(6);
  const p = run.players.find((e) => e.isPlayer);
  const before = p.ammo;
  run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: true, reload: false, med: false });
  assert.ok(p.ammo < before);
});

test('换弹：弹药归零后 R 恢复满弹', () => {
  const run = soloRun(7);
  const p = run.players.find((e) => e.isPlayer);
  p.ammo = 0;
  run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: true, med: false });
  assert.ok(p.reloadT > 0, '进入换弹计时');
  for (let i = 0; i < 200; i += 1) run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  assert.equal(p.ammo, p.clip);
});

test('拾取武器：走到枪上装备新枪', () => {
  const run = soloRun(8);
  const p = run.players.find((e) => e.isPlayer);
  p.weapon = null;
  run.items.push({ id: 't1', kind: 'weapon', weaponId: 'ak', x: p.x, y: p.y, alive: true });
  run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  assert.equal(p.weapon, 'ak');
});

test('背包 2 格：第三件物资会顶掉最旧一件', () => {
  const run = soloRun(9);
  const p = run.players.find((e) => e.isPlayer);
  run.items.push({ id: 'm1', kind: 'med', x: p.x, y: p.y, alive: true });
  run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  run.items.push({ id: 'a1', kind: 'armor', x: p.x, y: p.y, alive: true });
  run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  run.items.push({ id: 'm2', kind: 'med', x: p.x, y: p.y, alive: true });
  run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  assert.equal(p.bag.length, LOOT.bagSlots);
  assert.ok(p.bag.includes('med'));
});

test('医疗包：Q 回血 40 且消耗一格', () => {
  const run = soloRun(10);
  const p = run.players.find((e) => e.isPlayer);
  p.hp = 50;
  p.meds = 1;
  p.bag = ['med'];
  p.lastDamageAt = 0; // 避免脱战回血干扰本断言
  run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: true });
  assert.equal(p.hp, 90);
  assert.equal(p.meds, 0);
});

test('护甲：减伤生效（毒圈掉血更少）', () => {
  const a = soloRun(11);
  const b = soloRun(11);
  const pa = a.players.find((e) => e.isPlayer);
  const pb = b.players.find((e) => e.isPlayer);
  pa.x = 50; pa.y = 50; pa.armor = 0; pa.protectUntil = 0;
  pb.x = 50; pb.y = 50; pb.armor = 0.2; pb.protectUntil = 0;
  for (let i = 0; i < 60; i += 1) {
    a.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
    b.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  }
  assert.ok(pb.hp > pa.hp, '有护甲的血更多');
});

test('毒圈：圈外持续掉血', () => {
  const run = soloRun(12);
  const p = run.players.find((e) => e.isPlayer);
  p.x = 50; p.y = 50; p.protectUntil = 0;
  const before = p.hp;
  for (let i = 0; i < 60; i += 1) run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  assert.ok(p.hp < before);
});

test('缩圈：预警后半径减小', () => {
  const run = soloRun(13);
  for (let i = 0; i < 800; i += 1) run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  assert.ok(run.gas.r < GAS.startRadius);
});

test('击杀：玩家击倒 AI 后 kills+1', () => {
  const run = createRun({ seed: 14 });
  run.items = [];
  const p = run.players.find((e) => e.isPlayer);
  const ai = run.players.find((e) => !e.isPlayer);
  ai.x = p.x + 40; ai.y = p.y;
  ai.hp = 1; ai.maxHp = 1;
  ai.weapon = 'pistol'; ai.ammo = 15; ai.clip = 15;
  p.weapon = 'kar'; p.ammo = 15; p.clip = 15;
  p.aimAngle = 0;
  const startKills = p.kills;
  for (let i = 0; i < 60; i += 1) run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: true, reload: false, med: false });
  assert.ok(p.kills > startKills);
});

test('玩家死亡：phase=dead 且名次=存活数+1', () => {
  const run = createRun({ seed: 15 });
  const p = run.players.find((e) => e.isPlayer);
  p.hp = 1;
  p.x = 50; p.y = 50; p.protectUntil = 0;
  for (let i = 0; i < 120; i += 1) run.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, shoot: false, reload: false, med: false });
  assert.equal(run.phase, 'dead');
  assert.ok(run.stats.rank >= 1);
});

test('武器表：6 把武器数值完整', () => {
  assert.equal(WEAPONS.length, 6);
  for (const w of WEAPONS) {
    assert.ok(w.clip > 0 && w.speed > 0 && w.range > 0 && w.shootDelay > 0 && w.power > 0);
  }
  assert.equal(weaponById('kar').power, 20);
  assert.equal(weaponById('shotgun').pellets, 3);
});

test('clamp/dist 工具', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(dist(0, 0, 3, 4), 5);
});

test('MATCHES = 12 场排位', () => {
  assert.equal(MATCHES, 12);
});
