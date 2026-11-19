import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD, STEP } from '../config/game.config.js';
import { STAGES, PLAYER_WEAPONS, PLAYER_SKILLS, DODGE } from '../config/balance.js';

function idle(r, sec) {
  for (let i = 0; i < Math.ceil(sec / STEP); i += 1) r.step(STEP);
}

test('初始状态：三关、满血满内力、playing', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.stage, 1);
  assert.equal(r.state.self.hp, r.state.self.maxHp);
  assert.equal(r.state.self.mp, r.state.self.maxMp);
  assert.equal(STAGES.length, 3);
});

test('发射兵器扣内力并进入冷却', () => {
  const r = createRun({ seed: 1 });
  const w = PLAYER_WEAPONS[0];
  const mp0 = r.state.self.mp;
  const res = r.playerLaunchWeapon(0);
  assert.equal(res.ok, true);
  assert.equal(r.state.self.mp, mp0 - w.cost);
  assert.ok(r.state.selfWeapons[0].cdLeft > 0);
});

test('内力不足时发射被拒绝', () => {
  const r = createRun({ seed: 1 });
  r.state.self.mp = 0;
  const res = r.playerLaunchWeapon(0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'mp');
});

test('冷却中发射被拒绝', () => {
  const r = createRun({ seed: 1 });
  r.playerLaunchWeapon(0);
  const res2 = r.playerLaunchWeapon(0);
  assert.equal(res2.ok, false);
  assert.equal(res2.reason, 'cd');
});

test('兵器命中敌人扣血（敌方不闪避）', () => {
  const r = createRun({ seed: 2 });
  r.state.other.ai.dodgeReflex = 0;
  r.state.other.ai.aggression = 0;
  const hp0 = r.state.other.hp;
  r.playerLaunchWeapon(0);
  idle(r, 3);
  assert.ok(r.state.other.hp < hp0, `敌人应受伤：${r.state.other.hp} vs ${hp0}`);
  assert.ok(r.state.self.combo >= 1);
});

test('命中后连击上升，被击中后连击归零', () => {
  const r = createRun({ seed: 3 });
  r.state.other.ai.dodgeReflex = 0;
  r.state.other.ai.aggression = 0;
  r.playerLaunchWeapon(0);
  idle(r, 3);
  assert.ok(r.state.self.combo >= 1);
  // 直接命中玩家，连击应清零
  r.state.self.combo = 5;
  r.state.other.attack = 0; // 无伤害但会触发 dealHit 重置连击
  // 用低攻击力敌方兵器命中自己
  r.state.projectiles.push({ id: 'x', owner: 'other', type: 1, attack: 0, durable: 10, skillId: null, skill: {}, skillEffect: false, startX: WORLD.OTHER_X - 50, endX: WORLD.SELF_X - 50, dir: -1, baseY: 450, arc: 0, t: 0.9, lag: 0, dead: false });
  idle(r, 1);
  assert.equal(r.state.self.combo, 0);
});

test('闪避开启无敌并进入冷却', () => {
  const r = createRun({ seed: 4 });
  const res = r.playerDodge();
  assert.equal(res.ok, true);
  assert.equal(r.getHud().self.dodging, true);
  assert.ok(r.state.selfDodge.cdLeft > 0);
});

test('闪避期间敌方兵器穿过不受伤', () => {
  const r = createRun({ seed: 5 });
  const hp0 = r.state.self.hp;
  r.playerDodge();
  r.state.projectiles.push({ id: 'x', owner: 'other', type: 1, attack: 500, durable: 10, skillId: null, skill: {}, skillEffect: false, startX: WORLD.OTHER_X - 50, endX: WORLD.SELF_X - 50, dir: -1, baseY: 450, arc: 0, t: 0.8, lag: 0, dead: false });
  idle(r, 0.8);
  assert.equal(r.state.self.hp, hp0);
});

test('内力随时间恢复', () => {
  const r = createRun({ seed: 6 });
  r.state.self.mp = 0;
  idle(r, 1);
  assert.ok(r.state.self.mp > 0);
});

