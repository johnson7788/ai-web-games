// MEMORY TRIP MATCH · 纯逻辑 sim（无 DOM，可在 node --test / selfplay 里跑）。
// 规则：开局 preview 短暂亮出全部卡（记忆），随后盖牌；翻两张配对；
//       配对成功保持翻开 + 连击加分；翻错 1.5s 后盖回并断连击；
//       岩石卡要先敲裂才能翻开；步数超预算判负；通关按步数评 1–3 星。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(levelIndex, opts = {}) {
  const seed = opts.seed == null ? 1 : (opts.seed | 0) || 1;
  const rng = mulberry32(seed);
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0))];

  // 生成 pairs 个符号，各两张，Fisher–Yates 洗牌
  const symbols = [];
  for (let s = 0; s < level.pairs; s += 1) { symbols.push(s); symbols.push(s); }
  for (let i = symbols.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  }

  const rockSymbols = new Set();
  for (let s = 0; s < level.rockPairs; s += 1) rockSymbols.add(s);

  const cards = symbols.map((sym, id) => ({
    id,
    symbol: sym,
    kind: rockSymbols.has(sym) ? 'rock' : 'normal',
    cracked: false,
    revealed: false,
    solved: false,
  }));

  const state = {
    levelIndex,
    level: level.index,
    phase: 'preview',          // preview | playing | won | lost
    pairs: level.pairs,
    totalCards: level.totalCards,
    cols: level.cols,
    rows: level.rows,
    cards,
    flipped: [],               // 当前翻开的卡 id（≤2）
    previewLeft: level.previewSec,
    mismatchLock: 0,           // 翻错后停留秒数
    hintUntil: -1,             // 提示窥牌结束时间点（sim 时间）
    moves: 0,
    moveBudget: level.moveBudget,
    combo: 0,
    maxCombo: 0,
    score: 0,
    stars: 0,
    hintsLeft: level.hints,
    time: 0,
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  const cardById = (id) => state.cards[id];
  const solvedCount = () => state.cards.reduce((n, c) => n + (c.solved ? 1 : 0), 0);
  const rockCount = () => state.cards.reduce((n, c) => n + (c.kind === 'rock' ? 1 : 0), 0);

  emit('levelStart', { level: state.level, pairs: state.pairs });

  function finishWin() {
    state.phase = 'won';
    const par = state.pairs + rockCount();
    state.stars = state.moves <= par ? 3 : state.moves <= Math.ceil(par * GAME.STAR_2_RATIO) ? 2 : 1;
    emit('win', { stars: state.stars, moves: state.moves, score: state.score, combo: state.maxCombo });
  }

  const run = {
    state,
    step(dt) {
      state.time += dt;
      if (state.phase === 'preview') {
        state.previewLeft -= dt;
        if (state.previewLeft <= 0) {
          state.previewLeft = 0;
          state.phase = 'playing';
          emit('previewEnd', {});
        }
      } else if (state.phase === 'playing' && state.mismatchLock > 0) {
        state.mismatchLock -= dt;
        if (state.mismatchLock <= 0) {
          state.mismatchLock = 0;
          const ids = state.flipped.splice(0);
          for (const id of ids) {
            const c = cardById(id);
            if (c && !c.solved) c.revealed = false;
          }
          emit('flipback', {});
        }
      }
    },
    flip(id) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.mismatchLock > 0) return { ok: false, reason: 'lock' };
      if (state.flipped.length >= 2) return { ok: false, reason: 'full' };
      const c = cardById(id);
      if (!c) return { ok: false, reason: 'bad' };
      if (c.solved || c.revealed) return { ok: false, reason: 'state' };

      if (c.kind === 'rock' && !c.cracked) {
        c.cracked = true;
        emit('rockCrack', { id });
        return { ok: true, cracked: true };
      }

      c.revealed = true;
      state.flipped.push(id);
      emit('reveal', { id, symbol: c.symbol });

      if (state.flipped.length === 2) {
        const a = cardById(state.flipped[0]);
        const b = cardById(state.flipped[1]);
        state.moves += 1;
        if (a.symbol === b.symbol) {
          a.solved = true;
          b.solved = true;
          state.flipped.length = 0;
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          const gain = GAME.SCORE_BASE * Math.min(state.combo, GAME.COMBO_MAX);
          state.score += gain;
          emit('match', { symbol: a.symbol, combo: state.combo, gain });
          if (state.combo >= 2) emit('combo', { combo: state.combo });
          if (solvedCount() === state.totalCards) finishWin();
        } else {
          state.combo = 0;
          state.mismatchLock = GAME.MISMATCH_DELAY;
          emit('mismatch', {});
        }
        if (state.phase === 'playing' && state.moves > state.moveBudget) {
          state.phase = 'lost';
          emit('lose', { reason: 'outOfMoves' });
        }
      }
      return { ok: true };
    },
    hint() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.hintsLeft <= 0) return { ok: false, reason: 'empty' };
      state.hintsLeft -= 1;
      state.hintUntil = state.time + GAME.HINT_SECONDS;
      emit('hint', { left: state.hintsLeft });
      return { ok: true, left: state.hintsLeft };
    },
    drainEvents() {
      return events.splice(0);
    },
    // 供测试/自对弈：把剩余卡全部正确配对（按当前已知符号）
    getHud() {
      return {
        phase: state.phase,
        level: state.level,
        moves: state.moves,
        moveBudget: state.moveBudget,
        combo: state.combo,
        score: state.score,
        hintsLeft: state.hintsLeft,
        time: state.time,
      };
    },
  };

  return run;
}
