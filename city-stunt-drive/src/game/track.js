// src/game/track.js — 纯逻辑赛道：直线天桥 + 5 组坡道 + 金币弧线 + 冲线。
// 无 DOM/THREE；地面是 (z)->y 的分段函数，坡道是上坡楔形，坡顶之后地面回落为 0。
import { RAMPS, TRACK, COINS } from '../../config/game.config.js';

export function createTrack(def = { ramps: RAMPS, track: TRACK, coins: COINS }) {
  const ramps = def.ramps;
  const finishZ = def.track.finishZ;
  const halfWidth = def.track.halfWidth;
  const zoneZ = def.track.zoneZ;

  // 地面高度：坡道区间线性抬升，其余为 0
  function groundY(z) {
    for (const r of ramps) {
      if (z >= r.z && z <= r.z + r.len) {
        return r.h * (z - r.z) / r.len;
      }
    }
    return 0;
  }

  // 地面坡度（dz/dy，即 tanθ）
  function slopeAt(z) {
    for (const r of ramps) {
      if (z >= r.z && z <= r.z + r.len) return r.h / r.len;
    }
    return 0;
  }

  // 金币弧线：每段坡道顶 → 抛物线落点之间沿理论抛物线摆币。
  // 用坡道角度和基准速度估抛物线，金币放在 (x=0 附近微幅、y 随弧线、z 等分)。
  function buildCoins() {
    const out = [];
    const g = def.gravity ?? 18;
    const v0 = def.coinSpeed ?? 27;
    let id = 0;
    for (const r of ramps) {
      const theta = Math.atan2(r.h, r.len);
      const vz = v0 * Math.cos(theta);
      const vy = v0 * Math.sin(theta);
      const tTotal = (2 * vy) / g;
      const zEnd = r.z + r.len + vz * tTotal;
      const rows = def.coins.rows;
      for (let k = 1; k <= rows; k++) {
        const t = tTotal * (k / (rows + 1));
        const z = r.z + r.len + vz * t;
        const y = r.h + vy * t - 0.5 * g * t * t + 1.2; // 略高于理论弧线便于拾取
        // 最佳路径偏中心，给 x 一个 ±1.5 的错落
        const x = k % 2 ? -1.4 : 1.4;
        out.push({ id: id++, x, y, z, zone: r.id, taken: false });
      }
    }
    // 平路段补给币（少量，保持节奏）
    for (let i = 0; i < ramps.length - 1; i++) {
      const r = ramps[i];
      const mid = r.z + r.len + 26 + (ramps[i + 1].z - (r.z + r.len + 26)) / 2;
      out.push({ id: id++, x: 0, y: 1.2, z: mid, zone: r.id, taken: false });
      out.push({ id: id++, x: 3.2, y: 1.2, z: mid - 8, zone: r.id, taken: false });
    }
    return out;
  }

  return {
    ramps, finishZ, halfWidth, zoneZ, def,
    groundY, slopeAt,
    coins: buildCoins(),
    coinRadius: def.coins.radius,
    coinScore: def.coins.score,
    coinCurrency: def.coins.currency,
    coinNitro: def.coins.nitro,
  };
}
