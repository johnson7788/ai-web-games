// Sprout Hop · 关卡辅助（M1 拥有）：平台生成 + 拖拽瞄准解算器 + 轨迹预测。
// 纯逻辑、零 DOM、可复现（mulberry32）。sim 与 selfplay / 单测共用。
// 坐标约定：world 坐标下首平台 wx=0, wy=0；wy 为平台顶面相对首平台顶面的 y 偏移（负=更高）。
// 屏幕坐标 = worldX + camX（camX 由 sim 维护，使当前平台回到 ANCHOR.X）。

import { LEVELS, LEVEL_COUNT, BOOST } from '../../config/levels.js';
import { PHYS, TOP0, ANCHOR, WATER_Y, WORLD } from '../../config/game.config.js';

export { LEVELS, LEVEL_COUNT };

const EDGE = 6;           // 平台左右各留的落点安全边（与 sim._tryLand 一致）
export const LAND_TOL = 14; // 落台宽容带（px）：中心进入静止线 ±14px 且下落即落台

// ---------------------------------------------------------------- RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 平台生成
function pickKind(weights, rng) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return 'pod';
}

/**
 * 生成一条平台链（含首平台，长度 goalJumps + 5，保证每次前进都可解）。
 * 每个平台：{ wx, wy, w, kind, tier, moving, broken, amp, phase }。
 */
export function generatePlatforms(level, seed) {
  const rng = mulberry32(seed >>> 0);
  const n = level.goalJumps + 5;
  const plats = [{
    wx: 0, wy: 0, w: level.width || 120, kind: 'pod', tier: 'low',
    moving: false, broken: false, amp: 0, phase: rng() * 6.28,
  }];

  let prev = plats[0];
  let prevBoost = BOOST.pod; // 从首平台（豆荚）出发的倍率

  for (let i = 1; i < n; i += 1) {
    // 允许的最大水平间距：考虑上一平台落地后的 nextBoost 与风速，留 12% 余量
    const vEff = PHYS.MAX_SPEED * (level.wind ?? 1) * prevBoost;
    const maxRange = (vEff * vEff) / PHYS.GRAVITY;
    const allowedMax = Math.max(140, Math.min((level.gapMax ?? 360), maxRange * 0.88));

    let gap = 0;
    let wy = 0;
    let kind = 'pod';
    let solvable = false;

    for (let attempt = 0; attempt < 12 && !solvable; attempt += 1) {
      gap = rng() * (allowedMax - (level.gapMin ?? 200)) + (level.gapMin ?? 200);
      wy = rng() * ((level.yMax ?? 40) - (level.yMin ?? -60)) + (level.yMin ?? -60);
      kind = pickKind(level.kinds || { pod: 1 }, rng);

      let tier = 'low';
      let w = level.width * (kind === 'pumpkin' ? 1.15 : kind === 'basket' ? 0.9 : 1);
      if (level.twoTier && i % 2 === 1) {
        tier = 'high';
        wy -= 70;            // 高层：更高、更稳（更宽）
        w *= 1.12;
      } else if (level.twoTier && i % 2 === 0) {
        w *= 0.86;           // 低层：更险（更窄）
      }

      const dx = gap;
      const dy = wy - prev.wy;
      solvable = solveLaunch(dx, dy, PHYS.GRAVITY, vEff) !== null;
      if (!solvable && attempt < 11) continue;

      plats.push({
        wx: prev.wx + gap, wy, w, kind, tier,
        moving: !!(level.moving && i % 2 === 1),
        broken: !!(level.broken && kind === 'broken'),
        amp: level.moving ? PHYS.MOVE_AMP : 0,
        phase: rng() * 6.28,
      });
      prev = plats[plats.length - 1];
      prevBoost = BOOST[kind] || 1;
    }

    if (!solvable) {
      gap = Math.min(allowedMax, 220);
      wy = prev.wy + (rng() * 40 - 20);
      plats.push({
        wx: prev.wx + gap, wy, w: level.width, kind: 'pod', tier: 'low',
        moving: false, broken: false, amp: 0, phase: rng() * 6.28,
      });
      prev = plats[plats.length - 1];
      prevBoost = 1;
    }
  }

  return plats;
}

// ---------------------------------------------------------------- 瞄准解算器
/**
 * 求从 (fromX, fromY) 以抛物线（重力 g）落到 (toX, toY) 的初速度 (vx, vy)。
 * 返回满足 |vx|,|vy| ≤ vCap，且到达目标点处在「下降段」的有效速度（已含风/弹力倍率），
 * 找不到返回 null。按飞行时长 T 从短到长扫描，取最快且能落下的中等弧线。
 */
