// Depth Diver · 关卡辅助（纯逻辑，零依赖）
// 职责：关卡表完整性校验、可通行航迹推算（保证每波危险至少留一条 gap 航迹）。

import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

// 关卡表自检：12 关、index 连续、字段类型合法、危险封锁数合法。
export function validateLevels() {
  const problems = [];
  if (LEVEL_COUNT !== 12) problems.push(`LEVEL_COUNT=${LEVEL_COUNT}`);
  LEVELS.forEach((lv, i) => {
    if (lv.index !== i + 1) problems.push(`L${i + 1} index=${lv.index}`);
    if (!['sunlit', 'twilight', 'abyss'].includes(lv.scene)) problems.push(`L${lv.index} 场景非法`);
    if (!(lv.depthTarget > 0)) problems.push(`L${lv.index} depthTarget<=0`);
    if (!(lv.oxygen > 0)) problems.push(`L${lv.index} oxygen<=0`);
    if (!(lv.sampleTotal >= 3)) problems.push(`L${lv.index} sampleTotal<3`);
    if (!(lv.lightRadius > 0)) problems.push(`L${lv.index} lightRadius<=0`);
    if (!(lv.diveSpeed > 0)) problems.push(`L${lv.index} diveSpeed<=0`);
    if (!(lv.spawnGap > 0)) problems.push(`L${lv.index} spawnGap<=0`);
    if (!['rock', 'mine', 'mix'].includes(lv.hazard)) problems.push(`L${lv.index} hazard 非法`);
    if (!(lv.maxBlocked >= 1 && lv.maxBlocked <= GAME.LANE_X.length - 1)) problems.push(`L${lv.index} maxBlocked 越界`);
    if (typeof lv.newElement !== 'string' || !lv.newElement.trim()) problems.push(`L${lv.index} 缺 newElement`);
  });
  return problems;
}

// 每波封锁 numBlocked 条相邻航迹时，至少保证有一条可通行 gap 航迹。
export function minFreeLanes(level) {
  return Math.max(1, GAME.LANE_X.length - level.maxBlocked);
}

export { LEVELS, LEVEL_COUNT };
