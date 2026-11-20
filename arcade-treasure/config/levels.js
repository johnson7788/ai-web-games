// config/levels.js — 12 段厅段位推进结构（每段三台目标分 + 每段新元素）。
// 与 config/gameplay.js 的 RANKS 一致；这里是可读的推进表 + 每段「新元素」描述。
import { RANKS } from './gameplay.js';

export function rankTarget(rank, machine) {
  const r = Math.max(0, Math.min(RANKS.COUNT - 1, Math.round(rank) - 1));
  return Math.round(RANKS.BASE_TARGET[machine] * Math.pow(RANKS.GROWTH, r));
}

// 每段新元素（教-练-变-收节奏，按段推进）
export const RANK_NEW = [
  'machine.1',   // 段 1
  'machine.2',
  'machine.3',
  'machine.4',
  'machine.5',
  'machine.6',
  'machine.7',
  'machine.8',
  'machine.9',
  'machine.10',
  'machine.11',
  'machine.12',
];

export const RANKS_LIST = Array.from({ length: RANKS.COUNT }, (_, i) => ({
  index: i + 1,
  targets: [rankTarget(i + 1, 0), rankTarget(i + 1, 1), rankTarget(i + 1, 2)],
  newElementKey: RANK_NEW[i],
}));

export const RANK_COUNT = RANKS.COUNT;
