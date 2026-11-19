// 纯逻辑 sim（可在 Node 里直接 import，无 DOM）。
// 玩法骨架 1:1 复刻参考源码：自动弹跳 + 点击砸击 + 热度（原版 floorNum）+ 道具（原版宝箱/炸弹/木板）。
// 换皮成「霓虹街机 · 陨石破坏王」；新增连击、星级、尖刺陨石三个机制。
import { WORLD, STEP, PLAYER, PHYS, BOUNCE, HEAT, COMBO, SPAWN, PROGRESS } from '../../config/game.config.js';

const KIND_W = {
  meteor: 74,
  spike: 70,
  core: 50,
  thruster: 50,
  pad: 86,
};

// 确定性伪随机数（mulberry32），保证 selfplay 可复现。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starsForScore(score) {
  const t = PROGRESS.STAR_THRESHOLDS;
  if (score >= t[2]) return 3;
  if (score >= t[1]) return 2;
  if (score >= t[0]) return 1;
  return 0;
}

function speedForLevel(level) {
  return SPAWN.BASE_MOVE_SPEED + (level - 1) * PROGRESS.SPEED_PER_LEVEL;
}

function intervalFor(level) {
  const scale = Math.pow(PROGRESS.INTERVAL_SCALE, level - 1);
  const minScale = PROGRESS.INTERVAL_MIN_SCALE;
  return SPAWN.BASE_INTERVAL * Math.max(minScale, scale);
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? ((Date.now() % 2147483647) || 1) : (opts.seed | 0 || 1);
  const rng = mulberry32(seed);

  const state = {
    phase: 'running',          // running | over
    seed,
    time: 0,
    distance: 0,
    score: 0,
    bonus: 0,
    meters: 0,
    level: 1,
    heat: 0,
    combo: 0,
    comboTimer: 0,
    stars: 0,
    player: {
      y: 400,                  // 高度（0 = 地面）
      vy: 0,                   // 垂直速度（正 = 向上）
      value: PHYS.GRAVITY_NORMAL, // 重力因子（0.5 正常 / 3.0 砸击）
    },
    spawn: { nextAt: SPAWN.FIRST_AT, first: true },
    entities: [],              // { id, kind, x, w, speed }
    stats: { kills: 0, cores: 0, thrusters: 0, pads: 0, spikes: 0, floorHits: 0 },
  };

  let events = [];
  let nextId = 1;

  function emit(type, payload = {}) {
    events.push({ type, time: state.time, ...payload });
  }

  function currentLevel() {
    return 1 + Math.floor(state.distance / PROGRESS.LEVEL_DIST);
  }

  function pickKind() {
    const weights = { ...SPAWN.WEIGHTS };
    if (state.level < 2) weights.spike = 0;
    let total = 0;
    for (const k of Object.keys(weights)) total += weights[k];
    let r = rng() * total;
    for (const k of Object.keys(weights)) {
      if (r < weights[k]) return k;
      r -= weights[k];
    }
    return 'meteor';
  }

  function spawnEntity(kind, x) {
    state.entities.push({
      id: nextId++,
      kind,
      x: x == null ? SPAWN.X_EDGE : x,
      w: KIND_W[kind] || 70,
      speed: speedForLevel(state.level),
    });
  }

  function updateSpawns() {
    if (state.time < state.spawn.nextAt) return;
    if (state.spawn.first) {
      // 首只必为陨石且靠近，让首次成功更快、开局即有目标
      state.spawn.first = false;
      spawnEntity('meteor', SPAWN.FIRST_X);
      state.spawn.nextAt = state.time + intervalFor(state.level);
      return;
    }
    const kind = pickKind();
    spawnEntity(kind);
    state.spawn.nextAt = state.time + intervalFor(state.level);
  }

  function entityUnderPlayer(x, w) {
    return x <= WORLD.PLAYER_X + PLAYER.R && x + w >= WORLD.PLAYER_X - PLAYER.R;
  }

  // 预测「现在砸击」落地时会压到哪个实体（供 greedy / 调试自动玩使用）。
  function predictSlamTarget() {
    let y = state.player.y;
    let v = -Math.abs(state.player.vy); // 砸击立即反向向下
    for (let n = 0; n < 140; n += 1) {
      v -= PHYS.GRAVITY_SLAM;
      y += v;
      if (y <= 0) {
        const px = WORLD.PLAYER_X;
        for (const e of state.entities) {
          const xf = e.x - e.speed * STEP * n;
          if (xf <= px + PLAYER.R && xf + e.w >= px - PLAYER.R) return e;
        }
        return null;
      }
    }
    return null;
  }

  function resetCombo() {
    state.combo = 0;
    state.comboTimer = 0;
  }

  function gameOver(reason) {
    state.phase = 'over';
    state.stars = starsForScore(state.score);
    emit('gameOver', { score: state.score, stars: state.stars, reason });
  }

  function applyBounce(b) {
    state.player.vy = b;
    state.player.value = PHYS.GRAVITY_NORMAL;
  }

  function land() {
    const slamming = state.player.value > 1;
    const target = slamming ? entityUnderPlayerAtGround() : null;

    if (target) {
      handleEntityHit(target);
    } else {
      // 地板命中
      state.heat += HEAT.PER_FLOOR;
      state.stats.floorHits += 1;
      resetCombo();
      emit('floor', { heat: state.heat });
      if (state.heat >= HEAT.MAX) {
        applyBounce(0);
        gameOver('overheat');
        return;
      }
      applyBounce(Math.max(1, BOUNCE.FLOOR_BASE - state.heat));
    }
  }

  function entityUnderPlayerAtGround() {
    const px = WORLD.PLAYER_X;
    for (const e of state.entities) {
      if (e.x <= px + PLAYER.R && e.x + e.w >= px - PLAYER.R) return e;
    }
    return null;
  }

  function handleEntityHit(e) {
    switch (e.kind) {
      case 'meteor': {
        state.combo = Math.min(COMBO.MAX, state.combo + 1);
        state.comboTimer = COMBO.WINDOW;
        const gain = COMBO.BONUS_PER * state.combo;
        state.bonus += gain;
        state.stats.kills += 1;
        removeEntity(e);
        applyBounce(BOUNCE.METEOR);
        emit('killMeteor', { combo: state.combo, bonus: gain });
        emit('combo', { combo: state.combo });
        break;
      }
      case 'core': {
        state.bonus += 15;
        state.stats.cores += 1;
        removeEntity(e);
        applyBounce(BOUNCE.CORE);
        emit('core', { bonus: 15 });
        break;
      }
      case 'thruster': {
        state.bonus += 8;
        state.stats.thrusters += 1;
        removeEntity(e);
        applyBounce(BOUNCE.THRUSTER);
        emit('thruster', { bonus: 8 });
        break;
      }
      case 'pad': {
        state.heat = HEAT.PAD_HEAL_TO;
        state.stats.pads += 1;
        removeEntity(e);
        applyBounce(BOUNCE.PAD);
        emit('pad', { heat: state.heat });
        break;
      }
      case 'spike': {
        state.heat += HEAT.SPIKE_PENALTY;
        state.stats.spikes += 1;
        resetCombo();
        removeEntity(e);
        applyBounce(BOUNCE.SPIKE);
        emit('spike', { penalty: HEAT.SPIKE_PENALTY, heat: state.heat });
        if (state.heat >= HEAT.MAX) {
          gameOver('spike');
        }
        break;
      }
      default:
        applyBounce(BOUNCE.METEOR);
        break;
    }
  }

  function removeEntity(e) {
    const i = state.entities.indexOf(e);
    if (i >= 0) state.entities.splice(i, 1);
  }

  function stepPlayer() {
    const p = state.player;
    p.vy -= p.value;
    p.y += p.vy;
    if (p.y <= 0) {
      p.y = 0;
      land();
    }
  }

  function stepEntities() {
    for (const e of state.entities) {
      e.x -= e.speed * STEP;
    }
    // 移出左侧的实体回收
    if (state.entities.length && state.entities[0].x + state.entities[0].w < -60) {
      state.entities = state.entities.filter((e) => e.x + e.w >= -60);
    }
  }

  function stepProgress() {
    state.distance += PROGRESS.SCROLL_SPEED * STEP;
    state.meters = Math.floor(state.distance / PROGRESS.SCORE_M_PER_PX);
    state.score = state.meters + state.bonus;

    const lv = currentLevel();
    if (lv > state.level) {
      state.level = lv;
      emit('levelUp', { level: lv });
    }

    if (state.comboTimer > 0) {
      state.comboTimer -= STEP;
      if (state.comboTimer <= 0) state.combo = 0;
    }
  }

  function step() {
    if (state.phase !== 'running') return;
    updateSpawns();
    stepPlayer();
    if (state.phase === 'over') return;
    stepEntities();
    stepProgress();
    state.time += STEP;
  }

  // ---- 对外 run 接口 ----
  const run = {
    state,

    step(dt) {
      const steps = Math.max(1, Math.round(dt / STEP));
      for (let i = 0; i < steps; i += 1) step();
    },

    drainEvents() {
      const out = events;
      events = [];
      return out;
    },

    getHud() {
      return {
        score: state.score,
        meters: state.meters,
        bonus: state.bonus,
        level: state.level,
        heat: state.heat,
        heatMax: HEAT.MAX,
        combo: state.combo,
        distance: state.distance,
        stars: state.stars,
      };
    },

    slam() {
      if (state.phase !== 'running') return { ok: false };
      state.player.value = PHYS.GRAVITY_SLAM;
      state.player.vy = -Math.abs(state.player.vy);
      emit('slam');
      return { ok: true };
    },

    predictSlamTarget,

    // 调试辅助：直接改变高度/热度（供 verify plan 稳定进入各状态）
    debug: {
      setHeat(h) { state.heat = Math.max(0, Math.min(HEAT.MAX, h | 0)); },
      setHeight(y) { state.player.y = Math.max(0, y | 0); state.player.vy = 0; },
      spawn(kind, x) {
        spawnEntity(kind);
        if (x != null) state.entities[state.entities.length - 1].x = x;
      },
      forceOver() { state.heat = HEAT.MAX; gameOver('overheat'); },
    },
  };

  emit('start');
  return run;
}

export { starsForScore };
