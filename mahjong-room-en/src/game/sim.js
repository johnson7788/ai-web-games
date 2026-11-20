// MAHJONG ROOM · 纯逻辑 sim（无 DOM，Node 可测）
// P0 骨架 1:1（参考「推倒胡」服务端 Logic.js）：摸牌 → 出牌 → 碰/杠/胡 → 结算，4 人，136 张。
// 新机制：能量（碰/杠 +1）→ 幸运换牌；连胜加成；星级结算。
// 事件流：round / deal / draw / discard / peng / gang / hu / roundwin / roundlose / rounddraw / energy / lucky / streak / win / lose。
import { GAME } from '../../config/game.config.js';

export const PLAYERS = GAME.PLAYERS;
export const ROUNDS = GAME.ROUNDS;
export const TILE_TYPES = GAME.TILE_TYPES;
export const COPIES = GAME.COPIES;

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

// 花色：0=万 1=条 2=筒 3=风（东南西北中发白）
export function tSuit(t) { return t < 9 ? 0 : t < 18 ? 1 : t < 27 ? 2 : 3; }
// 点数：万条筒 1-9；风牌 1=东 2=南 3=西 4=北 5=中 6=发 7=白
export function tRank(t) { return t < 27 ? (t % 9) + 1 : (t - 27) + 1; }

export function toCounts(tiles) {
  const c = new Array(TILE_TYPES).fill(0);
  for (const t of tiles) c[t] += 1;
  return c;
}

function allZero(counts) {
  for (let i = 0; i < TILE_TYPES; i += 1) if (counts[i] > 0) return false;
  return true;
}

// 把 counts 拆成 melds 个面子（刻子/顺子）+（可选）1 对将。标准贪心分解正确。
function canDecompose(counts, melds) {
  if (melds === 0) return allZero(counts);
  let i = 0;
  while (i < TILE_TYPES && counts[i] === 0) i += 1;
  if (i >= TILE_TYPES) return false;
  if (counts[i] >= 3) {
    counts[i] -= 3;
    if (canDecompose(counts, melds - 1)) { counts[i] += 3; return true; }
    counts[i] += 3;
  }
  if (tSuit(i) < 3 && tRank(i) <= 7 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i] -= 1; counts[i + 1] -= 1; counts[i + 2] -= 1;
    if (canDecompose(counts, melds - 1)) { counts[i] += 1; counts[i + 1] += 1; counts[i + 2] += 1; return true; }
    counts[i] += 1; counts[i + 1] += 1; counts[i + 2] += 1;
  }
  return false;
}

// 手牌（暗牌）+ 已声明面子，是否胡牌。
export function isWinning(handTiles, melds) {
  const meldsNeeded = 4 - melds.length;
  if (meldsNeeded < 0) return false;
  if (handTiles.length !== meldsNeeded * 3 + 2) return false;
  const counts = toCounts(handTiles);
  for (let i = 0; i < TILE_TYPES; i += 1) {
    if (counts[i] >= 2) {
      counts[i] -= 2;
      if (canDecompose(counts, meldsNeeded)) { counts[i] += 2; return true; }
      counts[i] += 2;
    }
  }
  return false;
}

// 单张牌的保留价值（越低越该打）。用于出牌启发式。
export function tileUtility(t, counts) {
  if (counts[t] >= 3) return 12;
  if (counts[t] === 2) return 7;
  const suit = tSuit(t);
  const r = tRank(t);
  if (suit === 3) return 2; // 单张字牌
  let s = 3;
  if (r > 1 && counts[t - 1] > 0) s += 3;
  if (r < 9 && counts[t + 1] > 0) s += 3;
  if (r > 2 && counts[t - 2] > 0) s += 1;
  if (r < 8 && counts[t + 2] > 0) s += 1;
  if (r === 1 || r === 9) s -= 1; // 边张略降
  return s;
}

// 打出保留价值最低的那张；平手取更大的牌（确定性）。
export function bestDiscard(hand) {
  const counts = toCounts(hand);
  let best = null;
  let bestU = Infinity;
  const seen = new Set();
  for (const t of hand) {
    if (seen.has(t)) continue;
    seen.add(t);
    const u = tileUtility(t, counts);
    if (u < bestU || (u === bestU && (best === null || t > best))) { bestU = u; best = t; }
  }
  return best;
}

