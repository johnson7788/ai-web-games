// 12 关数据（config-first）。三场景包：1-4 糖果丘（粉）/ 5-8 云端（白蓝）/ 9-12 夜林（紫绿）。
// 每关 3 颗星收集物 + 金币 + 敌人（行为树巡逻/追击）+ 机关轮换（移动平台/弹簧/尖刺/风向/暗段）。
// 关卡 1-3 对 greedy bot 友好：纯「向右跑 + 遇隙跳」可过关。
import { P, ENEMY } from './gameplay.js';

export const PACKS = { 1: 'candy', 2: 'cloud', 3: 'night' };

export const GROUND_Y = 600;
const PH = P.H;

function build(o) {
  const gaps = (o.gaps || []).slice().sort((a, b) => a[0] - b[0]);
  const ground = [];
  let cx = 0;
  for (const [gx, gw] of gaps) {
    if (gx > cx) ground.push({ x: cx, y: GROUND_Y, w: gx - cx, h: 160 });
    cx = gx + gw;
  }
  if (cx < o.width) ground.push({ x: cx, y: GROUND_Y, w: o.width - cx, h: 160 });

  const platforms = [];
  for (const p of (o.plat || [])) {
    const [x, y, w, type = 'oneway', extra = {}] = p;
    platforms.push({ x, y, w, h: type === 'spike' ? 16 : 22, type, oneway: type === 'oneway', solid: type !== 'spike', ...extra });
  }

  const enemies = (o.enemies || []).map(([x, lo, hi, speed]) => ({
    x, y: GROUND_Y - ENEMY.H, w: ENEMY.W, h: ENEMY.H,
    lo, hi, speed: speed ?? ENEMY.PATROL_SPEED,
    dir: -1, state: 'patrol', vx: 0, hp: 1, squash: 0,
  }));

  const spawn = o.spawn || { x: 80, y: GROUND_Y - PH };
  return {
    index: o.index,
    pack: o.pack,
    nameKey: o.nameKey || `level.${o.index}`,
    width: o.width,
    spawn,
    respawn: o.respawn || { x: spawn.x, y: spawn.y },
    goal: o.goal,
    ground,
    platforms,
    enemies,
    coins: (o.coins || []).map(([x, y]) => ({ x, y })),
    stars: (o.stars || []).map(([x, y]) => ({ x, y })),
    wind: o.wind || null,
    dark: !!o.dark,
  };
}

