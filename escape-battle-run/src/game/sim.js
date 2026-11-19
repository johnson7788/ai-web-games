// 纯逻辑模拟（可无 DOM 运行，selfplay / node --test 直接 import）。
// 玩法：霓虹街机 · 竞技场逃生。玩家躲避追击无人机，收集能量晶体，能量爆发清场，冲高波次。
// 契约：
//   createRun(opts) -> run
//   run.state       当前状态（player/enemies/rocks/gems/wave/score/...）
//   run.step(input) 推进一个固定 tick（1/60s），input = { x, y, nova }（x/y ∈ [-1,1]）
//   run.drainEvents() 返回并清空本轮事件
//   run.getHud()    返回 HUD 数据
import { WORLD, PLAYER, ENEMY, WAVE, GEM, ROCK, SKILL, SCORE, STEP } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const MIN_X = () => WORLD.MARGIN;
const MAX_X = () => WORLD.WIDTH - WORLD.MARGIN;
const MIN_Y = () => WORLD.HUD_H + WORLD.MARGIN + 24;   // 顶部留白，避免与 HUD 视觉重叠
const MAX_Y = () => WORLD.HEIGHT - WORLD.MARGIN;

export function createRun(opts = {}) {
  const seed = (opts.seed == null ? (Date.now() % 2147483647) : opts.seed) | 0 || 1;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',          // playing | result
    time: 0,                   // 生存秒
    wave: 1,
    waveTime: 0,
    score: 0,
    gemCount: 0,
    combo: 1,
    comboTimer: 0,
    energy: 0,
    energyMax: SKILL.ENERGY_COST,
    novaCd: 0,
    kills: 0,
    bestCombo: 1,
    spawnGemTimer: 0.6,        // 开局稍快出第一颗晶体
    spawnRockTimer: ROCK.SPAWN_EVERY,
    enemyRespawnTimer: 0,
    tickTimer: 0,
    player: {
      x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2,
      r: PLAYER.R, vx: 0, vy: 0, stunned: 0, dead: false,
    },
    enemies: [],
    rocks: [],
    gems: [],                 // 场上的晶体实体
    _events: [],
    _rng: rng,
  };

  spawnWave(state, 1);

  const run = {
    state,
    step(input) { updateSim(state, input || {}); },
    drainEvents() {
      const ev = state._events;
      state._events = [];
      return ev;
    },
    getHud() {
      return {
        score: state.score,
        wave: state.wave,
        time: state.time,
        gems: state.gemCount,
        combo: state.combo,
        energy: state.energy,
        energyMax: state.energyMax,
        kills: state.kills,
      };
    },
  };
  return run;
}

function emit(state, type, payload) {
  state._events.push({ type, ...(payload || {}) });
}

function spawnWave(state, wave) {
  const count = Math.min(ENEMY.BASE_COUNT + (wave - 1) * ENEMY.COUNT_PER_WAVE, ENEMY.MAX_COUNT);
  for (let i = 0; i < count; i += 1) spawnEnemy(state);
}

function spawnEnemy(state) {
  const rng = state._rng;
  const edge = Math.floor(rng() * 4);
  const e = {
    x: 0, y: 0,
    r: ENEMY.R,
    speed: enemySpeed(state.wave),
    nearMiss: false,
  };
  if (edge === 0) { e.x = MIN_X() + rng() * (MAX_X() - MIN_X()); e.y = MIN_Y(); }
  else if (edge === 1) { e.x = MIN_X() + rng() * (MAX_X() - MIN_X()); e.y = MAX_Y(); }
  else if (edge === 2) { e.x = MIN_X(); e.y = MIN_Y() + rng() * (MAX_Y() - MIN_Y()); }
  else { e.x = MAX_X(); e.y = MIN_Y() + rng() * (MAX_Y() - MIN_Y()); }
  state.enemies.push(e);
  emit(state, 'enemySpawn', { x: Math.round(e.x), y: Math.round(e.y), speed: Math.round(e.speed) });
}

function enemySpeed(wave) {
  return Math.min(ENEMY.BASE_SPEED + (wave - 1) * ENEMY.SPEED_PER_WAVE, ENEMY.MAX_SPEED);
}

function spawnGem(state) {
  if (state.gems.length >= GEM.MAX) return;
  const rng = state._rng;
  const g = {
    x: MIN_X() + 20 + rng() * (MAX_X() - MIN_X() - 40),
    y: MIN_Y() + 20 + rng() * (MAX_Y() - MIN_Y() - 40),
    r: GEM.R,
  };
  state.gems.push(g);
  emit(state, 'gemSpawn', { x: Math.round(g.x), y: Math.round(g.y) });
}

function spawnRock(state) {
  if (state.rocks.length >= ROCK.MAX) return;
  const rng = state._rng;
  const r = {
    x: MIN_X() + 30 + rng() * (MAX_X() - MIN_X() - 60),
    y: MIN_Y() + 30 + rng() * (MAX_Y() - MIN_Y() - 60),
    r: ROCK.R,
    vx: (rng() - 0.5) * 2 * ROCK.DRIFT,
    vy: (rng() - 0.5) * 2 * ROCK.DRIFT,
  };
  state.rocks.push(r);
  emit(state, 'rockSpawn', { x: Math.round(r.x), y: Math.round(r.y) });
}

