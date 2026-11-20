// 福州麻将核心判定：胡牌 / 听牌 / 吃碰杠选项（规则算法，P0 1:1 复刻源码）
// 注意：与源码一致，风箭（字牌）不参与胡牌面子的判定——胡型只看序数牌 + 金（万能牌）。
import { WIN } from '../../config/game.config.js';

// 按花色分组：0=金，1=筒，2=万，3=条，4=风箭（不参与胡牌判定）
function groupMah(tiles, joker) {
  const groups = { 0: [], 1: [], 2: [], 3: [] };
  for (const num of tiles) {
    const g = num === joker ? 0 : Math.floor(num / 10);
    (groups[g] || (groups[g] = [])).push(num);
  }
  for (let i = 0; i < 4; i += 1) if (!groups[i]) groups[i] = [];
  return groups;
}

// 判断某花色能否全部组成面子，返回剩余散牌（已排序输入）
function checkMeld(tiles) {
  if (!tiles) return [];
  let theRest = [];
  let arr = tiles.slice();
  while (arr.length >= 3) {
    let meld = false;
    let skip = false;
    if (arr[0] === arr[1] && arr[1] !== arr[2]) {
      theRest.push(arr[0]);
      arr.splice(0, 1);
    } else if (arr[0] === arr[1] - 1 && arr[1] === arr[2] - 1) {
      meld = true;
    } else if (arr[0] === arr[1] - 1 && arr.length > 3 && arr[1] === arr[3] - 1) {
      arr.splice(3, 1);
      arr = arr.slice(2);
      skip = true;
    } else if (arr[0] === arr[1] - 1 && arr.length > 3 && arr[1] === arr[4] - 1) {
      arr.splice(4, 1);
      arr = arr.slice(2);
      skip = true;
    } else if (arr[0] === arr[1] && arr[1] === arr[2]) {
      meld = true;
    }
    if (meld) {
      arr = arr.slice(3);
    } else if (!skip) {
      theRest.push(arr[0]);
      arr = arr.slice(1);
    }
  }
  if (arr.length > 0) theRest = theRest.concat(arr);
  return theRest;
}

function countPair(tiles) {
  let arr = tiles.slice();
  let count = 0;
  while (arr.length >= 2) {
    if (arr[0] === arr[1]) {
      count += 1;
      arr = arr.slice(2);
    } else {
      arr = arr.slice(1);
    }
  }
  return count;
}

function checkSeq2(v1, v2) {
  return v1 === v2 - 1 || v1 === v2 - 2;
}

/**
 * 是否能胡。
 * @param {number[]} tiles 手牌（含/不含要判定的牌）
 * @param {number} joker 金
 * @returns {number} WIN.NONE / WIN.PINGHU / WIN.JINQUE / WIN.THREEJIN
 */
