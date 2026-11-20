// src/game/sim.js — SKY DROP DODGE · 模拟/玩法核心（纯逻辑，零依赖）
// 契约见 docs/analysis.md；事件名 / 接口签名与 main / render / audio 一字不差。
import {
  WORLD, STEP, PLAYER, HP, SHIELD, WIND, NEAR_MISS, RIPPLE, DRONE, ITEMS,
  clamp, lerp, laneAt, gradeFor,
} from '../../config/gameplay.js';
import { WAVES, WAVE_COUNT, waveAt, totalDurationSec } from '../../config/levels.js';
import { mulberry32, randInt, pick } from './rng.js';
import { buildItem, intervalFor } from './spawner.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startWave = 1 } = {}) {
  const rng = mulberry32(seed);
  const waveIndex = clamp(startWave, 1, WAVE_COUNT);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    player: {
      x: PLAYER.START_X,
      vx: 0,
      hp: HP.MAX,
      shield: SHIELD.MAX,
      shieldCharge: 0,
      blocking: false,
      invulnUntil: -Infinity,
    },
    waveIndex,
    waveTime: 0,
    scene: waveAt(waveIndex).scene,
    items: [],
    nextId: 1,
    spawnTimer: 0,
    nearMissChain: 0,
    lastNearMissAt: -Infinity,
    rippleUntil: -Infinity,
    timeScale: 1,
    style: 0,
    stats: {
      waveReached: waveIndex,
      blocksSmall: 0,
      blocksBig: 0,
      nearMisses: 0,
      ripples: 0,
      style: 0,
      time: 0,
    },
    events: [],
    _lastSec: 0,
    _lastTenth: -1,
  };

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

  const steerX = input.steerX == null ? null : clamp(input.steerX, 0, WORLD.WIDTH);
  const blocking = !!input.block;

  updatePlayer(run, steerX, blocking, dt);
  updateShield(run, dt);
  updateRipple(run);
  updateWave(run, dt);
  updateSpawns(run, steerX);
  updateItems(run, dt);
  cull(run);

  // 每秒一个里程碑（保证事件密度 / HUD 脉冲）
  const sec = Math.floor(run.time);
  if (sec > run._lastSec) {
    run._lastSec = sec;
    emit(run, 'milestone', { time: sec });
  }

  run.stats.style = run.style;
  run.stats.time = run.time;
}

// ---------- 玩家：转向 + 风带 + 钳位 ----------
function updatePlayer(run, steerX, blocking, dt) {
  const p = run.player;
  p.blocking = blocking && p.shield > 0;

  const lane = laneAt(p.x);
  let steerVx = 0;
  if (steerX != null) {
    steerVx = clamp((steerX - p.x) * PLAYER.LERP, -PLAYER.MAX_VX, PLAYER.MAX_VX);
  }
  const wave = waveAt(run.waveIndex);
  const strength = lane.dir === 0 ? 0 : (wave.wind === 2 ? WIND.STRONG : lane.strength);
  const windVx = lane.dir * strength;
  p.vx = steerVx + windVx;
  p.x = clamp(p.x + p.vx * dt, PLAYER.W / 2, WORLD.WIDTH - PLAYER.W / 2);
}

// ---------- 盾再生 ----------
function updateShield(run, dt) {
  const p = run.player;
  if (p.shield < SHIELD.MAX) {
    p.shieldCharge += dt / SHIELD.REGEN_SEC;
    if (p.shieldCharge >= 1) {
      p.shieldCharge -= 1;
      p.shield += 1;
      emit(run, 'shieldRecharge', { shield: p.shield });
    }
  } else {
    p.shieldCharge = 0;
  }
}

// ---------- 慢动作涟漪 ----------
function updateRipple(run) {
  if (run.rippleUntil > 0 && run.time >= run.rippleUntil) {
    run.rippleUntil = -Infinity;
    run.timeScale = 1;
  }
  run.timeScale = run.rippleUntil > run.time ? RIPPLE.SLOW : 1;
}

// ---------- 波次推进 ----------
function updateWave(run, dt) {
  const wave = waveAt(run.waveIndex);
  run.waveTime += dt; // 波次计时不受慢动作影响（慢动作是纯增益）
  run.scene = wave.scene;

  const frac = Math.min(1, run.waveTime / wave.durationSec);
  const tenth = Math.floor(frac * 10);
  if (tenth > run._lastTenth) {
    run._lastTenth = tenth;
    emit(run, 'waveProgress', { wave: run.waveIndex, frac: tenth / 10 });
  }

  if (run.waveTime >= wave.durationSec) {
    const cleared = run.waveIndex;
    emit(run, 'waveClear', { wave: cleared });
    run.waveIndex += 1;
    run.waveTime = 0;
    run._lastTenth = -1;
    run.spawnTimer = 0;

    if (run.waveIndex > WAVE_COUNT) {
      run.phase = 'won';
      emit(run, 'win', { wave: WAVE_COUNT });
      return;
    }

    emit(run, 'waveEnter', { wave: run.waveIndex, name: `wave.${run.waveIndex}` });
    if (run.waveIndex > run.stats.waveReached) run.stats.waveReached = run.waveIndex;
  }
}

