// SLICE LAB · 纯逻辑 sim（Node 无头可测）
// 核心玩法 1:1 复刻参考：随机凸多边形水晶，玩家划一条直线切开，
// 均分度 = round(min(A,B) / ((A+B)/2) * 100)，≥95 过关，否则失败。
// 新增机制：岩核（切到即作废）、连击（连续过关）、星级（95/98/100 三档）、旋转水晶、倒计时。
import { WORLD, STEP, PASS_SCORE, SHAPE_CENTER, SETTLE_SEC, STARS } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const TAU = Math.PI * 2;

// ---- 确定性 RNG（selfplay 固定 seed 复现）----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- 几何工具（纯函数，测试直接 import）----
export function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function splitPolygon(poly, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const side = (p) => dx * (p.y - p1.y) - dy * (p.x - p1.x);
  const A = [];
  const B = [];
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) A.push(a);
    if (sa <= 0) B.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      A.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      B.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return { A, B };
}

export function segmentPointDistance(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

// 线段与凸多边形边界的交点（去重，返回点数组）
export function segmentPolygonHits(x1, y1, x2, y2, poly) {
  const hits = [];
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const p = segmentIntersect(x1, y1, x2, y2, a.x, a.y, b.x, b.y);
    if (p) {
      const dup = hits.some((h) => Math.hypot(h.x - p.x, h.y - p.y) < 1e-6);
      if (!dup) hits.push(p);
    }
  }
  return hits;
}

function segmentIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1x = x2 - x1; const d1y = y2 - y1;
  const d2x = x4 - x3; const d2y = y4 - y3;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((x3 - x1) * d2y - (y3 - y1) * d2x) / denom;
  const u = ((x3 - x1) * d1y - (y3 - y1) * d1x) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: x1 + t * d1x, y: y1 + t * d1y };
  }
  return null;
}

function pointInConvex(p, poly) {
  const n = poly.length;
  let sign = 0;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// 半平面裁剪（保留 n·p >= c 一侧），用于面积二分
function clipHalf(poly, nx, ny, c, keepPositive) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const da = nx * a.x + ny * a.y - c;
    const db = nx * b.x + ny * b.y - c;
    const ain = keepPositive ? da >= 0 : da <= 0;
    const bin = keepPositive ? db >= 0 : db <= 0;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = da / (da - db);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}

// ---- 水晶 / 岩核生成 ----
function makeShape(level, rng) {
  const n = rngInt(rng, level.minVerts, level.maxVerts);
  const base = 132 + rng() * 30;       // 132..162
  const a1 = 18 + rng() * 26;          // 18..44
  const a2 = 4 + rng() * 9;            // 4..13
  const p1 = rng() * TAU;
  const p2 = rng() * TAU;
  const rot0 = rng() * TAU;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const th = rot0 + (i / n) * TAU;
    const r = Math.max(64, base + a1 * Math.cos(th + p1) + a2 * Math.cos(2 * th + p2));
    pts.push({ x: SHAPE_CENTER.x + r * Math.cos(th), y: SHAPE_CENTER.y + r * Math.sin(th) });
  }
  return pts;
}

function makeRock(level, rng, shape) {
  const avgR = shape.reduce((s, p) => s + Math.hypot(p.x - SHAPE_CENTER.x, p.y - SHAPE_CENTER.y), 0) / shape.length;
  let ox = 0;
  let oy = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const dir = rng() * TAU;
    const mag = (0.3 + rng() * 0.32) * avgR;
    ox = Math.cos(dir) * mag;
    oy = Math.sin(dir) * mag;
    const probe = { x: SHAPE_CENTER.x + ox, y: SHAPE_CENTER.y + oy };
    if (pointInConvex(probe, shape)) break;
    // 越界则向中心收缩
  }
  return { ox, oy, r: 16 + rng() * 8 };
}

// ---- 当前（旋转后）顶点与岩核世界坐标 ----
function currentVerts(s) {
  if (!s.angle) return s.shape;
  const cos = Math.cos(s.angle);
  const sin = Math.sin(s.angle);
  return s.shape.map((p) => {
    const dx = p.x - SHAPE_CENTER.x;
    const dy = p.y - SHAPE_CENTER.y;
    return { x: SHAPE_CENTER.x + dx * cos - dy * sin, y: SHAPE_CENTER.y + dx * sin + dy * cos };
  });
}

