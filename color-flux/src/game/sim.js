// COLOR FLUX · M1 模拟/玩法核心（纯逻辑，零依赖，不碰 DOM/window/localStorage/Date.now）
// 契约：createRun({seed}) → run；run.step(input) / run.getHud() / run.drainEvents()。
// 事件名：jump / hoverStart / hoverEnd / pass / wrongColor / fall / death / colorChange /
//   dualStart / dualEnd / rhythmBeat / auroraBurst / nearMiss / segmentEnter / milestone。
import {
  WORLD, BALL, RING, RHYTHM, DUAL, BURST, PICKUP, NEAR_MISS, PULSE, PROGRESS, SHAPES, COLORS, COLOR_COUNT,
  STEP, clamp,
} from '../../config/gameplay.js';
import { SEGMENTS, SEGMENT_COUNT, SCENES, segmentAt, sceneOf } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';

const SEG_ANGLE = (segCount) => 360 / segCount;

// 障碍旋转角度（度）。普通环匀速；韵律环按节拍阶跃。
export function rotOf(o, time) {
  const t = Math.max(0, time - o.birthTime);
  if (o.isRhythm) {
    const steps = Math.floor(t / RHYTHM.BEAT);
    return o.rot0 + steps * SEG_ANGLE(o.segCount);
  }
  return o.rot0 + o.omega * t;
}

// 顶部（12 点钟方向）当前对应的段索引。
function topIndex(o, time) {
  const local = (((270 - rotOf(o, time)) % 360) + 360) % 360;
  return Math.floor(local / SEG_ANGLE(o.segCount)) % o.segCount;
}

// 顶部段颜色 id。
export function topColorOf(o, time) {
  return o.colors[topIndex(o, time)];
}

// 下一次「顶部颜色 == color」的匹配窗口中心（绝对时间，秒）。
// 普通环按匀速旋转求解；韵律环按节拍阶跃求解。返回 null 表示（理论上）找不到。
export function nextMatchCenter(o, color, time) {
  const segAngle = 360 / o.segCount;
  if (o.isRhythm) {
    const curSteps = Math.floor(Math.max(0, time - o.birthTime) / RHYTHM.BEAT);
    for (let s = curSteps; s < curSteps + o.segCount + 2; s += 1) {
      const rot = o.rot0 + s * segAngle;
      const local = (((270 - rot) % 360) + 360) % 360;
      const idx = Math.floor(local / segAngle) % o.segCount;
      if (o.colors[idx] === color) {
        return o.birthTime + (s + 0.5) * RHYTHM.BEAT;
      }
    }
    return null;
  }
  // 连续旋转：topIndex == color 的窗口中心角（local 中心 = color*segAngle + segAngle/2）
  const targetLocal = color * segAngle + segAngle / 2;
  const rotTarget = (((270 - targetLocal) % 360) + 360) % 360;
  const rotNow = o.rot0 + o.omega * (time - o.birthTime);
  const delta = (((rotTarget - rotNow) % 360) + 360) % 360;
  return time + delta / o.omega;
}

// 顶部角度是否贴近段边界（用于 nearMiss）。
function topNearEdge(o, time) {
  const local = (((270 - rotOf(o, time)) % 360) + 360) % 360;
  const seg = SEG_ANGLE(o.segCount);
  const r = local % seg;
  return r < NEAR_MISS.EDGE_DEG || (seg - r) < NEAR_MISS.EDGE_DEG;
}

// 形状基础色环（全部 6 色；风车 12 段 = 每色两次，窄窗）。
function baseColors(segCount) {
  if (segCount <= COLOR_COUNT) return COLORS.map((c, i) => i).slice(0, segCount);
  const out = [];
  for (let i = 0; i < segCount; i += 1) out.push(i % COLOR_COUNT);
  return out;
}

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    score: 0,
    ringsPassed: 0,
    ringsSpawned: 0,
    streak: 0,
    maxStreak: 0,
    segment: 1,
    scene: 0,
    scroll: SEGMENTS[0].scroll,
    ball: {
      y: 430,
      color: 0,
      hoverTank: BALL.HOVER_MAX,
      hovering: false,
      mode: 'falling',   // 'rising' | 'falling'
      riseLeft: 0,
    },
    obstacles: [],     // { id, y, shape, segCount, colors, rot0, omega, isRhythm, birthTime, passed, _lastBeat }
    pickups: [],       // { id, y, kind, color }
    dualUntil: -Infinity,
    dualColors: [],
    nextId: 1,
    _wasHovering: false,
    _nearMissAt: -Infinity,
    _milestoneLast: 0,
    _lastPulse: 0,
    stats: { segmentReached: 1, bestStreak: 0, pickups: 0 },
    events: [],
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);

  // 预生成首批环带
  while (run.obstacles.length < 6) spawnObstacle(run);
  return run;
}

