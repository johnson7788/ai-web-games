// src/game/sim.js — OCEAN DASH · 模拟/玩法核心（纯逻辑，零依赖）
// 契约：docs/README.md（事件名 / 接口签名一字不差）
// run.step(input) / run.getHud() / run.drainEvents()；input = { steerY, gather, jump, glide }
import {
  WORLD, STEP, PLAYER, SCHOOL, STEER, OBSTACLE, BUBBLE, CURRENT, GLIDE,
  NEAR_MISS, MILESTONE, AI as AICONF, clamp, lerp, schoolHeight, speedMult,
} from '../../config/gameplay.js';
import { SEGMENTS, segmentAt, sceneById } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { generateCourse } from './spawner.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    segment: 1,
    dist: 0,
    totalDist: 0,
    player: { y: 400, vy: 0 },
    fish: PLAYER.START_FISH,
    gathered: false,
    boostT: 0,
    boostMult: 1,
    slowT: 0,
    invulnT: 0,
    mode: 'swim',            // swim | air | glide
    counter: false,
    nearMissAt: -Infinity,
    lastMile: 0,
    finished: false,
    obstacles: [],
    bubbles: [],
    currents: [],
    counterZones: [],
    ai: [],
    nextId: 1,
    stats: {
      segmentReached: 1,
      segmentsCleared: 0,
      lastRank: 4,
      bestRank: 99,
      bubblesEaten: 0,
      currentsRidden: 0,
      nearMisses: 0,
      hits: 0,
    },
    events: [],
  };

  loadSegment(run, 1);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架入口
export function createSim() {
  return createRun({ seed: 0 });
}

export function updateSim(run, input = {}) {
  run.step({
    steerY: input.up ? 200 : input.down ? 600 : null,
    gather: !!input.jump,
    jump: false,
    glide: false,
  });
}

// ---------- 载入赛段 ----------
function loadSegment(run, index) {
  const seg = segmentAt(index);
  run.segment = index;
  run.dist = 0;
  run.finished = false;
  run.lastMile = 0;
  run.counter = false;
  run.mode = 'swim';
  run.player.vy = 0;
  run.stats.segmentReached = Math.max(run.stats.segmentReached, index);

  const course = generateCourse(index, run.rng);
  run.obstacles = course.obstacles;
  run.bubbles = course.bubbles;
  run.currents = course.currents;
  run.counterZones = course.counterZones;

  // 3 个 AI 对手（每个赛段重新出发）
  run.ai = [];
  for (let i = 0; i < AICONF.COUNT; i += 1) {
    run.ai.push({
      id: i,
      dist: 0,
      y: lerp(300, 480, i / Math.max(1, AICONF.COUNT - 1)) + (run.rng() - 0.5) * 60,
      vy: 0,
      targetY: 400,
      speedMul: AICONF.SPEED_MIN + run.rng() * (AICONF.SPEED_MAX - AICONF.SPEED_MIN),
      slowT: 0,
      finished: false,
      finishOrder: 0,
      noiseT: run.rng() * 0.5,
    });
  }

  emit(run, 'segmentEnter', { segment: index, name: seg.scene });
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const steerY = input.steerY == null ? null : clamp(input.steerY, WORLD.SURFACE_Y - 80, WORLD.BOTTOM_Y);
  const gather = !!input.gather;
  const jump = !!input.jump;
  const glide = !!input.glide;

  updateGather(run, gather);
  updateVertical(run, steerY, jump, glide, dt);
  updateForward(run, dt);
  updateAI(run, dt);
  handleObstacles(run);
  handleBubbles(run);
  handleCurrents(run);
  updateMilestone(run);
  checkFinish(run);
  cull(run);
}

// ---------- 散聚 ----------
function updateGather(run, gather) {
  if (gather === run.gathered) return;
  run.gathered = gather;
  emit(run, gather ? 'gatherStart' : 'gatherEnd', {});
}

