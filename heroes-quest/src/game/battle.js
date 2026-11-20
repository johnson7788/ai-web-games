// src/game/battle.js — 回合制战斗引擎（纯逻辑，零依赖）
// 速度条：每单位 nextAt = time + turnBase / speed；时间推进时到期单位依次行动。
// 英雄到期 → 暂停等玩家指令（waiting）；敌人到期 → AI 自动行动。
// 技能有 CD；「远征军势」是共享充能（run.signature 跨战斗保留）。
import { ROWS, BATTLE, ENEMIES, CHAPTER_DIFF } from '../../config/gameplay.js';
import { chapterOf } from '../../config/levels.js';

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

// ---------- 有效属性（阵位 / 饥饿 / buff / 升级修改器） ----------
export function effAtk(u, run) {
  let a = u.atk;
  if (u.side === 'hero') {
    a *= ROWS[u.row].dmgDealt;
    if (u.buffAtk > 0) a *= 1 + u.buffAtk;
    if (run.starving && !run.mods.starvingImmune) a *= 0.9;
  }
  return a;
}

export function effDef(u, run) {
  let d = u.def;
  if (u.side === 'hero') {
    d *= ROWS[u.row].dmgTaken;
    if (u.row === 0) d *= run.mods.frontDmgTaken;
    if (u.row === 2) d *= run.mods.backDmgTaken;
    if (run.starving && !run.mods.starvingImmune) d *= 0.9;
  }
  return d;
}

function heroDamage(attacker, defender, run, mult = 1, power = 1) {
  const atk = effAtk(attacker, run);
  const def = effDef(defender, run);
  let dmg = atk * mult * power - def * BATTLE.defFactor;
  if (defender.side === 'enemy' && defender.markedTurns > 0) dmg *= (defender.markMult || 1.6);
  return Math.max(1, Math.round(dmg));
}

function enemyDamage(attacker, defender, run) {
  const atk = attacker.atk;
  const def = effDef(defender, run);
  return Math.max(1, Math.round(atk - def * BATTLE.defFactor));
}

// ---------- 目标选择 ----------
export function pickEnemyTarget(battle) {
  const heroes = battle.units.filter((u) => u.side === 'hero' && u.alive);
  if (!heroes.length) return null;
  const taunt = heroes.find((u) => u.tauntTurns > 0);
  if (taunt) return taunt;
  heroes.sort((a, b) => a.row - b.row || a.nextAt - b.nextAt);
  return heroes[0];
}

function aliveEnemies(battle) {
  return battle.units.filter((u) => u.side === 'enemy' && u.alive);
}
function aliveHeroes(battle) {
  return battle.units.filter((u) => u.side === 'hero' && u.alive);
}

// ---------- 结算 ----------
function hurt(run, battle, unit, dmg, attacker) {
  if (unit.shield > 0) {
    const absorbed = Math.min(unit.shield, dmg);
    unit.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg <= 0) return;
  unit.hp = Math.max(0, unit.hp - dmg);
  if (unit.hp <= 0) {
    unit.alive = false;
    if (unit.side === 'hero') {
      emit(run, 'heroDown', { heroId: unit.id });
      run.signature = Math.min(BATTLE.signatureMax, run.signature + BATTLE.chargePerDown);
    } else {
      emit(run, 'kill', { unitId: unit.id, by: attacker ? attacker.id : null });
    }
  }
}

function healUnit(run, unit, amount) {
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
  const healed = unit.hp - before;
  if (run.mods.healShield) unit.shield = (unit.shield || 0) + Math.round(healed * 0.5);
  return healed;
}

// ---------- 建战斗 ----------
export function createBattle(run, node) {
  const diff = CHAPTER_DIFF[chapterOf(node.col)] || CHAPTER_DIFF[1];
  const units = [];

  for (const h of run.heroes) {
    h.side = 'hero';
    h.nextAt = BATTLE.turnBase / h.speed;
    h.buffAtk = 0;
    h.buffAtkTurns = 0;
    h.shield = 0;
    h.tauntTurns = 0;
    h.skillCd = {};
    for (const s of h.skills) h.skillCd[s.id] = 0;
    units.push(h);
  }

  for (const eid of node.enemyGroup) {
    const base = ENEMIES[eid];
    if (!base) continue;
    units.push({
      side: 'enemy',
      id: `${eid}-${Math.round(run.rng() * 1e6)}`,
      nameKey: base.nameKey,
      color: base.color,
      row: base.row,
      hp: Math.round(base.hp * diff.hp),
      maxHp: Math.round(base.hp * diff.hp),
      atk: Math.round(base.atk * diff.atk),
      def: base.def,
      speed: base.speed,
      alive: true,
      nextAt: BATTLE.turnBase / base.speed,
      heavy: !!base.heavy,
      markedTurns: 0,
      markMult: 1.6,
      shield: 0,
      buffAtk: 0,
      buffAtkTurns: 0,
      tauntTurns: 0,
    });
  }

  const battle = {
    time: 0,
    units,
    waiting: false,
    pending: null,
    firstActionUsed: false,
    turnSeq: 0,
  };
  emit(run, 'battleStart', { nodeId: node.id, enemies: node.enemyGroup.length });
  return battle;
}

