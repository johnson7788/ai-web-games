// 纯逻辑 sim（无 DOM，可在 Node 直接跑）：徒手画路 + 左右发车 + 火花束/能量核心/火池。
// 玩法事实表见 docs/batch3/draw-truck-path.md。
import { WORLD, STEP, GAME } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(levelIndex, opts = {}) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const G = GAME;

  const state = {
    phase: 'playing', // playing | won | lost
    level: idx + 1,   // 1 基
    timeLeft: level.timeLimit,
    inkLeft: level.ink,
    strokes: 0,
    collected: 0,
    totalCores: level.cores.length,
    stars: 0,
    truck: {
      x: G.TRUCK_START_X,
      y: G.LEDGE_Y - G.TRUCK_R,
      vx: 0,
      vy: 0,
      onGround: true,
    },
    tracks: [],        // [{x,y}...] 每条笔迹一条折线
    cores: level.cores.map((c) => ({ x: c.x, y: c.y, collected: false })),
    beams: level.beams.map((b) => ({ ...b })),
    nearMissFired: level.beams.map(() => false),
    inputDir: 0,
    manualDriven: false,
    autoLaunched: false,
    autoLaunchT: G.AUTO_LAUNCH_S,
    lastSecShown: null,
    time: 0,
    reason: null,
  };

  let stroke = null;
  const events = [];
  const emit = (e) => events.push(e);

  function surfaceY(x) {
    let best = Infinity;
    let found = false;
    if (x >= G.LEDGE_X0 && x <= G.LEDGE_X1) { best = G.LEDGE_Y; found = true; }
    if (x >= G.GOAL_X0 && x <= G.GOAL_X1) { best = Math.min(best, G.GOAL_Y); found = true; }
    for (const track of state.tracks) {
      for (let i = 0; i < track.length - 1; i += 1) {
        const a = track[i];
        const b = track[i + 1];
        const x0 = Math.min(a.x, b.x);
        const x1 = Math.max(a.x, b.x);
        if (x >= x0 && x <= x1) {
          const dx = b.x - a.x;
          if (Math.abs(dx) < 0.0001) continue; // 竖直段不当作可行驶顶面
          const t = (x - a.x) / dx;
          const y = a.y + (b.y - a.y) * t;
          if (y < best) best = y;
          found = true;
        }
      }
    }
    return found ? best : null;
  }

  function win() {
    state.phase = 'won';
    state.stars = computeStars();
    emit({ type: 'win', stars: state.stars, level: state.level, collected: state.collected, totalCores: state.totalCores });
  }

  function lose(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    state.reason = reason;
    emit({ type: 'lose', reason, level: state.level });
  }

  function computeStars() {
    let stars = 1; // 到达终点
    if (state.totalCores === 0 || state.collected === state.totalCores) stars += 1;
    if (state.strokes <= G.PAR_LINES) stars += 1;
    return stars;
  }

  function inBeam(tr, b) {
    return tr.x >= b.x - G.BEAM_HALF_W && tr.x <= b.x + G.BEAM_HALF_W
      && tr.y >= b.yTop && tr.y <= b.yBot;
  }

  function subStep() {
    if (state.phase !== 'playing') return;
    const tr = state.truck;

    // 倒计时与心跳事件
    state.timeLeft -= STEP;
    if (state.timeLeft <= 0) { state.timeLeft = 0; lose('time'); return; }
    const sec = Math.ceil(state.timeLeft);
    if (sec !== state.lastSecShown) {
      state.lastSecShown = sec;
      emit({ type: 'tick', timeLeft: sec });
      if (sec <= 5 && sec > 0) emit({ type: 'countdownTick', timeLeft: sec });
    }

    // 首笔完成后自动发车（兜底；手动发车后取消）
    if (!state.manualDriven && !state.autoLaunched && state.strokes > 0) {
      state.autoLaunchT -= STEP;
      if (state.autoLaunchT <= 0) {
        state.autoLaunched = true;
        state.inputDir = 1;
        emit({ type: 'launch' });
      }
    }

    // 水平行驶
    if (tr.onGround) {
      const target = state.inputDir !== 0 ? state.inputDir * G.DRIVE_SPEED : 0;
      tr.vx += (target - tr.vx) * G.DRIVE_SMOOTH;
      tr.x += tr.vx;
      const sy = surfaceY(tr.x);
      if (sy == null || sy > tr.y + G.TRUCK_R + 60) {
        tr.onGround = false;
        tr.vy = 0;
      } else {
        tr.y = sy - G.TRUCK_R;
        tr.vy = 0;
        tr.onGround = true;
      }
    } else {
      tr.vy += G.GRAVITY;
      tr.vx *= G.AIR_FRICTION;
      tr.x += tr.vx;
      tr.y += tr.vy;
      const sy = surfaceY(tr.x);
      if (sy != null && tr.vy >= 0) {
        const bottom = tr.y + G.TRUCK_R;
        if (bottom >= sy) {
          tr.y = sy - G.TRUCK_R;
          tr.vy = 0;
          tr.onGround = true;
          emit({ type: 'land' });
        }
      }
    }

    // 掉入火池
    if (tr.y + G.TRUCK_R > G.FIRE_Y) { lose('fell'); return; }

    // 火花束
    for (let i = 0; i < state.beams.length; i += 1) {
      const b = state.beams[i];
      if (inBeam(tr, b)) { lose('spark'); return; }
      if (!state.nearMissFired[i]
        && tr.x >= b.x - G.NEAR_R && tr.x <= b.x + G.NEAR_R
        && tr.y >= b.yTop - G.NEAR_R && tr.y <= b.yBot + G.NEAR_R) {
        state.nearMissFired[i] = true;
        emit({ type: 'nearMiss', beam: i });
      }
    }

    // 能量核心
    for (const c of state.cores) {
      if (!c.collected) {
        const d = Math.hypot(tr.x - c.x, tr.y - c.y);
        if (d < G.PICKUP_R) {
          c.collected = true;
          state.collected += 1;
          emit({ type: 'pickup', count: state.collected });
          if (state.collected >= 2) emit({ type: 'combo', count: state.collected });
        }
      }
    }

    // 到达终点
    if (tr.onGround && tr.x >= G.GOAL_X0 && Math.abs((tr.y + G.TRUCK_R) - G.GOAL_Y) <= 4) {
      win();
      return;
    }
  }

  function step(dt) {
    const frames = Math.max(1, Math.round(dt / STEP));
    for (let i = 0; i < frames; i += 1) {
      if (state.phase !== 'playing') break;
      subStep();
      state.time += STEP;
    }
  }

  // ---- 玩家/机器人动作 ----
  function setDrive(dir) {
    if (state.phase !== 'playing') return { ok: false };
    const d = dir === 0 ? 0 : (dir > 0 ? 1 : -1);
    if (d !== 0 && !state.manualDriven) {
      state.manualDriven = true;
      emit({ type: 'drive', dir: d });
    }
    state.inputDir = d;
    return { ok: true };
  }

  function beginStroke(x, y) {
    if (state.phase !== 'playing') return { ok: false };
    if (state.inkLeft <= 0) return { ok: false };
    if (stroke) return { ok: false };
    stroke = { points: [{ x, y }] };
    return { ok: true };
  }

  function moveStroke(x, y) {
    if (!stroke) return { ok: false };
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot(x - last.x, y - last.y) >= G.MIN_SEG) {
      stroke.points.push({ x, y });
    }
    return { ok: true };
  }

  function endStroke() {
    if (!stroke) return { ok: false };
    const pts = stroke.points;
    stroke = null;
    if (pts.length >= 2) {
      state.tracks.push(pts);
      state.inkLeft -= 1;
      state.strokes += 1;
      emit({ type: 'draw', strokeIndex: state.strokes, inkLeft: state.inkLeft });
      return { ok: true };
    }
    return { ok: false }; // 单击不消耗墨也不生成路
  }

  function drawPath(points) {
    if (!Array.isArray(points) || points.length < 2) return { ok: false };
    if (state.phase !== 'playing' || state.inkLeft <= 0) return { ok: false };
    if (stroke) stroke = null;
    beginStroke(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) moveStroke(points[i].x, points[i].y);
    return endStroke();
  }

  function getHud() {
    return {
      level: state.level,
      timeLeft: state.timeLeft,
      ink: state.inkLeft,
      strokes: state.strokes,
      collected: state.collected,
      totalCores: state.totalCores,
      stars: state.stars,
      phase: state.phase,
      reason: state.reason,
    };
  }

  emit({ type: 'levelStart', level: state.level });

  return {
    state,
    level,
    step,
    drainEvents: () => events.splice(0, events.length),
    setDrive,
    beginStroke,
    moveStroke,
    endStroke,
    drawPath,
    getHud,
    surfaceY,
    _level: level,
  };
}