// ---------- 上下移动 + 跃出/滑翔 ----------
function updateVertical(run, steerY, jump, glide, dt) {
  const p = run.player;

  if (run.mode === 'swim') {
    if (jump) {
      run.mode = 'air';
      p.vy = GLIDE.JUMP_VY;
      p.y += p.vy * dt;
      emit(run, 'jump', {});
      return;
    }
    if (steerY == null) {
      p.vy = STEER.IDLE_SINK;
      p.y = clamp(p.y + p.vy * dt, WORLD.WATER_MIN, WORLD.WATER_MAX);
    } else {
      const target = clamp(steerY, WORLD.WATER_MIN, WORLD.WATER_MAX);
      p.vy = clamp((target - p.y) * STEER.LERP, -STEER.MAX_VY, STEER.MAX_VY);
      p.y = clamp(p.y + p.vy * dt, WORLD.WATER_MIN, WORLD.WATER_MAX);
    }
    return;
  }

  if (run.mode === 'air') {
    p.vy += GLIDE.GRAVITY * dt;
    p.y += p.vy * dt;
    // 高出水面 + 按住滑翔键 → 进入滑翔
    if (p.y < WORLD.SURFACE_Y - GLIDE.EXIT_ABOVE && glide) {
      run.mode = 'glide';
      p.vy = 0;
      emit(run, 'glideStart', {});
    } else if (p.vy > 0 && p.y >= WORLD.WATER_MIN) {
      // 下落回到水中（上升阶段不判定，避免刚起跳就被拉回）
      run.mode = 'swim';
      p.y = WORLD.WATER_MIN;
      p.vy = 0;
    }
    return;
  }

  // glide
  p.y += GLIDE.GLIDE_FALL * dt;
  if (!glide) {
    run.mode = 'air';   // 松手改回自由落体
    p.vy = 0;
  } else if (p.y >= WORLD.WATER_MIN) {
    run.mode = 'swim';
    p.y = WORLD.WATER_MIN;
    p.vy = 0;
    emit(run, 'glideEnd', {});
  }
}

// ---------- 前进 ----------
function updateForward(run, dt) {
  const seg = segmentAt(run.segment);
  const st = {
    gathered: run.gathered,
    boostT: run.boostT,
    boostMult: run.boostMult,
    slowT: run.slowT,
    counter: run.counter,
    gliding: run.mode === 'glide',
  };
  const speed = seg.baseSpeed * speedMult(st);
  run.dist += speed * dt;
  run.totalDist += speed * dt;

  run.boostT = Math.max(0, run.boostT - dt);
  run.slowT = Math.max(0, run.slowT - dt);
  run.invulnT = Math.max(0, run.invulnT - dt);

  // 逆流区判定（相对当前 dist）
  run.counter = run.counterZones.some((z) => run.dist >= z.x && run.dist <= z.x + z.w);
}

function applyBoost(run, mult, sec) {
  run.boostT = Math.max(run.boostT, sec);
  run.boostMult = Math.max(run.boostMult, mult);
}

// ---------- 障碍碰撞 / 擦肩 ----------
function boxOf(run) {
  return {
    cx: WORLD.PLAYER_X,
    cy: run.player.y,
    w: PLAYER.W,
    h: schoolHeight(run.fish, run.gathered),
  };
}

function handleObstacles(run) {
  if (run.mode === 'glide') return; // 滑翔在空中，免疫水中障碍
  const box = boxOf(run);
  const px1 = box.cx - box.w / 2;
  const px2 = box.cx + box.w / 2;
  const py1 = box.cy - box.h / 2;
  const py2 = box.cy + box.h / 2;
  for (const o of run.obstacles) {
    const sx = WORLD.PLAYER_X + (o.x - run.dist);
    const sx2 = sx + o.w;
    const oy1 = o.y;
    const oy2 = o.y + o.h;

    const hit = sx < px2 && sx2 > px1 && oy1 < py2 && oy2 > py1;
    if (hit) {
      if (run.invulnT > 0) continue;
      onHit(run, o, sx);
      if (run.phase !== 'playing') return;
      continue;
    }
    maybeNearMiss(run, o, sx, sx2, px1, px2, py1, py2);
  }
}