// ---------- 推进：解决到期敌人，直到轮到英雄（暂停） ----------
export function pump(battle, run) {
  // 若战斗已结束，不再推进
  if (!aliveHeroes(battle).length) {
    if (run.mode === 'battle') { run.mode = 'defeat'; emit(run, 'battleLose', {}); }
    return;
  }
  if (!aliveEnemies(battle).length) return; // 胜利由 applyAction 判定

  let guard = 0;
  while (guard++ < 200) {
    const due = battle.units
      .filter((u) => u.alive && u.nextAt <= battle.time + 1e-9)
      .sort((a, b) => a.nextAt - b.nextAt || (b.speed - a.speed));

    if (!due.length) break;

    // 先解决到期敌人（AI 自动）
    const dueEnemies = due.filter((u) => u.side === 'enemy');
    for (const e of dueEnemies) {
      if (!e.alive || e.nextAt > battle.time + 1e-9) continue;
      resolveEnemyAction(battle, run, e);
    }

    // 再轮到到期英雄（暂停等玩家）
    const dueHero = due.find((u) => u.side === 'hero' && u.alive && u.nextAt <= battle.time + 1e-9);
    if (dueHero) {
      battle.waiting = true;
      battle.pending = dueHero.id;
      emit(run, 'turnReady', { heroId: dueHero.id });
      return;
    }
    // 无到期英雄但可能还有到期敌人（上面已清）；若全清则下一轮 while 会 break
  }
}

function resolveEnemyAction(battle, run, enemy) {
  const target = pickEnemyTarget(battle);
  enemy.nextAt += BATTLE.turnBase / enemy.speed;
  if (!target) return;
  const mult = enemy.heavy && (battle.turnSeq % 3 === 0) ? 1.5 : 1.0;
  const dmg = Math.round(enemyDamage(enemy, target, run) * mult);
  hurt(run, battle, target, dmg, enemy);
  emit(run, 'enemyAttack', { enemyId: enemy.id, targetId: target.id, dmg, heavy: mult > 1 });
  battle.turnSeq += 1;
}