// ---------- 生成（warning 两阶段：先地面预警，再天上坠落） ----------
function updateSpawns(run, steerX) {
  const wave = waveAt(run.waveIndex);
  run.spawnTimer -= STEP;
  if (run.spawnTimer <= 0) {
    run.spawnTimer = intervalFor(run.rng, wave);
    const burst = wave.burst || 1;
    for (let i = 0; i < burst; i += 1) {
      const playerX = run.player.x;
      const item = buildItem(run.rng, wave, playerX, run.nextId++);
      item.startAt = run.time + wave.warn * (0.85 + run.rng() * 0.3);
      run.items.push(item);
      emit(run, 'spawn', { x: Math.round(item.x), kind: item.kind, isBig: item.isBig, isDrone: item.isDrone });
    }
  }
}

// ---------- 掉落物：预警激活 / 下坠 / 追踪 / 碰撞 ----------
function updateItems(run, dt) {
  const ts = run.timeScale;
  const p = run.player;

  for (const item of run.items) {
    if (!item.active) {
      if (run.time >= item.startAt) item.active = true;
      continue;
    }

    // 追踪无人机横向趋近玩家
    if (item.tracking && item.isDrone) {
      const dir = Math.sign(p.x - item.x) || 0;
      item.vx = clamp(item.vx + dir * DRONE.HOMING * dt, -DRONE.MAX_VX, DRONE.MAX_VX);
      item.x = clamp(item.x + item.vx * dt * ts, 0, WORLD.WIDTH);
    }

    item.y += item.vy * dt * ts;

    // 伞面格挡（优先，因为伞在头顶）
    if (p.blocking && p.shield > 0 && circleOverlapsRect(item.x, item.y, item.r,
      p.x - PLAYER.UMBRELLA_W / 2, PLAYER.UMBRELLA_TOP, PLAYER.UMBRELLA_W, (WORLD.GROUND_Y - PLAYER.H + 8) - PLAYER.UMBRELLA_TOP)) {
      if (item.isBig) {
        p.shield = 0;
        p.blocking = false;
        run.stats.blocksBig += 1;
        run.style += 8;
        item.landed = true;
        emit(run, 'blockBig', { x: item.x, y: item.y, kind: item.kind });
        emit(run, 'umbrellaBreak', {});
      } else {
        p.shield -= 1;
        run.stats.blocksSmall += 1;
        run.style += 2;
        item.landed = true;
        emit(run, 'blockSmall', { x: item.x, y: item.y, kind: item.kind });
        if (p.shield <= 0) {
          p.blocking = false;
          emit(run, 'umbrellaBreak', {});
        }
      }
      continue;
    }

    // 身体碰撞
    if (circleOverlapsRect(item.x, item.y, item.r,
      p.x - PLAYER.W / 2, WORLD.GROUND_Y - PLAYER.H, PLAYER.W, PLAYER.H)) {
      if (run.time < p.invulnUntil) {
        item.landed = true; // 无敌期内只移除，不重复扣血
        continue;
      }
      p.hp -= item.dmg;
      p.invulnUntil = run.time + HP.INVULN;
      item.landed = true;
      emit(run, 'hit', { x: item.x, y: item.y, dmg: item.dmg, kind: item.kind });
      if (p.hp <= 0) {
        p.hp = 0;
        die(run);
        return;
      }
      continue;
    }

    // 落地（未命中）：判定 near-miss
    if (item.y - item.r >= WORLD.GROUND_Y) {
      item.landed = true;
      checkNearMiss(run, item);
    }
  }
}

function cull(run) {
  run.items = run.items.filter((it) => !it.landed && it.y < WORLD.HEIGHT + 200);
}

// ---------- near-miss ----------
function checkNearMiss(run, item) {
  const p = run.player;
  const bodyLeft = p.x - PLAYER.W / 2;
  const bodyRight = p.x + PLAYER.W / 2;
  let gap = 0;
  if (item.x + item.r <= bodyLeft) gap = bodyLeft - (item.x + item.r);
  else if (item.x - item.r >= bodyRight) gap = (item.x - item.r) - bodyRight;

  if (gap <= 0 || gap >= NEAR_MISS.GAP) return;

  const windowHit = run.time - run.lastNearMissAt <= RIPPLE.WINDOW;
  run.nearMissChain = windowHit ? run.nearMissChain + 1 : 1;
  run.lastNearMissAt = run.time;
  run.style += 1;
  run.stats.nearMisses += 1;
  emit(run, 'nearMiss', { x: item.x, y: WORLD.GROUND_Y, gap });

  if (run.nearMissChain >= RIPPLE.CHAIN) {
    run.nearMissChain = 0;
    run.rippleUntil = run.time + RIPPLE.DURATION;
    run.style += 8;
    run.stats.ripples += 1;
    emit(run, 'ripple', { x: p.x, y: WORLD.GROUND_Y });
  }
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', {});
}

// ---------- 几何 ----------
function circleOverlapsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const p = run.player;
  const wave = waveAt(run.waveIndex);
  const lane = laneAt(p.x);
  let wind = 'calm';
  if (lane.dir !== 0) {
    wind = lane.dir * p.vx > 0 ? 'tail' : 'head';
  }
  return {
    hp: p.hp,
    shield: p.shield,
    blocking: p.blocking,
    style: Math.floor(run.style),
    grade: gradeFor(run.style),
    wave: run.waveIndex,
    waveName: `wave.${run.waveIndex}`,
    scene: run.scene,
    waveProgress: clamp(run.waveTime / wave.durationSec, 0, 1),
    totalWaves: WAVE_COUNT,
    wind,
    ripple: run.rippleUntil > run.time,
    time: run.time,
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
