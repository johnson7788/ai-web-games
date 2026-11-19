// SNOWMAN FACTORY · 纯逻辑模拟（无 DOM，可被 node --test / selfplay / main 共同使用）
//
// 核心循环（1:1 保留参考源码 P0）：
//   蛋筒/岩石从左上管道落下 → 落到传送带 → 向右滑；
//   玩家在雪人处向下丢冰激凌球，球落到蛋筒上 = 接住（成品继续右滑到右侧仓门收集）；
//   落空或砸到岩石 = 失误掉命。5 命耗尽游戏结束；疯狂模式另有 130s 倒计时。
//
// 新机制：连击倍率（×1..×5）、金色蛋筒（+5 分 & +1 命）、岩石障碍（砸中=失误）。
import { LAYOUT, BALANCE, COLOR_ORDER } from '../../config/game.config.js';

// ---------- 可复用 RNG（确定性 seed） ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createRun(opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const rng = mulberry32(seed);

  const state = {
    phase: 'title',        // title | playing | paused | result
    mode: 'classic',       // classic | crazy
    level: 1,
    time: 0,
    score: 0,
    lives: BALANCE.lives,
    combo: 0,              // 当前连击数（未封顶，用于 comboMax 统计）
    comboMax: 0,
    mult: 1,               // 显示倍率 = min(combo, comboCap)
    catchesInLevel: 0,
    totalCatches: 0,
    goldens: 0,
    rocksHit: 0,
    misses: 0,
    items: [],             // {id, kind:'cone'|'rock', color, golden, x, y, state:'falling'|'sliding', topped}
    scoop: null,           // 在飞的冰激凌球 {x, y, t, ttl}
    spawnTimer: 0.9,
    idleTimer: 0,          // 距上次发射的秒数（空转兜底用）
    won: false,
    reason: null,          // 'lives' | 'time'
    timeLeft: null,        // 疯狂模式倒计时
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });
  let nextId = 1;

  function beltSpeed() {
    const base = state.mode === 'crazy' ? BALANCE.beltSpeedBase * BALANCE.crazyBeltMul : BALANCE.beltSpeedBase;
    return base + (state.level - 1) * BALANCE.beltSpeedPerLevel;
  }

  function spawnInterval() {
    const span = BALANCE.coneSpawnMax - BALANCE.coneSpawnMin;
    return Math.max(0.55, BALANCE.coneSpawnMin + rng() * span - (state.level - 1) * BALANCE.spawnSpeedPerLevel);
  }

  function spawnItem(forceKind, forceX) {
    let kind = forceKind || 'cone';
    if (!forceKind) {
      kind = (state.level >= 2 && rng() < BALANCE.rockChanceBase) ? 'rock' : 'cone';
    }
    const x = forceX != null ? forceX : LAYOUT.PIPE_X + (rng() - 0.5) * 12;
    const y = LAYOUT.PIPE_Y;
    let color = COLOR_ORDER[0];
    let golden = false;
    if (kind === 'cone') {
      golden = state.level >= 3 && rng() < BALANCE.goldenChance;
      color = COLOR_ORDER[Math.floor(rng() * COLOR_ORDER.length)];
    }
    state.items.push({ id: nextId++, kind, color, golden, x, y, state: 'falling', topped: false });
    emit('spawn', { kind, golden, color });
  }

  function resolveScoop() {
    const sx = LAYOUT.SNOWMAN_X;
    let best = null;
    let bd = Infinity;
    for (const it of state.items) {
      if (it.state !== 'sliding') continue;
      if (it.kind === 'cone' && it.topped) continue; // 已接住的蛋筒不能重复接
      const d = Math.abs(it.x - sx);
      if (d > LAYOUT.CATCH_HALF) continue;
      if (d < bd) { bd = d; best = it; }
    }

    if (best && best.kind === 'cone') {
      best.topped = true;
      state.combo += 1;
      if (state.combo > state.comboMax) state.comboMax = state.combo;
      state.mult = Math.min(state.combo, BALANCE.comboCap);
      const value = best.golden ? BALANCE.goldenValue : BALANCE.coneValue;
      const gained = value * state.mult;
      state.score += gained;
      state.catchesInLevel += 1;
      state.totalCatches += 1;
      if (best.golden) {
        state.goldens += 1;
        state.lives = Math.min(BALANCE.maxLives, state.lives + 1);
      }
      emit('catch', { golden: best.golden, color: best.color, combo: state.combo, mult: state.mult, gained });
      if (best.golden) emit('golden', { lives: state.lives });
      if (state.combo === 2 || state.combo === BALANCE.comboCap) emit('combo', { combo: state.combo });
      if (state.catchesInLevel >= BALANCE.catchesPerLevel) {
        state.catchesInLevel = 0;
        state.level += 1;
        emit('levelup', { level: state.level });
      }
    } else if (best && best.kind === 'rock') {
      state.items.splice(state.items.indexOf(best), 1);
      state.combo = 0;
      state.mult = 1;
      state.rocksHit += 1;
      state.lives -= 1;
      emit('rock', { lives: state.lives });
    } else {
      state.combo = 0;
      state.mult = 1;
      state.misses += 1;
      state.lives -= 1;
      emit('miss', { lives: state.lives });
    }

    state.scoop = null;
    if (state.lives <= 0) {
      state.lives = 0;
      state.phase = 'result';
      state.won = false;
      state.reason = 'lives';
      emit('lose', { reason: 'lives', score: state.score, level: state.level });
    }
  }

  function launchScoop() {
    if (state.phase !== 'playing') return { ok: false };
    if (state.scoop) return { ok: false };
    state.scoop = { x: LAYOUT.SNOWMAN_X, y: LAYOUT.SNOWMAN_HAND_Y, t: 0, ttl: BALANCE.dropTime };
    state.idleTimer = 0;
    emit('launch', {});
    return { ok: true };
  }

  const run = {
    get state() { return state; },

    start(mode = 'classic') {
      state.mode = mode === 'crazy' ? 'crazy' : 'classic';
      state.phase = 'playing';
      state.level = 1;
      state.time = 0;
      state.score = 0;
      state.lives = BALANCE.lives;
      state.combo = 0;
      state.comboMax = 0;
      state.mult = 1;
      state.catchesInLevel = 0;
      state.totalCatches = 0;
      state.goldens = 0;
      state.rocksHit = 0;
      state.misses = 0;
      state.items = [];
      state.scoop = null;
      state.spawnTimer = 0.9;
      state.idleTimer = 0;
      state.won = false;
      state.reason = null;
      state.timeLeft = state.mode === 'crazy' ? BALANCE.crazyTimeLimit : null;
      events.length = 0;
      return { ok: true };
    },

    launch: launchScoop,

    step(dt) {
      if (state.phase !== 'playing') return;
      const dtc = clamp(dt, 0, 0.1);
      state.time += dtc;

      if (state.timeLeft != null) {
        state.timeLeft -= dtc;
        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          state.phase = 'result';
          state.won = false;
          state.reason = 'time';
          emit('lose', { reason: 'time', score: state.score, level: state.level });
          return;
        }
      }

      state.spawnTimer -= dtc;
      if (state.spawnTimer <= 0) {
        spawnItem();
        state.spawnTimer = spawnInterval();
      }

      const bs = beltSpeed();
      for (let i = state.items.length - 1; i >= 0; i -= 1) {
        const it = state.items[i];
        if (it.state === 'falling') {
          it.y += BALANCE.fallSpeed * dtc;
          if (it.y >= LAYOUT.BELT_Y - LAYOUT.ITEM_HALF) {
            it.y = LAYOUT.BELT_Y - LAYOUT.ITEM_HALF;
            it.state = 'sliding';
          }
        } else if (it.state === 'sliding') {
          it.x += bs * dtc;
          if (it.x > LAYOUT.DOOR_X) {
            if (it.topped) emit('collect', {});
            state.items.splice(i, 1);
          }
        }
      }

      if (state.scoop) {
        state.scoop.t += dtc;
        const k = Math.min(1, state.scoop.t / state.scoop.ttl);
        state.scoop.y = LAYOUT.SNOWMAN_HAND_Y + (LAYOUT.BELT_Y - LAYOUT.ITEM_HALF - LAYOUT.SNOWMAN_HAND_Y) * k;
        if (state.scoop.t >= state.scoop.ttl) resolveScoop();
      } else {
        state.idleTimer += dtc;
        if (state.idleTimer >= BALANCE.autoLaunchSec) launchScoop();
      }
    },

    drainEvents() { return events.splice(0, events.length); },

    getHud() {
      return {
        phase: state.phase,
        mode: state.mode,
        level: state.level,
        score: state.score,
        lives: state.lives,
        combo: state.combo,
        mult: state.mult,
        timeLeft: state.timeLeft,
        time: state.time,
        reason: state.reason,
        catches: state.catchesInLevel,
        catchesNeed: BALANCE.catchesPerLevel,
      };
    },

    pause() { if (state.phase === 'playing') state.phase = 'paused'; return { ok: true }; },
    resume() { if (state.phase === 'paused') state.phase = 'playing'; return { ok: true }; },

    debug: {
      spawnItem: (kind, x) => { spawnItem(kind, x); },
      setLevel: (n) => { state.level = Math.max(1, n | 0); },
      setLives: (n) => { state.lives = Math.max(0, n | 0); },
      setCombo: (n) => { state.combo = Math.max(0, n | 0); state.mult = Math.min(state.combo, BALANCE.comboCap); },
      addScore: (n) => { state.score += n | 0; },
      forceResult: () => {
        state.phase = 'result';
        state.won = false;
        state.reason = state.reason || 'debug';
        emit('lose', { reason: 'debug', score: state.score, level: state.level });
      },
    },
  };

  return run;
}

export default createRun;
