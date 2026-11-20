// 福州麻将 13 · 纯逻辑对局状态机（无 DOM，可 node --test / selfplay 直跑）
// 单人 vs 3 AI：座位 0=自己(下) 1=右 2=对(上) 3=左。
// 玩法规则 P0 1:1 复刻源码（牌组/补花/金/胡牌判定/吃碰杠/回合流程）。
import { WIN, TILE, SEATS, ITEMS, LUCK, SCORE } from '../../config/game.config.js';
import { canWin, getListen, getEatOptions, getPongArray, getKongOptions } from './mahjong.js';
import { buildWallTiles, shuffleWith, mulberry32 } from './tiles.js';
import { decideDiscard, hintInfo } from './ai.js';

export { mulberry32 } from './tiles.js';

const DONG = TILE.DONG;
const PLAYER_SEAT = 0;
const MOVE = 0.3;           // AI 每一步的思考/动作耗时（sim 秒，让遥测时长真实）
const AI_SKILL = 0.7;       // AI 有 70% 概率走最优出牌，其余随机

function pushEvent(s, type, payload = {}) {
  s.events.push({ type, ...payload });
}

function schedule(run, delay, fn) {
  const s = run.state;
  s.schedule.push({ atTime: s.simTime + delay, fn });
  s.schedule.sort((a, b) => a.atTime - b.atTime);
}

function removeOne(arr, tile) {
  const i = arr.indexOf(tile);
  if (i >= 0) arr.splice(i, 1);
  return i >= 0;
}

function removeN(arr, tile, n) {
  for (let i = 0; i < n; i += 1) removeOne(arr, tile);
}

function removeDiscard(run, seatIdx, tileId) {
  const d = run.state.seats[seatIdx].discards;
  const i = d.lastIndexOf(tileId);
  if (i >= 0) d.splice(i, 1);
}

function makeSeat() {
  return { hand: [], flowers: [], discards: [], melds: [], draw: null };
}

function recomputeListen(s, seat) {
  s.listen = seat === PLAYER_SEAT ? getListen(s.seats[PLAYER_SEAT].hand, s.joker) : [];
}

function computeStars(winType, flowers) {
  if (winType === WIN.THREEJIN || winType === WIN.JINQUE) return 3;
  if (winType === WIN.PINGHU) return flowers >= 2 ? 3 : 2;
  return 0;
}

// ---- 金 ----
function drawJoker(run) {
  const s = run.state;
  let idx = -1;
  let tile = -1;
  for (let tries = 0; tries < 200; tries += 1) {
    const i = Math.floor(run.rng() * s.wall.length);
    if (s.wall[i] < DONG) { idx = i; tile = s.wall[i]; break; }
  }
  if (idx < 0) {
    idx = s.wall.findIndex((t) => t < DONG);
    tile = s.wall[idx];
  }
  s.wall.splice(idx, 1);
  return tile;
}

