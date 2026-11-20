// CORGI DASH · 模拟/玩法核心（纯逻辑，零 DOM/localStorage/Date.now；随机用 seed）
// 契约：docs/README.md（事件名 / 接口签名一字不差）
// 横向跑酷：世界向左滚动，柯基固定 x；点击跳（二段跳/长按变高）；收集羊群；撞障碍死羊/判负。
import {
  WORLD, PLAYER, SPEED, SCORE, FLOCK, WHISTLE, PERFECT, HIT, NEAR_MISS, SPAWN, STEP,
  clamp, speedAt, scoreMult, sheepLossFor,
} from '../../config/gameplay.js';
import { SEGMENT_COUNT, segmentAt, segmentFor } from '../../config/segments.js';
import { mulberry32, randInt, pick } from './rng.js';
import { spawnObstacles, spawnSheepPickup, OBSTACLE_KINDS } from './spawner.js';

const PX = WORLD.PX_PER_METER;
const PEN_MARGIN = 120; // 移动羊圈的屏幕活动边距

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    scrollX: 0,
    distance: 0,
    segment: 1,
    speed: SPEED.BASE,
    player: {
      x: WORLD.PLAYER_X,
      y: WORLD.GROUND_Y - PLAYER.H, // 顶部 y
      vy: 0,
      onGround: true,
      airborne: false,
      jumpsLeft: 2,
      coyote: 0,
      jumpBuffer: 0,
    },
    flock: 0,
    maxFlock: 0,
    trail: [],          // 羊链采样点（屏幕空间）
    trailAccum: 0,
    lastTrail: null,
    obstacles: [],      // {id, kind, x(worldX 左缘), y(顶部), w, h, passed, cleared, moving, penVx}
    pickups: [],        // {id, kind:'sheep', x, y, w, h, taken}
    nextId: 1,
    nextObstacleX: SPAWN.FIRST_OBSTACLE_X,
    nextSheepX: SPAWN.FIRST_SHEEP_X,
    whistleCd: 0,
    scattered: 0,
    invulnUntil: -Infinity,
    nearMissAt: -Infinity,
    perfectStreak: 0,
    maxPerfectStreak: 0,
    score: 0,
    _lastMile: 0,
    stats: {
      distance: 0,
      maxFlock: 0,
      segmentReached: 1,
      score: 0,
      perfect: 0,
      sheepCollected: 0,
      obstaclesHit: 0,
    },
    events: [],
  };

  initTrail(run);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const jumpPressed = !!input.jumpPressed;
  const jumpHeld = !!input.jump;
  const whistlePressed = !!input.whistle;

  run.speed = speedAt(run.time);
  run.scrollX += run.speed * dt;
  run.distance = run.scrollX / PX;

  updatePlayer(run, jumpPressed, jumpHeld, dt);
  updateWhistle(run, whistlePressed, dt);
  spawnUpTo(run);
  spawnSheepUpTo(run);
  updatePens(run, dt);
  recordTrail(run);
  handlePickups(run);
  handleCollisions(run);
  if (run.phase !== 'playing') { syncStats(run); return; }
  updateSegment(run);
  updateMilestone(run);
  cull(run);
  // 核心动词反馈：柯基每帧都在奔跑（渲染腿动画同步），作为细粒度里程碑事件保证反馈密度
  emit(run, 'run', { distance: run.distance });
  syncStats(run);
}

// ---------- 玩家跳跃 / 重力 ----------
function updatePlayer(run, jumpPressed, jumpHeld, dt) {
  const p = run.player;

  // 跳跃缓冲 + coyote
  if (jumpPressed) p.jumpBuffer = PLAYER.JUMP_BUFFER;
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (p.onGround) p.coyote = PLAYER.COYOTE;
  else p.coyote = Math.max(0, p.coyote - dt);

  // 起跳判定
  if (p.jumpBuffer > 0) {
    if (p.onGround || p.coyote > 0) {
      doJump(run, PLAYER.JUMP_VELOCITY);
      p.jumpBuffer = 0;
      p.coyote = 0;
    } else if (p.jumpsLeft > 0) {
      doJump(run, PLAYER.DOUBLE_JUMP_VELOCITY);
      p.jumpBuffer = 0;
    }
  }

  // 重力（按住跳跃键上升期用轻重力 = 长按变高）
  const g = (jumpHeld && p.vy < 0) ? PLAYER.HOLD_GRAVITY : PLAYER.GRAVITY;
  p.vy += g * dt;
  if (p.vy > PLAYER.MAX_FALL) p.vy = PLAYER.MAX_FALL;

  const wasAir = p.airborne;
  p.y += p.vy * dt;

  const groundTop = WORLD.GROUND_Y - PLAYER.H;
  if (p.y >= groundTop) {
    p.y = groundTop;
    p.vy = 0;
    if (wasAir) emit(run, 'land', {});
    p.onGround = true;
    p.airborne = false;
    p.jumpsLeft = 2;
  } else {
    p.onGround = false;
    p.airborne = true;
  }
}

