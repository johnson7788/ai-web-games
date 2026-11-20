// CARD ROYALE · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 玩法：宫廷 TriPeaks 接龙。牌阵为「多峰三角阵」，上层盖下层相邻两列；
//       点击与弃牌堆底牌相邻序数（K/A 相接）的露头牌清牌；库存翻完可重翻有限次。
// 原创机制：皇家连胜（连续 5 张不断连出牌）、同花连击加分、冻结牌（先解冻）、
//           鬼牌（万能）、藏宝牌（翻倍分）、限时。
// 随机：注入 seed 的 mulberry32，可复现。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

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

// ------------------------------------------------------------------ 花色/序数
export const SUITS = [
  { id: 0, sym: '♠', color: 'black' },
  { id: 1, sym: '♥', color: 'red' },
  { id: 2, sym: '♣', color: 'black' },
  { id: 3, sym: '♦', color: 'red' },
];

export function colorOf(suit) {
  return suit === 0 || suit === 2 ? 'black' : 'red';
}

// 相邻序数：K(13) 与 A(1) 相接；其余差 1。
export function rankAdjacent(a, b) {
  if (a == null || b == null) return false;
  const d = ((a - b) % 13 + 13) % 13;
  return d === 1 || d === 12;
}

// 是否同色（红/黑）
export function sameColor(suitA, suitB) {
  return colorOf(suitA) === colorOf(suitB);
}

// ------------------------------------------------------------------ 牌阵几何
// 每峰：行 r=0..rows-1（r=0 为底），列 c=0..(rows-1-r)。第 p 峰右移 p*(rows-1) 列，多峰共享底座。
// 覆盖关系：卡 (r,c) 被 (r+1,c-1) 与 (r+1,c) 覆盖（上层两卡压下层一卡）。
// 返回 [r, c] 数组。
export function buildPositions(peaks, rows) {
  const cells = new Map();
  for (let p = 0; p < peaks; p += 1) {
    const off = p * (rows - 1);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c <= rows - 1 - r; c += 1) {
        cells.set(`${r},${c + off}`, true);
      }
    }
  }
  return [...cells.keys()].map((s) => s.split(',').map(Number));
}

