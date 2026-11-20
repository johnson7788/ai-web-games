import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, counterOf, isCounter, elementMult, HEROES, SKILLS, ITEMS, ENEMIES, chapterDef } from '../config/gameplay.js';
import { createBattle, stepBattle, makeHeroUnit, makeEnemyUnit, battleStartEvents } from '../src/game/battle.js';
import { mulberry32 } from '../src/game/rng.js';

function party() {
  return {
    hero: { hp: HEROES.hero.hp, mp: HEROES.hero.mp, bonusHp: 0 },
    fox: { hp: HEROES.fox.hp, mp: HEROES.fox.mp, bonusHp: 0 },
  };
}

function mkBattle(chapter = 1, overrides = {}) {
  const rng = mulberry32(1);
  const b = createBattle({ chapter: chapterDef(chapter), party: party(), inventory: { herb: 3, elixir: 2 }, rng });
  Object.assign(b, overrides);
  return b;
}

test('五行环：金克木、木克土、土克水、水克火、火克金', () => {
  assert.equal(counterOf('metal'), 'wood');
  assert.equal(counterOf('wood'), 'earth');
  assert.equal(counterOf('earth'), 'water');
  assert.equal(counterOf('water'), 'fire');
  assert.equal(counterOf('fire'), 'metal');
});

test('elementMult：克制 1.5 / 同属 0.75 / 中立 1.0', () => {
  assert.equal(elementMult('metal', 'wood'), 1.5);
  assert.equal(elementMult('metal', 'metal'), 0.75);
  assert.equal(elementMult('metal', 'water'), 1.0);
});

test('isCounter 只认相邻环', () => {
  assert.ok(isCounter('water', 'fire'));
  assert.ok(!isCounter('water', 'metal'));
});

test('速度条：满条后按顺序出手，玩家满条停下等命令', () => {
  const b = mkBattle(1);
  // 让英雄速度远高于敌人，率先满条
  b.byId.hero.speed = 10000;
  b.byId.fox.speed = 0;
  b.units.forEach((u) => { u.atb = 0; });
  const evs = stepBattle(b, 1 / 60, null);
  assert.equal(b.pending, 'hero');
  assert.ok(evs.some((e) => e.type === 'turnStart' && e.unitId === 'hero'));
});

test('普攻：金属性剑客打木属竹妖触发克制与墨晕', () => {
  const b = mkBattle(1);
  const evs = [];
  // 直接构造一个待命英雄回合
  b.pending = 'hero';
  const out = stepBattle(b, 1 / 60, { type: 'attack', target: 'enemy0' });
  assert.ok(out.some((e) => e.type === 'attack'));
  assert.ok(out.some((e) => e.type === 'counter'));
  assert.ok(out.some((e) => e.type === 'inkWash'));
  const enemy = b.byId.enemy0;
  assert.ok(enemy.hp < enemy.maxHp, '竹妖应受克制伤害');
});

test('技能：剑意蓄势使下一技能伤害 ×2 并清空蓄势', () => {
  const b = mkBattle(1);
  const hero = b.byId.hero;
  hero.swordIntent = true;
  hero.buff = 1;
  b.pending = 'hero';
  const targetHp = b.byId.enemy0.hp;
  const out = stepBattle(b, 1 / 60, { type: 'skill', skillId: 'cloudBreaker', target: 'enemy0' });
  const atkEv = out.find((e) => e.type === 'skill');
  assert.ok(atkEv, '应产生 skill 事件');
  assert.equal(hero.swordIntent, false, '蓄势应被消耗');
  assert.equal(hero.buff, 1, '倍率应在施放后复原');
  assert.ok(out.some((e) => e.type === 'swordIntentUsed'));
  assert.ok(b.byId.enemy0.hp < targetHp);
});

test('防御：hero 防御蓄剑意，敌人伤害减半', () => {
  const b = mkBattle(1);
  b.pending = 'hero';
  let out = stepBattle(b, 1 / 60, { type: 'defend' });
  assert.ok(out.some((e) => e.type === 'defend'));
  assert.equal(b.byId.hero.swordIntent, true);
  assert.equal(b.byId.hero.defend, true);
});

