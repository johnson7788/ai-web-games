// src/game/track.js — 赛道几何：由 shape 参数确定性生成闭合中心线 + 采样/曲率/地形。
// 纯逻辑：无 DOM、无 Date.now；同 shape 同赛道。
import { TRACK, clamp } from '../../config/gameplay.js';

const SAMPLES = 288;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function intervalHit(f, intervals) {
  for (const [a, b] of (intervals || [])) {
    if (f >= a && f <= b) return true;
  }
  return false;
}

/**
 * 由 shape 生成闭合赛道。
 * shape: { radius, lobes, wobble, seed, jelly:[], mud:[], bridge:[] }
 * 返回 track：{ length, samples:[{x,y,angle,halfWidth,curvature,jelly,mud,bridge}], sampleAt(progress) }
 */
export function buildTrack(shape = {}) {
  const radius = shape.radius ?? 560;
  const lobes = Math.max(1, shape.lobes ?? 2);
  const wobble = shape.wobble ?? 0.1;
  const phase = ((shape.seed ?? 1) % 7) * 0.9;

  const pts = [];
  for (let k = 0; k < SAMPLES; k += 1) {
    const th = (k / SAMPLES) * Math.PI * 2;
    // 叠加二次谐波，让「弯」更有起伏、形状更像真实赛道
    const r = radius * (1 + wobble * Math.sin(lobes * th + phase) + wobble * 0.35 * Math.sin(2 * lobes * th + phase * 1.7));
    pts.push({ x: r * Math.cos(th), y: r * Math.sin(th) });
  }

  // 分段弧长
  const segLen = [];
  let total = 0;
  for (let k = 0; k < SAMPLES; k += 1) {
    const a = pts[k];
    const b = pts[(k + 1) % SAMPLES];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    segLen.push(d);
    total += d;
  }

  // 累计弧长 + 每点切线角 + 曲率 + 地形
  const samples = [];
  let cum = 0;
  const cumLen = [];
  for (let k = 0; k < SAMPLES; k += 1) {
    const prev = pts[(k - 1 + SAMPLES) % SAMPLES];
    const next = pts[(k + 1) % SAMPLES];
    const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
    const f = total > 0 ? cum / total : 0;
    const bridge = intervalHit(f, shape.bridge);
    const jelly = intervalHit(f, shape.jelly);
    const mud = intervalHit(f, shape.mud);
    samples.push({
      x: pts[k].x,
      y: pts[k].y,
      angle,
      halfWidth: bridge ? TRACK.BRIDGE_HALF_WIDTH : TRACK.HALF_WIDTH,
      curvature: 0,
      jelly,
      mud,
      bridge,
      f,
    });
    cumLen.push(cum);
    cum += segLen[k];
  }

  // 曲率 = 切线角差 / 弧长（有符号：左转为正）
  for (let k = 0; k < SAMPLES; k += 1) {
    const a = samples[(k - 1 + SAMPLES) % SAMPLES].angle;
    const b = samples[(k + 1) % SAMPLES].angle;
    const dAng = wrapAngle(b - a);
    const ds = segLen[(k - 1 + SAMPLES) % SAMPLES] + segLen[k];
    samples[k].curvature = ds > 1e-6 ? dAng / ds : 0;
  }

  function sampleAt(progress) {
    const p = ((progress % total) + total) % total;
    // 二分查找所在段
    let lo = 0;
    let hi = SAMPLES - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cumLen[mid] <= p) lo = mid;
      else hi = mid - 1;
    }
    const i = lo;
    const j = (i + 1) % SAMPLES;
    const seg = segLen[i] || 1e-6;
    const t = clamp((p - cumLen[i]) / seg, 0, 1);
    const a = samples[i];
    const b = samples[j];
    const halfWidth = lerp(a.halfWidth, b.halfWidth, t);
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      angle: a.angle + wrapAngle(b.angle - a.angle) * t,
      halfWidth,
      curvature: lerp(a.curvature, b.curvature, t),
      jelly: a.jelly || b.jelly,
      mud: a.mud || b.mud,
      bridge: a.bridge || b.bridge,
      f: a.f,
    };
  }

  // 采样点数组（渲染/道具箱定位用）
  return { length: total, samples, sampleAt, total };
}

export default { buildTrack };
