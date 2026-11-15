// src/game/sim.js — 24 洞 3D 迷你高尔夫纯逻辑模拟。
// 不碰 DOM/window/localStorage/Date.now；随机不用（几何全在 config/holes.js）。
// 物理：cannon-es 球体（重力 + 地面接触 + 弹性墙碰撞），坡地/风/滚动摩擦为代码施加的力，
//       机关/水障/洞判定全部代码（契约：判定几何/碰撞/命中全部代码）。
import { World, Body, Box, Sphere, Plane, Material, ContactMaterial, Vec3 } from '../../lib/cannon-es.js';
import { GOLF, PALETTE } from '../../config/game.config.js';
import { HOLES, totalPar } from '../../config/holes.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EPS = 1e-6;

// ---------------------------------------------------------------- 判定工具
function inCircle(x, z, cx, cz, r) { return (x - cx) ** 2 + (z - cz) ** 2 <= r * r; }
function inRect(x, z, cx, cz, w, d) { return Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= d / 2; }

/** 单洞成绩名：ace/eagle/birdie/par/bogey/double/busted */
export function holeResult(strokes, par) {
  if (strokes === 1) return 'ace';
  const d = par - strokes;
  if (d >= 2) return 'eagle';
  if (d === 1) return 'birdie';
  if (d === 0) return 'par';
  if (d === -1) return 'bogey';
  if (d === -2) return 'double';
  return 'busted';
}

/** 24 洞总评级：总杆相对总 par */
export function rating(totalStrokes, totalParValue) {
  const diff = totalParValue - totalStrokes;
  if (diff >= 6) return 'S';
  if (diff >= 3) return 'A';
  if (diff >= 0) return 'B';
  if (diff >= -4) return 'C';
  return 'D';
}

// ---------------------------------------------------------------- cannon-es 世界
const BALL_MAT = new Material('ball');
const WALL_MAT = new Material('wall');
const GROUND_MAT = new Material('ground');

