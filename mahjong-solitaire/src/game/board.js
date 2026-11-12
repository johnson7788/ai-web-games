// 纯逻辑：麻将接龙棋盘。不碰 DOM / window / localStorage / Date.now；随机全部来自可注入 seed。
import { RULES } from '../../config/game.config.js';
import { createSlots } from '../../config/layout.js';

// ---- 牌面定义 -------------------------------------------------------------
const DOT = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'];   // 筒
const BAM = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'];   // 条
const CHA = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'];   // 万
const WIN = ['wE', 'wS', 'wW', 'wN'];                                 // 东南西北
const DRA = ['gC', 'gG', 'gW'];                                       // 中发白
const FLW = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];         // 春夏秋冬梅兰竹菊

export function isFlower(kind) {
  return kind.startsWith('f');
}

export function matches(a, b) {
  if (isFlower(a) && isFlower(b)) return true;
  return a === b;
}

function buildDeck() {
  const deck = [];
  for (const k of [...DOT, ...BAM, ...CHA, ...WIN, ...DRA]) {
    for (let i = 0; i < 4; i += 1) deck.push(k);
  }
  for (const k of FLW) deck.push(k);
  return deck;
}

// ---- 随机（可注入 seed）---------------------------------------------------
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 自由判定（唯一真相）--------------------------------------------------
// 上方：更高层且矩形相交（半张牌栅格下 |Δx|<2 且 |Δy|<2 即相交）
// 左右：同层、同行带内，左侧或右侧「间距 < 一个牌宽(4 格)」有牌；两侧都被挡才不可取。
export function isFreePos(tiles, x, y, layer) {
  for (const t of tiles) {
    if (!t.alive) continue;
    if (t.layer > layer && Math.abs(t.x - x) < 2 && Math.abs(t.y - y) < 2) return false;
  }
  let left = false;
  let right = false;
  for (const t of tiles) {
    if (!t.alive || t.layer !== layer) continue;
    if (Math.abs(t.y - y) >= 2) continue;
    if (t.x < x && x - t.x < 4) left = true;
    else if (t.x > x && t.x - x < 4) right = true;
  }
  return !(left && right);
}

