// src/game/sim.js — ALIEN SIEGE · 模拟/玩法核心（纯逻辑，零 DOM / 零随机副作用）。
// 契约：docs/analysis.md（事件名 / 接口签名一字不差）。
// 输入：{ moveX, moveY, turn, shoot, reload, shield, mark }
//   moveX/moveY ∈ [-1,1]（W/S/A/D 合成），turn ∈ [-1,1]（转向），shoot/shield 为持续按住，
//   reload/mark 为「本 tick 按下」的边沿。
import {
  STEP, PLAYER, WEAPONS, WEAPON_UNLOCK_ORDER, ENEMIES, WAVE, ARENA, HIT, FX,
  clamp, normAngle,
} from '../../config/gameplay.js';
import { waveDef } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { MAPS, circleCollides, hasLineOfSight } from './map.js';

const TWO_PI = Math.PI * 2;

export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const pistol = WEAPONS.pistol;
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    wave: 0,             // 当前波次（0 = 尚未开始第一波）
    scene: 1,
    map: MAPS[0],
    waveState: 'pre',    // pre | active | clear
    spawnTimer: 0.15, // 首波几乎立即开始（旧 0.8s 会让教程后/重开瞬间画面无目标）
    player: {
      x: ARENA.SPAWN_X, y: ARENA.SPAWN_Y, angle: ARENA.SPAWN_ANGLE,
      hp: PLAYER.HP, maxHp: PLAYER.HP,
      weapon: 'pistol', ammo: pistol.magSize,
      reloading: false, reloadEnd: 0, fireCooldown: 0,
      shieldActive: false, shieldEnergy: PLAYER.SHIELD_ENERGY,
      markCooldown: 0, lastHurt: -Infinity, shake: 0,
    },
    enemies: [],
    nextId: 1,
    stats: { kills: 0, waveReached: 1, bestWave: 1, score: 0, shots: 0, hits: 0, maxCombo: 0 },
    combo: 0, lastKill: -Infinity,
    events: [],
    _lastHeartbeat: -1,
    _lastNearMiss: -Infinity,
    _markId: null,
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架入口（部分工具直接调 createSim/updateSim）
export function createSim() {
  return createRun({ seed: 0 });
}
export function updateSim(run, input = {}) {
  run.step({
    moveX: input.left ? -1 : input.right ? 1 : 0,
    moveY: input.up ? 1 : input.down ? -1 : 0,
    turn: input.turnLeft ? -1 : input.turnRight ? 1 : 0,
    shoot: !!input.shoot,
    reload: !!input.reload,
    shield: !!input.shield,
    mark: !!input.mark,
  });
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  updatePlayer(run, input, dt);
  updateWeapon(run, input, dt);
  updateWaveFlow(run, dt);
  updateEnemies(run, dt);
  heartbeat(run);
  decay(run, dt);

  run.stats.waveReached = run.wave > 0 ? run.wave : 1;
  if (run.wave > run.stats.bestWave) run.stats.bestWave = run.wave;
}

// ---------- 玩家移动 / 护盾 / 标记 ----------
function updatePlayer(run, input, dt) {
  const p = run.player;

  // 转向（弧度/s）
  const turn = clamp(input.turn ?? 0, -1, 1);
  p.angle = normAngle(p.angle + turn * PLAYER.TURN_SPEED * dt);

  // 移动（前/后/左右，斜向归一化）
  const mx = clamp(input.moveX ?? 0, -1, 1);
  const my = clamp(input.moveY ?? 0, -1, 1);
  const speed = PLAYER.MOVE_SPEED * (p.shieldActive ? PLAYER.SHIELD_SLOW : 1);
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const rx = Math.cos(p.angle + Math.PI / 2);
  const ry = Math.sin(p.angle + Math.PI / 2);
  let vx = fx * my + rx * mx;
  let vy = fy * my + ry * mx;
  const len = Math.hypot(vx, vy);
  if (len > 1) { vx /= len; vy /= len; }

  const nx = p.x + vx * speed * dt;
  if (!circleCollides(run.map, nx, p.y, PLAYER.RADIUS)) p.x = nx;
  const ny = p.y + vy * speed * dt;
  if (!circleCollides(run.map, p.x, ny, PLAYER.RADIUS)) p.y = ny;

  // 护盾（按住 + 有能量）
  const wantShield = !!input.shield;
  if (wantShield && !p.shieldActive && p.shieldEnergy > 0) {
    p.shieldActive = true;
    emit(run, 'shieldOn', {});
  }
  if (p.shieldActive) {
    p.shieldEnergy -= PLAYER.SHIELD_DRAIN * dt;
    if (p.shieldEnergy <= 0 || !wantShield) {
      p.shieldEnergy = Math.max(0, p.shieldEnergy);
      p.shieldActive = false;
      emit(run, p.shieldEnergy <= 0 ? 'shieldBreak' : 'shieldOff', {});
    }
  } else if (p.shieldEnergy < PLAYER.SHIELD_ENERGY) {
    p.shieldEnergy = Math.min(PLAYER.SHIELD_ENERGY, p.shieldEnergy + PLAYER.SHIELD_RECHARGE * dt);
  }

  // 标记（边沿，冷却内不可用）
  p.markCooldown = Math.max(0, p.markCooldown - dt);
  if (input.mark && p.markCooldown <= 0) {
    const target = pickMarkTarget(run);
    if (target) {
      target.marked = true;
      target.markedUntil = run.time + PLAYER.MARK_DURATION;
      p.markCooldown = PLAYER.MARK_COOLDOWN;
      run._markId = target.id;
      emit(run, 'mark', { id: target.id, enemyType: target.type });
    }
  }

  p.shake = Math.max(0, p.shake - dt * 8);
}

