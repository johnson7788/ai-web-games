// 纯逻辑：霓虹记忆翻牌（memory match）
// 阶段：memorize（牌正面朝上倒计时）→ playing（翻回背面，翻牌配对）→ won | lost。
// 纯 Node 可测：不依赖 DOM / canvas / audio。事件经 drainEvents() 消费。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

export function createRun(levelIndex, opts = {}) {
  const level = LEVELS[levelIndex] || LEVELS[0];
  const mode = opts.mode || 'timed';
  const timed = mode !== 'practice';
  const seed = opts.seed == null ? 1 : (opts.seed | 0);
  const rng = mulberry32(seed);

  // 每个符号出现 groupOf 次
  const deck = [];
  for (const sym of level.symbols) {
    for (let i = 0; i < level.groupOf; i += 1) deck.push(sym);
  }
  const order = shuffleWith(rng, deck);

  const cards = order.map((name, id) => ({
    id,
    name,
    revealed: true, // memorize 阶段正面朝上
    matched: false,
  }));

  const totalTime = timed ? GAME.timedBase : 0;

  const state = {
    level: level.index,
    mode,
    rows: level.grid.row,
    cols: level.grid.col,
    groupOf: level.groupOf,
    memorizeTime: level.memorizeTime ?? GAME.memorizeTime,
    totalTime,
    timeLeft: totalTime,
    elapsed: 0,
    phase: 'memorize', // memorize | playing | won | lost
    cards,
    selected: [],       // 当前已翻开待判定的牌 id
    pendingUnreveal: [],// 配错待翻回的牌 id
    unrevealAt: 0,
    lockedUntil: 0,
    matchedCount: 0,
    combo: 0,
    maxCombo: 0,
    mismatches: 0,
    peekCharges: GAME.peekStart,
    peekUntil: -1,
    memorizeLeft: level.memorizeTime ?? GAME.memorizeTime,
    stars: 0,
    simTime: 0,
  };

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function matchesDone() {
    return state.groupOf > 0 ? state.matchedCount / state.groupOf : 0;
  }

  function computeStars() {
    if (state.phase !== 'won') { state.stars = 0; return; }
    let s = 0;
    if (timed) {
      const ratio = state.totalTime > 0 ? state.timeLeft / state.totalTime : 0;
      if (ratio >= 0.6) s += 2;
      else if (ratio >= 0.35) s += 1;
      if (state.mismatches === 0) s += 1;
    } else {
      if (state.mismatches === 0) s = 3;
      else if (state.mismatches <= 2) s = 2;
      else s = 1;
    }
    state.stars = Math.max(1, Math.min(3, s));
  }

  function resolveGroup() {
    const ids = state.selected.slice();
    const names = ids.map((id) => state.cards[id].name);
    const match = names.every((n) => n === names[0]);

    if (match) {
      for (const id of ids) state.cards[id].matched = true;
      state.matchedCount += ids.length;
      state.combo += 1;
      if (state.combo > state.maxCombo) state.maxCombo = state.combo;

      let bonus = 0;
      if (timed) {
        bonus = GAME.timedBonus;
        if (state.combo >= GAME.comboBonusAt) {
          bonus += GAME.comboBonusSec * (state.combo - GAME.comboBonusAt + 1);
        }
        state.timeLeft += bonus;
        emit('bonus', { combo: state.combo, bonus });
      }
      if (state.combo >= 2) emit('combo', { combo: state.combo });

      const done = matchesDone();
      if (done > 0 && done % GAME.peekEveryMatches === 0 && state.peekCharges < GAME.peekMax) {
        state.peekCharges += 1;
        emit('peekGain', { charges: state.peekCharges });
      }

      emit('match', { ids: ids.slice(), combo: state.combo, matched: state.matchedCount, total: state.cards.length });
      state.selected = [];
      state.lockedUntil = state.simTime + GAME.matchLock;

      if (state.matchedCount === state.cards.length) {
        state.phase = 'won';
        computeStars();
        emit('win', { stars: state.stars, combo: state.maxCombo, mismatches: state.mismatches, timeLeft: state.timeLeft });
      }
    } else {
      state.combo = 0;
      state.mismatches += 1;
      state.pendingUnreveal = ids;
      state.unrevealAt = state.simTime + GAME.mismatchLock;
      state.lockedUntil = state.unrevealAt;
      state.selected = [];
      emit('mismatch', { ids: ids.slice(), mismatches: state.mismatches });
    }
  }

  const run = {
    state,
    step(dt) {
      state.simTime += dt;

      if (state.phase === 'memorize') {
        const prev = Math.ceil(state.memorizeLeft + dt);
        state.memorizeLeft -= dt;
        const now = Math.ceil(Math.max(0, state.memorizeLeft));
        if (now !== prev && now > 0) emit('memorizeTick', { timeLeft: now });
        if (state.memorizeLeft <= 0) {
          state.phase = 'playing';
          for (const c of state.cards) c.revealed = false;
          state.timeLeft = state.totalTime;
          emit('flipDown');
          emit('playing');
        }
        return;
      }

      if (state.phase === 'playing') {
        state.elapsed += dt;
        if (timed) {
          const prevSec = Math.ceil(state.timeLeft);
          state.timeLeft -= dt;
          const secLeft = Math.ceil(Math.max(0, state.timeLeft));
          if (secLeft !== prevSec && secLeft > 0) emit('countdownTick', { timeLeft: secLeft });
          if (state.timeLeft <= 0) {
            state.timeLeft = 0;
            state.phase = 'lost';
            emit('lose', { reason: 'timeUp', mismatches: state.mismatches });
            return;
          }
        }
        if (state.pendingUnreveal.length && state.simTime >= state.unrevealAt) {
          for (const id of state.pendingUnreveal) {
            const c = state.cards[id];
            if (c && !c.matched) c.revealed = false;
          }
          state.pendingUnreveal = [];
          emit('unreveal');
        }
      }
    },

    drainEvents() {
      return events.splice(0);
    },

    showCard(id) {
      if (state.phase !== 'playing') return { ok: false };
      if (state.simTime < state.lockedUntil) return { ok: false };
      if (state.selected.length >= state.groupOf) return { ok: false };
      const c = state.cards[id];
      if (!c || c.matched || c.revealed) return { ok: false };
      c.revealed = true;
      state.selected.push(id);
      emit('reveal', { id, name: c.name });
      if (state.selected.length === state.groupOf) resolveGroup();
      return { ok: true };
    },

    usePeek() {
      if (state.phase !== 'playing') return { ok: false };
      if (state.peekCharges <= 0) return { ok: false };
      if (state.simTime < state.lockedUntil) return { ok: false };
      state.peekCharges -= 1;
      state.peekUntil = state.simTime + GAME.peekDuration;
      emit('peek', { charges: state.peekCharges });
      return { ok: true };
    },

    isFaceUp(card) {
      return card.matched || card.revealed || state.simTime < state.peekUntil;
    },

    getHud() {
      return {
        timeLeft: state.timeLeft,
        matchedCount: state.matchedCount,
        total: state.cards.length,
        combo: state.combo,
        mismatches: state.mismatches,
        peekCharges: state.peekCharges,
        stars: state.stars,
        timed,
      };
    },
  };

  return run;
}
