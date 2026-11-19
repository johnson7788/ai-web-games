// RETRO RACER GT · 纯逻辑模拟（Node 无头可 import，DOM 无关）
// 玩法骨架 1:1 参考掌机赛车：4 车道纵向滚动、加速到极速、氮气超车、
// 中车道同向慢车 / 边车道对向快车、碰撞即结束。原创新增：
//   - 岩石障碍（氮气也撞，必须绕）
//   - 连击计分（连续超车叠乘）
//   - 能量星（加分 + 充氮气冷却）
import { WORLD, LANE_X, PLAYER, CAR, SPAWN, TRAFFIC, OBSTACLE, STAR, SCORE, COMBO, TIERS } from '../../config/game.config.js';

// 可复现随机（selfplay / 测试用固定 seed）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(seed = 1) {
  const rng = mulberry32(seed);
  const events = [];

  const state = {
    phase: 'running',        // 'running' | 'crashed'
    time: 0,
    score: 0,
    speed: 0,
    tier: 0,
    lane: PLAYER.START_LANE,
    laneX: LANE_X[PLAYER.START_LANE],
    turnDir: 0,              // -1 | 0 | 1（换道动画中非 0）
    nitroActive: false,
    nitroTimer: 0,
    nitroCd: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    cars: [],
    rocks: [],
    stars: [],
    carsPassed: 0,
    starsCollected: 0,
    nearMisses: 0,
    tierReached: 0,
    seed,
  };

  const timers = { carMid: 0.8, carEdge: 1.1, rock: 1.6, star: 0.6 };

  function tierCfg() { return TIERS[Math.min(state.tier, TIERS.length - 1)]; }

  function emit(type, payload = {}) {
    events.push({ type, t: state.time, ...payload });
  }

  function collides(o) {
    const ox = LANE_X[o.lane];
    const oW = o.w;
    const oH = o.h;
    return Math.abs(state.laneX - ox) < (PLAYER.W + oW) * 0.42 &&
           Math.abs(PLAYER.Y - o.y) < (PLAYER.H + oH) * 0.42;
  }

  function crash() {
    if (state.phase !== 'running') return;
    state.phase = 'crashed';
    state.speed = 0;
    emit('crash', { score: Math.floor(state.score), carsPassed: state.carsPassed, combo: state.maxCombo });
  }

  function spawnCar(lane, dir) {
    state.cars.push({
      lane, dir,
      y: SPAWN.Y,
      w: SPAWN.carW, h: SPAWN.carH,
      passed: false, nearMissed: false,
      hue: [185, 200, 320, 35, 150, 275][Math.floor(rng() * 6)],
    });
    emit('spawn', { kind: 'car', lane, dir });
  }

  function spawnRock() {
    // 同一车道 170px 内不再叠岩，避免同屏堆叠成墙
    const lanes = [0, 1, 2, 3].filter(
      (l) => !state.rocks.some((r) => r.lane === l && Math.abs(r.y - SPAWN.Y) < 170),
    );
    if (!lanes.length) return;
    const lane = lanes[Math.floor(rng() * lanes.length)];
    state.rocks.push({ lane, y: SPAWN.Y, w: OBSTACLE.rockW, h: OBSTACLE.rockH, nearMissed: false });
    emit('spawn', { kind: 'rock', lane });
  }

  function spawnStar() {
    const lane = Math.floor(rng() * 4);
    state.stars.push({ lane, y: SPAWN.Y, w: STAR.w, h: STAR.h, collected: false });
    emit('spawn', { kind: 'star', lane });
  }

  function spawn(dt) {
    const cfg = tierCfg();
    timers.carMid -= dt;
    if (timers.carMid <= 0) {
      timers.carMid = cfg.carIntervalMid * (0.7 + rng() * 0.6);
      spawnCar(rng() < 0.5 ? 1 : 2, 1);
    }
    timers.carEdge -= dt;
    if (timers.carEdge <= 0) {
      timers.carEdge = cfg.carIntervalEdge * (0.7 + rng() * 0.6);
      spawnCar(rng() < 0.5 ? 0 : 3, -1);
    }
    if (cfg.rockEvery > 0) {
      timers.rock -= dt;
      if (timers.rock <= 0) {
        timers.rock = cfg.rockEvery * (0.8 + rng() * 0.4);
        spawnRock();
      }
    }
    timers.star -= dt;
    if (timers.star <= 0) {
      timers.star = cfg.starEvery * (0.7 + rng() * 0.6);
      spawnStar();
    }
  }

  function step(dt) {
    if (state.phase !== 'running') return;
    state.time += dt;

    // 速度（氮气优先级）
    if (state.nitroActive) {
      state.speed = Math.min(CAR.maxSpeedN, state.speed + CAR.addSpeedN * dt);
      state.nitroTimer -= dt;
      if (state.nitroTimer <= 0) {
        state.nitroTimer = 0;
        state.nitroActive = false;
        emit('nitroEnd');
      }
    } else {
      state.speed = Math.min(CAR.maxSpeed, state.speed + CAR.addSpeed * dt);
      state.nitroCd = Math.max(0, state.nitroCd - dt);
    }

    // 距离分
    state.score += state.speed * dt * SCORE.distanceScale;

    // 换道动画：laneX 向目标车道 lerp
    const targetX = LANE_X[state.lane];
    const dx = targetX - state.laneX;
    const maxStep = CAR.maxSpeedX * dt;
    if (Math.abs(dx) <= maxStep) { state.laneX = targetX; state.turnDir = 0; }
    else state.laneX += Math.sign(dx) * maxStep;

    // 连击衰减
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.comboTimer = 0; state.combo = 0; }
    }

    spawn(dt);

    // 车辆运动（同向：worldVel +；对向：-）
    for (const c of state.cars) {
      const worldVel = c.dir === 1 ? TRAFFIC.sameDirSpeed : -TRAFFIC.oncomingSpeed;
      const screenVel = state.speed - worldVel;
      c.y += screenVel * dt;

      if (!c.passed && c.y > PLAYER.Y) {
        c.passed = true;
        state.carsPassed += 1;
        state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
        state.comboTimer = COMBO.window;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        const bonus = SCORE.passBase + state.combo * SCORE.comboStep;
        state.score += bonus;
        emit('pass', { combo: state.combo, bonus });
        if (state.combo >= 3 && state.combo % 3 === 0) emit('combo', { combo: state.combo });
      }
      if (!c.nearMissed && Math.abs(c.y - PLAYER.Y) < 30 && Math.abs(c.lane - state.lane) === 1) {
        c.nearMissed = true;
        state.nearMisses += 1;
        state.score += SCORE.nearMissBonus;
        emit('nearMiss', { lane: c.lane });
      }
    }
    state.cars = state.cars.filter((c) => c.y < WORLD.HEIGHT + 220);

    // 岩石（固定在路面上，随道路下移）
    for (const r of state.rocks) {
      r.y += state.speed * dt;
      if (!r.nearMissed && Math.abs(r.y - PLAYER.Y) < 40 && Math.abs(r.lane - state.lane) === 1) {
        r.nearMissed = true;
        state.nearMisses += 1;
        state.score += SCORE.nearMissBonus;
        emit('nearMiss', { lane: r.lane });
      }
    }
    state.rocks = state.rocks.filter((r) => r.y < WORLD.HEIGHT + 220);

    // 能量星
    for (const s of state.stars) {
      s.y += state.speed * dt;
      if (!s.collected && Math.abs(s.y - PLAYER.Y) < 46 && s.lane === state.lane) {
        s.collected = true;
        state.starsCollected += 1;
        state.score += STAR.score;
        state.nitroCd = Math.max(0, state.nitroCd - CAR.starNitroRefill);
        emit('collect', { lane: s.lane, nitroCd: state.nitroCd });
      }
    }
    state.stars = state.stars.filter((s) => s.y < WORLD.HEIGHT + 220 && !s.collected);

    // 碰撞：氮气对车无敌，对岩石不无敌
    if (!state.nitroActive) {
      for (const c of state.cars) {
        if (collides(c)) { crash(); return; }
      }
    }
    for (const r of state.rocks) {
      if (collides(r)) { crash(); return; }
    }

    // 难度升级
    while (state.tier < TIERS.length - 1 && state.score >= TIERS[state.tier + 1].score) {
      state.tier += 1;
      state.tierReached = state.tier;
      emit('levelUp', { tier: state.tier });
    }
  }

  function turnLeft() {
    if (state.phase !== 'running') return { ok: false };
    if (state.lane <= 0 || state.turnDir !== 0) return { ok: false };
    state.lane -= 1;
    state.turnDir = -1;
    return { ok: true };
  }

  function turnRight() {
    if (state.phase !== 'running') return { ok: false };
    if (state.lane >= LANE_X.length - 1 || state.turnDir !== 0) return { ok: false };
    state.lane += 1;
    state.turnDir = 1;
    return { ok: true };
  }

  function useNitro() {
    if (state.phase !== 'running') return { ok: false };
    if (state.nitroActive || state.nitroCd > 0) return { ok: false };
    state.nitroActive = true;
    state.nitroTimer = CAR.nitroTime;
    state.nitroCd = CAR.nitroCd;
    emit('nitro');
    return { ok: true };
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  return {
    state,
    step,
    drainEvents,
    turnLeft,
    turnRight,
    useNitro,
    rng,
  };
}