test('灵狐替身：hero 将死时 fox 挡下并离场 2 回合', () => {
  const b = mkBattle(1);
  const hero = b.byId.hero;
  const fox = b.byId.fox;
  hero.hp = 3;
  fox.hp = 100;
  b.foxGuard = true;
  b.foxCooldown = 0;
  // 敌人直接攻击 hero
  const enemy = b.byId.enemy0;
  enemy.atk = 999;
  b.pending = null;
  // 推敌人满条
  b.byId.enemy0.atb = 1000;
  b.byId.hero.atb = 0;
  b.byId.fox.atb = 0;
  const out = stepBattle(b, 1 / 60, null);
  assert.ok(out.some((e) => e.type === 'foxSub'));
  assert.ok(out.some((e) => e.type === 'foxLeave'));
  assert.equal(hero.alive, true, 'hero 应存活');
  assert.equal(b.foxCooldown, 2);
  assert.ok(fox.hp > 0, '灵狐保命资源：至少剩 1 点血');
});

test('灵狐冷却：两回合后归来', () => {
  const b = mkBattle(1);
  b.foxCooldown = 2;
  b.pending = 'hero';
  let out = stepBattle(b, 1 / 60, { type: 'attack', target: 'enemy0' });
  assert.equal(b.foxCooldown, 1);
  b.pending = 'hero';
  out = stepBattle(b, 1 / 60, { type: 'attack', target: 'enemy0' });
  assert.equal(b.foxCooldown, 0);
  assert.ok(out.some((e) => e.type === 'foxReturn'));
});

test('换人：可切换 activeHero；灵狐冷却时不能切到 fox', () => {
  const b = mkBattle(1);
  b.pending = 'hero';
  stepBattle(b, 1 / 60, { type: 'switch' });
  assert.equal(b.activeHero, 'fox');

  // 冷却期间从 hero 切 fox 被拒
  b.activeHero = 'hero';
  b.foxCooldown = 2;
  b.pending = 'hero';
  const out = stepBattle(b, 1 / 60, { type: 'switch' });
  assert.equal(b.activeHero, 'hero', '不应切换到冷却中的 fox');
  assert.ok(out.some((e) => e.type === 'switchBlocked'));
});

test('道具：止血草回血并扣库存', () => {
  const b = mkBattle(1);
  b.byId.hero.hp = 10;
  b.pending = 'hero';
  const before = b.inventory.herb;
  const out = stepBattle(b, 1 / 60, { type: 'item', itemId: 'herb' });
  assert.ok(out.some((e) => e.type === 'item'));
  assert.equal(b.inventory.herb, before - 1);
  assert.ok(b.byId.hero.hp > 10);
});

test('敌人全灭 → 胜利；我方全灭 → 失败', () => {
  const bWin = mkBattle(1);
  bWin.byId.enemy0.hp = 1;
  bWin.pending = 'hero';
  stepBattle(bWin, 1 / 60, { type: 'attack', target: 'enemy0' });
  assert.equal(bWin.over, true);
  assert.equal(bWin.victory, true);

  const bLose = mkBattle(1);
  bLose.byId.hero.hp = 1;
  bLose.byId.fox.alive = false;   // 只剩 hero，会被一击带走
  bLose.foxGuard = false;         // 关替身，保证会死
  bLose.pending = null;
  bLose.byId.enemy0.atb = 1000;
  bLose.byId.enemy0.atk = 999;
  bLose.byId.hero.atb = 0;
  bLose.byId.fox.atb = 0;
  stepBattle(bLose, 1 / 60, null);
  assert.equal(bLose.over, true);
  assert.equal(bLose.victory, false);
});

test('battleStartEvents 列出敌人与章节', () => {
  const b = mkBattle(2);
  const evs = battleStartEvents(b);
  assert.equal(evs[0].type, 'battleStart');
  assert.equal(evs[0].chapter, 2);
  assert.ok(evs[0].enemies.length >= 1);
});
