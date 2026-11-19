// CROW BLASTER · 生成器：按关卡 spawns 加权挑乌鸦，生成乌鸦实体（纯逻辑，随机来自 rng）。
import { WORLD } from '../../config/game.config.js';
import { CROWS } from '../../config/gameplay.js';
import { randInt, pickWeighted } from './rng.js';

// 从关卡 spawns 加权挑一种乌鸦
export function spawnKind(rng, level) {
  return pickWeighted(rng, level.spawns);
}

// 生成一只乌鸦实体（id/bornAt 由 sim 填充）
export function spawnCrow(kind, level, rng) {
  const t = CROWS[kind] || CROWS.scout;
  const speedMul = level.speedMul || 1;
  const jitter = 0.85 + rng() * 0.3;
  const left = rng() < 0.5;
  const speed = t.speed * speedMul * jitter;
  const e = {
    kind,
    hp: t.hp,
    maxHp: t.hp,
    r: t.r,
    points: t.score,
    x: left ? -70 : WORLD.WIDTH + 70,
    y: randInt(rng, WORLD.SKY_TOP + 20, WORLD.SKY_BOTTOM - 20),
    vx: (left ? 1 : -1) * speed,
    vy: (rng() - 0.5) * 40, // 轻微纵向漂移
    dead: false,
    bornAt: 0,
    wobble: rng() * Math.PI * 2, // 渲染翅膀相位（不影响逻辑）
  };
  return e;
}