function onHit(run, o, sx) {
  run.fish = Math.max(0, run.fish - OBSTACLE.HIT_FISH_LOSS);
  run.slowT = OBSTACLE.HIT_SLOW_SEC;
  run.invulnT = OBSTACLE.INVULN_SEC;
  run.stats.hits += 1;
  emit(run, 'obstacleHit', { x: sx, y: run.player.y, kind: o.kind });
  if (run.fish <= 0) die(run);
}

function maybeNearMiss(run, o, sx, sx2, px1, px2, py1, py2) {
  if (run.time - run.nearMissAt < NEAR_MISS.THROTTLE) return;
  if (sx2 <= px1 || sx >= px2) return; // 水平未接近
  let gap = 0;
  if (o.y + o.h <= py1) gap = py1 - (o.y + o.h);
  else if (o.y >= py2) gap = o.y - py2;
  if (gap > 0 && gap < NEAR_MISS.GAP) {
    run.nearMissAt = run.time;
    run.stats.nearMisses += 1;
    emit(run, 'nearMiss', { x: run.player.y, y: sx });
  }
}

// ---------- 气泡 / 洋流 ----------
function handleBubbles(run) {
  const remain = [];
  for (const b of run.bubbles) {
    const dx = b.x - run.dist;
    const dy = b.y - run.player.y;
    if (Math.hypot(dx, dy) <= BUBBLE.R + PLAYER.H / 2) {
      gainFish(run, BUBBLE.FISH_GAIN);
      applyBoost(run, BUBBLE.BOOST_MULT, BUBBLE.BOOST_SEC);
      run.stats.bubblesEaten += 1;
      emit(run, 'bubbleGain', { x: b.x, y: b.y });
    } else {
      remain.push(b);
    }
  }
  run.bubbles = remain;
}

function handleCurrents(run) {
  for (const c of run.currents) {
    if (c.used) continue;
    if (Math.abs(run.dist - c.x) <= CURRENT.W / 2 + PLAYER.W / 2) {
      c.used = true;
      applyBoost(run, CURRENT.BOOST_MULT, CURRENT.BOOST_SEC);
      run.stats.currentsRidden += 1;
      emit(run, 'currentBoost', { x: c.x });
    }
  }
}

function gainFish(run, n) {
  run.fish = Math.min(PLAYER.MAX_FISH, run.fish + n);
}

// ---------- AI 对手 ----------
function updateAI(run, dt) {
  const seg = segmentAt(run.segment);
  for (const ai of run.ai) {
    if (ai.finished) continue;

    let mult = ai.speedMul;
    const diff = run.dist - ai.dist;
    if (diff > 140) mult += AICONF.RUBBER_GAIN;
    else if (diff < -220) mult -= AICONF.RUBBER_LOSE;
    if (ai.slowT > 0) { mult *= AICONF.HIT_SLOW_MULT; ai.slowT -= dt; }

    ai.noiseT -= dt;
    if (ai.noiseT <= 0) {
      ai.noiseT = 0.4 + run.rng() * 0.6;
      const gap = gapAhead(run.obstacles, ai.dist, AICONF.LOOKAHEAD);
      ai.targetY = clamp(gap.y + (run.rng() - 0.5) * 40, WORLD.WATER_MIN, WORLD.WATER_MAX);
    }

    ai.vy = clamp((ai.targetY - ai.y) * 6, -400, 400);
    ai.y = clamp(ai.y + ai.vy * dt, WORLD.WATER_MIN, WORLD.WATER_MAX);
    ai.dist += seg.baseSpeed * mult * dt;

    // AI 碰撞（只减速，不死）
    if (ai.slowT <= 0) {
      for (const o of run.obstacles) {
        const ax1 = WORLD.PLAYER_X + (o.x - ai.dist);
        if (ax1 + o.w < WORLD.PLAYER_X - 20 || ax1 > WORLD.PLAYER_X + 20) continue;
        const ay1 = ai.y - 20;
        const ay2 = ai.y + 20;
        if (o.y < ay2 && o.y + o.h > ay1) {
          ai.slowT = AICONF.HIT_SLOW_SEC;
          break;
        }
      }
    }

    if (ai.dist >= seg.length) {
      ai.finished = true;
      ai.finishOrder = 1 + run.ai.filter((a) => a.finished && a.id !== ai.id).length;
    }
  }
}