function pickMarkTarget(run) {
  const p = run.player;
  let best = null;
  for (const e of run.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > HIT.MARK_RANGE) continue;
    const diff = Math.abs(normAngle(Math.atan2(dy, dx) - p.angle));
    if (diff > HIT.MARK_ANGLE) continue;
    if (!hasLineOfSight(run.map, p.x, p.y, e.x, e.y)) continue;
    if (!best || dist < best.dist) best = { enemy: e, dist };
  }
  return best ? best.enemy : null;
}

// ---------- 武器 / 开火 ----------
function updateWeapon(run, input, dt) {
  const p = run.player;
  const w = WEAPONS[p.weapon];
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);

  if (p.reloading) {
    if (run.time >= p.reloadEnd) {
      p.reloading = false;
      p.ammo = w.magSize;
      emit(run, 'reloadDone', { weapon: p.weapon });
    }
    return;
  }

  // 主动换弹（R，边沿）
  if (input.reload && p.ammo < w.magSize) {
    startReload(run);
    return;
  }

  const wantFire = !!input.shoot;
  if (wantFire && p.ammo <= 0) {
    startReload(run); // 打空自动换弹（宽容，防卡死）
    return;
  }
  if (!wantFire || p.fireCooldown > 0) return;

  // 开火
  p.fireCooldown = w.fireRate;
  p.ammo -= 1;
  run.stats.shots += 1;
  emit(run, 'shoot', { weapon: p.weapon, ammo: p.ammo });
  for (let i = 0; i < w.pellets; i += 1) {
    const spread = (run.rng() * 2 - 1) * w.spread;
    const hit = hitscan(run, p.angle + spread, w.range, w.damage);
    if (hit && p.weapon === 'shotgun' && hit.dist < FX.SPLAT_RANGE) {
      emit(run, 'splat', { x: hit.enemy.x, y: hit.enemy.y });
    }
  }
  // 打完最后一发立即进入换弹（宽容，防卡死）
  if (p.ammo <= 0) startReload(run);
}

function startReload(run) {
  const p = run.player;
  const w = WEAPONS[p.weapon];
  if (p.reloading) return;
  p.reloading = true;
  p.reloadEnd = run.time + w.reloadSec;
  emit(run, 'reload', { weapon: p.weapon });
}

function hitscan(run, angle, range, baseDamage) {
  const px = run.player.x;
  const py = run.player.y;
  let best = null;
  for (const e of run.enemies) {
    const ex = e.x - px;
    const ey = e.y - py;
    const dist = Math.hypot(ex, ey);
    if (dist > range || dist < 0.001) continue;
    const diff = Math.abs(normAngle(Math.atan2(ey, ex) - angle));
    const angR = Math.atan2(e.radius, dist);
    if (diff > angR) continue;
    if (!hasLineOfSight(run.map, px, py, e.x, e.y)) continue;
    if (!best || dist < best.dist) best = { enemy: e, dist };
  }
  if (!best) return null;
  const mult = best.enemy.marked ? PLAYER.MARK_MULT : 1;
  damageEnemy(run, best.enemy, Math.round(baseDamage * mult), best.dist);
  return best;
}

function damageEnemy(run, e, dmg, dist) {
  e.hp -= dmg;
  run.stats.hits += 1;
  emit(run, 'hit', { id: e.id, enemyType: e.type, dmg, x: e.x, y: e.y });
  if (e.hp <= 0) killEnemy(run, e);
}

