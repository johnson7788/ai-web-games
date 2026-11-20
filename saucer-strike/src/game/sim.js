// SAUCER STRIKE · 模拟/玩法核心（纯逻辑，零依赖）
// 契约：docs/analysis.md（规则还原）+ 下方事件表。
// createRun({seed}) → run；run.step(input) 推进 1/60s；run.getHud()；run.drainEvents()；run.chooseUpgrade(i)。
//
// 事件表（谁发谁消费）：waveStart / saucerEnter / shot / hit / kill / escape / overheat /
//   overheatEnd / tracerFired / reveal / meteor / meteorBlock / upgrade / nearMiss / lifeLost /
//   death / win / signature / comboUp / comboBreak / chapterEnter / milestone。
// 输入契约：{ aimX, aimY, charging, fire, tracer }。fire/tracer 为「本 tick 的边沿」。

import {
  WORLD, STEP, GUN, PLAYER, COMBO, TRACER, NEAR_MISS, METEOR, PROJ, SPAWN, UPGRADES, UPGRADE_POOL, MILESTONE,
  clamp, dist, comboMult,
} from '../../config/gameplay.js';
import { WAVES, WAVE_COUNT, SAUCER_TYPES, chapterOf } from '../../config/levels.js';
import { mulberry32, pick } from './rng.js';
import { buildPath } from './spawner.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',      // playing | dead | won
    time: 0,
    wave: 0,               // 当前波（1-based；0 = 未开始）
    chapter: 1,
    lives: PLAYER.START_LIVES,
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastHit: -Infinity,
    nearMissAt: -Infinity,
    gun: { charge: 0, heat: 0, lockUntil: 0, cooldownUntil: 0 },
    aim: { x: WORLD.CANNON_X, y: WORLD.CANNON_Y - 200, active: false },
    lastAngle: -Math.PI / 2,
    saucers: [],
    projectiles: [],
    meteors: [],
    tracers: [],
    tracersLeft: 0,
    tracerActive: false,
    tracerUntil: 0,
    waveSaucers: 0,        // 当前波未击毁 + 未逃逸的碟数
    waveActive: false,
    meteorTimer: 0,
    pendingUpgrade: false,
    upgradeOffers: [],
    upgrades: {},          // id -> true
    shield: 0,             // comboBank 护盾（挡一次漏碟）
    nextId: 1,
    _lastMile: 0,
    stats: {
      score: 0, shots: 0, hits: 0, kills: 0, maxCombo: 0, escapes: 0,
      nearMisses: 0, wavesCleared: 0, waveReached: 0,
    },
    events: [],
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.chooseUpgrade = (i) => chooseUpgrade(run, i);

  startWave(run, 1);
  return run;
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  // 1 输入 → 瞄准/蓄力
  if (input.charging) {
    const ax = clamp(input.aimX ?? run.aim.x, 0, WORLD.WIDTH);
    const ay = clamp(input.aimY ?? run.aim.y, 0, WORLD.HEIGHT);
    run.aim.x = ax;
    run.aim.y = ay;
    run.aim.active = true;
    const d = dist(GUN.MUZZLE_X, GUN.MUZZLE_Y, ax, ay);
    if (d > 12) run.lastAngle = Math.atan2(ay - GUN.MUZZLE_Y, ax - GUN.MUZZLE_X);
    run.gun.charge = clamp(d / GUN.MAX_POWER_DIST, 0, 1);
  } else {
    run.aim.active = false;
  }

  // 2 炮台状态（过热解锁 / 热量回落）
  if (run.gun.lockUntil > 0 && run.time >= run.gun.lockUntil) {
    run.gun.lockUntil = 0;
    run.gun.heat = 0;
    emit(run, 'overheatEnd', {});
  }
  if (run.gun.lockUntil === 0) {
    run.gun.heat = Math.max(0, run.gun.heat - GUN.OVERHEAT_LOCK_SEC * 0.6 * coolMult(run) * dt);
  }

  // 3 开火 / 曳光
  if (input.fire) tryFire(run);
  if (input.tracer) tryTracer(run);

  // 4 更新炮弹 / 曳光弹 / 碟 / 流星
  updateProjectiles(run, dt);
  updateTracers(run, dt);
  updateSaucers(run, dt);
  updateMeteors(run, dt);

  // 5 波内流星生成
  if (run.waveActive) spawnMeteors(run, dt);

  // 6 波次推进判定
  checkWaveComplete(run);

  // 7 分数里程碑（事件密度）
  const mile = Math.floor(run.score / MILESTONE.SCORE_STEP);
  if (mile > run._lastMile) {
    run._lastMile = mile;
    emit(run, 'milestone', { score: run.score });
  }

  // 8 连击窗口超时
  if (run.combo > 0 && run.time - run.lastHit > COMBO.WINDOW) {
    run.combo = 0;
    run.lastHit = -Infinity;
    emit(run, 'comboBreak', {});
  }

  // 9 清理飞出界的实体
  cull(run);

  run.stats.score = run.score;
  run.stats.maxCombo = run.maxCombo;
}

