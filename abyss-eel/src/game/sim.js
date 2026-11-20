// ABYSS EEL · M1 模拟/玩法核心（纯逻辑，零依赖）
// 契约：docs/abyss-eel/README.md（事件名 / 接口签名一字不差）
import {
  WORLD, HEAD, ORBS, SCROLL, COMBO, DASH, URCHIN, BOSS, SPARK, FOOD, NEAR_MISS, STEER, SPAWN, TRAIL,
  STEP, clamp, comboMult, lightRadiusAt,
} from '../../config/gameplay.js';
import { ZONES, ZONE_COUNT, zoneIndex, zoneAt } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';
import { spawnWave, spawnBossSpecs } from './spawner.js';

const PX = WORLD.PX_PER_METER;

// ---------- 创建 run ----------
export function createRun({ seed = 0, startZone = 1 } = {}) {
  const rng = mulberry32(seed);
  const zone = clamp(startZone, 1, ZONE_COUNT);
  const depth = ZONES[zone - 1].minDepth;

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    depth,
    zone,
    head: { x: HEAD.START_X, vx: 0, angle: 0 },
    orbs: [], // 屏幕坐标珠链（每 tick 末尾由 trail 重建）
    trail: [], // 历史轨迹点 {x, worldY, angle}（沿头轨迹每 34px 放一点）
    trailAccum: 0,
    lastTrail: null,
    walls: [], // {id,x,worldY,w,h,value,initial,kind,moving?,vx?,bossId?,partIndex?}
    foods: [], // {id,x,worldY,kind}
    sparks: [], // {id,x,y,vx,vy,life}
    nextId: 1,
    spawn: { nextY: depth * PX + SPAWN.LOOKAHEAD },
    orbsCount: ORBS.START,
    combo: 0,
    maxCombo: 0,
    lastBreak: -Infinity,
    dashActive: false,
    dashHeat: 0,
    orbBurn: 0,
    invulnUntil: -Infinity,
    nearMissAt: -Infinity,
    boss: null,
    nextBossDepth: BOSS.FIRST_DEPTH,
    tutorialDone: false,
    tailGuard: false, // M1 无升级，预留 tailGuard 规则钩子
    stats: { depth: 0, maxCombo: 0, zoneReached: zone, wallsBroken: 0, goldEaten: 0 },
    events: [],
    _removeWalls: new Set(),
  };

  initTrail(run);
  rebuildOrbs(run);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架（main.js 仍 import createSim/updateSim，M2/M3 会重接）
export function createSim() {
  return createRun({ seed: 0 });
}

export function updateSim(run, input = {}) {
  const steerX = input.left ? 0 : input.right ? WORLD.WIDTH : null;
  run.step({ steerX, dash: !!input.jump });
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const steerX = input.steerX == null ? null : clamp(input.steerX, 0, WORLD.WIDTH);
  const dashHeld = !!input.dash;

  updateSteer(run, steerX, dt); // 1 转向
  updateDash(run, dashHeld, dt); // 2 冲刺（可能燃珠）
  scrollAndZone(run, dt); // 3 滚动 / 深度 / 带切换
  spawnBossIfDue(run); // 3.5 Boss 循环（2100m 起每 900m）
  spawnUpTo(run); // 4 生成
  updateMovingWalls(run, dt); // 5 移动墙
  recordTrail(run); // 6 记录轨迹
  handleCollisions(run); // 7 撞墙（破墙/断尾/Boss）
  handleFoods(run); // 8 拾取食物
  updateSparks(run, dt); // 9 火花真空回吸
  updateBossRegen(run); // 10 Boss 段再生
  updateCombo(run); // 11 连击窗口超时
  cull(run); // 12 清理已滚过实体
  rebuildOrbs(run); // 13 珠链重建（反映本 tick 珠数变化）

  run.stats.depth = run.depth;
  run.stats.maxCombo = run.maxCombo;
}

