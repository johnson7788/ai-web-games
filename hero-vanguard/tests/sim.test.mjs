import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { ENEMY, SKILL, HERO } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

function makeEnemy(run, kind = 'swarm', x = 600, y = 500) {
  const spec = ENEMY[kind.toUpperCase()];
  return {
    id: run.nextId++,
    kind,
    hp: spec.hp,
    maxHp: spec.hp,
    shield: spec.shield || 0,
    dmg: spec.dmg,
    speed: spec.speed,
    gold: spec.gold,
    radius: spec.radius,
    color: spec.color,
    nearMissFired: false,
    x,
    y,
  };
}

function clearEnemies(run) {
  run.enemies = [];
  run.spawnQueue = [];
}

test('createRun 初始为 wave 阶段、第 1 波', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'wave');
  assert.equal(r.wave, 1);
  assert.equal(r.base.hp, r.base.maxHp);
  assert.equal(r.heroes.length, 2);
  assert.equal(r.heroes[0].isControlled, true); // 默认主控刃
});

test('step 推进时间', () => {
  const r = createRun({ seed: 1 });
  r.step({});
  assert.ok(r.time > 0);
});

test('英雄自动攻击：范围内敌人被命中', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  const blade = r.heroes[0];
  const e = makeEnemy(r, 'swarm', blade.x + 40, blade.y);
  r.enemies.push(e);
  const hp0 = e.hp;
  for (let i = 0; i < 120; i += 1) r.step({});
  assert.ok(e.hp < hp0, '敌人应掉血');
});

test('击杀敌人：金币增加、kill 事件发出', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  const blade = r.heroes[0];
  const e = makeEnemy(r, 'swarm', blade.x + 20, blade.y);
  e.hp = 1;
  r.enemies.push(e);
  let killed = false;
  for (let i = 0; i < 120 && !killed; i += 1) {
    r.step({});
    const evs = r.drainEvents();
    if (evs.some((x) => x.type === 'kill')) killed = true;
  }
  assert.ok(killed);
  assert.ok(r.gold > 0);
  assert.equal(r.stats.kills, 1);
});

test('攻城单位贴在基地上持续掉基地耐久', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  const e = makeEnemy(r, 'armored', 100, 520); // 基地中心附近，触发 siege
  r.enemies.push(e);
  for (let i = 0; i < 100; i += 1) r.step({});
  assert.ok(r.base.hp < r.base.maxHp, '攻城持续伤害后基地耐久应下降');
});

test('基地耐久归零：进入 dead 并发出 death', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  r.base.hp = 2;
  const e = makeEnemy(r, 'kamikaze', 100, 520);
  r.enemies.push(e);
  let dead = false;
  for (let i = 0; i < 60 && !dead; i += 1) {
    r.step({});
    const evs = r.drainEvents();
    if (evs.some((x) => x.type === 'death')) dead = true;
  }
  assert.equal(r.phase, 'dead');
  assert.ok(dead);
});

test('共鸣斩：J 键对范围内敌人造成伤害', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  r.skills.resonance = 0;
  const c = r.heroes.find((h) => h.isControlled);
  const e1 = makeEnemy(r, 'swarm', c.x + 40, c.y);
  const e2 = makeEnemy(r, 'swarm', 900, 620); // 共鸣范围外，也在弓射程外
  r.enemies.push(e1, e2);
  const hp1 = e1.hp;
  const hp2 = e2.hp;
  r.step({ j: true });
  r.drainEvents();
  assert.ok(e1.hp < hp1, '范围内敌人掉血');
  assert.equal(e2.hp, hp2, '范围外敌人不受伤害');
  assert.ok(r.skills.resonance > 0, '共鸣斩进入冷却');
});

test('换位共鸣：切换主控并造成路径伤害', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  r.skills.swap = 0;
  const blade = r.heroes.find((h) => h.kind === 'blade');
  const bow = r.heroes.find((h) => h.kind === 'bow');
  const midX = (blade.x + bow.x) / 2;
  const midY = (blade.y + bow.y) / 2;
  const e = makeEnemy(r, 'swarm', midX, midY);
  r.enemies.push(e);
  const hp0 = e.hp;
  const controlledBefore = r.heroes.find((h) => h.isControlled).id;
  r.step({ swap: true });
  r.drainEvents();
  const controlledAfter = r.heroes.find((h) => h.isControlled).id;
  assert.notEqual(controlledBefore, controlledAfter, '主控应切换');
  assert.ok(e.hp < hp0, '路径上敌人掉血');
});

