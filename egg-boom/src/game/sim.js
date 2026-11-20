// EGG BOOM · 模拟核心（纯逻辑，零依赖 DOM/window/localStorage）
// 契约：docs/analysis.md（事件名 / 字段一致）
// 玩法：弹簧蛋滚过厨房台面，自动前进；按住蓄力跳，自动/手动射米粒弹打碎数字面团；
//       蛋壳护甲抵一次碰撞，10s 长回；连击 ×5 换一发蛋黄范围弹。
import {
  WORLD, STEP, EGG, ROWS, SHOOT, COMBO, DOUGH, PROP, SCROLL, LEVEL, SCORE, SHELL, MILESTONE,
  clamp, levelAt, scrollAt, doughYAt, screenXAt,
} from '../../config/gameplay.js';
import { LEVELS, levelDef, sceneOf, clampLevel } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';
import { spawnRack } from './spawner.js';

export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed);
  const level = clampLevel(startLevel);
  const distance = (level - 1) * LEVEL.DIST + 1;

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',          // playing | dead | won
    time: 0,
    distance,
    level,
    scene: sceneOf(level),
    egg: {
      y: EGG.REST_Y,
      vy: 0,
      onGround: true,
      charging: false,
      charge: 0,
      ammo: EGG.AMMO_START,
      shell: SHELL.START,
      shellRegrowAt: -Infinity,
      fireUntil: -Infinity,
      invulnUntil: -Infinity,
      autoTimer: SHOOT.AUTO_INTERVAL * 0.5, // 开局稍后自动首发
      manualCd: 0,
    },
    doughs: [],                // {id, rackId, row, baseY, value, initial, armored, moving, phase, atDistance}
    bullets: [],               // {id, x, y, yolk, power, vy}
    props: [],                 // {id, kind, atDistance, row, y}
    racks: new Map(),          // rackId -> remaining dough count
    nextRackDistance: distance + LEVEL.LOOKAHEAD,
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastBreak: -Infinity,
    yolkReady: false,
    nextId: 1,
    _lastMilestone: Math.floor(distance / MILESTONE.EVERY_PX),
    stats: {
      score: 0,
      maxCombo: 0,
      doughsBroken: 0,
      racksCleared: 0,
      levelReached: level,
      sceneReached: level,
    },
    events: [],
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.jumpLevel = (n) => jumpLevel(run, n);
  return run;
}

export function createSim() {
  return createRun({ seed: 0 });
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  // 1 滚动 + 关卡
  const scroll = scrollAt(run.level);
  run.distance += scroll * dt;
  milestone(run);
  checkLevel(run);

  // 2 生成排
  spawnUpTo(run);

  // 3 输入（蓄力 / 手动射击）
  updateCharge(run, input, dt);
  updateAutoShoot(run, dt);
  if (input.shoot) manualShoot(run);

  // 4 物理
  updateEgg(run, dt);
  updateBullets(run, dt);
  updateProps(run, dt);

  // 5 碰撞
  handleBulletCollisions(run);
  handleEggCollisions(run);

  // 6 状态（连击窗口 / 蛋壳再生 / 火力过期）
  updateCombo(run);
  updateShell(run);
  updateFire(run);

  // 7 清理
  cull(run);

  run.stats.score = run.score;
  run.stats.maxCombo = run.maxCombo;

  // 细粒度「滚动」事件：蛋每步都在台面上滚动，保证反馈密度（供遥测空转判定）
  emit(run, 'roll', { distance: Math.floor(run.distance), y: run.egg.y });
}

// ---------- 滚动里程碑（保证事件密度） ----------
function milestone(run) {
  const m = Math.floor(run.distance / MILESTONE.EVERY_PX);
  if (m > run._lastMilestone) {
    run._lastMilestone = m;
    emit(run, 'milestone', { distance: Math.floor(run.distance) });
  }
}