function doJump(run, vel) {
  const p = run.player;
  p.vy = vel;
  p.onGround = false;
  p.airborne = true;
  if (vel === PLAYER.JUMP_VELOCITY) p.jumpsLeft = 1;      // 一跳后剩 1 次二段跳
  else p.jumpsLeft = 0;                                    // 二段跳用完
  emit(run, 'jump', { vy: vel, y: p.y });
}

// ---------- 口哨 ----------
function updateWhistle(run, whistlePressed, dt) {
  const wasReady = run.whistleCd <= 0; // 递减前是否就绪（用于检测就绪沿）
  run.whistleCd = Math.max(0, run.whistleCd - dt);
  if (run.whistleCd < 1e-6) run.whistleCd = 0; // 消浮点误差，保证冷却能精确归零
  run.scattered = Math.max(0, run.scattered - dt);

  if (whistlePressed && run.whistleCd <= 0) {
    run.whistleCd = WHISTLE.COOLDOWN;
    run.scattered = WHISTLE.SCATTER;
    emit(run, 'whistle', {});
  }
  if (!wasReady && run.whistleCd <= 0) emit(run, 'whistleReady', {});
}

// ---------- 生成 ----------
function spawnUpTo(run) {
  while (run.nextObstacleX < run.scrollX + SPAWN.LOOKAHEAD) {
    const seg = segmentFor(run.distance);
    const specs = spawnObstacles(run.rng, seg, run.nextObstacleX);
    for (const s of specs) {
      s.id = run.nextId++;
      run.obstacles.push(s);
    }
    // 下一障碍间隔（px）随段递减；doubleFence/row 多实体只占一格游标
    const gap = randInt(run.rng, seg.gapMin, seg.gapMax);
    run.nextObstacleX += gap;
  }
}

function spawnSheepUpTo(run) {
  while (run.nextSheepX < run.scrollX + SPAWN.LOOKAHEAD) {
    const s = spawnSheepPickup(run.rng, run.nextSheepX);
    s.id = run.nextId++;
    run.pickups.push(s);
    run.nextSheepX += randInt(run.rng, SPAWN.SHEEP_GAP_MIN, SPAWN.SHEEP_GAP_MAX);
  }
}

// ---------- 移动羊圈 ----------
function updatePens(run, dt) {
  for (const o of run.obstacles) {
    if (o.kind !== 'pen' || o.cleared) continue;
    const screenX = o.x - run.scrollX;
    if (o.penVx == null) o.penVx = 70 * (run.rng() < 0.5 ? -1 : 1);
    o.x += o.penVx * dt;
    const next = o.x - run.scrollX;
    if (next < PEN_MARGIN) o.penVx = Math.abs(o.penVx);
    else if (next + o.w > WORLD.WIDTH - PEN_MARGIN) o.penVx = -Math.abs(o.penVx);
  }
}

// ---------- 羊链轨迹 ----------
function initTrail(run) {
  run.trail = [];
  run.lastTrail = { x: WORLD.PLAYER_X, screenY: WORLD.GROUND_Y - PLAYER.H };
}

function recordTrail(run) {
  const prev = run.lastTrail;
  const dx = WORLD.PLAYER_X - prev.x;
  const dy = (WORLD.GROUND_Y - PLAYER.H) - prev.screenY;
  const d = Math.hypot(dx, dy);
  if (d >= FLOCK.TRAIL_GAP) {
    const pt = { x: WORLD.PLAYER_X, screenY: WORLD.GROUND_Y - PLAYER.H };
    run.trail.push(pt);
    run.lastTrail = pt;
    const keep = run.flock + 60;
    if (run.trail.length > keep) run.trail.splice(0, run.trail.length - keep);
  }
}

// ---------- 拾取羊 ----------
function handlePickups(run) {
  const p = run.player;
  const remaining = [];
  for (const s of run.pickups) {
    if (s.taken) continue;
    const screenX = s.x - run.scrollX;
    const overlap = screenX < (WORLD.PLAYER_X + PLAYER.W / 2)
      && screenX + s.w > (WORLD.PLAYER_X - PLAYER.W / 2)
      && p.y < s.y + s.h && p.y + PLAYER.H > s.y;
    if (overlap) {
      s.taken = true;
      gainSheep(run, screenX, s.y);
    } else if (screenX + s.w > 0) {
      remaining.push(s);
    }
  }
  run.pickups = remaining;
}

function gainSheep(run, x, y) {
  if (run.flock >= FLOCK.MAX) {
    emit(run, 'sheepGain', { x, y, capped: true });
    run.score += SCORE.SHEEP_PICKUP * 0.5;
    return;
  }
  run.flock += 1;
  run.stats.sheepCollected += 1;
  run.score += SCORE.SHEEP_PICKUP;
  emit(run, 'sheepGain', { x, y, flock: run.flock });
}