// ---------- 波次 ----------
function startWave(run, waveIndex) {
  run.wave = waveIndex;
  run.waveActive = true;
  run.pendingUpgrade = false;
  run.upgradeOffers = [];
  const spec = WAVES[waveIndex - 1];
  const chapter = spec.chapter;
  if (chapter !== run.chapter) {
    run.chapter = chapter;
    emit(run, 'chapterEnter', { chapter });
  }
  run.tracersLeft = tracerPerWave(run);
  run.meteorTimer = 0;
  if (waveIndex > run.stats.waveReached) run.stats.waveReached = waveIndex;

  // 生成碟（错峰入场：path[0].hold = i*STAGGER）
  let count = 0;
  spec.saucers.forEach((typeId, i) => {
    const type = SAUCER_TYPES[typeId];
    const path = buildPath(run.rng, type.path);
    path[0].hold = (path[0].hold || 0) + i * SPAWN.STAGGER_SEC;
    run.saucers.push({
      id: run.nextId++,
      type: typeId,
      hp: type.hp,
      maxHp: type.hp,
      score: type.score,
      radius: type.radius,
      speed: type.speed,
      color: type.color,
      invisible: type.invisible,
      path,
      wayIndex: 0,
      wayHold: 0,
      x: path[0].x,
      y: path[0].y,
      active: false,
    });
    count += 1;
  });
  run.waveSaucers = count;
  emit(run, 'waveStart', { wave: waveIndex });
}

function checkWaveComplete(run) {
  if (!run.waveActive) return;
  if (run.saucers.length > 0 || run.waveSaucers > 0) return;

  run.waveActive = false;
  emit(run, 'waveCleared', { wave: run.wave });
  run.stats.wavesCleared = run.wave;

  if (run.wave >= WAVE_COUNT) {
    run.phase = 'won';
    emit(run, 'win', { score: run.score, wave: run.wave });
    return;
  }

  // 3 选 1 升级
  run.upgradeOffers = rollUpgrades(run);
  run.pendingUpgrade = true;
}

function rollUpgrades(run) {
  const owned = run.upgrades;
  const available = UPGRADE_POOL.filter((id) => !owned[id]);
  // 简单洗牌：从 available 里挑 3 个不重复
  const result = [];
  const bag = available.slice();
  while (result.length < 3 && bag.length > 0) {
    const i = Math.floor(run.rng() * bag.length);
    result.push(bag.splice(i, 1)[0]);
  }
  // 极端情况：池子不足 3 个（几乎不可能，兜底）
  while (result.length < 3) result.push('damage');
  return result;
}

function chooseUpgrade(run, i) {
  if (!run.pendingUpgrade) return false;
  const id = run.upgradeOffers[clamp(i, 0, run.upgradeOffers.length - 1)];
  if (!id) return false;
  run.upgrades[id] = true;
  if (id === 'lives') run.lives = Math.min(PLAYER.MAX_LIVES, run.lives + UPGRADES.lives.extraLives);
  if (id === 'comboBank' && run.combo >= UPGRADES.comboBank.shieldOnCombo) run.shield = 1;
  emit(run, 'upgrade', { id });
  run.pendingUpgrade = false;
  startWave(run, run.wave + 1);
  return true;
}

// ---------- 开火 ----------
function tryFire(run) {
  if (run.time < run.gun.lockUntil) return;      // 过热锁炮
  if (run.time < run.gun.cooldownUntil) return;  // 冷却
  const power = clamp(run.gun.charge, 0, 1);
  const angle = run.aim.active ? run.lastAngle : -Math.PI / 2;
  const speed = GUN.MIN_SPEED + power * (GUN.MAX_SPEED - GUN.MIN_SPEED);
  const damage = (GUN.BASE_DAMAGE + power * powerDamageBonus(run)) * damageMult(run);
  const fullCharge = power >= overheatThreshold(run);

  run.projectiles.push({
    id: run.nextId++,
    x: GUN.MUZZLE_X,
    y: GUN.MUZZLE_Y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    power,
    fullCharge,
    pierceLeft: run.upgrades.pierce ? UPGRADES.pierce.pierce : 0,
    split: run.upgrades.split ? UPGRADES.split.split : 0,
    magnet: run.upgrades.magnet ? 1 : 0,
    life: PROJ.LIFE,
    nearMissed: new Set(),
  });

  run.gun.cooldownUntil = run.time + GUN.COOLDOWN_SEC * (run.upgrades.rapid ? UPGRADES.rapid.cooldownMult : 1);
  run.stats.shots += 1;
  emit(run, 'shot', { power, angle, x: GUN.MUZZLE_X, y: GUN.MUZZLE_Y });

  if (fullCharge) {
    run.gun.lockUntil = run.time + overheatLockSec(run);
    run.gun.heat = 1;
    emit(run, 'overheat', {});
  }
}

