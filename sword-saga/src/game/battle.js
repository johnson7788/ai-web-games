// src/game/battle.js — 回合制战斗纯逻辑：速度条出手 / 五行相克 / 灵狐替身 / 剑意蓄势 / 换人。
// 不碰 DOM/window；随机用注入 rng；所有数值来自 config/gameplay.js。
import {
  ELEMENTS, isCounter, elementMult, ATB, HEROES, SKILLS, ITEMS, ENEMIES,
} from '../../config/gameplay.js';

// ---------------------------------------------------------------------------
// 单位构造
// ---------------------------------------------------------------------------

export function makeHeroUnit(heroDef, current) {
  return {
    id: heroDef.id,
    side: 'player',
    nameKey: heroDef.nameKey,
    element: heroDef.element,
    hp: current.hp,
    maxHp: heroDef.hp + (current.bonusHp || 0),
    mp: current.mp,
    maxMp: heroDef.mp,
    atk: heroDef.atk,
    magic: heroDef.magic,
    def: heroDef.def,
    speed: heroDef.speed,
    skills: heroDef.skills.slice(),
    alive: true,
    defend: false,
    swordIntent: false,   // 仅 hero 使用
    atb: 0,
    buff: 1,              // 技能伤害倍率（剑意蓄势为 2）
  };
}

export function makeEnemyUnit(enemyDef, idx) {
  const d = enemyDef;
  return {
    id: `enemy${idx}`,
    side: 'enemy',
    nameKey: d.nameKey,
    element: d.element,
    boss: !!d.boss,
    hp: d.hp,
    maxHp: d.hp,
    mp: 999,
    maxMp: 999,
    atk: d.atk,
    magic: d.magic,
    def: d.def,
    speed: d.speed,
    skills: [],
    alive: true,
    defend: false,
    swordIntent: false,
    atb: 0,
    buff: 1,
  };
}

