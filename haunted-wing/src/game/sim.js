// src/game/sim.js — HAUNTED WING 纯逻辑核心：玩家/实体/钥匙/门/发电机/躲柜/出口。
// 无 DOM / THREE / Date.now / localStorage；随机用 seed；60Hz 固定步长由 main 调用。
// 契约：createSim({seed}) -> run；updateSim(run, input)；drainEvents(run)；getHud(run)。
import { STEP, PLAYER, FLASHLIGHT, ENTITY, GENERATOR, RATINGS, WORLD } from '../../config/game.config.js';
import { buildMap } from './map.js';

const cell = WORLD.CELL;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 创建
export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const map = buildMap();

  // 每色钥匙从候选可搜索点里 seed 随机挑一个
  for (const color of ['red', 'blue', 'gold']) {
    const cands = map.searchables.filter((s) => s.keyGroup === color);
    const pick = cands[(rng() * cands.length) | 0];
    if (pick) pick.key = color;
  }

  const path = map.entityPath[1] || [];
  const run = {
    seed, map, rng, time: 0, phase: 'playing',
    player: {
      floor: map.spawn.floor, x: map.spawn.x, z: map.spawn.z, yaw: map.spawn.yaw,
      lives: PLAYER.LIVES, battery: PLAYER.BATTERY_MAX, flashlight: false,
      hidden: false, hiddenIn: null, sprint: false, crouch: false, moving: 0,
    },
    keys: { red: false, blue: false, gold: false },
    entity: {
      floor: 1, x: path[0]?.x ?? 8, z: path[0]?.z ?? 8,
      wp: 0, dir: 1, state: 'patrol', target: null, frenzy: false,
      checkT: 0, catchCd: 0, retreatT: 0, silhouetteT: 0,
    },
    generator: {
      fixed: false, lightsT: 0, seq: [0, 1, 2].map(() => (rng() * GENERATOR.LEVERS) | 0),
      progress: 0, active: false,
    },
    stats: { deaths: 0, keys: 0, searches: 0, batteryPickups: 0, hides: 0 },
    flickerT: 0, signatureDone: false, heartT: 0, noiseT: 0,
    silhouette: { x: 0, z: 0 }, silhouetteT: 0,
    nearAction: null, hint: null,
    events: [{ type: 'start', t: 0 }],
  };
  // 目标楼层楼梯（+偏移避免落地即回传）
  run.stairsTarget = map.stairs;
  return run;
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// ---------------------------------------------------------------- 查询
export function cellSolid(run, floor, cx, cz, ignoreDoors = false) {
  const g = run.map.grids[floor];
  if (!g) return true;
  if (cx < 0 || cz < 0 || cx >= g.w || cz >= g.h) return true;
  const c = g.cells[cz][cx];
  if (c === '#') return true;
  if (!ignoreDoors) {
    const d = run.map.doorById[c];
    if (d && !d.open) return true;
  }
  return false;
}

function solidNear(run, floor, x, z, r, ignoreDoors = false) {
  const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell);
  const z0 = Math.floor((z - r) / cell), z1 = Math.floor((z + r) / cell);
  for (let cz = z0; cz <= z1; cz += 1) {
    for (let cx = x0; cx <= x1; cx += 1) {
      if (!cellSolid(run, floor, cx, cz, ignoreDoors)) continue;
      const px = clamp(x, cx * cell, (cx + 1) * cell);
      const pz = clamp(z, cz * cell, (cz + 1) * cell);
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < r * r) return true;
    }
  }
  return false;
}

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function nearAction(run) {
  const p = run.player;
  if (p.hidden) return 'exitHide';
  for (const c of run.map.cabinets) {
    if (c.floor === p.floor && dist(p.x, p.z, c.x, c.z) <= PLAYER.CABINET_DIST) return 'hide';
  }
  for (const s of run.map.searchables) {
    if (s.floor === p.floor && dist(p.x, p.z, s.x, s.z) <= PLAYER.INTERACT_DIST) return 'search';
  }
  const gen = run.map.generator[p.floor];
  if (gen && !run.generator.fixed && dist(p.x, p.z, gen.x, gen.z) <= GENERATOR.FIX_DIST) return 'generator';
  const ex = run.map.exit;
  if (ex.floor === p.floor && dist(p.x, p.z, ex.x, ex.z) <= PLAYER.INTERACT_DIST) return 'exit';
  return null;
}

