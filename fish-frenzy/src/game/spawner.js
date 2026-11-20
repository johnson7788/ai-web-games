// FISH FRENZY · M1 生成器：鱼群按路径表编队游动（单游/编队/横穿/拐弯）+ Boss。
// 纯逻辑：所有随机来自传入的 mulberry32 rng，同 seed 同结果。
// 鱼沿折线匀速游动 + 正弦摆动；路径由 config/paths.js 提供。

import { PATHS, pathById } from '../../config/paths.js';
import { fishById, BOSS_FISH_ID } from '../../config/fishes.js';
import { WORLD, SPAWN, FISH_MOVE } from '../../config/gameplay.js';
import { randInt, pick, pickWeighted } from './rng.js';

// 沿折线移动到下一目标点；返回是否到达终点（离场）
export function stepFish(fish, dt) {
  const path = fish.path;
  if (!path || fish.seg >= path.length - 1) return true;
  const tx = path[fish.seg + 1][0];
  const ty = path[fish.seg + 1][1];
  const dx = tx - fish.x;
  const dy = ty - fish.y;
  const d = Math.hypot(dx, dy);
  const step = fish.speed * dt;
  if (d <= step) {
    fish.x = tx;
    fish.y = ty;
    fish.seg += 1;
    return fish.seg >= path.length - 1 && d <= step;
  }
  fish.x += (dx / d) * step;
  fish.y += (dy / d) * step;
  fish.travel += step;
  // 正弦摆动（横向偏移，让鱼群不僵硬）
  fish.sway = Math.sin(fish.travel * FISH_MOVE.SWAY_FREQ * 0.02 + fish.phase) * FISH_MOVE.SWAY_AMP;
  return false;
}

// 离场判定：到达路径终点
export function fishOffScreen(fish) {
  if (!fish.path) return false;
  return fish.seg >= fish.path.length - 1;
}

// 创建一条鱼（沿给定 path，从路径起点出发）
export function makeFish(rng, speciesId, pathId, delaySec = 0) {
  const sp = fishById(speciesId);
  const path = pathById(pathId);
  const start = path.points[0];
  return {
    id: 0, // sim 里再赋 nextId
    species: sp.id,
    hp: sp.hp,
    value: sp.value,
    radius: sp.radius,
    speed: sp.speed,
    boss: sp.boss,
    x: start[0],
    y: start[1],
    pathId,
    path: path.points,
    seg: 0,
    travel: 0,
    phase: rng() * Math.PI * 2,
    sway: 0,
    delay: delaySec, // 编队延迟：>0 时先不动
    alive: true,
  };
}

// 生成一个鱼群：同路径编队，鱼之间按 GROUP_DELAY 错开
export function spawnGroup(rng, stage, nextId) {
  const roster = stage.roster;
  const weights = roster.map((id) => fishById(id).weight);
  const speciesId = pickWeighted(rng, roster, weights);
  const pathId = pick(rng, stage.paths);
  const size = randInt(rng, stage.groupSize[0], stage.groupSize[1]);
  const fish = [];
  for (let i = 0; i < size; i += 1) {
    const f = makeFish(rng, speciesId, pathId, i * SPAWN.GROUP_DELAY);
    f.id = nextId++;
    fish.push(f);
  }
  return { fish, pathId, speciesId, nextId };
}

// Boss：单条巨口鲨，慢速游过屏幕中央
export function spawnBoss(rng, nextId) {
  const pathId = pick(rng, [2, 5, 6]);
  const f = makeFish(rng, BOSS_FISH_ID, pathId, 0);
  f.id = nextId++;
  return { fish: [f], pathId, speciesId: BOSS_FISH_ID, nextId };
}

export function listPaths() {
  return PATHS;
}
