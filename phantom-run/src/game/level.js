// PHANTOM RUN · 关卡辅助（M1 拥有，可选文件）
// 职责：关卡数据完整性校验 + 「完美跳跃」通关可行性（greedy 同款策略的纯逻辑版）。
// 供 tests/levels.test.mjs 与 tools/selfplay.mjs 复用；零 DOM 依赖。

import { PLAYER } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { createRun } from './sim.js';

// 主地面高度（required path 全部在此高度）
export const MAIN_Y = 600;

function currentGround(state) {
  const p = state.player;
  for (const pl of state.platforms) {
    if (pl.kind !== 'ground' || pl.y !== MAIN_Y) continue;
    if (p.x >= pl.x - 1 && p.x <= pl.x + pl.w) return pl;
  }
  return null;
}

// 返回当前地面段上、玩家前方的最近「需要起跳」点（间隙边缘或尖刺左缘）。
export function nextTrigger(state) {
  const p = state.player;
  const g = currentGround(state);
  if (!g) return null;
  const right = g.x + g.w;
  let trigger = null;
  for (const sp of state.spikes) {
    if (sp.x > p.x + 1 && sp.x <= right) {
      if (trigger == null || sp.x < trigger) trigger = sp.x;
    }
  }
  const continues = state.platforms.some((o) => o.kind === 'ground' && o.y === MAIN_Y && Math.abs(o.x - right) < 3);
  const gapEdge = continues ? null : right;
  if (gapEdge != null && (trigger == null || gapEdge < trigger)) trigger = gapEdge;
  return trigger;
}

export function shouldJump(state) {
  const p = state.player;
  if (!p.onGround) return false;
  const trigger = nextTrigger(state);
  if (trigger == null) return false;
  return p.x + PLAYER.W >= trigger - 12;
}

// 用「完美跳跃」驱动一局到终局，返回是否通关（不 bunny-hop，纯必要跳跃）。
export function isClearable(levelIndex) {
  const run = createRun(levelIndex, { seed: 1 });
  let guard = 20000;
  while (guard-- > 0 && run.state.phase === 'running') {
    run.step({ jump: shouldJump(run.state) });
  }
  return run.state.phase === 'won';
}

// 关卡结构完整性校验（供 tests 用），返回问题数组。
export function validateLevel(lv) {
  const problems = [];
  if (!lv || lv.index < 1) problems.push('index 缺失');
  if (!['dusk-tower', 'moon-market', 'dawn-wall'].includes(lv.scene)) problems.push(`scene 非法: ${lv.scene}`);
  if (!(lv.speed > 0)) problems.push('speed 非正');
  if (!(lv.finishX > 0)) problems.push('finishX 非正');
  if (!Array.isArray(lv.platforms) || lv.platforms.length < 2) problems.push('platforms 过少');
  if (!Array.isArray(lv.spikes) || !Array.isArray(lv.walls) || !Array.isArray(lv.moons) || !Array.isArray(lv.stars)) {
    problems.push('spikes/walls/moons/stars 必须为数组');
  }
  // 平台字段合法
  for (const p of lv.platforms) {
    if (!(p.w > 0) || !(p.h > 0)) problems.push(`平台宽高非法 @x=${p.x}`);
    if (!['ground', 'rune', 'collapse', 'moving'].includes(p.kind)) problems.push(`平台 kind 非法: ${p.kind}`);
    if ((p.kind === 'rune' || p.kind === 'collapse') && !['solid', 'phantom'].includes(p.state)) {
      problems.push(`rune/collapse state 非法 @x=${p.x}`);
    }
  }
  // 起跳点须在终点之前，且终点在最后地面段上
  const lastGround = lv.platforms.filter((p) => p.kind === 'ground').reduce((m, p) => (p.x + p.w > m ? p.x + p.w : m), 0);
  if (lv.finishX > lastGround) problems.push(`finishX(${lv.finishX}) 超出最后地面(${lastGround})`);
  // 墙必须有对应的月光斑（在墙之前 ≤300px）
  for (const w of lv.walls) {
    const hasMoon = lv.moons.some((m) => m.x < w.x && w.x - m.x <= 300);
    if (!hasMoon) problems.push(`符文墙 @x=${w.x} 之前缺少月光斑`);
  }
  return problems;
}

export { LEVELS, LEVEL_COUNT };
