// 关卡生成（确定性）：30 关，速度 6→14，含 rotate / random 视觉挑战与星尘/岩石布点。
// 结构沿用参考玩法事实：list = [{num: 长度, str: 方向}]，方向取 top/bottom/left/right。
import { mulberry32 } from '../src/game/rng.js';

const DIRS = ['top', 'bottom', 'left', 'right'];
const OPP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function pickTurn(rng, prev) {
  const avoid = new Set([prev, OPP[prev]]);
  const preferred = DIRS.filter((d) => !avoid.has(d));
  const fallback = DIRS.filter((d) => d !== prev);
  const pool = preferred.length ? preferred : fallback;
  return pool[Math.floor(rng() * pool.length)];
}

function genLevel(index) {
  const rng = mulberry32(((index + 1) * 2654435761) >>> 0 || 1);
  const speed = 6 + Math.round((index / 29) * 8);          // 6..14
  const rotate = index % 4 === 1;                           // 拐角相机旋转
  const random = index % 4 === 3;                           // 随机旋转
  const segCount = 9 + (index % 5);                         // 9..13 段

  const list = [];
  let dir = 'top';
  list.push({ num: 500 + Math.floor(rng() * 260), str: dir }); // 首段 500–759
  for (let i = 1; i < segCount; i += 1) {
    dir = pickTurn(rng, dir);
    const span = index >= 10 ? 520 : 300;
    list.push({ num: 420 + Math.floor(rng() * span), str: dir });
  }

  // 星尘：4–6 颗，落在段落 20%–80% 处
  const orbTotal = 4 + Math.floor(rng() * 3);
  const orbs = [];
  const orbSeen = new Set();
  for (let i = 0; i < orbTotal; i += 1) {
    const seg = Math.floor(rng() * list.length);
    const len = list[seg].num;
    const d = Math.round(len * (0.2 + rng() * 0.6));
    const key = `${seg}:${d}`;
    if (orbSeen.has(key)) { i -= 1; continue; }
    orbSeen.add(key);
    orbs.push({ seg, d });
  }

  // 岩石：第 3 关起，1–3 块，落在长段落 30%–70% 处（远离拐角，避开星尘主区）
  const rocks = [];
  if (index >= 2) {
    const rockTotal = Math.min(3, 1 + (index >= 12 ? 1 : 0) + Math.floor(rng() * 2));
    const longSegs = list.map((s, si) => ({ si, len: s.num })).filter((s) => s.len >= 520);
    const used = new Set();
    for (let i = 0; i < rockTotal && longSegs.length; i += 1) {
      const pick = Math.floor(rng() * longSegs.length);
      const { si, len } = longSegs.splice(pick, 1)[0];
      const d = Math.round(len * (0.3 + rng() * 0.4));
      used.add(si);
      rocks.push({ seg: si, d });
    }
  }

  return { index, speed, rotate, random, list, orbs, rocks };
}

export const LEVELS = [];
for (let i = 0; i < 30; i += 1) LEVELS.push(genLevel(i));
export const LEVEL_COUNT = LEVELS.length;
