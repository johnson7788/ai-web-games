// MERGE 2048 · 12 关推进结构
// 每关：目标吨位（最高块达到即过关）+ 特性轮换（窄盘/障碍/只生成4/狂野8/镜像盘/引力井频率）
// 三场景包：近地轨道 orbit（深蓝）→ 小行星带 asteroid（灰橙）→ 星云深处 nebula（紫粉）
export const LEVELS = [
  { index: 1,  target: 32,   cols: 4, rows: 4, obstacles: 0, spawn: [2, 4],    mirror: false, gravityEvery: 0, decor: 'orbit',    name: 'level.name.1' },
  { index: 2,  target: 64,   cols: 4, rows: 4, obstacles: 0, spawn: [2, 4],    mirror: false, gravityEvery: 8, decor: 'orbit',    name: 'level.name.2' },
  { index: 3,  target: 128,  cols: 3, rows: 4, obstacles: 0, spawn: [2, 4],    mirror: false, gravityEvery: 8, decor: 'asteroid', name: 'level.name.3' },
  { index: 4,  target: 128,  cols: 4, rows: 4, obstacles: 4, spawn: [2, 4],    mirror: false, gravityEvery: 8, decor: 'asteroid', name: 'level.name.4' },
  { index: 5,  target: 256,  cols: 4, rows: 4, obstacles: 0, spawn: [4],       mirror: false, gravityEvery: 8, decor: 'asteroid', name: 'level.name.5' },
  { index: 6,  target: 256,  cols: 4, rows: 4, obstacles: 0, spawn: [2, 4, 8], mirror: false, gravityEvery: 8, decor: 'asteroid', name: 'level.name.6' },
  { index: 7,  target: 512,  cols: 4, rows: 4, obstacles: 0, spawn: [2, 4],    mirror: true,  gravityEvery: 8, decor: 'nebula',   name: 'level.name.7' },
  { index: 8,  target: 512,  cols: 4, rows: 4, obstacles: 6, spawn: [2, 4, 8], mirror: false, gravityEvery: 6, decor: 'nebula',   name: 'level.name.8' },
  { index: 9,  target: 1024, cols: 3, rows: 4, obstacles: 2, spawn: [2, 4],    mirror: false, gravityEvery: 6, decor: 'nebula',   name: 'level.name.9' },
  { index: 10, target: 1024, cols: 4, rows: 4, obstacles: 0, spawn: [2, 4, 8], mirror: false, gravityEvery: 5, decor: 'nebula',   name: 'level.name.10' },
  { index: 11, target: 2048, cols: 3, rows: 4, obstacles: 0, spawn: [4],       mirror: true,  gravityEvery: 6, decor: 'nebula',   name: 'level.name.11' },
  { index: 12, target: 2048, cols: 4, rows: 4, obstacles: 4, spawn: [2, 4, 8], mirror: false, gravityEvery: 4, decor: 'nebula',   name: 'level.name.12' },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index) {
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, (index || 1) - 1))];
}
