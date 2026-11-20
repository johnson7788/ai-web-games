// src/game/terrain.js — 岛屿高度场（纯函数）。sim 判定与 render 网格共用同一份。
import { CONFIG } from '../../config/game.config.js';

const Z = CONFIG.world.zones;
const COVER = [...Z, { name: 'isle', x: 0, z: 2, r: 33 }];
function wave(x, z) {
  return Math.sin(x * 0.073 + 1.3) * Math.cos(z * 0.061 - 0.7) * 0.85
    + Math.sin(x * 0.021 - 2.1) * Math.cos(z * 0.033 + 1.1) * 1.5
    + Math.sin((x + z) * 0.11) * 0.2;
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function pathDist(x, z) {
  const p = CONFIG.world.path;
  let d = Infinity;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)));
    d = Math.min(d, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
  }
  return d;
}
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  void d;  let land = 1.0;
  for (const zone of Z) {
    const dd = Math.hypot(x - zone.x, z - zone.z);
    const t = Math.max(0, 1 - dd / (zone.r * 2.0));   // 台地过渡拉长到 2r：坡缓，人能走上去（原来 1.25r 边缘有 45°+ 陡坎）
    if (t > 0) land = Math.max(land, zone.y * smoothstep(t));
  }
  land += wave(x, z) * 0.24;   // 起伏别盖过台地，否则到处是滑倒点
  const pd = pathDist(x, z);
  if (pd < 5.2) land = land * (0.55 + 0.45 * (pd / 5.2)) + 0.08;   // 路廊 5.2m 内压平，保证沿路可走
  for (const flat of [[50, -6, 7.5, 17.2], [-52, 9, 6.0, 1.0], [-46, 5, 7.0, 1.1]]) {
    const fd = Math.hypot(x - flat[0], z - flat[1]);
    if (fd < flat[2]) {
      const k = Math.max(0, Math.min(1, (flat[2] - fd) / 2.4));
      land = land * (1 - k) + flat[3] * k;
    }
  }
  // 岛形 = 各区圆盘 ∪ 中央圆盘；圆盘外就是海（这样灯塔所在的东侧台地不会被「离岛心太远」淹掉）
  let cover = 0;
  for (const c of COVER) {
    const dd = Math.hypot(x - c.x, z - c.z);
    cover = Math.max(cover, smoothstep(Math.max(0, Math.min(1, 1 - dd / (c.r * 2.0)))));
  }
  return land * cover + (-2.6) * (1 - cover);
}
export const WATER_Y = CONFIG.world.waterY;
export const isWater = (x, z) => heightAt(x, z) < WATER_Y + 0.15;
export function blockedAt(x, z) {
  if (Math.hypot(x, z) > CONFIG.world.half - 1.5) return true;
  return isWater(x, z);
}
export function slopeAt(x, z) {
  const d = 0.9;
  const hx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d);
  const hz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d);
  return Math.atan(Math.hypot(hx, hz)) * 180 / Math.PI;
}
export function zoneNameAt(x, z) {
  let best = 'sea', bd = Infinity;
  for (const zone of Z) {
    const dd = Math.hypot(x - zone.x, z - zone.z) - zone.r * 0.55;
    if (dd < bd) { bd = dd; best = zone.name; }
  }
  return best;
}
export function colorAt(x, z, out) {
  const h = heightAt(x, z), s = slopeAt(x, z);
  // 大尺度色斑：真实地表不是均匀色，加一层低频变化
  const patch = Math.sin(x * 0.043 + 2.1) * Math.cos(z * 0.037 - 1.3) * 0.5 + Math.sin((x - z) * 0.021) * 0.5;
  let c;
  if (h < WATER_Y + 0.55) c = [0.16, 0.17, 0.16];            // 潮间带湿岩/湿沙：压暗
  else if (h < WATER_Y + 1.1) c = [0.34, 0.31, 0.25];        // 湿沙带
  else if (h < 2.6) c = [0.46, 0.42, 0.31];                 // 干沙/沙丘
  else if (h < 7) c = s > 30 ? [0.30, 0.29, 0.27] : [0.24, 0.32, 0.19];   // 草坡 / 裸岩
  else if (h < 13) c = s > 32 ? [0.32, 0.31, 0.29] : [0.17, 0.25, 0.16];  // 松林坡更沉
  else c = s > 34 ? [0.38, 0.37, 0.35] : [0.26, 0.30, 0.24];              // 崖顶
  if (h > 15.5) c = [0.34, 0.34, 0.32];
  c = [c[0] + patch * 0.045, c[1] + patch * 0.045, c[2] + patch * 0.035];
  const j = Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 0.10 - 0.05;
  // 黄昏光照下顶点色容易糊成黑块：整体提亮一档，靠光照和雾去压层次
  const k = 1.12;
  out[0] = Math.max(0, Math.min(1, (c[0] + j) * k));
  out[1] = Math.max(0, Math.min(1, (c[1] + j) * k));
  out[2] = Math.max(0, Math.min(1, (c[2] + j) * k));
  return out;
}
export function groundAt(x, z) { return heightAt(x, z); }