// ---- 建局 ----
function startRound(run, seed, banker, initialDelay) {
  const s = run.state;
  const rng = mulberry32(seed);
  run.rng = rng;
  run.itemUse = {};

  s.round = run.roundNum;
  s.phase = 'playing';
  s.stage = 'idle';
  s.actor = -1;
  s.claims = null;
  s.selfActions = null;
  s.hint = null;
  s.lastDiscard = { seat: -1, tileId: -1 };
  s.backDrawArmed = false;
  s.result = null;
  s.schedule = [];
  s.events = [];
  s.seats = [makeSeat(), makeSeat(), makeSeat(), makeSeat()];
  s.banker = banker;

  // 洗牌 + 建墙（前端为索引 0）
  s.wall = shuffleWith(rng, buildWallTiles());

  // 发牌：庄家 17，其余 16，从庄家开始按座位顺序
  for (let i = 0; i < SEATS; i += 1) {
    const pos = (i + banker) % SEATS;
    const count = pos === banker ? 17 : 16;
    s.seats[pos].hand = s.wall.splice(0, count);
  }

  // 补花（递归，从墙前端补）
  for (let i = 0; i < SEATS; i += 1) {
    const pos = (i + banker) % SEATS;
    const seat = s.seats[pos];
    let guard = 0;
    while (guard++ < 64) {
      const fi = seat.hand.findIndex((t) => t >= TILE.SPRING);
      if (fi < 0) break;
      const flower = seat.hand.splice(fi, 1)[0];
      seat.flowers.push(flower);
      pushEvent(s, 'flower', { seat: pos, tile: flower });
      if (s.wall.length === 0) break;
      seat.hand.push(s.wall.shift());
    }
  }

  // 开金
  s.joker = drawJoker(run);
  pushEvent(s, 'joker', { joker: s.joker });

  // 排序各手牌（供 AI/渲染稳定）
  for (let i = 0; i < SEATS; i += 1) {
    s.seats[i].hand.sort((a, b) => a - b);
  }
  recomputeListen(s, PLAYER_SEAT);
  s.currSeat = banker;
  pushEvent(s, 'roundStart', { round: s.round, banker, joker: s.joker });

  // 与源码一致：庄家开局已多一张，首轮不摸牌，直接进入出牌判定（天胡/暗杠/出牌）。
  schedule(run, initialDelay, () => evaluateTurn(run, banker));
}

// ---- 摸牌 ----
function luckyDraw(run, seat) {
  const s = run.state;
  const n = Math.min(LUCK.candidates, s.wall.length);
  const cands = s.wall.splice(0, n);
  let best = cands[0];
  let bestScore = -Infinity;
  for (const c of cands) {
    if (c >= DONG) continue; // 花不参与择优
    const hand2 = seat.hand.concat(c);
    const l = getListen(hand2, s.joker).length + (canWin(hand2, s.joker) > WIN.NONE ? 1000 : 0);
    if (l > bestScore) { bestScore = l; best = c; }
  }
  const rest = cands.filter((c) => c !== best);
  for (let i = rest.length - 1; i >= 0; i -= 1) s.wall.unshift(rest[i]);
  return best;
}

function doDraw(run, seatIdx) {
  const s = run.state;
  if (s.wall.length === 0) {
    finishDraw(run);
    return;
  }
  let tile;
  if (seatIdx === PLAYER_SEAT && s.backDrawArmed) {
    s.backDrawArmed = false;
    tile = s.wall.pop();
  } else if (seatIdx === PLAYER_SEAT && LUCK.enabled) {
    tile = luckyDraw(run, s.seats[PLAYER_SEAT]);
  } else {
    tile = s.wall.shift();
  }

  if (tile >= TILE.SPRING) {
    // 摸到花：补花
    s.seats[seatIdx].flowers.push(tile);
    if (seatIdx === PLAYER_SEAT) run.coins += 5;
    pushEvent(s, 'flower', { seat: seatIdx, tile });
    schedule(run, MOVE * 0.6, () => doDraw(run, seatIdx));
    return;
  }

  const seat = s.seats[seatIdx];
  seat.hand.push(tile);
  seat.draw = tile;
  pushEvent(s, 'drawTile', { seat: seatIdx, tile });
  evaluateTurn(run, seatIdx);
}

// 摸牌后（或庄家首轮免摸）判定：自摸胡 > 暗杠 > 出牌
function evaluateTurn(run, seatIdx) {
  const s = run.state;
  const seat = s.seats[seatIdx];
  const canHu = canWin(seat.hand, s.joker) > WIN.NONE;
  const kongOptions = getKongOptions(seat.hand, 2, 0);

  if (seatIdx === PLAYER_SEAT) {
    recomputeListen(s, PLAYER_SEAT);
    if (canHu || kongOptions.length > 0) {
      s.stage = 'awaitSelf';
      s.actor = PLAYER_SEAT;
      s.selfActions = { canHu, kongOptions };
    } else {
      s.stage = 'awaitDiscard';
      s.actor = PLAYER_SEAT;
    }
    return;
  }

  // AI 自动：自摸胡 > 暗杠 > 出牌
  if (canHu) {
    const huTile = seat.draw != null ? seat.draw : seat.hand[seat.hand.length - 1];
    schedule(run, MOVE, () => finishRound(run, seatIdx, canWin(seat.hand, s.joker), huTile, true));
    return;
  }
  if (kongOptions.length > 0) {
    schedule(run, MOVE, () => doConcealedKong(run, seatIdx, kongOptions[0]));
    return;
  }
  schedule(run, MOVE, () => aiDiscard(run, seatIdx));
}

