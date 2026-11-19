// 纯逻辑格斗 sim（无 DOM / window，Node 可直接 import）。
// 状态机：整局 = 三关连续格斗。每关：接近 → 近身互殴 → 一方 HP 归零。
// 玩家动作：strike（快拳/扫腿按节奏判定）、blockStart/blockEnd（格挡）、super（超必杀）。
// 敌方 AI：进入射程后每 N 秒抬手预警（enemyWindup），随后命中。

import { FIGHT, LEVELS, LEVEL_COUNT } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(levelIndex = 0, opts = {}) {
  const events = [];
  const state = {
    level: 1,          // 1-based
    levelIndex: 0,
    phase: 'fight',    // fight | won | lost
    time: 0,
    fight: null,
    stats: { punches: 0, kicks: 0, supers: 0, blocks: 0, hitsLanded: 0, hitsTaken: 0 },
  };

  const emit = (type, payload = {}) => events.push({ type, ...payload });

  function initFight(idx, carryHp) {
    const lv = LEVELS[idx] || LEVELS[0];
    state.levelIndex = idx;
    state.level = idx + 1;
    state.fight = {
      playerHp: typeof carryHp === 'number' ? carryHp : FIGHT.PLAYER_HP,
      enemyHp: lv.enemyHp,
      enemyMaxHp: lv.enemyHp,
      playerMeter: 0,
      combo: 0,
      comboPeak: 0,
      blocking: false,
      distance: FIGHT.START_GAP,
      inRange: false,
      enemyAttackTimer: lv.enemyAttackInterval + 0.4,
      enemyWindup: 0,
      playerCooldown: 0,
      superLock: 0,
      lastAttackAt: -Infinity,
      justBlocked: 0,
    };
    emit('approach', { level: state.level });
  }

  initFight(levelIndex % LEVEL_COUNT);

  function currentLevel() {
    return LEVELS[state.levelIndex] || LEVELS[0];
  }

  function levelWin() {
    emit('levelWin', { level: state.level });
    if (state.level >= LEVEL_COUNT) {
      state.phase = 'won';
      emit('matchWin', { level: state.level });
      return;
    }
    const nextHp = Math.min(FIGHT.PLAYER_HP, state.fight.playerHp + 30);
    initFight(state.levelIndex + 1, nextHp);
  }

  function loseMatch() {
    state.phase = 'lost';
    emit('lose', { level: state.level });
  }

  function applyEnemyHit() {
    const f = state.fight;
    const blocked = f.blocking;
    const raw = currentLevel().enemyDamage;
    const dmg = blocked ? Math.max(1, Math.round(raw * (1 - FIGHT.BLOCK_REDUCE))) : raw;
    f.playerHp = Math.max(0, f.playerHp - dmg);
    f.combo = 0; // 被命中打断连击
    state.stats.hitsTaken += 1;
    emit('enemyHit', { dmg, blocked });
    if (blocked) emit('block', { blocked: true, dmg });
    if (f.playerHp <= 0) loseMatch();
  }

  const run = {
    state,

    step(dt) {
      if (state.phase !== 'fight') return;
      state.time += dt;
      const f = state.fight;
      f.playerCooldown = Math.max(0, f.playerCooldown - dt);
      f.superLock = Math.max(0, f.superLock - dt);
      f.justBlocked = Math.max(0, f.justBlocked - dt);

      // 相向靠拢
      if (f.distance > FIGHT.ATTACK_RANGE) {
        f.distance = Math.max(FIGHT.ATTACK_RANGE, f.distance - FIGHT.APPROACH_SPEED * dt);
        if (f.distance <= FIGHT.ATTACK_RANGE) {
          f.inRange = true;
          emit('combatStart', { level: state.level });
        }
      }

      // 敌方 AI：预警 → 出手
      if (f.inRange) {
        if (f.enemyWindup > 0) {
          f.enemyWindup -= dt;
          if (f.enemyWindup <= 0) applyEnemyHit();
        } else {
          f.enemyAttackTimer -= dt;
          if (f.enemyAttackTimer <= 0) {
            f.enemyWindup = FIGHT.ENEMY_WINDUP;
            f.enemyAttackTimer = currentLevel().enemyAttackInterval;
            emit('enemyWindup', { level: state.level });
          }
        }
      }
    },

    strike() {
      if (state.phase !== 'fight') return { ok: false };
      const f = state.fight;
      if (f.playerCooldown > 0 || f.superLock > 0) return { ok: false };
      if (!f.inRange) return { ok: false, reason: 'out-of-range' };

      const isPunch = f.lastAttackAt === -Infinity || (state.time - f.lastAttackAt) < FIGHT.ATTACK_WINDOW;
      f.lastAttackAt = state.time;
      let dmg;
      if (isPunch) {
        const bonus = Math.min(f.combo, FIGHT.COMBO_CAP) * FIGHT.COMBO_BONUS;
        dmg = FIGHT.PUNCH_DAMAGE + bonus;
        f.combo += 1;
        f.comboPeak = Math.max(f.comboPeak, f.combo);
        f.playerCooldown = FIGHT.PUNCH_COOLDOWN;
        state.stats.punches += 1;
        emit('punch', { dmg, combo: f.combo });
        if (f.combo === 3 || f.combo === 5 || f.combo === 8) emit('combo', { combo: f.combo });
      } else {
        dmg = FIGHT.KICK_DAMAGE;
        f.combo = 0;
        f.distance += FIGHT.KICK_KNOCKBACK;
        if (f.distance > FIGHT.ATTACK_RANGE) f.inRange = false;
        f.playerCooldown = FIGHT.KICK_COOLDOWN;
        state.stats.kicks += 1;
        emit('kick', { dmg });
      }
      f.playerMeter = Math.min(FIGHT.SUPER_METER_MAX, f.playerMeter + FIGHT.METER_PER_HIT);
      f.enemyHp = Math.max(0, f.enemyHp - dmg);
      state.stats.hitsLanded += 1;
      emit('hitEnemy', { dmg });
      if (f.enemyHp <= 0) levelWin();
      return { ok: true, dmg };
    },

    blockStart() {
      if (state.phase !== 'fight') return { ok: false };
      const f = state.fight;
      if (f.blocking) return { ok: false };
      f.blocking = true;
      f.justBlocked = 0.18;
      state.stats.blocks += 1;
      emit('block', { on: true });
      return { ok: true };
    },

    blockEnd() {
      if (state.phase !== 'fight') return { ok: false };
      const f = state.fight;
      if (!f.blocking) return { ok: false };
      f.blocking = false;
      return { ok: true };
    },

    superMove() {
      if (state.phase !== 'fight') return { ok: false };
      const f = state.fight;
      if (f.superLock > 0) return { ok: false };
      if (f.playerMeter < FIGHT.SUPER_METER_MAX) return { ok: false, reason: 'no-meter' };
      if (!f.inRange) return { ok: false, reason: 'out-of-range' };
      f.playerMeter = 0;
      f.enemyHp = Math.max(0, f.enemyHp - FIGHT.SUPER_DAMAGE);
      f.superLock = FIGHT.SUPER_LOCK;
      state.stats.supers += 1;
      state.stats.hitsLanded += 1;
      emit('super', { dmg: FIGHT.SUPER_DAMAGE });
      emit('hitEnemy', { dmg: FIGHT.SUPER_DAMAGE });
      if (f.enemyHp <= 0) levelWin();
      return { ok: true, dmg: FIGHT.SUPER_DAMAGE };
    },

    drainEvents() {
      return events.splice(0, events.length);
    },
  };

  // 标准 run 接口别名（playbook 契约）
  run.stepFn = run.step;

  return run;
}

export { FIGHT, LEVELS, LEVEL_COUNT };
