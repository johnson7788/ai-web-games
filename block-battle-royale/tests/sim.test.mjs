import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, getRating, mulberry32 } from '../src/game/sim.js';
import { MAP, PLAYER, BOTS, WEAPONS, BUILD, ZONE } from '../config/game.config.js';

const EMPTY = { yaw: 0, pitch: 0, forward: 0, strafe: 0, fire: false, build: false, reload: false, pickup: false };

// 落地：把 run 从 drop 直接切到 playing，并把所有实体放到地面
function land(run) {
  run.phase = 'playing';
  for (const e of [run.player, ...run.bots]) e.y = 0;
}

function steps(run, input, n) {
  for (let i = 0; i < n; i++) updateSim(run, input || EMPTY);
}

test('seed 决定世界：同 seed 地形一致，异 seed 不同', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  const c = createSim({ seed: 43 });
  assert.deepEqual(Array.from(a.top), Array.from(b.top));
  assert.notDeepEqual(Array.from(a.top), Array.from(c.top));
});

test('岛内是陆地，岛外是水', () => {
  const s = createSim({ seed: 1 });
  const i = (x, z) => x + z * MAP.size;
  assert.equal(s.base[i(MAP.center, MAP.center)], 0);
  assert.equal(s.base[i(0, 0)], -1);
});

test('mulberry32 确定且分布', () => {
  const r1 = mulberry32(7), r2 = mulberry32(7);
  const a = [r1(), r1(), r1()];
  const b = [r2(), r2(), r2()];
  assert.deepEqual(a, b);
  assert.ok(a.every((v) => v >= 0 && v < 1));
});

test('30 人：1 玩家 + 29 bot', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.bots.length, BOTS.count);
  assert.equal(s.player.isPlayer, true);
});

test('玩家初始手枪，bot 有活着的', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.player.weapon, 'pistol');
  assert.ok(s.bots.some((b) => b.alive));
});

test('drop 阶段在 8s 后自动落地进入 playing', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.phase, 'drop');
  steps(s, EMPTY, Math.ceil(ZONE.stages[0].t / (1 / 60)) + 5);
  assert.equal(s.phase, 'playing');
  assert.equal(s.player.y, 0);
});

test('射击消耗弹药并发出 shot 事件', () => {
  const s = createSim({ seed: 1 });
  land(s);
  const mag = s.player.mag;
  updateSim(s, { ...EMPTY, fire: true });
  assert.equal(s.player.mag, mag - 1);
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'shot'));
});

test('射击命中敌人扣血并发出 hit 事件', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.x = 20; s.player.z = 20; s.player.yaw = 0; s.player.pitch = 0;
  const b = s.bots[0];
  b.x = 20; b.z = 19; b.y = 0; b.alive = true; b.hp = 100;
  const hp0 = b.hp;
  updateSim(s, { ...EMPTY, fire: true });
  assert.ok(b.hp < hp0, 'bot 应掉血');
  assert.ok(drainEvents(s).some((e) => e.type === 'hit'));
});

test('爆头伤害更高', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.x = 20; s.player.z = 20; s.player.yaw = 0; s.player.weapon = 'sniper';
  const b = s.bots[0];
  b.x = 20; b.z = 18; b.y = 0; b.alive = true; b.hp = 100; b.armor = 0;
  // 抬高准星打头
  s.player.pitch = Math.atan2((1.6 - 1.7), 2); // 瞄向头部
  updateSim(s, { ...EMPTY, fire: true });
  const hit = drainEvents(s).find((e) => e.type === 'hit');
  assert.equal(hit.headshot, true);
});

test('击杀掉落死亡盒与战利品', () => {
  const s = createSim({ seed: 1 });
  land(s);
  const lootBefore = s.loot.length;
  const boxesBefore = s.deathBoxes.length;
  s.player.x = 20; s.player.z = 20; s.player.yaw = 0; s.player.pitch = 0; s.player.weapon = 'sniper';
  const b = s.bots[0];
  b.x = 20; b.z = 19; b.y = 0; b.alive = true; b.hp = 10; b.weapon = 'rifle'; b.ammo = 20;
  updateSim(s, { ...EMPTY, fire: true });
  assert.equal(b.alive, false);
  assert.ok(s.deathBoxes.length > boxesBefore);
  assert.ok(s.loot.length > lootBefore);
  assert.ok(drainEvents(s).some((e) => e.type === 'kill'));
});