function doConcealedKong(run, seatIdx, kongOpt) {
  const s = run.state;
  const t = kongOpt.options[0];
  const seat = s.seats[seatIdx];
  removeN(seat.hand, t, 4);
  seat.melds.push({ type: 'concealedKong', tiles: kongOpt.options });
  pushEvent(s, 'kong', { seat: seatIdx, tile: t, concealed: true });
  s.currSeat = seatIdx;
  schedule(run, MOVE * 0.8, () => doDraw(run, seatIdx));
}

function aiDiscard(run, seatIdx) {
  const s = run.state;
  const seat = s.seats[seatIdx];
  const tile = decideDiscard(seat.hand, s.joker, run.rng, AI_SKILL);
  doDiscard(run, seatIdx, tile);
}

function doDiscard(run, seatIdx, tileId) {
  const s = run.state;
  const seat = s.seats[seatIdx];
  if (!removeOne(seat.hand, tileId)) return;
  s.stage = 'idle';
  s.actor = -1;
  seat.discards.push(tileId);
  seat.draw = null;
  s.lastDiscard = { seat: seatIdx, tileId };
  pushEvent(s, 'discard', { seat: seatIdx, tileId });
  resolveClaims(run, seatIdx, tileId, -1);
}

// ---- 吃碰杠胡判定 ----
function resolveClaims(run, discarder, tileId, excludeSeat) {
  const s = run.state;
  s.stage = 'idle';
  s.actor = -1;
  const claims = [];
  for (let i = 1; i < SEATS; i += 1) {
    const pos = (i + discarder) % SEATS;
    if (pos === excludeSeat) continue;
    const seat = s.seats[pos];
    if (seat.hand.length <= 5) continue; // 与源码一致：剩牌过少不可叫牌
    const eatOptions = i === 1 ? getEatOptions(seat.hand, tileId, s.joker) : [];
    const pongArray = getPongArray(seat.hand, tileId);
    const kongOptions = getKongOptions(seat.hand, 1, tileId);
    const canHu = canWin(seat.hand.concat(tileId), s.joker) > WIN.NONE;
    if (eatOptions.length || pongArray.length || kongOptions.length || canHu) {
      claims.push({
        seat: pos,
        canEat: eatOptions.length > 0,
        canPong: pongArray.length > 0,
        canKong: kongOptions.length > 0,
        canHu,
        eatOptions,
        pongArray,
        kongOptions,
        discarder,
        tileId,
      });
    }
  }

  if (claims.length === 0) {
    nextTurn(run, (discarder + 1) % SEATS, true);
    return;
  }

  // 优先级：胡 > 碰/杠 > 吃（同优先级取离弃牌者最近者）
  let winner = null;
  const huers = claims.filter((c) => c.canHu);
  if (huers.length) winner = huers[0];
  else {
    const pkers = claims.filter((c) => c.canPong || c.canKong);
    if (pkers.length) winner = pkers[0];
    else {
      const eaters = claims.filter((c) => c.canEat);
      if (eaters.length) winner = eaters[0];
    }
  }
  if (!winner) {
    nextTurn(run, (discarder + 1) % SEATS, true);
    return;
  }

  if (winner.seat === PLAYER_SEAT) {
    s.stage = 'awaitClaim';
    s.actor = PLAYER_SEAT;
    s.claims = winner;
    recomputeListen(s, PLAYER_SEAT);
    return;
  }
  schedule(run, MOVE, () => execClaim(run, winner));
}

