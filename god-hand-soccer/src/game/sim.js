// 纯逻辑模拟：双神手控双前锋的 4 车道纵向躲避跑（无 DOM / 无渲染 / 无随机源依赖）。
// createRun(mode, {seed}) → { state, step, drainEvents, input, getHud, start }
//   mode: -1 = 无尽模式；0..LEVEL_COUNT-1 = 关卡下标。
// 车道（绝对 0..3）：左外=0，左内=1，右内=2，右外=3。左前锋在 {0,1}，右前锋在 {2,3}。
// 障碍：防守屏障 wall（每半场必挡一条车道）；滚动岩石 rock（在所属半场两车道间漂移）。
// 新机制（相对原版）：能量晶片连击 combo、星级 rating、道具护盾/减速/磁吸、岩石 nearMiss。

import { GAME, WORLD, LANE_X, DEFAULT_LANES, STEP } from '../../config/game.config.js';
import { LEVELS, getLevel } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function laneFromX(x) {
  if (x < 320) return 0;
  if (x < 640) return 1;
  if (x < 960) return 2;
  return 3;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function createRun(mode = -1, opts = {}) {
  const endless = mode < 0;
  const level = endless ? null : getLevel(mode);
  const rng = mulberry32((opts.seed | 0) || 1);
  const speed = endless ? GAME.BASE_SPEED : level.speed;
  const targetM = endless ? Infinity : level.distanceM;

  const state = {
    phase: 'ready',            // ready | playing | won | lost
    mode,                       // -1 = endless
    levelIndex: endless ? -1 : level.index - 1,
    level,
    distance: 0,                // 米
    targetM,
    speed,
    baseSpeed: speed,
    leftInner: false,           // 左前锋是否在内侧车道
    rightInner: false,          // 右前锋是否在内侧车道
    walls: [],                  // {half,lane?,x?,y,h,kind,passed,nearMissDone,vx?}
    orbs: [],                   // {x,lane,y,r,collected}
    powerups: [],               // {lane,y,kind,collected}
    effects: { shield: 0, slow: 0, magnet: 0 },
    combo: 0,                   // 当前连击数（晶片链）
    comboLevel: 0,
    comboTimer: 0,
    maxCombo: 0,
    orbsCollected: 0,
    score: 0,
    stars: 0,
    deaths: 0,
    time: 0,
    nextWallDist: 260,
    wallAccum: 0,
    meterMark: 5,
    shieldCd: 0,
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  function strikerLane(half) {
    return half === 'L' ? (state.leftInner ? 1 : 0) : (state.rightInner ? 2 : 3);
  }

  function currentSpeed() {
    return state.effects.slow > 0 ? state.baseSpeed * 0.5 : state.baseSpeed;
  }

  function start() {
    if (state.phase !== 'ready') return { ok: false };
    state.phase = 'playing';
    emit('levelStart', { mode, level: state.levelIndex + 1, targetM: Number.isFinite(targetM) ? targetM : null });
    return { ok: true };
  }

  function toggle(half) {
    if (state.phase !== 'playing') return { ok: false };
    if (half === 'L') state.leftInner = !state.leftInner;
    else state.rightInner = !state.rightInner;
    emit('flick', { half, lane: strikerLane(half) });
    return { ok: true };
  }

  function spawnHalfObstacle(half, yOffset = 0) {
    // 每半场恰一条障碍：左半挡 {0,1} 之一，右半挡 {2,3} 之一 → 永远有解。
    const lanes = half === 'L' ? [0, 1] : [2, 3];
    const lane = rng() < 0.5 ? lanes[0] : lanes[1];
    const isRock = !endless && level.rocks && rng() < (level.rockRate || 0.3);
    if (isRock) {
      const x = LANE_X[lane];
      const vx = (rng() < 0.5 ? -1 : 1) * GAME.ROCK_DRIFT;
      state.walls.push({ half, lane, x, vx, y: -GAME.ROCK_H - 40 + yOffset, h: GAME.ROCK_H, kind: 'rock', passed: false, nearMissDone: false });
      emit('rock', { half, lane });
    } else {
      state.walls.push({ half, lane, x: LANE_X[lane], y: -GAME.WALL_H + yOffset, h: GAME.WALL_H, kind: 'wall', passed: false, nearMissDone: false });
      emit('wall', { half, lane });
    }
  }

  function spawnWallRow() {
    spawnHalfObstacle('L');
    spawnHalfObstacle('R');
    // 双障碍关卡：概率追加第二排（仍每半场一条，间隔出）
    if (!endless && level.doubleWall && rng() < 0.35) {
      spawnHalfObstacle('L', -220);
      spawnHalfObstacle('R', -220);
    }
    maybeSpawnOrb();
    maybeSpawnPowerup();
  }

  function maybeSpawnOrb() {
    const rate = endless ? 0.55 : (level.orbRate || 0.4);
    if (rng() > rate) return;
    // 晶片放在该半场「空」车道（即这条障碍没有挡的车道）
    const half = rng() < 0.5 ? 'L' : 'R';
    const lane = strikerSafeLaneFor(half);
    state.orbs.push({ half, lane, x: LANE_X[lane], y: -GAME.ORB_R, r: GAME.ORB_R, collected: false });
    emit('orbSpawn', { half, lane });
  }

  // 该半场当前没有障碍挡着的车道
  function strikerSafeLaneFor(half) {
    const lanes = half === 'L' ? [0, 1] : [2, 3];
    const blocked = new Set();
    for (const w of state.walls) if (w.half === half) blocked.add(w.lane);
    for (const l of lanes) if (!blocked.has(l)) return l;
    return lanes[0];
  }

  function maybeSpawnPowerup() {
    const rate = endless ? 0.16 : (level.powerRate || 0);
    if (rate <= 0 || rng() > rate) return;
    const kinds = ['shield', 'slow', 'magnet'];
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const half = rng() < 0.5 ? 'L' : 'R';
    const lane = strikerSafeLaneFor(half);
    state.powerups.push({ half, lane, x: LANE_X[lane], y: -GAME.POWERUP_R, kind, collected: false });
    emit('powerupSpawn', { kind, half, lane });
  }

  function collectOrb(orb) {
    orb.collected = true;
    state.orbsCollected += 1;
    state.comboLevel = state.comboTimer > 0 ? Math.min(9, state.comboLevel + 1) : 1;
    state.comboTimer = GAME.COMBO_WINDOW;
    state.combo = state.comboLevel;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += 10 * state.combo;
    emit('orb', { combo: state.combo, orbs: state.orbsCollected });
    if (state.combo > 1) emit('combo', { combo: state.combo });
  }

  function applyPowerup(p) {
    p.collected = true;
    state.effects[p.kind] = (state.effects[p.kind] || 0) + (p.kind === 'shield' ? GAME.SHIELD_SEC : p.kind === 'slow' ? GAME.SLOW_SEC : GAME.MAGNET_SEC);
    state.score += 25;
    emit(p.kind, { half: p.half });
    emit('powerup', { kind: p.kind });
  }

  function gameOver() {
    state.phase = state.mode < 0 ? 'lost' : 'lost';
    state.deaths += 1;
    state.combo = 0;
    state.comboLevel = 0;
    emit(state.mode < 0 ? 'lose' : 'lose', { distance: Math.floor(state.distance) });
  }

  function win() {
    state.phase = 'won';
    const orbs = state.orbsCollected;
    state.stars = 1 + (orbs >= GAME.STAR_ORBS ? 1 : 0) + (orbs >= GAME.STAR_PERFECT ? 1 : 0);
    state.score += state.stars * 50;
    emit('win', { stars: state.stars, distance: Math.floor(state.distance), orbs });
  }

  function step() {
    if (state.phase !== 'playing') return;
    const spd = currentSpeed();
    state.time += STEP;

    // 距离 / 计分 / 米里程碑
    const prevDist = state.distance;
    state.distance += spd * GAME.METER_PER_PX;
    state.score = Math.max(state.score, Math.floor(state.distance));
    if (Math.floor(state.distance) >= state.meterMark) {
      emit('meter', { m: state.meterMark });
      state.meterMark += 5;
    }

    // 障碍生成
    state.wallAccum += spd;
    if (state.wallAccum >= state.nextWallDist) {
      spawnWallRow();
      state.wallAccum = 0;
      const gap = endless ? GAME.WALL_GAP : (level.wallGap || GAME.WALL_GAP);
      state.nextWallDist = gap[0] + rng() * (gap[1] - gap[0]);
    }

    // 效果计时
    for (const k of ['shield', 'slow', 'magnet']) {
      if (state.effects[k] > 0) state.effects[k] = Math.max(0, state.effects[k] - STEP);
    }
    // 连击窗口（超时归零）
    if (state.comboTimer > 0) {
      state.comboTimer -= STEP;
      if (state.comboTimer <= 0) {
        state.comboTimer = 0;
        state.comboLevel = 0;
        state.combo = 0;
      }
    }

    // 移动障碍 + 碰撞 + 越界清理
    const top = WORLD.STRIKER_Y - WORLD.STRIKER_R;
    const bottom = WORLD.STRIKER_Y + WORLD.STRIKER_R;
    const survivors = [];

    for (const w of state.walls) {
      w.y += spd;
      if (w.kind === 'rock' && w.vx) {
        w.x += w.vx;
        const halfMin = w.half === 'L' ? 20 : 660;
        const halfMax = w.half === 'L' ? 620 : 1260;
        if (w.x < halfMin) { w.x = halfMin; w.vx = Math.abs(w.vx); }
        if (w.x > halfMax) { w.x = halfMax; w.vx = -Math.abs(w.vx); }
        w.lane = laneFromX(w.x);
      }

      const lane = w.kind === 'rock' ? laneFromX(w.x) : w.lane;
      const sLane = strikerLane(w.half);
      const hh = w.h / 2;
      const overlaps = (w.y + hh >= top) && (w.y - hh <= bottom);

      if (overlaps && lane === sLane) {
        if (state.effects.shield > 0 && !w.passed) {
          w.passed = true;
          emit('shieldBlock', { half: w.half });
        } else if (!w.passed) {
          gameOver();
          w.passed = true;
        }
      } else if (overlaps && lane !== sLane && !w.nearMissDone) {
        w.nearMissDone = true;
        if (w.kind === 'rock') emit('nearMiss', { half: w.half });
        else emit('dodge', { half: w.half });
        if (w.kind === 'rock') state.score += 5;
      }

      // 越过前锋后标记 passed，避免二次判定；仍保留到出屏
      if (w.y - hh > bottom) w.passed = true;

      if (w.y - hh < WORLD.HEIGHT + 80) survivors.push(w);
    }
    state.walls = survivors;

    // 碰撞已判负时立即终止本步
    if (state.phase !== 'playing') return;

    // 晶片（磁吸生效时：同场任意车道的晶片都会被吸到前锋身上）
    const orbSurvivors = [];
    for (const o of state.orbs) {
      o.y += spd;
      if (!o.collected) {
        const overlaps = (o.y + o.r >= top) && (o.y - o.r <= bottom);
        const sameLane = o.lane === strikerLane(o.half);
        const magnetPull = state.effects.magnet > 0 && overlaps;
        if (overlaps && (sameLane || magnetPull)) collectOrb(o);
      }
      if (o.y - o.r < WORLD.HEIGHT + 60) orbSurvivors.push(o);
    }
    state.orbs = orbSurvivors;

    // 道具
    const powerSurvivors = [];
    for (const p of state.powerups) {
      p.y += spd;
      if (!p.collected) {
        const overlaps = (p.y + GAME.POWERUP_R >= top) && (p.y - GAME.POWERUP_R <= bottom);
        if (overlaps && p.lane === strikerLane(p.half)) applyPowerup(p);
      }
      if (p.y - GAME.POWERUP_R < WORLD.HEIGHT + 60) powerSurvivors.push(p);
    }
    state.powerups = powerSurvivors;

    // 关卡到终点 → 胜利
    if (!endless && state.distance >= targetM && state.phase === 'playing') win();
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  function getHud() {
    return {
      distance: Math.floor(state.distance),
      targetM: Number.isFinite(targetM) ? targetM : null,
      score: state.score,
      combo: state.combo,
      orbs: state.orbsCollected,
      effects: { ...state.effects },
      phase: state.phase,
    };
  }

  function input(action) {
    switch (action) {
      case 'confirm': return start();
      case 'left': return toggle('L');
      case 'right': return toggle('R');
      default: return { ok: false };
    }
  }

  return {
    state,
    step,
    drainEvents,
    input,
    getHud,
    start,
    _level: level,
    _rng: rng,
  };
}

// 便捷入口：无尽模式
export function createEndless(opts = {}) {
  return createRun(-1, opts);
}

export { LANE_X };