export function getHud(run) {
  const p = run.player, e = run.entity;
  return {
    phase: run.phase, time: run.time, floor: p.floor,
    battery: p.battery, lives: p.lives,
    keys: { ...run.keys }, keysCount: Object.values(run.keys).filter(Boolean).length,
    flashlight: p.flashlight, hidden: p.hidden, sprint: p.sprint, crouch: p.crouch,
    entityDist: dist(p.x, p.z, e.x, e.z), entityState: e.state, entityFrenzy: e.frenzy,
    generatorFixed: run.generator.fixed, lightsT: run.generator.lightsT,
    genProgress: run.generator.progress, genSeq: [...run.generator.seq],
    nearAction: run.nearAction, flickerT: run.flickerT, silhouetteT: run.silhouetteT,
  };
}

function emit(run, type, extra = {}) { run.events.push({ type, t: run.time, ...extra }); }

export function ratingFor(time, lives) {
  for (const [name, t, l] of RATINGS) if (time <= t && lives >= l) return name;
  return 'C';
}

// ---------------------------------------------------------------- 移动 + 碰撞
function movePlayer(run, input, dt) {
  const p = run.player;
  const speed = (p.sprint ? PLAYER.SPRINT : p.crouch ? PLAYER.CROUCH : PLAYER.WALK);
  p.yaw += input.turn || 0;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const fx = -sin, fz = -cos, rx = cos, rz = -sin;
  const f = input.forward || 0, s = input.strafe || 0;
  const len = Math.hypot(f, s);
  const moving = len > 0.01;
  const k = moving ? (len > 1 ? 1 : len) : 0;
  p.moving = k;
  const dx = (fx * f + rx * s) * speed * k * dt;
  const dz = (fz * f + rz * s) * speed * k * dt;

  if (!solidNear(run, p.floor, p.x + dx, p.z, PLAYER.RADIUS)) p.x += dx;
  if (!solidNear(run, p.floor, p.x, p.z + dz, PLAYER.RADIUS)) p.z += dz;

  // 楼梯传送（落到目标层楼梯西侧 2 格，避免立即回传）
  const g = run.map.grids[p.floor];
  const cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
  if (cx >= 0 && cz >= 0 && cx < g.w && cz < g.h && g.cells[cz][cx] === '^') {
    const to = run.map.stairs[p.floor];
    const target = run.stairsTarget[to.to];
    p.floor = to.to;
    p.x = (target.x - 1.5) * cell;
    p.z = (target.z + 0.5) * cell;
    emit(run, 'floor', { floor: p.floor });
  }

  // 出口（第三道门 = 出口门，需金钥匙）
  const ex = run.map.exit;
  if (p.floor === ex.floor && dist(p.x, p.z, ex.x, ex.z) < 1.4) {
    if (run.keys.gold) {
      run.phase = 'won';
      emit(run, 'win', { time: Math.round(run.time), lives: p.lives, rating: ratingFor(run.time, p.lives) });
    } else if (!run.exitHinted) {
      run.exitHinted = true;
      emit(run, 'needKey', { color: 'gold' });
    }
  }

  // 电池拾取
  for (const b of run.map.batteries) {
    if (b.taken || b.floor !== p.floor) continue;
    if (dist(p.x, p.z, b.x, b.z) < 1.2) {
      b.taken = true;
      p.battery = clamp(p.battery + PLAYER.BATTERY_PICKUP, 0, PLAYER.BATTERY_MAX);
      run.stats.batteryPickups++;
      emit(run, 'battery', { battery: p.battery });
    }
  }
}

// ---------------------------------------------------------------- 交互
function interact(run) {
  const p = run.player;
  // 出柜
  if (p.hidden) {
    p.hidden = false; p.hiddenIn = null;
    emit(run, 'exitHide');
    return;
  }
  // 躲藏柜（E 进，E 再出）
  for (const c of run.map.cabinets) {
    if (c.floor !== p.floor) continue;
    if (dist(p.x, p.z, c.x, c.z) <= PLAYER.CABINET_DIST) {
      p.hidden = true; p.hiddenIn = c; p.flashlight = false; p.moving = 0;
      run.stats.hides++;
      emit(run, 'hide', { id: c.id || `${c.x},${c.z}` });
      return;
    }
  }
  // 抽屉 / 尸体：搜索
  for (const s of run.map.searchables) {
    if (s.floor !== p.floor) continue;
    if (dist(p.x, p.z, s.x, s.z) <= PLAYER.INTERACT_DIST) {
      run.stats.searches++;
      if (s.key && !run.keys[s.key]) {
        run.keys[s.key] = true; run.stats.keys++;
        emit(run, 'key', { color: s.key });
      } else if (s.battery && !s.searched) {
        s.searched = true;
        p.battery = clamp(p.battery + PLAYER.BATTERY_PICKUP, 0, PLAYER.BATTERY_MAX);
        emit(run, 'battery', { battery: p.battery });
      } else {
        emit(run, 'search', { id: s.id });
      }
      return;
    }
  }
}

