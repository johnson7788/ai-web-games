// Bubble Tap Pop · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：斯特鲁普颜色点击的核心循环、连击/星级/岩石陷阱、事件表。
// 依赖：config/game.config.js（GAME 数值）。
// 契约：createRun({seed, best}) → { state, tap(id), step(dt), drainEvents(), getHud() }。
// 随机：注入 seed 的 mulberry32，可复现（selfplay / 单测依赖确定性）。

import { GAME } from '../../config/game.config.js';

export const COLORS = [...GAME.COLORS];

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ 数值
export function starRating(score) {
  const T = GAME.STAR_THRESHOLDS;
  if (score >= T[2]) return 3;
  if (score >= T[1]) return 2;
  if (score >= T[0]) return 1;
  return 0;
}

export function levelForScore(score) {
  return 1 + Math.floor(score / GAME.LEVEL_EVERY);
}

export function gainForCombo(combo) {
  return Math.min(GAME.MAX_GAIN, 1 + Math.floor(combo / 5));
}

export function roundTtlFor(level) {
  return Math.max(GAME.MIN_ROUND_TTL, GAME.ROUND_TTL - (level - 1) * GAME.TTL_DECAY_PER_LEVEL);
}

// ------------------------------------------------------------------ createRun
export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const best = opts.best ?? 0;

  const state = {
    phase: 'playing', // 'playing' | 'over'
    score: 0,
    lives: GAME.LIVES,
    maxLives: GAME.MAX_LIVES,
    combo: 0,
    bestCombo: 0,
    target: COLORS[0],
    bubbles: [],      // { id, kind:'bubble'|'rock', color:string|null, label:string }
    round: 0,
    roundTtl: GAME.ROUND_TTL,
    level: 1,
    stars: 0,
    best,
    newBestSeen: false,
    result: null,     // { reason, score, stars, bestCombo }
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
  };

  function emit(type, payload = {}) {
    run._events.push({ type, ...payload });
  }

  function pick(arr) {
    return arr[Math.floor(rng() * arr.length) % arr.length];
  }

  // 泡泡上的「文字」：随机取一个 ≠ 自身颜色的颜色名（斯特鲁普干扰）
  function colorLabel(exclude) {
    let c;
    do { c = pick(COLORS); } while (c === exclude);
    return c;
  }

  function spawnRound() {
    state.round += 1;
    state.roundTtl = roundTtlFor(state.level);
    state.target = pick(COLORS);
    const bubbles = [];
    for (let i = 0; i < COLORS.length; i += 1) {
      const color = COLORS[i];
      bubbles.push({ id: `b${state.round}-${i}`, kind: 'bubble', color, label: colorLabel(color) });
    }
    // 岩石陷阱：L2 起每 3 轮出现一次（灰岩写颜色词诱导误点）
    if (state.level >= 2 && state.round % 3 === 0) {
      bubbles.push({ id: `r${state.round}`, kind: 'rock', color: null, label: pick(COLORS) });
      emit('rockSpawn', { round: state.round });
    }
    state.bubbles = bubbles;
    emit('spawn', { round: state.round, target: state.target });
  }

  function finish(reason) {
    if (state.phase === 'over') return;
    state.phase = 'over';
    state.stars = starRating(state.score);
    state.result = { reason, score: state.score, stars: state.stars, bestCombo: state.bestCombo };
    emit('gameover', {
      reason,
      score: state.score,
      stars: state.stars,
      bestCombo: state.bestCombo,
    });
  }

  function endRound(reason) {
    if (state.lives <= 0) {
      finish(reason);
      return { ok: true, reason: 'gameover' };
    }
    spawnRound();
    return { ok: true, reason };
  }

  // ---- 玩家动作：点泡泡 ----
  run.tap = function (id) {
    if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
    const b = state.bubbles.find((x) => x.id === id);
    if (!b) return { ok: false, reason: 'none' };

    if (b.kind === 'rock') {
      state.combo = 0;
      state.lives -= 1;
      emit('rockTap', { id });
      return endRound('rock');
    }

    if (b.color === state.target) {
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      const gain = gainForCombo(state.combo);
      state.score += gain;
      if (state.score > state.best && !state.newBestSeen) {
        state.newBestSeen = true;
        emit('newBest', { score: state.score });
      }
      emit('correct', { id, gain, combo: state.combo });
      const lv = levelForScore(state.score);
      if (lv > state.level) {
        state.level = lv;
        emit('levelUp', { level: state.level });
      }
      if (GAME.COMBO_STEPS.includes(state.combo)) emit('comboUp', { combo: state.combo });
      if (state.combo === 8) emit('flawless', { combo: state.combo });
      spawnRound();
      return { ok: true, gain };
    }

    // 点错颜色
    state.combo = 0;
    state.lives -= 1;
    emit('wrong', { id, target: state.target });
    return endRound('wrong');
  };

  // ---- 时间推进 ----
  run.step = function (dt) {
    if (state.phase !== 'playing') return;
    dt = Number(dt);
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (dt > 1) dt = 1; // 防大跳帧
    state.roundTtl -= dt;
    if (state.roundTtl <= 0) {
      state.combo = 0;
      state.lives -= 1;
      emit('timeout', { round: state.round });
      endRound('timeout');
    }
  };

  run.drainEvents = function () {
    const ev = run._events;
    run._events = [];
    return ev;
  };

  run.getHud = function () {
    return {
      phase: state.phase,
      score: state.score,
      lives: state.lives,
      combo: state.combo,
      bestCombo: state.bestCombo,
      level: state.level,
      target: state.target,
      round: state.round,
      roundTtl: state.roundTtl,
      stars: state.stars,
    };
  };

  spawnRound();
  return run;
}
