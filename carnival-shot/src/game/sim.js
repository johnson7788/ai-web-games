// CARNIVAL SHOT · 模拟/玩法核心（纯逻辑，零依赖，不碰 DOM/window/localStorage/Date.now）。
// 契约：docs/analysis.md；事件名与 tools/selfplay.mjs、src/core/audio.js 一字不差。
import {
  WORLD, MAGAZINE, COMBO, REWARD, MILESTONE_POINTS, TARGETS, scoreFor, comboMult, clamp,
} from '../../config/gameplay.js';
import { LEVEL_COUNT, levelAt } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { spawnKind, spawnTarget } from './spawner.js';

const STEP = 1 / 60;

// ---------- 创建 run ----------
export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',          // playing | dead | won
    time: 0,
    level: clamp(startLevel, 1, LEVEL_COUNT),
    levelTime: 0,
    timeLimit: 0,
    score: 0,                  // 累计总分（≥0，用于结算/最佳）
    levelScore: 0,             // 本关得分（小鬼灯惩罚可到负）
    combo: 0,
    maxCombo: 0,
    lastHit: -Infinity,
    ammo: MAGAZINE.SIZE,
    reloading: false,
    reloadT: 0,
    reloadDur: MAGAZINE.RELOAD_SEC,
    reloadManual: false,
    quickLoad: false,          // 速装匣 buff：下次换弹减半
    doubleUntil: -Infinity,    // 双倍积分截止时刻
    targets: [],
    events: [],
    nextId: 1,
    _spawnT: 0.5,
    _redDuckTimes: [],
    _redDuckSpawned: 0,
    _lastMilestone: 0,
    stats: { score: 0, maxCombo: 0, levelReached: clamp(startLevel, 1, LEVEL_COUNT), hits: 0, misses: 0, goldenHits: 0, ghostsHit: 0, redDucks: 0 },
  };

  beginLevel(run);
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;
  run.levelTime += dt;
  const level = levelAt(run.level);

  updateReload(run, dt);          // 1 换弹计时
  updateSpawn(run, level, dt);    // 2 生成目标（含红灯鸭排程）
  updateTargets(run, dt);         // 3 目标运动 / 生命周期
  updateComboWindow(run);         // 4 连击窗口超时
  handleInput(run, input, level); // 5 射击 / 主动换弹
  updateDouble(run);              // 6 双倍窗口结束
  checkLevelEnd(run, level);      // 7 关卡结算

  run.stats.score = run.score;
  run.stats.maxCombo = run.maxCombo;
  run.stats.levelReached = Math.max(run.stats.levelReached, run.level);
}

// ---------- 关卡初始化 ----------
function beginLevel(run) {
  const level = levelAt(run.level);
  run.levelTime = 0;
  run.timeLimit = level.time;
  run.levelScore = 0;
  run.targets = [];
  run._spawnT = 0.5;
  run._redDuckTimes = [0.2, 0.5, 0.8].map((f) => level.time * f);
  run._redDuckSpawned = 0;
  emit(run, 'levelStart', { level: run.level, scene: level.scene });
}

// ---------- 换弹 ----------
function startReload(run, manual) {
  if (run.reloading) return;
  run.reloading = true;
  run.reloadManual = manual;
  const quick = run.quickLoad;
  run.quickLoad = false; // 消费速装匣
  run.reloadDur = quick ? MAGAZINE.QUICK_RELOAD_SEC : MAGAZINE.RELOAD_SEC;
  run.reloadT = run.reloadDur;
  emit(run, 'reloadStart', { quick, manual });
}

function updateReload(run, dt) {
  if (!run.reloading) return;
  run.reloadT -= dt;
  if (run.reloadT <= 0) {
    run.reloading = false;
    run.ammo = MAGAZINE.SIZE;
    if (run.reloadManual) run.quickLoad = true; // 主动换弹 → 装速装匣
    run.reloadManual = false;
    emit(run, 'reloadDone', { quickLoad: run.quickLoad });
  }
}

