// DOUDIZHU MASTER · 纯逻辑 sim（零 DOM，Node 可测）
//
// 规则：经典 54 张三人斗地主。你=地主（20 张，含 3 张底牌），两名 AI 农民（各 17 张）为同一队。
// 牌型 14 种：单/对/三/三带一/三带对/顺子(≥5)/连对(≥3)/飞机(≥2 不带)/飞机带单/飞机带对/四带二单/四带两对/炸弹/王炸。
// 大小：3<4<…<K<A<2<小王<大王；2 与王不进顺子；炸弹>普通牌；王炸>一切炸弹；同牌型比 rank，顺子/连对/飞机比长度与 rank。
//
// 导出：TYPES / RANK_LABELS / SUIT_SYMBOL / makeDeck / mulberry32 / classify / canBeat /
//       legalMoves / pickGreedyMove / createRun
// 供：main.js（装配）、tools/selfplay.mjs（自对弈）、tests/*.test.mjs（单元）、render（牌面显示）。

// 点数：3..15（15=2），16=小王，17=大王
export const RANK = { JOKER_SMALL: 16, JOKER_BIG: 17, TWO: 15, ACE: 14 };

export const TYPES = {
  SINGLE: 1,
  PAIR: 2,
  THREE: 3,
  THREE_SINGLE: 4,
  THREE_PAIR: 5,
  STRAIGHT: 6,
  STRAIGHT_PAIR: 7,
  PLANE: 8,
  PLANE_SINGLE: 9,
  PLANE_PAIR: 10,
  FOUR_TWO_SINGLE: 11,
  FOUR_TWO_PAIR: 12,
  BOMB: 13,
  ROCKET: 14,
};

export const TYPE_NAMES = {
  [TYPES.SINGLE]: 'single',
  [TYPES.PAIR]: 'pair',
  [TYPES.THREE]: 'three',
  [TYPES.THREE_SINGLE]: 'three_single',
  [TYPES.THREE_PAIR]: 'three_pair',
  [TYPES.STRAIGHT]: 'straight',
  [TYPES.STRAIGHT_PAIR]: 'straight_pair',
  [TYPES.PLANE]: 'plane',
  [TYPES.PLANE_SINGLE]: 'plane_single',
  [TYPES.PLANE_PAIR]: 'plane_pair',
  [TYPES.FOUR_TWO_SINGLE]: 'four_two_single',
  [TYPES.FOUR_TWO_PAIR]: 'four_two_pair',
  [TYPES.BOMB]: 'bomb',
  [TYPES.ROCKET]: 'rocket',
};

export const RANK_LABELS = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: 'SJ', 17: 'BJ',
};

export const SUIT_SYMBOL = ['♠', '♥', '♦', '♣'];

// ---------------------------------------------------------------- 基础

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let NEXT_ID = 0;
function card(r, s) {
  return { r, s, id: NEXT_ID++ };
}

export function makeDeck() {
  NEXT_ID = 0;
  const deck = [];
  for (let r = 3; r <= 15; r += 1) {
    for (let s = 0; s < 4; s += 1) deck.push(card(r, s));
  }
  deck.push(card(16, -1)); // 小王
  deck.push(card(17, -1)); // 大王
  return deck;
}

export function shuffle(deck, rng) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sortCards = (cards) => cards.slice().sort((a, b) => (a.r - b.r) || (a.s - b.s));

function rankCounts(cards) {
  const m = new Map();
  for (const c of cards) if (c.r < 16) m.set(c.r, (m.get(c.r) || 0) + 1);
  return m;
}

function jokers(cards) {
  return cards.filter((c) => c.r >= 16);
}

function cardsOfRank(cards, rank, n) {
  return cards.filter((c) => c.r === rank).sort((a, b) => a.s - b.s).slice(0, n);
}

function move(type, rank, len, cards) {
  return { type, rank, len, cards };
}