export const LEVELS = [
  // 1 — 糖果丘：教跑/跳/收集，敌人巡逻（会巡过出生点，noinput 基线会死）
  build({
    index: 1, pack: 1, width: 3200,
    gaps: [[900, 82], [1840, 92]],
    plat: [[1240, 440, 128, 'oneway']],
    enemies: [[300, 120, 620]],
    coins: [[360, 560], [460, 560], [560, 560], [660, 560], [1080, 470], [1240, 410], [1560, 560], [2100, 560], [2300, 560], [2500, 560]],
    stars: [[700, 560], [1240, 402], [2560, 560]],
    goal: { x: 3050, y: 560 },
  }),
  // 2 — 糖果丘：更宽间隙 + 上层平台
  build({
    index: 2, pack: 1, width: 3400,
    gaps: [[760, 90], [1560, 92], [2380, 100]],
    plat: [[1150, 460, 130, 'oneway'], [2000, 400, 130, 'oneway']],
    enemies: [[700, 420, 1160], [2050, 1700, 2450]],
    coins: [[420, 560], [520, 560], [940, 560], [1150, 428], [1800, 560], [2000, 368], [2700, 560], [2900, 560]],
    stars: [[620, 560], [2000, 362], [3000, 560]],
    goal: { x: 3250, y: 560 },
  }),
  // 3 — 糖果丘：多隙 + 双敌（greedy 须过到第 3 关）
  build({
    index: 3, pack: 1, width: 3600,
    gaps: [[680, 95], [1420, 95], [2140, 105], [2920, 95]],
    plat: [[1060, 450, 140, 'oneway'], [2500, 430, 140, 'oneway']],
    enemies: [[560, 320, 900], [2350, 2000, 2600]],
    coins: [[360, 560], [820, 560], [1060, 418], [1660, 560], [1880, 560], [2500, 398], [2760, 560], [3160, 560]],
    stars: [[880, 560], [2500, 392], [3260, 560]],
    goal: { x: 3450, y: 560 },
  }),
  // 4 — 糖果丘：移动平台（关末宽隙需乘平台）
  build({
    index: 4, pack: 1, width: 3600,
    gaps: [[900, 90], [2000, 190]],
    plat: [[1300, 460, 120, 'oneway'], [2040, 470, 130, 'moving', { vx: 110, minX: 2000, maxX: 2360 }]],
    enemies: [[700, 420, 1300], [2500, 2280, 2800]],
    coins: [[400, 560], [620, 560], [1300, 428], [2600, 560], [2900, 560]],
    stars: [[560, 560], [1300, 420], [3000, 560]],
    goal: { x: 3450, y: 560 },
  }),
  // 5 — 云端：白蓝场景包 + 移动平台阵
  build({
    index: 5, pack: 2, width: 3800,
    gaps: [[820, 90], [1700, 170]],
    plat: [[1100, 470, 120, 'moving', { vx: 100, minX: 1060, maxX: 1420 }], [1560, 420, 44, 'solid', { h: 180 }], [1750, 460, 120, 'moving', { vx: -90, minX: 1750, maxX: 2080 }], [2400, 430, 130, 'oneway']],
    enemies: [[760, 480, 1400], [2600, 2300, 2900]],
    coins: [[420, 560], [620, 560], [2400, 398], [3000, 560]],
    stars: [[640, 560], [1750, 424], [3200, 560]],
    goal: { x: 3650, y: 560 },
  }),
  // 6 — 云端：弹簧（Spring 高跳上高台）
  build({
    index: 6, pack: 2, width: 3800,
    gaps: [[780, 88], [1500, 92], [2280, 100]],
    plat: [[980, 470, 120, 'oneway'], [1540, 400, 60, 'spring'], [2300, 430, 130, 'oneway']],
    enemies: [[680, 420, 1300], [2600, 2400, 2900]],
    coins: [[420, 560], [940, 560], [1540, 380], [2050, 560], [3000, 560]],
    stars: [[600, 560], [1540, 360], [3200, 560]],
    goal: { x: 3650, y: 560 },
  }),
  // 7 — 云端：风向（顺风/逆风）
  build({
    index: 7, pack: 2, width: 3900,
    gaps: [[900, 95], [1900, 96]],
    plat: [[1250, 460, 130, 'oneway'], [2350, 440, 130, 'oneway']],
    enemies: [[820, 500, 1500], [2700, 2400, 3000]],
    coins: [[420, 560], [1250, 428], [2350, 408], [3100, 560]],
    stars: [[700, 560], [1250, 420], [3300, 560]],
    wind: { x0: 1500, x1: 2400, dir: 1 },
    goal: { x: 3750, y: 560 },
  }),
  // 8 — 云端：弹簧 + 移动平台组合
  build({
    index: 8, pack: 2, width: 4000,
    gaps: [[850, 90], [1750, 180]],
    plat: [[1180, 470, 120, 'moving', { vx: 110, minX: 1140, maxX: 1500 }], [1800, 400, 60, 'spring'], [2600, 440, 130, 'oneway']],
    enemies: [[760, 460, 1500], [2800, 2500, 3100]],
    coins: [[420, 560], [660, 560], [2600, 408], [3200, 560]],
    stars: [[680, 560], [1800, 360], [3400, 560]],
    goal: { x: 3850, y: 560 },
  }),
  // 9 — 夜林：尖刺阵（spike 平台）
  build({
    index: 9, pack: 3, width: 4000,
    gaps: [[880, 92], [1820, 96]],
    plat: [[1240, 592, 120, 'spike'], [2100, 450, 130, 'oneway'], [2480, 592, 120, 'spike']],
    enemies: [[800, 500, 1500], [2700, 2400, 3000]],
    coins: [[420, 560], [1500, 560], [2100, 418], [3000, 560]],
    stars: [[700, 560], [2100, 410], [3300, 560]],
    goal: { x: 3850, y: 560 },
  }),
  // 10 — 夜林：暗段（视野收窄）
  build({
    index: 10, pack: 3, width: 4100,
    gaps: [[900, 90], [1900, 96]],
    plat: [[1280, 450, 130, 'oneway'], [2400, 440, 130, 'oneway']],
    enemies: [[820, 500, 1500], [2800, 2500, 3100]],
    coins: [[420, 560], [1280, 418], [2400, 408], [3200, 560]],
    stars: [[700, 560], [1280, 410], [3400, 560]],
    dark: true,
    goal: { x: 3950, y: 560 },
  }),
  // 11 — 夜林：暗段 + 风向
  build({
    index: 11, pack: 3, width: 4200,
    gaps: [[860, 92], [1840, 98]],
    plat: [[1220, 450, 130, 'oneway'], [2340, 440, 130, 'oneway']],
    enemies: [[800, 500, 1500], [2700, 2400, 3000]],
    coins: [[420, 560], [1220, 418], [2340, 408], [3100, 560]],
    stars: [[700, 560], [1220, 410], [3400, 560]],
    wind: { x0: 1600, x1: 2500, dir: -1 },
    dark: true,
    goal: { x: 4050, y: 560 },
  }),
  // 12 — 夜林终章：暗段 + 尖刺 + 移动平台
  build({
    index: 12, pack: 3, width: 4400,
    gaps: [[900, 92], [1900, 190]],
    plat: [[1300, 592, 120, 'spike'], [1980, 460, 120, 'moving', { vx: 110, minX: 1940, maxX: 2320 }], [2700, 592, 120, 'spike'], [3100, 440, 130, 'oneway']],
    enemies: [[820, 500, 1500], [2800, 2500, 3100], [3600, 3300, 3900]],
    coins: [[420, 560], [1500, 560], [2600, 560], [3100, 408], [3500, 560]],
    stars: [[700, 560], [1980, 424], [3600, 560]],
    dark: true,
    goal: { x: 4250, y: 560 },
  }),
];

export function levelAt(i) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i - 1))];
}

export function packOf(i) {
  const lv = levelAt(i);
  return PACKS[lv.pack] || 'candy';
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
