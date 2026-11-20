// CARNIVAL SHOT · 生成器：按关卡 spawns 加权挑目标，生成目标实体（纯逻辑，随机来自 rng）。
import { WORLD, TARGETS } from '../../config/gameplay.js';
import { randInt, pickWeighted } from './rng.js';

// 从关卡 spawns 加权挑一种目标
export function spawnKind(rng, level) {
  return pickWeighted(rng, level.spawns);
}

// 生成一个目标实体（id/bornAt 由 sim 填充）
export function spawnTarget(kind, level, rng) {
  const t = TARGETS[kind] || TARGETS.kite;
  const speedMul = level.speedMul || 1;
  const jitter = 0.85 + rng() * 0.3;
  const e = {
    kind,
    r: t.r,
    points: t.score,
    life: t.life,
    fly: t.fly,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    dead: false,
    bornAt: 0,
  };

  if (t.fly === 'cross') {
    const left = rng() < 0.5;
    const speed = t.speed * speedMul * jitter;
    e.x = left ? -60 : WORLD.WIDTH + 60;
    e.vx = (left ? 1 : -1) * speed;
    e.y = randInt(rng, WORLD.SKY_TOP, WORLD.SKY_BOTTOM);
    e.vy = (rng() - 0.5) * 28; // 轻微纵向漂移
    e.life = (WORLD.WIDTH + 120) / speed + 0.5;
  } else if (t.fly === 'dive') {
    const speed = t.speed * speedMul * jitter;
    e.x = randInt(rng, 90, WORLD.WIDTH - 90);
    e.y = -60;
    e.vy = speed;
    e.vx = randInt(rng, -70, 70);
    e.life = (WORLD.HEIGHT + 130) / speed + 0.4;
  } else if (t.fly === 'slide') {
    const speed = t.speed * speedMul * jitter;
    e.x = randInt(rng, 130, WORLD.WIDTH - 130);
    e.y = randInt(rng, 190, 430);
    e.vx = rng() < 0.5 ? -speed : speed;
    e.vy = 0;
    e.life = t.life;
  }

  return e;
}
