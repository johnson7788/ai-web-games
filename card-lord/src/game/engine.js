// src/game/engine.js — 斗地主单机引擎：会话 + 单局（叫分→加倍→出牌→结算），纯逻辑。
// 供 main.js（真实游玩）、tools/selfplay.mjs（无头遥测）、tests（规则/流程断言）共用。
import { buildDeck, shuffle, sortHand } from './cards.js';
import { typeJudge, canBeat, K } from './rules.js';
import { chooseBid, chooseDouble, chooseLead, chooseFollow } from './ai.js';
import { mulberry32 } from './rng.js';
import {
  DEAL, BID, DOUBLE, TIERS, TIER_NAMES, SCORING, STEP_TIME, MAX_ROUND_STEPS, DECK,
} from '../../config/gameplay.js';

const HUMAN = DEAL.HUMAN_SEAT;

function nextSeat(s) { return (s + 1) % DEAL.SEATS; }

function tierOf(tier) { return TIERS[Math.max(0, Math.min(TIERS.length - 1, tier - 1))]; }

function totalCount(rank) { return rank >= DECK.SMALL_JOKER ? 1 : 4; }

export function createRound(tier, seed) {
  const rng = mulberry32(seed);
  const deck = shuffle(buildDeck(), rng);
  const hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)];
  const hole = deck.slice(51, 54);
  for (let i = 0; i < 3; i += 1) hands[i] = sortHand(hands[i]);

  return {
    tier,
    rng,
    hands,
    hole,
    bids: [null, null, null],
    highestBid: 0,
    highestBidder: -1,
    bidSeat: 0,
    landlord: -1,
    multiplier: DOUBLE.BASE_MULTIPLIER,
    doubleSeat: 0,
    turn: 0,
    phase: 'bidding',
    lastPlay: null,
    lastPlayCards: null,
    lastPlaySeat: -1,
    passCount: 0,
    playedCount: [0, 0, 0],
    farmersPlayed: 0,
    landlordPlayed: 0,
    winner: -1,
    result: null,
    steps: 0,
    playedByRank: new Map(),
  };
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? 1 : (opts.seed >>> 0);
  const startTier = Math.max(1, Math.min(12, opts.startTier || 1));
  let roundSeed = (seed ^ 0x9e3779b9) >>> 0;
  let round = null;
  let tier = startTier;
  let phase = 'playing';
  let time = 0;
  let events = [];
  const stats = {
    roundsPlayed: 0,
    roundsWon: 0,
    maxTier: startTier,
    lastResult: null,
    totalPoints: 0,
  };

  function emit(type, payload = {}) {
    events.push({ type, t: time, ...payload });
  }

  function startRound() {
    round = createRound(tier, roundSeed);
    roundSeed = (Math.imul(roundSeed, 1664525) + 1013904223) >>> 0;
    emit('deal', { tier, seat: HUMAN, handSize: round.hands[HUMAN].length });
  }

  startRound();

  function recordPlayed(cards) {
    for (const c of cards) {
      round.playedByRank.set(c.rank, (round.playedByRank.get(c.rank) || 0) + 1);
    }
  }

  function playCards(seat, cards) {
    const judge = typeJudge(cards);
    if (!judge) return false;
    const hand = round.hands[seat];
    const remain = hand.slice();
    for (const c of cards) {
      const idx = remain.findIndex((x) => x.id === c.id);
      if (idx < 0) return false;
      remain.splice(idx, 1);
    }
    // 跟牌必须压过上家；领出任意合法牌型
    if (round.lastPlay && round.lastPlaySeat !== seat && !canBeat(round.lastPlay, judge)) return false;

    round.hands[seat] = remain;
    recordPlayed(cards);
    round.lastPlay = judge;
    round.lastPlayCards = cards;
    round.lastPlaySeat = seat;
    round.passCount = 0;
    round.playedCount[seat] += 1;
    if (seat === round.landlord) round.landlordPlayed += 1;
    else round.farmersPlayed += 1;

    if (judge.kind === K.BOMB) emit('bomb', { seat });
    else if (judge.kind === K.ROCKET) emit('rocket', { seat });
    emit('play', { seat, kind: judge.kind, val: judge.val, size: judge.size, cardsLeft: remain.length });

    if (remain.length === 0) {
      finishRound(seat);
      return true;
    }
    round.turn = nextSeat(seat);
    return true;
  }

  function passPlay(seat) {
    round.passCount += 1;
    emit('pass', { seat });
    if (round.passCount >= 2) {
      const leader = round.lastPlaySeat;
      round.lastPlay = null;
      round.lastPlayCards = null;
      round.lastPlaySeat = -1;
      round.passCount = 0;
      round.turn = leader;
    } else {
      round.turn = nextSeat(seat);
    }
  }

  function finishRound(winnerSeat) {
    const landlord = round.landlord;
    const humanWon = winnerSeat === HUMAN;
    const spring = winnerSeat === landlord && round.farmersPlayed === 0;
    const antiSpring = winnerSeat !== landlord && round.landlordPlayed === 1;
    const tierCfg = tierOf(round.tier);
    const multiplier = round.multiplier
      * (spring ? SCORING.SPRING_MULT : 1)
      * (antiSpring ? SCORING.ANTI_SPRING_MULT : 1);
    const points = tierCfg.baseScore * multiplier;

    round.winner = winnerSeat;
    round.result = {
      winnerSeat,
      humanWon,
      landlord,
      spring,
      antiSpring,
      multiplier,
      baseScore: tierCfg.baseScore,
      points,
      tierBefore: tier,
    };

    if (spring) emit('spring', { seat: winnerSeat });
    if (antiSpring) emit('antiSpring', { seat: winnerSeat });

    stats.roundsPlayed += 1;
    if (humanWon) {
      stats.roundsWon += 1;
      stats.totalPoints += points;
      tier = Math.min(12, tier + 1);
      stats.maxTier = Math.max(stats.maxTier, tier);
      emit('roundWin', { tier, points, multiplier });
      emit('tierUp', { tier });
    } else {
      stats.totalPoints -= points;
      emit('roundLose', { points, multiplier });
    }
    round.phase = 'done';
    stats.lastResult = humanWon ? 'win' : 'lose';
  }

  function doBid(seat, value) {
    if (value > 0 && value <= BID.MAX && value > round.highestBid) {
      round.highestBid = value;
      round.highestBidder = seat;
      emit('bid', { seat, bid: value });
      if (value === BID.MAX) { settleLandlord(); return; }
    } else {
      emit('bid', { seat, bid: 0 });
    }
    round.bidSeat = nextSeat(round.bidSeat);
    round.turn = round.bidSeat;
    if (round.bidSeat === 0) {
      if (round.highestBidder >= 0) settleLandlord();
      else redeal();
    }
  }

  function redeal() {
    emit('redeal', { tier });
    round = createRound(tier, roundSeed);
    roundSeed = (Math.imul(roundSeed, 1664525) + 1013904223) >>> 0;
    emit('deal', { tier, seat: HUMAN, handSize: round.hands[HUMAN].length });
  }

  function settleLandlord() {
    round.landlord = round.highestBidder;
    round.hands[round.landlord] = sortHand(round.hands[round.landlord].concat(round.hole));
    emit('landlord', { seat: round.landlord, bid: round.highestBid });
    round.phase = 'doubling';
    round.doubleSeat = 0;
    round.turn = 0;
  }

  function doDouble(seat, yes) {
    if (yes) {
      round.multiplier = Math.min(DOUBLE.MAX_MULTIPLIER, round.multiplier * 2);
      emit('double', { seat, multiplier: round.multiplier });
    } else {
      emit('doublePass', { seat });
    }
    round.doubleSeat = nextSeat(round.doubleSeat);
    round.turn = round.doubleSeat;
    if (round.doubleSeat === 0) {
      round.phase = 'playing';
      round.turn = round.landlord;
      round.lastPlay = null;
      round.lastPlaySeat = -1;
      round.passCount = 0;
      emit('startPlay', { landlord: round.landlord });
    }
  }

  // 无人输入时的自动动作（noinput 基线）：不叫 / 不加倍 / 跟牌不出 / 领出最小单
  function autoAct() {
    if (round.phase === 'bidding') doBid(HUMAN, 0);
    else if (round.phase === 'doubling') doDouble(HUMAN, false);
    else if (round.phase === 'playing') {
      if (round.lastPlaySeat === HUMAN || round.lastPlaySeat === -1) {
        const sorted = sortHand(round.hands[HUMAN]);
        playCards(HUMAN, [sorted[sorted.length - 1]]);
      } else {
        passPlay(HUMAN);
      }
    }
  }

  function humanAction(input) {
    if (round.phase === 'bidding') {
      const b = input && input.action === 'bid' ? Number(input.bid) : 0;
      doBid(HUMAN, Number.isFinite(b) ? b : 0);
      return;
    }
    if (round.phase === 'doubling') {
      doDouble(HUMAN, !!(input && input.action === 'double' && input.double));
      return;
    }
    if (round.phase === 'playing') {
      if (input && input.action === 'play' && Array.isArray(input.cards) && input.cards.length) {
        if (!playCards(HUMAN, input.cards)) emit('invalid', { seat: HUMAN });
        return;
      }
      if (input && input.action === 'pass') {
        if (round.lastPlaySeat === HUMAN || round.lastPlaySeat === -1) {
          emit('invalid', { seat: HUMAN });
          return;
        }
        passPlay(HUMAN);
        return;
      }
      autoAct();
    }
  }

  function aiAction() {
    const seat = round.turn;
    const hand = round.hands[seat];
    const skill = tierOf(round.tier).aiSkill;
    if (round.phase === 'bidding') {
      const want = chooseBid(hand, skill);
      doBid(seat, want > round.highestBid && want <= BID.MAX ? want : 0);
    } else if (round.phase === 'doubling') {
      doDouble(seat, chooseDouble(hand, skill));
    } else if (round.phase === 'playing') {
      const ctx = {
        landlord: round.landlord,
        seat,
        lastPlaySeat: round.lastPlaySeat,
        handCounts: round.hands.map((h) => h.length),
      };
      if (round.lastPlaySeat === seat || round.lastPlaySeat === -1) {
        const lead = chooseLead(hand, skill, ctx);
        if (lead && lead.length) playCards(seat, lead);
        else passPlay(seat);
      } else {
        const follow = chooseFollow(hand, round.lastPlay, skill, ctx);
        if (follow && follow.length) playCards(seat, follow);
        else passPlay(seat);
      }
    }
  }

  function step(input) {
    if (phase !== 'playing') return;
    if (!round || round.phase === 'done') return;
    time += STEP_TIME;

    if (round.turn === HUMAN) {
      humanAction(input);
      if (round.phase === 'done') return;
      if (round.turn === HUMAN) return; // 非法输入，等人重试
    }

    let guard = 0;
    while (round.turn !== HUMAN && round.phase !== 'done' && guard < 300) {
      aiAction();
      round.steps += 1;
      guard += 1;
      if (round.phase === 'done') return;
    }

    if (round.steps > MAX_ROUND_STEPS) {
      finishRound(round.landlord >= 0 ? round.landlord : 0);
    }
  }

  function advance() {
    if (phase === 'done') return false;
    if (round && round.phase === 'done') {
      if (round.result && !round.result.humanWon) {
        phase = 'done';
        emit('sessionEnd', { tier });
        return false;
      }
      startRound();
      return true;
    }
    return false;
  }

  function getHud() {
    if (!round) return { phase, tier, stats };
    const remaining = {};
    for (let r = DECK.MIN_RANK; r <= DECK.BIG_JOKER; r += 1) {
      remaining[r] = totalCount(r) - (round.playedByRank.get(r) || 0);
    }
    return {
      phase,
      roundPhase: round.phase,
      turn: round.turn,
      tier,
      tierName: TIER_NAMES.en[tier - 1],
      baseScore: tierOf(tier).baseScore,
      multiplier: round.multiplier,
      landlord: round.landlord,
      highestBid: round.highestBid,
      hand: round.hands[HUMAN].slice(),
      handCounts: round.hands.map((h) => h.length),
      hole: round.landlord >= 0 ? round.hole : null,
      lastPlay: round.lastPlayCards ? { cards: round.lastPlayCards, judge: round.lastPlay, seat: round.lastPlaySeat } : null,
      remaining,
      result: round.result,
      stats,
    };
  }

  function drainEvents() {
    const out = events;
    events = [];
    return out;
  }

  function hint() {
    if (!round || round.phase !== 'playing' || round.turn !== HUMAN) return null;
    const ctx = { landlord: round.landlord, seat: HUMAN, lastPlaySeat: round.lastPlaySeat, handCounts: round.hands.map((h) => h.length) };
    if (round.lastPlaySeat === HUMAN || round.lastPlaySeat === -1) return chooseLead(round.hands[HUMAN], 1, ctx);
    return chooseFollow(round.hands[HUMAN], round.lastPlay, 1, ctx);
  }

  return {
    get phase() { return phase; },
    get tier() { return tier; },
    get time() { return time; },
    get stats() { return stats; },
    get round() { return round; },
    step,
    advance,
    getHud,
    drainEvents,
    hint,
    get hands() { return round ? round.hands : null; },
    get currentTurn() { return round ? round.turn : -1; },
    get roundPhase() { return round ? round.phase : null; },
  };
}
