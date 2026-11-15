// src/game/sim.js — 纯逻辑核心：第一人称平台跳跃（coyote/buffer/dash）+ 10 层霓虹塔平台碰撞。
// 无 DOM / THREE / Date.now；随机不使用（关卡布局确定）。60Hz 固定步长由 main / selfplay 调用。
import { STEP, PHYS, WORLD, CRUMBLE, WIND, RATINGS, TOWER, PLATFORMS } from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

export function ratingFor(falls, time) {
  if (falls <= RATINGS.S.maxFalls && time <= RATINGS.S.maxTime) return 'S';
  if (falls <= RATINGS.A.maxFalls && time <= RATINGS.A.maxTime) return 'A';
  if (falls <= RATINGS.B.maxFalls && time <= RATINGS.B.maxTime) return 'B';
  return 'C';
}

function emit(run, type, extra) {
  run.events.push({ type, ...extra });
}

function platformById(run, id) {
  return run.platforms.find((q) => q.id === id);
}

// 玩家 XZ 是否落在平台脚印内（margin 用于边缘宽容）
export function contains(p, x, z, margin = 0) {
  return Math.abs(x - p.x) <= p.half + margin && Math.abs(z - p.z) <= p.half + margin;
}

export function createSim(opts = {}) {
  const platforms = PLATFORMS.map((p) => ({
    id: p.id, floor: p.floor, kind: p.kind, type: p.type,
    baseX: p.base[0], baseY: p.base[1], baseZ: p.base[2],
    half: p.half, crumble: !!p.crumble,
    axisX: p.axis ? p.axis[0] : 0, axisZ: p.axis ? p.axis[2] : 0,
    amp: p.amp || 0, period: p.period || 1, phase: p.phase || 0,
    orbitCx: p.orbitCx, orbitCz: p.orbitCz, orbitR: p.orbitR || 0,
    orbitSpeed: p.orbitSpeed || 0, orbitPhase: p.orbitPhase || 0,
    x: p.base[0], y: p.base[1], z: p.base[2],
    dx: 0, dy: 0, dz: 0,
    crumbleT: 0, crumbling: false, collapsed: false,
  }));
  const start = platforms.find((q) => q.id === 'landing-1');
  return {
    seed: opts.seed ?? 1,
    phase: 'playing',
    time: 0,
    tickT: 0,
    windT: 0,
    windDir: 1,             // +1 = 推 +X（风向标 ▶），-1 = 推 -X（◀）
    floor: 1,
    maxFloor: 1,
    checkpointFloor: 1,
    falls: 0,
    firstInput: false,
    rating: null,
    platforms,
    player: {
      x: start.x, y: start.y, z: start.z,
      vx: 0, vy: 0, vz: 0,
      yaw: Math.PI,          // 面朝 +Z：配合螺旋起始角，开场面朝塔心即见整座塔
      pitch: 1.0,            // 仰视约 57°，整座塔（塔心 + 各层霓虹圈 + 塔顶）入画
      onGround: true,
      groundPlat: start.id,
      coyote: 0, jumpBuffer: 0, dashAvailable: true, dashT: 0,
    },
    events: [{ type: 'start' }],
  };
}

function updatePlatforms(run, dt) {
  const t = run.time;
  for (const p of run.platforms) {
    if (p.collapsed) { p.dx = p.dy = p.dz = 0; continue; }
    let x = p.baseX, y = p.baseY, z = p.baseZ;
    if (p.type === 'moveH') {
      const o = p.amp * Math.sin(p.phase + t * (TAU / p.period));
      x += p.axisX * o; z += p.axisZ * o;
    } else if (p.type === 'moveV') {
      y += p.amp * Math.sin(p.phase + t * (TAU / p.period));
    } else if (p.type === 'rotate') {
      const a = p.orbitPhase + t * p.orbitSpeed;
      x = p.orbitCx + Math.cos(a) * p.orbitR;
      z = p.orbitCz + Math.sin(a) * p.orbitR;
    }
    p.dx = x - p.x; p.dy = y - p.y; p.dz = z - p.z;
    p.x = x; p.y = y; p.z = z;
    if (p.crumble && p.crumbling) {
      p.crumbleT -= dt;
      if (p.crumbleT <= 0) {
        p.collapsed = true;
        emit(run, 'crumble', { id: p.id, floor: p.floor });
      }
    }
  }
}

function applyWind(run, p, dt) {
  if (p.y < WORLD.WIND_MIN_Y) return;
  run.windT += dt;
  if (run.windT >= WIND.period) {
    run.windT -= WIND.period;
    run.windDir *= -1;
    emit(run, 'wind_gust', { dir: run.windDir });
  }
  p.vx += WIND.force * run.windDir * dt;
}

function respawn(run) {
  const target = platformById(run, `landing-${run.checkpointFloor}`);
  const p = run.player;
  if (!target) return;
  p.x = target.x; p.y = target.y; p.z = target.z;
  p.vx = 0; p.vy = 0; p.vz = 0;
  p.onGround = true; p.groundPlat = target.id;
  p.dashAvailable = true;
  p.coyote = 0; p.jumpBuffer = 0;
  run.floor = run.checkpointFloor;
}

