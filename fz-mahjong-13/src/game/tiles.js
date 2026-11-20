// 牌工具：牌 ID 解析 / 命名 / 排序（纯函数，无 DOM）

export const DONG = 41;
export const SPRING = 51;

export function isFlower(tid) {
  return tid >= SPRING;
}

export function isHonor(tid) {
  return tid >= DONG && tid < SPRING;
}

export function isSuited(tid) {
  return tid < DONG;
}

// 花色：1=筒 2=万 3=条 4=风箭 5=花
export function suitOf(tid) {
  return Math.floor(tid / 10);
}

// 序数：1-9（序数）/ 1-7（风箭）/ 1-8（花）
export function rankOf(tid) {
  return tid % 10;
}

const SUIT_EN = { 1: 'Dots', 2: 'Characters', 3: 'Bamboo' };
const SUIT_ZH = { 1: '筒', 2: '万', 3: '条' };
const HONOR_EN = { 1: 'East', 2: 'South', 3: 'West', 4: 'North', 5: 'Red', 6: 'Green', 7: 'White' };
const HONOR_ZH = { 1: '东', 2: '南', 3: '西', 4: '北', 5: '中', 6: '发', 7: '白' };
const FLOWER_EN = { 1: 'Spring', 2: 'Summer', 3: 'Autumn', 4: 'Winter', 5: 'Plum', 6: 'Orchid', 7: 'Bamboo', 8: 'Chrysanthemum' };
const FLOWER_ZH = { 1: '春', 2: '夏', 3: '秋', 4: '冬', 5: '梅', 6: '兰', 7: '竹', 8: '菊' };

// 完整名称（HUD / 提示 / 结算用）
export function tileName(tid, lang = 'en') {
  const suit = suitOf(tid);
  const rank = rankOf(tid);
  if (suit === 1 || suit === 2 || suit === 3) {
    return lang === 'zh' ? `${rank}${SUIT_ZH[suit]}` : `${rank} ${SUIT_EN[suit]}`;
  }
  if (suit === 4) return lang === 'zh' ? HONOR_ZH[rank] : HONOR_EN[rank];
  if (suit === 5) return lang === 'zh' ? FLOWER_ZH[rank] : FLOWER_EN[rank];
  return String(tid);
}

// 牌面短文本（渲染牌面用）：序数牌 = 数字，风箭/花 = 汉字
export function tileFace(tid) {
  const suit = suitOf(tid);
  const rank = rankOf(tid);
  if (suit === 1 || suit === 2 || suit === 3) return String(rank);
  if (suit === 4) return HONOR_ZH[rank];
  if (suit === 5) return FLOWER_ZH[rank];
  return '?';
}

// 牌面角标（序数牌右下角小字）：筒/万/条
export function tileSuit(tid) {
  const suit = suitOf(tid);
  return (suit === 1 || suit === 2 || suit === 3) ? SUIT_ZH[suit] : '';
}

// 排序：先花色后序数（花牌最后）
export function sortTiles(tiles) {
  return tiles.slice().sort((a, b) => {
    const sa = suitOf(a);
    const sb = suitOf(b);
    if (sa !== sb) return sa - sb;
    return rankOf(a) - rankOf(b);
  });
}

// 建牌墙：34 种 ×4 + 8 花 = 144
export function buildWallTiles() {
  const tiles = [];
  const suits = [11, 21, 31, 41];
  for (const s of suits) {
    const count = s === 41 ? 7 : 9;
    for (let i = 0; i < count; i += 1) tiles.push(s + i);
  }
  const all = [];
  for (let c = 0; c < 4; c += 1) all.push(...tiles);
  for (let i = 0; i < 8; i += 1) all.push(SPRING + i);
  return all;
}

// 稳定的可注入 RNG（mulberry32）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates 洗牌（使用给定 rng）
export function shuffleWith(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}
