// COLOR PIPES FLOW · 关卡数据（由 src/game/level.js 确定性生成，种子固定可复现）
// 字段：index/rows/cols/rocks/pairs/colorCount/emptyCount/par/moveLimit/hints。
// 坐标约定：[r, c]，r=行(0..rows-1)，c=列(0..cols-1)。
import { buildLevels } from '../src/game/level.js';

export const LEVELS = buildLevels();
export const LEVEL_COUNT = LEVELS.length;
