// src/game/sim.js — DONKEY HURDLE · M1 模拟/玩法核心（纯逻辑，零依赖，无 DOM/localStorage/Date）
// 契约：createRun({seed}) → run；run.step(input) / run.drainEvents() / run.getHud() / run.phase。
// 世界：玩家固定在屏幕 x=PLAYER_X，世界向右推进（distPx 递增），障碍相对左移。
// 玩法：自动奔跑 + 跳过障碍；碰撞掉一罐（陶罐=血量），罐光判负；距离计分，速度渐增。
import {
  STEP, WORLD, DONKEY, JARS, SPEED, SPAWN, MILESTONE_M, clamp,
} from '../../config/gameplay.js';
import { SEGMENTS, SCENE_COUNT, segmentAt, segmentIndexAt, sceneAt } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';
import { pickType, makeObstacle, nextGap } from './spawner.js';

const PXM = WORLD.PX_PER_METER;

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    distPx: 0,
    distance: 0,              // 米
    segment: 1,
    scene: 'dawn',
    jars: JARS.START,
    player: {
      y: WORLD.GROUND_Y,
      vy: 0,
      onGround: true,
      buffer: 0,
      coyote: 0,
      dropAir: false,
      invulnUntil: -Infinity,
    },
    obstacles: [],
    pickups: [],
    nextId: 1,
    spawnWorldX: WORLD.PLAYER_X + 900,   // 第一个障碍在起点前方
    spawnCounter: 0,
    jarCounter: 0,
    combo: 0,
    maxCombo: 0,
    fullStreak: 0,
    _lastFullJump: -Infinity,
    _lastMile: 0,
    _prevJump: false,
    _prevDrop: false,
    stats: {
      segmentReached: 1,
      obstaclesCleared: 0,
      maxCombo: 0,
      jarsCollected: 0,
    },
    events: [],
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const jumpHeld = !!input.jump;
  const jumpPressed = jumpHeld && !run._prevJump;
  const jumpReleased = !jumpHeld && run._prevJump;
  const dropPressed = !!input.dropJump && !run._prevDrop;
  run._prevJump = jumpHeld;
  run._prevDrop = !!input.dropJump;

  // 1) 速度与段切换
  const seg = segmentAt(run.distance);
  const difficulty = Math.min(1, run.distance / 1400);   // 0..1 平滑升温
  const speedMult = 1 + Math.min(run.distance * SPEED.GROWTH_PER_M, SPEED.MAX_MULT - 1);
  const sandMult = seg.sand ? SPEED.SAND_MULT : 1;
  const speed = SPEED.BASE * speedMult * sandMult;

  if (seg.index !== run.segment) {
    run.segment = seg.index;
    run.scene = seg.scene;
    if (seg.index > run.stats.segmentReached) run.stats.segmentReached = seg.index;
    emit(run, 'segmentEnter', { segment: seg.index, scene: seg.scene, name: `seg.${seg.index}` });
  }

  // 2) 推进
  run.distPx += speed * dt;
  run.distance = run.distPx / PXM;

  // 距离里程碑（反馈密度）
  const mile = Math.floor(run.distance / MILESTONE_M);
  if (mile > run._lastMile) {
    run._lastMile = mile;
    if (mile > 0) emit(run, 'distanceMilestone', { distance: Math.floor(run.distance) });
  }

  // 奔跑步幅反馈（真实跑步节奏）：小驴自动奔跑，每一逻辑帧都在迈步，
  // 故每 tick 发一个细粒度 stride 事件（音频层会节流成 gallop 蹄声，不会 60 连发）。
  emit(run, 'stride', {});

  // 3) 玩家物理
  updatePlayer(run, dt, jumpPressed, jumpReleased, dropPressed);

  // 4) 生成（障碍相对左移由 screenX = worldX - distPx 隐式实现）
  // 5) 生成
  spawnUpTo(run, difficulty, seg);

  // 6) 碰撞
  handleCollisions(run);

  // 7) 清理 + 统计
  cull(run);
  run.stats.distance = run.distance;
  run.stats.maxCombo = run.maxCombo;
  run.stats.jarsLeft = run.jars;
}