function isFlush(handTiles, melds) {
  let suit = null;
  const check = (t) => {
    const s = tSuit(t);
    if (suit === null) suit = s;
    else if (suit !== s) return false;
    return true;
  };
  for (const t of handTiles) if (!check(t)) return false;
  for (const m of melds) {
    for (let i = 0; i < (m.kind === 'gang' ? 4 : 3); i += 1) if (!check(m.t)) return false;
  }
  return true;
}

export function createRun(opts = {}) {
  const seed = opts.seed | 0 || 1;
  const SELF_TO = opts.selfTimeout != null ? opts.selfTimeout : GAME.SELF_TIMEOUT;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing', // playing | won | lost
    round: 1,
    stage: 'discard', // discard | react
    turnPos: 0,
    decider: null,    // 当前待决策座位（0=玩家，1..3=AI）
    options: [],      // 玩家（decider=0）当前可选动作
    reactList: [],
    reactIdx: 0,
    reactTile: null,
    lastDiscarder: null,
    hands: [[], [], [], []],
    melds: [[], [], [], []],
    discards: [[], [], [], []],
    wall: [],
    wallIndex: 0,
    lastDiscard: null,
    scores: [0, 0, 0, 0],
    roundScores: [0, 0, 0, 0],
    energy: 0,
    streak: 0,
    dealer: 0,
    timer: 0,
    selfRoundWins: 0,
    time: 0,
    seed,
  };

  const events = [];

  function emit(type, data) { events.push({ type, ...(data || {}) }); }

  const nextPos = (p) => (p + 1) % PLAYERS;
  const turnOrderAfter = (p) => [nextPos(p), (p + 2) % PLAYERS, (p + 3) % PLAYERS];
  const asc = (a, b) => a - b;

  function buildWall() {
    const wall = [];
    for (let t = 0; t < TILE_TYPES; t += 1) for (let i = 0; i < COPIES; i += 1) wall.push(t);
    for (let i = wall.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = wall[i]; wall[i] = wall[j]; wall[j] = tmp;
    }
    return wall;
  }

  function removeTile(pos, t) {
    const idx = state.hands[pos].indexOf(t);
    if (idx >= 0) state.hands[pos].splice(idx, 1);
  }

  function drawOne(pos) {
    if (state.wallIndex >= state.wall.length) return null;
    const t = state.wall[state.wallIndex];
    state.wallIndex += 1;
    state.hands[pos].push(t);
    state.hands[pos].sort(asc);
    return t;
  }

  function discardOptions(pos) {
    const opts = [];
    const seen = new Set();
    for (const t of state.hands[pos]) {
      if (seen.has(t)) continue;
      seen.add(t);
      opts.push({ kind: 'discard', t });
    }
    return opts;
  }

  function selfdrawOptions(pos) {
    const opts = [];
    if (isWinning(state.hands[pos], state.melds[pos])) opts.push({ kind: 'hu', t: null });
    const counts = toCounts(state.hands[pos]);
    for (let t = 0; t < TILE_TYPES; t += 1) {
      if (counts[t] >= 4) opts.push({ kind: 'angang', t });
    }
    return opts;
  }

  function reactOptions(acts) {
    const opts = [];
    if (acts.peng) opts.push({ kind: 'peng', t: state.reactTile });
    if (acts.minggang) opts.push({ kind: 'minggang', t: state.reactTile });
    if (acts.hu) opts.push({ kind: 'hu', t: state.reactTile });
    opts.push({ kind: 'pass', t: null });
    return opts;
  }

  function reactActions(pos, t) {
    const counts = toCounts(state.hands[pos]);
    const acts = {};
    if (counts[t] >= 2) acts.peng = true;
    if (counts[t] >= 3) acts.minggang = true;
    if (isWinning([...state.hands[pos], t], state.melds[pos])) acts.hu = true;
    return acts;
  }

  function setDecider(pos, stage, options) {
    state.decider = pos;
    state.stage = stage;
    state.timer = 0;
    state.options = pos === 0 ? (options || []) : [];
  }

  function addEnergy() {
    if (state.energy >= GAME.ENERGY_MAX) return;
    state.energy += 1;
    emit('energy', { energy: state.energy });
  }

  function doDiscard(pos, t) {
    removeTile(pos, t);
    state.discards[pos].push(t);
    state.lastDiscard = t;
    state.lastDiscarder = pos;
    emit('discard', { pos, t });
    afterDiscard(t, pos);
  }

  function afterDiscard(t, pos) {
    const order = turnOrderAfter(pos);
    const huR = [];
    const claimR = [];
    for (const p of order) {
      const acts = reactActions(p, t);
      if (acts.hu) huR.push({ pos: p, acts });
      else if (acts.peng || acts.minggang) claimR.push({ pos: p, acts });
    }
    if (!huR.length && !claimR.length) { drawFor(order[0]); return; }
    state.reactTile = t;
    state.reactList = [...huR, ...claimR];
    state.reactIdx = 0;
    advanceReact();
  }

  function advanceReact() {
    while (state.reactIdx < state.reactList.length) {
      const r = state.reactList[state.reactIdx];
      if (r.pos === 0) {
        setDecider(0, 'react', reactOptions(r.acts));
        return;
      }
      const decision = aiReact(r);
      if (decision.kind === 'hu') { resolveHu(r.pos, 'dianpao', state.lastDiscarder); return; }
      if (decision.kind === 'peng' || decision.kind === 'minggang') { resolveClaim(r.pos, decision.kind, state.reactTile); return; }
      state.reactIdx += 1; // pass
    }
    drawFor(turnOrderAfter(state.lastDiscarder)[0]);
  }

  function drawFor(pos) {
    const t = drawOne(pos);
    if (t === null) { resolveRoundDraw(); return; }
    emit('draw', { pos, t });
    const opts = selfdrawOptions(pos);
    if (opts.length) {
      if (pos === 0) {
        setDecider(0, 'discard', opts.concat(discardOptions(0)));
      } else {
        // AI：能自摸就自摸，否则暗杠，否则正常出牌
        if (opts.some((o) => o.kind === 'hu')) resolveHu(pos, 'zimo', null);
        else if (opts.some((o) => o.kind === 'angang')) {
          const ag = opts.find((o) => o.kind === 'angang');
          doAnGang(pos, ag.t);
        } else setDecider(pos, 'discard', []);
      }
    } else {
      setDecider(pos, 'discard', pos === 0 ? discardOptions(0) : []);
    }
  }

  function doAnGang(pos, t) {
    for (let i = 0; i < 4; i += 1) removeTile(pos, t);
    state.melds[pos].push({ kind: 'gang', t, hidden: true });
    emit('gang', { pos, t, an: true });
    if (pos === 0) addEnergy();
    drawFor(pos); // 杠后补一张
  }

  function resolveClaim(pos, kind, t) {
    if (kind === 'peng') {
      removeTile(pos, t); removeTile(pos, t);
      state.melds[pos].push({ kind: 'peng', t });
      emit('peng', { pos, t });
      if (pos === 0) addEnergy();
      setDecider(pos, 'discard', pos === 0 ? discardOptions(0) : []);
    } else if (kind === 'minggang') {
      removeTile(pos, t); removeTile(pos, t); removeTile(pos, t);
      state.melds[pos].push({ kind: 'gang', t, hidden: false });
      emit('gang', { pos, t, an: false });
      if (pos === 0) addEnergy();
      drawFor(pos); // 明杠补一张
    }
  }

  function roundScoresFor(winner, kind, discarder, flushMult) {
    const s = [0, 0, 0, 0];
    if (kind === 'zimo') {
      const base = 3 * GAME.ZIMO_TIME * GAME.BASE_SCORE * flushMult;
      s[winner] += base;
      for (let p = 0; p < PLAYERS; p += 1) if (p !== winner) s[p] -= base / 3;
    } else {
      const base = GAME.BASE_SCORE * flushMult;
      s[winner] += base;
      if (discarder != null) s[discarder] -= base;
    }
    // 新机制：连胜加成（自己胡牌时按连续胜场放大）
    if (GAME.STREAK_ENABLED && winner === 0 && state.streak > 0) {
      const mult = state.streak + 1;
      for (let p = 0; p < PLAYERS; p += 1) s[p] *= mult;
      emit('streak', { mult });
    }
    return s;
  }

  function resolveHu(winner, kind, discarder) {
    const flushMult = (GAME.FLUSH_ENABLED && isFlush(state.hands[winner], state.melds[winner])) ? GAME.FLUSH_TIME : 1;
    const s = roundScoresFor(winner, kind, discarder, flushMult);
    state.roundScores = s;
    for (let p = 0; p < PLAYERS; p += 1) state.scores[p] += s[p];
    emit('hu', { winner, kind, discarder, flush: flushMult > 1 });
    endRound(winner);
  }

  function resolveRoundDraw() {
    state.roundScores = [0, 0, 0, 0];
    emit('rounddraw', {});
    endRound(null);
  }

  function endRound(winner) {
    if (winner === 0) {
      state.selfRoundWins += 1;
      state.streak += 1;
      emit('roundwin', { round: state.round });
    } else if (winner != null) {
      state.streak = 0;
      emit('roundlose', { round: state.round, winner });
    } else {
      emit('roundlose', { round: state.round, winner: null });
    }

    if (state.round >= GAME.ROUNDS) {
      const won = state.scores[0] > 0;
      state.phase = won ? 'won' : 'lost';
      const stars = won ? Math.max(1, state.selfRoundWins) : 0;
      emit(won ? 'win' : 'lose', { stars, scores: [...state.scores], roundsWon: state.selfRoundWins });
      state.decider = null;
      return;
    }
    state.round += 1;
    state.dealer = (state.dealer + 1) % PLAYERS;
    startRound();
  }

  function startRound() {
    state.hands = [[], [], [], []];
    state.melds = [[], [], [], []];
    state.discards = [[], [], [], []];
    state.wall = buildWall();
    state.wallIndex = 0;
    state.lastDiscard = null;
    state.lastDiscarder = null;
    state.reactList = [];
    state.reactIdx = 0;
    state.energy = 0;
    emit('round', { round: state.round, dealer: state.dealer });
    for (let p = 0; p < PLAYERS; p += 1) {
      for (let i = 0; i < 13; i += 1) drawOne(p);
    }
    emit('deal', { round: state.round });
    drawFor(state.dealer); // 庄家摸第 14 张
  }

  // ---------------- AI ----------------

  function worstK(hand, k) {
    const scored = [];
    const seen = new Set();
    const counts = toCounts(hand);
    for (const t of hand) {
      if (seen.has(t)) continue;
      seen.add(t);
      scored.push({ t, u: tileUtility(t, counts) });
    }
    scored.sort((a, b) => a.u - b.u || b.t - a.t);
    return scored.slice(0, Math.max(1, Math.min(k, scored.length)));
  }

  function aiDiscard(pos) {
    const hand = state.hands[pos];
    if (hand.length === 0) return null;
    const difficulty = state.round - 1; // 0/1/2
    if (difficulty <= 0) {
      // 第 1 局：AI 随机出牌（弱，玩家可稳定赢下教学局）
      return hand[Math.floor(rng() * hand.length)];
    }
    // 2/3 局：在最低价值的 k 张里随机打（比玩家的全局最优略弱）
    const k = difficulty === 1 ? 3 : 2;
    const cand = worstK(hand, k);
    return cand[Math.floor(rng() * cand.length)].t;
  }

  function aiReact(r) {
    if (r.acts.hu) return { kind: 'hu', t: state.reactTile };
    if (r.acts.peng) return { kind: 'peng', t: state.reactTile };
    if (r.acts.minggang) return { kind: 'minggang', t: state.reactTile };
    return { kind: 'pass', t: null };
  }

  function resolveAiDecision(pos) {
    if (state.stage === 'discard') {
      const t = aiDiscard(pos);
      if (t != null) doDiscard(pos, t);
    } else if (state.stage === 'react') {
      const r = state.reactList[state.reactIdx];
      if (!r) { drawFor(turnOrderAfter(state.lastDiscarder)[0]); return; }
      const decision = aiReact(r);
      if (decision.kind === 'hu') resolveHu(r.pos, 'dianpao', state.lastDiscarder);
      else if (decision.kind === 'peng' || decision.kind === 'minggang') resolveClaim(r.pos, decision.kind, state.reactTile);
      else { state.reactIdx += 1; advanceReact(); }
    }
  }

  function autoSelf() {
    if (state.stage === 'discard') {
      const hand = state.hands[0];
      if (hand.length) doDiscard(0, hand[Math.floor(rng() * hand.length)]);
    } else if (state.stage === 'react') {
      state.reactIdx += 1;
      advanceReact();
    }
  }

  // ---------------- run ----------------

  const run = {
    state,

    act(action) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.decider !== 0) return { ok: false, reason: 'not-turn' };
      const kind = action && action.kind;
      if (kind === 'discard') {
        if (state.stage !== 'discard') return { ok: false, reason: 'stage' };
        if (state.hands[0].indexOf(action.t) < 0) return { ok: false, reason: 'not-in-hand' };
        doDiscard(0, action.t);
        return { ok: true };
      }
      if (kind === 'hu') {
        if (state.stage === 'discard') { resolveHu(0, 'zimo', null); return { ok: true }; }
        if (state.stage === 'react') { resolveHu(0, 'dianpao', state.lastDiscarder); return { ok: true }; }
        return { ok: false, reason: 'stage' };
      }
      if (kind === 'angang') {
        if (state.stage !== 'discard') return { ok: false, reason: 'stage' };
        const counts = toCounts(state.hands[0]);
        if (counts[action.t] < 4) return { ok: false, reason: 'no-gang' };
        doAnGang(0, action.t);
        return { ok: true };
      }
      if (kind === 'peng' || kind === 'minggang') {
        if (state.stage !== 'react') return { ok: false, reason: 'stage' };
        resolveClaim(0, kind, state.reactTile);
        return { ok: true };
      }
      if (kind === 'pass') {
        if (state.stage !== 'react') return { ok: false, reason: 'stage' };
        state.reactIdx += 1;
        advanceReact();
        return { ok: true };
      }
      if (kind === 'lucky') return run.lucky();
      return { ok: false, reason: 'bad-action' };
    },

    lucky() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.decider !== 0 || state.stage !== 'discard') return { ok: false, reason: 'not-discard' };
      if (!GAME.LUCKY_ENABLED) return { ok: false, reason: 'disabled' };
      if (state.energy < GAME.ENERGY_MAX) return { ok: false, reason: 'energy' };
      const bad = bestDiscard(state.hands[0]);
      if (bad == null) return { ok: false, reason: 'empty' };
      removeTile(0, bad);
      const t = drawOne(0);
      if (t == null) { state.hands[0].push(bad); state.hands[0].sort(asc); return { ok: false, reason: 'no-wall' }; }
      state.energy = 0;
      emit('lucky', { out: bad, in: t });
      const opts = selfdrawOptions(0);
      setDecider(0, 'discard', opts.length ? opts.concat(discardOptions(0)) : discardOptions(0));
      return { ok: true, out: bad, in: t };
    },

    step(dt) {
      if (state.phase !== 'playing') return;
      state.time += dt;
      if (state.decider == null) return;
      state.timer += dt;
      if (state.decider === 0) {
        if (state.timer >= SELF_TO) autoSelf();
      } else if (state.timer >= GAME.AI_THINK) {
        resolveAiDecision(state.decider);
      }
    },

    drainEvents() {
      if (!events.length) return [];
      const out = events.slice();
      events.length = 0;
      return out;
    },

    getHud() {
      return {
        phase: state.phase,
        round: state.round,
        energy: state.energy,
        streak: state.streak,
        scores: [...state.scores],
        roundScores: [...state.roundScores],
        selfRoundWins: state.selfRoundWins,
        wallLeft: state.wall.length - state.wallIndex,
        decider: state.decider,
        stage: state.stage,
        options: state.options,
        hand: [...state.hands[0]],
        melds: state.melds[0].map((m) => ({ ...m })),
      };
    },
  };

  startRound();
  return run;
}