export function updateSim(run, input = {}) {
  if (run.phase !== 'playing') return run;
  const dt = STEP;
  const p = run.player;
  const i = {
    moveF: 0, moveS: 0, jump: false, dash: false, lookX: 0, lookY: 0, respawn: false, ...input,
  };

  // 视角（lookX/lookY 为弧度增量）
  p.yaw -= i.lookX;
  p.pitch = clamp(p.pitch - i.lookY, -PHYS.pitchClamp, PHYS.pitchClamp);

  // 平台先动（记录 delta 供携带）
  updatePlatforms(run, dt);

  const gp = p.groundPlat ? platformById(run, p.groundPlat) : null;
  if (gp && gp.collapsed) { p.onGround = false; p.groundPlat = null; }

  // 移动平台水平携带
  if (p.onGround && gp && !gp.collapsed) {
    p.x += gp.dx; p.z += gp.dz;
  }

  // 期望速度（世界系，yaw 决定面朝）
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  let mf = clamp(i.moveF, -1, 1), ms = clamp(i.moveS, -1, 1);
  const len = Math.hypot(mf, ms);
  if (len > 1) { mf /= len; ms /= len; }
  const wx = (ms * cos - mf * sin) * PHYS.moveSpeed;
  const wz = (-mf * cos - ms * sin) * PHYS.moveSpeed;

  const accel = p.onGround ? PHYS.accel : PHYS.accel * PHYS.airControl;
  const blend = Math.min(1, (accel * dt / PHYS.moveSpeed) * 2);
  p.vx += (wx - p.vx) * blend;
  p.vz += (wz - p.vz) * blend;
  if (p.onGround && len < 0.01) {
    const d = Math.max(0, 1 - PHYS.friction * dt);
    p.vx *= d; p.vz *= d;
  }

  // 首次输入
  if (!run.firstInput && (Math.abs(i.moveF) > 0.05 || Math.abs(i.moveS) > 0.05 || i.jump || i.dash)) {
    run.firstInput = true;
    emit(run, 'first_input');
  }

  // coyote + jump buffer + 跳跃
  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
  if (i.jump) p.jumpBuffer = PHYS.jumpBuffer; else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = PHYS.jumpVel;
    p.onGround = false; p.groundPlat = null;
    p.coyote = 0; p.jumpBuffer = 0;
    emit(run, 'jump');
  }

  // 空中冲刺（1 次，落地回充）
  p.dashT = Math.max(0, p.dashT - dt);
  if (i.dash && p.dashAvailable && !p.onGround) {
    p.dashAvailable = false;
    let dx, dz;
    if (len > 0.01) { dx = ms * cos - mf * sin; dz = -mf * cos - ms * sin; }
    else { dx = -sin; dz = -cos; }
    p.vx = dx * PHYS.dashSpeed;
    p.vz = dz * PHYS.dashSpeed;
    p.vy = Math.max(p.vy, PHYS.dashUp);
    p.dashT = 0.15;
    emit(run, 'dash');
  }

  // 重力
  if (p.onGround) p.vy = 0; else p.vy -= PHYS.gravity * dt;

  // 侧风（7 层起）
  applyWind(run, p, dt);

  // 积分
  const prevY = p.y;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.y += p.vy * dt;

  // 落地 / 走空判定
  if (p.onGround && gp && !gp.collapsed) {
    if (contains(gp, p.x, p.z, 0.1)) {
      p.y = gp.y; p.vy = 0;
    } else {
      p.onGround = false; p.groundPlat = null;
    }
  } else {
    let landed = null;
    for (const q of run.platforms) {
      if (q.collapsed) continue;
      if (!contains(q, p.x, p.z, 0.15)) continue;
      if (p.vy <= 0 && prevY >= q.y - 0.02 && p.y <= q.y) {
        landed = q; break;
      }
    }
    if (landed) {
      p.y = landed.y; p.vy = 0; p.onGround = true; p.groundPlat = landed.id;
      p.dashAvailable = true;
      if (landed.crumble && !landed.crumbling) { landed.crumbling = true; landed.crumbleT = CRUMBLE.time; }
      if (landed.kind === 'landing' && landed.floor > run.floor) {
        run.floor = landed.floor;
        run.maxFloor = Math.max(run.maxFloor, run.floor);
        emit(run, 'level_up', { floor: run.floor });
        if (run.floor >= WORLD.CHECKPOINT_FLOOR && run.checkpointFloor < WORLD.CHECKPOINT_FLOOR) {
          run.checkpointFloor = WORLD.CHECKPOINT_FLOOR;
          emit(run, 'checkpoint', { floor: run.checkpointFloor });
        }
      }
      emit(run, 'land', { floor: landed.floor });
    }
  }

  // 坠落到击杀面以下 → 回存档层
  if (p.y < WORLD.KILL_Y) {
    run.falls += 1;
    emit(run, 'fall', { fromY: prevY, falls: run.falls });
    respawn(run);
  }

  // 登顶
  if (run.floor >= TOWER.floors) {
    run.phase = 'won';
    run.rating = ratingFor(run.falls, run.time);
    emit(run, 'won', { time: run.time, falls: run.falls, rating: run.rating });
  }

  // 调试：R 回起点（含空中）
  if (i.respawn) { respawn(run); }

  run.tickT += dt;
  if (run.tickT >= 1) { run.tickT -= 1; emit(run, 'tick'); }
  run.time += dt;
  return run;
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

export function getHud(run) {
  return {
    phase: run.phase, time: run.time, floor: run.floor, maxFloor: run.maxFloor,
    checkpointFloor: run.checkpointFloor, falls: run.falls, windDir: run.windDir,
    rating: run.rating, x: run.player.x, y: run.player.y, z: run.player.z,
    onGround: run.player.onGround, dashAvailable: run.player.dashAvailable,
  };
}