function execClaim(run, claim) {
  const s = run.state;
  const seat = s.seats[claim.seat];
  const tileId = claim.tileId;

  if (claim.canHu) {
    const wt = canWin(seat.hand.concat(tileId), s.joker);
    finishRound(run, claim.seat, wt, tileId, false);
    return;
  }
  if (claim.canKong) {
    removeN(seat.hand, tileId, 3);
    seat.melds.push({ type: 'exposedKong', tiles: [tileId, tileId, tileId, tileId] });
    removeDiscard(run, claim.discarder, tileId);
    pushEvent(s, 'kong', { seat: claim.seat, tile: tileId, concealed: false });
    s.currSeat = claim.seat;
    schedule(run, MOVE * 0.8, () => doDraw(run, claim.seat));
    return;
  }
  if (claim.canPong) {
    removeN(seat.hand, tileId, 2);
    seat.melds.push({ type: 'pong', tiles: [tileId, tileId, tileId] });
    removeDiscard(run, claim.discarder, tileId);
    pushEvent(s, 'pong', { seat: claim.seat, tile: tileId });
    scheduleDiscardOrAwait(run, claim.seat);
    return;
  }
  if (claim.canEat) {
    const eatTiles = claim.eatOptions[claim.eatIndex || 0] || claim.eatOptions[0];
    for (const t of eatTiles) {
      if (t !== tileId) removeOne(seat.hand, t);
    }
    seat.melds.push({ type: 'chow', tiles: eatTiles.slice() });
    removeDiscard(run, claim.discarder, tileId);
    pushEvent(s, 'chow', { seat: claim.seat, tiles: eatTiles.slice(), tileId });
    scheduleDiscardOrAwait(run, claim.seat);
  }
}

function scheduleDiscardOrAwait(run, seatIdx) {
  const s = run.state;
  s.stage = 'idle';
  s.actor = -1;
  s.currSeat = seatIdx;
  if (seatIdx === PLAYER_SEAT) {
    recomputeListen(s, PLAYER_SEAT);
    s.stage = 'awaitDiscard';
    s.actor = PLAYER_SEAT;
  } else {
    schedule(run, MOVE, () => aiDiscard(run, seatIdx));
  }
}

function nextTurn(run, seatIdx, needDraw) {
  const s = run.state;
  s.stage = 'idle';
  s.actor = -1;
  s.currSeat = seatIdx;
  if (needDraw) {
    schedule(run, seatIdx === PLAYER_SEAT ? 0.3 : MOVE, () => doDraw(run, seatIdx));
  } else {
    scheduleDiscardOrAwait(run, seatIdx);
  }
}

// ---- 结算 ----
function finishRound(run, huSeat, winType, huTile, selfDraw) {
  const s = run.state;
  s.stage = 'over';
  s.currSeat = huSeat;
  const playerWon = huSeat === PLAYER_SEAT;
  const flowers = s.seats[PLAYER_SEAT].flowers.length;

  if (playerWon) {
    const base = WIN_SCORE(winType) + flowers * SCORE.flower;
    const mult = 1 + Math.min(Math.max(0, run.streak - 1), SCORE.streakCap) * SCORE.streakStep;
    const score = Math.round(base * mult);
    const stars = computeStars(winType, flowers);
    run.streak += 1;
    run.coins += score;
    run.totalStars = Math.max(run.totalStars, stars);
    s.phase = 'won';
    s.result = { won: true, winType, score, stars, flowers, huSeat, selfDraw, streak: run.streak, reason: selfDraw ? 'selfDraw' : 'discardHu' };
    pushEvent(s, 'hu', { seat: huSeat, tile: huTile, winType, selfDraw });
    pushEvent(s, 'win', { winType, score, stars, flowers, streak: run.streak });
  } else {
    const listen = getListen(s.seats[PLAYER_SEAT].hand, s.joker).length;
    const stars = (flowers > 0 || listen > 0) ? 1 : 0;
    run.streak = 0;
    run.coins += flowers * 5;
    run.totalStars = Math.max(run.totalStars, stars);
    s.phase = 'lost';
    s.result = { won: false, winType, score: 0, stars, flowers, huSeat, selfDraw, reason: 'aiWin' };
    pushEvent(s, 'hu', { seat: huSeat, tile: huTile, winType, selfDraw });
    pushEvent(s, 'lose', { winType, stars, flowers, huSeat });
  }
}