function tryTracer(run) {
  if (run.tracersLeft <= 0) return;
  if (run.tracerActive) return;
  run.tracersLeft -= 1;
  // 曳光弹 = 自寻最近碟的发光弹；命中即显形（保证 1 发 1 效果，用于隐形碟波）
  const target = nearestSaucer(run, GUN.MUZZLE_X, GUN.MUZZLE_Y, { includeInvisible: true });
  const angle = target ? Math.atan2(target.y - GUN.MUZZLE_Y, target.x - GUN.MUZZLE_X) : -Math.PI / 2;
  run.tracers.push({
    id: run.nextId++,
    x: GUN.MUZZLE_X,
    y: GUN.MUZZLE_Y,
    vx: Math.cos(angle) * TRACER.HOMING_SPEED,
    vy: Math.sin(angle) * TRACER.HOMING_SPEED,
    targetId: target ? target.id : null,
    life: 3.0,
  });
  emit(run, 'tracerFired', {});
}

function reveal(run) {
  run.tracerActive = true;
  run.tracerUntil = run.time + tracerRevealSec(run);
  emit(run, 'reveal', { duration: tracerRevealSec(run) });
}

// ---------- 炮弹更新 ----------
function updateProjectiles(run, dt) {
  const keep = [];
  for (const p of run.projectiles) {
    p.life -= dt;
    if (p.life <= 0) continue;

    // 追踪：轻微转向最近碟
    if (p.magnet) {
      const t = nearestSaucer(run, p.x, p.y, { includeInvisible: true });
      if (t) {
        const cur = Math.atan2(p.vy, p.vx);
        const want = Math.atan2(t.y - p.y, t.x - p.x);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + clamp(d, -PROJ.MAGNET_TURN * dt, PROJ.MAGNET_TURN * dt);
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(na) * sp;
        p.vy = Math.sin(na) * sp;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // 与流星碰撞（挡弹）
    let blocked = false;
    for (const m of run.meteors) {
      if (dist(p.x, p.y, m.x, m.y) < METEOR.RADIUS + PROJ.RADIUS) {
        blocked = true;
        emit(run, 'meteorBlock', { x: m.x, y: m.y });
        break;
      }
    }
    if (blocked) continue;

    // 与碟碰撞
    let dead = false;
    for (const s of run.saucers) {
      if (!s.active) continue;
      const d = dist(p.x, p.y, s.x, s.y);
      if (d < s.radius + PROJ.RADIUS) {
        hitSaucer(run, s, p);
        if (p.pierceLeft > 0) {
          p.pierceLeft -= 1;
        } else if (p.split > 0) {
          spawnSplit(run, p);
          dead = true;
        } else {
          dead = true;
        }
        break;
      }
      // 近失：擦肩而过未命中
      if (d < s.radius + NEAR_MISS.GAP && !p.nearMissed.has(s.id)) {
        p.nearMissed.add(s.id);
        maybeNearMiss(run, p.x, p.y);
      }
    }
    if (dead) continue;

    // 出界移除
    if (p.x < -100 || p.x > WORLD.WIDTH + 100 || p.y < -100 || p.y > WORLD.HEIGHT + 100) continue;
    keep.push(p);
  }
  run.projectiles = keep;
}

function spawnSplit(run, p) {
  const base = Math.atan2(p.vy, p.vx);
  for (const off of [-0.5, 0.5]) {
    const a = base + off;
    run.projectiles.push({
      id: run.nextId++,
      x: p.x, y: p.y,
      vx: Math.cos(a) * PROJ.SPLIT_SPEED,
      vy: Math.sin(a) * PROJ.SPLIT_SPEED,
      damage: p.damage * 0.6,
      power: p.power,
      fullCharge: false,
      pierceLeft: 0,
      split: 0,
      magnet: 0,
      life: PROJ.LIFE,
      nearMissed: new Set(),
    });
  }
}

function hitSaucer(run, s, p) {
  s.hp -= p.damage;
  run.stats.hits += 1;
  run.combo = (run.time - run.lastHit <= COMBO.WINDOW) ? run.combo + 1 : 1;
  run.lastHit = run.time;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  emit(run, 'hit', { x: s.x, y: s.y, saucer: s.type, combo: run.combo });
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });

  if (s.hp <= 0) {
    killSaucer(run, s);
    // 签名瞬间：满蓄命中母碟
    if (s.type === 'mother' && p.fullCharge) {
      emit(run, 'signature', { x: s.x, y: s.y });
    }
  }
}