// ---------- 生成 ----------
function updateSpawn(run, level, dt) {
  while (run._redDuckSpawned < run._redDuckTimes.length && run.levelTime >= run._redDuckTimes[run._redDuckSpawned]) {
    const e = spawnTarget('red', level, run.rng);
    e.id = run.nextId++;
    e.bornAt = run.time;
    run.targets.push(e);
    emit(run, 'targetSpawn', { kind: 'red', x: e.x, y: e.y });
    run._redDuckSpawned += 1;
  }

  run._spawnT -= dt;
  if (run._spawnT <= 0) {
    const kind = spawnKind(run.rng, level);
    const e = spawnTarget(kind, level, run.rng);
    e.id = run.nextId++;
    e.bornAt = run.time;
    run.targets.push(e);
    emit(run, 'targetSpawn', { kind, x: e.x, y: e.y });
    run._spawnT = level.spawnInterval;
  }
}

// ---------- 目标运动 ----------
function updateTargets(run, dt) {
  const remaining = [];
  for (const t of run.targets) {
    if (t.dead) continue;
    t.life -= dt;
    if (t.fly === 'slide') {
      t.x += t.vx * dt;
      if (t.x < t.r) { t.x = t.r; t.vx = Math.abs(t.vx); }
      else if (t.x > WORLD.WIDTH - t.r) { t.x = WORLD.WIDTH - t.r; t.vx = -Math.abs(t.vx); }
    } else {
      t.x += t.vx * dt;
      t.y += t.vy * dt;
    }
    const off = t.x < -130 || t.x > WORLD.WIDTH + 130 || t.y < -130 || t.y > WORLD.HEIGHT + 130;
    if (t.life <= 0 || off) continue;
    remaining.push(t);
  }
  run.targets = remaining;
}

// ---------- 连击窗口 ----------
function updateComboWindow(run) {
  if (run.combo > 0 && run.time - run.lastHit > COMBO.WINDOW_SEC) {
    run.combo = 0;
    run.lastHit = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

// ---------- 输入 ----------
function handleInput(run, input, level) {
  if (input.reload && !run.reloading && run.ammo < MAGAZINE.SIZE) {
    startReload(run, true);
  }
  if (input.shoot && typeof input.shoot === 'object') {
    fire(run, clamp(input.shoot.x ?? 0, 0, WORLD.WIDTH), clamp(input.shoot.y ?? 0, 0, WORLD.HEIGHT));
  }
}

// ---------- 射击 / 命中判定 ----------
function fire(run, x, y) {
  if (run.reloading || run.ammo <= 0) return;
  run.ammo -= 1;
  emit(run, 'shot', { x, y, ammo: run.ammo });
  if (run.ammo <= 0) startReload(run, false);

  let best = null;
  let bestD = Infinity;
  for (const t of run.targets) {
    if (t.dead) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= t.r && d < bestD) { bestD = d; best = t; }
  }

  if (!best) {
    // nearMiss：擦肩（差一点命中）→ 反馈钩子
    let nmD = Infinity;
    for (const t of run.targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= t.r + 22 && d < nmD) nmD = d;
    }
    if (nmD < Infinity) emit(run, 'nearMiss', { x, y });
    if (run.combo > 0) {
      run.combo = 0;
      run.lastHit = -Infinity;
      emit(run, 'comboBreak', {});
    }
    run.stats.misses += 1;
    emit(run, 'miss', { x, y });
    return;
  }

  resolveHit(run, best, x, y);
}