// ---------- 转向（缓动追踪：vx = (target-x)*LERP，封顶 MAX_VX） ----------
function updateSteer(run, steerX, dt) {
  const head = run.head;
  if (steerX == null) {
    head.vx = 0;
  } else {
    head.vx = clamp((steerX - head.x) * STEER.LERP, -STEER.MAX_VX, STEER.MAX_VX);
    head.x += head.vx * dt;
  }
  head.x = clamp(head.x, HEAD.W / 2, WORLD.WIDTH - HEAD.W / 2);
  head.angle = clamp(head.vx * STEER.TILT_PER_VX, -STEER.MAX_TILT, STEER.MAX_TILT);
}

// ---------- 冲刺 ----------
function updateDash(run, dashHeld, dt) {
  const canStart = run.zone >= DASH.UNLOCK_ZONE && run.orbsCount >= DASH.MIN_ORBS;
  if (!run.dashActive && dashHeld && canStart) {
    run.dashActive = true;
    emit(run, 'dashStart', {});
  } else if (run.dashActive && !dashHeld) {
    run.dashActive = false;
    emit(run, 'dashEnd', {});
  }

  if (run.dashActive) run.dashHeat = Math.min(1, run.dashHeat + DASH.HEAT_RATE * dt);
  else run.dashHeat = Math.max(0, run.dashHeat - DASH.HEAT_RATE * dt);

  if (run.dashActive) {
    run.orbBurn += DASH.BURN_PER_SEC * dt;
    // 加 epsilon 抵消浮点累计误差（2/60 非精确表示），保证 1s 恰烧 2 珠
    const whole = Math.floor(run.orbBurn + 1e-9);
    if (whole > 0) {
      run.orbBurn -= whole;
      loseOrbs(run, whole, false);
    }
    if (run.orbsCount <= 0 && run.dashActive) {
      run.dashActive = false;
      emit(run, 'dashEnd', {});
    }
  }
}

// ---------- 滚动 / 带切换 ----------
function scrollAndZone(run, dt) {
  const zoneObj = zoneAt(run.depth);
  const speed = zoneObj.scroll * (run.dashActive ? SCROLL.DASH_MULT : 1);
  run.depth += (speed * dt) / PX;

  // 每 25m 一个深度里程碑（保证反馈密度：HUD 脉冲 + 音效 tick）
  const mile = Math.floor(run.depth / 25);
  if (mile > (run._lastMile ?? 0)) {
    run._lastMile = mile;
    if (mile > 0) emit(run, 'depthMilestone', { depth: Math.floor(run.depth) });
  }

  const z = zoneIndex(run.depth);
  if (z !== run.zone) {
    run.zone = z;
    emit(run, 'zoneEnter', { zone: z, name: `zone.${z}` });
    if (z > run.stats.zoneReached) run.stats.zoneReached = z;
  }
}

// ---------- 生成 ----------
function spawnUpTo(run) {
  const headWorldY = run.depth * PX;
  while (run.spawn.nextY < headWorldY + SPAWN.LOOKAHEAD) {
    const y = run.spawn.nextY;
    const waveDepth = y / PX;
    const zone = zoneAt(waveDepth);
    const { walls, foods } = spawnWave(run.rng, zone, waveDepth, y);
    for (const w of walls) pushWall(run, w);
    for (const f of foods) {
      f.id = run.nextId++;
      run.foods.push(f);
    }
    run.spawn.nextY += SPAWN.GAP;
  }
}

function pushWall(run, w) {
  w.id = run.nextId++;
  if (w.initial == null) w.initial = w.value;
  run.walls.push(w);
}

function spawnBossIfDue(run) {
  if (run.boss) return; // 当前 Boss 未破不生成下一个
  const trigger = run.nextBossDepth - BOSS.APPROACH / PX;
  if (run.depth >= trigger) {
    spawnBoss(run, run.nextBossDepth);
    run.nextBossDepth += BOSS.INTERVAL;
  }
}

