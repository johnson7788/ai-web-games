// 纯逻辑 sim：牌局构建 / 翻牌 / 配对 / 步数 / 连击 / 特殊牌，无 DOM、无 localStorage。
// 随机全部走 seed（mulberry32），node --test 可直接测。
import { LEVELS, RULES, UPGRADES } from '../../config/game.config.js';

/** mulberry32 种子随机 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 构建一局。
 * @param opts { levelIndex, seed, cardIds:[], families:Map(cardId->familyKey), upgrades:Set, peeksLeft }
 * cardIds 是可用角色 id 池（去重后的 31 张）。
 */
export function createRun(opts = {}) {
  const level = LEVELS.find((l) => l.index === opts.levelIndex) ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = makeRng(seed);
  const upgrades = new Set(opts.upgrades || []);
  const cardPool = opts.cardIds || [];

  // ---- 选牌 ----
  // decoy 关：优先把同族角色凑进同一桌（辨析挑战）；否则均匀抽样
  let chosen = [];
  const families = opts.families || {};
  if (level.decoy && Object.keys(families).length) {
    const byFam = {};
    for (const id of cardPool) (byFam[families[id] ?? 'x'] ??= []).push(id);
    const fams = shuffleArray(Object.keys(byFam), rng);
    for (const f of fams) {
      if (chosen.length >= level.pairs) break;
      chosen.push(byFam[f][0]);
    }
    if (chosen.length < level.pairs) {
      const rest = cardPool.filter((c) => !chosen.includes(c));
      chosen = chosen.concat(shuffleArray(rest, rng).slice(0, level.pairs - chosen.length));
    }
  } else {
    chosen = shuffleArray([...cardPool], rng).slice(0, level.pairs);
  }
  chosen = chosen.slice(0, level.pairs);

  // ---- 组牌（含特殊牌） ----
  const cards = [];
  const nStar = Math.min(level.starPairs || 0, chosen.length);
  const nMirror = Math.min(level.mirrorPairs || 0, Math.max(0, chosen.length - nStar));
  const nQuads = Math.min(level.quads || 0, Math.floor(level.pairs / 2));
  let idx = 0;
  // quads：4 张同款占 2 个 pair 名额；剩余名额给普通/星/镜像对
  const quadChars = chosen.slice(idx, idx + nQuads); idx += nQuads;
  const normalPairs = level.pairs - nQuads * 2;
  for (const c of quadChars) {
    for (let k = 0; k < 4; k++) {
      cards.push({ char: c, kind: 'normal', mirrored: false });
    }
  }
  // 普通对 / 星对 / 镜像对
  const pairChars = chosen.slice(idx, idx + normalPairs);
  for (let i = 0; i < pairChars.length; i++) {
    const isStar = i < nStar;
    const isMirror = !isStar && i < nStar + nMirror;
    cards.push({ char: pairChars[i], kind: isStar ? 'star' : 'normal', mirrored: false });
    cards.push({ char: pairChars[i], kind: isStar ? 'star' : 'normal', mirrored: isMirror });
  }
  // 障碍卡
  for (let i = 0; i < (level.obstacles || 0); i++) {
    cards.push({ char: null, kind: 'obstacle', mirrored: false });
  }

  shuffleArray(cards, rng);

  const deck = cards.map((c, i) => ({
    id: i,
    char: c.char,
    kind: c.kind,
    mirrored: c.mirrored,
    state: 'down',            // down | up | matched
    revealedAt: 0,            // peek 标记
  }));

  const extraMoves = (upgrades.has('extra-moves-1') ? 3 : 0) + (upgrades.has('extra-moves-2') ? 3 : 0);
  const collectorCount = opts.collectedCount || 0;
  const bonusPeeks = upgrades.has('collector-peek') ? Math.floor(collectorCount / 10) : 0;

  return {
    levelIndex: level.index,
    level,
    seed,
    rng,
    deck,
    cardsTotal: deck.length,
    pairsTotal: level.pairs,
    pairsMatched: 0,
    quadsLeft: quadChars.length, // 需要两次配对/组
    movesLeft: level.moves + extraMoves,
    movesUsed: 0,
    combo: 0,
    bestCombo: 0,
    comboRefundActive: !!level.comboRefund || upgrades.has('combo-refund'),
    comboShield: upgrades.has('combo-shield') ? 1 : 0,
    peeksLeft: (opts.peeksLeft ?? RULES.peekPerRun) + bonusPeeks,
    peekRefillsUsed: 0,
    coinsEarned: 0,
    starPairsMatched: 0,
    misses: 0,
    missesSinceShuffle: 0,
    shuffleUsed: 0,
    phase: 'playing',            // playing | won | failed
    first: null,                 // 已翻开待配对那张的 id
    upgrades,
    events: [],
    startedAt: 0,
    elapsedMs: 0,
  };
}

/** 供 decorate 后的 run 调用；纯逻辑推进一步时间（毫秒）。 */
export function tickRun(run, dtMs) {
  if (run.phase !== 'playing') return [];
  run.elapsedMs += dtMs;
  return [];
}

/**
 * 翻一张牌。返回事件数组：
 * [{type:'flip'},{type:'match'},{type:'mismatch'},{type:'fail'},{type:'win'},{type:'shuffle'},{type:'obstacle'}]
 */
