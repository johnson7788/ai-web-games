// WUSHEN SWORD DOME · 纯逻辑模拟（不碰 DOM/window/localStorage/Date.now）
// 职责：创建一局（3 连战）、推进时间、玩家动作、AI 决策、碰撞、状态效果、事件流。
// 输入：step(dt) + playerLaunchWeapon / playerUseSkill / playerDodge（边沿触发）。
// 输出：drainEvents() + state + getHud()。
import { WORLD } from '../../config/game.config.js';
import {
  FIGHTER_BASE, STAGES, PLAYER_WEAPONS, ENEMY_WEAPONS, PLAYER_SKILLS, ENEMY_SKILLS,
  DODGE, COMBO, ORB, PROJECTILE, AI as AI_CFG,
} from '../../config/balance.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let UID = 1;
const nextId = (prefix) => `${prefix}${UID++}`;

function makeFighter(cfg, name, isSelf) {
  return {
    name,
    maxHp: cfg.maxHp,
    hp: cfg.maxHp,
    maxMp: cfg.maxMp,
    mp: cfg.maxMp,
    strength: cfg.strength,
    bone: cfg.bone,
    critProb: cfg.critProb,
    critHarm: cfg.critHarm,
    combo: 0,
    buff: null,           // { kind, until }
    poison: null,         // { until, perTick, nextTick }
    dodging: 0,           // 无敌直到 time
    ai: isSelf ? null : { ...cfg.ai, thinkAccum: 0 },
  };
}

function makeWeaponBar(w) {
  return {
    key: w.key, type: w.type, attack: w.attack, cost: w.cost,
    cd: w.cd, maxCd: w.cd, cdLeft: 0, durable: w.durable,
    skillId: w.skillId, skillProb: w.skillProb, skill: w.skill || {},
  };
}

function makeSkill(s) {
  return { key: s.key, kind: s.kind, cost: s.cost, cd: s.cd, maxCd: s.cd, cdLeft: 0, ...s };
}

