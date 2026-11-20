// MERGE 2048 · 数值配置（全部数值常量都在这，逻辑不写死数字）
// 玩法：4×4（或 3×4 窄盘）滑动合并；数字=殖民舰吨位；合并=舰队整编，值翻倍。
export const GRID = {
  COLS: 4,
  ROWS: 4,
};

export const STEP = 1 / 60;

// 每步新格生成（经典 2048：90% 出 2，10% 出 4）
export const SPAWN = {
  VALUES: [2, 4],
  FOUR_CHANCE: 0.1,
  START_TILES: 2,
};

// 引力井：每 N 步一个随机空格变成引力井，持续 DURATION 步；
// 滑进去的数字被锁定（不可移动、不可合并），直到引力井消失。
export const GRAVITY = {
  EVERY: 8,
  DURATION: 3,
};

// 跃迁引擎：每关 1 次把任意两个同值格强制合并
export const WARP = {
  PER_LEVEL: 1,
};

// 每一有效步推进的「游戏时间」（无头遥测 / 事件密度用）
export const MOVE_SEC = 0.22;

// 里程碑建筑（吨位档位 → 解锁殖民建筑）
export const BUILDINGS = [
  { value: 128, key: 'unlock.greenhouse' },
  { value: 256, key: 'unlock.mine' },
  { value: 512, key: 'unlock.station' },
  { value: 1024, key: 'unlock.stargate' },
  { value: 2048, key: 'unlock.warpdrive' },
];

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
