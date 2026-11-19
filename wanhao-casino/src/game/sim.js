// WANHAO CASINO · 纯逻辑 sim（无 DOM，可被 node --test / selfplay 直接 import）
//
// 玩法骨架（P0 1:1 自「推饼/二锅头」）：
//   庄家(House) vs 三门(Sun/Moon/Star)，每手两张牌，比较牌力：
//     双万能牌(100) > 对子(21~29，万能+任意=对子) > 点数((a+b)%10，0~9)
//   点数大者胜；平局庄家通吃。
// 新增 3 机制：
//   1) 万能牌 Joker（第 2 轮起入牌堆）
//   2) 连胜倍率（第 3 轮起，连续赢轮抬高下一轮赔付，×3 封顶）
//   3) 多门连击（第 4 轮起，同一轮赢 ≥2 门送额外奖励）
//
// 导出：createRun(seed) / mulberry32 / evalHand / 常量（供测试与 selfplay）。

export const TILE_MIN = 1;
export const TILE_MAX = 9;
export const JOKER = 0;
export const CHIP_SIZES = [100, 500, 1000, 5000, 10000];
export const HAND_ORDER = ['house', 'sun', 'moon', 'star'];
export const DOOR_KEYS = ['sun', 'moon', 'star'];

export const GAME = {
  START_CHIPS: 50000,
  MIN_BET: 100,
  MAX_ROUNDS: 8,
  JOKER_CHANCE: 0.12,
  JOKER_CHANCE_HIGH: 0.2,
  STREAK_CAP: 3.0,
  ROLL_TIME: 1.1,
  REVEAL_INTERVAL: 0.55,
  SETTLE_TIME: 1.15,
};

// 确定性 PRNG（selfplay / 测试用固定 seed）
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

// 手牌力：返回 { kind, power, t1, t2, hasJoker }
export function evalHand(t1, t2) {
  const j1 = t1 === JOKER;
  const j2 = t2 === JOKER;
  if (j1 && j2) return { t1, t2, kind: 'doubleJoker', power: 100, hasJoker: true };
  if (j1 || j2) {
    const x = j1 ? t2 : t1;
    return { t1, t2, kind: 'pair', power: 20 + x, hasJoker: true };
  }
  if (t1 === t2) return { t1, t2, kind: 'pair', power: 20 + t1, hasJoker: false };
  return { t1, t2, kind: 'point', power: (t1 + t2) % 10, hasJoker: false };
}

// 本轮是否启用某机制（level = round，1 基）
export function featuresForRound(round) {
  return {
    joker: round >= 2,
    streak: round >= 3,
    combo: round >= 4,
    highStakes: round >= 5,
    shadow: round >= 6,
    jokerHigh: round >= 7,
  };
}

// 牌面（t1/t2）→ 显示值
export function tileLabel(t) {
  return t === JOKER ? 'J' : String(t);
}