// 共享缺口探测：在 [dist+40, dist+lookahead] 区间内找最大的竖直空档
export function gapAhead(obstacles, dist, lookahead) {
  const lo = dist - PLAYER.W;   // 留出玩家碰撞盒宽度：正在穿过的障碍仍算在内
  const hi = dist + lookahead;
  const intervals = [];
  for (const o of obstacles) {
    if (o.x < hi && o.x + o.w > lo) intervals.push([Math.max(WORLD.WATER_MIN, o.y), Math.min(WORLD.WATER_MAX, o.y + o.h)]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const iv of intervals) {
    if (iv[0] >= iv[1]) continue;
    if (!merged.length || iv[0] > merged[merged.length - 1][1]) merged.push([iv[0], iv[1]]);
    else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
  }

  const full = { y: (WORLD.WATER_MIN + WORLD.WATER_MAX) / 2, h: WORLD.WATER_MAX - WORLD.WATER_MIN };
  if (!merged.length) return full;

  let best = null;
  let bestH = 0;
  let prev = WORLD.WATER_MIN;
  for (const iv of merged) {
    const gap = iv[0] - prev;
    if (gap > bestH) { bestH = gap; best = { y: (prev + iv[0]) / 2, h: gap }; }
    prev = Math.max(prev, iv[1]);
  }
  const lastGap = WORLD.WATER_MAX - prev;
  if (lastGap > bestH) { bestH = lastGap; best = { y: (prev + WORLD.WATER_MAX) / 2, h: lastGap }; }
  return best || full;
}

// ---------- 里程碑 / 结算 / 清理 ----------
function updateMilestone(run) {
  const mile = Math.floor(run.dist / MILESTONE.PX);
  if (mile > run.lastMile) {
    run.lastMile = mile;
    if (mile > 0) emit(run, 'milestone', { dist: Math.floor(run.dist) });
  }
}

function checkFinish(run) {
  if (run.finished || run.phase !== 'playing') return;
  const seg = segmentAt(run.segment);
  if (run.dist < seg.length) return;
  run.finished = true;

  const rank = 1 + run.ai.filter((a) => a.finished).length;
  run.stats.lastRank = rank;
  if (rank < run.stats.bestRank) run.stats.bestRank = rank;
  emit(run, 'segmentClear', { segment: run.segment, rank });
  emit(run, 'rank', { rank });

  if (run.segment >= SEGMENTS.length) {
    run.phase = 'completed';
  } else if (rank <= 2) {
    run.stats.segmentsCleared += 1;
    loadSegment(run, run.segment + 1);
  } else {
    run.phase = 'failed';
  }
}

function cull(run) {
  const keep = run.dist - 500;
  run.obstacles = run.obstacles.filter((o) => o.x + o.w > keep);
  run.bubbles = run.bubbles.filter((b) => b.x > keep);
  run.currents = run.currents.filter((c) => c.x + c.w > keep);
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  run.fish = 0;
  emit(run, 'death', {});
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const seg = segmentAt(run.segment);
  const ahead = run.ai.filter((a) => a.finished || a.dist > run.dist).length;
  return {
    segment: run.segment,
    scene: seg.scene,
    sceneName: sceneById(seg.scene).name,
    dist: run.dist,
    length: seg.length,
    rank: ahead + 1,
    fish: run.fish,
    gathered: run.gathered,
    boostT: run.boostT,
    gliding: run.mode === 'glide',
    speed: seg.baseSpeed * speedMult({
      gathered: run.gathered,
      boostT: run.boostT,
      boostMult: run.boostMult,
      slowT: run.slowT,
      counter: run.counter,
      gliding: run.mode === 'glide',
    }),
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
