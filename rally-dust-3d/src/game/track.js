// src/game/track.js — 纯逻辑赛道：点对点拉力（开放路径，非闭合环线）。
// 依赖 config（STAGES/SURFACES/PACE/CAR），不碰 DOM/THREE，node 可测。
// 对外 (s,t) 空间：s=中心线弧长(m)，t=横向(m)。渲染层用同一份 samples 建 mesh。
import { SURFACES, PACE, CAR } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 开放 Catmull-Rom（两端夹紧切线）
function crPoint(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

// 由控制点生成开放路径的等弧长采样
export function buildSamples(points, maxSamples = 1200) {
  const n = points.length;
  const RAW = 1600;
  const raw = [];
  const segs = n - 1;
  for (let i = 0; i < RAW; i++) {
    const u = (i / (RAW - 1)) * segs;
    const seg = Math.min(segs - 1, Math.floor(u));
    const t = u - seg;
    const p0 = points[Math.max(0, seg - 1)];
    const p1 = points[seg];
    const p2 = points[seg + 1];
    const p3 = points[Math.min(n - 1, seg + 2)];
    raw.push(crPoint(p0, p1, p2, p3, t));
  }
  const cum = [0];
  for (let i = 1; i < RAW; i++) {
    const a = raw[i - 1], b = raw[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[RAW - 1];
  const count = Math.max(48, Math.min(maxSamples, Math.round(length / 1.6)));
  const ds = length / count;
  const samples = [];
  let ri = 0;
  for (let i = 0; i < count; i++) {
    const target = i * ds;
    while (ri < RAW - 2 && cum[ri + 1] < target) ri++;
    const span = Math.max(1e-9, cum[ri + 1] - cum[ri]);
    const k = (target - cum[ri]) / span;
    const a = raw[ri], b = raw[ri + 1];
    samples.push({ x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, s: i * ds });
  }
  // 切线与侧向
  for (let i = 0; i < count; i++) {
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(count - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const L = Math.hypot(tx, tz) || 1;
    tx /= L; tz /= L;
    samples[i].tx = tx; samples[i].tz = tz;
    samples[i].sx = -tz; samples[i].sz = tx;
  }
  const kappa = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const a = samples[i], b = samples[Math.min(count - 1, i + 1)];
    const cr = a.tx * b.tz - a.tz * b.tx;
    const dot = Math.max(-1, Math.min(1, a.tx * b.tx + a.tz * b.tz));
    kappa[i] = Math.atan2(cr, dot) / ds;
  }
  return { samples, length, count, ds, kappa };
}

// 从 stage spec 生成控制点（随机游走，固定 seed）
function stagePoints(spec) {
  const rng = mulberry32(spec.seed);
  const pts = [[0, 0]];
  let x = 0, z = 0, heading = 0;
  const turns = spec.turns || 6;
  const segLen = spec.len / turns;
  for (let i = 0; i < turns; i++) {
    heading += (rng() * 2 - 1) * spec.turnMax;
    const d = segLen * (0.82 + rng() * 0.36);
    x += Math.cos(heading) * d;
    z += Math.sin(heading) * d;
    pts.push([x, z]);
  }
  return pts;
}

function surfaceAt(spec, s) {
  const f = s / spec.len;
  for (const seg of spec.surfaces) if (f >= seg.from && f < seg.to) return seg.type;
  return spec.surfaces[spec.surfaces.length - 1].type;
}

function inBumpy(spec, s) {
  const f = s / spec.len;
  return spec.bumpy.some((b) => f >= b.from && f < b.to);
}

// 障碍：树/石（s,t,r,kind）。树贴路边，石靠近赛道线制造选线。
function buildObstacles(spec, track) {
  const rng = mulberry32(spec.seed + 7);
  const obs = [];
  const hw = spec.width / 2;
  for (let i = 0; i < (spec.trees || 0); i++) {
    const s = 40 + rng() * (track.length - 80);
    const side = rng() < 0.5 ? -1 : 1;
    const t = side * (hw + 1.5 + rng() * 5);
    obs.push({ s, t, r: 1.1, kind: 'tree' });
  }
  for (let i = 0; i < (spec.rocks || 0); i++) {
    const s = 50 + rng() * (track.length - 100);
    const side = rng() < 0.5 ? -1 : 1;
    const t = side * (hw * 0.35 + rng() * (hw * 0.6));
    obs.push({ s, t, r: 1.4, kind: 'rock' });
  }
  return obs.sort((a, b) => a.s - b.s);
}

// 路书：从曲率峰值生成弯道提示（L/R + 档位 1-4）
function buildNotes(track) {
  const notes = [];
  const { kappa, samples, count } = track;
  for (let i = 2; i < count - 2; i++) {
    const k = Math.abs(kappa[i]);
    if (k < PACE.cornerKappa) continue;
    if (k < Math.abs(kappa[i - 1]) || k < Math.abs(kappa[i + 1])) continue; // 非峰值
    const dir = kappa[i] > 0 ? 'R' : 'L';
    let gear = 4;
    for (const [k0, g] of PACE.gearForKappa) if (k >= k0) { gear = g; break; }
    const entry = Math.max(0, samples[i].s - 18);
    notes.push({ s: entry, dir, gear, k: kappa[i], cornerS: samples[i].s });
  }
  // 合并 60m 内连续弯 → "左 3 接右 2"
  const merged = [];
  for (const note of notes) {
    const last = merged[merged.length - 1];
    if (last && note.s - last.s < 60) {
      last.next = { dir: note.dir, gear: note.gear };
      last.s = Math.min(last.s, note.s);
    } else merged.push({ ...note });
  }
  return merged;
}

export function createStage(spec) {
  const points = stagePoints(spec);
  const { samples, length, count, ds, kappa } = buildSamples(points);
  const track = {
    spec, length, count, ds, halfWidth: spec.width / 2, samples,
    obstacles: buildObstacles(spec, { length }),
    notes: buildNotes({ kappa, samples, count }),
    surfaceAt: (s) => surfaceAt(spec, s),
    gripAt(s) {
      const type = surfaceAt(spec, s);
      return CAR[SURFACES[type].grip];
    },
    inBumpy: (s) => inBumpy(spec, s),
    at(s) {
      const c = Math.max(0, Math.min(length, s));
      const f = c / ds;
      const i = Math.min(count - 1, Math.floor(f));
      const j = Math.min(count - 1, i + 1);
      const k = f - Math.floor(f);
      const a = samples[i], b = samples[j];
      let tx = a.tx + (b.tx - a.tx) * k, tz = a.tz + (b.tz - a.tz) * k;
      const L = Math.hypot(tx, tz) || 1;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, tx: tx / L, tz: tz / L, sx: -tz / L, sz: tx / L };
    },
    toWorld(s, t) {
      const f = this.at(s);
      return { x: f.x + f.sx * t, z: f.z + f.sz * t };
    },
    curvatureAt(s) {
      const c = Math.max(0, Math.min(length, s));
      const f = c / ds;
      const i = Math.min(count - 1, Math.floor(f));
      const j = Math.min(count - 1, i + 1);
      const k = f - Math.floor(f);
      return kappa[i] * (1 - k) + kappa[j] * k;
    },
  };
  return track;
}