function killEnemy(run, e) {
  run.enemies = run.enemies.filter((x) => x.id !== e.id);
  run.stats.kills += 1;
  run.stats.score += e.score;
  run.combo = (run.time - run.lastKill <= 2.0) ? run.combo + 1 : 1;
  run.lastKill = run.time;
  if (run.combo > run.stats.maxCombo) run.stats.maxCombo = run.combo;
  run.player.shake = FX.SCREEN_SHAKE_KILL;
  emit(run, 'kill', { id: e.id, enemyType: e.type, marked: e.marked, combo: run.combo, x: e.x, y: e.y });
  if (e.marked) emit(run, 'milestone', { kind: 'markedKill', wave: run.wave });
}

// ---------- 波次流转 ----------
function updateWaveFlow(run, dt) {
  if (run.wave === 0 || run.waveState === 'clear') {
    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0) startWave(run, run.wave + 1);
    return;
  }
  if (run.waveState === 'active') {
    if (run.enemies.length === 0) {
      run.waveState = 'clear';
      emit(run, 'waveClear', { wave: run.wave });
      if (run.wave >= WAVE.COUNT) { winRun(run); return; }
      run.spawnTimer = WAVE.CLEAR_DELAY;
      // 波间回血
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + PLAYER.REGEN_PER_SEC * WAVE.CLEAR_DELAY);
    }
  }
}

function startWave(run, n) {
  run.wave = n;
  run.waveState = 'active';
  const def = waveDef(n);

  // 场景切换（换章换构图 + 色板）
  if (def.scene !== run.scene) {
    run.scene = def.scene;
    run.map = MAPS[def.scene - 1];
    emit(run, 'sceneEnter', { scene: run.scene });
  }

  // 武器解锁（自动装备新武器）
  unlockWeapon(run, n);

  spawnWaveEnemies(run, def);
  emit(run, 'waveStart', { wave: n, scene: run.scene });
  if (run.stats.waveReached < n) run.stats.waveReached = n;
}

function unlockWeapon(run, wave) {
  const p = run.player;
  for (const name of WEAPON_UNLOCK_ORDER) {
    if (WEAPONS[name].unlockWave === wave && p.weapon !== name) {
      p.weapon = name;
      const w = WEAPONS[name];
      p.ammo = w.magSize;
      p.reloading = false;
      emit(run, 'weaponUnlock', { weapon: name });
    }
  }
}

function spawnWaveEnemies(run, def) {
  for (const group of def.enemies) {
    for (let i = 0; i < group.count; i += 1) {
      const pos = spawnPos(run);
      const spec = ENEMIES[group.type];
      run.enemies.push({
        id: run.nextId++,
        type: group.type,
        x: pos.x, y: pos.y,
        hp: spec.hp, maxHp: spec.hp,
        speed: spec.speed, radius: spec.radius,
        damage: spec.damage, attackRange: spec.attackRange,
        attackCooldown: spec.attackCooldown, drift: spec.drift,
        score: spec.score, spawnMinions: !!spec.spawnMinions,
        attackCd: run.rng() * 0.5,
        driftPhase: run.rng() * TWO_PI,
        spawnCd: spec.spawnMinions ? WAVE.NEST_SPAWN_INTERVAL : 0,
        marked: false, markedUntil: 0,
      });
    }
  }
  if (def.enemies.some((g) => g.type === 'nest')) emit(run, 'bossSpawn', {});
}

function spawnPos(run) {
  const cx = ARENA.SPAWN_X;
  const cy = ARENA.SPAWN_Y;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const a = run.rng() * TWO_PI;
    const r = WAVE.SPAWN_RING + run.rng() * WAVE.SPAWN_JITTER;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (!isWallAt(run.map, x, y)) return { x, y };
  }
  return { x: cx + 5, y: cy };
}