export function createRun(opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const stageIndex = 0;

  const self = makeFighter(FIGHTER_BASE, 'self', true);
  const other = makeFighter(STAGES[0], 'other', false);

  const run = {
    state: {
      phase: 'playing',   // 'playing' | 'won' | 'lost'
      stage: 1,
      time: 0,
      self,
      other,
      selfWeapons: PLAYER_WEAPONS.map(makeWeaponBar),
      otherWeapons: ENEMY_WEAPONS[0].map(makeWeaponBar),
      selfSkills: PLAYER_SKILLS.map(makeSkill),
      otherSkills: [],
      selfDodge: { cd: DODGE.cd, maxCd: DODGE.cd, cdLeft: 0 },
      otherDodge: { cd: DODGE.cd, maxCd: DODGE.cd, cdLeft: 0 },
      projectiles: [],
      orbs: [],
      orbTimer: ORB.spawnEvery * 0.4,   // 开局稍后出第一颗星陨石
      regenAccum: 0,
      stats: { hits: 0, crits: 0, clashes: 0, maxCombo: 0, orbsTaken: 0, damageDealt: 0 },
      tutorial: opts.tutorial === true,
    },
    _events: [],
    _rng: rng,
    _seed: seed,
  };

  const st = run.state;

  function emit(type, payload = {}) {
    run._events.push({ type, ...payload });
  }

  // ---- 工具 ----

  const regenTick = () => Math.max(1, Math.round(st.self.maxMp / 30));

  function regenRateOf(f) {
    if (f.buff && f.buff.kind === 'regen' && f.buff.until > st.time) return f.buff.mult || 1;
    return 1;
  }

  function applyDamage(attacker, defender, weaponAttack, skillEffect, skill, critOverride) {
    const hurtPer = Math.max(0.2, (attacker.strength - defender.bone) / attacker.strength);
    let critProb = attacker.critProb;
    let critHarm = attacker.critHarm;
    if (skillEffect && skill && skill.crit) {
      critProb = skill.crit.chance;
      critHarm = skill.crit.mult * 100;
    }
    const isCrit = critOverride === true || run._rng() * 100 < critProb;
    const critMult = isCrit ? critHarm / 100 : 1;
    const comboMult = 1 + Math.min(attacker.combo, COMBO.max) * COMBO.per;
    const buffMult = (attacker.buff && attacker.buff.kind === 'power' && attacker.buff.until > st.time) ? ORB.powerMult : 1;
    let attack = Math.floor(weaponAttack * hurtPer * critMult * comboMult * buffMult);
    if (attack < 1) attack = 1;
    return { attack, isCrit, hurtPer };
  }

  function dealHit(attacker, defender, { weaponAttack, skillEffect, skill, critOverride, skillId }) {
    if (st.tutorial && defender === st.self) {
      emit('enemyHit', { attack: 0, who: 'other' });
      return;
    }
    const { attack, isCrit } = applyDamage(attacker, defender, weaponAttack, skillEffect, skill, critOverride);
    defender.hp = Math.max(0, defender.hp - attack);
    const attackerIsSelf = attacker === st.self;
    // 连击
    if (attackerIsSelf) {
      st.self.combo += 1;
      st.stats.maxCombo = Math.max(st.stats.maxCombo, st.self.combo);
      st.stats.hits += 1;
      st.stats.damageDealt += attack;
      if (st.self.combo >= 2) emit('comboUp', { combo: st.self.combo });
    } else {
      if (COMBO.resetOnHit) st.self.combo = 0;   // 挨打断连击
    }
    if (isCrit) {
      st.stats.crits += 1;
      emit('crit', { attack, who: attackerIsSelf ? 'self' : 'other' });
    } else {
      emit(attackerIsSelf ? 'hit' : 'enemyHit', { attack, who: attackerIsSelf ? 'self' : 'other' });
    }
    // 兵器技能特效
    if (skillEffect && skill && skill.poison && skillId === 'poison') {
      const { time, total } = skill.poison;
      defender.poison = { until: st.time + time, perTick: Math.round(total / time), nextTick: st.time + 1 };
      emit('poisonTick', { who: attackerIsSelf ? 'other' : 'self', apply: false });
    }
    // 检查死亡
    if (defender.hp <= 0) {
      onDeath(attacker, defender);
    }
  }

  function onDeath(winner, loser) {
    if (st.tutorial) return;
    const selfWon = loser === st.other;
    if (selfWon) {
      emit('roundWin', { stage: st.stage });
      if (st.stage >= STAGES.length) {
        st.phase = 'won';
        emit('win', { stage: st.stage });
      } else {
        advanceStage();
      }
    } else {
      emit('roundLose', { stage: st.stage });
      st.phase = 'lost';
      emit('lose', { stage: st.stage });
    }
  }

  function advanceStage() {
    st.stage += 1;
    const cfg = STAGES[st.stage - 1];
    // 重置双方血量/内力/状态/冷却，进入下一关
    resetFighter(st.self, FIGHTER_BASE.maxHp, FIGHTER_BASE.maxMp);
    resetFighter(st.other, cfg.maxHp, cfg.maxMp);
    st.other.strength = cfg.strength;
    st.other.bone = cfg.bone;
    st.other.critProb = cfg.critProb;
    st.other.critHarm = cfg.critHarm;
    st.other.ai = { ...cfg.ai, thinkAccum: 0 };
    st.otherWeapons = ENEMY_WEAPONS[Math.min(st.stage - 1, ENEMY_WEAPONS.length - 1)].map(makeWeaponBar);
    st.otherSkills = (st.stage >= 2 ? ENEMY_SKILLS.map(makeSkill) : []);
    st.otherDodge = { cd: DODGE.cd, maxCd: DODGE.cd, cdLeft: 0 };
    st.projectiles = [];
    st.orbs = [];
    st.orbTimer = ORB.spawnEvery * 0.6;
    emit('roundStart', { stage: st.stage });
  }

  function resetFighter(f, maxHp, maxMp) {
    f.maxHp = maxHp; f.hp = maxHp; f.maxMp = maxMp; f.mp = maxMp;
    f.combo = 0; f.buff = null; f.poison = null; f.dodging = 0;
  }

  // ---- 发射兵器（内部）----

  function launchProjectile(owner, weaponBar, opts = {}) {
    const isSelf = owner === st.self;
    const skillEffect = opts.skillEffect || false;
    const startX = isSelf ? (WORLD.SELF_X + 50) : (WORLD.OTHER_X - 50);
    const endX = isSelf ? (WORLD.OTHER_X + 50) : (WORLD.SELF_X - 50);
    const dir = isSelf ? 1 : -1;
    const arc = opts.arc != null ? opts.arc : PROJECTILE.arc[weaponBar.type] || 0;
    st.projectiles.push({
      id: nextId('w'),
      owner: isSelf ? 'self' : 'other',
      type: weaponBar.type,
      attack: opts.attack != null ? opts.attack : weaponBar.attack,
      durable: weaponBar.durable,
      skillId: weaponBar.skillId,
      skill: weaponBar.skill,
      skillEffect,
      startX, endX, dir,
      baseY: 450 + (opts.yOffset || 0),
      arc,
      t: 0,
      lag: opts.lag || 0,
      dead: false,
    });
  }

  function launchWeaponAction(owner, weaponBar, isSelf) {
    if (st.phase !== 'playing') return { ok: false, reason: 'phase' };
    if (owner.dodging > st.time) return { ok: false, reason: 'dodging' };
    if (weaponBar.cdLeft > 0) return { ok: false, reason: 'cd' };
    if (owner.mp < weaponBar.cost) return { ok: false, reason: 'mp' };
    owner.mp = Math.max(0, owner.mp - weaponBar.cost);
    weaponBar.cdLeft = weaponBar.cd;
    let skillEffect = false;
    if (weaponBar.skillId && weaponBar.skillProb > 0 && run._rng() * 100 < weaponBar.skillProb) {
      skillEffect = true;
    }
    const count = (skillEffect && weaponBar.skill && weaponBar.skill.multi) ? weaponBar.skill.multi.count : 1;
    for (let i = 0; i < count; i += 1) {
      launchProjectile(owner, weaponBar, {
        skillEffect,
        lag: i * 0.12,
        yOffset: count > 1 ? (i - (count - 1) / 2) * 22 : 0,
      });
    }
    emit(isSelf ? 'launch' : 'enemyLaunch', { who: isSelf ? 'self' : 'other', weapon: weaponBar.key, skillEffect });
    return { ok: true };
  }

  // ---- 玩家动作 ----

  run.playerLaunchWeapon = function (i) {
    const w = st.selfWeapons[i];
    if (!w) return { ok: false, reason: 'index' };
    return launchWeaponAction(st.self, w, true);
  };

  run.playerUseSkill = function (n) {
    if (st.phase !== 'playing') return { ok: false, reason: 'phase' };
    const s = st.selfSkills[n];
    if (!s) return { ok: false, reason: 'index' };
    if (s.cdLeft > 0) return { ok: false, reason: 'cd' };
    if (st.self.mp < s.cost) return { ok: false, reason: 'mp' };
    if (st.self.dodging > st.time) return { ok: false, reason: 'dodging' };
    st.self.mp = Math.max(0, st.self.mp - s.cost);
    s.cdLeft = s.cd;
    if (s.kind === 'dragon') {
      launchProjectile(st.self, { type: s.type, attack: s.attack, durable: 40, skillId: null, skill: {} }, { arc: PROJECTILE.skillArc });
      emit('skillCast', { skill: s.key, who: 'self' });
    } else if (s.kind === 'surge') {
      const heal = Math.round(st.self.maxHp * s.healPct);
      st.self.hp = Math.min(st.self.maxHp, st.self.hp + heal);
      st.self.buff = { kind: 'regen', until: st.time + s.boostTime, mult: s.mpBoost };
      emit('skillCast', { skill: s.key, who: 'self' });
      emit('heal', { amount: heal });
    }
    return { ok: true };
  };

  run.playerDodge = function () {
    if (st.phase !== 'playing') return { ok: false, reason: 'phase' };
    if (st.selfDodge.cdLeft > 0) return { ok: false, reason: 'cd' };
    if (st.self.dodging > st.time) return { ok: false, reason: 'dodging' };
    st.selfDodge.cdLeft = st.selfDodge.cd;
    st.self.dodging = st.time + DODGE.invuln;
    emit('dodge', { who: 'self' });
    return { ok: true };
  };

  // ---- AI 动作 ----

  function aiDodge() {
    st.other.dodging = st.time + DODGE.invuln;
    st.otherDodge.cdLeft = st.otherDodge.cd;
    emit('dodge', { who: 'other' });
  }

  function aiSkill(s) {
    st.other.mp = Math.max(0, st.other.mp - s.cost);
    s.cdLeft = s.cd;
    if (s.kind === 'dragon') {
      launchProjectile(st.other, { type: s.type, attack: s.attack, durable: 40, skillId: null, skill: {} }, { arc: PROJECTILE.skillArc });
    } else if (s.kind === 'surge') {
      const heal = Math.round(st.other.maxHp * s.healPct);
      st.other.hp = Math.min(st.other.maxHp, st.other.hp + heal);
      st.other.buff = { kind: 'regen', until: st.time + s.boostTime, mult: s.mpBoost };
      emit('heal', { amount: heal, who: 'other' });
    }
    emit('enemySkill', { skill: s.key, who: 'other' });
  }

  function aiThink() {
    if (st.tutorial) return;
    const ai = st.other.ai;
    // 反应闪避：玩家兵器逼近
    let incoming = false;
    for (const p of st.projectiles) {
      if (p.owner !== 'self' || p.dead) continue;
      const px = p.startX + p.dir * p.t * Math.abs(p.endX - p.startX);
      if (Math.abs(px - WORLD.OTHER_X) < AI_CFG.reactDistance) incoming = true;
    }
    if (incoming && st.otherDodge.cdLeft <= 0 && run._rng() < ai.dodgeReflex) {
      aiDodge();
      return;
    }
    // 技能
    const readySkills = st.otherSkills.filter((s) => s.cdLeft <= 0 && st.other.mp >= s.cost);
    if (readySkills.length && run._rng() < ai.skillBias) {
      aiSkill(readySkills[Math.floor(run._rng() * readySkills.length)]);
      return;
    }
    // 兵器
    if (run._rng() < ai.aggression) {
      const mpReserve = st.other.maxMp * AI_CFG.mpReserve;
      const ready = st.otherWeapons.filter((w) => w.cdLeft <= 0 && st.other.mp - w.cost >= mpReserve);
      if (ready.length) {
        const w = ready[Math.floor(run._rng() * ready.length)];
        launchWeaponAction(st.other, w, false);
      }
    }
  }

  // ---- 兵器/星陨石更新 ----

  function projectilePos(p) {
    const dist = Math.abs(p.endX - p.startX);
    const x = p.startX + p.dir * p.t * dist;
    const y = p.baseY - p.arc * 4 * p.t * (1 - p.t);
    return { x, y };
  }

  function updateProjectiles(dt) {
    for (const p of st.projectiles) {
      if (p.dead) continue;
      if (p.lag > 0) { p.lag -= dt; continue; }
      const dist = Math.abs(p.endX - p.startX);
      p.t += (PROJECTILE.speed / dist) * dt;
      const { x, y } = projectilePos(p);
      if (p.t >= 1.05) { p.dead = true; continue; }

      // 命中对手身体
      const target = p.owner === 'self' ? st.other : st.self;
      const targetX = p.owner === 'self' ? WORLD.OTHER_X : WORLD.SELF_X;
      const targetDodging = target.dodging > st.time;
      if (!targetDodging && Math.abs(x - targetX) < WORLD.BODY_W / 2 && y >= WORLD.BODY_TOP && y <= WORLD.BODY_BOT) {
        p.dead = true;
        const attacker = p.owner === 'self' ? st.self : st.other;
        dealHit(attacker, target, {
          weaponAttack: p.attack,
          skillEffect: p.skillEffect,
          skill: p.skill,
          skillId: p.skillId,
        });
        if (p.skillEffect && p.skill && p.skill.crit) {
          // 暴击剑不额外处理，applyDamage 已用 skill.crit 覆盖
        }
        continue;
      }

      // 命中星陨石
      for (const o of st.orbs) {
        if (o.dead) continue;
        if (Math.abs(x - o.x) < 34 && Math.abs(y - o.y) < 34) {
          o.dead = true;
          takeOrb(p.owner, o);
          p.dead = true;
          break;
        }
      }
    }

    // 兵器互撞（同类型）
    for (let i = 0; i < st.projectiles.length; i += 1) {
      const a = st.projectiles[i];
      if (a.dead || a.lag > 0) continue;
      const pa = projectilePos(a);
      for (let j = i + 1; j < st.projectiles.length; j += 1) {
        const b = st.projectiles[j];
        if (b.dead || b.lag > 0) continue;
        if (a.owner === b.owner || a.type !== b.type) continue;
        const pb = projectilePos(b);
        if (Math.abs(pa.x - pb.x) < 28 && Math.abs(pa.y - pb.y) < 42) {
          st.stats.clashes += 1;
          emit('clash', { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 });
          if (a.durable > b.durable) {
            a.durable -= b.durable;
            b.dead = true;
          } else if (b.durable > a.durable) {
            b.durable -= a.durable;
            a.dead = true;
            break;
          } else {
            a.dead = true;
            b.dead = true;
            break;
          }
        }
      }
    }

    st.projectiles = st.projectiles.filter((p) => !p.dead);
  }

  function takeOrb(ownerKind, orb) {
    const owner = ownerKind === 'self' ? st.self : st.other;
    if (orb.kind === 'heal') {
      owner.hp = Math.min(owner.maxHp, owner.hp + ORB.heal);
    } else if (orb.kind === 'mp') {
      owner.mp = Math.min(owner.maxMp, owner.mp + ORB.mp);
    } else if (orb.kind === 'power') {
      owner.buff = { kind: 'power', until: st.time + ORB.powerTime };
    }
    if (ownerKind === 'self') st.stats.orbsTaken += 1;
    emit('orbTaken', { kind: orb.kind, who: ownerKind });
  }

  function updateOrbs(dt) {
    for (const o of st.orbs) {
      o.ttl -= dt;
      if (o.ttl <= 0) o.dead = true;
    }
    st.orbs = st.orbs.filter((o) => !o.dead);
    if (st.orbs.length === 0) {
      st.orbTimer -= dt;
      if (st.orbTimer <= 0) {
        st.orbTimer = ORB.spawnEvery;
        const kind = ORB.kinds[Math.floor(run._rng() * ORB.kinds.length)];
        st.orbs.push({ id: nextId('o'), x: ORB.x, y: ORB.y, kind, ttl: ORB.lifetime, dead: false });
        emit('orbSpawn', { kind });
      }
    }
  }

  function updateStatus(dt) {
    // 中毒
    for (const f of [st.self, st.other]) {
      if (f.poison) {
        if (st.time >= f.poison.until) { f.poison = null; }
        else if (st.time >= f.poison.nextTick) {
          f.hp = Math.max(0, f.hp - f.poison.perTick);
          f.poison.nextTick += 1;
          emit('poisonTick', { who: f === st.self ? 'self' : 'other', amount: f.poison.perTick, apply: true });
          if (f.hp <= 0) onDeath(f === st.self ? st.other : st.self, f);
        }
      }
      // buff 到期
      if (f.buff && st.time >= f.buff.until) f.buff = null;
      if (f.dodging && st.time >= f.dodging) f.dodging = 0;
    }
  }

  function tickCooldowns(dt) {
    for (const w of st.selfWeapons) w.cdLeft = Math.max(0, w.cdLeft - dt);
    for (const w of st.otherWeapons) w.cdLeft = Math.max(0, w.cdLeft - dt);
    for (const s of st.selfSkills) s.cdLeft = Math.max(0, s.cdLeft - dt);
    for (const s of st.otherSkills) s.cdLeft = Math.max(0, s.cdLeft - dt);
    st.selfDodge.cdLeft = Math.max(0, st.selfDodge.cdLeft - dt);
    st.otherDodge.cdLeft = Math.max(0, st.otherDodge.cdLeft - dt);
  }

  function updateRegen(dt) {
    st.regenAccum += dt;
    while (st.regenAccum >= 0.32) {
      st.regenAccum -= 0.32;
      const selfAdd = Math.round(regenTick() * regenRateOf(st.self));
      const otherAdd = Math.round(regenTick() * regenRateOf(st.other));
      const before = st.self.mp;
      st.self.mp = Math.min(st.self.maxMp, st.self.mp + selfAdd);
      st.other.mp = Math.min(st.other.maxMp, st.other.mp + otherAdd);
      if (st.self.mp !== before) emit('mpRegen', { who: 'self' });
    }
  }

  // ---- 主推进 ----

  run.step = function (dt = 1 / 60) {
    if (st.phase !== 'playing') return st;
    st.time += dt;
    tickCooldowns(dt);
    updateRegen(dt);
    updateStatus(dt);
    // AI 决策
    if (st.other.ai) {
      st.other.ai.thinkAccum += dt;
      while (st.other.ai.thinkAccum >= st.other.ai.think) {
        st.other.ai.thinkAccum -= st.other.ai.think;
        if (st.phase === 'playing') aiThink();
      }
    }
    updateOrbs(dt);
    updateProjectiles(dt);
    if (st.phase !== 'playing') {
      // 终局后清空飞行物（保留最后事件）
      st.projectiles = [];
    }
    return st;
  };

  run.drainEvents = function () {
    const e = run._events;
    run._events = [];
    return e;
  };

  run.getHud = function () {
    return {
      time: st.time,
      stage: st.stage,
      phase: st.phase,
      self: {
        hp: st.self.hp, maxHp: st.self.maxHp,
        mp: st.self.mp, maxMp: st.self.maxMp,
        combo: st.self.combo, dodging: st.self.dodging > st.time,
        poison: st.self.poison && st.self.poison.until > st.time,
        buff: st.self.buff && st.self.buff.until > st.time ? st.self.buff.kind : null,
      },
      other: {
        hp: st.other.hp, maxHp: st.other.maxHp,
        mp: st.other.mp, maxMp: st.other.maxMp,
        dodging: st.other.dodging > st.time,
        poison: st.other.poison && st.other.poison.until > st.time,
      },
      selfWeapons: st.selfWeapons.map((w) => ({ key: w.key, cost: w.cost, cdLeft: w.cdLeft, maxCd: w.cd, ready: w.cdLeft <= 0, attack: w.attack, skillProb: w.skillProb })),
      selfSkills: st.selfSkills.map((s) => ({ key: s.key, cost: s.cost, cdLeft: s.cdLeft, maxCd: s.cd, ready: s.cdLeft <= 0 })),
      selfDodge: { cdLeft: st.selfDodge.cdLeft, maxCd: st.selfDodge.cd, ready: st.selfDodge.cdLeft <= 0 },
      stars: computeStars(),
    };
  };

  function computeStars() {
    if (st.phase !== 'won') return 0;
    let stars = 1;
    if (st.self.hp / st.self.maxHp >= 0.5) stars += 1;
    if (st.stats.maxCombo >= 5) stars += 1;
    return Math.min(3, stars);
  }

  return run;
}