// ---------- 玩家物理（变量高度跳跃：短按小跳，长按高跳；K 丢罐超高跳） ----------
function updatePlayer(run, dt, jumpPressed, jumpReleased, dropPressed) {
  const p = run.player;

  // 输入缓冲 / 土狼时间
  if (jumpPressed) p.buffer = DONKEY.JUMP_BUFFER_S;
  p.buffer = Math.max(0, p.buffer - dt);
  if (p.onGround) p.coyote = DONKEY.COYOTE_S;
  else p.coyote = Math.max(0, p.coyote - dt);

  // 卸货跳：丢一罐换超高跳（需 ≥2 罐，保证丢后仍 ≥1）
  if (dropPressed && run.jars >= 2) {
    run.jars -= 1;
    p.vy = DONKEY.DROP_JUMP_V;
    p.onGround = false;
    p.dropAir = true;
    run.combo = 0;
    emit(run, 'jarDrop', { jars: run.jars });
    emit(run, 'superJump', {});
  }

  // 普通跳（缓冲 + 地面/土狼）
  if (p.buffer > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = DONKEY.JUMP_V;
    p.onGround = false;
    p.buffer = 0;
    p.coyote = 0;
    p.dropAir = false;
    emit(run, 'jump', {});
    // 满载连跳 → 金色弧线（signature）
    if (run.jars >= JARS.MAX) {
      run.fullStreak = (run.time - run._lastFullJump < 1.6) ? run.fullStreak + 1 : 1;
      run._lastFullJump = run.time;
      if (run.fullStreak >= 2) emit(run, 'fullArc', { streak: run.fullStreak });
    }
  }

  // 上升期松手 → 切短跳跃（短按小跳 / 长按高跳的变量高度来源）
  if (jumpReleased && p.vy < 0 && !p.dropAir) {
    p.vy *= DONKEY.JUMP_CUT;
  }

  // 重力积分
  p.vy += DONKEY.GRAVITY * dt;
  p.y += p.vy * dt;
  if (p.y >= WORLD.GROUND_Y) {
    if (!p.onGround) emit(run, 'land', {});
    p.y = WORLD.GROUND_Y;
    p.vy = 0;
    p.onGround = true;
    p.dropAir = false;
  }
}

function screenX(run, worldX) {
  return worldX - run.distPx;
}

function spawnUpTo(run, difficulty, seg) {
  const playerWorldX = run.distPx + WORLD.PLAYER_X;
  while (run.spawnWorldX < playerWorldX + SPAWN.LOOKAHEAD) {
    const type = pickType(seg, run.rng, difficulty);
    const made = makeObstacle(type, run.spawnWorldX);
    const list = Array.isArray(made) ? made : [made];
    for (const o of list) pushObstacle(run, o);
    run.spawnWorldX += nextGap(run.rng, difficulty);
    run.spawnCounter += 1;

    // 陶罐补给：平均每 JAR_EVERY 个障碍放一个
    run.jarCounter += 1;
    if (run.jarCounter >= SPAWN.JAR_EVERY) {
      run.jarCounter = 0;
      const px = run.spawnWorldX - nextGap(run.rng, difficulty) * 0.5;
      run.pickups.push({
        id: run.nextId++,
        worldX: px,
        y: WORLD.GROUND_Y - JARS.PICKUP_H / 2 - 2,
      });
    }
  }
}

function pushObstacle(run, o) {
  o.id = run.nextId++;
  run.obstacles.push(o);
}

