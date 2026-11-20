// src/game/sim.js — ARCADE TREASURE · 纯逻辑模拟（零 DOM/零 window/零 Date.now）。
// 契约：createRun({seed}) → run{ step(input), getHud(), drainEvents(), phase, machine, ... }。
// 状态机：hall（选台）→ playing（机台内）→ result（结算）→ hall …；
//         hall 空置超时 → gameover（打烊）；币尽且无兜底 → gameover；12 段全通 → grandprix。
import { WORLD, STEP } from '../../config/game.config.js';
import {
  clamp, ECONOMY, MACHINES, MOLE, RAIN, SWARM, rankTarget,
} from '../../config/gameplay.js';
import { RANK_COUNT } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';

const ALL_CLEARED = (1 << MACHINES.COUNT) - 1; // 0b111

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'hall',             // hall | playing | result | gameover | grandprix
    machine: null,             // 0|1|2|null
    tokens: ECONOMY.START_TOKENS,
    rank: 1,
    heat: 0,
    lastMachine: null,
    clearedMask: 0,            // 当前段已达标机台位图
    signLit: false,
    hallTime: 0,
    pityUsed: false,
    score: 0,                  // 当前机台得分
    machineTime: 0,
    lives: 0,
    combo: 0,
    maxCombo: 0,
    result: null,              // 最近一次机台结算 {machine, score, target, tokens, cleared}
    sub: null,                 // 机台子状态（mole/rain/swarm）
    stats: {
      bestRank: 1,
      totalScore: 0,
      plays: 0,
      clears: 0,
      bestMachineScore: [0, 0, 0],
    },
    events: [],
    _nextId: 1,
    _lastScoreMile: 0,
  };

  run.step = (input = {}) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架别名
export function createSim() { return createRun({ seed: 0 }); }
export function updateSim(run, input = {}) { run.step(input); }

// ---------- 每 tick ----------
function step(run, input = {}) {
  const dt = STEP;
  if (run.phase === 'hall') stepHall(run, input, dt);
  else if (run.phase === 'playing') stepPlaying(run, input, dt);
  else if (run.phase === 'result') stepResult(run, input);
  // gameover / grandprix：等待 main 调 restart；bot 停止 step。
}

// ---------- 大厅 ----------
function stepHall(run, input, dt) {
  run.hallTime += dt;
  if (run.hallTime >= ECONOMY.HALL_IDLE_LIMIT) {
    return endRun(run, 'gameover', 'closing');
  }

  const pick = input.pick;
  if (pick == null || pick < 0 || pick >= MACHINES.COUNT) return;

  if (run.tokens < ECONOMY.ENTRY_COST) {
    if (!run.pityUsed) {
      run.pityUsed = true;
      run.tokens += ECONOMY.PITY_TOKEN;
      emit(run, 'pity', { tokens: run.tokens });
    } else {
      endRun(run, 'gameover', 'out-of-tokens');
    }
    return;
  }

  enterMachine(run, pick);
}

function enterMachine(run, m) {
  run.tokens -= ECONOMY.ENTRY_COST;
  run.machine = m;
  run.score = 0;
  run.machineTime = 0;
  run.combo = 0;
  run.maxCombo = 0;
  run._lastScoreMile = 0;
  run.lives = MACHINES.LIVES[m];
  run.phase = 'playing';
  run.stats.plays += 1;

  // 连机热度：同台连玩 +1，换台清零
  const prevHeat = run.heat;
  if (m === run.lastMachine) run.heat = Math.min(ECONOMY.HEAT_MAX, run.heat + 1);
  else run.heat = 0;
  run.lastMachine = m;

  initMachine(run, m);
  emit(run, 'machinePick', { machine: m });
  emit(run, 'tokenSpent', { tokens: run.tokens });
  if (run.heat !== prevHeat) emit(run, 'heatUp', { heat: run.heat });
}

// ---------- 机台子状态初始化 ----------
function initMachine(run, m) {
  if (m === 0) {
    run.sub = {
      holes: [],
      spawnT: 0,
    };
    const cx = MOLE.PAD_X + MOLE.GRID_W / (MOLE.HOLES_X * 2);
    const cy = 150 + MOLE.GRID_H / (MOLE.HOLES_Y * 2);
    const gw = MOLE.GRID_W / MOLE.HOLES_X;
    const gh = MOLE.GRID_H / MOLE.HOLES_Y;
    for (let y = 0; y < MOLE.HOLES_Y; y += 1) {
      for (let x = 0; x < MOLE.HOLES_X; x += 1) {
        run.sub.holes.push({
          id: run._nextId++,
          x: MOLE.PAD_X + gw * x + gw / 2,
          y: 150 + gh * y + gh / 2,
          up: false, hazard: false, t: 0,
        });
      }
    }
  } else if (m === 1) {
    run.sub = { basketX: WORLD.WIDTH / 2, items: [], spawnT: 0, lastCatch: -Infinity };
  } else {
    run.sub = { shipX: WORLD.WIDTH / 2, fireT: 0, bees: [], bullets: [], beeBullets: [], moveT: 0, shootT: 0, dir: 1 };
    spawnSwarmWave(run);
  }
}