// ---- 反向剥离发牌 ---------------------------------------------------------
// 从空盘开始，每次选两个「当前可放」的槽位放一对，保证整局可解。
function makePairs(kinds, rng) {
  const counts = new Map();
  for (const k of kinds) counts.set(k, (counts.get(k) || 0) + 1);
  const pairs = [];
  const flowers = [];
  for (const [k, n] of counts) {
    if (isFlower(k)) flowers.push(k);
    else for (let i = 0; i < n / 2; i += 1) pairs.push([k, k]);
  }
  // 洗牌
  for (let i = flowers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [flowers[i], flowers[j]] = [flowers[j], flowers[i]];
  }
  for (let i = 0; i < flowers.length; i += 2) pairs.push([flowers[i], flowers[i + 1]]);
  for (let i = pairs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

// 反向剥离的「可放顺序」：自下而上逐层、逐行、由中心向两侧。
// 这样放每一对时两张牌都自由（下层铺满后上层才有牌压住，同行内由内向外两侧总有一侧空），
// 倒过来就是一条合法消牌顺序 → 保证可解。
function buildConstructionOrder(slots) {
  const byLayer = [[], [], [], [], []];
  slots.forEach((s, i) => byLayer[s.layer].push({ x: s.x, y: s.y, i }));
  const order = [];
  for (let L = 0; L < byLayer.length; L += 1) {
    const rows = new Map();
    for (const s of byLayer[L]) {
      if (!rows.has(s.y)) rows.set(s.y, []);
      rows.get(s.y).push(s);
    }
    const ys = [...rows.keys()].sort((a, b) => a - b);
    for (const y of ys) {
      const row = rows.get(y);
      const xs = row.map((t) => t.x);
      const center = (Math.min(...xs) + Math.max(...xs)) / 2;
      row.sort((a, b) => Math.abs(a.x - center) - Math.abs(b.x - center));
      for (const t of row) order.push(t.i);
    }
  }
  return order;
}

function dealTiles(slots, kinds, rng) {
  const tiles = slots.map((s) => ({ x: s.x, y: s.y, layer: s.layer, kind: null, alive: false }));
  const pairs = makePairs(kinds, rng);
  const order = buildConstructionOrder(slots);
  const placed = [];
  for (let k = 0; k < pairs.length; k += 1) {
    const a = order[2 * k];
    const b = order[2 * k + 1];
    tiles[a].kind = pairs[k][0];
    tiles[a].alive = true;
    tiles[b].kind = pairs[k][1];
    tiles[b].alive = true;
    placed.push([a, b]);
  }
  return { tiles, order: placed };
}

export function computeStars(elapsedSec) {
  if (elapsedSec <= RULES.starTimesSec[0]) return 3;
  if (elapsedSec <= RULES.starTimesSec[1]) return 2;
  return 1;
}

// ---- 棋盘对象 -------------------------------------------------------------
export function createBoard({ seed = 1 } = {}) {
  const slots = createSlots();
  const kinds = buildDeck();
  const base = typeof seed === 'number' ? seed : hash32(String(seed));
  const rng = mulberry32((base * 0x9e3779b9) >>> 0);
  const deal = dealTiles(slots, kinds, rng);

  const board = {
    tiles: deal.tiles,
    slots,
    remaining: kinds.length,
    pairsDone: 0,
    picks: [],
    hintUsed: 0,
    undoUsed: 0,
    shuffleUsed: 0,
    elapsed: 0,
    phase: 'title',
    history: [],
    _order: deal.order,
    _rng: rng,

    canPick(i) {
      const t = this.tiles[i];
      if (!t || !t.alive) return false;
      return isFreePos(this.tiles, t.x, t.y, t.layer);
    },

    freeIndices() {
      const out = [];
      for (let i = 0; i < this.tiles.length; i += 1) if (this.canPick(i)) out.push(i);
      return out;
    },

    findPair() {
      const map = new Map();
      for (const i of this.freeIndices()) {
        const k = this.tiles[i].kind;
        const key = isFlower(k) ? 'flower' : k;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(i);
      }
      for (const arr of map.values()) if (arr.length >= 2) return [arr[0], arr[1]];
      return null;
    },

    hint() {
      if (this.hintUsed >= RULES.hintLimit) return null;
      const pair = this.findPair();
      if (pair) this.hintUsed += 1;
      return pair;
    },

    pick(i) {
      const t = this.tiles[i];
      if (!t || !t.alive) return { matched: false, pair: null };
      if (!this.canPick(i)) return { matched: false, pair: null };
      if (this.picks.length === 0) {
        this.picks = [i];
        return { matched: false, pair: null, selected: i };
      }
      if (this.picks[0] === i) {
        this.picks = [];
        return { matched: false, pair: null };
      }
      const j = this.picks[0];
      this.picks = [];
      if (matches(t.kind, this.tiles[j].kind)) {
        this.removePair(i, j);
        return { matched: true, pair: [i, j] };
      }
      return { matched: false, pair: null, wrong: [i, j] };
    },

    removePair(a, b) {
      this.tiles[a].alive = false;
      this.tiles[b].alive = false;
      this.remaining -= 2;
      this.pairsDone += 1;
      this.history.push({ a, b, ka: this.tiles[a].kind, kb: this.tiles[b].kind });
    },

    autoSolvePair() {
      const pair = this.findPair();
      if (!pair) return null;
      this.removePair(pair[0], pair[1]);
      return pair;
    },

    undo() {
      if (this.undoUsed >= RULES.undoLimit || this.history.length === 0) return false;
      const h = this.history.pop();
      this.tiles[h.a].kind = h.ka;
      this.tiles[h.a].alive = true;
      this.tiles[h.b].kind = h.kb;
      this.tiles[h.b].alive = true;
      this.remaining += 2;
      this.pairsDone -= 1;
      this.undoUsed += 1;
      this.picks = [];
      return true;
    },

    shuffle() {
      if (this.shuffleUsed >= RULES.shuffleLimit || this.remaining === 0) return false;
      const aliveKinds = this.tiles.filter((t) => t.alive).map((t) => t.kind);
      const r = dealTiles(this.slots, aliveKinds, this._rng);
      this.tiles = r.tiles;
      this._order = r.order;
      this.shuffleUsed += 1;
      this.picks = [];
      this.history = [];
      return true;
    },

    solutionPairs() {
      return [...this._order].reverse();
    },

    getState() {
      return {
        remaining: this.remaining,
        picks: this.picks.length,
        phase: this.phase,
        stars: computeStars(this.elapsed),
      };
    },
  };

  return board;
}
