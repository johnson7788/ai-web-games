// 零依赖 2D 刚体物理引擎（Box2D-Lite 风格的 impulse solver + SAT/裁剪接触）。
// 坐标：像素，y 向下；角度弧度，正 = 屏幕顺时针。
// 形状：circle 或 convex polygon（本地顶点相对质心，逆时针）。
// 特性：重力、静态/动态刚体、摩擦、弹性、暖启动、Baumgarte 偏置、位置校正、
//       point-to-point 距离关节（刚性杆）。
// 纯逻辑、无 DOM，可被 node --test 与 tools/selfplay.mjs 直接 import。

// ---------------- 向量 / 数学 ----------------
export const V = (x = 0, y = 0) => ({ x, y });
export const vadd = (a, b) => V(a.x + b.x, a.y + b.y);
export const vsub = (a, b) => V(a.x - b.x, a.y - b.y);
export const vscale = (a, s) => V(a.x * s, a.y * s);
export const vdot = (a, b) => a.x * b.x + a.y * b.y;
export const vlen = (a) => Math.hypot(a.x, a.y);
export const vnorm = (a) => {
  const l = vlen(a);
  return l > 1e-9 ? V(a.x / l, a.y / l) : V(0, 0);
};
export const vperp = (a) => V(-a.y, a.x); // 逆时针 90°
export const cross = (a, b) => a.x * b.y - a.y * b.x; // 标量叉积
export const crossSV = (s, a) => V(-s * a.y, s * a.x);
export const crossVS = (a, s) => V(s * a.y, -s * a.x);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------- 形状 ----------------
// 多边形顶点（本地、相对质心、逆时针）。构造时自动居中并算 area / inertia(单位密度)。
export function makePoly(verts) {
  const n = verts.length;
  // 形心（面积加权的顶点平均）
  let cx = 0;
  let cy = 0;
  let area2 = 0;
  for (let i = 0; i < n; i += 1) {
    const p = verts[i];
    const q = verts[(i + 1) % n];
    const c = cross(p, q);
    area2 += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  const area = area2 / 2; // 面积（可能为负；之后取绝对值）
  const inv = area2 !== 0 ? 1 / (3 * area2) : 0;
  cx *= inv;
  cy *= inv;
  const centered = verts.map((p) => V(p.x - cx, p.y - cy));
  // 单位密度转动惯量（关于质心）
  let I = 0;
  for (let i = 0; i < n; i += 1) {
    const p = centered[i];
    const q = centered[(i + 1) % n];
    const c = cross(p, q);
    I += c * (vdot(p, p) + vdot(p, q) + vdot(q, q));
  }
  return {
    type: 'poly',
    verts: centered,
    area: Math.abs(area),
    I: Math.abs(I) / 12,
  };
}

export function makeBox(hw, hh) {
  return makePoly([V(-hw, -hh), V(hw, -hh), V(hw, hh), V(-hw, hh)]);
}

export function makeCircle(radius) {
  return { type: 'circle', radius, area: Math.PI * radius * radius, I: 0.5 * radius * radius };
}

// ---------------- 刚体 ----------------
// shape: makePoly / makeBox / makeCircle 的结果
// opts: { density=1, friction=0.5, restitution=0, isStatic=false, angle=0, linearDamping=0, angularDamping=0 }
let NEXT_ID = 1;
export function makeBody(shape, x, y, opts = {}) {
  const density = opts.density ?? 1;
  const isStatic = !!opts.isStatic;
  const mass = isStatic ? 0 : Math.max(0.0001, shape.area * density);
  const I = isStatic ? 0 : shape.I * density;
  const body = {
    _id: NEXT_ID++,
    shape,
    x,
    y,
    angle: opts.angle ?? 0,
    vx: opts.vx ?? 0,
    vy: opts.vy ?? 0,
    w: opts.w ?? 0,
    invMass: isStatic ? 0 : 1 / mass,
    invI: isStatic ? 0 : 1 / I,
    mass,
    I,
    friction: opts.friction ?? 0.5,
    restitution: opts.restitution ?? 0,
    isStatic,
    linearDamping: opts.linearDamping ?? 0,
    angularDamping: opts.angularDamping ?? 0,
    // 缓存的世界顶点 / 法线，碰撞时填充
    _worldVerts: null,
    _worldNormals: null,
    _aabb: null,
  };
  return body;
}

export function worldVertices(b) {
  if (b.shape.type === 'circle') return null;
  if (!b._worldVerts || b._worldVerts.length !== b.shape.verts.length) {
    b._worldVerts = b.shape.verts.map(() => V());
    b._worldNormals = b.shape.verts.map(() => V());
  }
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  for (let i = 0; i < b.shape.verts.length; i += 1) {
    const lv = b.shape.verts[i];
    b._worldVerts[i].x = b.x + c * lv.x - s * lv.y;
    b._worldVerts[i].y = b.y + s * lv.x + c * lv.y;
    // 边 = v[i+1] - v[i]；外法线 = (edge.y, -edge.x) 归一化（逆时针）
    const j = (i + 1) % b.shape.verts.length;
    const lw = b.shape.verts[j];
    const ex = c * lw.x - s * lw.y - (c * lv.x - s * lv.y);
    const ey = s * lw.x + c * lw.y - (s * lv.x + c * lv.y);
    const nn = vnorm(V(ey, -ex));
    b._worldNormals[i].x = nn.x;
    b._worldNormals[i].y = nn.y;
  }
  return { verts: b._worldVerts, normals: b._worldNormals };
}

function radiusOf(b) {
  if (b.shape.type === 'circle') return b.shape.radius;
  let r = 0;
  for (const p of b.shape.verts) r = Math.max(r, vlen(p));
  return r;
}

function aabb(b) {
  if (b.shape.type === 'circle') {
    return { x0: b.x - b.shape.radius, y0: b.y - b.shape.radius, x1: b.x + b.shape.radius, y1: b.y + b.shape.radius };
  }
  const { verts } = worldVertices(b);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of verts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

function aabbOverlap(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

// ---------------- 接触 ----------------
// manifold: { a, b, normal(V, a→b), points: [{x,y,separation,normalImpulse,tangentImpulse}] }
function newManifold(a, b, normal, points) {
  return { a, b, normal, points };
}

function collideCircleCircle(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const r = a.shape.radius + b.shape.radius;
  if (d2 >= r * r || d2 < 1e-12) return null;
  const d = Math.sqrt(d2);
  const normal = V(dx / d, dy / d);
  const sep = d - r;
  const px = a.x + normal.x * (a.shape.radius + sep / 2);
  const py = a.y + normal.y * (a.shape.radius + sep / 2);
  return newManifold(a, b, normal, [{ x: px, y: py, separation: sep, normalImpulse: 0, tangentImpulse: 0 }]);
}

function collidePolyCircle(poly, circ) {
  // poly = a（多边形），circ = b（圆）。normal 从 poly 指向 circ。
  const { verts, normals } = worldVertices(poly);
  const n = verts.length;
  const center = V(circ.x, circ.y);

  // 圆是否在多边形内部：所有面法线方向上 center 都在面内侧（dot <= 0）
  let inside = true;
  for (let i = 0; i < n; i += 1) {
    if (vdot(normals[i], vsub(center, verts[i])) > 0) { inside = false; break; }
  }

  if (inside) {
    let maxSep = -Infinity;
    let normal = normals[0];
    for (let i = 0; i < n; i += 1) {
      const sep = vdot(normals[i], vsub(center, verts[i]));
      if (sep > maxSep) { maxSep = sep; normal = normals[i]; }
    }
    const separation = maxSep - circ.shape.radius;
    if (separation > 0) return null;
    const nn = V(-normal.x, -normal.y);
    return newManifold(poly, circ, nn, [
      { x: center.x, y: center.y, separation, normalImpulse: 0, tangentImpulse: 0 },
    ]);
  }

  // 圆在多边形外部：找边界上最近点
  let bestDist2 = Infinity;
  let bestPoint = null;
  let bestNormal = null;
  for (let i = 0; i < n; i += 1) {
    const va = verts[i];
    const vb = verts[(i + 1) % n];
    const ab = vsub(vb, va);
    const denom = Math.max(1e-9, vdot(ab, ab));
    const t = clamp(vdot(vsub(center, va), ab) / denom, 0, 1);
    const p = vadd(va, vscale(ab, t));
    const d = vsub(p, center);
    const d2 = vdot(d, d);
    if (d2 < bestDist2) { bestDist2 = d2; bestPoint = p; bestNormal = normals[i]; }
  }
  const dist = Math.sqrt(bestDist2);
  const separation = dist - circ.shape.radius;
  if (separation > 0) return null;
  const nn = dist > 1e-9 ? vscale(vsub(center, bestPoint), 1 / dist) : V(-bestNormal.x, -bestNormal.y);
  return newManifold(poly, circ, nn, [
    { x: bestPoint.x, y: bestPoint.y, separation, normalImpulse: 0, tangentImpulse: 0 },
  ]);
}

function collideCirclePoly(circ, poly) {
  const m = collidePolyCircle(poly, circ);
  if (!m) return null;
  // 反转：a=circ, b=poly，normal 从 circ 指向 poly
  const nn = V(-m.normal.x, -m.normal.y);
  return newManifold(circ, poly, nn, m.points);
}

// 找最大分离轴（SAT），返回分离距离（沿该轴的最小投影差），用于参考面选择。
function findMaxSeparation(a, b, vertsA, normalsA, vertsB, normalsB) {
  let best = -Infinity;
  let bestIndex = 0;
  const nA = vertsA.length;
  for (let i = 0; i < nA; i += 1) {
    const nrm = normalsA[i];
    let mn = Infinity;
    for (const p of vertsB) mn = Math.min(mn, vdot(nrm, p));
    const sep = mn - vdot(nrm, vertsA[i]);
    if (sep > best) {
      best = sep;
      bestIndex = i;
    }
  }
  return { separation: best, index: bestIndex };
}

function collidePolyPoly(a, b) {
  const wA = worldVertices(a);
  const wB = worldVertices(b);
  const nA = wA.verts.length;
  const nB = wB.verts.length;
  const rA = radiusOf(a);
  const rB = radiusOf(b);
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  if (dist > rA + rB) return null;

  // 找 a 上最大分离轴
  const sepA = findMaxSeparation(a, b, wA.verts, wA.normals, wB.verts, wB.normals);
  if (sepA.separation > 0) return null;
  // 找 b 上最大分离轴
  const sepB = findMaxSeparation(b, a, wB.verts, wB.normals, wA.verts, wA.normals);
  if (sepB.separation > 0) return null;

  // 参考面 = 分离距离更小（更接近碰撞）的多边形
  let refBody;
  let incBody;
  let refIndex;
  let flip;
  let refVerts;
  let refNormals;
  let incVerts;
  if (sepB.separation > sepA.separation) {
    refBody = a;
    incBody = b;
    refIndex = sepA.index;
    flip = false;
    refVerts = wA.verts;
    refNormals = wA.normals;
    incVerts = wB.verts;
  } else {
    refBody = b;
    incBody = a;
    refIndex = sepB.index;
    flip = true;
    refVerts = wB.verts;
    refNormals = wB.normals;
    incVerts = wA.verts;
  }

  const refN = refNormals[refIndex];
  // incident face：入射多边形上与 refN 方向最接近的边（法线与 -refN 最接近）
  let incIndex = 0;
  let minDot = Infinity;
  const nInc = incVerts.length;
  const incNormals = (incBody === a ? wA.normals : wB.normals);
  for (let i = 0; i < nInc; i += 1) {
    const d = vdot(incNormals[i], refN);
    if (d < minDot) {
      minDot = d;
      incIndex = i;
    }
  }

  const i0 = incIndex;
  const i1 = (incIndex + 1) % nInc;
  let c0 = V(incVerts[i0].x, incVerts[i0].y);
  let c1 = V(incVerts[i1].x, incVerts[i1].y);

  // 参考面两个端点
  const r0 = refIndex;
  const r1 = (refIndex + 1) % refVerts.length;
  const refEdge0 = refVerts[r0];
  const refEdge1 = refVerts[r1];

  // 裁剪 incident 段到参考面的两个侧平面
  function clip(seg0, seg1, planePoint, planeNormal) {
    const d0 = vdot(vsub(seg0, planePoint), planeNormal);
    const d1 = vdot(vsub(seg1, planePoint), planeNormal);
    const out = [];
    if (d0 <= 0) out.push(V(seg0.x, seg0.y));
    if (d1 <= 0) out.push(V(seg1.x, seg1.y));
    if (d0 * d1 < 0) {
      const t = d0 / (d0 - d1);
      out.push(V(seg0.x + t * (seg1.x - seg0.x), seg0.y + t * (seg1.y - seg0.y)));
    }
    return out;
  }

  // 侧平面法线 = 参考边方向
  const refEdge = vsub(refEdge1, refEdge0);
  const refTangent = vnorm(refEdge);
  let pts = clip(c0, c1, refEdge1, refTangent); // 前端平面
  if (pts.length < 2) return null;
  pts = clip(pts[0], pts[1], refEdge0, V(-refTangent.x, -refTangent.y)); // 后端平面
  if (pts.length < 2) return null;

  // 保留分离度 <= 0 的点
  const normal = flip ? V(-refN.x, -refN.y) : V(refN.x, refN.y); // 从 a → b
  const contacts = [];
  for (const p of pts) {
    const sep = vdot(vsub(p, refEdge0), refN);
    if (sep <= 0.0005) {
      contacts.push({ x: p.x, y: p.y, separation: sep, normalImpulse: 0, tangentImpulse: 0 });
    }
  }
  if (!contacts.length) return null;
  // 去重（过近点合并）
  const uniq = [];
  for (const c of contacts) {
    let dup = false;
    for (const u of uniq) if (Math.hypot(c.x - u.x, c.y - u.y) < 1.0) { dup = true; break; }
    if (!dup) uniq.push(c);
  }
  if (!uniq.length) return null;
  return newManifold(a, b, normal, uniq.slice(0, 2));
}

function collide(a, b) {
  const ta = a.shape.type;
  const tb = b.shape.type;
  if (ta === 'circle' && tb === 'circle') return collideCircleCircle(a, b);
  if (ta === 'poly' && tb === 'circle') return collidePolyCircle(a, b);
  if (ta === 'circle' && tb === 'poly') return collideCirclePoly(a, b);
  return collidePolyPoly(a, b);
}

export { collide };

// ---------------- 距离关节（point-to-point 刚性杆） ----------------
export function makeDistanceJoint(bodyA, bodyB, anchorA, anchorB, length) {
  return { a: bodyA, b: bodyB, anchorA, anchorB, length, bias: 0, impulse: 0 };
}

function jointPreStep(j, invDt) {
  const a = j.a;
  const b = j.b;
  // 世界锚点
  const cA = Math.cos(a.angle);
  const sA = Math.sin(a.angle);
  const rA = V(cA * j.anchorA.x - sA * j.anchorA.y, sA * j.anchorA.x + cA * j.anchorA.y);
  const cB = Math.cos(b.angle);
  const sB = Math.sin(b.angle);
  const rB = V(cB * j.anchorB.x - sB * j.anchorB.y, sB * j.anchorB.x + cB * j.anchorB.y);
  j._rA = rA;
  j._rB = rB;
  const pA = vadd(V(a.x, a.y), rA);
  const pB = vadd(V(b.x, b.y), rB);
  const d = vsub(pB, pA);
  const dist = vlen(d) || 1e-9;
  j._n = V(d.x / dist, d.y / dist);
  const C = dist - j.length;
  j._C = C;
  // 有效质量
  const rnA = cross(rA, j._n);
  const rnB = cross(rB, j._n);
  const k = a.invMass + b.invMass + a.invI * rnA * rnA + b.invI * rnB * rnB;
  j._mass = k > 0 ? 1 / k : 0;
  const biasFactor = 0.2;
  j.bias = -biasFactor * invDt * C;
}

function jointSolveVelocity(j) {
  const a = j.a;
  const b = j.b;
  const vA = V(a.vx, a.vy);
  const vB = V(b.vx, b.vy);
  const dv = vsub(vadd(vB, crossSV(b.w, j._rB)), vadd(vA, crossSV(a.w, j._rA)));
  const vn = vdot(dv, j._n);
  let imp = j._mass * (j.bias - vn);
  const old = j.impulse;
  j.impulse = old + imp;
  imp = j.impulse - old;
  const P = vscale(j._n, imp);
  a.vx -= P.x * a.invMass;
  a.vy -= P.y * a.invMass;
  a.w -= a.invI * cross(j._rA, P);
  b.vx += P.x * b.invMass;
  b.vy += P.y * b.invMass;
  b.w += b.invI * cross(j._rB, P);
}

function jointSolvePosition(j) {
  const a = j.a;
  const b = j.b;
  const cA = Math.cos(a.angle);
  const sA = Math.sin(a.angle);
  const rA = V(cA * j.anchorA.x - sA * j.anchorA.y, sA * j.anchorA.x + cA * j.anchorA.y);
  const cB = Math.cos(b.angle);
  const sB = Math.sin(b.angle);
  const rB = V(cB * j.anchorB.x - sB * j.anchorB.y, sB * j.anchorB.x + cB * j.anchorB.y);
  const pA = vadd(V(a.x, a.y), rA);
  const pB = vadd(V(b.x, b.y), rB);
  const d = vsub(pB, pA);
  const dist = vlen(d) || 1e-9;
  const n = V(d.x / dist, d.y / dist);
  const C = dist - j.length;
  const k = a.invMass + b.invMass;
  if (k <= 0) return;
  const imp = -C / k;
  const P = vscale(n, imp);
  a.x -= P.x * a.invMass;
  a.y -= P.y * a.invMass;
  b.x += P.x * b.invMass;
  b.y += P.y * b.invMass;
}

// ---------------- 世界 ----------------
const SLOP = 0.005;
const BIAS_FACTOR = 0.2;

export function makeWorld(gravity) {
  const world = {
    gravity: gravity || V(0, 0),
    bodies: [],
    joints: [],
    arbiters: new Map(),
  };

  world.addBody = (b) => {
    world.bodies.push(b);
    return b;
  };
  world.removeBody = (b) => {
    const i = world.bodies.indexOf(b);
    if (i >= 0) world.bodies.splice(i, 1);
    // 清理关联关节与仲裁器
    for (let j = world.joints.length - 1; j >= 0; j -= 1) {
      if (world.joints[j].a === b || world.joints[j].b === b) world.joints.splice(j, 1);
    }
    for (const [key, arb] of [...world.arbiters]) {
      if (arb.a === b || arb.b === b) world.arbiters.delete(key);
    }
  };
  world.addJoint = (j) => {
    world.joints.push(j);
    return j;
  };
  world.removeJoint = (j) => {
    const i = world.joints.indexOf(j);
    if (i >= 0) world.joints.splice(i, 1);
  };

  function pairKey(a, b) {
    return a._id < b._id ? `${a._id}:${b._id}` : `${b._id}:${a._id}`;
  }

  function updateArbiters() {
    const used = new Set();
    for (let i = 0; i < world.bodies.length; i += 1) {
      for (let j = i + 1; j < world.bodies.length; j += 1) {
        const a = world.bodies[i];
        const b = world.bodies[j];
        if (a.isStatic && b.isStatic) continue;
        if (!aabbOverlap(aabb(a), aabb(b))) continue;
        const manifold = collide(a, b);
        if (!manifold) continue;
        const key = pairKey(a, b);
        used.add(key);
        let arb = world.arbiters.get(key);
        if (arb) {
          // 暖启动：沿袭旧法向冲量（同向近似），否则清零
          if (vdot(arb.manifold.normal, manifold.normal) < 0) {
            for (const p of arb.manifold.points) { p.normalImpulse = 0; p.tangentImpulse = 0; }
          }
          arb.manifold = manifold;
          // 把旧冲量按位置就近迁移（简单：逐个最近匹配）
          for (const np of manifold.points) {
            let best = Infinity;
            for (const op of arb._oldPoints || []) {
              const d = Math.hypot(np.x - op.x, np.y - op.y);
              if (d < best) { best = d; np.normalImpulse = op.normalImpulse; np.tangentImpulse = op.tangentImpulse; }
            }
          }
        } else {
          arb = { a, b, manifold };
          world.arbiters.set(key, arb);
        }
        arb._oldPoints = manifold.points.map((p) => ({ ...p }));
      }
    }
    for (const [key, arb] of [...world.arbiters]) {
      if (!used.has(key)) world.arbiters.delete(key);
    }
  }

  function arbPreStep(arb, invDt) {
    const m = arb.manifold;
    const a = m.a;
    const b = m.b;
    const friction = Math.sqrt(a.friction * b.friction);
    arb.friction = friction;
    arb.restitution = Math.max(a.restitution, b.restitution);
    for (const c of m.points) {
      const rA = vsub(V(c.x, c.y), V(a.x, a.y));
      const rB = vsub(V(c.x, c.y), V(b.x, b.y));
      c._rA = rA;
      c._rB = rB;
      const rnA = cross(rA, m.normal);
      const rnB = cross(rB, m.normal);
      const k = a.invMass + b.invMass + a.invI * rnA * rnA + b.invI * rnB * rnB;
      c._massNormal = k > 0 ? 1 / k : 0;
      // 切线
      c._tangent = vperp(m.normal);
      const rtA = cross(rA, c._tangent);
      const rtB = cross(rB, c._tangent);
      const kt = a.invMass + b.invMass + a.invI * rtA * rtA + b.invI * rtB * rtB;
      c._massTangent = kt > 0 ? 1 / kt : 0;
      // 恢复系数 + Baumgarte 偏置（带 slop）
      const velA = vadd(V(a.vx, a.vy), crossSV(a.w, rA));
      const velB = vadd(V(b.vx, b.vy), crossSV(b.w, rB));
      const vRel = vdot(vsub(velB, velA), m.normal);
      const penetration = -c.separation;
      const bias = -BIAS_FACTOR * invDt * Math.min(0, c.separation + SLOP);
      let rest = 0;
      if (vRel < -1.0) rest = -arb.restitution * vRel;
      c._bias = bias + rest;
    }
  }

  function arbSolveVelocity(arb) {
    const m = arb.manifold;
    const a = m.a;
    const b = m.b;
    for (const c of m.points) {
      const velA = vadd(V(a.vx, a.vy), crossSV(a.w, c._rA));
      const velB = vadd(V(b.vx, b.vy), crossSV(b.w, c._rB));
      const dv = vsub(velB, velA);
      // 法向冲量（带暖启动累积）
      const vn = vdot(dv, m.normal);
      let imp = c._massNormal * (c._bias - vn);
      const old = c.normalImpulse;
      c.normalImpulse = Math.max(old + imp, 0);
      imp = c.normalImpulse - old;
      const Pn = vscale(m.normal, imp);
      a.vx -= Pn.x * a.invMass;
      a.vy -= Pn.y * a.invMass;
      a.w -= a.invI * cross(c._rA, Pn);
      b.vx += Pn.x * b.invMass;
      b.vy += Pn.y * b.invMass;
      b.w += b.invI * cross(c._rB, Pn);
      // 摩擦冲量
      const vt = vdot(dv, c._tangent);
      let impT = c._massTangent * (-vt);
      const maxT = arb.friction * c.normalImpulse;
      const oldT = c.tangentImpulse;
      c.tangentImpulse = clamp(oldT + impT, -maxT, maxT);
      impT = c.tangentImpulse - oldT;
      const Pt = vscale(c._tangent, impT);
      a.vx -= Pt.x * a.invMass;
      a.vy -= Pt.y * a.invMass;
      a.w -= a.invI * cross(c._rA, Pt);
      b.vx += Pt.x * b.invMass;
      b.vy += Pt.y * b.invMass;
      b.w += b.invI * cross(c._rB, Pt);
    }
  }

  function arbSolvePosition(arb) {
    const m = arb.manifold;
    const a = m.a;
    const b = m.b;
    const n = m.normal;
    const kAlloc = 0.2; // 位置校正比例
    for (const c of m.points) {
      const rA = vsub(V(c.x, c.y), V(a.x, a.y));
      const rB = vsub(V(c.x, c.y), V(b.x, b.y));
      const rnA = cross(rA, n);
      const rnB = cross(rB, n);
      const k = a.invMass + b.invMass + a.invI * rnA * rnA + b.invI * rnB * rnB;
      if (k <= 0) continue;
      const C = clamp(c.separation + SLOP, -0.5, 0); // 只处理穿透
      const imp = -kAlloc * C / k;
      const P = vscale(n, imp);
      a.x -= P.x * a.invMass;
      a.y -= P.y * a.invMass;
      a.angle -= a.invI * cross(rA, P);
      b.x += P.x * b.invMass;
      b.y += P.y * b.invMass;
      b.angle += b.invI * cross(rB, P);
    }
  }

  world.step = (dt, opts = {}) => {
    const iterations = opts.velocityIterations ?? 12;
    const positionIterations = opts.positionIterations ?? 4;
    const invDt = dt > 0 ? 1 / dt : 0;

    // 1) 积分力（重力 + 阻尼）
    for (const body of world.bodies) {
      if (body.isStatic) continue;
      body.vx += world.gravity.x * dt;
      body.vy += world.gravity.y * dt;
      const ld = 1 - body.linearDamping * dt;
      const ad = 1 - body.angularDamping * dt;
      body.vx *= ld;
      body.vy *= ld;
      body.w *= ad;
    }

    // 2) 关节预步
    for (const j of world.joints) jointPreStep(j, invDt);

    // 3) 碰撞检测 + 仲裁器更新
    updateArbiters();
    for (const arb of world.arbiters.values()) arbPreStep(arb, invDt);

    // 4) 积分位置
    for (const body of world.bodies) {
      if (body.isStatic) continue;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.w * dt;
    }

    // 5) 速度求解
    for (let it = 0; it < iterations; it += 1) {
      for (const j of world.joints) jointSolveVelocity(j);
      for (const arb of world.arbiters.values()) arbSolveVelocity(arb);
    }

    // 6) 位置校正
    for (let it = 0; it < positionIterations; it += 1) {
      for (const j of world.joints) jointSolvePosition(j);
      for (const arb of world.arbiters.values()) arbSolvePosition(arb);
    }

    // 7) 缓存本轮接触点（暖启动用）
    for (const arb of world.arbiters.values()) {
      arb._oldPoints = arb.manifold.points.map((p) => ({ ...p }));
    }
  };

  return world;
}