function spawnSwarmWave(run) {
  run.sub.bees = [];
  for (let r = 0; r < SWARM.BEE_ROWS; r += 1) {
    for (let c = 0; c < SWARM.BEE_COLS; c += 1) {
      run.sub.bees.push({
        id: run._nextId++,
        x: 180 + c * (SWARM.BEE_W + 26),
        y: SWARM.START_Y + r * (SWARM.BEE_H + 18),
        alive: true,
      });
    }
  }
  run.sub.dir = 1;
}

// ---------- 机台内 ----------
function stepPlaying(run, input, dt) {
  run.machineTime += dt;

  if (run.machine === 0) stepMole(run, input, dt);
  else if (run.machine === 1) stepRain(run, input, dt);
  else stepSwarm(run, input, dt);

  // 结束条件：时间到 / 生命耗尽
  const dur = MACHINES.DURATION[run.machine];
  const timedOut = run.machineTime >= dur;
  const dead = run.lives > 0 && run.lives <= 0;
  if (timedOut || dead) finishMachine(run);
}

function finishMachine(run) {
  const m = run.machine;
  const target = rankTarget(run.rank, m);
  const heatMult = ECONOMY.HEAT_MULT[run.heat];
  const earned = Math.floor((run.score * heatMult) / Math.max(1, target));
  run.tokens += earned;
  run.stats.totalScore += run.score;
  if (run.score > run.stats.bestMachineScore[m]) run.stats.bestMachineScore[m] = run.score;

  const cleared = run.score >= target;
  run.result = { machine: m, score: run.score, target, tokens: earned, cleared, heat: run.heat };
  run.phase = 'result';
  run.machine = null;
  run.sub = null;

  emit(run, 'machineResult', { machine: m, score: run.score, target, tokens: earned, cleared });
  if (earned > 0) emit(run, 'tokenEarned', { tokens: earned });
  if (cleared) {
    run.stats.clears += 1;
    emit(run, 'cleared', { machine: m, rank: run.rank });
    advanceCleared(run);
  }
}

function advanceCleared(run) {
  const m = run.result.machine;
  run.clearedMask |= (1 << m);
  if (run.clearedMask === ALL_CLEARED) {
    if (run.rank >= RANK_COUNT) {
      run.signLit = true;
      run.phase = 'grandprix';
      emit(run, 'grandPrix', { rank: run.rank });
    } else {
      run.rank += 1;
      run.clearedMask = 0;
      if (run.rank > run.stats.bestRank) run.stats.bestRank = run.rank;
      emit(run, 'rankUp', { rank: run.rank });
    }
  }
}

function stepResult(run, input) {
  if (input.continue) {
    run.phase = 'hall';
    run.hallTime = 0;
    run.result = null;
  }
}

function endRun(run, phase, reason) {
  if (run.phase === 'gameover' || run.phase === 'grandprix') return;
  run.phase = phase;
  emit(run, phase === 'gameover' ? 'gameover' : 'grandPrix', { reason });
}

// ---------- 机房守夜（打地鼠） ----------
function stepMole(run, input, dt) {
  const s = run.sub;
  s.spawnT -= dt;

  // 生成
  if (s.spawnT <= 0 && s.holes.some((h) => !h.up)) {
    const free = s.holes.filter((h) => !h.up);
    const h = free[Math.floor(run.rng() * free.length)];
    h.up = true;
    h.hazard = run.rng() < MOLE.HAZARD_CHANCE;
    h.t = MOLE.UP_MIN + run.rng() * (MOLE.UP_MAX - MOLE.UP_MIN);
    s.spawnT = MOLE.SPAWN_EVERY * (0.7 + run.rng() * 0.6);
    emit(run, 'spawn', { machine: 0, x: h.x, y: h.y, hazard: h.hazard });
  }

  // 缩头
  for (const h of s.holes) {
    if (!h.up) continue;
    h.t -= dt;
    if (h.t <= 0) {
      h.up = false;
      if (!h.hazard) emit(run, 'miss', { machine: 0, x: h.x, y: h.y });
    }
  }

  // 命中判定（点击）
  if (input.tapX != null && input.tapY != null) {
    let hit = null;
    for (const h of s.holes) {
      if (!h.up) continue;
      if (Math.hypot(input.tapX - h.x, input.tapY - h.y) <= MOLE.RADIUS) { hit = h; break; }
    }
    if (hit) {
      hit.up = false;
      if (hit.hazard) {
        addScore(run, MOLE.HAZARD_SCORE);
        emit(run, 'badHit', { machine: 0, x: hit.x, y: hit.y });
      } else {
        addScore(run, MOLE.HIT_SCORE);
        emit(run, 'hit', { machine: 0, x: hit.x, y: hit.y });
      }
    }
  }
}