function finishDraw(run) {
  const s = run.state;
  s.stage = 'over';
  run.streak = 0;
  const flowers = s.seats[PLAYER_SEAT].flowers.length;
  s.phase = 'draw';
  s.result = { won: false, reason: 'noWin', stars: 0, score: 0, flowers, huSeat: -1 };
  pushEvent(s, 'drawRound', {});
}

function WIN_SCORE(winType) {
  return ({ [WIN.PINGHU]: 100, [WIN.JINQUE]: 220, [WIN.THREEJIN]: 340 })[winType] || 100;
}

// ---- run 对象 ----
export function createRun(seed = 1) {
  const run = {
    seed: seed >>> 0,
    roundNum: 1,
    coins: 50,
    streak: 0,
    totalStars: 0,
    itemUse: {},
    rng: mulberry32(seed >>> 0),
    state: {
      round: 1,
      phase: 'idle',
      stage: 'idle',
      simTime: 0,
      wall: [],
      joker: -1,
      banker: 0,
      currSeat: 0,
      seats: [makeSeat(), makeSeat(), makeSeat(), makeSeat()],
      schedule: [],
      events: [],
      listen: [],
      hint: null,
      backDrawArmed: false,
      lastDiscard: { seat: -1, tileId: -1 },
      claims: null,
      selfActions: null,
      result: null,
    },
  };

  run.step = (dt) => {
    const s = run.state;
    s.simTime += dt;
    let guard = 0;
    while (s.schedule.length && s.schedule[0].atTime <= s.simTime && guard < 1000) {
      const item = s.schedule.shift();
      item.fn();
      guard += 1;
    }
    return s;
  };

  run.drainEvents = () => {
    const ev = run.state.events;
    run.state.events = [];
    return ev;
  };

  run.discard = (tileId) => {
    const s = run.state;
    if (s.stage !== 'awaitDiscard' || s.actor !== PLAYER_SEAT) return { ok: false };
    if (!s.seats[PLAYER_SEAT].hand.includes(tileId)) return { ok: false };
    doDiscard(run, PLAYER_SEAT, tileId);
    return { ok: true };
  };

  run.act = (type, eatIndex = 0) => {
    const s = run.state;
    if (s.actor !== PLAYER_SEAT) return { ok: false };
    const seat = s.seats[PLAYER_SEAT];

    if (s.stage === 'awaitSelf') {
      if (type === 'hu' && s.selfActions && s.selfActions.canHu) {
        const wt = canWin(seat.hand, s.joker);
        finishRound(run, PLAYER_SEAT, wt, seat.draw, true);
        return { ok: true };
      }
      if (type === 'kong' && s.selfActions && s.selfActions.kongOptions.length > 0) {
        const k = s.selfActions.kongOptions[0];
        removeN(seat.hand, k.options[0], 4);
        seat.melds.push({ type: 'concealedKong', tiles: k.options });
        pushEvent(s, 'kong', { seat: PLAYER_SEAT, tile: k.options[0], concealed: true });
        recomputeListen(s, PLAYER_SEAT);
        s.selfActions = null;
        s.stage = 'idle';
        schedule(run, MOVE * 0.8, () => doDraw(run, PLAYER_SEAT));
        return { ok: true };
      }
      if (type === 'pass') {
        s.selfActions = null;
        s.stage = 'awaitDiscard';
        return { ok: true };
      }
      return { ok: false };
    }

    if (s.stage === 'awaitClaim') {
      const c = s.claims;
      const tileId = c.tileId;
      if (type === 'hu' && c.canHu) {
        const wt = canWin(seat.hand.concat(tileId), s.joker);
        s.claims = null;
        finishRound(run, PLAYER_SEAT, wt, tileId, false);
        return { ok: true };
      }
      if (type === 'kong' && c.canKong) {
        removeN(seat.hand, tileId, 3);
        seat.melds.push({ type: 'exposedKong', tiles: [tileId, tileId, tileId, tileId] });
        removeDiscard(run, c.discarder, tileId);
        pushEvent(s, 'kong', { seat: PLAYER_SEAT, tile: tileId, concealed: false });
        s.claims = null;
        s.currSeat = PLAYER_SEAT;
        s.stage = 'idle';
        recomputeListen(s, PLAYER_SEAT);
        schedule(run, MOVE * 0.8, () => doDraw(run, PLAYER_SEAT));
        return { ok: true };
      }
      if (type === 'pong' && c.canPong) {
        removeN(seat.hand, tileId, 2);
        seat.melds.push({ type: 'pong', tiles: [tileId, tileId, tileId] });
        removeDiscard(run, c.discarder, tileId);
        pushEvent(s, 'pong', { seat: PLAYER_SEAT, tile: tileId });
        s.claims = null;
        recomputeListen(s, PLAYER_SEAT);
        s.stage = 'awaitDiscard';
        return { ok: true };
      }
      if (type === 'eat' && c.canEat) {
        const eatTiles = c.eatOptions[eatIndex] || c.eatOptions[0];
        for (const t of eatTiles) {
          if (t !== tileId) removeOne(seat.hand, t);
        }
        seat.melds.push({ type: 'chow', tiles: eatTiles.slice() });
        removeDiscard(run, c.discarder, tileId);
        pushEvent(s, 'chow', { seat: PLAYER_SEAT, tiles: eatTiles.slice(), tileId });
        s.claims = null;
        recomputeListen(s, PLAYER_SEAT);
        s.stage = 'awaitDiscard';
        return { ok: true };
      }
      if (type === 'pass') {
        const discarder = c.discarder;
        const tile = c.tileId;
        s.claims = null;
        s.stage = 'idle';
        resolveClaims(run, discarder, tile, PLAYER_SEAT);
        return { ok: true };
      }
      return { ok: false };
    }
    return { ok: false };
  };

  run.useItem = (id) => {
    const s = run.state;
    const item = ITEMS[id];
    if (!item) return { ok: false };
    if (s.stage === 'over' || s.phase !== 'playing') return { ok: false };
    const used = run.itemUse[id] || 0;
    if (used >= item.perRound) return { ok: false, reason: 'usedItem' };
    if (run.coins < item.cost) return { ok: false, reason: 'noCoins' };
    run.coins -= item.cost;
    run.itemUse[id] = used + 1;
    pushEvent(s, 'item', { id });

    if (id === 'hint') {
      s.hint = hintInfo(s.seats[PLAYER_SEAT].hand, s.joker);
      pushEvent(s, 'hint', {});
      return { ok: true, info: s.hint };
    }
    if (id === 'reJoker') {
      const n = drawJoker(run);
      s.joker = n;
      s.hint = null;
      recomputeListen(s, PLAYER_SEAT);
      pushEvent(s, 'joker', { joker: n });
      return { ok: true, joker: n };
    }
    if (id === 'backDraw') {
      s.backDrawArmed = true;
      return { ok: true };
    }
    return { ok: false };
  };

  run.getHint = () => hintInfo(run.state.seats[PLAYER_SEAT].hand, run.state.joker);

  run.getHud = () => {
    const s = run.state;
    return {
      round: s.round,
      streak: run.streak,
      coins: run.coins,
      joker: s.joker,
      wall: s.wall.length,
      turn: s.currSeat,
      flowers: s.seats[PLAYER_SEAT].flowers.length,
      listen: s.listen || [],
      stage: s.stage,
      phase: s.phase,
    };
  };

  run.nextRound = () => {
    const s = run.state;
    const prev = s.result;
    const prevBanker = s.banker;
    let banker = prevBanker;
    if (prev && prev.huSeat != null && prev.huSeat >= 0) {
      banker = prev.huSeat === prevBanker ? prevBanker : (prevBanker + 1) % SEATS;
    }
    run.roundNum += 1;
    startRound(run, (run.seed + run.roundNum * 1013) >>> 0, banker, 0.5);
  };

  startRound(run, seed >>> 0, 0, 0.5);
  return run;
}