export function createBattle({ chapter, party, inventory, rng }) {
  const heroes = ['hero', 'fox'];
  const units = [];
  const byId = {};
  for (const id of heroes) {
    const u = makeHeroUnit(HEROES[id], party[id]);
    units.push(u);
    byId[id] = u;
  }
  chapter.battles[0].forEach((enemyId, idx) => {
    const u = makeEnemyUnit(ENEMIES[enemyId], idx);
    units.push(u);
    byId[u.id] = u;
  });

  // 第一场速度条错峰：避免双方同刻满条导致顺序抖动。
  units.forEach((u, i) => { u.atb = (i * 17) % 40; });

  return {
    chapter: chapter.chapter,
    boss: !!chapter.boss,
    rng,
    units,
    byId,
    activeHero: 'hero',
    pending: null,
    foxCooldown: 0,
    foxGuard: true,
    turn: 0,
    time: 0,
    over: false,
    victory: false,
    ink: null,          // { element, t } 全屏墨晕
    inventory: { ...inventory },
  };
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function aliveUnits(battle, side) {
  return battle.units.filter((u) => u.side === side && u.alive);
}

function emit(events, type, fields = {}) {
  events.push({ type, ...fields });
}

// ---------------------------------------------------------------------------
// 伤害结算（含五行克制 / 防御减半 / 灵狐替身）
// ---------------------------------------------------------------------------

function dealDamage(battle, events, attacker, target, { base, element, kind, skillId }) {
  let mult = elementMult(element, target.element);
  const counter = isCounter(element, target.element);
  let dmg = Math.max(1, Math.round(base * mult * attacker.buff));
  dmg = Math.round(dmg * (0.9 + battle.rng() * 0.2));   // 0.9–1.1 浮动
  if (target.defend) dmg = Math.max(1, Math.round(dmg * 0.5));
  target.defend = false;

  const wasAlive = target.alive;
  let newHp = target.hp - dmg;

  // 灵狐替身：剑客将死时，灵狐挡下致命一击（保命资源，之后 2 回合离场）。
  if (target.id === 'hero' && newHp <= 0) {
    const fox = battle.byId.fox;
    if (fox && fox.alive && battle.foxGuard && battle.foxCooldown === 0) {
      fox.hp = Math.max(1, fox.hp - dmg);
      battle.foxCooldown = 2;
      if (battle.activeHero === 'fox') battle.activeHero = 'hero';
      emit(events, 'foxSub', { fromId: 'fox', forId: 'hero', damage: dmg });
      emit(events, 'foxLeave', { turns: battle.foxCooldown });
      if (kind === 'skill' || kind === 'attack') {
        emit(events, 'blocked', { attackerId: attacker.id, targetId: target.id });
      }
      return { damage: dmg, blocked: true };
    }
  }

  target.hp = Math.max(0, newHp);
  const died = target.alive && target.hp <= 0;
  if (died) {
    target.alive = false;
    emit(events, target.side === 'enemy' ? 'enemyDown' : 'heroDown', {
      unitId: target.id, nameKey: target.nameKey, boss: !!target.boss,
    });
  }

  if (counter && dmg > 0) {
    emit(events, 'inkWash', { element });
    emit(events, 'counter', { element, damage: dmg });
  }

  const baseFields = {
    actorId: attacker.id,
    targetId: target.id,
    damage: dmg,
    element,
    counter,
    critical: false,
  };
  emit(events, kind, kind === 'skill' ? { ...baseFields, skillId } : baseFields);

  void wasAlive;
  return { damage: dmg, blocked: false };
}

// ---------------------------------------------------------------------------
// 回合执行
// ---------------------------------------------------------------------------

function resolvePlayerTurn(battle, events, cmd) {
  const actor = battle.byId[battle.pending];
  battle.pending = null;
  if (!actor || !actor.alive) return;

  actor.defend = false;           // 自己行动时解除防御姿态
  battle.turn += 1;

  const enemies = aliveUnits(battle, 'enemy');

  switch (cmd && cmd.type) {
    case 'attack': {
      const target = pickEnemyTarget(battle, enemies, cmd.target);
      if (target) {
        const base = actor.atk - target.def * 0.5;
        dealDamage(battle, events, actor, target, { base, element: actor.element, kind: 'attack' });
      }
      break;
    }
    case 'skill': {
      const skill = SKILLS[cmd.skillId];
      if (!skill) break;
      if (actor.mp < skill.mp) { emit(events, 'noMp', { actorId: actor.id }); break; }
      const target = pickEnemyTarget(battle, enemies, cmd.target);
      if (!target) break;
      actor.mp -= skill.mp;
      let buff = actor.buff;
      let swordIntent = false;
      if (actor.id === 'hero' && actor.swordIntent) {
        actor.swordIntent = false;
        actor.buff = 2;
        buff = 2;
        swordIntent = true;
        emit(events, 'swordIntentUsed', { actorId: actor.id });
      }
      const base = skill.power + actor.magic * 0.8 - target.def * 0.4;
      dealDamage(battle, events, actor, target, { base, element: skill.element, kind: 'skill', skillId: skill.id });
      if (swordIntent) {
        // 倍率只作用一次；事件后复原
        actor.buff = 1;
      }
      break;
    }
    case 'item': {
      const item = ITEMS[cmd.itemId];
      if (!item) break;
      const have = battle.inventory[item.id] || 0;
      if (have <= 0) { emit(events, 'noItem', { actorId: actor.id }); break; }
      battle.inventory[item.id] = have - 1;
      const healHp = Math.min(actor.maxHp - actor.hp, item.healHp);
      const healMp = Math.min(actor.maxMp - actor.mp, item.healMp);
      actor.hp += healHp;
      actor.mp += healMp;
      emit(events, 'item', { actorId: actor.id, itemId: item.id, healHp, healMp });
      break;
    }
    case 'defend': {
      actor.defend = true;
      if (actor.id === 'hero') {
        actor.swordIntent = true;
        emit(events, 'swordIntentCharged', { actorId: actor.id });
      }
      emit(events, 'defend', { actorId: actor.id, swordIntent: actor.id === 'hero' });
      break;
    }
    case 'switch': {
      const other = actor.id === 'hero' ? 'fox' : 'hero';
      const otherUnit = battle.byId[other];
      if (otherUnit && otherUnit.alive && !(other === 'fox' && battle.foxCooldown > 0)) {
        battle.activeHero = other;
        emit(events, 'switch', { fromId: actor.id, toId: other });
      } else {
        emit(events, 'switchBlocked', { toId: other });
      }
      break;
    }
    case 'guard': {
      battle.foxGuard = !battle.foxGuard;
      emit(events, 'foxGuardToggle', { on: battle.foxGuard });
      break;
    }
    default:
      break;
  }

  // 灵狐冷却递减（每完成一次我方行动 -1）
  if (battle.foxCooldown > 0) {
    battle.foxCooldown -= 1;
    if (battle.foxCooldown === 0) {
      emit(events, 'foxReturn', {});
    }
  }

  // 胜负判定
  if (aliveUnits(battle, 'enemy').length === 0) {
    battle.over = true;
    battle.victory = true;
    emit(events, 'victory', { chapter: battle.chapter, boss: battle.boss });
  } else if (aliveUnits(battle, 'player').length === 0) {
    battle.over = true;
    battle.victory = false;
    emit(events, 'defeat', { chapter: battle.chapter });
  }
}

function pickEnemyTarget(battle, enemies, targetId) {
  if (targetId) {
    const t = battle.byId[targetId];
    if (t && t.side === 'enemy' && t.alive) return t;
  }
  if (!enemies.length) return null;
  // 打最残的敌人（贪心/直觉）
  return enemies.slice().sort((a, b) => a.hp - b.hp)[0];
}

function resolveEnemyTurn(battle, events, enemy) {
  enemy.defend = false;
  const heroes = aliveUnits(battle, 'player');
  if (!heroes.length) return;
  const target = heroes.slice().sort((a, b) => a.hp - b.hp)[0];
  const base = enemy.atk - target.def * 0.4;
  dealDamage(battle, events, enemy, target, { base, element: enemy.element, kind: 'enemyAttack' });
  if (aliveUnits(battle, 'player').length === 0) {
    battle.over = true;
    battle.victory = false;
    emit(events, 'defeat', { chapter: battle.chapter });
  }
}

// ---------------------------------------------------------------------------
// 主步进：dt 秒；command 为玩家菜单命令（可选）。
// ---------------------------------------------------------------------------

export function stepBattle(battle, dt, command) {
  const events = [];
  battle.time += dt;

  if (battle.over) {
    // ink 淡出计时
    if (battle.ink) { battle.ink.t += dt; if (battle.ink.t > 1.2) battle.ink = null; }
    return events;
  }

  if (battle.pending) {
    if (command && command.type) {
      resolvePlayerTurn(battle, events, command);
      if (battle.ink) battle.ink.t += dt;
    }
    return events;
  }

  // 无待命命令：推进速度条（仅我方 active 英雄 + 敌人）
  const actors = battle.units.filter((u) => {
    if (!u.alive) return false;
    if (u.side === 'enemy') return true;
    return u.id === battle.activeHero && !(u.id === 'fox' && battle.foxCooldown > 0);
  });

  // 速度条每帧都在动 = 可感知反馈（消除回合制遥测里的「空转」误判）
  emit(events, 'atb', { active: battle.activeHero });

  const order = [];
  for (const u of actors) {
    u.atb += u.speed * ATB.RATE * dt * 60;   // dt 秒 → 60Hz 基准
    if (u.atb >= ATB.THRESHOLD) order.push(u);
  }
  order.sort((a, b) => b.atb - a.atb);

  for (const u of order) {
    if (battle.over) break;
    if (!u.alive) continue;
    if (u.side === 'enemy') {
      u.atb = 0;
      emit(events, 'turnStart', { unitId: u.id, side: 'enemy' });
      resolveEnemyTurn(battle, events, u);
    } else {
      // 我方英雄满条 → 停下等玩家命令
      u.atb = 0;
      battle.pending = u.id;
      emit(events, 'turnStart', { unitId: u.id, side: 'player', activeHero: battle.activeHero });
      break;   // 一次只处理一个玩家命令
    }
  }

  if (battle.ink) { battle.ink.t += dt; if (battle.ink.t > 1.2) battle.ink = null; }
  return events;
}

// 战斗初始化事件
export function battleStartEvents(battle) {
  const events = [];
  emit(events, 'battleStart', {
    chapter: battle.chapter,
    boss: battle.boss,
    enemies: battle.units.filter((u) => u.side === 'enemy').map((u) => ({
      id: u.id, nameKey: u.nameKey, element: u.element,
    })),
  });
  return events;
}

// 战斗结束回血
export function applyPostBattle(party, won) {
  for (const id of ['hero', 'fox']) {
    const p = party[id];
    const h = HEROES[id];
    if (won) {
      p.hp = Math.min(h.hp + (p.bonusHp || 0), p.hp + Math.round(h.hp * 0.4));
      p.mp = Math.min(h.mp, p.mp + Math.round(h.mp * 0.3));
    }
  }
}

export { ELEMENTS, isCounter, elementMult };
