// IDLE FORGE · 关卡辅助（纯逻辑，零依赖）
// 职责：关卡完整性校验（目标/产量为正、4 品类齐全、12 关唯一、mechanic 合法）。
// 供 tests/levels.test.mjs 与 tools/selfplay.mjs 使用。

import { LEVELS, LEVEL_COUNT, SCENES } from '../../config/levels.js';

export function tierOf(levelIndex) {
  const lv = LEVELS[levelIndex] ?? LEVELS[0];
  return lv.tier;
}

export function levelByIndex(i) {
  return LEVELS[i] ?? null;
}

export function levelIsValid(level) {
  if (!level || !Number.isFinite(level.index)) return false;
  if (!Number.isFinite(level.target) || level.target <= 0) return false;
  if (!Number.isFinite(level.yield) || level.yield <= 0) return false;
  if (!SCENES.includes(level.scene)) return false;
  if (!level.name || !level.name.en || !level.name.zh) return false;
  if (!level.tierName || !level.tierName.en || !level.tierName.zh) return false;
  return true;
}

export function allLevelsValid() {
  return LEVELS.every(levelIsValid) && LEVEL_COUNT === LEVELS.length;
}

export function tierCoverage() {
  const tiers = new Set(LEVELS.map((l) => l.tier));
  return [...tiers].sort((a, b) => a - b);
}

export function mechanicsValid() {
  const allowed = [null, 'shortage', 'furnace', 'vein', 'strike', 'order', 'all'];
  return LEVELS.every((l) => allowed.includes(l.mechanic));
}