function currentRock(s) {
  if (!s.rock) return null;
  const cos = Math.cos(s.angle);
  const sin = Math.sin(s.angle);
  return {
    x: SHAPE_CENTER.x + s.rock.ox * cos - s.rock.oy * sin,
    y: SHAPE_CENTER.y + s.rock.ox * sin + s.rock.oy * cos,
    r: s.rock.r,
  };
}

function starsFor(score) {
  for (const s of STARS) if (score >= s.min) return s.count;
  return 0;
}

// 计算一刀的均分度（纯函数，不落地状态）
export function evaluateCut(shape, rock, x1, y1, x2, y2) {
  const hits = segmentPolygonHits(x1, y1, x2, y2, shape);
  if (hits.length < 2) return { valid: false, reason: 'miss' };
  if (rock) {
    const rc = rock;
    if (segmentPointDistance(rc, { x: x1, y: y1 }, { x: x2, y: y2 }) <= rc.r) {
      return { valid: false, reason: 'rock' };
    }
  }
  const { A, B } = splitPolygon(shape, { x: x1, y: y1 }, { x: x2, y: y2 });
  if (A.length < 3 || B.length < 3) return { valid: false, reason: 'miss' };
  const areaA = polygonArea(A);
  const areaB = polygonArea(B);
  if (areaA < 1 || areaB < 1) return { valid: false, reason: 'miss' };
  const score = clamp(Math.round((Math.min(areaA, areaB) / ((areaA + areaB) / 2)) * 100), 0, 100);
  return { valid: true, pieces: [{ points: A, area: areaA }, { points: B, area: areaB }], score };
}

// ---- 主入口 ----
export function createRun(levelIndex, opts = {}) {
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0))];
  const seed = (opts.seed | 0) || 1;
  const rng = mulberry32(seed);
  const shape = makeShape(level, rng);
  const rock = level.rockCount > 0 ? makeRock(level, rng, shape) : null;

  const state = {
    level: levelIndex + 1,
    phase: 'drawing',          // drawing | splitting | won | lost
    time: 0,
    timeLeft: level.time,
    angle: 0,
    shape,
    rock,
    rockCount: level.rockCount,
    rotate: level.rotate,
    pieces: null,
    lastCut: null,
    score: 0,
    stars: 0,
    combo: (opts.combo | 0) || 0,   // 本关开始前的连击数（连击 = 已连续过关数）
    cuts: 0,
    _settleT: 0,
  };

  const events = [];

  function emit(type, payload = {}) {
    // payload 里不允许带 type 字段（会覆盖事件名）
    events.push({ type, ...payload });
  }

  emit('levelStart', { level: state.level, rockCount: state.rockCount, time: state.timeLeft });

  const run = {
    state,

    step(dt = STEP) {
      const s = state;
      s.time += dt;

      if (s.phase === 'drawing') {
        s.timeLeft -= dt;
        s.angle = (s.angle + s.rotate * dt) % TAU;
        // 最后 5 秒每秒一次 countdown 事件（音频门控用）
        const prev = Math.ceil(s.timeLeft + dt);
        const now = Math.ceil(s.timeLeft);
        if (s.timeLeft > 0 && now <= 5 && now !== prev) {
          emit('countdownTick', { timeLeft: now });
        }
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          s.phase = 'lost';
          emit('timeout', { level: s.level });
          emit('lose', { reason: 'timeout', score: 0, level: s.level });
        }
      } else if (s.phase === 'splitting') {
        s._settleT -= dt;
        if (s._settleT <= 0) settle();
      }
    },

    cut(x1, y1, x2, y2) {
      const s = state;
      if (s.phase !== 'drawing') return { ok: false, reason: 'phase' };
      const verts = currentVerts(s);
      const rock = currentRock(s);
      const res = evaluateCut(verts, rock, x1, y1, x2, y2);
      if (!res.valid) {
        emit(res.reason === 'rock' ? 'rockHit' : 'miss', { level: s.level });
        return { ok: false, reason: res.reason };
      }
      s.pieces = res.pieces;
      s.lastCut = { p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } };
      s.cuts += 1;
      s.phase = 'splitting';
      s._settleT = SETTLE_SEC;
      s._frozenAngle = s.angle;
      emit('cut', { level: s.level, cuts: s.cuts });
      emit('split', { level: s.level });
      return { ok: true, score: res.score };
    },

    // 激光瞄准预览（不落地，供 render 画实时均分度）
    preview(x1, y1, x2, y2) {
      const s = state;
      if (s.phase !== 'drawing') return null;
      const verts = currentVerts(s);
      const rock = currentRock(s);
      return evaluateCut(verts, rock, x1, y1, x2, y2);
    },

    // 为 greedy/验收提供面积二分：返回一条等分切割线（避开岩核）
    bisect(normal = { x: 1, y: 0 }) {
      const s = state;
      const verts = currentVerts(s);
      const rock = currentRock(s);
      return bisectLine(verts, rock, normal);
    },

    drainEvents() {
      return events.splice(0, events.length);
    },

    getHud() {
      return {
        level: state.level,
        phase: state.phase,
        time: state.time,
        timeLeft: Math.max(0, state.timeLeft),
        score: state.score,
        stars: state.stars,
        combo: state.combo,
        cuts: state.cuts,
      };
    },
  };

  function settle() {
    const s = state;
    if (!s.pieces) { s.phase = 'lost'; return; }
    const [a, b] = s.pieces;
    const score = clamp(Math.round((Math.min(a.area, b.area) / ((a.area + b.area) / 2)) * 100), 0, 100);
    s.score = score;
    const stars = starsFor(score);
    s.stars = stars;
    emit('settle', { score, level: s.level });
    if (score >= PASS_SCORE) {
      s.phase = 'won';
      s.combo = (s.combo | 0) + 1;
      if (stars > 0) emit('star', { stars, level: s.level });
      if (score === 100) emit('perfect', { level: s.level });
      if (s.combo >= 2) emit('combo', { combo: s.combo, level: s.level });
      emit('win', { score, stars, combo: s.combo, level: s.level });
    } else {
      s.phase = 'lost';
      if (score >= 90) emit('nearMiss', { score, level: s.level });
      emit('lose', { reason: 'uneven', score, level: s.level });
    }
  }

  return run;
}

