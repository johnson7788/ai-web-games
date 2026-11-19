// 关卡定义：程序化生成（种子确定），每关土壤/岩石/宝石/终点布局固定。
// 设计原则：
//   - 起点口袋在顶部、终点门在底部，钻头球靠重力坠落。
//   - 岩石避开中央竖直走廊（保证 greedy 直挖可通关），但围在两侧逼人类玩家绕路。
//   - 宝石分「走廊内」（直挖顺路拿）与「岩石旁」（绕路换高分/星级）。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genLevel(idx) {
  const rng = mulberry32(1013 + idx * 977);
  const cfg = [
    { time: 60, rocks: 1, gems: 3, onPath: 2, name: 'First Drill' },
    { time: 75, rocks: 2, gems: 4, onPath: 2, name: 'Gem Vein' },
    { time: 90, rocks: 3, gems: 5, onPath: 3, name: 'Rock Maze' },
    { time: 90, rocks: 4, gems: 6, onPath: 3, name: 'Deep Core' },
  ][idx];

  const startX = 640;
  const startY = 120;
  const goalX = 640;
  const goalY = 604;

  const rocks = [];
  const gems = [];

  // 走廊内宝石：钻头球直落顺路可拿
  for (let i = 0; i < cfg.onPath; i += 1) {
    gems.push({ x: 640 + (rng() * 2 - 1) * 24, y: 250 + i * 118 });
  }
  // 走廊外宝石：藏在岩石旁，诱惑绕路
  for (let i = 0; i < cfg.gems - cfg.onPath; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    gems.push({ x: 640 + side * (270 + rng() * 180), y: 240 + rng() * 320 });
  }
  // 岩石：避开中央走廊（|x-640|<140 不放），夹在两侧
  for (let i = 0; i < cfg.rocks; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = 640 + side * (210 + rng() * 230);
    const y = 200 + rng() * 370;
    const r = 26 + rng() * 22;
    rocks.push({ x, y, r });
  }

  return {
    index: idx,
    time: cfg.time,
    name: cfg.name,
    startX,
    startY,
    goalX,
    goalY,
    rocks,
    gems,
  };
}

export const LEVELS = [0, 1, 2, 3].map(genLevel);

export function getLevel(index) {
  return LEVELS[((index % LEVELS.length) + LEVELS.length) % LEVELS.length];
}