// ---------- 雨中拾荒（接金币） ----------
function stepRain(run, input, dt) {
  const s = run.sub;
  s.spawnT -= dt;

  // 篮筐追指针
  if (input.steerX != null) {
    const target = clamp(input.steerX, RAIN.BASKET_W / 2, WORLD.WIDTH - RAIN.BASKET_W / 2);
    const d = target - s.basketX;
    const maxStep = RAIN.BASKET_SPEED * dt;
    s.basketX += clamp(d, -maxStep, maxStep);
  }

  // 生成物品
  if (s.spawnT <= 0) {
    const coin = run.rng() < RAIN.COIN_CHANCE;
    s.items.push({
      id: run._nextId++,
      x: 60 + run.rng() * (WORLD.WIDTH - 120),
      y: 70,
      vy: RAIN.FALL_SPEED_MIN + run.rng() * (RAIN.FALL_SPEED_MAX - RAIN.FALL_SPEED_MIN),
      kind: coin ? 'coin' : 'hazard',
      value: RAIN.COIN_SCORE,
    });
    s.spawnT = RAIN.SPAWN_EVERY * (0.6 + run.rng() * 0.8);
    emit(run, 'spawn', { machine: 1, x: 0, y: 0 });
  }

  // 下落 + 接取
  const remaining = [];
  for (const it of s.items) {
    it.y += it.vy * dt;
    const caught = it.y >= RAIN.BASKET_Y - RAIN.CATCH_RADIUS
      && Math.abs(it.x - s.basketX) <= RAIN.BASKET_W / 2 + RAIN.CATCH_RADIUS;
    if (caught) {
      if (it.kind === 'coin') {
        run.combo = (run.machineTime - s.lastCatch <= RAIN.COMBO_WINDOW) ? run.combo + 1 : 1;
        s.lastCatch = run.machineTime;
        if (run.combo > run.maxCombo) run.maxCombo = run.combo;
        const mult = RAIN.COMBO_MULT[Math.min(run.combo, RAIN.COMBO_MULT.length - 1) - 1] || 1;
        addScore(run, it.value * mult);
        emit(run, 'hit', { machine: 1, x: it.x, y: it.y, combo: run.combo });
        if (run.combo === 2) emit(run, 'comboUp', { combo: run.combo });
      } else {
        addScore(run, RAIN.HAZARD_SCORE);
        run.lives -= RAIN.HAZARD_LIFE_COST;
        run.combo = 0;
        emit(run, 'badHit', { machine: 1, x: it.x, y: it.y });
        emit(run, 'loseLife', { lives: run.lives });
      }
    } else if (it.y > WORLD.HEIGHT + 30) {
      if (it.kind === 'coin') { run.combo = 0; emit(run, 'miss', { machine: 1, x: it.x }); }
    } else {
      remaining.push(it);
    }
  }
  s.items = remaining;
}