function updateSim(state, input) {
  if (state.phase !== 'playing') return;
  const dt = STEP;
  const p = state.player;

  // ---- 输入：归一化方向 ----
  let ix = Number(input.x) || 0;
  let iy = Number(input.y) || 0;
  const mag = Math.hypot(ix, iy);
  if (mag > 1) { ix /= mag; iy /= mag; }
  const wantNova = !!input.nova;

  // ---- 玩家移动 ----
  p.stunned = Math.max(0, p.stunned - dt);
  const speedMul = p.stunned > 0 ? PLAYER.STUN_SPEED : 1;
  p.vx = ix * PLAYER.SPEED * speedMul;
  p.vy = iy * PLAYER.SPEED * speedMul;
  p.x = clamp(p.x + p.vx * dt, MIN_X(), MAX_X());
  p.y = clamp(p.y + p.vy * dt, MIN_Y(), MAX_Y());

  // ---- 能量爆发 ----
  state.novaCd = Math.max(0, state.novaCd - dt);
  if (wantNova && state.novaCd <= 0 && state.energy >= SKILL.ENERGY_COST) {
    let killed = 0;
    for (const e of state.enemies) {
      if (dist(p, e) <= SKILL.RADIUS + e.r) { e.dead = true; killed += 1; }
    }
    if (killed > 0) {
      state.enemies = state.enemies.filter((e) => !e.dead);
      state.kills += killed;
      state.score += killed * SKILL.KILL_SCORE;
    }
    state.energy = 0;
    state.novaCd = SKILL.COOLDOWN;
    emit(state, 'nova', { kills: killed, x: Math.round(p.x), y: Math.round(p.y) });
  }

  // ---- 敌人追击 ----
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;

    // 擦身（near miss）：进入威胁圈但未碰撞，给一次奖励反馈
    const gap = d - e.r - p.r;
    if (!e.nearMiss && gap < 44 && gap > 0) {
      e.nearMiss = true;
      emit(state, 'nearMiss', { gap: Math.round(gap) });
    } else if (e.nearMiss && gap > 70) {
      e.nearMiss = false;
    }

    // 碰撞 → 死亡
    if (d < e.r + p.r && !p.dead) {
      p.dead = true;
      state.phase = 'result';
      emit(state, 'death', { score: state.score, wave: state.wave, x: Math.round(p.x), y: Math.round(p.y) });
      return;
    }
  }

  // ---- 岩石漂移 & 命中（减速，不致死） ----
  for (const r of state.rocks) {
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    if (r.x < MIN_X() + r.r || r.x > MAX_X() - r.r) r.vx *= -1;
    if (r.y < MIN_Y() + r.r || r.y > MAX_Y() - r.r) r.vy *= -1;
    r.x = clamp(r.x, MIN_X() + r.r, MAX_X() - r.r);
    r.y = clamp(r.y, MIN_Y() + r.r, MAX_Y() - r.r);

    if (dist(p, r) < p.r + r.r && p.stunned <= 0) {
      p.stunned = ROCK.STUN;
      emit(state, 'rockHit', { x: Math.round(r.x), y: Math.round(r.y) });
    }
  }

  // ---- 晶体收集 ----
  for (let i = state.gems.length - 1; i >= 0; i -= 1) {
    const g = state.gems[i];
    if (dist(p, g) < p.r + g.r) {
      state.gems.splice(i, 1);
      state.gemCount += 1;
      state.comboTimer = GEM.COMBO_TIME;
      state.combo = Math.min(state.combo + 1, 9);
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.energy = Math.min(state.energyMax, state.energy + GEM.ENERGY);
      state.score += GEM.VALUE * state.combo;
      emit(state, 'gem', { combo: state.combo, energy: state.energy, x: Math.round(g.x), y: Math.round(g.y) });
      if (state.combo >= 2 && (state.combo === 2 || state.combo % 3 === 0)) {
        emit(state, 'combo', { combo: state.combo });
      }
      break;
    }
  }

  // ---- combo 计时 ----
  if (state.combo > 1) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 1;
      emit(state, 'comboLost');
    }
  }

  // ---- 计时 / 分数 / 波次 ----
  state.time += dt;
  state.waveTime += dt;
  state.score += SCORE.TIME_RATE * dt;

  state.tickTimer += dt;
  if (state.tickTimer >= 1.0) {
    state.tickTimer = 0;
    emit(state, 'tick', { score: Math.floor(state.score), wave: state.wave });
  }

  if (state.waveTime >= WAVE.DURATION) {
    state.wave += 1;
    state.waveTime = 0;
    spawnWave(state, state.wave);
    emit(state, 'wave', { wave: state.wave });
  }

  // ---- 生成晶体 ----
  state.spawnGemTimer -= dt;
  if (state.spawnGemTimer <= 0) {
    state.spawnGemTimer = GEM.SPAWN_EVERY;
    spawnGem(state);
  }

  // ---- 生成岩石（第 2 波起） ----
  if (state.wave >= 2) {
    state.spawnRockTimer -= dt;
    if (state.spawnRockTimer <= 0) {
      state.spawnRockTimer = ROCK.SPAWN_EVERY;
      spawnRock(state);
    }
  }

  // ---- 补兵 ----
  state.enemyRespawnTimer -= dt;
  if (state.enemyRespawnTimer <= 0) {
    state.enemyRespawnTimer = ENEMY.RESPAWN_EVERY;
    const target = Math.min(ENEMY.BASE_COUNT + (state.wave - 1) * ENEMY.COUNT_PER_WAVE, ENEMY.MAX_COUNT);
    if (state.enemies.length < target) spawnEnemy(state);
  }
}
