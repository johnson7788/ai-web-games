// CROW BLASTER · 模拟/玩法核心（纯逻辑，零依赖，不碰 DOM/window/localStorage/Date.now）。
// 契约：docs/batch3/crow-blaster.md；事件名与 tools/selfplay.mjs、src/core/audio.js 一字不差。
import { WORLD } from '../../config/game.config.js';
import {
  LAUNCHER, BOLT, COMBO, GHOST_PENALTY, GOLDEN_AMMO_BONUS,
  CROWS, MAX_ON_SCREEN, clampAim, comboMult, scoreFor, starsFor,
} from '../../config/gameplay.js';
import { LEVEL_COUNT, levelAt } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { spawnKind, spawnCrow } from './spawner.js';

const STEP = 1 / 60;

// ---------- 创建 run ----------
export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',          // playing | dead | won
    time: 0,                   // 全局游戏时间
    level: Math.max(1, Math.min(LEVEL_COUNT, startLevel)),
    levelTime: 0,
    timeLimit: 0,
    score: 0,                  // 累计总分
    levelScore: 0,             // 本关得分
    stars: 0,                  // 累计星级
    combo: 0,
    maxCombo: 0,
    lastHit: -Infinity,
    ammo: 0,
    aim: 0,                    // 从竖直方向的角度（度），右正左负
    cooldownT: 0,
    crows: [],                 // 在屏幕上的乌鸦
    pending: [],               // 等待生成的乌鸦队列（{kind, hp, maxHp}）
    crowsRemaining: 0,         // 本关尚未击杀的乌鸦数
    levelCrowTotal: 0,
    levelShots: 0,
    levelHits: 0,
    bolts: [],
    events: [],
    nextId: 1,
    _spawnT: 0.6,
    stats: {
      score: 0, maxCombo: 0, levelReached: 1,
      shots: 0, hits: 0, kills: 0, misses: 0, goldenHits: 0, ghostsHit: 0,
    },
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

  updateComboWindow(run);        // 1 连击窗口超时
  updateSpawn(run, level, dt);   // 2 生成乌鸦
  updateCrows(run, dt);          // 3 乌鸦运动 / 逃逸重排
  handleInput(run, input);       // 4 瞄准 / 发射
  updateBolts(run, dt);          // 5 能量弹运动 / 命中
  if (run.cooldownT > 0) run.cooldownT -= dt; // 6 冷却
  checkLevelEnd(run, level);     // 7 关卡结算

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
  run.ammo = level.ammo;
  run.cooldownT = 0;
  run.crows = [];
  run.bolts = [];
  run.pending = [];
  run.levelShots = 0;
  run.levelHits = 0;
  run._spawnT = 0.6;
  for (let i = 0; i < level.crowCount; i += 1) {
    const kind = spawnKind(run.rng, level);
    const c = CROWS[kind] || CROWS.scout;
    run.pending.push({ kind, hp: c.hp, maxHp: c.hp });
  }
  run.crowsRemaining = level.crowCount;
  run.levelCrowTotal = level.crowCount;
  emit(run, 'levelStart', { level: run.level, nameKey: level.nameKey });
}

// ---------- 连击 ----------
function updateComboWindow(run) {
  if (run.combo > 0 && run.time - run.lastHit > COMBO.WINDOW_SEC) {
    resetCombo(run);
  }
}

function onComboIncrement(run) {
  run.combo += 1;
  run.lastHit = run.time;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
}

