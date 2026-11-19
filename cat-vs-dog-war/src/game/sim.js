// CAT VS DOG WAR · 纯逻辑 sim（无 DOM，Node 可 import）
// 玩法：5 洞打地鼠。小动物钻出 → 点几下打死得分 → 洞口 0.5s 后出下一只。
//   点石头扣心扣分；动物超时逃脱扣心；3 波 20s 各有一个累计分数门槛；3 心归零判负。
import { GAME, MONSTER_TYPES, ROCK } from '../../config/game.config.js';

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPE_KEYS = Object.keys(MONSTER_TYPES);

// 按 weight 加权抽一种小动物类型
function pickType(rng) {
  let r = rng();
  for (const k of TYPE_KEYS) {
    const w = MONSTER_TYPES[k].weight;
    if (r < w) return k;
    r -= w;
  }
  return TYPE_KEYS[TYPE_KEYS.length - 1];
}

function starRating(score) {
  if (score >= GAME.STARS_3) return 3;
  if (score >= GAME.STARS_2) return 2;
  return 1;
}

export function createRun(seed = 1) {
  const rng = mulberry32(seed | 0 || 1);

  const state = {
    phase: 'playing',           // playing | won | lost
    stage: 1,
    stageCount: GAME.STAGE_COUNT,
    timeLeft: GAME.STAGE_TIME,
    score: 0,
    best: 0,
    combo: 0,
    bestCombo: 0,
    hearts: GAME.HEARTS,
    target: GAME.STAGE_TARGETS[0],
    kills: 0,
    escapes: 0,
    rockHits: 0,
    taps: 0,
    deaths: 0,
    levelsReached: 1,
    t: 0,
    comboWindowT: GAME.COMBO_WINDOW + 1, // 初始无连击
    holes: [],
    reason: null,
  };

  for (let i = 0; i < 5; i += 1) {
    state.holes.push({ monster: null, respawnT: 0.2 + i * GAME.INITIAL_STAGGER });
  }

  const pending = [];

  function emit(type, payload = {}) {
    pending.push({ type, ...payload });
  }

  function lose(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    state.deaths = 1;
    state.reason = reason;
    emit('lose', { reason, score: state.score, stage: state.stage });
  }

  function win() {
    if (state.phase !== 'playing') return;
    state.phase = 'won';
    state.reason = 'win';
    const stars = starRating(state.score);
    emit('win', { score: state.score, stars, stage: state.stage, bestCombo: state.bestCombo });
  }

  function spawn(holeIndex) {
    const hole = state.holes[holeIndex];
    const r = rng();
    if (r < GAME.ROCK_WEIGHT) {
      hole.monster = { type: 'rock', tapsLeft: 0, tapsNeeded: 0, score: ROCK.score, age: 0, lifetime: ROCK.lifetime };
      emit('rockSpawn', { hole: holeIndex });
      return;
    }
    const type = pickType(rng);
    const def = MONSTER_TYPES[type];
    hole.monster = {
      type,
      tapsLeft: def.taps,
      tapsNeeded: def.taps,
      score: def.score,
      age: 0,
      lifetime: def.lifetime,
    };
    emit('spawn', { hole: holeIndex, kind: type });
  }

  function tapHole(holeIndex) {
    if (state.phase !== 'playing') return { ok: false };
    const hole = state.holes[holeIndex];
    if (!hole) return { ok: false };
    const m = hole.monster;
    if (!m) return { ok: false, miss: true };

    // 点石头：扣分 + 扣心 + 连击清空
    if (m.type === 'rock') {
      state.score = Math.max(0, state.score + ROCK.score);
      state.hearts -= 1;
      state.rockHits += 1;
      const wasCombo = state.combo;
      state.combo = 0;
      state.comboWindowT = GAME.COMBO_WINDOW + 1;
      emit('rockHit', { hole: holeIndex, hearts: state.hearts });
      if (wasCombo >= 2) emit('comboBreak', { combo: wasCombo });
      hole.monster = null;
      hole.respawnT = GAME.RESPAWN;
      if (state.hearts <= 0) lose('noHearts');
      return { ok: true, rock: true };
    }

    // 点小动物：还剩几次就还要再点
    m.tapsLeft -= 1;
    state.taps += 1;
    if (m.tapsLeft > 0) {
      emit('hit', { hole: holeIndex, kind: m.type, left: m.tapsLeft });
      return { ok: true, hit: true };
    }

    // 打死：加分 + 连击
    state.kills += 1;
    state.combo += 1;
    state.comboWindowT = 0;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const mult = Math.min(state.combo, GAME.COMBO_MAX);
    const gained = m.score * mult;
    state.score += gained;
    emit('kill', { hole: holeIndex, kind: m.type, gained });
    emit('score', { score: state.score, gained, combo: mult });
    if (state.combo >= 2) emit('combo', { combo: mult });
    hole.monster = null;
    hole.respawnT = GAME.RESPAWN;
    return { ok: true, kill: true, gained };
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    state.t += dt;
    state.timeLeft -= dt;

    // 连击窗口超时 → 连击清空
    state.comboWindowT += dt;
    if (state.combo > 0 && state.comboWindowT > GAME.COMBO_WINDOW) {
      const was = state.combo;
      state.combo = 0;
      emit('comboBreak', { combo: was });
    }

    for (let i = 0; i < state.holes.length; i += 1) {
      const hole = state.holes[i];
      if (hole.monster) {
        const m = hole.monster;
        m.age += dt;
        if (m.age >= m.lifetime) {
          if (m.type === 'rock') {
            // 石头自己消失，不惩罚
            hole.monster = null;
            hole.respawnT = GAME.RESPAWN;
          } else {
            // 小动物逃脱：扣心 + 连击清空
            state.escapes += 1;
            state.hearts -= 1;
            const was = state.combo;
            state.combo = 0;
            state.comboWindowT = GAME.COMBO_WINDOW + 1;
            emit('escape', { hole: i, kind: m.type, hearts: state.hearts });
            if (was >= 2) emit('comboBreak', { combo: was });
            hole.monster = null;
            hole.respawnT = GAME.RESPAWN;
            if (state.hearts <= 0) { lose('noHearts'); return; }
          }
        }
      } else {
        hole.respawnT -= dt;
        if (hole.respawnT <= 0) spawn(i);
      }
    }

    // 每波结束判定
    if (state.timeLeft <= 0) {
      if (state.score >= state.target) {
        if (state.stage >= GAME.STAGE_COUNT) {
          win();
        } else {
          state.stage += 1;
          state.levelsReached = state.stage;
          state.target = GAME.STAGE_TARGETS[state.stage - 1];
          state.timeLeft = GAME.STAGE_TIME;
          emit('stageClear', { stage: state.stage - 1, score: state.score });
          emit('stageUp', { stage: state.stage, target: state.target });
        }
      } else {
        lose('timeUp');
      }
    }
  }

  function drainEvents() {
    const out = pending.splice(0, pending.length);
    return out;
  }

  function getHud() {
    return {
      timeLeft: Math.max(0, state.timeLeft),
      score: state.score,
      target: state.target,
      stage: state.stage,
      stageCount: state.stageCount,
      hearts: Math.max(0, state.hearts),
      combo: Math.min(state.combo, GAME.COMBO_MAX),
      best: state.best,
    };
  }

  return {
    state,
    step,
    drainEvents,
    tapHole,
    getHud,
    spawn,           // 供调试/测试直接触发
    starRating,
  };
}

export { GAME, MONSTER_TYPES, ROCK, starRating };