// ---------- 碰撞 ----------
function handleCollisions(run) {
  const p = run.player;
  const px1 = WORLD.PLAYER_X - DONKEY.W / 2;
  const px2 = WORLD.PLAYER_X + DONKEY.W / 2;
  const py1 = p.y - DONKEY.H;   // 头顶
  const py2 = p.y;              // 脚掌
  const invuln = run.time < p.invulnUntil;

  for (const o of run.obstacles) {
    if (o.hit || o.cleared) continue;
    const x = screenX(run, o.worldX);
    const ox1 = x - o.w / 2;
    const ox2 = x + o.w / 2;

    if (o.type === 'pit') {
      // 坑洞：脚掌贴近地面且水平中心落入坑内 → 掉坑
      const centerInPit = WORLD.PLAYER_X >= ox1 && WORLD.PLAYER_X <= ox2;
      if (centerInPit && p.y >= WORLD.GROUND_Y - 8 && !invuln) {
        o.hit = true;
        loseJar(run, 'fell');
      }
      continue;
    }

    // 地面障碍 AABB
    const oy1 = WORLD.GROUND_Y - o.h;
    const oy2 = WORLD.GROUND_Y;
    const hit = px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1;
    if (hit) {
      if (invuln) {
        // 无敌窗口内擦身，不判伤，但记录贴近度（用于 nearMiss）
        continue;
      }
      o.hit = true;
      loseJar(run, 'hit');
      continue;
    }

    // 记录贴近度：玩家脚掌高于障碍顶的垂直余量（正值=擦肩而过）
    if (!o.hit && !o.cleared && px1 < ox2 && px2 > ox1) {
      const clearance = p.y - (WORLD.GROUND_Y - o.h);
      if (clearance >= 0 && clearance < o.minClearance) o.minClearance = clearance;
    }

    // 完全越过：判清除 / nearMiss
    if (ox2 < px1 && !o.cleared) {
      o.cleared = true;
      run.stats.obstaclesCleared += 1;
      run.combo += 1;
      if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      const tight = o.minClearance !== Infinity && o.minClearance < 26;
      if (tight) emit(run, 'nearMiss', { x, obstacleType: o.type });
      emit(run, 'obstacleClear', { obstacleType: o.type, combo: run.combo });
      if (run.combo > 1) emit(run, 'comboUp', { combo: run.combo });
    }
  }

  // 补给拾取
  const remaining = [];
  for (const pk of run.pickups) {
    const x = screenX(run, pk.worldX);
    const dx = Math.abs(x - WORLD.PLAYER_X);
    const dy = Math.abs(pk.y - (p.y - DONKEY.H / 2));
    if (dx < (DONKEY.W / 2 + JARS.PICKUP_W / 2) && dy < (DONKEY.H / 2 + JARS.PICKUP_H / 2)) {
      if (run.jars < JARS.MAX) {
        run.jars += 1;
        run.stats.jarsCollected += 1;
        emit(run, 'jarGain', { jars: run.jars });
      }
    } else {
      remaining.push(pk);
    }
  }
  run.pickups = remaining;
}

function loseJar(run, cause) {
  if (run.phase !== 'playing') return;
  run.jars -= 1;
  run.player.invulnUntil = run.time + DONKEY.INVULN_S;
  if (run.combo > 0) {
    run.combo = 0;
    emit(run, 'comboBreak', {});
  }
  emit(run, cause, { jars: run.jars });
  if (run.jars <= 0) {
    run.phase = 'dead';
    emit(run, 'death', {});
  }
}

function cull(run) {
  const playerWorldX = run.distPx + WORLD.PLAYER_X;
  run.obstacles = run.obstacles.filter((o) => o.worldX > playerWorldX - 400);
  run.pickups = run.pickups.filter((p) => p.worldX > playerWorldX - 400);
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    distance: run.distance,
    jars: run.jars,
    jarMax: JARS.MAX,
    segment: run.segment,
    segmentName: `seg.${run.segment}`,
    scene: run.scene,
    speed: SPEED.BASE * (1 + Math.min(run.distance * SPEED.GROWTH_PER_M, SPEED.MAX_MULT - 1)),
    combo: run.combo,
    fullLoad: run.jars >= JARS.MAX,
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

export { segmentAt, segmentIndexAt, sceneAt, SCENE_COUNT, SEGMENTS };