test('技能龙斩扣内力并发射高弧刃', () => {
  const r = createRun({ seed: 7 });
  const mp0 = r.state.self.mp;
  const res = r.playerUseSkill(0);
  assert.equal(res.ok, true);
  assert.equal(r.state.self.mp, mp0 - PLAYER_SKILLS[0].cost);
  assert.ok(r.state.projectiles.length >= 1);
});

test('技能回气恢复生命', () => {
  const r = createRun({ seed: 8 });
  r.state.self.hp = 100;
  const res = r.playerUseSkill(1);
  assert.equal(res.ok, true);
  assert.ok(r.state.self.hp > 100);
});

test('击败对手进入下一关并重置状态', () => {
  const r = createRun({ seed: 9 });
  r.state.other.ai.dodgeReflex = 0;
  r.state.other.ai.aggression = 0;
  r.state.other.hp = 50;
  r.state.self.mp = r.state.self.maxMp;
  r.playerLaunchWeapon(2);
  for (let i = 0; i < 600 && r.state.stage === 1; i += 1) r.step(STEP);
  assert.equal(r.state.stage, 2);
  assert.equal(r.state.self.hp, r.state.self.maxHp);
  assert.equal(r.state.phase, 'playing');
});

test('击败第三关对手进入 won', () => {
  const r = createRun({ seed: 10 });
  // 跳到第三关并一击制胜
  r.state.stage = 3;
  r.state.other = { ...r.state.other, maxHp: 50, hp: 50, maxMp: 100, mp: 100, strength: 300, bone: 130, critProb: 20, critHarm: 150, combo: 0, buff: null, poison: null, dodging: 0, ai: { think: 100, aggression: 0, dodgeReflex: 0, skillBias: 0, thinkAccum: 0 } };
  r.state.self.mp = r.state.self.maxMp;
  r.state.otherWeapons = [];
  r.state.otherSkills = [];
  r.playerLaunchWeapon(2);
  idle(r, 4);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.getHud().stars >= 1);
});

test('玩家血量归零进入 lost', () => {
  const r = createRun({ seed: 11 });
  r.state.self.hp = 20;
  r.state.self.mp = r.state.self.maxMp;
  r.state.other.aggression = 1;
  r.state.other.dodgeReflex = 0;
  r.state.otherWeapons = [{ key: 'e', type: 1, attack: 500, cost: 5, cd: 0.1, maxCd: 0.1, cdLeft: 0, durable: 50, skillId: null, skillProb: 0, skill: {} }];
  r.state.other.ai.think = 0.1;
  idle(r, 6);
  assert.equal(r.state.phase, 'lost');
});

test('星陨石会生成并可被拾取回血', () => {
  const r = createRun({ seed: 12 });
  r.state.orbTimer = 0;
  r.state.self.hp = 100;
  // 直接生成一颗回血星陨石并拾取
  r.state.orbs = [{ id: 'o1', x: 640, y: 420, kind: 'heal', ttl: 4, dead: false }];
  r.state.projectiles.push({ id: 'x', owner: 'self', type: 1, attack: 10, durable: 10, skillId: null, skill: {}, skillEffect: false, startX: 300, endX: 640, dir: 1, baseY: 420, arc: 0, t: 0.7, lag: 0, dead: false });
  idle(r, 1);
  assert.ok(r.state.self.hp > 100 || r.state.stats.orbsTaken >= 1);
});

test('事件流包含丰富种类', () => {
  const r = createRun({ seed: 13 });
  r.state.other.ai.dodgeReflex = 0;
  idle(r, 5);
  const seen = new Set();
  for (let i = 0; i < 10; i += 1) {
    r.playerLaunchWeapon(i % 3);
    idle(r, 2);
  }
  // 清空并收集
  for (let t = 0; t < 600; t += 1) {
    for (const e of r.drainEvents()) seen.add(e.type);
    r.step(STEP);
    if (r.state.phase !== 'playing') break;
  }
  assert.ok(seen.size >= 5, `事件种类应丰富：${[...seen].join(',')}`);
});