function makeRun(seed) {
  const rng = mulberry32(seed);
  const state = {
    phase: 'betting',           // betting | rolling | reveal | settle | won | lost
    round: 1,
    chips: GAME.START_CHIPS,
    startChips: GAME.START_CHIPS,
    selectedChip: CHIP_SIZES[0],
    streak: 0,                  // 已完成的连续净胜轮数
    bets: { sun: 0, moon: 0, star: 0 },
    dice: [0, 0],
    hands: { house: null, sun: null, moon: null, star: null },
    revealIdx: -1,
    results: { sun: null, moon: null, star: null },
    net: 0,
    lastNet: 0,
    stars: 0,
    completed: false,
    bankrupt: false,
    shadowDoor: null,           // 迷雾门（第 6 轮起）
    mult: 1,                    // 本局生效的连胜倍率
    comboBonus: 0,
    timers: { rolling: 0, reveal: 0, settle: 0 },
    _events: [],
  };

  function push(type, payload) {
    state._events.push({ type, ...(payload || {}) });
  }

  function features() { return featuresForRound(state.round); }

  function drawTile() {
    const f = features();
    const chance = f.joker ? (f.jokerHigh ? GAME.JOKER_CHANCE_HIGH : GAME.JOKER_CHANCE) : 0;
    if (rng() < chance) return JOKER;
    return TILE_MIN + Math.floor(rng() * (TILE_MAX - TILE_MIN + 1));
  }

  function dealHand() {
    return evalHand(drawTile(), drawTile());
  }

  // 本轮赔付倍率（依据开局前的连胜）
  function currentMult() {
    if (!features().streak) return 1;
    if (state.streak < 2) return 1;
    return Math.min(GAME.STREAK_CAP, 1 + 0.5 * (state.streak - 1));
  }

  function betTotal() {
    return state.bets.sun + state.bets.moon + state.bets.star;
  }

  function revealNext() {
    const idx = state.revealIdx;
    if (idx < 0 || idx >= HAND_ORDER.length) return;
    const who = HAND_ORDER[idx];
    const hand = state.hands[who];
    push('reveal', { who, t1: hand.t1, t2: hand.t2, kind: hand.kind, power: hand.power });
    if (hand.hasJoker) push('joker', { who });
  }

  function doSettle() {
    const f = features();
    const mult = currentMult();
    state.mult = mult;
    let net = 0;
    let wins = 0;
    let minWinBet = Infinity;
    for (const dk of DOOR_KEYS) {
      const bet = state.bets[dk];
      if (bet <= 0) { state.results[dk] = null; continue; }
      const house = state.hands.house;
      const door = state.hands[dk];
      if (door.power > house.power) {
        const profit = Math.round(bet * mult);
        state.chips += bet + profit; // 返还本金 + 盈利
        net += profit;
        wins += 1;
        if (bet < minWinBet) minWinBet = bet;
        state.results[dk] = 'win';
        push('doorWin', { door: dk, bet, profit });
      } else {
        net -= bet;
        state.results[dk] = 'lose';
        push('doorLose', { door: dk, bet });
      }
    }
    if (f.combo && wins >= 2 && minWinBet !== Infinity) {
      const bonus = (wins - 1) * minWinBet;
      state.chips += bonus;
      net += bonus;
      state.comboBonus = bonus;
      push('combo', { wins, bonus });
    }
    state.net = net;
    state.lastNet = net;
    push('settle', { net });
    if (net > 0) {
      state.streak += 1;
      push('roundWin', { net, streak: state.streak });
    } else {
      state.streak = 0;
      push('roundLose', { net });
    }
    if (mult > 1) push('streak', { multiplier: mult });
  }

  function afterSettle() {
    if (state.chips < GAME.MIN_BET) {
      state.phase = 'lost';
      state.bankrupt = true;
      state.completed = false;
      push('bankrupt', { chips: state.chips });
      push('lose', { reason: 'bankrupt', finalChips: state.chips, round: state.round });
      return;
    }
    if (state.round >= GAME.MAX_ROUNDS) {
      state.phase = 'won';
      state.completed = true;
      state.stars = starRating();
      push('win', { stars: state.stars, finalChips: state.chips, round: state.round });
      return;
    }
    state.round += 1;
    state.bets = { sun: 0, moon: 0, star: 0 };
    state.results = { sun: null, moon: null, star: null };
    state.hands = { house: null, sun: null, moon: null, star: null };
    state.dice = [0, 0];
    state.revealIdx = -1;
    state.net = 0;
    state.comboBonus = 0;
    state.shadowDoor = features().shadow ? DOOR_KEYS[Math.floor(rng() * 3)] : null;
    state.phase = 'betting';
    push('roundStart', { round: state.round, shadowDoor: state.shadowDoor });
  }

  function starRating() {
    if (state.chips >= state.startChips * 2) return 3;
    if (state.chips >= state.startChips) return 2;
    return 1;
  }

  const api = {
    state,

    step(dt) {
      if (state.phase === 'rolling') {
        state.timers.rolling -= dt;
        if (state.timers.rolling <= 0) {
          state.phase = 'reveal';
          state.revealIdx = 0;
          state.timers.reveal = GAME.REVEAL_INTERVAL;
          revealNext();
        }
      } else if (state.phase === 'reveal') {
        state.timers.reveal -= dt;
        if (state.timers.reveal <= 0) {
          state.revealIdx += 1;
          if (state.revealIdx < HAND_ORDER.length) {
            state.timers.reveal = GAME.REVEAL_INTERVAL;
            revealNext();
          } else {
            doSettle();
            state.phase = 'settle';
            state.timers.settle = GAME.SETTLE_TIME;
          }
        }
      } else if (state.phase === 'settle') {
        state.timers.settle -= dt;
        if (state.timers.settle <= 0) afterSettle();
      }
    },

    drainEvents() {
      const evs = state._events;
      state._events = [];
      return evs;
    },

    // 下注：把当前筹码档押到指定门（可累加）
    bet(door) {
      if (state.phase !== 'betting') return { ok: false, reason: 'phase' };
      if (!DOOR_KEYS.includes(door)) return { ok: false, reason: 'door' };
      if (state.selectedChip > state.chips) return { ok: false, reason: 'poor' };
      state.bets[door] += state.selectedChip;
      state.chips -= state.selectedChip;
      push('bet', { door, amount: state.selectedChip, allin: false });
      return { ok: true, door, amount: state.selectedChip };
    },

    selectChip(n) {
      if (!CHIP_SIZES.includes(n)) return { ok: false };
      state.selectedChip = n;
      push('selectChip', { amount: n });
      return { ok: true, amount: n };
    },

    // 开牌：掷骰 + 发牌，进入 rolling
    roll() {
      if (state.phase !== 'betting') return { ok: false, reason: 'phase' };
      if (betTotal() <= 0) return { ok: false, reason: 'nobet' };
      const d1 = 1 + Math.floor(rng() * 6);
      const d2 = 1 + Math.floor(rng() * 6);
      state.dice = [d1, d2];
      state.hands.house = dealHand();
      for (const dk of DOOR_KEYS) state.hands[dk] = dealHand();
      state.revealIdx = -1;
      state.net = 0;
      state.comboBonus = 0;
      state.phase = 'rolling';
      state.timers.rolling = GAME.ROLL_TIME;
      push('roll', {});
      push('dice', { d1, d2 });
      return { ok: true };
    },

    // 全押：把当前可下注筹码全部押到指定门
    allin(door) {
      if (state.phase !== 'betting') return { ok: false, reason: 'phase' };
      if (!DOOR_KEYS.includes(door)) return { ok: false, reason: 'door' };
      if (state.chips <= 0) return { ok: false, reason: 'poor' };
      const amount = state.chips;
      state.bets[door] += amount;
      state.chips -= amount;
      push('bet', { door, amount, allin: true });
      return { ok: true, door, amount };
    },

    getHud() {
      return {
        phase: state.phase,
        round: state.round,
        chips: state.chips,
        streak: state.streak,
        mult: state.mult,
        betTotal: betTotal(),
        stars: state.stars,
      };
    },

    // 调试/截图辅助：强制指定四手牌并跳到全部翻开状态（不回退轮次）
    forceHands(hands) {
      if (!hands) return false;
      for (const who of HAND_ORDER) {
        const [a, b] = hands[who] || [1, 2];
        state.hands[who] = evalHand(a, b);
      }
      state.dice = [6, 6];
      state.revealIdx = 3;
      state.phase = 'reveal';
      state.timers.reveal = 5;
      return true;
    },
  };

  return api;
}

export function createRun(seed = 1) {
  const s = typeof seed === 'number' ? seed : (Number(seed) || 1);
  const run = makeRun((s >>> 0) || 1);
  return run;
}
