// FOOD CHAIN · M1 生成器（纯逻辑，零依赖）：浮游食物 / 鱼（猎物·同级·捕食者·毒刺鱼）/ 水母
import { WORLD, FOOD, FISH } from '../../config/gameplay.js';
import { stageDef, radiusAt, FINAL_STAGE } from '../../config/stages.js';
import { randInt, randFloat } from './rng.js';

const M = WORLD.MARGIN;

export function randPos(rng, pad = 0) {
  return {
    x: randFloat(rng, M + pad, WORLD.WIDTH - M - pad),
    y: randFloat(rng, M + pad, WORLD.HEIGHT - M - pad),
  };
}

/** 浮游食物：静态偏漂移的发光小点 */
export function makeFood(rng, id) {
  const p = randPos(rng);
  return {
    id,
    x: p.x,
    y: p.y,
    vx: randFloat(rng, -FOOD.DRIFT, FOOD.DRIFT),
    vy: randFloat(rng, -FOOD.DRIFT, FOOD.DRIFT),
    r: FOOD.R,
    kind: 'food',
    hue: randFloat(rng, 160, 220),
  };
}

/**
 * 鱼：stage 决定半径；相对玩家 stage 采样。
 *  - 捕食者（bigger）：比玩家大 1–3 阶
 *  - 猎物（smaller）：比玩家小 1–3 阶；30% 概率同级（触发光链 signature）
 *  - 毒刺鱼（toxic）：比玩家小 0–2 阶，但吃它会掉体型
 */
export function makeFish(rng, id, playerStage) {
  const eco = stageDef(playerStage).ecology;
  const roll = rng();
  let fstage;
  let toxic = false;

  if (playerStage >= FINAL_STAGE) {
    // Apex：没有更大的天敌，只有更小/同级
    fstage = Math.max(0, playerStage - randInt(rng, 1, 3));
    if (rng() < 0.35) fstage = playerStage;
  } else if (roll < eco.predatorBias) {
    fstage = Math.min(FINAL_STAGE, playerStage + randInt(rng, 1, 3));
  } else if (eco.toxicRatio > 0 && playerStage >= 1 && rng() < eco.toxicRatio) {
    fstage = Math.max(0, playerStage - randInt(rng, 0, 2));
    toxic = true;
  } else {
    fstage = Math.max(0, playerStage - randInt(rng, 1, 3));
    if (rng() < 0.3) fstage = playerStage;
  }

  const p = randPos(rng, 10);
  const r = radiusAt(fstage);
  return {
    id,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    r,
    stage: fstage,
    toxic,
    wanderAngle: rng() * Math.PI * 2,
    wanderTimer: randFloat(rng, 0, FISH.WANDER_CHANGE),
    hue: randFloat(rng, 150, 260),
  };
}

/** 水母：中性共生体，缓慢漂移 */
export function makeJelly(rng, id) {
  const p = randPos(rng, 20);
  return {
    id,
    x: p.x,
    y: p.y,
    vx: randFloat(rng, -10, 10),
    vy: randFloat(rng, -8, 8),
    r: 30,
    kind: 'jelly',
    phase: rng() * Math.PI * 2,
  };
}

/** 保证鱼生成点离玩家有最小距离（避免开局/补充时贴脸秒杀） */
export function spawnFishAwayFromPlayer(rng, id, playerStage, px, py, minDist) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const f = makeFish(rng, id, playerStage);
    const d = Math.hypot(f.x - px, f.y - py);
    if (d >= minDist) return f;
  }
  return makeFish(rng, id, playerStage);
}