export function solveLaunch(dx, dy, g, vCap) {
  if (!(dx > 0) || !(vCap > 0)) return null;
  for (let T = 0.55; T <= 2.4; T += 0.05) {
    const vx = dx / T;
    if (vx > vCap || vx < 120) continue;
    const vy = dy / T - 0.5 * g * T;
    const vyAt = vy + g * T;              // 到达目标时的竖直速度（>0 = 下降段）
    if (vyAt >= 0 && Math.abs(vy) <= vCap && Math.abs(vy) <= PHYS.MAX_SPEED) {
      return { vx, vy };
    }
  }
  return null;
}

// 从当前平台瞄准第 i 个平台（bot/验收用）：返回「原始初速度」（已逆算 wind × nextBoost），
// 直接喂给 sim.launch()。找不到解返回 null。
export function aimToPlatform(state, i) {
  const plat = state.platforms[i];
  if (!plat) return null;
  const sx = platformScreenX(plat, state.camX, state.clock);
  // 瞄准落台宽容带「上沿」，让下降段在平台中心正好进入带内 → 中心完美落点
  const sy = platformTopY(plat) - PHYS.PEA_R - LAND_TOL;
  const startX = ANCHOR.X;
  const startY = TOP0 + (state.platforms[state.cur]?.wy ?? 0) - PHYS.PEA_R;
  const dx = sx - startX;
  const dy = sy - startY;
  const wind = state.wind ?? 1;
  const boost = state.nextBoost ?? 1;
  const vCap = PHYS.MAX_SPEED * wind * boost;
  const eff = solveLaunch(dx, dy, PHYS.GRAVITY, vCap);
  if (!eff) return null;
  return { x: eff.vx / (wind * boost), y: eff.vy / (wind * boost) };
}

// 计算某平台在给定 camX / 时钟下的屏幕中心 x（移动平台带摆动）
export function platformScreenX(plat, camX, clock = 0) {
  const sway = plat.moving ? Math.sin(clock * 1.5 + (plat.phase || 0)) * (plat.amp || 0) : 0;
  return plat.wx + camX + sway;
}

// 平台顶面的屏幕 y
export function platformTopY(plat) {
  return TOP0 + plat.wy;
}

// 从豌豆静止中心预测落点（拖拽预览用）：与 sim 相同半隐式欧拉积分，返回轨迹点 + 实际落台点。
export function predictTrajectory(state, drag, opts = {}) {
  const raw = clampSpeed({ x: drag.x * PHYS.DRAG_K, y: drag.y * PHYS.DRAG_K });
  const boost = state.nextBoost ?? 1;
  const wind = state.wind ?? 1;
  const vx = raw.x * boost * wind;
  const vy = raw.y * boost * wind;
  const g = PHYS.GRAVITY;
  const startX = ANCHOR.X;
  const startY = TOP0 + (state.platforms[state.cur]?.wy ?? 0) - PHYS.PEA_R;
  const pts = [{ x: startX, y: startY }];
  const dt = 1 / 60;
  const maxSteps = opts.maxSteps ?? 240;
  let x = startX;
  let y = startY;
  let cvx = vx;
  let cvy = vy;
  let prevY = startY;
  let land = null;

  for (let i = 0; i < maxSteps; i += 1) {
    cvy += g * dt;
    x += cvx * dt;
    y += cvy * dt;
    pts.push({ x, y });

    if (cvy >= 0) {
      for (let j = state.cur + 1; j < state.platforms.length; j += 1) {
        const plat = state.platforms[j];
        const sx = platformScreenX(plat, state.camX, 0);
        const restY = platformTopY(plat) - PHYS.PEA_R;
        const half = plat.w / 2 - EDGE;
        if (x >= sx - half && x <= sx + half && y >= restY - LAND_TOL && y <= restY + LAND_TOL) {
          land = { x, y, platform: j, restY };
          break;
        }
      }
    }
    if (land) break;
    if (y >= WATER_Y - 4 || x > WORLD.WIDTH || x < 0) break;
    prevY = y;
  }
  return { pts, startX, startY, vx, vy, land };
}

// 保号钳制单轴速度
export function clampSpeed(v) {
  const c = (val) => {
    const a = Math.abs(val);
    if (a > PHYS.MAX_SPEED) return PHYS.MAX_SPEED * (val < 0 ? -1 : 1);
    return val;
  };
  return { x: c(v.x), y: c(v.y) };
}
