// 纯逻辑 sim：无 DOM，可在 Node 里被 tests / tools/selfplay.mjs 直接 import。
// 主题：霓虹街机 · 深海逃亡。玩家驾驶一条「鱼群」，吞并发光小鱼壮大，
// 躲开红鲨与暗礁，收集金币与狂暴之星，活得越久分数越高。
//
// 坐标约定：世界坐标原点是「鱼群出生点」，鱼群始终在原点附近（超限会整体平移归零），
// 渲染用 state.travelX/Y 做背景滚动、用 (entity - school) 做相机跟随。
import { WORLD, GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

function makePrey(x, y, rng) {
  return {
    kind: 'prey',
    x, y,
    dir: rng() * TAU,
    speed: GAME.PREY_SPEED_MIN + rng() * (GAME.PREY_SPEED_MAX - GAME.PREY_SPEED_MIN),
    turnT: 2 + rng() * 5,
    t: 0,
  };
}

function makePredator(x, y, rng) {
  const r = GAME.PRED_R_MIN + rng() * (GAME.PRED_R_MAX - GAME.PRED_R_MIN);
  return {
    kind: 'predator',
    x, y, r,
    dir: 0,
    speed: GAME.PRED_SPEED_MIN,
    nearFlag: false,
  };
}

function makeCoin(x, y, rng) {
  return { kind: 'coin', x, y, ph: rng() * TAU };
}

function makeRock(x, y, rng) {
  return {
    kind: 'rock',
    x, y,
    r: GAME.ROCK_R_MIN + rng() * (GAME.ROCK_R_MAX - GAME.ROCK_R_MIN),
    verts: Math.floor(5 + rng() * 4),
    rot: rng() * TAU,
    driftDir: rng() * TAU,
  };
}

function makeStar(x, y, rng) {
  return { kind: 'star', x, y, ph: rng() * TAU };
}

export function createRun(seed = 1) {
  const rng = mulberry32(seed);
  const rand = (a, b) => a + rng() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));

  const state = {
    phase: 'playing',          // 'playing' | 'over'
    time: 0,
    score: 0,
    gold: 0,                   // 本局收集的金币（货币）
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    collected: 0,
    eatenLost: 0,
    stage: 1,
    travelX: 0,
    travelY: 0,
    reviveUsed: false,
    boost: 0,                  // 当前能量表（秒）
    boosting: false,
    school: {
      x: 0, y: 0,
      dir: -Math.PI / 2,
      targetDir: -Math.PI / 2,
      speed: GAME.SCHOOL_BASE_SPEED,
      size: 1,
      rockCooldown: 0,
      invuln: 0,
      // 每条成员的轨道参数（用于渲染摆动）
      members: [ { ph: 0, ox: 0, oy: 0, r: 0 } ],
    },
    frenzy: 0,
    prey: [],
    predators: [],
    coins: [],
    rocks: [],
    stars: [],
    events: [],
    timers: {
      prey: 0.6,
      pred: 2.0,
      coin: 0.5,
      star: GAME.STAR_FIRST_AT,
    },
  };

  const run = { state };

  function emit(type, payload = {}) {
    state.events.push({ type, t: state.time, ...payload });
  }

  function schoolR() {
    return Math.min(GAME.SCHOOL_R_MAX, GAME.SCHOOL_BASE_R + GAME.SCHOOL_R_PER_MEMBER * state.school.size);
  }

  function spawnPreyAround(centerX, centerY, distMin, distMax) {
    const ang = rand(0, TAU);
    const d = rand(distMin, distMax);
    return makePrey(centerX + Math.cos(ang) * d, centerY + Math.sin(ang) * d, rng);
  }

  function spawnPredators() {
    const s = state.school;
    const count = state.stage >= 7 ? 3 : state.stage >= 4 ? 2 : 1;
    const perp = s.dir + Math.PI / 2;
    for (let i = 0; i < count; i += 1) {
      const lane = (i - (count - 1) / 2) * 130 + rand(-70, 70);
      const along = GAME.PRED_SPAWN_DIST + rand(0, 160);
      const x = s.x + Math.cos(s.dir) * along + Math.cos(perp) * lane;
      const y = s.y + Math.sin(s.dir) * along + Math.sin(perp) * lane;
      state.predators.push(makePredator(x, y, rng));
    }
    emit('predSpawn', { count });
  }

  function spawnCoinCluster(cx, cy) {
    state.coins.push(makeCoin(cx, cy, rng));
    if (rng() < GAME.COIN_CLUSTER_CHANCE) {
      const offsets = [[-22, 34], [22, 34], [-45, 0], [45, 0], [-22, -34], [22, -34]];
      for (const [ox, oy] of offsets) state.coins.push(makeCoin(cx + ox, cy + oy, rng));
    }
  }

  function spawnCoin() {
    const s = state.school;
    if (state.coins.length >= GAME.COIN_MAX) return;
    const perp = s.dir + Math.PI / 2;
    const lane = rand(-240, 240);
    const along = GAME.PRED_SPAWN_DIST * 0.82;
    spawnCoinCluster(
      s.x + Math.cos(s.dir) * along + Math.cos(perp) * lane,
      s.y + Math.sin(s.dir) * along + Math.sin(perp) * lane,
    );
  }

  function spawnStar() {
    if (state.frenzy > 0 || state.stars.length > 0) return;
    const s = state.school;
    const ang = rand(0, TAU);
    const d = rand(360, 560);
    state.stars.push(makeStar(s.x + Math.cos(ang) * d, s.y + Math.sin(ang) * d, rng));
    emit('starSpawn');
  }

  function ensureRocks() {
    while (state.rocks.length < GAME.ROCK_COUNT) {
      const ang = rand(0, TAU);
      const d = rand(300, 700);
      state.rocks.push(makeRock(state.school.x + Math.cos(ang) * d, state.school.y + Math.sin(ang) * d, rng));
    }
  }

  function ensurePrey() {
    if (state.prey.length < GAME.PREY_MAX) {
      state.prey.push(spawnPreyAround(state.school.x, state.school.y, GAME.PREY_SPAWN_DIST_MIN, GAME.PREY_SPAWN_DIST_MAX));
    }
  }

  // ---- 每步 ----
  function step(dt) {
    if (state.phase === 'over') return;
    state.time += dt;

    // 速度渐进（原版节奏：先快后慢，封顶）
    const s = state.school;
    if (s.speed < GAME.SCHOOL_RAMP1_CAP) s.speed = Math.min(GAME.SCHOOL_RAMP1_CAP, s.speed + GAME.SCHOOL_RAMP1 * dt);
    else if (s.speed < GAME.SCHOOL_SPEED_CAP) s.speed = Math.min(GAME.SCHOOL_SPEED_CAP, s.speed + GAME.SCHOOL_RAMP2 * dt);
    if (s.speed >= GAME.SCHOOL_RAMP1_CAP && state.timers.speedUpMilestone == null) {
      state.timers.speedUpMilestone = true;
      emit('speedUp', { speed: Math.round(s.speed) });
    }

    // 关卡 = 存活时长 / 20s
    const newStage = clamp(Math.floor(state.time / GAME.STAGE_TIME) + 1, 1, GAME.STAGE_MAX);
    if (newStage !== state.stage) {
      state.stage = newStage;
      emit('stageUp', { stage: state.stage });
    }

    // 连击倒计时
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        if (state.combo >= 2) emit('comboBreak', { combo: state.combo });
        state.combo = 0;
      }
    }

    // 狂暴倒计时
    if (state.frenzy > 0) {
      state.frenzy -= dt;
      if (state.frenzy <= 0) {
        state.frenzy = 0;
        emit('frenzyEnd');
      }
    }

    // 能量表
    if (state.boosting) {
      state.boost = Math.max(0, state.boost - GAME.BOOST_DRAIN * dt);
      if (state.boost <= 0) state.boosting = false;
    } else {
      state.boost = Math.min(GAME.BOOST_MAX, state.boost + GAME.BOOST_REGEN * dt);
    }

    // 无敌 / 礁石冷却
    if (s.invuln > 0) s.invuln -= dt;
    if (s.rockCooldown > 0) s.rockCooldown -= dt;

    // 转向（boost 时更钝）
    const turnRate = GAME.TURN_RATE * (state.boosting ? GAME.TURN_RATE_BOOST_MUL : 1);
    const diff = angDiff(s.dir, s.targetDir);
    const maxTurn = turnRate * dt;
    if (Math.abs(diff) <= maxTurn) s.dir = s.targetDir;
    else s.dir += Math.sign(diff) * maxTurn;

    // 移动
    const speedMul = state.boosting ? GAME.BOOST_SPEED_MUL : 1;
    const v = s.speed * speedMul;
    const dx = Math.cos(s.dir) * v * dt;
    const dy = Math.sin(s.dir) * v * dt;
    s.x += dx;
    s.y += dy;
    state.travelX += dx;
    state.travelY += dy;

    // 世界重归零，避免浮点漂移
    if (Math.abs(s.x) > GAME.REBASE_DIST || Math.abs(s.y) > GAME.REBASE_DIST) {
      const ox = s.x; const oy = s.y;
      for (const arr of [state.prey, state.predators, state.coins, state.rocks, state.stars]) {
        for (const e of arr) { e.x -= ox; e.y -= oy; }
      }
      s.x = 0; s.y = 0;
    }

    // 生成
    state.timers.prey -= dt;
    if (state.timers.prey <= 0) {
      state.timers.prey = GAME.PREY_SPAWN_INTERVAL;
      ensurePrey();
    }
    state.timers.pred -= dt;
    if (state.timers.pred <= 0) {
      const predInterval = clamp(2.1 - state.stage * 0.13, 1.25, 2.1);
      state.timers.pred = predInterval;
      if (state.predators.length < GAME.PRED_MAX) spawnPredators();
    }
    state.timers.coin -= dt;
    if (state.timers.coin <= 0) {
      state.timers.coin = GAME.COIN_SPAWN_INTERVAL;
      spawnCoin();
    }
    state.timers.star -= dt;
    if (state.timers.star <= 0) {
      state.timers.star = GAME.STAR_INTERVAL;
      spawnStar();
    }

    // 更新小鱼（随机游走 + 狂暴磁吸）
    for (const p of state.prey) {
      p.t += dt;
      if (p.t >= p.turnT) {
        p.t = 0;
        p.turnT = 2 + rng() * 5;
        p.dir += rand(-0.9, 0.9);
      }
      let vx = Math.cos(p.dir) * p.speed;
      let vy = Math.sin(p.dir) * p.speed;
      if (state.frenzy > 0) {
        const d = dist(p.x, p.y, s.x, s.y);
        if (d < GAME.FRENZY_MAGNET_R && d > 1) {
          const pull = (1 - d / GAME.FRENZY_MAGNET_R) * 420;
          vx += (s.x - p.x) / d * pull;
          vy += (s.y - p.y) / d * pull;
        }
      }
      p.x += vx * dt;
      p.y += vy * dt;
    }

    // 更新红鲨（追向鱼群）
    const chaseSpeed = Math.max(GAME.PRED_SPEED_MIN, s.speed - GAME.PRED_SPEED_OFFSET);
    for (const pr of state.predators) {
      const d = dist(pr.x, pr.y, s.x, s.y);
      const ang = Math.atan2(s.y - pr.y, s.x - pr.x);
      pr.dir = ang;
      pr.speed = chaseSpeed;
      pr.x += Math.cos(ang) * chaseSpeed * dt;
      pr.y += Math.sin(ang) * chaseSpeed * dt;
      // nearMiss：擦身而过（比碰撞圈大一点，但没撞到）
      const hitD = schoolR() + pr.r;
      const nearD = hitD + GAME.PRED_NEAR_MISS_MARGIN;
      if (d < nearD && d >= hitD && !pr.nearFlag) {
        pr.nearFlag = true;
        emit('nearMiss', { dist: Math.round(d) });
      } else if (d >= nearD) {
        pr.nearFlag = false;
      }
    }

    // 暗礁缓慢漂移
    for (const r of state.rocks) {
      r.x += Math.cos(r.driftDir) * 14 * dt;
      r.y += Math.sin(r.driftDir) * 14 * dt;
    }

    ensureRocks();

    // ---- 碰撞 ----
    const R = schoolR();

    // 小鱼入群
    for (let i = state.prey.length - 1; i >= 0; i -= 1) {
      const p = state.prey[i];
      if (dist(p.x, p.y, s.x, s.y) < R + GAME.PREY_R) {
        state.prey.splice(i, 1);
        addMember();
        state.collected += 1;
        state.combo += 1;
        state.comboTimer = GAME.COMBO_WINDOW;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        const mult = 1 + Math.floor(state.combo / GAME.COMBO_STEP);
        state.score += mult;
        emit('join', { size: s.size, combo: state.combo, mult, score: state.score });
        if (state.combo > 1 && state.combo % GAME.COMBO_STEP === 0) emit('comboUp', { combo: state.combo });
      }
    }

    // 金币
    for (let i = state.coins.length - 1; i >= 0; i -= 1) {
      const c = state.coins[i];
      if (dist(c.x, c.y, s.x, s.y) < R + GAME.COIN_R) {
        state.coins.splice(i, 1);
        state.gold += 1;
        emit('coin', { gold: state.gold });
      }
    }

    // 狂暴之星
    for (let i = state.stars.length - 1; i >= 0; i -= 1) {
      const st = state.stars[i];
      if (dist(st.x, st.y, s.x, s.y) < R + GAME.STAR_R) {
        state.stars.splice(i, 1);
        state.frenzy = GAME.FRENZY_DURATION;
        emit('frenzyStart');
      }
    }

    // 红鲨：狂暴期反吃，平时被吃
    for (let i = state.predators.length - 1; i >= 0; i -= 1) {
      const pr = state.predators[i];
      const d = dist(pr.x, pr.y, s.x, s.y);
      if (d < R + pr.r) {
        if (state.frenzy > 0) {
          state.predators.splice(i, 1);
          state.score += GAME.FRENZY_EAT_SCORE;
          emit('eatPred', { score: state.score });
        } else if (s.invuln <= 0) {
          state.predators.splice(i, 1);
          loseMember();
          s.invuln = Math.max(s.invuln, 0.4); // 被咬后短暂无敌，防止鲨群连环咬
          emit('eat', { left: s.size });
          if (state.phase === 'over') { emit('lose', finalStats()); return; }
        }
      }
    }

    // 暗礁碰撞（甩掉一条鱼并弹开）
    if (s.rockCooldown <= 0 && s.invuln <= 0) {
      for (const r of state.rocks) {
        const d = dist(r.x, r.y, s.x, s.y);
        if (d < R + r.r) {
          s.rockCooldown = GAME.ROCK_HIT_COOLDOWN;
          // 弹开：朝远离礁石方向
          const ang = Math.atan2(s.y - r.y, s.x - r.x);
          s.targetDir = ang;
          s.dir = ang;
          // 甩掉的鱼变成可追回的小鱼；只剩一条时只弹开不死（岩石是成长代价，不是廉价秒杀）
          if (s.size > 1) {
            const px = r.x + Math.cos(ang) * (r.r + 26);
            const py = r.y + Math.sin(ang) * (r.r + 26);
            state.prey.push(makePrey(px, py, rng));
            loseMember();
          }
          emit('rockHit', { left: s.size });
          if (state.phase === 'over') { emit('lose', finalStats()); return; }
          break;
        }
      }
    }

    // 回收过远实体
    recycle();
  }

  function addMember() {
    const s = state.school;
    s.size += 1;
    s.members.push({
      ph: rng() * TAU,
      ox: rand(-14, 14),
      oy: rand(-14, 14),
      r: rand(10, 26),
    });
  }

  function loseMember() {
    const s = state.school;
    s.size = Math.max(0, s.size - 1);
    if (s.members.length > 1) s.members.pop();
    if (s.size <= 0) {
      state.phase = 'over';
    }
  }

  function recycle() {
    const s = state.school;
    const keep = (arr) => {
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        if (dist(arr[i].x, arr[i].y, s.x, s.y) > GAME.RECYCLE_DIST) arr.splice(i, 1);
      }
    };
    keep(state.prey);
    keep(state.predators);
    keep(state.coins);
    keep(state.stars);
    keep(state.rocks);
    // 暗礁回收后立刻在鱼群周围补一个
    ensureRocks();
  }

  function finalStats() {
    return {
      score: state.score,
      gold: state.gold,
      stage: state.stage,
      collected: state.collected,
      bestCombo: state.bestCombo,
      time: state.time,
    };
  }

  run.setDirection = (angle) => {
    state.school.targetDir = angle;
  };

  run.setBoost = (on) => {
    state.boosting = !!on && state.boost > GAME.BOOST_ACTIVE_MIN;
    if (!state.boosting && !!on) { /* 能量不足：静默失败 */ }
  };

  run.tryRevive = () => {
    if (state.phase !== 'over' || state.reviveUsed) return false;
    state.reviveUsed = true;
    state.phase = 'playing';
    const s = state.school;
    s.size = 1;
    s.members = [{ ph: 0, ox: 0, oy: 0, r: 0 }];
    s.invuln = GAME.REVIVE_INVULN;
    s.rockCooldown = 0;
    // 清掉身边危险
    for (let i = state.predators.length - 1; i >= 0; i -= 1) {
      if (dist(state.predators[i].x, state.predators[i].y, s.x, s.y) < 320) state.predators.splice(i, 1);
    }
    emit('revive', { score: state.score });
    return true;
  };

  run.step = step;
  run.drainEvents = () => {
    const ev = state.events;
    state.events = [];
    return ev;
  };
  run.schoolRadius = schoolR;

  // 初始：5 个暗礁 + 若干小鱼
  ensureRocks();
  for (let i = 0; i < GAME.PREY_MAX; i += 1) {
    state.prey.push(spawnPreyAround(0, 0, GAME.PREY_SPAWN_DIST_MIN, GAME.PREY_SPAWN_DIST_MAX));
  }
  state.coins.push(makeCoin(rand(-300, 300), rand(-300, 300), rng));

  return run;
}

export { WORLD as SIM_WORLD };