// ---------- 像素蜂群（小蜜蜂） ----------
function stepSwarm(run, input, dt) {
  const s = run.sub;

  // 飞船移动：指针定位优先，键盘次之
  if (input.steerX != null) {
    const d = input.steerX - s.shipX;
    const maxStep = SWARM.SHIP_SPEED * dt;
    s.shipX = clamp(s.shipX + clamp(d, -maxStep, maxStep), 24, WORLD.WIDTH - 24);
  } else if (input.move) {
    s.shipX = clamp(s.shipX + input.move * SWARM.SHIP_SPEED * dt, 24, WORLD.WIDTH - 24);
  }

  // 开火
  s.fireT -= dt;
  if (input.fire && s.fireT <= 0) {
    s.fireT = SWARM.FIRE_COOLDOWN;
    s.bullets.push({ id: run._nextId++, x: s.shipX, y: SWARM.SHIP_Y - 20, dead: false });
    emit(run, 'fire', { machine: 2, x: s.shipX });
  }

  // 蜂群左右移动 + 触边下移
  s.moveT -= dt;
  if (s.moveT <= 0) {
    s.moveT = SWARM.BEE_MOVE_EVERY;
    const alive = s.bees.filter((b) => b.alive);
    let minX = Infinity; let maxX = -Infinity;
    for (const b of alive) { minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x); }
    let down = false;
    if (s.dir > 0 && maxX + SWARM.BEE_STEP_X > WORLD.WIDTH - 40) { s.dir = -1; down = true; }
    else if (s.dir < 0 && minX - SWARM.BEE_STEP_X < 40) { s.dir = 1; down = true; }
    for (const b of alive) {
      b.x += s.dir * SWARM.BEE_STEP_X;
      if (down) b.y += SWARM.BEE_STEP_DOWN;
    }
  }

  // 蜂群开火
  s.shootT -= dt;
  if (s.shootT <= 0) {
    s.shootT = SWARM.BEE_SHOOT_EVERY;
    const alive = s.bees.filter((b) => b.alive);
    if (alive.length) {
      const shooter = alive[Math.floor(run.rng() * alive.length)];
      s.beeBullets.push({ id: run._nextId++, x: shooter.x, y: shooter.y + SWARM.BEE_H / 2, dead: false });
      emit(run, 'spawn', { machine: 2, x: shooter.x, y: shooter.y });
    }
  }

  // 子弹上飞 + 命中蜜蜂
  for (const b of s.bullets) {
    b.y -= SWARM.BULLET_SPEED * dt;
    if (b.y < -20) b.dead = true;
    if (b.dead) continue;
    for (const bee of s.bees) {
      if (!bee.alive) continue;
      if (Math.abs(b.x - bee.x) < SWARM.BEE_W / 2 + SWARM.BULLET_RADIUS
        && Math.abs(b.y - bee.y) < SWARM.BEE_H / 2 + SWARM.BULLET_RADIUS) {
        bee.alive = false;
        b.dead = true;
        addScore(run, SWARM.BEE_HIT_SCORE);
        emit(run, 'hit', { machine: 2, x: bee.x, y: bee.y });
        break;
      }
    }
  }
  s.bullets = s.bullets.filter((b) => !b.dead);

  // 清屏奖励 + 刷新下一波（时间限制内可持续刷分，保证 12 段目标可达）
  if (s.bees.length && s.bees.every((b) => !b.alive)) {
    addScore(run, SWARM.WAVE_CLEAR_BONUS);
    emit(run, 'waveClear', { bonus: SWARM.WAVE_CLEAR_BONUS });
    spawnSwarmWave(run);
  }

  // 蜂群子弹下落 + 击中飞船
  for (const b of s.beeBullets) {
    b.y += SWARM.BEE_BULLET_SPEED * dt;
    if (b.y > WORLD.HEIGHT + 20) b.dead = true;
    if (b.dead) continue;
    if (Math.abs(b.x - s.shipX) < 30 && Math.abs(b.y - SWARM.SHIP_Y) < 24) {
      b.dead = true;
      run.lives -= SWARM.LIFE_COST;
      emit(run, 'badHit', { machine: 2, x: b.x, y: b.y });
      emit(run, 'loseLife', { lives: run.lives });
    }
  }
  s.beeBullets = s.beeBullets.filter((b) => !b.dead);
}

// ---------- 分数 / 里程碑事件 ----------
function addScore(run, delta) {
  if (!delta) return;
  run.score = Math.max(0, run.score + delta);
  const mile = Math.floor(run.score / 50);
  if (mile > run._lastScoreMile) {
    run._lastScoreMile = mile;
    emit(run, 'score', { score: run.score });
  }
}

// ---------- HUD ----------
function getHud(run) {
  const m = run.machine;
  return {
    phase: run.phase,
    machine: m,
    tokens: run.tokens,
    rank: run.rank,
    bestRank: run.stats.bestRank,
    score: run.score,
    target: m == null ? 0 : rankTarget(run.rank, m),
    heat: run.heat,
    heatMult: ECONOMY.HEAT_MULT[run.heat],
    time: run.machineTime,
    timeLimit: m == null ? 0 : MACHINES.DURATION[m],
    lives: run.lives,
    livesMax: m == null ? 0 : MACHINES.LIVES[m],
    combo: run.combo,
    clearedMask: run.clearedMask,
    signLit: run.signLit,
    result: run.result,
  };
}

// ---------- 事件 ----------
function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
