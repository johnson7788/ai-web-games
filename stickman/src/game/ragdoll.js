// ragdoll.js — 11-point Verlet constraint body simulation
// Pure physics, no DOM. All values from config.
import { CONFIG, WORLD, STEP } from '../../config/game.config.js';

const R = CONFIG.rig;
const GRAV = WORLD.gravity;

export const POINT_ORDER = [
  'head', 'neck', 'pelvis',
  'elbowL', 'elbowR', 'handL', 'handR',
  'kneeL', 'kneeR', 'footL', 'footR',
];

const HEAD = 0, NECK = 1, PELVIS = 2;
const EL = 3, ER = 4, HL = 5, HR = 6;
const KL = 7, KR = 8, FL = 9, FR = 10;

const BONES = [
  [HEAD, NECK, R.neck],
  [NECK, PELVIS, R.body],
  [NECK, EL, R.arm], [NECK, ER, R.arm],
  [EL, HL, R.arm], [ER, HR, R.arm],
  [PELVIS, KL, R.leg], [PELVIS, KR, R.leg],
  [KL, FL, R.leg], [KR, FR, R.leg],
];

const HEAD_AY = -0.2;
const HAND_AY = 0.05;
const FOOT_AY = 1.0;
const DEFAULT_AY = 0;   // 只有 head / hands / feet 受重力，躯干由约束拉住（原版关键）
const DAMP = 1 - R.drag;
const GROUND_FRIC = 0.86;
const COLLISION_PTS = [HEAD, NECK, PELVIS, FL, FR, KL, KR];

export function createBody(px, py, scale = 1) {
  const s = scale;
  // 初始姿态必须精确满足骨长，否则第一帧约束会剧烈回弹
  const ax = Math.cos(Math.PI / 6) * R.arm * s;
  const ay = Math.sin(Math.PI / 6) * R.arm * s;
  const hx = Math.sin(Math.PI / 6) * R.arm * s;
  const hy = Math.cos(Math.PI / 6) * R.arm * s;
  const kx = Math.sin(Math.PI / 6) * R.leg * s;
  const ky = Math.cos(Math.PI / 6) * R.leg * s;
  const pts = [
    mkPt(px, py - R.body * s - R.neck * s, R.neck + 3),
    mkPt(px, py - R.body * s, 2),
    mkPt(px, py, 3),
    mkPt(px - ax, py - R.body * s + ay, 2),
    mkPt(px + ax, py - R.body * s + ay, 2),
    mkPt(px - ax - hx, py - R.body * s + ay + hy, 2),
    mkPt(px + ax + hx, py - R.body * s + ay + hy, 2),
    mkPt(px - kx, py + ky, 2),
    mkPt(px + kx, py + ky, 2),
    mkPt(px - kx, py + ky + R.leg * s, 2),
    mkPt(px + kx, py + ky + R.leg * s, 2),
  ];
  return {
    pts,
    savedFootX: [pts[FL].x, pts[FR].x],
    supportFoot: 0,
    grounded: false,
    lastGroundedT: 0,
  };
}

function mkPt(x, y, r) {
  return { x, y, px: x, py: y, vx: 0, vy: 0, r };
}