export function canWin(tiles, joker) {
  const sorted = tiles.slice().sort((a, b) => a - b);
  const groups = groupMah(sorted, joker);
  const jokers = groups[0];

  // 三头金：三张金及以上
  if (jokers.length >= 3) return WIN.THREEJIN;

  const theRests = [];
  for (let i = 1; i <= 3; i += 1) theRests.push(checkMeld(groups[i]));

  const allPass = theRests.every((arr) => arr.length === 0);

  if (allPass && jokers.length < 2) return WIN.NONE;
  // 金雀：全成组且恰有两金
  if (allPass && jokers.length === 2) return WIN.JINQUE;

  let restCount = 0;
  for (let i = 0; i < theRests.length; i += 1) restCount += theRests[i].length;
  const jokerCount = jokers.length;

  if (jokerCount === 0) {
    if (restCount > 2) return WIN.NONE;
    for (let i = 0; i < theRests.length; i += 1) {
      const theRest = theRests[i];
      if (theRest.length >= 2 && theRest[0] === theRest[1]) return WIN.PINGHU;
    }
    return WIN.NONE;
  }

  if (jokerCount === 1) {
    if (restCount > 4) return WIN.NONE;
    const cond1 = theRests.filter((arr) => arr.length === 1);
    if (cond1.length === 1 && restCount === 1) return WIN.PINGHU;

    let pairCount = 0;
    for (let i = 0; i < theRests.length; i += 1) {
      const theRest = theRests[i];
      if (theRest.length >= 2) pairCount += countPair(theRest);
    }
    if (pairCount === 2) return WIN.PINGHU;
    if (pairCount === 1) {
      for (let i = 0; i < theRests.length; i += 1) {
        const theRest = theRests[i];
        if (theRest.length === 2 && theRest[0] === theRest[1] - 1) return WIN.PINGHU;
        else if (theRest.length === 4 && checkSeq2(theRest[0], theRest[1])) return WIN.PINGHU;
        else if (theRest.length === 4 && checkSeq2(theRest[2], theRest[3])) return WIN.PINGHU;
      }
    }
    return WIN.NONE;
  }

  if (jokerCount === 2) {
    if (restCount > 6) return WIN.NONE;
    if (restCount === 3) {
      for (let i = 0; i < theRests.length; i += 1) {
        const theRest = theRests[i];
        if (theRest.length >= 2 && theRest[0] === theRest[1]) return WIN.PINGHU;
        else if (theRest.length >= 2 && theRest[1] === theRest[2]) return WIN.PINGHU;
        else if (theRest.length >= 2 && checkSeq2(theRest[0], theRest[1])) return WIN.PINGHU;
        else if (theRest.length >= 2 && checkSeq2(theRest[1], theRest[2])) return WIN.PINGHU;
      }
    } else if (restCount === 6) {
      let pairCount = 0;
      for (let i = 0; i < theRests.length; i += 1) {
        const theRest = theRests[i];
        if (theRest.length === 3) return WIN.NONE;
        if (theRest.length >= 2) pairCount += countPair(theRest);
      }
      if (pairCount === 3) return WIN.PINGHU;
      if (pairCount === 2) {
        for (let i = 0; i < theRests.length; i += 1) {
          const theRest = theRests[i];
          if (theRest.length === 2 && checkSeq2(theRest[0], theRest[1])) return WIN.PINGHU;
        }
      } else if (pairCount === 1) {
        let seqCount = 0;
        for (let i = 0; i < theRests.length; i += 1) {
          const theRest = theRests[i];
          if (theRest.length === 2 && checkSeq2(theRest[0], theRest[1])) seqCount += 1;
          else if (theRest.length === 4) {
            if (checkSeq2(theRest[0], theRest[1])) seqCount += 1;
            if (checkSeq2(theRest[2], theRest[3])) seqCount += 1;
          }
        }
        if (seqCount >= 2) return WIN.PINGHU;
      }
    }
  }

  return WIN.NONE;
}

/**
 * 听牌列表：摸到这些牌就能胡。
 */
export function getListen(tiles, joker) {
  const listen = [];
  const order = [];
  for (let i = 0; i < 9; i += 1) order.push(31 + i); // 条
  for (let i = 0; i < 9; i += 1) order.push(11 + i); // 筒
  for (let i = 0; i < 9; i += 1) order.push(21 + i); // 万
  for (const tile of order) {
    if (tile !== joker && canWin(tiles.concat(tile), joker) > WIN.NONE) listen.push(tile);
  }
  return listen;
}

function countOf(tiles, tileId) {
  return tiles.filter((t) => t === tileId).length;
}

/** 吃牌选项：含弃牌且不含金的顺子组合 */
export function getEatOptions(tiles, tileId, joker) {
  const options = [];
  const src = tiles.slice();
  src.push(tileId);
  const cnt = new Map();
  for (const t of src) cnt.set(t, (cnt.get(t) || 0) + 1);
  for (let i = 0; i < 3; i += 1) {
    const seq = [tileId - 2 + i, tileId - 1 + i, tileId + i];
    if (seq.includes(joker)) continue;
    if (seq.every((t) => (cnt.get(t) || 0) >= 1)) options.push(seq);
  }
  return options;
}

/** 碰牌数组：手牌有 ≥2 张同牌时返回 3 张 */
export function getPongArray(tiles, tileId) {
  return countOf(tiles, tileId) >= 2 ? [tileId, tileId, tileId] : [];
}

/** 杠牌选项：kongType 1=明杠（手 3+弃 1），2=暗杠（手 4） */
export function getKongOptions(tiles, kongType, tileId) {
  if (kongType === 2) {
    const opts = [];
    const seen = new Set();
    for (const t of tiles) {
      if (seen.has(t)) continue;
      seen.add(t);
      if (countOf(tiles, t) >= 4) opts.push({ kongType: 2, options: [t, t, t, t] });
    }
    return opts;
  }
  if (countOf(tiles, tileId) >= 3) {
    return [{ kongType: 1, options: [tileId, tileId, tileId, tileId] }];
  }
  return [];
}