function checkLevel(run) {
  const lvl = clampLevel(levelAt(run.distance));
  if (lvl !== run.level) {
    const prevScene = run.scene;
    run.level = lvl;
    run.scene = sceneOf(lvl);
    if (lvl > run.stats.levelReached) run.stats.levelReached = lvl;
    emit(run, 'levelEnter', { level: lvl, name: `level.${lvl}` });
    if (run.scene !== prevScene) emit(run, 'sceneEnter', { scene: run.scene, level: lvl });
    // 每关 1 层新壳
    run.egg.shell = SHELL.START;
    run.egg.shellRegrowAt = -Infinity;
  }
  // 通关
  if (run.distance >= LEVEL.COUNT * LEVEL.DIST) {
    run.phase = 'won';
    emit(run, 'win', { level: LEVEL.COUNT, score: run.score });
  }
}

function spawnUpTo(run) {
  const lookahead = run.distance + LEVEL.LOOKAHEAD;
  while (run.nextRackDistance <= lookahead) {
    const specs = spawnRack(run.rng, run.level, run.nextRackDistance);
    const rackId = run.nextId++;
    let count = 0;
    for (const s of specs) {
      if (s == null) continue;
      count += 1;
      run.doughs.push({
        id: run.nextId++,
        rackId,
        row: s.row,
        baseY: ROWS.Y[s.row - 1],
        value: s.value,
        initial: s.value,
        armored: !!s.armored,
        moving: !!s.moving,
        phase: s.phase,
        atDistance: s.atDistance,
      });
    }
    if (count > 0) run.racks.set(rackId, count);
    run.nextRackDistance += LEVEL.RACK_GAP;
  }
}

// ---------- 蓄力 / 射击 ----------
function updateCharge(run, input, dt) {
  const egg = run.egg;
  if (input.charge && egg.onGround) {
    egg.charging = true;
    egg.charge = Math.min(1, egg.charge + dt / EGG.CHARGE_TIME);
    if (egg.charge >= 1 && !egg._full) {
      egg._full = true;
      emit(run, 'chargeFull', {});
    }
  } else if (egg.charging) {
    egg.charging = false;
    egg._full = false;
    if (egg.charge >= EGG.MIN_CHARGE) {
      const v = EGG.JUMP_MIN + (EGG.JUMP_MAX - EGG.JUMP_MIN) * egg.charge;
      egg.vy = -v;
      egg.onGround = false;
      emit(run, 'jump', { charge: egg.charge, y: egg.y });
    }
    egg.charge = 0;
  } else {
    egg.charge = 0;
  }
}

function updateAutoShoot(run, dt) {
  const egg = run.egg;
  egg.manualCd = Math.max(0, egg.manualCd - dt);
  egg.autoTimer -= dt;
  // 自动射击只在「蛋所在行前方有目标」时开火（跳过空隙 = 省弹药）
  if (egg.autoTimer <= 0) {
    if (hasTargetInRow(run)) {
      fireBullet(run, false);
    }
    egg.autoTimer = SHOOT.AUTO_INTERVAL;
  }
}

function hasTargetInRow(run) {
  const egg = run.egg;
  for (const d of run.doughs) {
    const sx = screenXAt(d.atDistance, run.distance);
    if (sx <= WORLD.EGG_X + 6 || sx > WORLD.EGG_X + 620) continue;
    if (Math.abs(doughYAt(d, run.time) - egg.y) <= DOUGH.R + SHOOT.BULLET_H) return true;
  }
  return false;
}

function manualShoot(run) {
  const egg = run.egg;
  if (egg.manualCd > 0) return;
  egg.manualCd = SHOOT.MANUAL_COOLDOWN;
  fireBullet(run, true);
}

