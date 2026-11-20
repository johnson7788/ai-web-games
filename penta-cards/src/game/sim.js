// src/game/sim.js — 卡五星牌局状态机 + AI（纯逻辑，不碰 DOM，随机用 seed）。
// 单机 vs 2 名 AI；3 人、84 张（星 1-9×4、轨 1-9×4、三元×4）。
// 规则还原源码（见 docs/analysis.md）：摸→打→碰/杠/胡；番型结算 2^fan×底注。
// 原创区别点（spec）：观星（每局 2 次看牌堆顶 3 张）、换星（每局 1 次弃 1 换 1 且对手可见）。
import { TOTAL_TILES, SEATS, ROUNDS, RANK, ABILITY, TIME_PER_STEP } from '../../config/rules.js';
import { mulberry32 } from './rng.js';
import { countOf, shanten, canWinStandard, winPattern, computeFan, fanScore, tingList } from './hand.js';

const SUIT_BEGIN = [0, 9, 27, 30]; // 星 0-8 / 轨 9-17 / 三元 27-29

function buildWall(rng) {
  const wall = [];
  for (let s = 0; s < 3; s += 1) {
    const begin = SUIT_BEGIN[s];
    const end = s < 2 ? begin + 9 : begin + 3;
    for (let id = begin; id < end; id += 1) for (let c = 0; c < 4; c += 1) wall.push(id);
  }
  // Fisher–Yates
  for (let i = wall.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

function sortHolds(arr) {
  return arr.sort((a, b) => a - b);
}

export function createRun({ seed = 12345, aiSkill = null } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    seed: seed >>> 0,
    rng,
    time: 0,
    phase: 'playing',          // playing | sessionEnd
    round: 1,
    conf: ROUNDS[0],
    aiSkill: aiSkill,          // null = 用 conf.aiSkill
    state: 'idle',             // turnStart | discard | claim | roundEnd
    pending: null,
    wall: [],
    wallIndex: 0,
    button: 0,
    turn: 0,
    chuPai: -1,
    drawnTile: -1,
    gangBonus: false,          // 当前待决是否处于杠后补牌（杠上开花）
    claimers: [],
    claimIdx: 0,
    stargazeLeft: ABILITY.stargaze,
    swapLeft: ABILITY.swap,
    peeks: [],
    events: [],
    stats: { totalScore: RANK.startChips, roundsWon: 0, roundsLost: 0, roundsDrawn: 0, maxFan: 0, bestRank: 1 },
    seats: [],
  };

  for (let i = 0; i < SEATS; i += 1) {
    run.seats.push({
      index: i,
      isPlayer: i === 0,
      name: i === 0 ? 'you' : `ai-${i}`,
      holds: [],
      pengs: [],
      gangs: [],
      folds: [],
      score: 0,
      hued: false,
    });
  }

  startRound(run);
  return run;
}

function emit(run, type, payload = {}) {
  run.events.push({ type, time: run.time, ...payload });
}

function wallRemaining(run) {
  return run.wall.length - run.wallIndex;
}

function drawOne(run) {
  if (run.wallIndex >= run.wall.length) return -1;
  const t = run.wall[run.wallIndex];
  run.wallIndex += 1;
  return t;
}

function seatCount(seat) {
  return countOf(seat.holds);
}

function meldCount(seat) {
  return seat.pengs.length + seat.gangs.length;
}

function meldTiles(seat) {
  return [...seat.pengs, ...seat.gangs];
}

// ---------------------------------------------------------------------------
// 一局开始
// ---------------------------------------------------------------------------

function startRound(run) {
  run.conf = ROUNDS[run.round - 1] || ROUNDS[ROUNDS.length - 1];
  run.wall = buildWall(run.rng);
  run.wallIndex = 0;
  run.chuPai = -1;
  run.gangBonus = false;
  run.claimers = [];
  run.stargazeLeft = ABILITY.stargaze;
  run.swapLeft = ABILITY.swap;
  run.peeks = [];

  for (const s of run.seats) {
    s.holds = [];
    s.pengs = [];
    s.gangs = [];
    s.folds = [];
    s.score = 0;
    s.hued = false;
  }

  // 庄家轮替：首局 0，之后上局赢家当庄（荒庄连庄）
  for (let i = 0; i < SEATS * 13; i += 1) {
    const seat = run.seats[i % SEATS];
    seat.holds.push(drawOne(run));
  }
  // 庄家多摸一张
  const dealer = run.seats[run.button];
  dealer.holds.push(drawOne(run));
  for (const s of run.seats) sortHolds(s.holds);

  run.turn = run.button;
  emit(run, 'roundStart', { round: run.round, scene: run.conf.scene, baseBet: run.conf.baseBet, button: run.button });
  emit(run, 'deal', {});

  // 庄家开局已多摸一张（14 张），跳过摸牌直接进入弃牌（也跳过观星/换星的「摸牌前」窗口）
  beginTurn(run, run.button, true);
}

// ---------------------------------------------------------------------------
// 回合推进
// ---------------------------------------------------------------------------

function beginTurn(run, seatIdx, alreadyDrew = false) {
  run.turn = seatIdx;
  run.drawnTile = -1;
  run.gangBonus = false;
  const seat = run.seats[seatIdx];

  if (alreadyDrew) {
    run.state = 'discard';
    setDiscardPending(run, seatIdx);
    return;
  }

  if (seat.isPlayer) {
    run.state = 'turnStart';
    run.pending = {
      kind: 'turnStart',
      seat: seatIdx,
      options: {
        stargaze: run.stargazeLeft > 0 && wallRemaining(run) >= ABILITY.stargazePeek,
        swap: run.swapLeft > 0 && wallRemaining(run) > 0 && seat.holds.length > 0,
      },
    };
  } else {
    doDraw(run, seatIdx);
  }
}

function doDraw(run, seatIdx, fromGang = false) {
  const seat = run.seats[seatIdx];
  const t = drawOne(run);
  if (t < 0) {
    settleRound(run, -1, -1, { isZimo: false, discarder: -1 });
    return;
  }
  seat.holds.push(t);
  sortHolds(seat.holds);
  run.drawnTile = t;
  run.gangBonus = fromGang;
  emit(run, 'draw', { seat: seatIdx, tile: t, player: seatIdx === 0 });

  run.state = 'discard';
  setDiscardPending(run, seatIdx);
}

function setDiscardPending(run, seatIdx) {
  const seat = run.seats[seatIdx];
  const count = seatCount(seat);
  const canHu = canWinStandard(count, meldCount(seat));
  const gangPai = gangOptions(run, seat, count);
  run.pending = {
    kind: 'discard',
    seat: seatIdx,
    options: { canHu, canGang: gangPai.length > 0, gangPai, tiles: seat.holds.slice() },
  };
}

function gangOptions(run, seat, count) {
  const out = [];
  // 暗杠：手牌 4 张
  for (let i = 0; i <= 29; i += 1) if (count[i] === 4) out.push(i);
  // 弯杠：碰过的牌 + 手牌 1 张
  for (const p of seat.pengs) if (count[p] === 1) out.push(p);
  return out;
}

// ---------------------------------------------------------------------------
// 弃牌后的吃碰杠胡判定
// ---------------------------------------------------------------------------

function afterDiscard(run, seatIdx, tile) {
  run.chuPai = tile;
  emit(run, 'discard', { seat: seatIdx, tile, player: seatIdx === 0 });

  // 收集可碰/杠/胡的对手（按出牌者下家顺序）
  run.claimers = [];
  for (let k = 1; k < SEATS; k += 1) {
    const idx = (seatIdx + k) % SEATS;
    const s = run.seats[idx];
    if (s.hued) continue;
    const count = seatCount(s);
    const opts = claimOptions(run, s, count, tile);
    if (opts.hu || opts.peng || opts.gang) {
      run.claimers.push({ seat: idx, ...opts });
    }
  }

  if (run.claimers.length === 0) {
    nextTurn(run, (seatIdx + 1) % SEATS);
    return;
  }
  run.claimIdx = 0;
  run.state = 'claim';
  setClaimPending(run);
}

function claimOptions(run, seat, count, tile) {
  const canHu = canWinStandard(addTile(count, tile), meldCount(seat));
  const canPeng = !seat.hued && count[tile] >= 2;
  let canGang = false;
  const gangPai = [];
  if (wallRemaining(run) > 0 && count[tile] >= 3) {
    canGang = true;
    gangPai.push(tile); // 点杠
  }
  return { hu: canHu, peng: canPeng, gang: canGang, gangPai };
}

function addTile(count, tile) {
  const c = Int8Array.from(count);
  c[tile] += 1;
  return c;
}

function setClaimPending(run) {
  const c = run.claimers[run.claimIdx];
  run.pending = {
    kind: 'claim',
    seat: c.seat,
    options: { hu: c.hu, peng: c.peng, gang: c.gang, gangPai: c.gangPai },
  };
}

function nextTurn(run, seatIdx) {
  // 若牌墙已空且无人胡，荒庄
  if (wallRemaining(run) <= 0) {
    settleRound(run, -1, -1, { isZimo: false, discarder: -1 });
    return;
  }
  beginTurn(run, seatIdx);
}

// ---------------------------------------------------------------------------
// 决策执行
// ---------------------------------------------------------------------------

export function step(run, input = null) {
  if (run.phase === 'sessionEnd') return;
  run.time += TIME_PER_STEP;

  if (run.state === 'roundEnd') {
    finishRound(run);
    return;
  }

  const p = run.pending;
  if (!p) return;

  if (p.seat === 0) {
    applyDecision(run, 0, p, normalizeInput(run, p, input));
  } else {
    const action = aiDecide(run, p.seat, p);
    applyDecision(run, p.seat, p, action);
  }
}

function normalizeInput(run, p, input) {
  if (!input || typeof input !== 'object') input = {};
  // 空输入 → 默认动作（noinput 兜底自动推进：跳过能力、弃刚摸的牌、让过）
  if (!input.action) {
    if (p.kind === 'turnStart') return { action: 'draw' };
    if (p.kind === 'discard') return { action: 'discard', tile: run.drawnTile >= 0 ? run.drawnTile : run.seats[0].holds[run.seats[0].holds.length - 1] };
    if (p.kind === 'claim') return { action: 'pass' };
    return { action: 'pass' };
  }
  return input;
}

function applyDecision(run, seatIdx, p, action) {
  const seat = run.seats[seatIdx];

  if (p.kind === 'turnStart') {
    if (action.action === 'stargaze' && p.options.stargaze) {
      doStargaze(run);
      return;
    }
    if (action.action === 'swap' && p.options.swap) {
      doSwap(run, action.tile);
      return;
    }
    // draw（或非法动作回退）
    run.state = 'draw';
    run.pending = null;
    doDraw(run, seatIdx);
    return;
  }

  if (p.kind === 'discard') {
    if (action.action === 'hu' && p.options.canHu) {
      settleRound(run, seatIdx, run.drawnTile, { isZimo: true, discarder: -1 });
      return;
    }
    if (action.action === 'gang' && p.options.gangPai && p.options.gangPai.includes(action.tile)) {
      doGang(run, seatIdx, action.tile, seatCount(seat));
      return;
    }
    // discard
    const tile = action.tile;
    if (seat.holds.indexOf(tile) < 0) {
      // 非法弃牌 → 弃刚摸的牌
      const fallback = run.drawnTile >= 0 ? run.drawnTile : seat.holds[seat.holds.length - 1];
      doDiscard(run, seatIdx, fallback);
      return;
    }
    doDiscard(run, seatIdx, tile);
    return;
  }

  if (p.kind === 'claim') {
    if (action.action === 'hu' && p.options.hu) {
      settleRound(run, seatIdx, run.chuPai, { isZimo: false, discarder: run.turn });
      return;
    }
    if (action.action === 'peng' && p.options.peng) {
      doPeng(run, seatIdx);
      return;
    }
    if (action.action === 'gang' && p.options.gang && p.options.gangPai.includes(action.tile)) {
      doDianGang(run, seatIdx, action.tile);
      return;
    }
    // pass → 下一个 claimer
    run.claimIdx += 1;
    if (run.claimIdx >= run.claimers.length) {
      run.claimers = [];
      run.chuPai = -1;
      nextTurn(run, (run.turn + 1) % SEATS);
      return;
    }
    setClaimPending(run);
    return;
  }
}

function doStargaze(run) {
  run.stargazeLeft -= 1;
  const peek = [];
  for (let i = 0; i < ABILITY.stargazePeek && run.wallIndex + i < run.wall.length; i += 1) {
    peek.push(run.wall[run.wallIndex + i]);
  }
  run.peeks = peek;
  emit(run, 'stargaze', { tiles: peek.slice(), left: run.stargazeLeft });
  // 仍在 turnStart，可继续换星或摸牌
  const seat = run.seats[0];
  run.pending = {
    kind: 'turnStart',
    seat: 0,
    options: {
      stargaze: run.stargazeLeft > 0 && wallRemaining(run) >= ABILITY.stargazePeek,
      swap: run.swapLeft > 0 && wallRemaining(run) > 0 && seat.holds.length > 0,
    },
  };
}

function doSwap(run, tile) {
  const seat = run.seats[0];
  const idx = seat.holds.indexOf(tile);
  if (idx < 0) return; // 非法换星，忽略
  seat.holds.splice(idx, 1);
  seat.folds.push(tile);
  run.swapLeft -= 1;
  emit(run, 'swap', { tile, left: run.swapLeft });
  // 换星后直接进入摸牌（弃 1 换 1 视为本次摸牌前的盲弃），再正常摸打
  run.state = 'draw';
  run.pending = null;
  doDraw(run, 0);
}

function doDiscard(run, seatIdx, tile) {
  const seat = run.seats[seatIdx];
  const idx = seat.holds.indexOf(tile);
  if (idx < 0) return;
  seat.holds.splice(idx, 1);
  seat.folds.push(tile);
  run.drawnTile = -1;
  afterDiscard(run, seatIdx, tile);
}

function doPeng(run, seatIdx) {
  const seat = run.seats[seatIdx];
  const tile = run.chuPai;
  // 移除手牌 2 张
  for (let i = 0; i < 2; i += 1) {
    const idx = seat.holds.indexOf(tile);
    if (idx < 0) return;
    seat.holds.splice(idx, 1);
  }
  seat.pengs.push(tile);
  run.chuPai = -1;
  run.claimers = [];
  emit(run, 'peng', { seat: seatIdx, tile, player: seatIdx === 0 });
  run.turn = seatIdx;
  run.gangBonus = false;
  run.state = 'discard';
  setDiscardPending(run, seatIdx);
}

function doGang(run, seatIdx, tile, count) {
  // 暗杠（4 张）或弯杠（碰+1）
  const seat = run.seats[seatIdx];
  const isAnGang = count[tile] >= 4;
  const isWanGang = !isAnGang && seat.pengs.includes(tile) && count[tile] === 1;

  if (isAnGang) {
    for (let i = 0; i < 4; i += 1) {
      const idx = seat.holds.indexOf(tile);
      if (idx < 0) return;
      seat.holds.splice(idx, 1);
    }
    seat.gangs.push(tile);
    applyGangScore(run, seatIdx, 'angang');
  } else if (isWanGang) {
    const pidx = seat.pengs.indexOf(tile);
    seat.pengs.splice(pidx, 1);
    const hidx = seat.holds.indexOf(tile);
    if (hidx < 0) return;
    seat.holds.splice(hidx, 1);
    seat.gangs.push(tile);
    applyGangScore(run, seatIdx, 'wangang');
  } else {
    return;
  }
  emit(run, 'gang', { seat: seatIdx, tile, player: seatIdx === 0 });
  doDraw(run, seatIdx, true); // 杠后补牌
}

function doDianGang(run, seatIdx, tile) {
  const seat = run.seats[seatIdx];
  for (let i = 0; i < 3; i += 1) {
    const idx = seat.holds.indexOf(tile);
    if (idx < 0) return;
    seat.holds.splice(idx, 1);
  }
  seat.gangs.push(tile);
  applyGangScore(run, seatIdx, 'diangang', run.turn);
  run.chuPai = -1;
  run.claimers = [];
  emit(run, 'gang', { seat: seatIdx, tile, player: seatIdx === 0 });
  run.turn = seatIdx;
  doDraw(run, seatIdx, true); // 杠后补牌
}

function applyGangScore(run, seatIdx, type, fromSeat = -1) {
  const base = run.conf.baseBet;
  const seat = run.seats[seatIdx];
  let gained = 0;
  if (type === 'angang') {
    gained = base * 2 * (SEATS - 1);
    for (const s of run.seats) if (s.index !== seatIdx) s.score -= base * 2;
  } else if (type === 'wangang') {
    gained = base * (SEATS - 1);
    for (const s of run.seats) if (s.index !== seatIdx) s.score -= base;
  } else if (type === 'diangang') {
    gained = base * 2;
    run.seats[fromSeat].score -= base * 2;
  }
  seat.score += gained;
  emit(run, 'gangScore', { seat: seatIdx, type, gained });
}

// ---------------------------------------------------------------------------
// 结算
// ---------------------------------------------------------------------------

function settleRound(run, winner, winTile, { isZimo, discarder }) {
  if (winner >= 0) {
    const seat = run.seats[winner];
    seat.hued = true;
    const count = countOf(seat.holds);
    // 自摸：胡的那张已在手牌里；点炮：把弃牌加入判定
    const countWithWin = isZimo ? Int8Array.from(count) : addTile(count, winTile);
    const pattern = winPattern(countWithWin, meldCount(seat));
    const fan = computeFan({
      countWithWin,
      winTile,
      pattern,
      meldTiles: meldTiles(seat),
      pengs: seat.pengs,
      holdsLen: seat.holds.length + (isZimo ? 0 : 1),
      gangBonus: run.gangBonus,
      hasMingPai: false,
      isHaiDi: wallRemaining(run) === 0,
      type: 'xykwx',
    });
    const score = fanScore(fan, run.conf.baseBet);
    seat.score += isZimo ? score * (SEATS - 1) : score;
    if (isZimo) {
      for (const s of run.seats) if (s.index !== winner) s.score -= score;
    } else {
      run.seats[discarder].score -= score;
    }
    run.stats.maxFan = Math.max(run.stats.maxFan, fan);

    const playerWon = seat.isPlayer;
    if (playerWon) {
      const gain = isZimo ? score * (SEATS - 1) : score;
      run.stats.totalScore += gain;
      run.stats.roundsWon += 1;
    } else {
      const loss = (isZimo ? score : (discarder === 0 ? score : 0));
      run.stats.totalScore -= loss;
      run.stats.roundsLost += 1;
    }

    emit(run, playerWon ? 'win' : 'lose', { seat: winner, isZimo, fan, score, pattern, tile: winTile });
    emit(run, 'roundEnd', { winner, isZimo, fan, score, pattern, playerWon });
  } else {
    // 荒庄
    run.stats.roundsDrawn += 1;
    emit(run, 'roundDraw', {});
    emit(run, 'roundEnd', { winner: -1, draw: true });
  }

  run.state = 'roundEnd';
  run.pending = null;
}

function finishRound(run) {
  run.round += 1;
  if (run.round > ROUNDS.length) {
    run.phase = 'sessionEnd';
    run.stats.bestRank = Math.max(run.stats.bestRank, run.round - 1);
    emit(run, 'sessionEnd', { totalScore: run.stats.totalScore, roundsWon: run.stats.roundsWon, roundsLost: run.stats.roundsLost });
    return;
  }
  // 庄家轮替：赢家当庄，荒庄连庄
  const last = run.events.filter((e) => e.type === 'roundEnd').pop();
  if (last && last.winner >= 0) run.button = last.winner;
  startRound(run);
}

// ---------------------------------------------------------------------------
// AI / greedy 决策
// ---------------------------------------------------------------------------

function effectiveSkill(run) {
  return run.aiSkill != null ? run.aiSkill : run.conf.aiSkill;
}

function chooseDiscard(seat) {
  const count = countOf(seat.holds);
  const melds = meldCount(seat);
  let bestTile = seat.holds[seat.holds.length - 1];
  let bestShanten = Infinity;
  let bestUse = Infinity;
  const seen = new Set();
  for (const t of seat.holds) {
    if (seen.has(t)) continue;
    seen.add(t);
    const c = Int8Array.from(count);
    c[t] -= 1;
    const sh = shanten(c, melds);
    const use = usefulness(t, c);
    if (sh < bestShanten || (sh === bestShanten && use < bestUse)) {
      bestShanten = sh;
      bestUse = use;
      bestTile = t;
    }
  }
  return bestTile;
}

/** 牌的价值：越低越该弃。 */
function usefulness(t, count) {
  let score = 0;
  if (count[t] >= 2) score += 4;
  if (t >= 27) {
    if (count[t] === 1) score -= 3; // 孤张三元
    return score;
  }
  const v = t % 9;
  const lo = t < 9 ? 0 : 9;
  if (v === 0 || v === 8) score -= 0.5; // 边张
  for (const s of [t - 2, t - 1, t]) {
    if (s < lo || s + 2 >= lo + 9) continue;
    let partners = 0;
    for (let k = s; k <= s + 2; k += 1) if (k !== t && count[k] > 0) partners += 1;
    score += partners * 2;
  }
  return score;
}

function chooseClaim(run, seat, options) {
  if (options.hu) return { action: 'hu' };
  if (options.gang) return { action: 'gang', tile: options.gangPai[0] };
  if (options.peng) {
    // 碰是否改善向听
    const count = countOf(seat.holds);
    const tile = run.chuPai;
    const after = Int8Array.from(count);
    after[tile] -= 2;
    const shAfter = shanten(after, meldCount(seat) + 1);
    const shBefore = shanten(count, meldCount(seat));
    if (shAfter <= shBefore) return { action: 'peng' };
    return { action: 'pass' };
  }
  return { action: 'pass' };
}

function aiDecide(run, seatIdx, p) {
  const seat = run.seats[seatIdx];
  const skill = effectiveSkill(run);
  const roll = () => run.rng() < skill;

  if (p.kind === 'discard') {
    if (p.options.canHu) return { action: 'hu' };
    if (p.options.canGang && roll()) return { action: 'gang', tile: p.options.gangPai[0] };
    if (roll()) return { action: 'discard', tile: chooseDiscard(seat) };
    // 弱 AI：随机弃一张（优先孤张三元/边张近似用随机）
    return { action: 'discard', tile: seat.holds[Math.floor(run.rng() * seat.holds.length)] };
  }
  if (p.kind === 'claim') {
    if (p.options.hu) return { action: 'hu' };
    if (p.options.gang && roll()) return { action: 'gang', tile: p.options.gangPai[0] };
    if (p.options.peng && roll()) {
      const count = countOf(seat.holds);
      const tile = run.chuPai;
      const after = Int8Array.from(count);
      after[tile] -= 2;
      const shAfter = shanten(after, meldCount(seat) + 1);
      const shBefore = shanten(count, meldCount(seat));
      if (shAfter <= shBefore) return { action: 'peng' };
    }
    return { action: 'pass' };
  }
  return { action: 'pass' };
}

/** greedy（selfplay 玩家 bot）：总是最优。 */
export function greedyDecide(run, p) {
  const seat = run.seats[0];
  if (p.kind === 'turnStart') {
    if (p.options.stargaze && run.stargazeLeft > 0) return { action: 'stargaze' };
    return { action: 'draw' };
  }
  if (p.kind === 'discard') {
    if (p.options.canHu) return { action: 'hu' };
    if (p.options.canGang) return { action: 'gang', tile: p.options.gangPai[0] };
    return { action: 'discard', tile: chooseDiscard(seat) };
  }
  if (p.kind === 'claim') {
    return chooseClaim(run, seat, p.options);
  }
  return { action: 'pass' };
}

// ---------------------------------------------------------------------------
// 查询接口
// ---------------------------------------------------------------------------

export function getHud(run) {
  const player = run.seats[0];
  const opps = run.seats.filter((s) => !s.isPlayer);
  return {
    round: run.round,
    totalRounds: ROUNDS.length,
    scene: run.conf.scene,
    baseBet: run.conf.baseBet,
    chips: run.stats.totalScore,
    wallRemaining: wallRemaining(run),
    stargazeLeft: run.stargazeLeft,
    swapLeft: run.swapLeft,
    peeks: run.peeks.slice(),
    phase: run.phase,
    state: run.state,
    pendingKind: run.pending?.kind || null,
    isPlayerTurn: run.pending?.seat === 0,
    turn: run.turn,
    player: {
      holds: player.holds.slice(),
      pengs: player.pengs.slice(),
      gangs: player.gangs.slice(),
      folds: player.folds.slice(),
      score: player.score,
      ting: tingList(player.holds, meldCount(player)),
      shanten: shanten(countOf(player.holds), meldCount(player)),
    },
    opponents: opps.map((s) => ({
      name: s.name,
      holdsCount: s.holds.length,
      pengs: s.pengs.slice(),
      gangs: s.gangs.slice(),
      folds: s.folds.slice(),
      score: s.score,
      hued: s.hued,
    })),
  };
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