export function createSim() {
  return createRun({ seed: 0 });
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const jumpEdge = !!input.jump;
  const hoverHeld = !!input.hover;

  updateBall(run, jumpEdge, hoverHeld, dt);
  pulse(run);
  updateSegmentByRings(run);
  scrollObstacles(run, dt);
  spawnUpTo(run);
  handlePickups(run);
  handleCollisions(run);
  updateDual(run);
  cull(run);

  run.stats.bestStreak = Math.max(run.stats.bestStreak, run.streak);
  run.stats.segmentReached = Math.max(run.stats.segmentReached, run.segment);
}

// ---------- 萤（球）物理（恒速起跳/下落） ----------
function updateBall(run, jumpEdge, hoverHeld, dt) {
  const b = run.ball;

  if (jumpEdge) {
    b.mode = 'rising';
    b.riseLeft = BALL.RISE_HEIGHT;
    emit(run, 'jump', { y: Math.round(b.y) });
  }

  // 悬浮：按住且还有表
  const canHover = hoverHeld && b.hoverTank > 0;
  if (canHover && !run._wasHovering) {
    b.hovering = true;
    emit(run, 'hoverStart', { y: Math.round(b.y) });
  } else if (!canHover && run._wasHovering) {
    b.hovering = false;
    emit(run, 'hoverEnd', { y: Math.round(b.y) });
  }
  run._wasHovering = canHover;
  b.hovering = canHover;

  if (b.hovering) b.hoverTank = Math.max(0, b.hoverTank - BALL.HOVER_DRAIN * dt);
  else b.hoverTank = Math.min(BALL.HOVER_MAX, b.hoverTank + BALL.HOVER_REGEN * dt);

  if (b.hovering) {
    // 悬浮：锁定位置（上升/下落都冻结，便于精确对准）
  } else if (b.mode === 'rising') {
    b.y -= BALL.V_RISE * dt;
    b.riseLeft -= BALL.V_RISE * dt;
    if (b.riseLeft <= 0) b.mode = 'falling';
  } else {
    b.y += BALL.V_FALL * dt;
    // 地板反弹：落到底自动起跳（不会因掉落判负）
    if (b.y >= WORLD.FLOOR_Y) {
      b.y = WORLD.FLOOR_Y;
      b.mode = 'rising';
      b.riseLeft = BALL.RISE_HEIGHT;
    }
  }
  b.y = Math.max(WORLD.CEIL_Y, b.y);
}

// ---------- 心跳脉冲（细粒度反馈） ----------
function pulse(run) {
  if (run.time - run._lastPulse >= PULSE.EVERY) {
    run._lastPulse = run.time;
    emit(run, 'pulse', { y: Math.round(run.ball.y) });
  }
}

// ---------- 推进（12 段，每 PROGRESS.RINGS_PER_SEGMENT 环一段） ----------
function updateSegmentByRings(run) {
  const seg = Math.min(PROGRESS.MAX_SEGMENT, Math.floor(run.ringsPassed / PROGRESS.RINGS_PER_SEGMENT) + 1);
  if (seg !== run.segment) {
    run.segment = seg;
    run.scene = sceneOf(seg);
    run.scroll = segmentAt(seg).scroll;
    emit(run, 'segmentEnter', { segment: seg, scene: run.scene });
    if (seg > run.stats.segmentReached) run.stats.segmentReached = seg;
  }
}

// ---------- 障碍滚动 + 韵律节拍 ----------
function scrollObstacles(run, dt) {
  for (const o of run.obstacles) {
    o.y += run.scroll * dt;
    if (o.isRhythm && o.y > -60 && o.y < WORLD.HEIGHT + 60) {
      const beat = Math.floor(Math.max(0, run.time - o.birthTime) / RHYTHM.BEAT);
      if (beat !== (o._lastBeat ?? -1)) {
        o._lastBeat = beat;
        emit(run, 'rhythmBeat', { y: Math.round(o.y), beat });
      }
    }
  }
}

// ---------- 生成（保持至少 6 道环带在飞行） ----------
function spawnUpTo(run) {
  while (run.obstacles.length < 6) spawnObstacle(run);
}