function resolveHit(run, t, x, y) {
  t.dead = true;
  const doubled = run.time < run.doubleUntil;
  const kind = t.kind;

  // 小鬼灯：扣分 + 清连击
  if (kind === 'ghost') {
    const penalty = Math.abs(TARGETS.ghost.score);
    run.score = Math.max(0, run.score - penalty);
    run.levelScore -= penalty;
    run.stats.ghostsHit += 1;
    if (run.combo > 0) {
      run.combo = 0;
      run.lastHit = -Infinity;
      emit(run, 'comboBreak', {});
    }
    emit(run, 'ghostHit', { x, y, penalty });
    updateMilestone(run);
    return;
  }

  // 红灯鸭：0 分但触发轮盘奖励
  if (kind === 'red') {
    onComboIncrement(run);
    run.stats.redDucks += 1;
    emit(run, 'redDuckHit', { x, y });
    grantReward(run);
    maybeLanternRain(run);
    return;
  }

  // 普通命中：加分 + 连击
  onComboIncrement(run);
  const pts = scoreFor(kind, run.combo, doubled);
  run.score += pts;
  run.levelScore += pts;
  run.stats.hits += 1;
  if (kind === 'golden') run.stats.goldenHits += 1;
  emit(run, kind === 'golden' ? 'goldenHit' : 'hit', { x, y, kind, points: pts, combo: run.combo });
  maybeLanternRain(run);
  updateMilestone(run);
}

function onComboIncrement(run) {
  run.combo += 1;
  run.lastHit = run.time;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
}

function maybeLanternRain(run) {
  if (run.combo > 0 && run.combo % COMBO.RAIN_STEP === 0) {
    run.score += COMBO.RAIN_BONUS;
    run.levelScore += COMBO.RAIN_BONUS;
    emit(run, 'lanternRain', { bonus: COMBO.RAIN_BONUS, combo: run.combo });
    updateMilestone(run);
  }
}

// ---------- 红灯鸭轮盘奖励 ----------
function grantReward(run) {
  const r = run.rng();
  const kinds = ['double', 'addTime', 'fullAmmo'];
  const w = REWARD.WEIGHTS;
  let acc = 0;
  let idx = w.length - 1;
  for (let i = 0; i < w.length; i += 1) {
    acc += w[i];
    if (r <= acc) { idx = i; break; }
  }
  const kind = kinds[idx];
  if (kind === 'double') run.doubleUntil = run.time + REWARD.DOUBLE_SEC;
  else if (kind === 'addTime') run.timeLimit += REWARD.ADD_TIME_SEC;
  else if (kind === 'fullAmmo') { run.ammo = MAGAZINE.SIZE; run.reloading = false; run.reloadManual = false; }
  emit(run, 'reward', { kind });
}

// ---------- 双倍窗口 ----------
function updateDouble(run) {
  if (run.doubleUntil > -Infinity && run.time >= run.doubleUntil) {
    run.doubleUntil = -Infinity;
    emit(run, 'doubleEnd', {});
  }
}

// ---------- 关卡结算 ----------
function checkLevelEnd(run, level) {
  if (run.levelTime < run.timeLimit) return;
  if (run.levelScore >= level.targetScore) {
    if (run.level >= LEVEL_COUNT) {
      run.phase = 'won';
      emit(run, 'gameWin', { level: run.level, score: run.score });
    } else {
      emit(run, 'levelClear', { level: run.level, score: run.score });
      run.level += 1;
      beginLevel(run);
    }
  } else {
    run.phase = 'dead';
    emit(run, 'levelFail', { level: run.level, score: run.score, levelScore: run.levelScore });
  }
}

// ---------- 里程碑 ----------
function updateMilestone(run) {
  const m = Math.floor(run.score / MILESTONE_POINTS);
  if (m > run._lastMilestone) {
    run._lastMilestone = m;
    emit(run, 'milestone', { score: run.score });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const level = levelAt(run.level);
  return {
    phase: run.phase,
    score: run.score,
    levelScore: run.levelScore,
    level: run.level,
    levelName: `level.${run.level}`,
    scene: level.scene,
    targetScore: level.targetScore,
    timeLeft: Math.max(0, run.timeLimit - run.levelTime),
    ammo: run.ammo,
    magSize: MAGAZINE.SIZE,
    reloading: run.reloading,
    reloadProgress: run.reloading ? 1 - run.reloadT / (run.reloadDur || MAGAZINE.RELOAD_SEC) : 0,
    quickLoad: run.quickLoad,
    combo: run.combo,
    doubleActive: run.time < run.doubleUntil,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
