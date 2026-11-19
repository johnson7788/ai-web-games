// Frenzy Racer · 纯逻辑 sim（Node 无头可测，不依赖 DOM/像素）
// 双车四道反应躲避：car1 走车道 0/1，car2 走车道 2/3。
// 波次生成（1 球 + 1 闸门 + 概率护盾），实体按 arrive 时间到达车辆碰撞线。
// 吃球攒连击、躲闸门；撞闸门（无护盾）即失败；存活满时长且收集率 ≥ goal 即通关。
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

// 稳定伪随机数（seed → 函数），保证 selfplay 与验收可复现
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CAR_BY_LANE = (lane) => (lane < 2 ? 'c1' : 'c2');

export function createRun(levelIndex, opts = {}) {
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0))];
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'countdown',        // countdown | playing | won | lost
    level: levelIndex + 1,     // 1 基
    seed,
    time: 0,                   // 本局累计 sim 秒
    countdownLeft: level.timer,
    timeLeft: level.duration,  // 开跑后的剩余秒数
    lead: level.lead,
    speed: level.speed,
    duration: level.duration,
    goal: level.goal,
    cars: { c1: 0, c2: 0 },    // 各自在「车对内」的车道下标 0/1
    starsCollected: 0,
    starsSpawned: 0,
    barriersPassed: 0,
    barriersSpawned: 0,
    shieldsSpawned: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    shield: false,
    entities: [],              // {id, kind, lane, arrive, resolved}
    spawnTimer: 0,
    nextId: 1,
    lastCountdownTick: -1,
    reason: null,              // win/lose 原因
    stars: 0,                  // 结算星级 1-3
    rate: 0,                   // 收集率
  };

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  emit('countdown', { timeLeft: Math.ceil(level.timer) });

  function randInt(n) {
    return Math.floor(rng() * n);
  }

  function entity(kind, lane) {
    const arrive = state.time + level.lead;
    state.entities.push({ id: state.nextId++, kind, lane, arrive, resolved: false });
    if (kind === 'star') state.starsSpawned += 1;
    if (kind === 'barrier') state.barriersSpawned += 1;
    if (kind === 'shield') state.shieldsSpawned += 1;
    return arrive;
  }

  function aliveCount(kind) {
    return state.entities.filter((e) => e.kind === kind && !e.resolved && e.arrive > state.time).length;
  }

  // 选一条 ≠ 星道、且不与同车现有闸门过近的车道（避免「无解封堵」）
  function pickBarrierLane(starLane) {
    const arrive = state.time + level.lead;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const lane = randInt(4);
      if (lane === starLane) continue;
      const car = CAR_BY_LANE(lane);
      let conflict = false;
      for (const e of state.entities) {
        if (e.kind === 'barrier' && !e.resolved && CAR_BY_LANE(e.lane) === car && Math.abs(e.arrive - arrive) < 0.18) {
          conflict = true;
          break;
        }
      }
      if (!conflict) return lane;
    }
    // 兜底：找一条不是星道、且非冲突的车道；再不行就取 (starLane + 1) % 4
    for (let lane = 0; lane < 4; lane += 1) if (lane !== starLane) return lane;
    return (starLane + 1) % 4;
  }

  function spawnWave() {
    if (aliveCount('star') >= level.starMax && aliveCount('barrier') >= level.barrierMax) return;
    if (aliveCount('star') < level.starMax) {
      const starLane = randInt(4);
      entity('star', starLane);
      if (aliveCount('barrier') < level.barrierMax) {
        entity('barrier', pickBarrierLane(starLane));
      }
      if (rng() < level.shieldChance) {
        // 护盾不与闸门同道，避免「吃护盾必撞」
        let shieldLane = randInt(4);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if (shieldLane === starLane || shieldLane === 0) break;
          shieldLane = randInt(4);
        }
        entity('shield', shieldLane);
      }
    } else if (aliveCount('barrier') < level.barrierMax) {
      entity('barrier', randInt(4));
    }
    emit('spawn', { stars: aliveCount('star'), barriers: aliveCount('barrier') });
  }

  function resolve(e) {
    if (e.resolved) return;
    e.resolved = true;
    const car = CAR_BY_LANE(e.lane);
    const laneInPair = e.lane % 2;
    const here = state.cars[car] === laneInPair;

    if (e.kind === 'star') {
      if (here) {
        state.starsCollected += 1;
        state.combo += 1;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.score += GAME.STAR_SCORE + (state.combo - 1) * GAME.COMBO_BONUS;
        emit('collect', { car, lane: e.lane, combo: state.combo, score: state.score });
        emit('combo', { combo: state.combo });
      } else {
        state.combo = 0;
        emit('miss', { car, lane: e.lane });
      }
    } else if (e.kind === 'barrier') {
      if (here) {
        if (state.shield) {
          state.shield = false;
          state.combo = 0;
          state.barriersPassed += 1;
          emit('shieldBreak', { car, lane: e.lane });
        } else {
          state.phase = 'lost';
          state.reason = 'crash';
          emit('lose', { reason: 'crash', car, lane: e.lane });
          return;
        }
      } else {
        state.barriersPassed += 1;
        emit('nearMiss', { car, lane: e.lane });
      }
    } else if (e.kind === 'shield') {
      if (here) {
        if (!state.shield) {
          state.shield = true;
          emit('shield', { car, lane: e.lane });
        }
      }
    }
  }

  function checkEnd() {
    if (state.phase !== 'playing') return;
    if (state.timeLeft <= 0) {
      state.rate = state.starsSpawned > 0 ? state.starsCollected / state.starsSpawned : 0;
      if (state.rate >= level.goal) {
        state.phase = 'won';
        state.reason = 'timeUp';
        state.stars = computeStars();
        emit('win', { stars: state.stars, rate: state.rate, combo: state.maxCombo, score: state.score });
      } else {
        state.phase = 'lost';
        state.reason = 'timeUp';
        emit('lose', { reason: 'timeUp', rate: state.rate });
      }
    }
  }

  function computeStars() {
    const rate = state.starsSpawned > 0 ? state.starsCollected / state.starsSpawned : 0;
    let s = 1;
    if (rate >= level.goal + GAME.RATING_BONUS * 2 || rate >= 0.9) s = 3;
    else if (rate >= level.goal + GAME.RATING_BONUS) s = 2;
    return s;
  }

  function step(dt) {
    if (state.phase === 'won' || state.phase === 'lost') return;

    state.time += dt;

    if (state.phase === 'countdown') {
      state.countdownLeft -= dt;
      const sec = Math.ceil(state.countdownLeft);
      if (sec !== state.lastCountdownTick && sec > 0) {
        state.lastCountdownTick = sec;
        emit('countdownTick', { timeLeft: sec });
      }
      if (state.countdownLeft <= 0) {
        state.phase = 'playing';
        state.spawnTimer = 0;
        emit('countdownTick', { timeLeft: 0 });
      }
      return;
    }

    // playing
    state.timeLeft -= dt;

    // 生成波次
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnWave();
      state.spawnTimer += level.spawnEvery;
    }

    // 到达判定（按 arrive 顺序）
    const due = state.entities
      .filter((e) => !e.resolved && e.arrive <= state.time)
      .sort((a, b) => a.arrive - b.arrive || a.id - b.id);
    for (const e of due) {
      resolve(e);
      if (state.phase !== 'playing') break;
    }

    // 清理已结算且远在后方的实体
    state.entities = state.entities.filter((e) => !e.resolved || e.arrive > state.time);

    checkEnd();
  }

  function switchCar(car) {
    if (state.phase !== 'playing') return { ok: false };
    if (car !== 'c1' && car !== 'c2') return { ok: false };
    state.cars[car] = state.cars[car] === 0 ? 1 : 0;
    emit('switch', { car, lane: state.cars[car] });
    return { ok: true, lane: state.cars[car] };
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  function getHud() {
    const rate = state.starsSpawned > 0 ? state.starsCollected / state.starsSpawned : 0;
    return {
      level: state.level,
      timeLeft: Math.max(0, state.timeLeft),
      countdownLeft: Math.max(0, state.countdownLeft),
      starsCollected: state.starsCollected,
      starsSpawned: state.starsSpawned,
      goal: level.goal,
      combo: state.combo,
      maxCombo: state.maxCombo,
      shield: state.shield,
      score: state.score,
      rate,
    };
  }

  return {
    state,
    step,
    switchCar,
    drainEvents,
    getHud,
    _level: level,
  };
}

export { LEVELS };
