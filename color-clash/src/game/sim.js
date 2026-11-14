// 纯逻辑：UNO 式牌局（3 人）+ 功能牌 + 简单 AI。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { RULES, COLOR_KEYS } from '../../config/game.config.js';

const N = RULES.players;

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uid = 0;
function card(color, value) {
  uid += 1;
  return { id: uid, color, value };
}

function buildDeck() {
  const deck = [];
  for (const c of COLOR_KEYS) {
    deck.push(card(c, '0'));
    for (let v = 1; v <= 9; v += 1) { deck.push(card(c, String(v))); deck.push(card(c, String(v))); }
    for (const s of ['skip', 'reverse', 'draw2']) { deck.push(card(c, s)); deck.push(card(c, s)); }
  }
  for (let i = 0; i < 4; i += 1) { deck.push(card('wild', 'wild')); deck.push(card('wild', 'wild4')); }
  return deck;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createRun({ seed = 1 } = {}) {
  const rng = makeRng(seed);
  const deck = shuffle(buildDeck(), rng);
  const hands = [];
  for (let p = 0; p < N; p += 1) hands.push(deck.splice(0, RULES.handSize));
  // 翻首张（wild4 重抽；wild 随机定色）
  let top = deck.shift();
  while (top.value === 'wild4') { deck.push(top); shuffle(deck, rng); top = deck.shift(); }
  const color = top.color === 'wild' ? COLOR_KEYS[Math.floor(rng() * 4)] : top.color;
  return {
    seed,
    deck,
    discard: [top],
    hands,
    turn: 0,
    dir: 1,
    color,
    drawnThisTurn: false,
    phase: 'playing', // playing | over
    winner: null,
    events: [],
    rng,
  };
}

export function topCard(run) {
  return run.discard[run.discard.length - 1];
}

export function canPlay(card, color, topValue) {
  if (card.color === 'wild') return true;
  if (card.color === color) return true;
  if (card.value === topValue) return true;
  return false;
}

export function legalMoves(run, playerIdx) {
  const top = topCard(run);
  const out = [];
  run.hands[playerIdx].forEach((c, i) => {
    if (canPlay(c, run.color, top.value)) out.push(i);
  });
  return out;
}

function refillDeck(run) {
  if (run.deck.length === 0 && run.discard.length > 1) {
    const top = run.discard.pop();
    run.deck = shuffle(run.discard, run.rng);
    run.discard = [top];
  }
}

function drawCards(run, playerIdx, n) {
  const drawn = [];
  for (let i = 0; i < n; i += 1) {
    refillDeck(run);
    if (run.deck.length === 0) break;
    const c = run.deck.shift();
    run.hands[playerIdx].push(c);
    drawn.push(c);
  }
  return drawn;
}

function advance(run, steps) {
  for (let i = 0; i < steps; i += 1) {
    run.turn = (run.turn + run.dir + N) % N;
  }
  run.drawnThisTurn = false;
}

export function bestColor(hand) {
  const count = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) if (c.color !== 'wild') count[c.color] += 1;
  let best = COLOR_KEYS[0];
  for (const k of COLOR_KEYS) if (count[k] > count[best]) best = k;
  return best;
}

// 当前回合玩家出牌。wild 需传 chosenColor。
export function playCard(run, cardIndex, chosenColor) {
  if (run.phase !== 'playing') return { ok: false };
  const player = run.turn;
  const hand = run.hands[player];
  const c = hand[cardIndex];
  if (!c) return { ok: false };
  const top = topCard(run);
  if (!canPlay(c, run.color, top.value)) return { ok: false, reason: 'illegal' };
  if (c.color === 'wild' && !COLOR_KEYS.includes(chosenColor)) return { ok: false, reason: 'color' };

  hand.splice(cardIndex, 1);
  run.discard.push(c);
  run.color = c.color === 'wild' ? chosenColor : c.color;
  run.events.push({ type: 'play', player, card: c, color: run.color });

  let winner = null;
  if (hand.length === 0) {
    run.phase = 'over';
    run.winner = player;
    winner = player;
    run.events.push({ type: 'win', player });
    return { ok: true, card: c, winner };
  }

  const next = (run.turn + run.dir + N) % N;
  if (c.value === 'skip') {
    advance(run, 2);
  } else if (c.value === 'reverse') {
    run.dir *= -1;
    advance(run, 1);
  } else if (c.value === 'draw2') {
    drawCards(run, next, 2);
    run.events.push({ type: 'draw', player: next, count: 2 });
    advance(run, 2);
  } else if (c.value === 'wild4') {
    drawCards(run, next, 4);
    run.events.push({ type: 'draw', player: next, count: 4 });
    advance(run, 2);
  } else {
    advance(run, 1);
  }
  return { ok: true, card: c, winner };
}

// 摸一张：可出则保留回合（可出可过），否则自动结束回合。
export function draw(run) {
  if (run.phase !== 'playing' || run.drawnThisTurn) return { ok: false };
  const player = run.turn;
  const drawn = drawCards(run, player, 1);
  run.drawnThisTurn = true;
  const c = drawn[0];
  run.events.push({ type: 'draw', player, count: 1 });
  if (c && canPlay(c, run.color, topCard(run).value)) {
    return { ok: true, card: c, playable: true };
  }
  advance(run, 1);
  return { ok: true, card: c, playable: false };
}

export function pass(run) {
  if (run.phase !== 'playing' || !run.drawnThisTurn) return { ok: false };
  advance(run, 1);
  return { ok: true };
}

function cardScore(c) {
  if (c.value === 'wild4') return 6;
  if (c.value === 'draw2') return 5;
  if (c.value === 'skip' || c.value === 'reverse') return 4;
  if (c.value === 'wild') return 3;
  return 1;
}

// AI 走一步（仅非 0 号玩家）。返回动作描述。
export function aiStep(run) {
  if (run.phase !== 'playing' || run.turn === 0) return null;
  const player = run.turn;
  const hand = run.hands[player];
  const legal = legalMoves(run, player);
  if (legal.length > 0) {
    let best = legal[0];
    for (const i of legal) if (cardScore(hand[i]) > cardScore(hand[best])) best = i;
    const c = hand[best];
    const chosen = c.color === 'wild' ? bestColor(hand) : undefined;
    const r = playCard(run, best, chosen);
    return { action: 'play', player, card: c, ...r };
  }
  const d = draw(run);
  if (d.ok && d.playable) {
    const idx = run.hands[player].length - 1;
    const c = run.hands[player][idx];
    const chosen = c.color === 'wild' ? bestColor(run.hands[player]) : undefined;
    const r = playCard(run, idx, chosen);
    return { action: 'draw-play', player, card: c, ...r };
  }
  if (run.drawnThisTurn) pass(run);
  return { action: 'draw-pass', player };
}

export function getHud(run) {
  return {
    turn: run.turn,
    dir: run.dir,
    color: run.color,
    counts: run.hands.map((h) => h.length),
    top: topCard(run),
    phase: run.phase,
    winner: run.winner,
    deck: run.deck.length,
    drawnThisTurn: run.drawnThisTurn,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const PLAYER_COUNT = N;