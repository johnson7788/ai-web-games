// APACHE TRAIL · 纯逻辑 sim（无 DOM，可被 node --test / selfplay 直接 import）。
// 60Hz 固定步长：run.step(dt)。事件经 run.drainEvents() 消费。
// 状态机：idle/run/jump/doubleJump/fall/climb/dead（up 态并入 air）。
import { WORLD, PLAYER, GAME, STEP } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

export { LEVELS, LEVEL_COUNT };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function moverPos(m, t) {
  if (!m.p1 || !m.p2) return { x: m.x, y: m.y };
  const period = Math.max(0.01, m.period || 2);
  const tt = ((t + (m.phase || 0)) % period) / period;
  const k = tt < 0.5 ? tt * 2 : (1 - tt) * 2; // 0→1→0 ping-pong
  return {
    x: m.p1.x + (m.p2.x - m.p1.x) * k,
    y: m.p1.y + (m.p2.y - m.p1.y) * k,
  };
}

export function createRun(levelIndex, opts = {}) {
  const idx = clamp(levelIndex | 0, 0, LEVEL_COUNT - 1);
  const level = LEVELS[idx];
  // 每局独立克隆可收集物（避免 _got 污染共享关卡数据 / 重开后水晶已消失）
  const crystals = level.crystals.map((c) => ({ ...c }));
  const powerups = level.powerups.map((p) => ({ ...p }));
  const seed = (opts.seed | 0) || 1;

  const events = [];
  const emit = (type, extra = {}) => events.push({ type, ...extra });

  const player = {
    x: level.spawn.x - PLAYER.W / 2,
    y: level.spawn.y - PLAYER.H,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    state: 'idle',        // idle|run|jump|doubleJump|fall|climb|dead
    jumps: 0,
    coyote: 0,
    jumpBuffer: 0,
    shield: 0,
    invuln: 0,
    animT: 0,
    runTick: 0,
    prevBottom: level.spawn.y,
  };

  const state = {
    level: idx + 1,               // 1 基
    levelIndex: idx,
    phase: 'playing',             // playing|won|lost
    player,
    timeLeft: level.time,
    timeLimit: level.time,
    par: level.par,
    crystalsCollected: 0,
    crystalsTotal: crystals.length,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    lastCollectAt: -99,
    score: 0,
    endReached: false,
    reason: null,
    stars: 0,
  };

  const input = { left: false, right: false, jump: false };

  // 运行期可变实体（saw/boulder/tumble）
  const movers = [];
  for (const h of level.hazards) {
    if (h.p1 || h.p2) movers.push({ base: h, x: h.x, y: h.y });
  }

  let t = 0;
  let runClock = 0;

  function setState(s) {
    if (player.state === s) return;
    player.state = s;
    if (s === 'run') emit('run');
  }

  function doJump(n) {
    player.vy = PLAYER.JUMP_FORCE;
    player.jumps = n;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    setState(n >= 2 ? 'doubleJump' : 'jump');
    emit(n >= 2 ? 'doubleJump' : 'jump');
  }

  // 检测可抓的墙（dir = -1/1）
  function wallAhead(dir) {
    if (dir === 0) return 0;
    for (const plat of level.platforms) {
      const pTop = player.y;
      const pBot = player.y + PLAYER.H;
      if (pBot <= plat.y || pTop >= plat.y + plat.h) continue;
      if (dir > 0 && Math.abs((player.x + PLAYER.W) - plat.x) < PLAYER.WALL_STICK) return 1;
      if (dir < 0 && Math.abs(player.x - (plat.x + plat.w)) < PLAYER.WALL_STICK) return -1;
    }
    return 0;
  }

  function applyWind() {
    for (const w of level.winds) {
      const cycle = (w.interval || 2) + (w.duration || 2);
      const active = ((t + (w.phase || 0)) % cycle) >= (w.interval || 2);
      if (!active) continue;
      const pr = { x: player.x, y: player.y, w: PLAYER.W, h: PLAYER.H };
      if (rectsOverlap(pr, w)) {
        player.vx += (w.dir.x || 0) * PLAYER.WIND_FORCE;
        player.vy += (w.dir.y || 0) * PLAYER.WIND_FORCE;
        emit('wind', { dir: w.dir });
      }
    }
  }

  function landOn(platY) {
    player.y = platY - PLAYER.H;
    player.vy = 0;
    if (!player.onGround) {
      player.onGround = true;
      player.jumps = 0;
      player.coyote = PLAYER.COYOTE;
      emit('land');
      if (player.jumpBuffer > 0) {
        doJump(1);
      } else {
        setState('idle');
      }
    }
  }

  function collide() {
    const pr = () => ({ x: player.x, y: player.y, w: PLAYER.W, h: PLAYER.H });

    // 水平
    player.x += player.vx;
    for (const plat of level.platforms) {
      if (!rectsOverlap(pr(), plat)) continue;
      if (player.vx > 0) { player.x = plat.x - PLAYER.W; player.vx = 0; }
      else if (player.vx < 0) { player.x = plat.x + plat.w; player.vx = 0; }
    }

    // 垂直
    player.y += player.vy;
    player.onGround = false;
    for (const plat of level.platforms) {
      if (!rectsOverlap(pr(), plat)) continue;
      if (player.vy >= 0) { landOn(plat.y); }
      else { player.y = plat.y + plat.h; player.vy = 0; }
    }
  }

  function checkSprings() {
    for (const s of level.springs) {
      const pr = { x: player.x, y: player.y, w: PLAYER.W, h: PLAYER.H };
      if (player.vy >= 0 && rectsOverlap(pr, s) && (player.prevBottom <= s.y + 6)) {
        player.vy = -(s.force || 18);
        player.onGround = false;
        player.jumps = 1;
        setState('jump');
        emit('spring');
      }
    }
  }

  function hazardOverlap() {
    for (const h of level.hazards) {
      let zone = h;
      if (h.p1 || h.p2) {
        const m = movers.find((mm) => mm.base === h);
        zone = { x: m.x, y: m.y, w: h.w, h: h.h };
      }
      if (h.type === 'fire') {
        const cycle = (h.interval || 2) + (h.duration || 2);
        const active = ((t + (h.phase || 0)) % cycle) >= (h.interval || 2);
        if (!active) continue;
        zone = { x: h.x - 8, y: h.y - 66, w: h.w + 16, h: 66 };
      }
      const pr = { x: player.x, y: player.y, w: PLAYER.W, h: PLAYER.H };
      if (rectsOverlap(pr, zone)) return h;
    }
    return null;
  }

  function die(reason) {
    if (player.invuln > 0) return;
    if (player.shield > 0) {
      player.shield = 0;
      player.invuln = GAME.SHIELD_INVULN;
      player.vy = -9;
      player.vx = -player.facing * 5;
      player.onGround = false;
      setState('fall');
      emit('shieldBreak');
      return;
    }
    player.state = 'dead';
    state.phase = 'lost';
    state.reason = reason;
    emit('death', { reason });
    emit('lose', { reason });
  }

  function collectCrystals() {
    const pr = { x: player.x, y: player.y, w: PLAYER.W, h: PLAYER.H };
    for (const c of crystals) {
      if (c._got) continue;
      const r = { x: c.x - 11, y: c.y - 11, w: 22, h: 22 };
      if (rectsOverlap(pr, r)) {
        c._got = true;
        state.crystalsCollected += 1;
        state.score += GAME.CRYSTAL_SCORE;
        if (t - state.lastCollectAt <= GAME.COMBO_WINDOW) {
          state.combo = clamp(state.combo + 1, 1, GAME.COMBO_MAX);
        } else {
          state.combo = 1;
        }
        state.lastCollectAt = t;
        state.comboTimer = GAME.COMBO_WINDOW;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += state.combo * 2;
        emit('collect', { combo: state.combo });
        if (state.combo >= 2) emit('combo', { combo: state.combo });
      }
    }
  }

  function collectPowerups() {
    const pr = { x: player.x, y: player.y, w: PLAYER.W, h: PLAYER.H };
    for (const pu of powerups) {
      if (pu._got) continue;
      const r = { x: pu.x - 12, y: pu.y - 12, w: 24, h: 24 };
      if (rectsOverlap(pr, r)) {
        pu._got = true;
        if (pu.type === 'shield') {
          player.shield = 1;
          emit('shield');
        } else if (pu.type === 'time') {
          state.timeLeft = Math.min(state.timeLimit, state.timeLeft + GAME.TIME_SHARD);
          emit('time');
        }
      }
    }
  }

  function checkEnd() {
    const pr = { x: player.x, y: player.y, w: PLAYER.W, h: PLAYER.H };
    const winRect = { x: level.end.x - 36, y: level.end.y - 130, w: 72, h: 170 };
    if (rectsOverlap(pr, winRect)) {
      state.endReached = true;
      state.phase = 'won';
      let stars = 1;
      if (state.crystalsCollected >= state.crystalsTotal) stars += 1;
      if (state.timeLeft >= state.timeLimit - state.par) stars += 1;
      state.stars = stars;
      state.reason = null;
      emit('win', { stars });
    }
  }

  function physStep(dt) {
    const p = player;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const wantJump = input.jump;
    input.jump = false;

    // 计时器
    if (p.invuln > 0) p.invuln -= dt;
    if (p.coyote > 0) p.coyote -= dt;
    if (p.jumpBuffer > 0) p.jumpBuffer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    if (dir !== 0) p.facing = dir;

    // 水平目标速度
    if (p.state === 'climb') p.vx = 0;
    else if (p.onGround) p.vx = dir * PLAYER.RUN_SPEED;
    else p.vx = dir * PLAYER.AIR_SPEED;

    // 风
    applyWind();

    // 抓墙（仅空中、朝墙按住方向、未在抓墙时）
    const wd = p.onGround ? 0 : wallAhead(dir);
    if (!p.onGround && wd !== 0 && dir !== 0 && p.state !== 'climb') {
      setState('climb');
      emit('climb');
    }
    if (p.state === 'climb' && (wd === 0 || dir === 0)) {
      setState('fall');
    }

    // 跳跃
    if (wantJump) {
      if (p.onGround || p.coyote > 0) {
        doJump(1);
      } else if (p.state === 'climb') {
        p.vx = -wd * PLAYER.AIR_SPEED * 1.4;
        doJump(1);
      } else if (p.jumps < PLAYER.MAX_JUMPS) {
        doJump(p.jumps + 1);
      } else {
        p.jumpBuffer = PLAYER.JUMP_BUFFER;
      }
    }

    // 重力 / 抓墙下滑
    if (p.state !== 'climb') p.vy = Math.min(PLAYER.MAX_FALL, p.vy + PLAYER.GRAVITY);
    else p.vy = PLAYER.CLIMB_SPEED;

    p.prevBottom = p.y + PLAYER.H;
    collide();
    checkSprings();

    // 空中/地面状态命名
    if (!p.onGround) {
      if (p.state !== 'climb' && p.state !== 'jump' && p.state !== 'doubleJump' && p.vy > 0) {
        setState('fall');
      }
    } else if (p.state !== 'idle' && p.state !== 'run') {
      setState(dir !== 0 ? 'run' : 'idle');
    }
    if (p.onGround) {
      if (dir !== 0) setState('run');
      else setState('idle');
    }

    // 周期性 run 事件（保持事件密度）
    if (p.onGround && p.state === 'run') {
      runClock += dt;
      if (runClock >= 1.0) {
        runClock -= 1.0;
        emit('run');
      }
    }

    collectCrystals();
    collectPowerups();

    const h = hazardOverlap();
    if (h) die('hazard');

    if (p.y - PLAYER.H > WORLD.HEIGHT + GAME.FALL_OUT) die('fall');

    checkEnd();

    // 倒计时
    if (state.phase === 'playing') {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.phase = 'lost';
        state.reason = 'timeOut';
        emit('timeout');
        emit('lose', { reason: 'timeOut' });
      }
    }

    t += dt;
    for (const m of movers) {
      const np = moverPos(m.base, t);
      m.x = np.x;
      m.y = np.y;
    }
  }

  const run = {
    input,
    state,

    step(dt) {
      if (state.phase !== 'playing') return;
      const steps = Math.max(1, Math.round(dt / STEP));
      for (let i = 0; i < steps; i += 1) {
        if (state.phase !== 'playing') break;
        physStep(STEP);
      }
    },

    drainEvents() {
      return events.splice(0, events.length);
    },

    pressJump() {
      input.jump = true;
    },

    setMove(dir) {
      input.left = dir < 0;
      input.right = dir > 0;
    },

    getHud() {
      return {
        level: state.level,
        levelIndex: state.levelIndex,
        timeLeft: state.timeLeft,
        crystals: state.crystalsCollected,
        crystalsTotal: state.crystalsTotal,
        combo: state.combo,
        shield: player.shield,
        score: state.score,
      };
    },

    debug: {
      state: () => state,
      setPos: (x, y) => {
        player.x = x;
        player.y = y;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
      },
      winNow: () => {
        state.phase = 'won';
        state.stars = 1;
        state.endReached = true;
        emit('win', { stars: state.stars });
      },
    },
  };

  emit('start', { level: state.level });
  return run;
}