function fireBullet(run, manual) {
  const egg = run.egg;
  if (egg.ammo <= 0) {
    if (manual) emit(run, 'noAmmo', {});
    return;
  }
  const yolk = run.yolkReady && manual; // 蛋黄范围弹只由手动触发
  egg.ammo -= 1;
  const power = yolk ? COMBO.YOLK_POWER : shootPower(run);
  run.bullets.push({
    id: run.nextId++,
    x: WORLD.EGG_X + EGG.R + 4,
    y: egg.y,
    yolk,
    power,
  });
  emit(run, 'shoot', { yolk, y: egg.y, ammo: egg.ammo });
  if (yolk) {
    run.yolkReady = false;
    // 蛋黄弹消耗掉连击（下一发范围弹用掉整段连击）
    run.combo = 0;
    run.lastBreak = -Infinity;
  }
}

function shootPower(run) {
  return run.egg.fireUntil > run.time ? PROP.FIRE_POWER : SHOOT.BASE_POWER;
}

function updateEgg(run, dt) {
  const egg = run.egg;
  if (!egg.onGround) {
    egg.vy += EGG.GRAVITY * dt;
    egg.y += egg.vy * dt;
    if (egg.y >= EGG.REST_Y) {
      egg.y = EGG.REST_Y;
      egg.vy = 0;
      egg.onGround = true;
      emit(run, 'land', { y: egg.y });
    } else if (egg.y < 40) {
      egg.y = 40;
      if (egg.vy < 0) egg.vy = 0;
    }
  }
}

function updateBullets(run, dt) {
  const keep = [];
  for (const b of run.bullets) {
    b.x += SHOOT.BULLET_SPEED * dt;
    if (b.x < WORLD.WIDTH + 40) keep.push(b);
  }
  run.bullets = keep;
}

function updateProps(run, dt) {
  // 道具随世界滚动（屏幕 x 由 atDistance 计算），只在这里不动；拾取在 handleEggCollisions 前统一判定
  const egg = run.egg;
  const keep = [];
  for (const p of run.props) {
    const sx = screenXAt(p.atDistance, run.distance);
    const dy = p.y - egg.y;
    const dx = sx - WORLD.EGG_X;
    if (Math.hypot(dx, dy) <= PROP.PICKUP) {
      collectProp(run, p);
    } else if (sx > -80) {
      keep.push(p);
    }
  }
  run.props = keep;
}

function collectProp(run, p) {
  if (p.kind === 'score') run.score += PROP.SCORE_GAIN;
  else if (p.kind === 'ammo') run.egg.ammo = Math.min(EGG.AMMO_MAX, run.egg.ammo + PROP.AMMO_GAIN);
  else if (p.kind === 'fire') run.egg.fireUntil = run.time + PROP.FIRE_DURATION;
  emit(run, 'propGain', { kind: p.kind, x: WORLD.EGG_X, y: p.y });
}

// ---------- 子弹碰撞 ----------
function handleBulletCollisions(run) {
  const remaining = [];
  for (const b of run.bullets) {
    let consumed = false;
    if (b.yolk) {
      // 范围弹：接近任一面团即爆
      for (const d of run.doughs) {
        const sx = screenXAt(d.atDistance, run.distance);
        const dy = doughYAt(d, run.time);
        if (Math.hypot(sx - b.x, dy - b.y) <= DOUGH.R + COMBO.YOLK_RADIUS) {
          explodeYolk(run, b);
          consumed = true;
          break;
        }
      }
    } else {
      for (const d of run.doughs) {
        const sx = screenXAt(d.atDistance, run.distance);
        const dy = doughYAt(d, run.time);
        if (Math.abs(sx - b.x) <= DOUGH.R + SHOOT.BULLET_W && Math.abs(dy - b.y) <= DOUGH.R + SHOOT.BULLET_H) {
          if (d.armored) {
            emit(run, 'armorDeflect', { x: sx, y: dy });
          } else {
            damageDough(run, d, b.power);
          }
          consumed = true;
          break;
        }
      }
    }
    if (!consumed) remaining.push(b);
  }
  run.bullets = remaining;
}