// ---------- 敌人 AI ----------
function updateEnemies(run, dt) {
  const p = run.player;
  for (const e of run.enemies) {
    // 标记超时
    if (e.marked && run.time > e.markedUntil) e.marked = false;

    // 母巢召唤
    if (e.spawnMinions) {
      e.spawnCd -= dt;
      if (e.spawnCd <= 0) {
        e.spawnCd = WAVE.NEST_SPAWN_INTERVAL;
        const liveMinions = run.enemies.filter((x) => x.type === 'crawler').length;
        if (liveMinions < 8) {
          for (let i = 0; i < WAVE.NEST_SPAWN_MAX; i += 1) {
            const spec = ENEMIES.crawler;
            run.enemies.push({
              id: run.nextId++, type: 'crawler',
              x: e.x + (run.rng() - 0.5), y: e.y + (run.rng() - 0.5),
              hp: spec.hp, maxHp: spec.hp, speed: spec.speed, radius: spec.radius,
              damage: spec.damage, attackRange: spec.attackRange,
              attackCooldown: spec.attackCooldown, drift: 0, score: spec.score,
              attackCd: 0.1, driftPhase: 0, spawnCd: 0, marked: false, markedUntil: 0,
            });
          }
        }
      }
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1e-4;

    if (dist > e.attackRange) {
      // 朝玩家推进；浮游者带横向漂移
      let ux = dx / dist;
      let uy = dy / dist;
      if (e.drift > 0) {
        const s = Math.sin(run.time * 1.7 + e.driftPhase);
        const perpX = -uy;
        const perpY = ux;
        ux += perpX * s * 0.8;
        uy += perpY * s * 0.8;
        const ul = Math.hypot(ux, uy) || 1;
        ux /= ul; uy /= ul;
      }
      const step = e.speed * dt;
      const nx = e.x + ux * step;
      if (!circleCollides(run.map, nx, e.y, e.radius)) e.x = nx;
      const ny = e.y + uy * step;
      if (!circleCollides(run.map, e.x, ny, e.radius)) e.y = ny;

      // 逼近预警（nearMiss：进入攻击圈边缘）
      if (dist < e.attackRange + 0.5 && run.time - run._lastNearMiss > HIT.NEAR_MISS_THROTTLE) {
        run._lastNearMiss = run.time;
        emit(run, 'nearMiss', { id: e.id, enemyType: e.type });
      }
    } else {
      // 攻击
      e.attackCd -= dt;
      if (e.attackCd <= 0) {
        e.attackCd = e.attackCooldown;
        damagePlayer(run, e.damage, e);
      }
    }
  }
}

function damagePlayer(run, dmg, e) {
  const p = run.player;
  p.lastHurt = run.time;
  if (p.shieldActive && p.shieldEnergy > 0) {
    const absorbed = Math.min(p.shieldEnergy, dmg);
    p.shieldEnergy -= absorbed;
    dmg -= absorbed;
    if (p.shieldEnergy <= 0) {
      p.shieldActive = false;
      emit(run, 'shieldBreak', {});
    }
    if (dmg <= 0) {
      emit(run, 'playerHurt', { absorbed: true, enemyType: e.type });
      return;
    }
  }
  p.hp -= dmg;
  p.shake = FX.SCREEN_SHAKE_HIT;
  emit(run, 'playerHurt', { absorbed: false, enemyType: e.type, hp: Math.max(0, p.hp) });
  if (p.hp <= 0) {
    p.hp = 0;
    die(run);
  }
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { wave: run.wave, kills: run.stats.kills });
}

function winRun(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'win';
  emit(run, 'win', { wave: run.wave, kills: run.stats.kills, score: run.stats.score });
}

// ---------- 细粒度里程碑（保证反馈密度 / 压低事件间隔） ----------
function heartbeat(run) {
  const sec = Math.floor(run.time / HIT.HEARTBEAT_SEC);
  if (sec > run._lastHeartbeat) {
    run._lastHeartbeat = sec;
    emit(run, 'milestone', { kind: 'tick', wave: run.wave, kills: run.stats.kills });
  }
}

function decay(run, dt) {
  // 连击超时清空（无独立事件，静默）
  if (run.combo > 0 && run.time - run.lastKill > 2.0) run.combo = 0;
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const p = run.player;
  const w = WEAPONS[p.weapon];
  const nest = run.enemies.find((e) => e.type === 'nest');
  return {
    hp: Math.max(0, Math.round(p.hp)),
    maxHp: p.maxHp,
    ammo: p.ammo,
    magSize: w.magSize,
    weapon: p.weapon,
    weaponName: w.name,
    reloading: p.reloading,
    shieldActive: p.shieldActive,
    shieldEnergy: Math.round(p.shieldEnergy),
    shieldMax: PLAYER.SHIELD_ENERGY,
    markReady: p.markCooldown <= 0,
    wave: run.wave,
    scene: run.scene,
    sceneName: `scene.${run.scene}`,
    score: run.stats.score,
    kills: run.stats.kills,
    enemiesLeft: run.enemies.length,
    bossHp: nest ? Math.round(nest.hp) : 0,
    bossMax: nest ? nest.maxHp : 0,
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

// 本地小工具（不导出全局）
function isWallAt(grid, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= grid[0].length || cy >= grid.length) return true;
  return grid[cy][cx] === 1;
}