function killSaucer(run, s) {
  s.hp = 0;
  const mult = comboMult(run.combo);
  const gained = Math.round(s.score * mult);
  run.score += gained;
  run.stats.kills += 1;
  if (run.waveSaucers > 0) run.waveSaucers -= 1;
  emit(run, 'kill', { x: s.x, y: s.y, saucer: s.type, score: gained, combo: run.combo });
  // comboBank：连击达标存护盾
  if (run.upgrades.comboBank && run.combo >= UPGRADES.comboBank.shieldOnCombo) {
    run.shield = Math.max(run.shield, 1);
  }
  run.saucers = run.saucers.filter((o) => o.id !== s.id);
}

function maybeNearMiss(run, x, y) {
  if (run.time - run.nearMissAt < NEAR_MISS.THROTTLE) return;
  run.nearMissAt = run.time;
  run.stats.nearMisses += 1;
  run.score += NEAR_MISS.BONUS;
  emit(run, 'nearMiss', { x, y, bonus: NEAR_MISS.BONUS });
}

// ---------- 曳光弹更新 ----------
function updateTracers(run, dt) {
  const keep = [];
  for (const tr of run.tracers) {
    tr.life -= dt;
    if (tr.life <= 0) { reveal(run); continue; }
    // 自寻
    if (tr.targetId != null) {
      const t = run.saucers.find((s) => s.id === tr.targetId);
      if (t) {
        const want = Math.atan2(t.y - tr.y, t.x - tr.x);
        const cur = Math.atan2(tr.vy, tr.vx);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + clamp(d, -8 * dt, 8 * dt);
        const sp = TRACER.HOMING_SPEED;
        tr.vx = Math.cos(na) * sp;
        tr.vy = Math.sin(na) * sp;
      }
    }
    tr.x += tr.vx * dt;
    tr.y += tr.vy * dt;
    // 命中任一碟 → 显形
    let hit = false;
    for (const s of run.saucers) {
      if (s.active && dist(tr.x, tr.y, s.x, s.y) < s.radius + 8) {
        reveal(run);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    if (tr.x < -200 || tr.x > WORLD.WIDTH + 200 || tr.y < -200 || tr.y > WORLD.HEIGHT + 200) {
      reveal(run); // 出界也显形（保证不浪费）
      continue;
    }
    keep.push(tr);
  }
  run.tracers = keep;
  if (run.tracerActive && run.time >= run.tracerUntil) run.tracerActive = false;
}

// ---------- 碟更新 ----------
function updateSaucers(run, dt) {
  for (const s of run.saucers) {
    // 入场延迟（path[0].hold）
    if (!s.active) {
      const hold = s.path[0].hold || 0;
      s.wayHold += dt;
      if (s.wayHold < hold) continue;
      s.active = true;
      s.wayHold = 0;
      emit(run, 'saucerEnter', { saucer: s.type, id: s.id });
    }

    // 悬停点 / 移动
    if (s.wayHold > 0) {
      s.wayHold -= dt;
      continue;
    }
    const next = s.path[s.wayIndex + 1];
    if (!next) {
      escapeSaucer(run, s);
      continue;
    }
    const dx = next.x - s.x;
    const dy = next.y - s.y;
    const d = Math.hypot(dx, dy);
    const stepLen = s.speed * dt;
    if (d <= stepLen) {
      s.x = next.x;
      s.y = next.y;
      s.wayIndex += 1;
      s.wayHold = next.hold || 0;
    } else {
      s.x += (dx / d) * stepLen;
      s.y += (dy / d) * stepLen;
    }

    // 安全兜底：飞出边界即逃逸
    if (s.x < -SPAWN.ESCAPE_MARGIN - 60 || s.x > WORLD.WIDTH + SPAWN.ESCAPE_MARGIN + 60
        || s.y < -SPAWN.ESCAPE_MARGIN - 60 || s.y > WORLD.HEIGHT + SPAWN.ESCAPE_MARGIN + 60) {
      if (s.wayIndex >= s.path.length - 1) escapeSaucer(run, s);
    }
  }
  run.saucers = run.saucers.filter((s) => !s.escaped);
}

function escapeSaucer(run, s) {
  if (s.escaped) return;
  s.escaped = true;
  if (run.waveSaucers > 0) run.waveSaucers -= 1;
  // comboBank 护盾挡一次漏碟
  if (run.shield > 0) {
    run.shield -= 1;
    emit(run, 'escape', { saucer: s.type, shielded: true });
    return;
  }
  run.lives -= 1;
  run.stats.escapes += 1;
  emit(run, 'escape', { saucer: s.type });
  emit(run, 'lifeLost', { lives: run.lives });
  if (run.lives <= 0) {
    run.phase = 'dead';
    emit(run, 'death', {});
  }
}

// ---------- 流星 ----------
function spawnMeteors(run, dt) {
  if (!currentWaveMeteor(run)) return;
  run.meteorTimer -= dt;
  if (run.meteorTimer > 0) return;
  run.meteorTimer = METEOR.INTERVAL_SEC;
  run.meteors.push({
    id: run.nextId++,
    x: run.rng() * WORLD.WIDTH,
    y: -40,
    vx: (run.rng() - 0.5) * 120,
    vy: METEOR.SPEED * (0.8 + run.rng() * 0.4),
    radius: METEOR.RADIUS,
  });
  emit(run, 'meteor', {});
}

function updateMeteors(run, dt) {
  const keep = [];
  for (const m of run.meteors) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.y > WORLD.HEIGHT + 60) continue;
    keep.push(m);
  }
  run.meteors = keep;
}