function spawnBoss(run, bossDepth) {
  const y = bossDepth * PX;
  const parts = spawnBossSpecs(run.rng, bossDepth, y);
  const baseValue = parts[0] ? parts[0].value : 0;
  run.boss = {
    id: run.nextId++,
    depth: bossDepth,
    active: true,
    baseValue,
    regen: parts.map(() => Infinity), // regen[i] = 该段再生时刻（Infinity=未破）
    segments: parts.map((p) => ({
      x: p.x, w: p.w, h: p.h, value: p.value, initial: p.value, partIndex: p.partIndex,
    })),
  };
  for (const p of parts) {
    p.bossId = run.boss.id;
    pushWall(run, p);
  }
}

// ---------- 移动墙 ----------
function updateMovingWalls(run, dt) {
  for (const w of run.walls) {
    if (!w.moving) continue;
    w.x += w.vx * dt;
    if (w.x < 0) { w.x = 0; w.vx = Math.abs(w.vx); }
    else if (w.x + w.w > WORLD.WIDTH) { w.x = WORLD.WIDTH - w.w; w.vx = -Math.abs(w.vx); }
  }
}

// ---------- 轨迹 / 珠链 ----------
function initTrail(run) {
  const headWorldY = run.depth * PX;
  for (let k = run.orbsCount; k >= 1; k -= 1) {
    run.trail.push({ x: run.head.x, worldY: headWorldY - k * ORBS.TRAIL_SPACING, angle: 0 });
  }
  run.lastTrail = run.trail[run.trail.length - 1];
}

function recordTrail(run) {
  const headWorldY = run.depth * PX;
  const prev = run.lastTrail;
  const d = Math.hypot(run.head.x - prev.x, headWorldY - prev.worldY);
  if (d >= ORBS.TRAIL_SPACING) {
    const p = { x: run.head.x, worldY: headWorldY, angle: run.head.angle };
    run.trail.push(p);
    run.lastTrail = p;
    // 裁剪：保留 orbsCount + 缓冲，防无限增长
    const keep = run.orbsCount + TRAIL.KEEP;
    if (run.trail.length > keep) run.trail.splice(0, run.trail.length - keep);
  }
}

function rebuildOrbs(run) {
  const n = Math.min(run.orbsCount, run.trail.length);
  const headWorldY = run.depth * PX;
  const tail = run.trail.slice(-n).reverse(); // 最新在前 = 离头最近
  run.orbs = tail.map((p) => ({ x: p.x, y: WORLD.HEAD_Y + (headWorldY - p.worldY) }));
}

// ---------- 碰撞 ----------
function handleCollisions(run) {
  const headWorldY = run.depth * PX;
  const headX1 = run.head.x - HEAD.W / 2;
  const headX2 = run.head.x + HEAD.W / 2;
  const headY1 = WORLD.HEAD_Y - HEAD.H / 2;
  const headY2 = WORLD.HEAD_Y + HEAD.H / 2;

  for (const wall of run.walls) {
    if (run._removeWalls.has(wall.id)) continue;
    const screenY = WORLD.HEAD_Y + (headWorldY - wall.worldY);
    const wy1 = screenY - wall.h / 2;
    const wy2 = screenY + wall.h / 2;
    const hit = wall.x < headX2 && wall.x + wall.w > headX1 && wy1 < headY2 && wy2 > headY1;
    if (!hit) {
      maybeNearMiss(run, wall, headX1, headX2, wy1, wy2);
      continue;
    }
    if (wall.kind === 'urchin') handleUrchin(run, wall, screenY);
    else if (wall.kind === 'bossPart') handleBossPart(run, wall);
    else handleCoral(run, wall);
    if (run.phase !== 'playing') break;
  }
  if (run._removeWalls.size) {
    run.walls = run.walls.filter((w) => !run._removeWalls.has(w.id));
    run._removeWalls.clear();
  }
}