// ---------- 碰撞 ----------
function handleCollisions(run) {
  const p = run.player;
  for (const o of run.obstacles) {
    if (o.cleared) continue;
    const screenX = o.x - run.scrollX;

    // 越过判定（完美落点 / 擦肩 / 断连击）
    if (!o.passed && screenX + o.w < WORLD.PLAYER_X - PLAYER.W / 2) {
      o.passed = true;
      if (o.kind !== 'bridge') {
        const clearance = o.y - (p.y + PLAYER.H);
        if (p.airborne && clearance >= 0 && clearance <= PERFECT.CLEARANCE) onPerfect(run, o);
        else if (p.airborne && clearance > PERFECT.CLEARANCE && clearance <= NEAR_MISS.RANGE) onNearMiss(run);
        else run.perfectStreak = 0;
      }
    }

    if (screenX > WORLD.PLAYER_X + PLAYER.W / 2) continue; // 还在前方
    if (screenX + o.w < WORLD.PLAYER_X - PLAYER.W / 2) continue; // 已甩在身后

    // 碰撞盒（各缩 5px 容错，手感情愿）
    const ox1 = screenX + 5, ox2 = screenX + o.w - 5;
    const oy1 = o.y + 5, oy2 = o.y + o.h - 5;
    const px1 = WORLD.PLAYER_X - PLAYER.W / 2 + 5, px2 = WORLD.PLAYER_X + PLAYER.W / 2 - 5;
    const py1 = p.y + 5, py2 = p.y + PLAYER.H - 5;
    const hit = ox1 < px2 && ox2 > px1 && oy1 < py2 && oy2 > py1;
    if (hit) {
      onObstacleHit(run, o);
      if (run.phase !== 'playing') return;
    }
  }
}

function onObstacleHit(run, o) {
  if (run.time < run.invulnUntil) return;
  // 无羊 → 判负（P0：障碍碰撞判负）
  if (run.flock <= 0) {
    die(run);
    return;
  }
  // 口哨散开中：羊群闪避，不损失羊，但障碍清掉 + 无敌
  if (run.scattered > 0) {
    o.cleared = true;
    run.invulnUntil = run.time + HIT.INVULN;
    emit(run, 'sheepScatter', { x: o.x, kind: o.kind });
    return;
  }
  const lost = sheepLossFor(run.flock);
  run.flock -= lost;
  run.score = Math.max(0, run.score - lost * SCORE.SHEEP_LOSS_PENALTY);
  run.perfectStreak = 0;
  run.stats.obstaclesHit += 1;
  o.cleared = true;
  run.invulnUntil = run.time + HIT.INVULN;
  emit(run, 'obstacleHit', { x: o.x, kind: o.kind, lost });
  emit(run, 'sheepLose', { count: lost, x: o.x });
}

function onPerfect(run, o) {
  run.perfectStreak += 1;
  if (run.perfectStreak > run.maxPerfectStreak) run.maxPerfectStreak = run.perfectStreak;
  run.score += SCORE.PERFECT_BONUS;
  run.stats.perfect += 1;
  emit(run, 'perfectLand', { streak: run.perfectStreak, x: o.x });
  if (run.perfectStreak >= PERFECT.SURGE_STREAK) {
    const bonus = run.flock * PERFECT.SURGE_BONUS_PER_SHEEP;
    run.score += bonus;
    emit(run, 'sheepSurge', { bonus, flock: run.flock });
    run.perfectStreak = 0;
  }
}

function onNearMiss(run) {
  if (run.time - run.nearMissAt < NEAR_MISS.THROTTLE) return;
  run.nearMissAt = run.time;
  emit(run, 'nearMiss', { x: WORLD.PLAYER_X });
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { distance: run.distance, score: Math.floor(run.score), flock: run.flock });
}

// ---------- 段推进 / 里程碑 ----------
function updateSegment(run) {
  const seg = segmentAt(run.distance);
  if (seg !== run.segment) {
    run.segment = seg;
    emit(run, 'segmentEnter', { segment: seg, name: `seg.${seg}` });
    if (seg > run.stats.segmentReached) run.stats.segmentReached = seg;
  }
}

function updateMilestone(run) {
  const mile = Math.floor(run.distance / 25);
  if (mile > run._lastMile) {
    run._lastMile = mile;
    if (mile > 0) emit(run, 'milestone', { distance: Math.floor(run.distance) });
  }
}

// ---------- 清理 ----------
function cull(run) {
  run.obstacles = run.obstacles.filter((o) => !o.cleared && o.x - run.scrollX > -400);
  run.pickups = run.pickups.filter((s) => !s.taken && s.x - run.scrollX > -200);
}

// ---------- HUD / 事件 ----------
function syncStats(run) {
  run.stats.distance = run.distance;
  run.stats.maxFlock = Math.max(run.stats.maxFlock, run.flock);
  run.stats.score = run.score;
}

function getHud(run) {
  return {
    distance: run.distance,
    score: Math.floor(run.score),
    flock: run.flock,
    maxFlock: run.stats.maxFlock,
    segment: run.segment,
    segmentName: `seg.${run.segment}`,
    speed: run.speed,
    whistleReady: run.whistleCd <= 0,
    whistleCd: run.whistleCd,
    scattered: run.scattered > 0,
    perfectStreak: run.perfectStreak,
    scoreMult: scoreMult(run.flock),
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
