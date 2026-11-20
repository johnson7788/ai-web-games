// src/game/spawner.js — 掉落物生成（纯逻辑，随机全部来自 mulberry32 rng）
import { WORLD, ITEMS } from '../../config/gameplay.js';
import { randInt, pick } from './rng.js';

// 生成一个掉落物对象（warning 阶段：active=false，startAt 后才开始下坠）
export function buildItem(rng, wave, playerX, id) {
  const kind = pick(rng, wave.kinds);
  const def = ITEMS[kind];
  const isTracking = def.kind === 'drone' || rng() < (wave.tracking || 0);

  // 落点：一定概率瞄准玩家附近，其余全宽随机
  let x;
  if (rng() < (wave.aim ?? 0.3)) {
    x = playerX + (rng() * 160 - 80);
  } else {
    x = WORLD.SPAWN_MARGIN + rng() * (WORLD.WIDTH - WORLD.SPAWN_MARGIN * 2);
  }
  x = Math.max(WORLD.SPAWN_MARGIN, Math.min(WORLD.WIDTH - WORLD.SPAWN_MARGIN, x));

  const [vMin, vMax] = wave.speed;
  const vy = vMin + rng() * (vMax - vMin);
  const warn = wave.warn * (0.85 + rng() * 0.3);

  return {
    id,
    x,
    y: WORLD.TOP_Y,
    vy,
    vx: 0,
    r: def.r,
    kind,
    def,
    dmg: def.dmg,
    isBig: def.kind === 'big',
    isDrone: def.kind === 'drone',
    tracking: isTracking,
    startAt: 0, // 由 sim 用 time+warn 填充
    active: false,
    landed: false,
  };
}

export function speedRangeFor(wave) {
  return wave.speed;
}

export function intervalFor(rng, wave) {
  return wave.interval * (0.85 + rng() * 0.3);
}