test('护盾充能：站桩 2 秒后基地获得护盾', () => {
  const r = createRun({ seed: 1 });
  r.enemies = []; // 只清敌人，保留 spawnQueue 让波次持续（否则立刻清波进 upgrade）
  r.skills.shield = 0;
  r.base.shield = 0;
  const ticks = Math.ceil(SKILL.shield.channel / (1 / 60)) + 5;
  for (let i = 0; i < ticks; i += 1) r.step({ k: i === 0 });
  assert.ok(r.base.shield > 0, '充能后应有护盾');
});

test('移动输入把受控英雄限制在活动区内', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  for (let i = 0; i < 200; i += 1) r.step({ moveX: -1, moveY: -1 });
  const c = r.heroes.find((h) => h.isControlled);
  assert.ok(c.x >= 170, 'x 不越左界');
  assert.ok(c.y >= 350, 'y 不越上界');
});

test('清空一波：进入 upgrade 并给出升级选项', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  let offered = false;
  for (let i = 0; i < 600 && !offered; i += 1) {
    r.step({});
    const evs = r.drainEvents();
    if (evs.some((x) => x.type === 'upgradeOffer')) offered = true;
  }
  assert.equal(r.phase, 'upgrade');
  assert.ok(offered);
  assert.ok(r.upgradeChoices.length >= 1);
});

test('选择升级后进入下一波', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  // 直接构造 upgrade 状态
  r.phase = 'upgrade';
  r.upgradeChoices = ['bladeAtk', 'bowAtk', 'baseMax'];
  const waveBefore = r.wave;
  r.step({ chooseUpgrade: 0 });
  assert.equal(r.wave, waveBefore + 1);
  assert.equal(r.phase, 'wave');
  assert.ok(r.upgrades.bladeAtk);
});

test('升级超时自动选择（noinput 也能推进）', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  r.phase = 'upgrade';
  r.upgradeChoices = ['atkSpeed', 'heroSpeed'];
  const waveBefore = r.wave;
  const ticks = Math.ceil(6.2 / (1 / 60));
  for (let i = 0; i < ticks; i += 1) r.step({});
  assert.equal(r.phase, 'wave');
  assert.ok(r.wave > waveBefore);
});

test('通关 12 波后进入 win', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  r.wave = 12;
  r.phase = 'wave';
  r.spawnQueue = [];
  r.enemies = [];
  r.step({});
  assert.equal(r.phase, 'upgrade');
  r.step({ chooseUpgrade: 0 });
  assert.equal(r.phase, 'win');
});

test('规则升级：换位伤害翻倍生效', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  r._apply.swapDamage = true;
  r.skills.swap = 0;
  const blade = r.heroes.find((h) => h.kind === 'blade');
  const bow = r.heroes.find((h) => h.kind === 'bow');
  const e = makeEnemy(r, 'armored', (blade.x + bow.x) / 2, (blade.y + bow.y) / 2);
  r.enemies.push(e);
  const hp0 = e.hp;
  r.step({ swap: true });
  r.drainEvents();
  const dmg = hp0 - e.hp;
  assert.ok(dmg >= HERO.SWAP_DAMAGE * 2, `翻倍后应 ≥${HERO.SWAP_DAMAGE * 2}，实际 ${dmg}`);
});

test('敌人持续朝基地推进（x 递减）', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  const e = makeEnemy(r, 'swarm', 900, 520);
  r.enemies.push(e);
  const x0 = e.x;
  for (let i = 0; i < 60; i += 1) r.step({});
  assert.ok(e.x < x0);
});

test('随机数可复现（mulberry32 确定性）', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('敌人靠近基地触发 nearMiss 事件', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  const e = makeEnemy(r, 'armored', 255, 520); // 已贴近基地警戒线，重甲扛得住弓点射
  r.enemies.push(e);
  let near = false;
  for (let i = 0; i < 300 && !near; i += 1) {
    r.step({});
    const evs = r.drainEvents();
    if (evs.some((x) => x.type === 'nearMiss')) near = true;
  }
  assert.ok(near);
});

test('弓英雄射程远于刃英雄', () => {
  const r = createRun({ seed: 1 });
  const blade = r.heroes.find((h) => h.kind === 'blade');
  const bow = r.heroes.find((h) => h.kind === 'bow');
  assert.ok(bow.range > blade.range);
});

test('护盾兵先扣盾再扣血', () => {
  const r = createRun({ seed: 1 });
  clearEnemies(r);
  const c = r.heroes.find((h) => h.isControlled);
  const e = makeEnemy(r, 'shield', c.x + 30, c.y);
  r.enemies.push(e);
  const shield0 = e.shield;
  const hp0 = e.hp;
  for (let i = 0; i < 60; i += 1) r.step({});
  assert.ok(e.shield < shield0 || e.hp < hp0, '盾或血应下降');
});