// ------------------------------------------------------------------ 洗牌
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  // 标准 52 张 + 可选 1 张鬼牌
  const deck = [];
  let idc = 0;
  for (let rank = 1; rank <= 13; rank += 1) {
    for (let suit = 0; suit < 4; suit += 1) {
      deck.push({
        id: idc++,
        rank,
        suit,
        color: colorOf(suit),
        wild: false,
        frozen: false,
        thawed: false,
        treasure: false,
        r: null,
        c: null,
      });
    }
  }
  if (level.wildcard) {
    deck.push({
      id: idc++,
      rank: 0,
      suit: -1,
      color: null,
      wild: true,
      frozen: false,
      thawed: true,
      treasure: false,
      r: null,
      c: null,
    });
  }
  shuffle(deck, rng);

  // 发牌阵
  const positions = buildPositions(level.peaks, level.rows);
  const board = [];
  positions.forEach(([r, c], i) => {
    const card = deck[i];
    card.r = r;
    card.c = c;
    board.push(card);
  });
  const stock = deck.slice(positions.length);
  const waste = [stock.pop()]; // 预翻开底牌

  // 冻结牌 / 藏宝牌：随机挑不同牌
  const boardIdx = shuffle(board.map((_, i) => i), rng);
  for (let i = 0; i < level.frozen; i += 1) {
    const bi = boardIdx[i];
    if (bi != null) board[bi].frozen = true;
  }
  const boardIdx2 = shuffle(board.map((_, i) => i), rng);
  let treasureAssigned = 0;
  for (let i = 0; i < boardIdx2.length && treasureAssigned < level.treasure; i += 1) {
    const bi = boardIdx2[i];
    if (board[bi].frozen) continue; // 藏宝与冻结不重叠，避免规则纠缠
    board[bi].treasure = true;
    treasureAssigned += 1;
  }

  const state = {
    level: level.index,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    board,
    stock,
    waste,
    redeals: level.redeals,
    redealsTotal: level.redeals,
    score: 0,
    streak: 0,           // 连续出牌数（翻牌/重翻会清零）
    bestStreak: 0,
    colorCombo: 0,       // 连续同色出牌数
    lastColor: null,
    timeLeft: level.time || null,
    initialTime: level.time || null,
    stars: 0,
    result: null,
    cardsPlayed: 0,
    cardsTotal: board.length,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastSecond: level.time ? Math.ceil(level.time) : null,

    // ---- 时间推进（限时关）
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      if (level.time) {
        s.timeLeft -= dt;
        const sec = Math.ceil(s.timeLeft);
        if (sec < this._lastSecond && sec >= 0) {
          this._lastSecond = sec;
          this._emit({ type: 'timeTick', timeLeft: sec });
        }
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          this._lose('timeOut');
          return;
        }
      }
      this._checkStuck();
    },

    // ---- 翻牌：库存顶牌 → 弃牌堆（改变底牌）
    draw() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.stock.length === 0) {
        if (s.redeals > 0 && s.waste.length > 1) return this.redeal();
        this._checkStuck();
        return { ok: false, reason: 'noStock' };
      }
      const card = s.stock.pop();
      card.thawed = true;
      s.waste.push(card);
      s.streak = 0;
      this._emit({ type: 'draw', card, wild: card.wild });
      if (card.wild) this._emit({ type: 'wildcard' });
      this._checkStuck();
      return { ok: true, card };
    },

    // ---- 出牌：露头牌且与底牌相邻（或底牌为鬼牌）
    play(id) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const card = s.board.find((c) => c.id === id);
      if (!card) return { ok: false, reason: 'notOnBoard' };
      if (!this.isUncovered(card)) return { ok: false, reason: 'covered' };
      if (card.frozen && !card.thawed) return { ok: false, reason: 'frozen' };
      const active = s.waste[s.waste.length - 1];
      if (!active.wild && !rankAdjacent(card.rank, active.rank)) return { ok: false, reason: 'notAdjacent' };

      const beforeUncovered = new Set(s.board.filter((c) => this.isUncovered(c)).map((c) => c.id));
      // 移除牌
      s.board = s.board.filter((c) => c.id !== id);
      s.waste.push(card);
      s.cardsPlayed += 1;

      // 计分
      let gained = GAME.BASE_SCORE;
      const isSameColor = s.lastColor != null && card.color === s.lastColor;
      if (isSameColor) {
        s.colorCombo += 1;
        gained += GAME.COMBO_COLOR_BONUS * s.colorCombo;
        this._emit({ type: 'combo', combo: s.colorCombo, color: card.color });
      } else {
        s.colorCombo = 0;
      }
      s.lastColor = card.color;
      if (card.treasure) gained *= GAME.TREASURE_MULT;
      s.score += gained;

      s.streak += 1;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      if (s.streak === GAME.ROYAL_STREAK_MIN) {
        s.score += GAME.ROYAL_BONUS;
        this._emit({ type: 'royalStreak', streak: s.streak });
      }

      this._emit({ type: 'play', card, gained, streak: s.streak, score: s.score });

      // 露头揭示
      const newly = s.board.filter((c) => this.isUncovered(c) && !beforeUncovered.has(c.id));
      for (const c of newly) this._emit({ type: 'reveal', card: c });

      if (s.board.length === 0) {
        this._win();
      } else {
        this._checkStuck();
      }
      return { ok: true, card, gained };
    },

    // ---- 解冻
    thaw(id) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const card = s.board.find((c) => c.id === id);
      if (!card) return { ok: false, reason: 'notOnBoard' };
      if (!card.frozen) return { ok: false, reason: 'notFrozen' };
      if (card.thawed) return { ok: false, reason: 'alreadyThawed' };
      if (!this.isUncovered(card)) return { ok: false, reason: 'covered' };
      card.thawed = true;
      this._emit({ type: 'thaw', card });
      return { ok: true, card };
    },

    // ---- 重翻：库存空时，弃牌堆（保留底牌）洗回库存，消耗一次
    redeal() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.stock.length > 0) return { ok: false, reason: 'stockNotEmpty' };
      if (s.waste.length <= 1) return { ok: false, reason: 'noWaste' };
      if (s.redeals <= 0) return { ok: false, reason: 'noRedeals' };
      const top = s.waste[s.waste.length - 1];
      const rest = s.waste.slice(0, -1);
      s.waste = [top];
      // 确定性重翻：弃牌堆自底向上按序回到库存，先抽到的是原弃牌堆最底部那张
      for (const c of rest) s.stock.push(c);
      s.redeals -= 1;
      s.streak = 0;
      this._emit({ type: 'redeal', redeals: s.redeals, restored: rest.length });
      this._checkStuck();
      return { ok: true };
    },

    // ---- 露头判断
    isUncovered(card) {
      return !this._coverer(card, -1) && !this._coverer(card, 0);
    },

    _coverer(card, dc) {
      return this.state.board.some((c) => c.r === card.r + 1 && c.c === card.c + dc);
    },

    // 当前可出的牌（露头、非冻结或已解冻、与底牌相邻或底牌为鬼牌）
    playableCards() {
      const s = this.state;
      const active = s.waste[s.waste.length - 1];
      return s.board.filter((c) =>
        this.isUncovered(c) && (!c.frozen || c.thawed) && (active.wild || rankAdjacent(c.rank, active.rank)));
    },

    canAct() {
      const s = this.state;
      if (s.phase !== 'playing') return false;
      if (this.playableCards().length > 0) return true;
      if (s.stock.length > 0) return true;
      if (s.redeals > 0 && s.waste.length > 1) return true;
      return false;
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        streak: s.streak,
        bestStreak: s.bestStreak,
        redeals: s.redeals,
        redealsTotal: s.redealsTotal,
        stockLen: s.stock.length,
        wasteLen: s.waste.length,
        boardLen: s.board.length,
        timeLeft: s.timeLeft,
        stars: s.stars,
        active: s.waste[s.waste.length - 1],
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---- 求解器用：深拷贝快照
    snapshot() {
      const s = this.state;
      return {
        board: s.board.map((c) => ({ ...c })),
        stock: s.stock.map((c) => ({ ...c })),
        waste: s.waste.map((c) => ({ ...c })),
        redeals: s.redeals,
      };
    },

    // ---- 求解器用：按移动序列执行（供 selfplay/bot）
    executeMove(mv) {
      if (mv.t === 'draw') return this.draw();
      if (mv.t === 'redeal') return this.redeal();
      if (mv.t === 'thaw') return this.thaw(mv.id);
      if (mv.t === 'play') return this.play(mv.id);
      return { ok: false, reason: 'unknown' };
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _checkStuck() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (!this.canAct()) this._lose('stuck');
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      let stars = 1;
      if (level.time) {
        if (s.timeLeft > 0) stars += 1;
      } else if (s.redeals > 0) {
        stars += 1;
      }
      if (s.score >= level.starScore) stars += 1;
      stars = Math.min(3, stars);
      s.stars = stars;
      s.result = {
        won: true,
        stars,
        score: s.score,
        redeals: s.redeals,
        timeLeft: s.timeLeft,
        bestStreak: s.bestStreak,
      };
      this._emit({ type: 'win', stars, score: s.score, bestStreak: s.bestStreak });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = {
        won: false,
        stars: 0,
        score: s.score,
        redeals: s.redeals,
        timeLeft: s.timeLeft,
        reason,
      };
      this._emit({ type: 'lose', reason });
    },
  };

  run._emit({ type: 'deal', level: level.index, board: board.length });

  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