export function flipCard(run, cardId) {
  if (run.phase !== 'playing') return [];
  const card = run.deck[cardId];
  if (!card || card.state !== 'down') return [];
  const ev = (type, extra = {}) => run.events.push({ type, ...extra, at: run.elapsedMs });

  // 翻开
  card.state = 'up';
  ev('flip', { cardId, char: card.char });

  if (card.kind === 'obstacle') {
    // 障碍卡：耗步数、立刻盖回
    run.movesLeft -= 1;
    run.movesUsed += 1;
    ev('obstacle', { cardId });
    card.state = 'down';
    if (run.movesLeft < 0) {
      run.phase = 'failed';
      ev('fail', { movesUsed: run.movesUsed });
    }
    return drain(run);
  }

  if (run.first == null) {
    run.first = cardId;
    return drain(run);
  }

  // 第二张：结算
  const a = run.deck[run.first];
  run.first = null;
  run.movesLeft -= 1;
  run.movesUsed += 1;

  if (a.char === card.char) {
    // 配对（quads：同款任意两张）
    a.state = 'matched';
    card.state = 'matched';
    run.pairsMatched += 1;
    run.combo += 1;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    let coins = card.kind === 'star' || a.kind === 'star' ? RULES.coinPerPair + RULES.coinStarPairBonus : RULES.coinPerPair;
    if (card.kind === 'star' || a.kind === 'star') run.starPairsMatched += 1;
    run.coinsEarned += coins;
    ev('match', { char: card.char, combo: run.combo, coins, star: card.kind === 'star' || a.kind === 'star' });
    // 连击返还（规则级）
    if (run.comboRefundActive && run.combo >= RULES.comboRefundFrom) {
      run.movesLeft += 1;
      ev('combo_refund', { combo: run.combo });
    }
    if (run.pairsMatched >= run.pairsTotal) {
      run.phase = 'won';
      ev('win', { movesLeft: run.movesLeft, combo: run.bestCombo });
    }
    return drain(run);
  }

  // 误配
  run.misses += 1;
  run.missesSinceShuffle += 1;
  ev('mismatch', { a: a.id, b: card.id });
  a.state = 'down';
  card.state = 'down';
  if (run.comboShield > 0) {
    run.comboShield -= 1;   // 护盾保住连击
  } else {
    run.combo = 0;
  }

  // 幻影洗牌
  if (run.level.phantomShuffle && run.missesSinceShuffle >= RULES.shuffleEveryMisses) {
    run.missesSinceShuffle = 0;
    run.shuffleUsed += 1;
    const unmatched = run.deck.filter((c) => c.state === 'down');
    const chars = shuffleArray(unmatched.map((c) => ({ char: c.char, kind: c.kind, mirrored: c.mirrored })), run.rng);
    unmatched.forEach((c, i) => {
      c.char = chars[i].char;
      c.kind = chars[i].kind;
      c.mirrored = chars[i].mirrored;
    });
    ev('shuffle', { count: unmatched.length });
  }

  if (run.movesLeft < 0) {
    run.phase = 'failed';
    ev('fail', { movesUsed: run.movesUsed });
  }
  return drain(run);
}

/** 用提示翻开一对（不耗步数、标记为 peek 展示后盖回） */
export function peekPair(run) {
  if (run.phase !== 'playing' || run.peeksLeft <= 0) return [];
  const counts = new Map();
  for (const c of run.deck) {
    if (c.state === 'down' && c.kind !== 'obstacle') {
      if (!counts.has(c.char)) counts.set(c.char, []);
      counts.get(c.char).push(c.id);
    }
  }
  for (const [char, ids] of counts) {
    if (ids.length >= 2) {
      run.peeksLeft -= 1;
      run.events.push({ type: 'peek', chars: [ids[0], ids[1]], at: run.elapsedMs });
      return drain(run);
    }
  }
  return [];
}

/** 复活：+5 步（看广告成功后调用） */
export function revive(run, moves = RULES.reviveMoves) {
  if (run.phase !== 'failed') return false;
  run.phase = 'playing';
  run.movesLeft += moves + 1; // 失败判定发生在 -1 之后，补回
  run.events.push({ type: 'revive', moves: run.movesLeft, at: run.elapsedMs });
  return true;
}

/** 提示次数补充（看广告成功后调用，有每局上限） */
export function refillPeeks(run, n = RULES.peekRefill) {
  if (run.peekRefillsUsed >= RULES.peekMaxRefillPerRun) return false;
  run.peekRefillsUsed += 1;
  run.peeksLeft += n;
  run.events.push({ type: 'peek_refill', peeksLeft: run.peeksLeft, at: run.elapsedMs });
  return true;
}

export function starsFor(run) {
  if (run.phase !== 'won') return 0;
  const total = run.level.moves;
  const left = Math.max(0, run.movesLeft);
  if (left / total >= RULES.star3MovesRatio) return 3;
  if (left / total >= RULES.star2MovesRatio) return 2;
  return 1;
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}
const drain = drainEvents;

/** 供测试：给定完整翻牌序列模拟 */
export function playSequence(run, seq) {
  const evs = [];
  for (const id of seq) evs.push(...flipCard(run, id));
  return evs;
}

export function levelsCount() { return LEVELS.length; }
export function upgradeCost(id) { return UPGRADES.find((u) => u.id === id)?.cost ?? 0; }
