// 纯逻辑 sim（零 DOM，Node 可直接 import）：画线引水 + 粒子水滴物理 + 入杯计数 + 星级。
// 确定性：水滴初始抖动用 mulberry32(seed)；物理为固定子步，无随机。
// 主题换皮：水滴=发光能量液，底部=岩浆失水区，玻璃=霓虹烧杯，宝石=可收集霓虹宝石。
import { WORLD, GAME } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const FLOOR_Y = GAME.FLOOR_Y;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 点到线段最近点 + 法向
function segClosest(px, py, x1, y1, x2, y2) {
  const abx = x2 - x1;
  const aby = y2 - y1;
  const apx = px - x1;
  const apy = py - y1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby + 1e-9)));
  const cx = x1 + abx * t;
  const cy = y1 + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  return { d, nx: d > 1e-9 ? dx / d : 0, ny: d > 1e-9 ? dy / d : 0, cx, cy };
}

export function createRun(levelIndex = 0, opts = {}) {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0))];
  const rng = mulberry32((opts.seed ?? 1) | 0);

  const state = {
    level: lv.index,
    phase: 'draw',          // draw | pour | won | lost
    inkMax: lv.ink,
    ink: lv.ink,
    lines: [],              // [{ pts: [[x,y],...] }] 静态轨道
    drops: [],              // [{x,y,vx,vy,r,alive}]
    boxes: lv.boxes.map((b) => ({ ...b, vx: 0, vy: 0 })),
    gems: lv.gems.map((g) => ({ ...g, collected: false })),
    fill: 0,
    winWaterNum: lv.winWaterNum,
    spills: 0,
    time: 0,
    pourTime: 0,
    timeLimit: lv.timeLimit,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    stars: 0,
    result: null,
    actions: 0,
    spawnQueue: [],
    spawnIndex: 0,
    totalDrops: lv.totalDrops,
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  let currentStroke = null;

  function glassDepth() {
    return FLOOR_Y - lv.glass.my;
  }

  // 生成水滴出生时刻表（多水源轮流）
  function buildSpawnSchedule() {
    const srcs = lv.sources;
    const schedule = [];
    let t = 0;
    for (let i = 0; i < lv.totalDrops; i += 1) {
      const s = srcs[i % srcs.length];
      schedule.push({ t, source: s, jx: (rng() * 2 - 1) * GAME.DROP_JITTER });
      t += lv.dropInterval;
    }
    return schedule;
  }

  function spawnDrop(spec) {
    const { source, jx } = spec;
    const x = source.x + jx;
    const y = source.y + GAME.SOURCE_OFFSET;
    let vx = 0;
    let vy = 0;
    if (source.dir === 'down') vy = GAME.DROP_SPEED;
    else if (source.dir === 'right') vx = GAME.DROP_SPEED;
    else if (source.dir === 'left') vx = -GAME.DROP_SPEED;
    state.drops.push({ x, y, vx, vy, r: GAME.DROP_R, alive: true });
    emit('dropSpawn', { x: +x.toFixed(1), y: +y.toFixed(1) });
  }

  // ---------- 动词 ----------
  function beginStroke(x, y) {
    if (state.phase !== 'draw') return { ok: false, reason: 'phase' };
    if (state.ink <= 0) return { ok: false, reason: 'ink' };
    if (state.lines.length >= GAME.MAX_LINES) return { ok: false, reason: 'lines' };
    if (currentStroke) return { ok: false, reason: 'drawing' };
    currentStroke = { pts: [[x, y]] };
    state.actions += 1;
    return { ok: true };
  }

  function strokeTo(x, y) {
    if (!currentStroke) return { ok: false, reason: 'noStroke' };
    const [px, py] = currentStroke.pts[currentStroke.pts.length - 1];
    const len = Math.hypot(x - px, y - py);
    if (len < 1) return { ok: true, cost: 0 };
    const cost = Math.min(state.ink, len);
    currentStroke.pts.push([x, y]);
    state.ink = Math.max(0, state.ink - cost);
    state.actions += 1;
    return { ok: true, cost };
  }

  function endStroke() {
    if (!currentStroke) return { ok: false, reason: 'noStroke' };
    if (currentStroke.pts.length >= 2) {
      state.lines.push({ pts: currentStroke.pts });
      emit('draw', { points: currentStroke.pts.length });
    }
    currentStroke = null;
    return { ok: true };
  }

  function drawLine(points) {
    if (!Array.isArray(points) || points.length < 2) return { ok: false, reason: 'points' };
    if (state.phase !== 'draw') return { ok: false, reason: 'phase' };
    if (state.lines.length >= GAME.MAX_LINES) return { ok: false, reason: 'lines' };
    let used = 0;
    for (let i = 1; i < points.length; i += 1) {
      used += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    if (used > state.ink + 1) return { ok: false, reason: 'ink' };
    state.ink = Math.max(0, state.ink - used);
    state.lines.push({ pts: points.map((p) => [p[0], p[1]]) });
    state.actions += points.length;
    emit('draw', { points: points.length });
    return { ok: true };
  }

  function pour() {
    if (state.phase !== 'draw') return { ok: false, reason: 'phase' };
    state.phase = 'pour';
    state.pourTime = 0;
    state.spawnQueue = buildSpawnSchedule();
    state.spawnIndex = 0;
    state.actions += 1;
    emit('pour', {});
    return { ok: true };
  }

  // ---------- 结算 ----------
  function computeStars() {
    const gemsTotal = state.gems.length;
    const gemsCollected = state.gems.filter((g) => g.collected).length;
    let stars = 1;
    if (state.ink / state.inkMax >= GAME.INK_STAR_RATIO) stars += 1;
    if (gemsTotal === 0 || gemsCollected === gemsTotal) stars += 1;
    return Math.min(3, stars);
  }

  function win() {
    if (state.phase === 'won' || state.phase === 'lost') return;
    state.phase = 'won';
    state.stars = computeStars();
    state.result = { won: true, stars: state.stars };
    emit('win', { stars: state.stars, fill: state.fill, inkLeft: Math.round(state.ink) });
  }

  function lose(reason) {
    if (state.phase === 'won' || state.phase === 'lost') return;
    state.phase = 'lost';
    state.result = { won: false, reason };
    emit('lose', { reason });
  }

  function spillDrop(d) {
    d.alive = false;
    state.spills += 1;
    emit('spill', { x: +d.x.toFixed(1), y: +d.y.toFixed(1) });
    lose('spill');
  }

  function collectDrop(d) {
    if (!d.alive) return;
    d.alive = false;
    state.fill += 1;
    // 连击
    if (state.comboTimer > 0) {
      state.combo += 1;
    } else {
      state.combo = 1;
    }
    state.comboTimer = GAME.COMBO_WINDOW;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    emit('dropCollect', { fill: state.fill });
    if (state.combo === 2 || state.combo === 5 || state.combo === 10) {
      emit('combo', { combo: state.combo });
    }
    if (state.fill === Math.ceil(state.winWaterNum / 2)) {
      emit('fillHalf', { fill: state.fill });
    }
    if (state.fill >= state.winWaterNum) win();
  }

  function collectGem(g) {
    if (g.collected) return;
    g.collected = true;
    emit('gemCollect', { x: +g.x.toFixed(1), y: +g.y.toFixed(1) });
  }

  // ---------- 碰撞体 ----------
  function glassSolids() {
    const { mx, my, w } = lv.glass;
    const hh = glassDepth();
    const half = w / 2;
    return [
      { type: 'seg', x1: mx - half, y1: my, x2: mx - half, y2: my + hh, half: 6, lava: false },
      { type: 'seg', x1: mx + half, y1: my, x2: mx + half, y2: my + hh, half: 6, lava: false },
      { type: 'seg', x1: mx - half, y1: my + hh, x2: mx + half, y2: my + hh, half: 6, lava: false },
    ];
  }

  function staticSolids() {
    const out = [];
    for (const s of lv.walls) out.push(s);
    for (const s of glassSolids()) out.push(s);
    return out;
  }

  function lineSolids() {
    const out = [];
    for (const line of state.lines) {
      for (let i = 1; i < line.pts.length; i += 1) {
        out.push({
          type: 'seg',
          x1: line.pts[i - 1][0], y1: line.pts[i - 1][1],
          x2: line.pts[i][0], y2: line.pts[i][1],
          half: GAME.LINE_HALF, lava: false,
        });
      }
    }
    return out;
  }

  function reflectDrop(d, nx, ny, vn, box) {
    // 分解速度：法向反弹 + 切向保留
    const vnx = vn * nx;
    const vny = vn * ny;
    const vtx = d.vx - vnx;
    const vty = d.vy - vny;
    const newVn = -vn * GAME.RESTITUTION;
    d.vx = vtx * GAME.TANGENT_KEEP + newVn * nx;
    d.vy = vty * GAME.TANGENT_KEEP + newVn * ny;
    if (box) {
      // 把少量动量传给动态箱体（重箱更稳）
      const invMass = box.heavy ? 0.006 : 0.02;
      const imp = Math.abs(vn) * invMass;
      box.vx += nx * imp;
      box.vy += ny * imp;
    }
  }

  function collideDrop(d) {
    // 1) 玻璃收集（杯口圆 + 杯内矩形）
    const { mx, my, w } = lv.glass;
    const half = w / 2;
    const hh = glassDepth();
    const inMouth = Math.hypot(d.x - mx, d.y - my) < half + d.r * 0.4;
    const inBasin = d.x > mx - half && d.x < mx + half && d.y > my - 4 && d.y < my + hh + 6;
    if (inMouth || inBasin) { collectDrop(d); return; }

    // 2) 失水（掉进底部岩浆区）
    if (d.y > FLOOR_Y + 4) { spillDrop(d); return; }

    // 3) 与静态段/圆碰撞
    for (const s of staticSolids()) {
      if (s.type === 'seg') {
        const c = segClosest(d.x, d.y, s.x1, s.y1, s.x2, s.y2);
        const rad = d.r + s.half;
        if (c.d < rad) {
          d.x += c.nx * (rad - c.d);
          d.y += c.ny * (rad - c.d);
          const vn = d.vx * c.nx + d.vy * c.ny;
          if (vn < 0) {
            reflectDrop(d, c.nx, c.ny, vn, null);
            if (s.lava) { spillDrop(d); return; }
          }
        }
      } else {
        const dx = d.x - s.x;
        const dy = d.y - s.y;
        const dist = Math.hypot(dx, dy);
        const rad = d.r + s.r;
        if (dist < rad) {
          const nx = dist > 1e-9 ? dx / dist : 0;
          const ny = dist > 1e-9 ? dy / dist : -1;
          d.x = s.x + nx * rad;
          d.y = s.y + ny * rad;
          const vn = d.vx * nx + d.vy * ny;
          if (vn < 0) {
            reflectDrop(d, nx, ny, vn, null);
            if (s.lava) { spillDrop(d); return; }
          }
        }
      }
    }

    // 4) 与画线碰撞（静态轨道）
    for (const s of lineSolids()) {
      const c = segClosest(d.x, d.y, s.x1, s.y1, s.x2, s.y2);
      const rad = d.r + s.half;
      if (c.d < rad) {
        d.x += c.nx * (rad - c.d);
        d.y += c.ny * (rad - c.d);
        const vn = d.vx * c.nx + d.vy * c.ny;
        if (vn < 0) reflectDrop(d, c.nx, c.ny, vn, null);
      }
    }

    // 5) 与动态箱体碰撞
    for (const b of state.boxes) {
      const dx = d.x - b.x;
      const dy = d.y - b.y;
      const dist = Math.hypot(dx, dy);
      const rad = d.r + b.r;
      if (dist < rad) {
        const nx = dist > 1e-9 ? dx / dist : 0;
        const ny = dist > 1e-9 ? dy / dist : -1;
        d.x = b.x + nx * rad;
        d.y = b.y + ny * rad;
        const vn = d.vx * nx + d.vy * ny;
        if (vn < 0) reflectDrop(d, nx, ny, vn, b);
      }
    }

    // 6) 宝石收集
    for (const g of state.gems) {
      if (g.collected) continue;
      if (Math.hypot(d.x - g.x, d.y - g.y) < d.r + g.r) collectGem(g);
    }

    // 7) 出界清掉（不判失水）
    if (d.x < -60 || d.x > W + 60 || d.y < -60) d.alive = false;
  }

  function collideBox(b) {
    // 与静态段/圆碰撞
    for (const s of staticSolids()) {
      if (s.type === 'seg') {
        const c = segClosest(b.x, b.y, s.x1, s.y1, s.x2, s.y2);
        const rad = b.r + s.half;
        if (c.d < rad) {
          b.x += c.nx * (rad - c.d);
          b.y += c.ny * (rad - c.d);
          const vn = b.vx * c.nx + b.vy * c.ny;
          if (vn < 0) {
            b.vx = (b.vx - vn * c.nx) * GAME.BOX_TANGENT_KEEP - vn * GAME.BOX_RESTITUTION * c.nx;
            b.vy = (b.vy - vn * c.ny) * GAME.BOX_TANGENT_KEEP - vn * GAME.BOX_RESTITUTION * c.ny;
          }
        }
      } else {
        const dx = b.x - s.x;
        const dy = b.y - s.y;
        const dist = Math.hypot(dx, dy);
        const rad = b.r + s.r;
        if (dist < rad) {
          const nx = dist > 1e-9 ? dx / dist : 0;
          const ny = dist > 1e-9 ? dy / dist : -1;
          b.x = s.x + nx * rad;
          b.y = s.y + ny * rad;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx = (b.vx - vn * nx) * GAME.BOX_TANGENT_KEEP - vn * GAME.BOX_RESTITUTION * nx;
            b.vy = (b.vy - vn * ny) * GAME.BOX_TANGENT_KEEP - vn * GAME.BOX_RESTITUTION * ny;
          }
        }
      }
    }
    // 落地
    if (b.y + b.r > FLOOR_Y) {
      b.y = FLOOR_Y - b.r;
      if (b.vy > 0) b.vy = -b.vy * GAME.BOX_FLOOR_BOUNCE;
      b.vx *= GAME.BOX_FLOOR_FRICTION;
    }
    // 侧边界（软拦）
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
  }

  function substep(h) {
    for (const d of state.drops) {
      if (!d.alive) continue;
      d.vy += GAME.GRAVITY * h;
      const sp = Math.hypot(d.vx, d.vy);
      if (sp > GAME.DROP_MAX_SPEED) {
        d.vx *= GAME.DROP_MAX_SPEED / sp;
        d.vy *= GAME.DROP_MAX_SPEED / sp;
      }
      d.x += d.vx * h;
      d.y += d.vy * h;
      collideDrop(d);
    }
    for (const b of state.boxes) {
      b.vy += GAME.GRAVITY * h;
      b.x += b.vx * h;
      b.y += b.vy * h;
      collideBox(b);
    }
  }

  function checkEnd() {
    if (state.phase !== 'pour') return;
    if (state.fill >= state.winWaterNum) { win(); return; }
    if (state.pourTime > state.timeLimit) { lose('timeOut'); return; }
    const allSpawned = state.spawnIndex >= state.spawnQueue.length;
    const anyAlive = state.drops.some((d) => d.alive);
    if (allSpawned && !anyAlive && state.fill < state.winWaterNum) { lose('drained'); }
  }

  function step(dt) {
    if (state.phase === 'won' || state.phase === 'lost') return;
    state.time += dt;
    if (state.phase !== 'pour') return;

    state.pourTime += dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    while (state.spawnIndex < state.spawnQueue.length && state.spawnQueue[state.spawnIndex].t <= state.pourTime) {
      spawnDrop(state.spawnQueue[state.spawnIndex]);
      state.spawnIndex += 1;
    }
    const sub = GAME.SUBSTEPS;
    const h = dt / sub;
    for (let i = 0; i < sub; i += 1) substep(h);
    checkEnd();
  }

  function getHud() {
    return {
      level: state.level,
      phase: state.phase,
      ink: Math.round(state.ink),
      inkMax: state.inkMax,
      fill: state.fill,
      winWaterNum: state.winWaterNum,
      gems: state.gems.filter((g) => g.collected).length,
      gemsTotal: state.gems.length,
      combo: state.combo,
      time: state.time,
      stars: state.stars,
    };
  }

  return {
    state,
    step,
    beginStroke,
    strokeTo,
    endStroke,
    drawLine,
    pour,
    getHud,
    drainEvents: () => events.splice(0),
    _level: lv,
  };
}

export { LEVELS };