function explodeYolk(run, b) {
  const x = b.x;
  const y = b.y;
  const hit = [];
  for (const d of run.doughs) {
    const sx = screenXAt(d.atDistance, run.distance);
    const dy = doughYAt(d, run.time);
    if (Math.hypot(sx - x, dy - y) <= COMBO.YOLK_RADIUS) {
      hit.push(d);
      damageDough(run, d, COMBO.YOLK_POWER, true);
    }
  }
  emit(run, 'yolkFired', { x, y, hit: hit.length });
}

// ---------- 伤害 / 破团 ----------
function damageDough(run, d, power, yolk = false) {
  d.value -= power;
  const sx = screenXAt(d.atDistance, run.distance);
  const dy = doughYAt(d, run.time);
  emit(run, 'doughHit', { id: d.id, x: sx, y: dy, value: Math.max(0, d.value), yolk });
  if (d.value <= 0) {
    breakDough(run, d);
  }
}

function breakDough(run, d) {
  const sx = screenXAt(d.atDistance, run.distance);
  const dy = doughYAt(d, run.time);
  run.score += d.initial;
  run.stats.doughsBroken += 1;
  // 连击
  run.combo = (run.time - run.lastBreak <= COMBO.WINDOW) ? run.combo + 1 : 1;
  run.lastBreak = run.time;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  emit(run, 'doughBreak', { x: sx, y: dy, value: d.initial, combo: run.combo, armored: d.armored });
  emit(run, 'comboUp', { combo: run.combo });
  if (run.combo > 0 && run.combo % COMBO.YOLK_AT === 0) {
    run.yolkReady = true;
    emit(run, 'yolkReady', {});
  }
  // 掉道具
  if (run.rng() < PROP.DROP_CHANCE) dropProp(run, sx, d);
  // 整排清空检查
  removeDough(run, d);
}

function removeDough(run, d) {
  run.doughs = run.doughs.filter((x) => x.id !== d.id);
  if (run.racks.has(d.rackId)) {
    const n = run.racks.get(d.rackId) - 1;
    if (n <= 0) {
      run.racks.delete(d.rackId);
      const sx = screenXAt(d.atDistance, run.distance);
      run.score += SCORE.RACK_CLEAR_BONUS;
      run.stats.racksCleared += 1;
      run.egg.ammo = Math.min(EGG.AMMO_MAX, run.egg.ammo + SCORE.RACK_CLEAR_AMMO);
      emit(run, 'rackClear', { x: sx, y: d.baseY });
      if (run.rng() < PROP.RACK_CLEAR_CHANCE) dropProp(run, sx, { row: d.row, atDistance: d.atDistance });
    } else {
      run.racks.set(d.rackId, n);
    }
  }
}

function dropProp(run, sx, from) {
  const kinds = ['score', 'score', 'ammo', 'fire'];
  const kind = kinds[Math.floor(run.rng() * kinds.length)];
  // 掉在打碎处的同一行，随世界滚动到蛋前即可被拾取
  const row = from && from.row ? from.row : nearestRow(run.egg.y);
  const atDistance = from && from.atDistance != null
    ? from.atDistance
    : run.distance + (sx - WORLD.EGG_X);
  run.props.push({ id: run.nextId++, kind, atDistance, row, y: ROWS.Y[row - 1] });
}

function nearestRow(y) {
  let best = 1;
  let bd = Infinity;
  for (let i = 0; i < ROWS.Y.length; i += 1) {
    const d = Math.abs(ROWS.Y[i] - y);
    if (d < bd) { bd = d; best = i + 1; }
  }
  return best;
}

// ---------- 蛋碰撞 ----------
function handleEggCollisions(run) {
  const egg = run.egg;
  if (run.time < egg.invulnUntil) return;
  const ex1 = WORLD.EGG_X - EGG.R;
  const ex2 = WORLD.EGG_X + EGG.R;
  for (const d of run.doughs) {
    const sx = screenXAt(d.atDistance, run.distance);
    const dy = doughYAt(d, run.time);
    const hit = sx - DOUGH.R < ex2 && sx + DOUGH.R > ex1 && Math.abs(dy - egg.y) <= DOUGH.R + EGG.R;
    if (!hit) continue;
    // 有壳：壳碎，团被撞散，短暂无敌，10s 后长回
    if (egg.shell > 0) {
      egg.shell = 0;
      egg.shellRegrowAt = run.time + SHELL.REGROW_SEC;
      egg.invulnUntil = run.time + EGG.INVULN;
      emit(run, 'shellBreak', { x: sx, y: dy });
      removeDough(run, d);
      return;
    }
    die(run, sx, dy);
    return;
  }
}