function makeWorld() {
  const world = new World({ gravity: new Vec3(0, -9.82, 0) });
  world.defaultContactMaterial = new ContactMaterial(GROUND_MAT, GROUND_MAT, { friction: 0, restitution: 0 });
  world.addContactMaterial(new ContactMaterial(BALL_MAT, GROUND_MAT, { friction: 0, restitution: 0 }));
  world.addContactMaterial(new ContactMaterial(BALL_MAT, WALL_MAT, { friction: 0, restitution: GOLF.RESTITUTION }));

  // 果岭地面（水平面，y=0；坡地以重力分量施加，视觉画箭头）
  const ground = new Body({ mass: 0, shape: new Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.material = GROUND_MAT;
  world.addBody(ground);

  // 四周弹性墙（Box）
  const W = GOLF.GREEN_W, D = GOLF.GREEN_D, T = 2;
  const wall = (cx, cz, hx, hz) => {
    const b = new Body({ mass: 0, shape: new Box(new Vec3(hx, 1, hz)), position: new Vec3(cx, 1, cz) });
    b.material = WALL_MAT;
    world.addBody(b);
  };
  wall(0, D / 2, T / 2, D / 2 + T);
  wall(W, D / 2, T / 2, D / 2 + T);
  wall(W / 2, 0, W / 2 + T, T / 2);
  wall(W / 2, D, W / 2 + T, T / 2);

  return world;
}

// ---------------------------------------------------------------- 创建一局
export function createRun({ seed = 1, holeIndex = 0 } = {}) {
  const world = makeWorld();
  const ballBody = new Body({
    mass: 1,
    shape: new Sphere(GOLF.BALL_R),
    position: new Vec3(0, GOLF.BALL_R, 0),
    linearDamping: 0,
    angularDamping: 0,
  });
  ballBody.material = BALL_MAT;
  world.addBody(ballBody);

  const run = {
    seed,
    world,
    ballBody,
    ball: { x: 0, y: GOLF.BALL_R, z: 0, vx: 0, vz: 0, _px: 0, _pz: 0 },
    aim: { active: false, dirX: 1, dirZ: 0, power: 0 },
    phase: 'aim',            // aim | roll | capture | finished
    holeIndex: holeIndex % HOLES.length,
    hole: HOLES[holeIndex % HOLES.length],
    holeStrokes: 0,
    totalStrokes: 0,
    totalPar: totalPar(),
    penalties: 0,
    busts: 0,
    aces: 0,
    birdies: 0,
    time: 0,
    holeTime: 0,
    rollEventT: 0,
    rollT: 0,
    captureT: 0,
    lastResult: null,
    _wasSand: false,
    _bounceCd: 0,
    _wmCd: 0,
    events: [],
  };

  placeBall(run);
  run.events.push({ type: 'start', hole: run.holeIndex + 1 });
  return run;
}

function placeBall(run) {
  const h = run.hole;
  run.holeTime = 0;
  run.ballBody.position.set(h.tee[0], GOLF.BALL_R, h.tee[1]);
  run.ballBody.velocity.set(0, 0, 0);
  run.ballBody.angularVelocity.set(0, 0, 0);
  run.ball.x = h.tee[0];
  run.ball.y = GOLF.BALL_R;
  run.ball.z = h.tee[1];
  run.ball.vx = 0;
  run.ball.vz = 0;
}

// ---------------------------------------------------------------- 击球
export function shoot(run, { dirX = 1, dirZ = 0, power = 0 } = {}) {
  if (run.phase !== 'aim') return { ok: false, reason: 'not_aiming' };
  const p = clamp(power, 0, 1);
  const len = Math.hypot(dirX, dirZ);
  if (len < EPS || p <= 0.02) return { ok: false, reason: 'no_power' };
  const nx = dirX / len, nz = dirZ / len;
  const v = p * GOLF.MAX_SPEED;
  run.ballBody.velocity.set(nx * v, 0, nz * v);
  run.ball.vx = nx * v;
  run.ball.vz = nz * v;
  run.holeStrokes += 1;
  run.phase = 'roll';
  run.holeTime = 0;
  run.rollEventT = 0;
  run.rollT = 0;
  run.aim.active = false;
  run.aim.power = 0;
  run.events.push({ type: 'shot', hole: run.holeIndex + 1, strokes: run.holeStrokes, power: p });
  return { ok: true, power: p, dirX: nx, dirZ: nz };
}

/** R 重打：+1 杆并回开球点（仅 aim 阶段可用）。 */
export function resetShot(run) {
  if (run.phase !== 'aim') return false;
  run.holeStrokes += 1;
  placeBall(run);
  run.events.push({ type: 'penalty', reason: 'replay' });
  checkBust(run);
  return true;
}

// ---------------------------------------------------------------- 单步
export function step(run, dt = 1 / 60) {
  run.time += dt;
  if (run.phase === 'aim') {
    run.holeTime += dt;
    if (run.holeTime >= GOLF.SHOT_CLOCK) {
      timeoutBust(run);
      return;
    }
  }
  if (run.phase === 'roll') stepRoll(run, dt);
  else if (run.phase === 'capture') stepCapture(run, dt);
}

function stepRoll(run, dt) {
  const b = run.ballBody;
  const h = run.hole;
  run.rollT += dt;
  run.ball._px = b.position.x;
  run.ball._pz = b.position.z;

  // 坡地重力分量 + 风（常量加速度）
  b.velocity.x += (h.slope[0] * GOLF.SLOPE_ACCEL + h.wind[0] * GOLF.WIND_MAX) * dt;
  b.velocity.z += (h.slope[1] * GOLF.SLOPE_ACCEL + h.wind[1] * GOLF.WIND_MAX) * dt;

  run.world.step(dt);

  // 滚动摩擦（恒定滚动阻力，Coulomb 式；沙坑更粘）
  const inSand = !!(h.sand && inCircle(b.position.x, b.position.z, h.sand.x, h.sand.z, h.sand.r));
  const resist = (inSand ? GOLF.ROLL_RESIST * GOLF.SAND_MULT : GOLF.ROLL_RESIST) * dt;
  const sp2 = Math.hypot(b.velocity.x, b.velocity.z);
  if (sp2 > 0) {
    const k = Math.max(0, 1 - resist / sp2);
    b.velocity.x *= k;
    b.velocity.z *= k;
  }
  b.angularVelocity.x *= Math.max(0, 1 - GOLF.ROLL_RESIST * dt);
  b.angularVelocity.z *= Math.max(0, 1 - GOLF.ROLL_RESIST * dt);

  // 同步镜像
  run.ball.x = b.position.x;
  run.ball.y = b.position.y;
  run.ball.z = b.position.z;
  run.ball.vx = b.velocity.x;
  run.ball.vz = b.velocity.z;

  // 周期性 roll 事件（保持事件密度，idle 不飙）
  run.rollEventT -= dt;
  if (run.rollEventT <= 0) {
    run.rollEventT = 0.4;
    run.events.push({ type: 'roll', x: run.ball.x, z: run.ball.z });
  }

  // 沙坑进入事件
  if (inSand && !run._wasSand) { run._wasSand = true; run.events.push({ type: 'sand' }); }
  else if (!inSand) run._wasSand = false;

  // 机制（代码判定）
  applyMechanisms(run, dt);

  // 水障：+1 杆回原位
  if (h.water && inRect(run.ball.x, run.ball.z, h.water.x, h.water.z, h.water.w, h.water.d)) {
    run.penalties += 1;
    run.holeStrokes += 1;
    run.events.push({ type: 'penalty', reason: 'water' });
    placeBall(run);
    run.phase = 'aim';
    checkBust(run);
    return;
  }

  // 洞判定
  if (checkHole(run)) return;

  // 停球（低于停速，或长时间滚动兜底，防坡地绕洞沿死循环）
  const sp = Math.hypot(run.ball.vx, run.ball.vz);
  if (sp < GOLF.STOP_SPEED || run.rollT > 15) {
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    run.ball.vx = 0;
    run.ball.vz = 0;
    run.phase = 'aim';
    run.events.push({ type: 'stop', x: run.ball.x, z: run.ball.z });
    checkBust(run);
  }
}

// ---------------------------------------------------------------- 机关
function applyMechanisms(run, dt) {
  const h = run.hole;
  run._bounceCd = Math.max(0, run._bounceCd - dt);
  run._wmCd = Math.max(0, run._wmCd - dt);

  // 风车：叶片周期性挡路 → 切向偏转 + 减速
  if (h.windmill) {
    const w = h.windmill;
    if (run._wmCd <= 0 && inCircle(run.ball.x, run.ball.z, w.x, w.z, w.r)) {
      const ang = Math.atan2(run.ball.z - w.z, run.ball.x - w.x);
      const blade = w.omega * run.time;
      let diff = Math.abs(ang - blade) % (Math.PI * 2);
      diff = Math.min(diff, Math.PI * 2 - diff);
      if (diff < w.bladeWidth) {
        const tx = -(run.ball.z - w.z), tz = run.ball.x - w.x;
        const tl = Math.hypot(tx, tz) || 1;
        run.ball.vx = (tx / tl) * 1.5;
        run.ball.vz = (tz / tl) * 1.5;
        run.ballBody.velocity.x = run.ball.vx;
        run.ballBody.velocity.z = run.ball.vz;
        run._wmCd = 0.6;
        run.events.push({ type: 'windmill_hit' });
      }
    }
  }

  // 弹板：进入矩形 → 向上弹起
  if (h.bounce && run._bounceCd <= 0) {
    const p = h.bounce;
    if (inRect(run.ball.x, run.ball.z, p.x, p.z, p.w, p.d) && run.ball.y <= GOLF.BALL_R * 2) {
      run.ballBody.velocity.y = GOLF.BOUNCE_VY;
      run._bounceCd = 0.5;
      run.events.push({ type: 'bounce', reason: 'pad' });
    }
  }

  // 移动门：周期开合，闭合时挡在 x=gate.x 处
  if (h.gate) {
    const g = h.gate;
    const open = Math.sin(run.time * g.omega) > -0.35; // 大部分时间开
    if (!open) {
      const crossed = (run.ball._px < g.x && run.ball.x >= g.x) || (run.ball._px > g.x && run.ball.x <= g.x);
      const inLane = Math.abs(run.ball.z - g.z) < g.d / 2 + GOLF.BALL_R;
      if (crossed && inLane) {
        // 弹回原侧
        run.ball.x = run.ball._px;
        run.ballBody.position.x = run.ball._px;
        run.ballBody.velocity.x = -run.ballBody.velocity.x * GOLF.RESTITUTION;
        run.ball.vx = run.ballBody.velocity.x;
        run.events.push({ type: 'gate_block' });
      }
    }
  }
}

// ---------------------------------------------------------------- 洞判定
function checkHole(run) {
  const h = run.hole;
  const dx = run.ball.x - h.hole[0];
  const dz = run.ball.z - h.hole[1];
  const dist = Math.hypot(dx, dz);
  const sp = Math.hypot(run.ball.vx, run.ball.vz);

  if (dist < GOLF.HOLE_R && sp < GOLF.CAPTURE_SPEED) {
    run.phase = 'capture';
    run.captureT = 0;
    run.ballBody.velocity.set(0, 0, 0);
    run.ballBody.angularVelocity.set(0, 0, 0);
    run.ball.vx = 0;
    run.ball.vz = 0;
    run.events.push({ type: 'capture', hole: run.holeIndex + 1 });
    return true;
  }
  if (dist < GOLF.RIM_R && sp >= GOLF.CAPTURE_SPEED) {
    // 擦洞沿：切向减速、法向弹开（签名记忆点：绕洞沿转）
    const tx = -dz / dist, tz = dx / dist;
    const nx = dx / dist, nz = dz / dist;
    const dot = run.ball.vx * tx + run.ball.vz * tz;
    const ndot = run.ball.vx * nx + run.ball.vz * nz;
    run.ball.vx = tx * dot * 0.78 - nx * Math.abs(ndot) * 0.35;
    run.ball.vz = tz * dot * 0.78 - nz * Math.abs(ndot) * 0.35;
    run.ballBody.velocity.x = run.ball.vx;
    run.ballBody.velocity.z = run.ball.vz;
    run.events.push({ type: 'near_miss' });
  }
  return false;
}

// 进洞吸入：绕洞一圈后掉进去（签名动画）
function stepCapture(run, dt) {
  run.captureT += dt;
  const h = run.hole;
  const t = clamp(run.captureT / GOLF.CAPTURE_SEC, 0, 1);
  const ang = t * Math.PI * 2;
  const r = GOLF.RIM_R * (1 - t) + GOLF.HOLE_R * 0.2;
  run.ball.x = h.hole[0] + Math.cos(ang) * r;
  run.ball.z = h.hole[1] + Math.sin(ang) * r;
  const y = GOLF.BALL_R * (1 - t);
  run.ballBody.position.set(run.ball.x, Math.max(0, y), run.ball.z);
  run.ball.y = Math.max(0, y);
  if (run.captureT >= GOLF.CAPTURE_SEC) finishHole(run);
}

function finishHole(run) {
  const h = run.hole;
  const strokes = run.holeStrokes;
  const result = holeResult(strokes, h.par);
  run.totalStrokes += strokes;
  if (result === 'ace') run.aces += 1;
  if (result === 'ace' || result === 'eagle' || result === 'birdie') run.birdies += 1;
  run.lastResult = result;
  run.events.push({ type: 'hole', hole: run.holeIndex + 1, strokes, par: h.par, result });
  run.events.push({ type: 'level_clear', hole: run.holeIndex + 1 });
  if (run.holeIndex + 1 >= HOLES.length) {
    run.phase = 'finished';
    run.events.push({ type: 'finished', total: run.totalStrokes, par: run.totalPar, rating: rating(run.totalStrokes, run.totalPar) });
  } else {
    advanceHole(run);
  }
}

function advanceHole(run) {
  run.holeIndex += 1;
  run.hole = HOLES[run.holeIndex];
  run.holeStrokes = 0;
  run._wasSand = false;
  run._bounceCd = 0;
  run._wmCd = 0;
  placeBall(run);
  run.phase = 'aim';
}

// 爆杆上限：杆数达到 par+3 仍未进洞 → 记 par+3 自动推进
function timeoutBust(run) {
  run.holeStrokes = run.hole.par + GOLF.BUST_STROKES;
  checkBust(run);
}

function checkBust(run) {
  const h = run.hole;
  if (run.holeStrokes >= h.par + GOLF.BUST_STROKES) {
    run.busts += 1;
    const strokes = h.par + GOLF.BUST_STROKES;
    run.totalStrokes += strokes;
    run.lastResult = 'busted';
    run.events.push({ type: 'busted', hole: run.holeIndex + 1, strokes, par: h.par });
    run.events.push({ type: 'level_clear', hole: run.holeIndex + 1 });
    if (run.holeIndex + 1 >= HOLES.length) {
      run.phase = 'finished';
      run.events.push({ type: 'finished', total: run.totalStrokes, par: run.totalPar, rating: rating(run.totalStrokes, run.totalPar) });
    } else {
      advanceHole(run);
    }
  }
}

// ---------------------------------------------------------------- 瞄准解算（greedy bot / 提示）
// 与 stepRoll 同一套积分（摩擦+坡+风，无墙/机关）：二分力度匹配停止距离，再迭代校正方向偏转。
function mirrorEnd(x0, z0, dirX, dirZ, power, h, maxSec = 30) {
  const dt = 1 / 60;
  const ax = h.slope[0] * GOLF.SLOPE_ACCEL + h.wind[0] * GOLF.WIND_MAX;
  const az = h.slope[1] * GOLF.SLOPE_ACCEL + h.wind[1] * GOLF.WIND_MAX;
  let vx = dirX * power * GOLF.MAX_SPEED;
  let vz = dirZ * power * GOLF.MAX_SPEED;
  let x = x0, z = z0;
  for (let t = 0; t < maxSec; t += dt) {
    vx += ax * dt; vz += az * dt;
    x += vx * dt; z += vz * dt;
    const s = Math.hypot(vx, vz);
    if (s < GOLF.STOP_SPEED) break;
    const k = Math.max(0, 1 - (GOLF.ROLL_RESIST * dt) / s);
    vx *= k; vz *= k;
  }
  return { x, z };
}

/** 预测前 seconds 秒弹道（受风/坡影响，不含墙/机关），供瞄准线绘制。 */
export function predict(run, dirX, dirZ, power, seconds = 2) {
  const h = run.hole;
  const dt = 1 / 60;
  const ax = h.slope[0] * GOLF.SLOPE_ACCEL + h.wind[0] * GOLF.WIND_MAX;
  const az = h.slope[1] * GOLF.SLOPE_ACCEL + h.wind[1] * GOLF.WIND_MAX;
  let vx = dirX * power * GOLF.MAX_SPEED;
  let vz = dirZ * power * GOLF.MAX_SPEED;
  let x = run.ball.x, z = run.ball.z;
  const pts = [];
  for (let t = 0; t < seconds; t += dt) {
    vx += ax * dt; vz += az * dt;
    x += vx * dt; z += vz * dt;
    const s = Math.hypot(vx, vz);
    if (s > 0) { const k = Math.max(0, 1 - (GOLF.ROLL_RESIST * dt) / s); vx *= k; vz *= k; }
    pts.push([x, z]);
  }
  return pts;
}

/** 朝洞方向 + 力度按距离（含坡地/风补偿），供 greedy bot 与提示用。 */
export function solveAim(run) {
  const h = run.hole;
  const x0 = run.ball.x, z0 = run.ball.z;
  const tx = h.hole[0], tz = h.hole[1];
  const dist = Math.hypot(tx - x0, tz - z0) || 1;
  let dirX = (tx - x0) / dist, dirZ = (tz - z0) / dist;

  const bisect = () => {
    let lo = 0.02, hi = 1.0;
    for (let i = 0; i < 14; i += 1) {
      const mid = (lo + hi) / 2;
      const e = mirrorEnd(x0, z0, dirX, dirZ, mid, h);
      if (Math.hypot(e.x - x0, e.z - z0) < dist) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  let power = bisect();
  for (let i = 0; i < 5; i += 1) {
    const e = mirrorEnd(x0, z0, dirX, dirZ, power, h);
    const ex = tx - e.x, ez = tz - e.z;
    if (Math.hypot(ex, ez) < 0.4) break;
    const nx = (tx - x0) + ex, nz = (tz - z0) + ez;
    const nl = Math.hypot(nx, nz) || 1;
    dirX = nx / nl; dirZ = nz / nl;
    power = bisect();
  }
  return { dirX, dirZ, power: clamp(power, 0.03, 1) };
}

// ---------------------------------------------------------------- HUD / 事件
export function getHud(run) {
  const h = run.hole;
  return {
    hole: run.holeIndex + 1,
    holeOf: HOLES.length,
    par: h.par,
    strokes: run.holeStrokes,
    total: run.totalStrokes,
    totalPar: run.totalPar,
    wind: h.wind,
    slope: h.slope,
    phase: run.phase,
    aiming: run.aim.active,
    power: run.aim.power,
    result: run.lastResult,
  };
}

export function drainEvents(run) {
  return run.events.splice(0);
}

export { HOLES, totalPar, PALETTE };