function spawnObstacle(run) {
  const seg = segmentAt(run.segment);
  const segCount = SHAPES[seg.shape] ?? 6;
  const topY = run.obstacles.length
    ? Math.min(...run.obstacles.map((o) => o.y))
    : RING.SPAWN_Y;
  const y = run.obstacles.length ? topY - RING.GAP : RING.SPAWN_Y;
  run.ringsSpawned += 1;
  const isRhythm = run.ringsSpawned % RHYTHM.EVERY === 0;
  const o = {
    id: run.nextId++,
    y,
    shape: seg.shape,
    segCount,
    colors: baseColors(segCount),
    rot0: randInt(run.rng, 0, 359),
    omega: seg.omega,
    isRhythm,
    birthTime: run.time,
    passed: false,
    _lastBeat: -1,
  };
  run.obstacles.push(o);

  // 色换器 / 双色核心：插在刚生成的环带与上一道之间的缝隙里（y 更大处 = 更靠近球）
  if (run.ringsSpawned % PICKUP.EVERY_RINGS === 0) {
    spawnPickup(run, y + RING.GAP * 0.5, 'color');
  }
  if (run.ringsSpawned % PICKUP.DUAL_EVERY === 0) {
    spawnPickup(run, y + RING.GAP * 0.75, 'dual');
  }
}

function spawnPickup(run, y, kind) {
  const color = kind === 'color' ? randInt(run.rng, 0, COLOR_COUNT - 1) : -1;
  run.pickups.push({ id: run.nextId++, y, kind, color });
}

// ---------- 拾取 ----------
function handlePickups(run) {
  const b = run.ball;
  const remaining = [];
  for (const p of run.pickups) {
    const reach = Math.abs(b.y - p.y) < (PICKUP.R + BALL.R);
    if (reach) {
      if (p.kind === 'color') {
        const from = b.color;
        let to = p.color;
        if (to === from) to = (to + 1) % COLOR_COUNT;
        b.color = to;
        emit(run, 'colorChange', { from, to });
      } else if (p.kind === 'dual') {
        run.dualUntil = run.time + DUAL.DURATION;
        run.dualColors = [b.color, (b.color + DUAL.SECOND_OFFSET) % COLOR_COUNT];
        emit(run, 'dualStart', { colors: run.dualColors });
      }
      run.stats.pickups += 1;
    } else {
      remaining.push(p);
    }
  }
  run.pickups = remaining;
}

// ---------- 碰撞判定 ----------
function handleCollisions(run) {
  const b = run.ball;
  const dualActive = run.time < run.dualUntil;
  for (const o of run.obstacles) {
    if (o.passed) continue;
    if (Math.abs(b.y - o.y) >= RING.PASS_BAND) continue;

    const color = topColorOf(o, run.time);
    const ok = b.color === color || (dualActive && run.dualColors.includes(color));
    if (ok) {
      o.passed = true;
      onPass(run, color, o);
    } else {
      if (topNearEdge(o, run.time) && run.time - run._nearMissAt > NEAR_MISS.THROTTLE) {
        run._nearMissAt = run.time;
        emit(run, 'nearMiss', { y: Math.round(o.y), color });
      }
      emit(run, 'wrongColor', { y: Math.round(o.y), color, ballColor: b.color });
      die(run, 'wrongColor');
      return;
    }
  }
}

function onPass(run, segmentColor, o) {
  const dualActive = run.time < run.dualUntil;
  run.score += dualActive ? DUAL.SCORE_MULT : 1;
  run.ringsPassed += 1;
  run.streak += 1;
  run.maxStreak = Math.max(run.maxStreak, run.streak);
  emit(run, 'pass', {
    ring: run.ringsPassed,
    streak: run.streak,
    segmentColor,
    ballColor: run.ball.color,
    dual: dualActive,
  });
  emit(run, 'milestone', { rings: run.ringsPassed });

  if (run.streak >= BURST.STREAK) {
    emit(run, 'auroraBurst', { streak: run.streak });
    run.score += BURST.BONUS;
    run.streak = 0;
  }
}

function updateDual(run) {
  if (run.time >= run.dualUntil && run.dualUntil > -Infinity) {
    run.dualUntil = -Infinity;
    run.dualColors = [];
    emit(run, 'dualEnd', {});
  }
}

function cull(run) {
  run.obstacles = run.obstacles.filter((o) => o.y < WORLD.HEIGHT + RING.RADIUS + 80);
  run.pickups = run.pickups.filter((p) => p.y < WORLD.HEIGHT + 80);
}

function die(run, cause) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { cause });
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    phase: run.phase,
    score: run.score,
    scoreInt: Math.floor(run.score),
    segment: run.segment,
    scene: run.scene,
    streak: run.streak,
    ringsPassed: run.ringsPassed,
    dualActive: run.time < run.dualUntil,
    dualRemain: Math.max(0, run.dualUntil - run.time),
    ballColor: run.ball.color,
    hoverTank: run.ball.hoverTank,
    hoverMax: BALL.HOVER_MAX,
    maxStreak: run.maxStreak,
    bestStreak: run.stats.bestStreak,
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