test('建造消耗方块并放置可破坏掩体', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.x = 20; s.player.z = 20; s.player.yaw = 0; s.player.blocks = 10;
  const blocks = s.player.blocks;
  const cx = Math.floor(20), cz = Math.floor(20 - BUILD.placeDist);
  updateSim(s, { ...EMPTY, build: true });
  assert.equal(s.player.blocks, blocks - BUILD.wallCost);
  const i = cx + cz * MAP.size;
  assert.equal(s.top[i], s.base[i] + BUILD.wallHeight);
  assert.ok(drainEvents(s).some((e) => e.type === 'build'));
});

test('掩体阻挡移动', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.x = 20; s.player.z = 20; s.player.yaw = 0; s.player.blocks = 10;
  updateSim(s, { ...EMPTY, build: true }); // 墙放在 z≈16.8
  const z0 = s.player.z;
  steps(s, { ...EMPTY, forward: 1 }, 60);
  assert.ok(s.player.z > 16.6, '不应穿过掩体');
  assert.ok(s.player.z < z0, '应该仍能移动一段');
});

test('掩体 3 hit 后可被击碎', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.x = 20; s.player.z = 20; s.player.yaw = 0; s.player.blocks = 10;
  updateSim(s, { ...EMPTY, build: true });
  const i = Math.floor(20) + Math.floor(20 - BUILD.placeDist) * MAP.size;
  const topBefore = s.top[i];
  s.player.weapon = 'sniper';
  for (let k = 0; k < 220; k++) updateSim(s, { ...EMPTY, fire: true });
  assert.ok(s.top[i] < topBefore, '掩体应被击碎一层');
});

test('捡取：靠近箱子按 E 获得物品', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.x = 30; s.player.z = 30;
  s.loot = [{ x: 30, z: 30.5, items: [{ type: 'rifle', n: 1 }, { type: 'blocks', n: 5 }], fromDeath: false }];
  const blocks = s.player.blocks;
  updateSim(s, { ...EMPTY, pickup: true });
  assert.equal(s.player.weapon, 'rifle');
  assert.ok(s.player.blocks >= blocks + 5);
  assert.ok(drainEvents(s).some((e) => e.type === 'pickup'));
});

test('缩圈推进：stage 增加、半径减小', () => {
  const s = createSim({ seed: 1 });
  land(s);
  // 玩家 + 2 bot 无敌且都在圈内，确保无人死亡、圈持续推进
  s.player.hp = 1e6; s.player.x = MAP.center; s.player.z = MAP.center;
  s.bots.slice(0, 2).forEach((b) => { b.alive = true; b.hp = 1e6; b.x = MAP.center + 1; b.z = MAP.center; b.y = 0; });
  s.bots.slice(2).forEach((b) => { b.alive = false; });
  const r0 = s.zone.r;
  steps(s, EMPTY, Math.ceil(60 / (1 / 60)));
  assert.ok(s.zone.stage >= 1, 'stage 应前进');
  assert.ok(s.zone.r < r0, '半径应缩小');
  assert.ok(drainEvents(s).some((e) => e.type === 'zone'));
});

test('圈外持续掉血', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.x = s.zone.cx + s.zone.r + 20; s.player.z = s.zone.cz;
  s.player.hp = 100;
  const hp0 = s.player.hp;
  steps(s, EMPTY, 30);
  assert.ok(s.player.hp < hp0);
});

test('全部击杀后胜利', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.bots.forEach((b) => { b.alive = false; b.hp = 0; });
  s.player.alive = true; s.player.hp = 100;
  updateSim(s, EMPTY);
  assert.equal(s.phase, 'won');
  assert.ok(drainEvents(s).some((e) => e.type === 'win'));
});

test('玩家死亡进入 dead', () => {
  const s = createSim({ seed: 1 });
  land(s);
  s.player.hp = 0;
  updateSim(s, EMPTY);
  assert.equal(s.phase, 'dead');
  assert.ok(drainEvents(s).some((e) => e.type === 'dead'));
});

test('评级：0 杀 D、8 杀 S', () => {
  const s = createSim({ seed: 1 });
  s.player.kills = 0;
  assert.equal(getRating(s), 'D');
  s.player.kills = 8;
  assert.equal(getRating(s), 'S');
});

test('getHud 反映状态', () => {
  const s = createSim({ seed: 1 });
  land(s);
  const h = getHud(s);
  assert.equal(h.weapon, 'pistol');
  assert.equal(typeof h.hp, 'number');
  assert.equal(h.alive, 1 + BOTS.count);
});

test('事件总线 drain 后清空', () => {
  const s = createSim({ seed: 1 });
  land(s);
  updateSim(s, { ...EMPTY, fire: true });
  const first = drainEvents(s);
  assert.ok(first.length > 0);
  assert.equal(drainEvents(s).length, 0);
});