export function stepPhysics(body, map, dt = STEP) {
  const pts = body.pts;
  for (let i = 0; i < 11; i++) {
    const p = pts[i];
    p.px = p.x;
    p.py = p.y;
    let ayMul = DEFAULT_AY;
    if (i === HEAD) ayMul = HEAD_AY;
    else if (i === HL || i === HR) ayMul = HAND_AY;
    else if (i === FL || i === FR) ayMul = FOOT_AY;
    p.vy += GRAV * ayMul * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  // 顺序很重要：先夹地面，再解约束 —— 约束才能把身体"撑"起来。
  // 反过来（先约束后夹地）会让骨盆/膝盖被钉在地面线上，人永远躺平。
  handleCollisions(body, map, dt);
  solveConstraints(pts, 3);
  // 约束会把脚压进平台/地面，再碰一次，避免"穿过平台"和穿地
  handleCollisions(body, map, dt, true);
  // 约束可能把脚压进地里，做一次软回夹，避免穿地
  for (const p of pts) {
    if (p.y > WORLD.groundY + 4) {
      p.y = WORLD.groundY + 4;
      if (p.vy > 0) p.vy = 0;
    }
    p.vx *= DAMP;
    p.vy *= DAMP;
  }
}

export function solveConstraints(pts, iters = 2) {
  for (let it = 0; it < iters; it++) {
    for (const [a, b, len] of BONES) {
      if (a === NECK && (b === EL || b === ER)) {
        unoDir(pts[b], pts[a], len);
      } else {
        biAvg(pts[a], pts[b], len);
      }
    }
    biAvg(pts[PELVIS], pts[NECK], R.body);
    biAvg(pts[HEAD], pts[NECK], R.neck);
    if (ptDist(pts[HL], pts[HR]) < R.minGap) {
      biAvg(pts[HL], pts[HR], R.minGap);
    }
    if (ptDist(pts[FL], pts[FR]) < R.minGap) {
      biAvg(pts[FL], pts[FR], R.minGap);
    }
  }
}

export function moveBody(body, walkx, dt = STEP) {
  const pts = body.pts;
  const spd = CONFIG.player.walkSpeed;
  if (!body.savedFootX) body.savedFootX = [pts[FL].x, pts[FR].x];
  if (body.supportFoot == null) body.supportFoot = 0;
  // 原版：手臂速度每帧清零，瞄准/后坐力再单独给
  pts[EL].vx = pts[ER].vx = 0;
  pts[HL].vx = pts[HR].vx = 0;
  if (walkx !== 0) {
    pts[NECK].vx = walkx * spd * 0.6;
    const sf = body.supportFoot;
    const supFoot = sf === 0 ? FL : FR;
    const movFoot = sf === 0 ? FR : FL;
    const supKnee = sf === 0 ? KL : KR;
    const movKnee = sf === 0 ? KR : KL;
    // 支撑脚钉在上一帧位置（滑步的来源）
    pts[supFoot].vx = 0;
    pts[supFoot].x = body.savedFootX[sf];
    // 摆动脚向前送，膝盖带一点
    pts[movKnee].vx = walkx * spd;
    pts[movFoot].vx = walkx * spd;
    pts[supKnee].vx = walkx * spd * 0.2;
    if (Math.abs(pts[FL].x - pts[FR].x) > 30) body.supportFoot = 1 - body.supportFoot;
  } else {
    pts[NECK].vx = 0;
    pts[PELVIS].vx *= 0.7;
  }
}

export function setJumpPose(body) {
  const pts = body.pts;
  pts[HL].vx += -20;
  pts[HR].vx += 20;
  pts[FL].vx += -10;
  pts[FR].vx += 10;
}

export function aimBody(body, aimX, aimY, strength = 1) {
  const hand = body.pts[HR];
  const dx = aimX - hand.x;
  const dy = aimY - hand.y;
  const d = Math.hypot(dx, dy) || 1;
  hand.vx = (dx / d) * 380 * strength;
  hand.vy = (dy / d) * 380 * strength;
}

export function getGunDir(body) {
  const hand = body.pts[HR];
  const elbow = body.pts[ER];
  const dx = hand.x - elbow.x;
  const dy = hand.y - elbow.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

export function getGunTip(body, gunLen = 10) {
  const hand = body.pts[HR];
  const dir = getGunDir(body);
  return { x: hand.x + dir.x * gunLen, y: hand.y + dir.y * gunLen };
}

export function ragdollDeath(body, rngFn) {
  for (const p of body.pts) {
    p.vx += (rngFn() - 0.5) * 400;
    p.vy += (rngFn() - 0.5) * 300 - 100;
  }
}

export function stepRagdoll(body, sink, map, dt = STEP) {
  const pts = body.pts;
  for (let i = 0; i < 11; i++) {
    const p = pts[i];
    p.px = p.x;
    p.py = p.y;
    let ayMul;
    if (i === HEAD) ayMul = 0.15;
    else if (i === HL || i === HR) ayMul = 0.05;
    else if (i === EL || i === ER) ayMul = 0.02;
    else ayMul = 0.25;
    p.vy += GRAV * ayMul * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  solveConstraints(pts, 1);
  const groundY = WORLD.groundY;
  for (const p of pts) {
    if (p.y > groundY + sink) {
      p.y = groundY + sink;
      if (p.vy > 0) p.vy *= -0.15;
      p.vx *= 0.92;
    }
    if (p.x < 4) { p.x = 4; p.vx *= -0.3; }
    if (p.x > WORLD.w - 4) { p.x = WORLD.w - 4; p.vx *= -0.3; }
  }
}

export function updateSink(entity, dt) {
  if (!entity.dead) return;
  const rate = dt * 0.08 * Math.pow(1 + Math.abs(entity.sink || 0), 4);
  if (entity.kind === 'player') {
    entity.sink = (entity.sink || 0) - rate * 0.5;
  } else {
    entity.sink = (entity.sink || 0) + rate;
  }
}

function handleCollisions(body, map, dt, soft = false) {
  const pts = body.pts;
  const groundY = WORLD.groundY;
  let anyGround = false;
  for (let i = 0; i < 11; i++) {
    const p = pts[i];
    if (p.y > groundY) {
      p.y = groundY;
      if (p.vy > 0) p.vy *= -0.15;
      p.vx *= GROUND_FRIC;
      anyGround = true;
    }
  }
  if (map && map.platforms) {
    for (const plat of map.platforms) {
      for (let i = 0; i < 11; i++) {
        const p = pts[i];
        if (p.x >= plat.x && p.x <= plat.x + plat.w) {
          if (p.py <= plat.y + 2 && p.y >= plat.y && p.vy >= 0) {
            p.y = plat.y;
            if (p.vy > 0) p.vy = 0;
            p.vx *= GROUND_FRIC;
            anyGround = true;
          }
        }
      }
    }
  }
  for (const p of pts) {
    if (p.x < 4) { p.x = 4; p.vx *= -WORLD.wallBounce; }
    if (p.x > WORLD.w - 4) { p.x = WORLD.w - 4; p.vx *= -WORLD.wallBounce; }
    if (p.y < -60) { p.y = -60; if (p.vy < 0) p.vy *= -0.1; }
  }
  if (soft) {
    body.grounded = body.grounded || anyGround;
    if (anyGround) body.lastGroundedT = 0;
  } else {
    body.grounded = anyGround;
    if (anyGround) body.lastGroundedT = 0;
    else body.lastGroundedT += dt;
    body.savedFootX[0] = pts[FL].x;
    body.savedFootX[1] = pts[FR].x;
  }
}

function unoDir(a, b, len) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) { a.x = b.x; a.y = b.y - len; return; }
  a.x = b.x + (dx / d) * len;
  a.y = b.y + (dy / d) * len;
}

function biAvg(a, b, len) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  let nx; let ny;
  if (d < 1e-4) { nx = 0; ny = -1; } else { nx = dx / d; ny = dy / d; }
  const dist = d < 1e-4 ? 0 : d;
  const off = (dist - len) * 0.5;
  a.x += nx * off;
  a.y += ny * off;
  b.x -= nx * off;
  b.y -= ny * off;
  const avx = (a.vx + b.vx) * 0.5;
  const avy = (a.vy + b.vy) * 0.5;
  a.vx = b.vx = avx;
  a.vy = b.vy = avy;
}

function ptDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getBodyCenter(body) {
  const p = body.pts[PELVIS];
  return { x: p.x, y: p.y };
}

export function isGrounded(body) {
  return body.grounded;
}

export function timeSinceGrounded(body) {
  return body.lastGroundedT;
}

export function applyImpulse(body, dx, dy, scale = 1) {
  for (const p of body.pts) {
    p.vx += dx * scale;
    p.vy += dy * scale;
  }
}

export function applyRecoil(body, dirX, dirY, kick, mass = 1) {
  const pe = body.pts[PELVIS];
  pe.vx -= dirX * kick / mass;
  pe.vy -= dirY * kick / mass;
  for (const idx of [HL, HR]) {
    body.pts[idx].vx -= dirX * kick * 0.3 / mass;
    body.pts[idx].vy -= dirY * kick * 0.3 / mass;
  }
  body.pts[HEAD].vx -= dirX * kick * 0.15 / mass;
  body.pts[HEAD].vy -= dirY * kick * 0.1 / mass;
}

export function setBodyPos(body, x, y) {
  const c = getBodyCenter(body);
  const dx = x - c.x;
  const dy = y - c.y;
  for (const p of body.pts) {
    p.x += dx; p.y += dy;
    p.px += dx; p.py += dy;
  }
}

export { PELVIS, HEAD as HEAD_IDX, NECK as NECK_IDX, HL as HL_IDX, HR as HR_IDX, FL as FL_IDX, FR as FR_IDX };