function currentWaveMeteor(run) {
  const spec = WAVES[run.wave - 1];
  return spec ? spec.meteor : false;
}

// ---------- 工具 ----------
function nearestSaucer(run, x, y, { includeInvisible = false } = {}) {
  let best = null;
  let bestD = Infinity;
  for (const s of run.saucers) {
    if (!s.active) continue;
    if (s.invisible && !includeInvisible && !run.tracerActive) continue;
    const d = dist(x, y, s.x, s.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function overheatThreshold(run) {
  return run.upgrades.overcharge ? UPGRADES.overcharge.overheatThreshold : GUN.OVERHEAT_THRESHOLD;
}
function overheatLockSec(run) {
  return run.upgrades.coolant ? UPGRADES.coolant.overheatLockSec : GUN.OVERHEAT_LOCK_SEC;
}
function powerDamageBonus(run) {
  return run.upgrades.overcharge ? UPGRADES.overcharge.powerDamageBonus : GUN.POWER_DAMAGE_BONUS;
}
function damageMult(run) {
  return run.upgrades.damage ? UPGRADES.damage.damageMult : 1;
}
function coolMult(run) {
  return run.upgrades.coolRate ? UPGRADES.coolRate.coolMult : 1;
}
function tracerPerWave(run) {
  return run.upgrades.tracerPlus ? UPGRADES.tracerPlus.tracerPerWave : TRACER.PER_WAVE;
}
function tracerRevealSec(run) {
  return run.upgrades.tracerPlus ? UPGRADES.tracerPlus.tracerRevealSec : TRACER.REVEAL_SEC;
}

function cull(run) {
  // 碟已被 escapeSaucer 过滤；这里清理太久未动的实体（防御性）
}

// ---------- HUD / 事件 ----------
function isSaucerVisible(run, s) {
  if (!s.invisible) return true;
  if (run.tracerActive) return true;
  const freq = run.upgrades.radar ? 1.0 : 0.5;
  const duty = 0.15;
  return (run.time * freq) % 1 < duty;
}

function getHud(run) {
  return {
    score: run.score,
    wave: run.wave,
    lives: run.lives,
    charge: run.gun.charge,
    heat: run.gun.heat,
    overheated: run.gun.lockUntil > run.time,
    tracersLeft: run.tracersLeft,
    tracerActive: run.tracerActive,
    tracerRemain: run.tracerActive ? Math.max(0, run.tracerUntil - run.time) : 0,
    combo: run.combo,
    mult: comboMult(run.combo),
    chapter: run.chapter,
    chapterName: `chapter.${run.chapter}`,
    pendingUpgrade: run.pendingUpgrade,
    upgradeOffers: run.upgradeOffers.slice(),
    phase: run.phase,
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

// 供渲染用：碟是否当前可见（tracer / 闪烁 / 普通）
export function saucerVisible(run, s) {
  return isSaucerVisible(run, s);
}

export { chapterOf };