// ---------- 英雄行动 ----------
export function applyAction(battle, run, action = {}) {
  if (!battle.waiting) return false;
  const hero = battle.units.find((u) => u.id === battle.pending && u.side === 'hero');
  if (!hero || !hero.alive) {
    battle.waiting = false;
    battle.pending = null;
    pump(battle, run);
    return false;
  }

  // 每回合开头：CD / buff / 嘲讽衰减
  for (const s of hero.skills) hero.skillCd[s.id] = Math.max(0, hero.skillCd[s.id] - 1);
  hero.buffAtkTurns = Math.max(0, hero.buffAtkTurns - 1);
  if (hero.buffAtkTurns === 0) hero.buffAtk = 0;
  hero.tauntTurns = Math.max(0, hero.tauntTurns - 1);

  const firstMult = !battle.firstActionUsed ? run.mods.firstActionMult : 1;
  battle.firstActionUsed = true;

  const skillId = action.skill || 'basic';

  if (skillId === 'signature') {
    if (run.signature < BATTLE.signatureMax) { battle.waiting = false; battle.pending = null; pump(battle, run); return false; }
    run.signature = 0;
    let total = 0;
    for (const ally of aliveHeroes(battle)) total += Math.round(effAtk(ally, run) * BATTLE.signaturePower);
    for (const e of aliveEnemies(battle)) {
      const dmg = Math.max(1, Math.round(total * 0.5 - e.def * 0.25));
      hurt(run, battle, e, dmg, hero);
    }
    emit(run, 'signature', { heroId: hero.id, total });
  } else {
    const skill = skillId === 'basic' ? null : hero.skills.find((s) => s.id === skillId);
    if (skill && hero.skillCd[skill.id] > 0) { battle.waiting = false; battle.pending = null; pump(battle, run); return false; }

    if (!skill) {
      // 基本攻击：单体
      const target = battle.units.find((u) => u.side === 'enemy' && u.alive && u.id === action.target);
      if (!target) { battle.waiting = false; battle.pending = null; pump(battle, run); return false; }
      const dmg = heroDamage(hero, target, run, 1, firstMult);
      hurt(run, battle, target, dmg, hero);
      emit(run, 'heroAttack', { heroId: hero.id, targetId: target.id, dmg });
    } else if (skill.kind === 'aoe' || (skill.kind === 'multi' && run.mods.volleyAll)) {
      for (const e of aliveEnemies(battle)) {
        const dmg = heroDamage(hero, e, run, skill.power, firstMult);
        hurt(run, battle, e, dmg, hero);
      }
      emit(run, 'heroSkill', { heroId: hero.id, skillId: skill.id });
    } else if (skill.kind === 'multi') {
      const targets = aliveEnemies(battle).sort((a, b) => a.row - b.row).slice(0, 2);
      for (const e of targets) {
        const dmg = heroDamage(hero, e, run, skill.power, firstMult);
        hurt(run, battle, e, dmg, hero);
      }
      emit(run, 'heroSkill', { heroId: hero.id, skillId: skill.id });
    } else if (skill.kind === 'mark') {
      const target = battle.units.find((u) => u.side === 'enemy' && u.alive && u.id === action.target);
      if (!target) { battle.waiting = false; battle.pending = null; pump(battle, run); return false; }
      target.markedTurns = 2;
      emit(run, 'heroSkill', { heroId: hero.id, skillId: skill.id, targetId: target.id });
    } else if (skill.kind === 'heal') {
      const target = battle.units.find((u) => u.side === 'hero' && u.id === action.target) || hero;
      const healed = healUnit(run, target, Math.round(effAtk(hero, run) * skill.power));
      emit(run, 'heal', { heroId: hero.id, targetId: target.id, amount: healed });
    } else if (skill.kind === 'buff') {
      for (const ally of aliveHeroes(battle)) { ally.buffAtk = skill.power; ally.buffAtkTurns = 3; }
      emit(run, 'buff', { heroId: hero.id, skillId: skill.id });
    } else if (skill.kind === 'guard') {
      hero.shield = (hero.shield || 0) + Math.round(hero.atk * skill.power);
      hero.tauntTurns = 2;
      emit(run, 'guard', { heroId: hero.id });
    }

    if (skill) hero.skillCd[skill.id] = skill.cd;
  }

  // 行动后：军势充能 + 推进时间轴
  const charge = skillId === 'signature' ? 0 : (skillId === 'basic' ? BATTLE.chargePerAction : BATTLE.chargePerSkill);
  run.signature = Math.min(BATTLE.signatureMax, run.signature + Math.round(charge * run.mods.sigChargeMult));

  hero.nextAt += BATTLE.turnBase / hero.speed;
  battle.waiting = false;
  battle.pending = null;

  // 判定胜利 / 继续推进
  if (!aliveEnemies(battle).length) {
    emit(run, 'battleWin', {});
    return true; // 由 sim 负责进入 upgrade / victory
  }
  if (!aliveHeroes(battle).length) {
    run.mode = 'defeat';
    emit(run, 'battleLose', {});
    return false;
  }
  pump(battle, run);
  return false;
}

// ---------- 推进战斗时间（非等待态） ----------
export function tickBattle(battle, run, dt) {
  if (battle.waiting) return;
  battle.time += dt;
  pump(battle, run);
}

// ---------- 战斗 HUD 快照 ----------
export function getBattleHud(battle) {
  return {
    time: battle.time,
    waiting: battle.waiting,
    pending: battle.pending,
    enemies: battle.units.filter((u) => u.side === 'enemy').map((u) => ({
      id: u.id, nameKey: u.nameKey, color: u.color, row: u.row,
      hp: u.hp, maxHp: u.maxHp, alive: u.alive, markedTurns: u.markedTurns,
    })),
    heroes: battle.units.filter((u) => u.side === 'hero').map((u) => ({
      id: u.id, nameKey: u.nameKey, cls: u.cls, color: u.color, row: u.row,
      hp: u.hp, maxHp: u.maxHp, alive: u.alive, shield: u.shield,
      buffAtk: u.buffAtk, tauntTurns: u.tauntTurns,
      skills: (u.skills || []).map((s) => ({ id: s.id, nameKey: s.nameKey, cd: s.cd, cdLeft: u.skillCd ? u.skillCd[s.id] : 0, kind: s.kind })),
    })),
  };
}