// ---------------------------------------------------------------- 发电机
function generatorLever(run, lever) {
  const g = run.generator;
  if (g.fixed || g.lightsT > 0) return;
  if (lever - 1 === g.seq[g.progress]) {
    g.progress++;
    if (g.progress >= GENERATOR.LEVERS) {
      g.fixed = true; g.lightsT = GENERATOR.LIGHTS_SEC; g.progress = 0;
      emit(run, 'generator', {});
      emit(run, 'lightsOn', {});
    } else {
      emit(run, 'generatorTick', { progress: g.progress });
    }
  } else {
    g.progress = 0;
    emit(run, 'generatorWrong', {});
  }
}

// ---------------------------------------------------------------- 实体 AI
function updateEntity(run, dt) {
  const e = run.entity, p = run.player;
  e.catchCd = Math.max(0, e.catchCd - dt);

  const dp = dist(p.x, p.z, e.x, e.z);
  const sameFloor = e.floor === p.floor;
  const visible = sameFloor && p.flashlight && !p.hidden && dp < FLASHLIGHT.RANGE;
  let inCone = false;
  if (visible) {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const ex = e.x - p.x, ez = e.z - p.z;
    const d = Math.hypot(ex, ez) || 1;
    inCone = (fx * ex + fz * ez) / d > Math.cos(FLASHLIGHT.CONE);
  }

  // 发电机亮灯 → 撤退；结束后狂暴
  if (run.generator.lightsT > 0) {
    run.generator.lightsT -= dt;
    e.state = 'retreat';
    if (run.generator.lightsT <= 0) { emit(run, 'lightsOff', {}); e.frenzy = true; }
  } else if (e.state === 'retreat') {
    e.state = 'patrol';
  }

  // 决定状态
  if (e.state !== 'retreat') {
    if (sameFloor && !p.hidden && dp < ENTITY.PROXIMITY) e.state = 'chase';
    else if (visible && inCone) e.state = 'chase';
    else if (e.state === 'chase') e.state = 'patrol';
  }

  // 听觉（玩家跑/搜索发声）
  if (e.state !== 'retreat' && sameFloor && !p.hidden && e.state !== 'chase' && run.noiseT > 0) {
    const radius = p.sprint ? ENTITY.HEAR_RUN : ENTITY.HEAR_SEARCH;
    if (dp < radius) { e.state = 'investigate'; e.target = { x: p.x, z: p.z }; }
  }

  // 移动
  const frenzy = e.frenzy;
  let speed = e.state === 'chase' ? (frenzy ? ENTITY.FRENZY : ENTITY.CHASE)
    : e.state === 'investigate' ? ENTITY.INVESTIGATE : ENTITY.PATROL;
  let tx = null, tz = null;

  if (e.state === 'chase') { tx = p.x; tz = p.z; }
  else if (e.state === 'investigate' && e.target) { tx = e.target.x; tz = e.target.z; }
  else if (e.state === 'retreat') {
    // 撤退到离玩家最远的路径点
    const path = run.map.entityPath[e.floor] || [];
    let far = path[0], farD = -1;
    for (const w of path) { const d = dist(w.x, w.z, p.x, p.z); if (d > farD) { farD = d; far = w; } }
    tx = far.x; tz = far.z;
  } else {
    const path = run.map.entityPath[e.floor] || [];
    if (path.length) {
      const w = path[e.wp];
      tx = w.x; tz = w.z;
      if (dist(e.x, e.z, w.x, w.z) < 0.5) {
        e.wp += e.dir;
        if (e.wp >= path.length) { e.wp = path.length - 2; e.dir = -1; }
        else if (e.wp < 0) { e.wp = 1; e.dir = 1; }
      }
    }
  }

  if (tx != null) {
    const d = Math.hypot(tx - e.x, tz - e.z) || 1;
    const nx = (tx - e.x) / d, nz = (tz - e.z) / d;
    const step = speed * dt;
    let mx = e.x + nx * step, mz = e.z + nz * step;
    if (solidNear(run, e.floor, mx, e.z, 0.4, true)) mx = e.x;
    if (solidNear(run, e.floor, e.x, mz, 0.4, true)) mz = e.z;
    e.x = mx; e.z = mz;
  }

  // 抵达调查点 → 回巡逻
  if (e.state === 'investigate' && e.target && dist(e.x, e.z, e.target.x, e.target.z) < 1.0) {
    e.state = 'patrol'; e.target = null;
  }

  // 抓捕（躲藏时只有实体在追击才会查柜，巡逻/调查不查）
  if (e.catchCd <= 0) {
    if (p.hidden) {
      if (e.state === 'chase' && dp < ENTITY.CHECK_DIST && p.hiddenIn) {
        e.checkT += dt;
        if (e.checkT * ENTITY.CHECK_CHANCE > 0.4) {
          e.checkT = 0;
          catchPlayer(run);
        }
      } else e.checkT = 0;
    } else if (e.state === 'chase' && dp < ENTITY.CATCH_RADIUS) {
      catchPlayer(run);
    }
  }

  // 心跳/呼吸事件（节流；只对同层玩家）
  run.heartT -= dt;
  if (run.heartT <= 0) {
    run.heartT = dp < 6 ? 0.5 : dp < 14 ? 0.9 : 1.4;
    if (e.floor === p.floor && dp < 14) emit(run, 'heartbeat', { dist: Math.round(dp) });
    if (e.floor === p.floor && dp < 5) emit(run, 'breath', { dist: Math.round(dp) });
  }
}