function die(run, x, y) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { x, y, level: run.level, score: run.score });
}

// ---------- 连击 / 蛋壳 / 火力 ----------
function updateCombo(run) {
  if (run.combo > 0 && run.time - run.lastBreak > COMBO.WINDOW) {
    run.combo = 0;
    run.lastBreak = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

function updateShell(run) {
  const egg = run.egg;
  if (egg.shell <= 0 && egg.shellRegrowAt > -Infinity && run.time >= egg.shellRegrowAt) {
    egg.shell = SHELL.START;
    egg.shellRegrowAt = -Infinity;
    emit(run, 'shellRegrow', {});
  }
}

function updateFire(run) {
  // 火力过期不发事件（HUD 读 getHud）
}

// ---------- 清理 ----------
function cull(run) {
  const before = run.doughs.length;
  run.doughs = run.doughs.filter((d) => screenXAt(d.atDistance, run.distance) > -120);
  // 被 cull 的面团不再计整排清空（跳过不算清）
  if (run.doughs.length !== before) {
    // 重建 racks 计数：只统计仍在场的面团
    const counts = new Map();
    for (const d of run.doughs) counts.set(d.rackId, (counts.get(d.rackId) || 0) + 1);
    run.racks = counts;
  }
}

// ---------- 跳关（调试/截图用） ----------
function jumpLevel(run, n) {
  const lvl = clampLevel(n);
  run.distance = (lvl - 1) * LEVEL.DIST + 1;
  run.level = lvl;
  run.scene = sceneOf(lvl);
  run.egg.y = EGG.REST_Y;
  run.egg.vy = 0;
  run.egg.onGround = true;
  run.egg.charge = 0;
  run.egg.charging = false;
  run.egg.shell = SHELL.START;
  run.egg.shellRegrowAt = -Infinity;
  run.egg.fireUntil = -Infinity;
  run.egg.invulnUntil = -Infinity;
  run.egg.ammo = Math.max(run.egg.ammo, EGG.AMMO_START);
  run.doughs = [];
  run.bullets = [];
  run.props = [];
  run.racks = new Map();
  run.nextRackDistance = run.distance + LEVEL.LOOKAHEAD;
  run._lastMilestone = Math.floor(run.distance / MILESTONE.EVERY_PX);
  emit(run, 'levelEnter', { level: lvl, name: `level.${lvl}` });
  emit(run, 'sceneEnter', { scene: run.scene, level: lvl });
}

// ---------- HUD / 事件 ----------
export function getHud(run) {
  const egg = run.egg;
  const regrow = egg.shellRegrowAt > -Infinity
    ? clamp(1 - (egg.shellRegrowAt - run.time) / SHELL.REGROW_SEC, 0, 1)
    : 1;
  return {
    phase: run.phase,
    score: run.score,
    ammo: egg.ammo,
    combo: run.combo,
    maxCombo: run.maxCombo,
    level: run.level,
    scene: run.scene,
    levelName: `level.${run.level}`,
    sceneName: sceneOf(run.level),
    shell: egg.shell,
    shellRegrow: regrow,
    yolkReady: run.yolkReady,
    fireActive: egg.fireUntil > run.time,
    fireRemain: Math.max(0, egg.fireUntil - run.time),
    charging: egg.charging,
    charge: egg.charge,
    onGround: egg.onGround,
    distance: run.distance,
    totalLevels: LEVELS.length,
    targets: run.doughs.filter((d) => screenXAt(d.atDistance, run.distance) > WORLD.EGG_X - 30).length,
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