function handleCoral(run, wall) {
  if (run.orbsCount <= 0) return die(run);
  const dmg = run.dashActive ? DASH.DAMAGE_MULT : 1;
  wall.value -= dmg;
  loseOrbs(run, dmg, false);
  emit(run, 'wallHit', { x: wall.x + wall.w / 2, y: wallScreenY(run, wall), value: dmg });
  if (wall.value <= 0) {
    emit(run, 'wallBreak', { x: wall.x + wall.w / 2, y: wallScreenY(run, wall), value: wall.initial });
    onWallBreak(run, wall);
  }
}

function onWallBreak(run, wall) {
  run.stats.wallsBroken += 1;
  spawnSparks(run, wall);
  run._removeWalls.add(wall.id);
  run.combo = (run.time - run.lastBreak <= COMBO.WINDOW) ? run.combo + 1 : 1;
  run.lastBreak = run.time;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
  if (!run.tutorialDone) {
    run.tutorialDone = true;
    emit(run, 'tutorialDone', {});
  }
}

function handleUrchin(run, wall, screenY) {
  if (run.time < run.invulnUntil) return; // 无敌窗口内无视
  const cut = run.tailGuard ? URCHIN.CUT_TAILGUARD : URCHIN.CUT;
  loseOrbs(run, cut, true); // 断尾（非破墙扣珠 → 清连击）
  run.invulnUntil = run.time + URCHIN.INVULN;
  emit(run, 'urchinCut', { x: wall.x + wall.w / 2, y: screenY });
}

function handleBossPart(run, wall) {
  if (run.orbsCount <= 0) return die(run);
  const dmg = run.dashActive ? DASH.DAMAGE_MULT : 1;
  wall.value -= dmg;
  loseOrbs(run, dmg, false);
  emit(run, 'bossHit', { partValue: Math.max(0, wall.value) });
  if (wall.value <= 0) {
    run.boss.regen[wall.partIndex] = run.time + BOSS.REGEN_SEC;
    run._removeWalls.add(wall.id);
    if (run.boss && run.boss.active && run.boss.regen.every((t) => t !== Infinity)) {
      emit(run, 'bossBreak', {});
      run.boss = null; // 5 段全穿，Boss 击破，继续无尽下潜
    }
  }
}

function updateBossRegen(run) {
  if (!run.boss || !run.boss.active) return;
  for (let i = 0; i < run.boss.regen.length; i += 1) {
    if (run.boss.regen[i] === Infinity || run.boss.regen[i] > run.time) continue;
    const seg = run.boss.segments[i];
    const v = Math.max(1, Math.floor(seg.initial / 2)); // 半值再生（对原始段值折半，不复算随机）
    pushWall(run, {
      x: seg.x, worldY: run.boss.depth * PX, w: seg.w, h: seg.h,
      value: v, initial: v, kind: 'bossPart', bossId: run.boss.id, partIndex: i,
    });
    run.boss.regen[i] = Infinity;
  }
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  if (run.dashActive) run.dashActive = false;
  emit(run, 'death', {});
}

// ---------- nearMiss ----------
function maybeNearMiss(run, wall, headX1, headX2, wy1, wy2) {
  if (run.time - run.nearMissAt < NEAR_MISS.THROTTLE) return;
  const headY1 = WORLD.HEAD_Y - HEAD.H / 2;
  const headY2 = WORLD.HEAD_Y + HEAD.H / 2;
  if (wy1 >= headY2 || wy2 <= headY1) return; // 垂直未擦肩
  let gap = 0;
  if (wall.x + wall.w <= headX1) gap = headX1 - (wall.x + wall.w);
  else if (wall.x >= headX2) gap = wall.x - headX2;
  if (gap > 0 && gap < NEAR_MISS.GAP) {
    run.nearMissAt = run.time;
    emit(run, 'nearMiss', { x: run.head.x, y: WORLD.HEAD_Y });
  }
}

