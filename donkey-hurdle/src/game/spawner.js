// src/game/spawner.js — 障碍生成（纯逻辑，零依赖）
// 依据当前段的障碍轮换 types 挑一个；'double' 展开成两个紧邻矮栏。
import { OBSTACLE, SPAWN, clamp } from '../../config/gameplay.js';
import { pick, randInt } from './rng.js';

export function pickType(segment, rng, difficulty) {
  const types = segment.types;
  // 难度升高时更倾向难障碍（rock/high/pit），但至少保留一个简单类型。
  if (difficulty > 0.55 && types.includes('rock') && rng() < 0.22) return 'rock';
  if (difficulty > 0.4 && types.includes('high') && rng() < 0.2) return 'high';
  return pick(rng, types);
}

export function makeObstacle(type, worldX) {
  if (type === 'double') {
    const a = makeObstacle('low', worldX);
    const b = makeObstacle('low', worldX + OBSTACLE.DOUBLE_GAP);
    return [a, b];
  }
  const def = OBSTACLE[type.toUpperCase()] || OBSTACLE.LOW;
  return {
    type,
    worldX,
    w: def.w,
    h: def.h,
    extraSpeed: def.extraSpeed || 1,
    cleared: false,
    hit: false,
    minClearance: Infinity,
  };
}

export function nextGap(rng, difficulty) {
  // 难度越高间距越紧（节奏越快），但保留反应时间下限。
  const base = SPAWN.MIN_GAP + (SPAWN.MAX_GAP - SPAWN.MIN_GAP) * (1 - difficulty * 0.5);
  const jitter = randInt(rng, -40, 40);
  return clamp(base + jitter, SPAWN.MIN_GAP, SPAWN.MAX_GAP);
}