function catchPlayer(run) {
  const p = run.player, e = run.entity;
  if (e.catchCd > 0) return;
  p.hidden = false; p.hiddenIn = null;
  p.lives--;
  run.stats.deaths++;
  e.catchCd = ENTITY.CATCH_COOLDOWN;
  e.state = 'patrol';
  const path = run.map.entityPath[1] || [];
  if (path.length) { e.wp = Math.min(2, path.length - 1); e.x = path[e.wp].x; e.z = path[e.wp].z; }
  emit(run, 'caught', { lives: p.lives });
  if (p.lives <= 0) {
    run.phase = 'dead';
    emit(run, 'fail', { time: Math.round(run.time) });
    return;
  }
  // 回安全点（一层出生）
  const sp = run.map.spawn;
  p.floor = sp.floor; p.x = sp.x; p.z = sp.z; p.yaw = sp.yaw;
  p.flashlight = false;
}

// ---------------------------------------------------------------- 主更新
export function updateSim(run, input = {}) {
  if (run.phase !== 'playing') return run;
  const dt = STEP;
  input = {
    forward: 0, strafe: 0, turn: 0, flashlight: false, interact: false,
    lever: 0, sprint: false, crouch: false, ...input,
  };
  run.time += dt;
  const p = run.player;

  p.sprint = !!input.sprint && !p.hidden;
  p.crouch = !!input.crouch && !p.hidden;

  // 手电
  if (input.flashlight && !p.hidden) {
    p.flashlight = p.battery > 0 ? !p.flashlight : false;
  }
  if (p.flashlight) {
    p.battery -= PLAYER.FLASHLIGHT_DRAIN * dt;
    if (p.battery <= 0) { p.battery = 0; p.flashlight = false; emit(run, 'flicker', {}); }
  }

  if (!p.hidden) movePlayer(run, input, dt);

  // 交互边沿
  if (input.interact) interact(run);
  if (input.lever >= 1 && input.lever <= GENERATOR.LEVERS) {
    const gen = run.map.generator[p.floor];
    if (gen && dist(p.x, p.z, gen.x, gen.z) <= GENERATOR.FIX_DIST) generatorLever(run, input.lever);
  }

  // 发声标记（供实体听觉用；搜索由 interact 触发）
  if (input.interact) run.noiseT = 0.3;
  run.noiseT = Math.max(0, run.noiseT - dt);
  if (p.moving > 0 && p.sprint) run.noiseT = Math.max(run.noiseT, 0.1);

  // 门：有钥匙靠近自动开
  for (const d of run.map.doors) {
    if (d.open || d.floor !== p.floor) continue;
    if (!run.keys[d.openWhen]) continue;
    const cx = d.cells.reduce((s, c) => s + c.x, 0) / d.cells.length;
    const cz = d.cells.reduce((s, c) => s + c.z, 0) / d.cells.length;
    if (dist(p.x, p.z, (cx + 0.5) * cell, (cz + 0.5) * cell) < 1.8) {
      d.open = true;
      emit(run, 'door', { id: d.id });
    }
  }

  // 签名：手电闪烁 + 走廊尽头剪影一闪（剪影是独立视觉点，不动实体本体）
  if (!run.signatureDone && run.time >= FLASHLIGHT.FLICKER_AT) {
    run.signatureDone = true;
    run.flickerT = 0.9;
    run.silhouetteT = 1.3;
    const path = run.map.entityPath[1] || [];
    if (path.length) {
      run.silhouette = { x: path[0].x, z: path[0].z };
    }
    emit(run, 'flicker', {});
    emit(run, 'silhouette', {});
  }
  run.flickerT = Math.max(0, run.flickerT - dt);
  run.silhouetteT = Math.max(0, run.silhouetteT - dt);

  updateEntity(run, dt);
  run.nearAction = nearAction(run);
  return run;
}