function resetCombo(run) {
  if (run.combo > 0) {
    run.combo = 0;
    run.lastHit = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

// ---------- 生成 ----------
function updateSpawn(run, level, dt) {
  run._spawnT -= dt;
  if (run._spawnT > 0) return;
  run._spawnT = level.spawnInterval;

  // 必打乌鸦
  if (run.crows.length < MAX_ON_SCREEN && run.pending.length > 0) {
    const p = run.pending.shift();
    const c = spawnCrow(p.kind, level, run.rng);
    c.hp = p.hp;
    c.maxHp = p.maxHp;
    c.id = run.nextId++;
    c.bornAt = run.time;
    c.decoy = false;
    run.crows.push(c);
    emit(run, 'targetSpawn', { kind: c.kind, x: c.x, y: c.y });
  }

  // 鬼鸦诱饵（不打也不算必打目标，误打扣分）
  const ghostChance = level.ghostChance || 0;
  if (ghostChance > 0 && run.rng() < ghostChance) {
    const decoys = run.crows.filter((c) => c.decoy && !c.dead).length;
    if (decoys < 1 && run.crows.length < MAX_ON_SCREEN + 1) {
      const g = spawnCrow('ghost', level, run.rng);
      g.decoy = true;
      g.id = run.nextId++;
      g.bornAt = run.time;
      run.crows.push(g);
      emit(run, 'targetSpawn', { kind: 'ghost', x: g.x, y: g.y });
    }
  }
}

// ---------- 乌鸦运动 ----------
function updateCrows(run, dt) {
  const remaining = [];
  for (const crow of run.crows) {
    if (crow.dead) continue;
    crow.x += crow.vx * dt;
    crow.y += crow.vy * dt;
    const off = crow.x < -150 || crow.x > WORLD.WIDTH + 150 || crow.y < -150 || crow.y > WORLD.HEIGHT + 150;
    if (off) {
      if (!crow.decoy) {
        // 逃逸：重新排回队列（HP 保留）
        run.pending.push({ kind: crow.kind, hp: crow.hp, maxHp: crow.maxHp });
      }
      crow.dead = true;
      emit(run, 'crowEscaped', { kind: crow.kind });
      continue;
    }
    remaining.push(crow);
  }
  run.crows = remaining;
}

// ---------- 输入 / 发射 ----------
function handleInput(run, input) {
  if (input.aim != null && Number.isFinite(input.aim)) run.aim = clampAim(input.aim);
  if (input.shoot) fire(run);
}

function fire(run) {
  if (run.cooldownT > 0 || run.ammo <= 0) return;
  run.ammo -= 1;
  run.levelShots += 1;
  run.stats.shots += 1;
  const rad = run.aim * Math.PI / 180;
  const vx = BOLT.SPEED * Math.sin(rad);
  const vy = -BOLT.SPEED * Math.cos(rad);
  run.bolts.push({
    x: LAUNCHER.X, y: LAUNCHER.Y - 10, vx, vy, r: BOLT.R, life: BOLT.MAX_LIFE, dead: false,
  });
  run.cooldownT = LAUNCHER.COOLDOWN;
  emit(run, 'shot', { aim: run.aim, ammo: run.ammo, x: LAUNCHER.X, y: LAUNCHER.Y });
}

// ---------- 能量弹运动 / 命中 ----------
function updateBolts(run, dt) {
  const remaining = [];
  for (const bolt of run.bolts) {
    if (bolt.dead) continue;
    bolt.vy += BOLT.GRAVITY * dt;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;

    // 命中判定
    let hitCrow = null;
    for (const crow of run.crows) {
      if (crow.dead) continue;
      const d = Math.hypot(crow.x - bolt.x, crow.y - bolt.y);
      if (d <= crow.r + bolt.r) { hitCrow = crow; break; }
    }

    if (hitCrow) {
      bolt.dead = true;
      damageCrow(run, hitCrow);
      continue;
    }

    const off = bolt.x < -60 || bolt.x > WORLD.WIDTH + 60 || bolt.y < -60 || bolt.y > WORLD.HEIGHT + 60 || bolt.life <= 0;
    if (off) {
      bolt.dead = true;
      onBoltMiss(run, bolt);
      continue;
    }
    remaining.push(bolt);
  }
  run.bolts = remaining;
}

function onBoltMiss(run, bolt) {
  // nearMiss：擦肩（差一点命中）→ 反馈钩子，不清连击
  let nmD = Infinity;
  for (const crow of run.crows) {
    if (crow.dead) continue;
    const d = Math.hypot(crow.x - bolt.x, crow.y - bolt.y);
    if (d <= crow.r + 30 && d < nmD) nmD = d;
  }
  if (nmD < Infinity) {
    emit(run, 'nearMiss', { x: bolt.x, y: bolt.y });
  } else {
    run.stats.misses += 1;
    resetCombo(run);
    emit(run, 'miss', { x: bolt.x, y: bolt.y });
  }
}

function damageCrow(run, crow) {
  const kind = crow.kind;
  run.levelHits += 1;
  run.stats.hits += 1;

  if (kind === 'ghost') {
    run.score = Math.max(0, run.score - GHOST_PENALTY);
    run.stats.ghostsHit += 1;
    resetCombo(run);
    emit(run, 'ghostHit', { x: crow.x, y: crow.y, penalty: GHOST_PENALTY });
  } else {
    onComboIncrement(run);
    if (kind === 'golden') {
      run.ammo += GOLDEN_AMMO_BONUS;
      run.stats.goldenHits += 1;
      emit(run, 'goldenHit', { x: crow.x, y: crow.y, bonus: GOLDEN_AMMO_BONUS, combo: run.combo });
    } else if (kind === 'tank') {
      emit(run, 'tankHit', { x: crow.x, y: crow.y, hpLeft: crow.hp - 1, combo: run.combo });
    } else {
      emit(run, 'hit', { x: crow.x, y: crow.y, kind, combo: run.combo });
    }
  }

  crow.hp -= 1;
  if (crow.hp <= 0) killCrow(run, crow);
}

function killCrow(run, crow) {
  crow.dead = true;
  if (!crow.decoy) {
    run.crowsRemaining -= 1;
    run.stats.kills += 1;
  }
  let pts = 0;
  if (crow.kind !== 'ghost') {
    pts = scoreFor(crow.kind, run.combo);
    run.score += pts;
    run.levelScore += pts;
  }
  emit(run, 'kill', { kind: crow.kind, x: crow.x, y: crow.y, points: pts, combo: run.combo });
}

// ---------- 关卡结算 ----------
function checkLevelEnd(run, level) {
  if (run.crowsRemaining <= 0) {
    const acc = run.levelShots > 0 ? run.levelHits / run.levelShots : 0;
    const stars = starsFor(acc);
    run.stars += stars;
    if (run.level >= LEVEL_COUNT) {
      run.phase = 'won';
      emit(run, 'gameWin', { level: run.level, score: run.score, stars: run.stars });
    } else {
      emit(run, 'levelClear', { level: run.level, stars, accuracy: acc, score: run.score });
      run.level += 1;
      beginLevel(run);
    }
  } else if (run.levelTime >= run.timeLimit || (run.ammo <= 0 && run.crowsRemaining > 0)) {
    run.phase = 'dead';
    emit(run, 'levelFail', { level: run.level, score: run.score, crowsRemaining: run.crowsRemaining });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const level = levelAt(run.level);
  return {
    phase: run.phase,
    score: run.score,
    level: run.level,
    levelName: level.nameKey,
    timeLeft: Math.max(0, run.timeLimit - run.levelTime),
    ammo: run.ammo,
    crowsRemaining: run.crowsRemaining,
    crowsTotal: run.levelCrowTotal,
    combo: run.combo,
    aim: run.aim,
    stars: run.stars,
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
