// MONKEY DASH RUN · 纯逻辑（无 DOM，Node 可测）
// 竖版跑酷：世界向下滚动，猴子固定底部左右切道。躲障碍、吃收集、攒冲刺。
// 导出的 createRun() 同时供浏览器 main.js 与 tools/selfplay.mjs 使用。
import {
  WORLD,
  LANES_X,
  PLAYER_Y,
  PLAYER_R,
  BASE_SPEED,
  SPEED_PER_TIER,
  MAX_TIER,
  TIER_SCORES,
  SPAWN_BASE,
  SPAWN_MIN,
  RUSH_SPARKS,
  RUSH_SECONDS,
  RUSH_SPEED_MULT,
  RUSH_SCORE_MULT,
  SHIELD_SECONDS,
  COMBO_MAX,
  COMBO_WINDOW,
  ENTITY_R,
} from '../../config/game.config.js';

// 可复现的确定性随机（Mulberry32），测试与 selfplay 用固定 seed。
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const OBSTACLES = new Set(['cactus', 'wasp', 'rock']);

function spawnKind(rng) {
  const r = rng();
  if (r < 0.34) return 'cactus';
  if (r < 0.52) return 'wasp';
  if (r < 0.66) return 'rock';
  if (r < 0.86) return 'banana';
  if (r < 0.94) return 'spark';
  return 'shield';
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing', // 'playing' | 'over'
    lane: 0,          // 0 左 / 1 右
    score: 0,
    distance: 0,
    speed: BASE_SPEED,
    tier: 1,
    invincible: 0,    // 秒
    rush: 0,          // 秒
    sparks: 0,        // 已攒火花（集满 RUSH_SPARKS 触发冲刺）
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    time: 0,
    deathCause: null,
    entities: [],     // 障碍 + 收集物
    spawnTimer: 0,
    firstSpawn: true,
    secondSpawn: true,
  };

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function laneX(lane) {
    return LANES_X[clamp(lane | 0, 0, LANES_X.length - 1)];
  }

  function speedNow() {
    const base = BASE_SPEED + (state.tier - 1) * SPEED_PER_TIER;
    return state.rush > 0 ? base * RUSH_SPEED_MULT : base;
  }

  function scoreMult() {
    return state.rush > 0 ? RUSH_SCORE_MULT : 1;
  }

  function bumpCombo() {
    state.combo = Math.min(COMBO_MAX, state.combo + 1);
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.comboTimer = COMBO_WINDOW;
  }

  function addScore(base) {
    state.score += Math.round(base * (1 + (state.combo - 1) * 0.25) * scoreMult());
  }

  // 选一条不会在对向车道形成「墙」的障碍车道：对向车道最近障碍若还靠近顶部，
  // 就强制与它同车道（同车道重叠无妨，玩家待另一条即可）。
  function pickObstacleLane() {
    let ln = rng() < 0.5 ? 0 : 1;
    const other = 1 - ln;
    const conflict = state.entities.some(
      (e) => OBSTACLES.has(e.kind) && e.lane === other && e.y > -490 && e.y < 360,
    );
    if (conflict) ln = other;
    return ln;
  }

  // 在指定车道生成一个实体；kind 可选强制。返回实体。
  function spawn(kind, lane) {
    const k = kind || spawnKind(rng);
    let ln = lane == null ? (rng() < 0.5 ? 0 : 1) : lane;
    if (lane == null && OBSTACLES.has(k)) ln = pickObstacleLane();
    const e = {
      kind: k,
      lane: ln,
      x: laneX(ln),
      y: -70,
      vy: speedNow(),
      size: ENTITY_R[k] || 26,
      t: rng() * Math.PI * 2,
    };
    if (k === 'wasp') e.baseX = laneX(ln);
    state.entities.push(e);
    emit('spawn', { kind: k, lane: ln });
    return e;
  }

  function updateSpawn(dt) {
    // 前两个生成固定：仙人掌撞死 noinput；香蕉给 greedy/noinput 首胜。
    if (state.firstSpawn) {
      spawn('cactus', 0);
      state.firstSpawn = false;
      state.spawnTimer = 1.0;
      return;
    }
    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;
    if (state.secondSpawn) {
      spawn('banana', 0);
      state.secondSpawn = false;
      state.spawnTimer = 1.0;
      return;
    }
    const interval = Math.max(SPAWN_MIN, SPAWN_BASE - (state.tier - 1) * 0.07);
    state.spawnTimer = interval * (0.8 + rng() * 0.4);
    spawn();
  }

  function updateEntities(dt) {
    const speed = speedNow();
    for (const e of state.entities) {
      e.vy = speed;
      if (e.kind === 'wasp') {
        e.x = e.baseX + Math.sin(state.time * 4 + e.t) * 70;
      }
      e.y += e.vy * dt;
    }
    state.entities = state.entities.filter((e) => e.y < WORLD.HEIGHT + 120);
  }

  function collides(e) {
    const px = laneX(state.lane);
    const py = PLAYER_Y;
    const ex = e.kind === 'wasp' ? e.x : laneX(e.lane);
    const ey = e.y;
    const r = PLAYER_R + (e.size || 26);
    const dx = px - ex;
    const dy = py - ey;
    return dx * dx + dy * dy <= r * r;
  }

  function handleCollisions() {
    for (const e of state.entities) {
      if (!collides(e)) continue;
      const pickup = ['banana', 'shield', 'spark'].includes(e.kind);
      if (pickup) {
        e.dead = true;
        if (e.kind === 'banana') {
          bumpCombo();
          addScore(15);
          emit('collect', { kind: 'banana', combo: state.combo });
        } else if (e.kind === 'shield') {
          state.invincible = SHIELD_SECONDS;
          bumpCombo();
          addScore(20);
          emit('shield', { combo: state.combo });
        } else {
          bumpCombo();
          addScore(25);
          state.sparks += 1;
          if (state.sparks >= RUSH_SPARKS) {
            state.sparks = 0;
            state.rush = RUSH_SECONDS;
            emit('rushStart', {});
          } else {
            emit('spark', { n: state.sparks });
          }
        }
        continue;
      }
      // 障碍
      if (state.invincible > 0 || state.rush > 0) {
        e.dead = true;
        addScore(e.kind === 'rock' ? 25 : 15);
        emit('smash', { kind: e.kind });
        continue;
      }
      state.phase = 'over';
      state.deathCause = e.kind;
      emit('death', { cause: e.kind });
      return;
    }
    state.entities = state.entities.filter((e) => !e.dead);
  }

  function updateTimers(dt) {
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.invincible > 0) state.invincible = Math.max(0, state.invincible - dt);
    if (state.rush > 0) {
      state.rush = Math.max(0, state.rush - dt);
      if (state.rush === 0) emit('rushEnd', {});
    }
  }

  function updateTier() {
    if (state.tier >= MAX_TIER) return;
    const idx = state.tier - 1;
    if (idx < TIER_SCORES.length && state.score >= TIER_SCORES[idx]) {
      state.tier += 1;
      state.speed = BASE_SPEED + (state.tier - 1) * SPEED_PER_TIER;
      emit('tierUp', { tier: state.tier });
    }
  }

  const run = {
    state,

    step(dt) {
      if (state.phase !== 'playing') return;
      state.time += dt;
      const speed = speedNow();
      state.distance += speed * dt;
      state.score += Math.round(speed * dt * 0.06 * scoreMult());
      updateSpawn(dt);
      updateEntities(dt);
      handleCollisions();
      updateTimers(dt);
      if (state.phase === 'playing') updateTier();
      state.speed = speedNow();
    },

    drainEvents() {
      const out = events.splice(0, events.length);
      return out;
    },

    // 切到指定车道（0/1）。切到另一条才计为有效动作。
    moveLane(lane) {
      if (state.phase !== 'playing') return { ok: false };
      const to = clamp(lane | 0, 0, LANES_X.length - 1);
      if (to === state.lane) return { ok: false };
      const oldLane = state.lane;
      state.lane = to;
      // 紧贴障碍闪避 → nearMiss 奖励
      const near = state.entities.some(
        (e) => !['banana', 'shield', 'spark'].includes(e.kind)
          && e.lane === oldLane
          && e.y > PLAYER_Y - 90
          && e.y < PLAYER_Y + 90,
      );
      if (near) {
        addScore(8);
        emit('nearMiss', {});
      }
      emit('switch', { lane: to });
      return { ok: true };
    },

    // 快捷：切到另一条车道（tap / Space）。
    tap() {
      return run.moveLane(1 - state.lane);
    },

    getHud() {
      return {
        score: state.score,
        tier: state.tier,
        speed: Math.round(state.speed),
        combo: state.combo,
        sparks: state.sparks,
        rush: state.rush,
        invincible: state.invincible,
        distance: Math.round(state.distance),
      };
    },
  };

  return run;
}

export const __test = { spawnKind, mulberry32 };