function isConsecutive(sortedRanks) {
  for (let i = 1; i < sortedRanks.length; i += 1) {
    if (sortedRanks[i] !== sortedRanks[i - 1] + 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------- 牌型判定（一组牌 → 规范牌型或 null）

export function classify(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  if (n === 1) return move(TYPES.SINGLE, cards[0].r, 1, cards.slice());
  const js = jokers(cards);
  const normals = cards.filter((c) => c.r < 16);
  const hasSmall = cards.some((c) => c.r === 16);
  const hasBig = cards.some((c) => c.r === 17);
  if (n === 2 && js.length === 2 && hasSmall && hasBig) return move(TYPES.ROCKET, 17, 1, cards.slice());
  if (js.length > 0) return null; // 王只允许单出或王炸

  const counts = rankCounts(normals);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  const vals = ranks.map((r) => counts.get(r));
  const maxRank = ranks[ranks.length - 1];

  // 炸弹 / 单 / 对 / 三
  if (ranks.length === 1) {
    const v = vals[0];
    if (v === 4) return move(TYPES.BOMB, ranks[0], 1, normals.slice());
    if (v === 1) return move(TYPES.SINGLE, ranks[0], 1, normals.slice());
    if (v === 2) return move(TYPES.PAIR, ranks[0], 1, normals.slice());
    if (v === 3) return move(TYPES.THREE, ranks[0], 1, normals.slice());
    return null;
  }

  const allSame = vals.every((v) => v === vals[0]);
  const consecutive = isConsecutive(ranks);

  // 顺子 / 连对 / 飞机不带（rank 最高 ≤14，即 2 不参与）
  if (allSame && consecutive && maxRank <= 14) {
    const len = ranks.length;
    if (vals[0] === 1 && len >= 5) return move(TYPES.STRAIGHT, maxRank, len, normals.slice());
    if (vals[0] === 2 && len >= 3) return move(TYPES.STRAIGHT_PAIR, maxRank, len, normals.slice());
    if (vals[0] === 3 && len >= 2) return move(TYPES.PLANE, maxRank, len, normals.slice());
  }

  const triples = ranks.filter((r) => counts.get(r) === 3);
  const quads = ranks.filter((r) => counts.get(r) === 4);

  // 三带一 / 三带一对
  if (triples.length === 1 && quads.length === 0) {
    const tr = triples[0];
    const rest = normals.filter((c) => c.r !== tr);
    if (n === 4 && rest.length === 1) return move(TYPES.THREE_SINGLE, tr, 1, normals.slice());
    if (n === 5 && rest.length === 2 && rest[0].r === rest[1].r) return move(TYPES.THREE_PAIR, tr, 1, normals.slice());
  }

  // 飞机带单 / 飞机带对 / 飞机不带（triples 连续）
  if (triples.length >= 2 && quads.length === 0) {
    const ts = triples.slice().sort((a, b) => a - b);
    if (isConsecutive(ts) && ts[ts.length - 1] <= 14) {
      const k = ts.length;
      const rest = normals.filter((c) => !ts.includes(c.r));
      const hi = ts[ts.length - 1];
      if (n === 3 * k) return move(TYPES.PLANE, hi, k, normals.slice());
      if (n === 4 * k && rest.length === k) return move(TYPES.PLANE_SINGLE, hi, k, normals.slice());
      if (n === 5 * k && rest.length === 2 * k) {
        const rc = rankCounts(rest);
        if ([...rc.values()].every((v) => v === 2) && rc.size === k) return move(TYPES.PLANE_PAIR, hi, k, normals.slice());
      }
    }
  }

  // 四带二单 / 四带两对
  if (quads.length === 1) {
    const qr = quads[0];
    const rest = normals.filter((c) => c.r !== qr);
    if (n === 6) return move(TYPES.FOUR_TWO_SINGLE, qr, 1, normals.slice());
    if (n === 8 && rest.length === 4) {
      const rc = rankCounts(rest);
      if ([...rc.values()].every((v) => v === 2) && rc.size === 2) return move(TYPES.FOUR_TWO_PAIR, qr, 1, normals.slice());
    }
  }

  return null;
}

export function canBeat(a, b) {
  if (!b) return true;
  if (a.type === TYPES.ROCKET) return true;
  if (b.type === TYPES.ROCKET) return false;
  if (a.type === TYPES.BOMB && b.type !== TYPES.BOMB) return true;
  if (b.type === TYPES.BOMB && a.type !== TYPES.BOMB) return false;
  if (a.type === TYPES.BOMB && b.type === TYPES.BOMB) return a.rank > b.rank;
  if (a.type !== b.type) return false;
  if (a.len !== b.len) return false;
  return a.rank > b.rank;
}

// ---------------------------------------------------------------- 出牌生成（用于 AI / 提示）

function genSingles(hand) {
  const res = [];
  const rc = rankCounts(hand);
  for (const r of [...rc.keys()].sort((a, b) => a - b)) res.push(move(TYPES.SINGLE, r, 1, cardsOfRank(hand, r, 1)));
  for (const j of jokers(hand)) res.push(move(TYPES.SINGLE, j.r, 1, [j]));
  return res;
}

function genPairThreesBombs(hand) {
  const res = [];
  const rc = rankCounts(hand);
  for (const r of [...rc.keys()].sort((a, b) => a - b)) {
    const c = rc.get(r);
    if (c >= 2) res.push(move(TYPES.PAIR, r, 1, cardsOfRank(hand, r, 2)));
    if (c >= 3) res.push(move(TYPES.THREE, r, 1, cardsOfRank(hand, r, 3)));
    if (c >= 4) res.push(move(TYPES.BOMB, r, 1, cardsOfRank(hand, r, 4)));
  }
  return res;
}

function genRocket(hand) {
  const s = hand.find((c) => c.r === 16);
  const b = hand.find((c) => c.r === 17);
  if (s && b) return [move(TYPES.ROCKET, 17, 1, [s, b])];
  return [];
}

function consecutiveRuns(hand, minCount, minLen) {
  const rc = rankCounts(hand);
  const ranks = [...rc.keys()].filter((r) => r <= 14 && rc.get(r) >= minCount).sort((a, b) => a - b);
  const runs = [];
  let i = 0;
  while (i < ranks.length) {
    let j = i;
    while (j + 1 < ranks.length && ranks[j + 1] === ranks[j] + 1) j += 1;
    if (j - i + 1 >= minLen) runs.push(ranks.slice(i, j + 1));
    i = j + 1;
  }
  return runs;
}

function genStraights(hand) {
  const res = [];
  for (const run of consecutiveRuns(hand, 1, 5)) {
    for (let a = 0; a < run.length; a += 1) {
      for (let b = a + 4; b < run.length; b += 1) {
        const seg = run.slice(a, b + 1);
        res.push(move(TYPES.STRAIGHT, seg[seg.length - 1], seg.length, seg.map((r) => cardsOfRank(hand, r, 1)[0])));
      }
    }
  }
  return res;
}

function genStraightPairs(hand) {
  const res = [];
  for (const run of consecutiveRuns(hand, 2, 3)) {
    for (let a = 0; a < run.length; a += 1) {
      for (let b = a + 2; b < run.length; b += 1) {
        const seg = run.slice(a, b + 1);
        res.push(move(TYPES.STRAIGHT_PAIR, seg[seg.length - 1], seg.length, seg.flatMap((r) => cardsOfRank(hand, r, 2))));
      }
    }
  }
  return res;
}

function planeRuns(hand) {
  return consecutiveRuns(hand, 3, 2);
}

function genPlanes(hand) {
  const res = [];
  for (const run of planeRuns(hand)) {
    for (let a = 0; a < run.length; a += 1) {
      for (let b = a + 1; b < run.length; b += 1) {
        const seg = run.slice(a, b + 1);
        res.push(move(TYPES.PLANE, seg[seg.length - 1], seg.length, seg.flatMap((r) => cardsOfRank(hand, r, 3))));
      }
    }
  }
  return res;
}

// 取 hand 里「排除指定点数」后的最小 n 张（单张翼优先小牌，王最后才用）
function smallestCards(hand, excludeRanks, n) {
  const pool = hand.filter((c) => !excludeRanks.includes(c.r)).sort((a, b) => (a.r - b.r) || (a.s - b.s));
  return pool.slice(0, n);
}

function smallestPairs(hand, excludeRanks, k) {
  const rc = rankCounts(hand);
  const ranks = [...rc.keys()].filter((r) => rc.get(r) >= 2 && !excludeRanks.includes(r)).sort((a, b) => a - b);
  if (ranks.length < k) return null;
  return ranks.slice(0, k).flatMap((r) => cardsOfRank(hand, r, 2));
}

function genWinged(hand) {
  const res = [];
  const rc = rankCounts(hand);
  const ranks = [...rc.keys()].sort((a, b) => a - b);

  for (const r of ranks) {
    const c = rc.get(r);
    if (c >= 3) {
      const triple = cardsOfRank(hand, r, 3);
      const w1 = smallestCards(hand, [r], 1);
      if (w1.length) res.push(move(TYPES.THREE_SINGLE, r, 1, triple.concat(w1)));
      const wp = smallestPairs(hand, [r], 1);
      if (wp) res.push(move(TYPES.THREE_PAIR, r, 1, triple.concat(wp)));
    }
    if (c >= 4) {
      const quad = cardsOfRank(hand, r, 4);
      const w2 = smallestCards(hand, [r], 2);
      if (w2.length === 2) res.push(move(TYPES.FOUR_TWO_SINGLE, r, 1, quad.concat(w2)));
      const w2p = smallestPairs(hand, [r], 2);
      if (w2p) res.push(move(TYPES.FOUR_TWO_PAIR, r, 1, quad.concat(w2p)));
    }
  }

  for (const run of planeRuns(hand)) {
    for (let a = 0; a < run.length; a += 1) {
      for (let b = a + 1; b < run.length; b += 1) {
        const seg = run.slice(a, b + 1);
        const core = seg.flatMap((r) => cardsOfRank(hand, r, 3));
        const hi = seg[seg.length - 1];
        const w1 = smallestCards(hand, seg, seg.length);
        if (w1.length === seg.length) res.push(move(TYPES.PLANE_SINGLE, hi, seg.length, core.concat(w1)));
        const wp = smallestPairs(hand, seg, seg.length);
        if (wp) res.push(move(TYPES.PLANE_PAIR, hi, seg.length, core.concat(wp)));
      }
    }
  }
  return res;
}

export function genAllLeads(hand) {
  return [
    ...genSingles(hand),
    ...genPairThreesBombs(hand),
    ...genRocket(hand),
    ...genStraights(hand),
    ...genStraightPairs(hand),
    ...genPlanes(hand),
    ...genWinged(hand),
  ];
}

export function legalMoves(hand, lastMove) {
  const leads = genAllLeads(hand);
  if (!lastMove) return leads;
  return leads.filter((m) => canBeat(m, lastMove));
}

function byPower(a, b) {
  // 炸弹/王炸：王炸最大，否则先比张数（单副牌都是4张）再比 rank
  if (a.type === TYPES.ROCKET) return 1;
  if (b.type === TYPES.ROCKET) return -1;
  return a.rank - b.rank;
}

// ---------------------------------------------------------------- 出牌策略

// 贪婪地主：优先一手清空；接牌用最小压过；领牌出最长组合（清牌最多），否则最小单张。
export function pickGreedyMove(hand, lastMove) {
  const moves = legalMoves(hand, lastMove);
  if (!moves.length) return null;
  const win = moves.find((m) => m.cards.length === hand.length);
  if (win) return win;
  if (lastMove) {
    const nonBomb = moves.filter((m) => m.type !== TYPES.BOMB && m.type !== TYPES.ROCKET);
    if (nonBomb.length) {
      nonBomb.sort((a, b) => (a.rank - b.rank) || (a.cards.length - b.cards.length));
      return nonBomb[0];
    }
    return moves.sort(byPower)[0];
  }
  const combos = moves.filter((m) => m.type !== TYPES.SINGLE && m.type !== TYPES.BOMB && m.type !== TYPES.ROCKET);
  if (combos.length) {
    combos.sort((a, b) => (b.cards.length - a.cards.length) || (b.rank - a.rank));
    return combos[0];
  }
  const singles = moves.filter((m) => m.type === TYPES.SINGLE).sort((a, b) => a.rank - b.rank);
  if (singles.length) return singles[0];
  return moves[0];
}

// 农民 AI：可被击败但不脑残。接地主牌用最小同型；队友牌只在自己能赢时才压；炸弹仅在地主濒临出完或接炸时用。
export function pickFarmerMove(hand, lastMove, lastPlayer, myIndex, partnerIndex, landlordCount) {
  if (!lastMove) {
    const singles = genSingles(hand);
    if (singles.length) return singles.sort((a, b) => a.rank - b.rank)[0];
    return null;
  }
  const moves = legalMoves(hand, lastMove);
  if (!moves.length) return null;
  if (lastPlayer === partnerIndex) {
    const win = moves.find((m) => m.cards.length === hand.length);
    return win || null;
  }
  const nonBomb = moves.filter((m) => m.type !== TYPES.BOMB && m.type !== TYPES.ROCKET);
  if (nonBomb.length) {
    nonBomb.sort((a, b) => (a.rank - b.rank) || (a.cards.length - b.cards.length));
    return nonBomb[0];
  }
  if (landlordCount <= 2 || lastMove.type === TYPES.BOMB || lastMove.type === TYPES.ROCKET) {
    return moves.filter((m) => m.type === TYPES.BOMB || m.type === TYPES.ROCKET).sort(byPower)[0] || null;
  }
  return null;
}

// ---------------------------------------------------------------- 对局

export function createRun(roundIndex = 1, opts = {}) {
  const aiThinkMs = opts.aiThinkMs != null ? opts.aiThinkMs : 700;
  const seed = opts.seed != null ? opts.seed : 1;
  const rng = mulberry32(seed);
  const deck = shuffle(makeDeck(), rng);

  const players = [
    { name: 'you', role: 'landlord', isHuman: true, hand: sortCards(deck.slice(0, 17)), plays: 0, passed: false },
    { name: 'farmer1', role: 'farmer', isHuman: false, hand: sortCards(deck.slice(17, 34)), plays: 0, passed: false },
    { name: 'farmer2', role: 'farmer', isHuman: false, hand: sortCards(deck.slice(34, 51)), plays: 0, passed: false },
  ];
  const bottomCards = sortCards(deck.slice(51, 54));
  players[0].hand = sortCards(players[0].hand.concat(bottomCards));

  const state = {
    round: roundIndex,
    phase: 'playing',           // playing | ended
    players,
    turn: 0,
    lastPlayer: -1,
    lastMove: null,             // move object（牌桌上的牌）
    passCount: 0,
    landlord: 0,
    bottomCards,
    selected: new Set(),
    winner: null,               // 'you' | 'farmers'
    score: 0,
    multiplier: 1,
    bombsPlayed: 0,
    spring: false,
    reverseSpring: false,
    roundOver: false,
    history: [],
    aiThinkMs,
    aiTimer: 0,
    events: [],
  };

  function emit(type, payload = {}) {
    state.events.push({ type, ...payload });
  }

  function setTurn(next) {
    state.turn = next;
    if (next !== 0 && state.phase === 'playing' && !state.roundOver) state.aiTimer = aiThinkMs;
    else state.aiTimer = 0;
  }

  function endRound(winnerIdx) {
    const youWin = winnerIdx === 0;
    state.winner = youWin ? 'you' : 'farmers';
    state.roundOver = true;
    state.phase = 'ended';
    const farmerPlays = players[1].plays + players[2].plays;
    state.spring = youWin && farmerPlays === 0;
    state.reverseSpring = !youWin && players[0].plays <= 1;
    const springMult = state.spring || state.reverseSpring ? 2 : 1;
    const score = 1 * state.multiplier * springMult * 2;
    state.score = score;
    state.history.push({ winner: state.winner, score, multiplier: state.multiplier, spring: state.spring, reverseSpring: state.reverseSpring });
    emit(youWin ? 'win' : 'lose', {
      player: winnerIdx,
      score,
      multiplier: state.multiplier,
      spring: state.spring,
      reverseSpring: state.reverseSpring,
    });
    emit('end', { winner: state.winner });
  }

  function playMove(idx, m) {
    const p = state.players[idx];
    const ids = new Set(m.cards.map((c) => c.id));
    p.hand = p.hand.filter((c) => !ids.has(c.id));
    p.plays += 1;
    p.passed = false;
    state.lastMove = m;
    state.lastPlayer = idx;
    state.passCount = 0;
    state.history.push({ player: idx, move: m });
    if (m.type === TYPES.BOMB || m.type === TYPES.ROCKET) {
      state.multiplier *= 2;
      state.bombsPlayed += 1;
      emit('bomb', { player: idx, type: TYPE_NAMES[m.type], multiplier: state.multiplier });
    }
    emit('play', { player: idx, type: TYPE_NAMES[m.type], rank: m.rank, len: m.len, count: m.cards.length, handCount: p.hand.length });
    if (p.hand.length === 0) {
      endRound(idx);
      return;
    }
    setTurn((idx + 1) % 3);
  }

  function passBy(idx) {
    state.players[idx].passed = true;
    state.passCount += 1;
    emit('pass', { player: idx });
    if (state.passCount >= 2) {
      const leader = state.lastPlayer;
      state.lastMove = null;
      state.lastPlayer = -1;
      state.passCount = 0;
      setTurn(leader);
    } else {
      setTurn((idx + 1) % 3);
    }
  }

  function doAiTurn() {
    if (state.turn === 0 || state.phase !== 'playing' || state.roundOver) return;
    const idx = state.turn;
    const partner = idx === 1 ? 2 : 1;
    const m = pickFarmerMove(
      state.players[idx].hand,
      state.lastMove,
      state.lastPlayer,
      idx,
      partner,
      state.players[0].hand.length,
    );
    if (m) playMove(idx, m);
    else passBy(idx);
  }

  const run = {
    state,
    step(dt) {
      if (state.phase !== 'playing' || state.roundOver) return;
      if (state.turn === 0) return; // 人类回合，由输入驱动
      state.aiTimer -= dt * 1000;
      if (state.aiTimer <= 0) doAiTurn();
    },
    drainEvents() {
      const e = state.events;
      state.events = [];
      return e;
    },
    // 人类输入
    selectCard(id) {
      if (state.turn !== 0 || state.phase !== 'playing' || state.roundOver) return { ok: false };
      const card = state.players[0].hand.find((c) => c.id === id);
      if (!card) return { ok: false };
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      return { ok: true };
    },
    deselectAll() {
      state.selected.clear();
    },
    selectedCards() {
      const ids = state.selected;
      return state.players[0].hand.filter((c) => ids.has(c.id));
    },
    playSelected() {
      if (state.turn !== 0 || state.phase !== 'playing' || state.roundOver) return { ok: false, reason: 'not-turn' };
      const cards = this.selectedCards();
      if (!cards.length) return { ok: false, reason: 'empty' };
      const m = classify(sortCards(cards));
      if (!m) return { ok: false, reason: 'invalid' };
      if (state.lastMove && !canBeat(m, state.lastMove)) return { ok: false, reason: 'cannot-beat' };
      state.selected.clear();
      playMove(0, m);
      return { ok: true };
    },
    pass() {
      if (state.turn !== 0 || state.phase !== 'playing' || state.roundOver) return { ok: false, reason: 'not-turn' };
      if (!state.lastMove) return { ok: false, reason: 'must-lead' };
      state.selected.clear();
      passBy(0);
      return { ok: true };
    },
    hint() {
      if (state.turn !== 0 || state.phase !== 'playing' || state.roundOver) return { ok: false };
      const m = pickGreedyMove(state.players[0].hand, state.lastMove);
      if (!m) return { ok: true, pass: true, move: null };
      state.selected.clear();
      for (const c of m.cards) state.selected.add(c.id);
      return { ok: true, pass: false, move: m };
    },
    // 自对弈：让贪婪策略替人类出牌（供 selfplay / 验收快进）
    autoPlay() {
      if (state.turn !== 0 || state.phase !== 'playing' || state.roundOver) return { ok: false };
      const m = pickGreedyMove(state.players[0].hand, state.lastMove);
      if (m) {
        state.selected.clear();
        playMove(0, m);
        return { ok: true, move: m };
      }
      if (state.lastMove) {
        passBy(0);
        return { ok: true, pass: true };
      }
      return { ok: false };
    },
    getHud() {
      return {
        round: state.round,
        multiplier: state.multiplier,
        bombs: state.bombsPlayed,
        turn: state.turn,
        phase: state.phase,
        winner: state.winner,
        myCount: state.players[0].hand.length,
        farmer1Count: state.players[1].hand.length,
        farmer2Count: state.players[2].hand.length,
      };
    },
    debug() {
      return {
        round: state.round,
        phase: state.phase,
        turn: state.turn,
        winner: state.winner,
        multiplier: state.multiplier,
        score: state.score,
        bombsPlayed: state.bombsPlayed,
        spring: state.spring,
        reverseSpring: state.reverseSpring,
        myHand: state.players[0].hand.map((c) => ({ r: c.r, s: c.s, id: c.id })),
        selected: [...state.selected],
        lastMove: state.lastMove ? { type: TYPE_NAMES[state.lastMove.type], rank: state.lastMove.rank, len: state.lastMove.len, count: state.lastMove.cards.length } : null,
        farmer1Count: state.players[1].hand.length,
        farmer2Count: state.players[2].hand.length,
      };
    },
  };

  emit('deal', { round: roundIndex, landlord: 0 });
  emit('roundStart', { round: roundIndex, myCount: 20, farmer1Count: 17, farmer2Count: 17 });
  return run;
}