// ---------- 食物 ----------
function handleFoods(run) {
  const headWorldY = run.depth * PX;
  const remaining = [];
  for (const f of run.foods) {
    const dy = headWorldY - f.worldY;
    const dx = f.x - run.head.x;
    if (Math.hypot(dx, dy) <= FOOD.PICKUP) {
      gainOrb(run, f.x, WORLD.HEAD_Y + dy, f.kind);
      if (f.kind === 'gold') run.stats.goldEaten += 1;
    } else {
      remaining.push(f);
    }
  }
  run.foods = remaining;
}

// ---------- 火花 ----------
function spawnSparks(run, wall) {
  const n = randInt(run.rng, SPARK.COUNT_MIN, SPARK.COUNT_MAX);
  const cx = wall.x + wall.w / 2;
  const cy = wallScreenY(run, wall);
  for (let i = 0; i < n; i += 1) {
    run.sparks.push({
      id: run.nextId++,
      x: cx + randInt(run.rng, -30, 30),
      y: cy + randInt(run.rng, -20, 20),
      vx: randInt(run.rng, -260, 260),
      vy: randInt(run.rng, -260, 260),
      life: SPARK.LIFE,
    });
  }
}

function updateSparks(run, dt) {
  const remaining = [];
  for (const s of run.sparks) {
    s.life -= dt;
    if (s.life <= 0) {
      gainOrb(run, s.x, s.y, 'spark'); // 1s 内必然被吸回
      continue;
    }
    const dx = run.head.x - s.x;
    const dy = WORLD.HEAD_Y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const t = 1 - s.life / SPARK.LIFE; // 0..1，越接近 1 吸力越强
    const acc = SPARK.VACUUM * (0.2 + t);
    s.vx += (dx / d) * acc * dt;
    s.vy += (dy / d) * acc * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (Math.hypot(run.head.x - s.x, WORLD.HEAD_Y - s.y) <= SPARK.PICKUP) {
      gainOrb(run, s.x, s.y, 'spark');
      continue;
    }
    remaining.push(s);
  }
  run.sparks = remaining;
}

// ---------- 连击窗口超时 ----------
function updateCombo(run) {
  if (run.combo > 0 && run.time - run.lastBreak > COMBO.WINDOW) {
    run.combo = 0;
    run.lastBreak = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

// ---------- 清理 ----------
function cull(run) {
  const headWorldY = run.depth * PX;
  run.walls = run.walls.filter((w) => w.worldY > headWorldY - 700);
  run.foods = run.foods.filter((f) => f.worldY > headWorldY - 700);
}

// ---------- 珠数增减 ----------
function gainOrb(run, x, y, kind) {
  if (run.orbsCount >= ORBS.MAX) return;
  run.orbsCount += 1;
  emit(run, 'orbGain', { x, y, kind });
}

function loseOrbs(run, n, resetCombo) {
  for (let i = 0; i < n; i += 1) {
    if (run.orbsCount <= 0) break;
    const tail = run.orbs[run.orbs.length - 1] || { x: run.head.x, y: WORLD.HEAD_Y + ORBS.TRAIL_SPACING };
    run.orbsCount -= 1;
    emit(run, 'orbLose', { x: tail.x, y: tail.y });
  }
  if (resetCombo && run.combo > 0) {
    run.combo = 0;
    run.lastBreak = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

// ---------- HUD / 事件 ----------
function wallScreenY(run, wall) {
  return WORLD.HEAD_Y + (run.depth * PX - wall.worldY);
}

function getHud(run) {
  const bossHp = run.boss && run.boss.active
    ? run.walls.filter((w) => w.kind === 'bossPart').reduce((s, w) => s + w.value, 0)
    : 0;
  const bossMax = run.boss ? run.boss.baseValue * BOSS.SEGMENTS : 0;
  return {
    depth: run.depth,
    orbs: run.orbsCount,
    combo: run.combo,
    maxCombo: run.maxCombo,
    zone: run.zone,
    zoneName: `zone.${run.zone}`,
    dashHeat: run.dashHeat,
    lightRadius: lightRadiusAt(run.zone, run.orbsCount),
    bossHp,
    bossMax,
    phase: run.phase,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