// 面积二分求等分线：normal 为法向（单位向量），返回 {p1,p2} 或 null（被岩核挡住）
function bisectLine(poly, rock, normal) {
  const nx = normal.x;
  const ny = normal.y;
  const total = polygonArea(poly);
  const dots = poly.map((p) => nx * p.x + ny * p.y);
  let lo = Math.min(...dots);
  let hi = Math.max(...dots);
  const areaAbove = (c) => polygonArea(clipHalf(poly, nx, ny, c, true));
  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    if (areaAbove(mid) > total / 2) lo = mid;
    else hi = mid;
  }
  const c = (lo + hi) / 2;
  const px = nx * c;
  const py = ny * c;
  const dx = -ny;
  const dy = nx;
  const p1 = { x: px - dx * 900, y: py - dy * 900 };
  const p2 = { x: px + dx * 900, y: py + dy * 900 };
  if (rock && segmentPointDistance(rock, p1, p2) <= rock.r) return null;
  return { p1, p2 };
}

// greedy 备选方向（含水平/垂直/斜向，覆盖岩核绕行）
export const BISECT_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: Math.cos(TAU / 8), y: Math.sin(TAU / 8) },
  { x: Math.cos(-TAU / 8), y: Math.sin(-TAU / 8) },
  { x: Math.cos(TAU / 4), y: Math.sin(TAU / 4) },
  { x: Math.cos(-TAU / 4), y: Math.sin(-TAU / 4) },
  { x: Math.cos((3 * TAU) / 8), y: Math.sin((3 * TAU) / 8) },
  { x: Math.cos((-3 * TAU) / 8), y: Math.sin((-3 * TAU) / 8) },
  { x: 0.5, y: 0.866 },
  { x: 0.5, y: -0.866 },
  { x: 0.866, y: 0.5 },
  { x: 0.866, y: -0.5 },
];
