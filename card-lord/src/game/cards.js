// src/game/cards.js — 牌模型 / 洗牌 / 发牌 / 排序（纯逻辑，无 DOM）
// 牌值：3=3 … 10=10, J=11, Q=12, K=13, A=14, 2=15, 小王=16, 大王=17
// 花色：0=♦, 1=♣, 2=♥, 3=♠；王 suit=4
import { DECK } from '../../config/gameplay.js';

export function buildDeck() {
  const deck = [];
  let id = 0;
  for (let rank = DECK.MIN_RANK; rank <= DECK.TWO_RANK; rank += 1) {
    for (let suit = 0; suit < DECK.SUITS; suit += 1) {
      deck.push({ id, rank, suit });
      id += 1;
    }
  }
  deck.push({ id: 52, rank: DECK.SMALL_JOKER, suit: 4 });
  deck.push({ id: 53, rank: DECK.BIG_JOKER, suit: 4 });
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

// 排序：点数降序（大在前），同点数花色降序（视觉稳定）
export function sortHand(cards) {
  return cards.slice().sort((a, b) => (b.rank - a.rank) || (b.suit - a.suit));
}

export function rankCount(cards) {
  const map = new Map();
  for (const c of cards) map.set(c.rank, (map.get(c.rank) || 0) + 1);
  const out = [];
  for (const [rank, count] of map) out.push({ rank, count });
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

export function byRank(cards, rank) {
  return cards.filter((c) => c.rank === rank);
}

export function rankLabel(rank) {
  if (rank === DECK.SMALL_JOKER) return 'SJ';
  if (rank === DECK.BIG_JOKER) return 'BJ';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '2';
  return String(rank);
}

export const SUIT_CHARS = ['♦', '♣', '♥', '♠'];
export const SUIT_RED = (suit) => suit === 0 || suit === 2; // ♦ ♥ 红色
