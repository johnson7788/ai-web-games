// src/game/track.js — 纯逻辑赛道：闭合 centripetal Catmull-Rom → 等弧长采样。
// 不依赖 THREE/DOM，node 可测。渲染层用同一份 samples 建 mesh。
// 对外 (s,t) 空间：s 沿中心线弧长(m)，t 横向(m)。

function cubicPoly(x0, x1, x2, x3, dt0, dt1, dt2) {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  t1 *= dt1; t2 *= dt1;
  const c0 = x1, c1 = t1;
  const c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2;
  const c3 = 2 * x1 - 2 * x2 + t1 + t2;
  return (t) => c0 + c1 * t + c2 * t * t + c3 * t * t * t;
}

function segPoint(pts, i, t) {
  const n = pts.length;
  const p0 = pts[(i - 1 + n) % n], p1 = pts[i % n], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
  const d = (a, b) => Math.max(1e-6, Math.pow((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2, 0.25));
  const dt0 = d(p0, p1), dt1 = d(p1, p2), dt2 = d(p2, p3);
  const fx = cubicPoly(p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2);
  const fz = cubicPoly(p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2);
  return [fx(t), fz(t)];
}

export function createTrack(def) {
  const pts = def.points.map(([x, z]) => [x * def.scale, z * def.scale]);
  const halfWidth = def.width / 2;

  // 密集原始采样 → 累积弧长 → 等弧长重采样
  const RAW = 2400;
  const raw = [];
  for (let i = 0; i < RAW; i++) {
    const u = (i / RAW) * pts.length;
    const seg = Math.floor(u);
    raw.push(segPoint(pts, seg, u - seg));
  }
  const cum = [0];
  for (let i = 1; i <= RAW; i++) {
    const a = raw[i - 1], b = raw[i % RAW];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[RAW];
  const n = Math.max(64, Math.min(2000, Math.round(length / 2)));
  const ds = length / n;

  const samples = [];
  let ri = 0;
  for (let i = 0; i < n; i++) {
    const target = i * ds;
    while (ri < RAW - 1 && cum[ri + 1] < target) ri++;
    const span = Math.max(1e-9, cum[ri + 1] - cum[ri]);
    const k = (target - cum[ri]) / span;
    const a = raw[ri], b = raw[(ri + 1) % RAW];
    samples.push({ x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, s: i * ds });
  }
  // 切线/侧向（side = cross(tan, up) = (-tz, 0, tx)）
  for (let i = 0; i < n; i++) {
    const a = samples[(i - 1 + n) % n], b = samples[(i + 1) % n];
    let tx = b.x - a.x, tz = b.z - a.z;
    const L = Math.hypot(tx, tz) || 1;
    tx /= L; tz /= L;
    samples[i].tx = tx; samples[i].tz = tz;
    samples[i].sx = -tz; samples[i].sz = tx;
  }
  // 有符号曲率 rad/m
  const kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = samples[i], b = samples[(i + 1) % n];
    const cr = a.tx * b.tz - a.tz * b.tx;
    const dot = Math.max(-1, Math.min(1, a.tx * b.tx + a.tz * b.tz));
    kappa[i] = Math.atan2(cr, dot) / ds;
  }

  function wrap(s) { return ((s % length) + length) % length; }

  function at(s) {
    const f = wrap(s) / ds;
    const i = Math.floor(f) % n;
    const j = (i + 1) % n;
    const k = f - Math.floor(f);
    const a = samples[i], b = samples[j];
    let tx = a.tx + (b.tx - a.tx) * k, tz = a.tz + (b.tz - a.tz) * k;
    const L = Math.hypot(tx, tz) || 1;
    return {
      x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k,
      tx: tx / L, tz: tz / L, sx: -tz / L, sz: tx / L,
    };
  }

  return {
    length, n, ds, halfWidth, samples, def,
    curvatureAt(s) {
      const f = wrap(s) / ds;
      const i = Math.floor(f) % n, j = (i + 1) % n, k = f - Math.floor(f);
      return kappa[i] * (1 - k) + kappa[j] * k;
    },
    at,
    toWorld(s, t) {
      const f = at(s);
      return { x: f.x + f.sx * t, z: f.z + f.sz * t };
    },
  };
}