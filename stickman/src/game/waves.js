// waves.js — Wave/act scheduler. Spawns enemies, tracks clear, manages progression.
import { CONFIG, WORLD, STEP } from '../../config/game.config.js';
import { MAPS, MAP_ORDER } from '../../config/maps.js';
import { ENEMIES, ACT_SCALE } from '../../config/enemies.js';
import { createBody, setBodyPos } from './ragdoll.js';
import { createAI } from './ai.js';

let _nextId = 1;

export function createWaves(actIndex, seed, rngFn, difficulty) {
  const act = CONFIG.acts[actIndex] || CONFIG.acts[0];
  const map = MAPS[act.id];
  const scale = ACT_SCALE[actIndex] || ACT_SCALE[0];
  return {
    actIndex,
    actId: act.id,
    act,
    map,
    scale,
    waveIndex: 0,
    spawnQueue: [],
    spawnTimer: 0,
    allSpawned: false,
    cleared: false,
    rng: rngFn,
    difficulty,
  };
}

export function startWave(waves) {
  const act = waves.act;
  const waveDef = act.waves[waves.waveIndex];
  if (!waveDef) {
    waves.allSpawned = true;
    return [];
  }
  waves.spawnQueue = [];
  waves.allSpawned = false;
  waves.spawnTimer = 0;
  const groups = waveDef.groups;
  for (const [type, count] of groups) {
    for (let i = 0; i < count; i++) {
      waves.spawnQueue.push(type);
    }
  }
  shuffle(waves.spawnQueue, waves.rng);
  return waveDef.groups;
}

export function stepWaves(waves, enemies, dt) {
  const spawned = [];
  if (waves.spawnQueue.length > 0) {
    waves.spawnTimer -= dt;
    if (waves.spawnTimer <= 0) {
      const type = waves.spawnQueue.shift();
      const enemy = spawnEnemy(type, waves);
      spawned.push(enemy);
      waves.spawnTimer = CONFIG.wave.spawnInterval;
    }
  }
  if (waves.spawnQueue.length === 0) {
    waves.allSpawned = true;
  }
  return spawned;
}

export function isWaveClear(waves, enemies) {
  if (!waves.allSpawned) return false;
  return enemies.every(e => e.dead);
}

export function nextWave(waves) {
  waves.waveIndex++;
  if (waves.waveIndex >= waves.act.waves.length) {
    waves.cleared = true;
    return false;
  }
  return true;
}

function spawnEnemy(type, waves) {
  const def = ENEMIES[type];
  const map = waves.map;
  const scale = waves.scale;
  const rng = waves.rng;

  let sx, sy;
  if (def.floating || def.spawnAir) {
    const air = map.airSpawns[Math.floor(rng() * map.airSpawns.length)];
    sx = air.x + (rng() - 0.5) * 60;
    sy = air.y + (rng() - 0.5) * 30;
  } else {
    const sp = map.spawns[Math.floor(rng() * map.spawns.length)];
    sx = sp.x + (rng() - 0.5) * 40;
    sy = sp.y;
  }

  const bodyScale = CONFIG.enemyScale[type] || 1;
  const body = createBody(sx, sy, bodyScale);
  const hp = Math.round(def.hp * scale.hp * waves.difficulty.hp);

  const enemy = {
    id: `e-${_nextId++}`,
    kind: 'enemy',
    type,
    x: sx, y: sy,
    px: sx, py: sy,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    r: def.r * bodyScale,
    facing: 1,
    dead: false,
    dying: false,
    invuln: 0.5,
    body,
    gun: { x: sx, y: sy, dx: 1, dy: 0 },
    aim: { x: sx + 100, y: sy },
    anim: { walk: 0, hurt: 0, dead: 0, flash: 0, dash: 0, melee: 0, reload: 0, spawn: 0.5, telegraph: 0 },
    weapon: null,
    mag: 0, magMax: 0,
    reloading: false, reloadT: 0,
    hitFlash: 0,
    walkx: 0,
    scale: bodyScale,
    sink: 0,
    _contactCd: 0,
    _floatY: def.floating ? 280 + rng() * 80 : 300,
  };

  enemy.ai = createAI(type, rng);
  return enemy;
}

export function spawnBoss(waves) {
  const def = ENEMIES.blank;
  const map = waves.map;
  const scale = waves.scale;
  const rng = waves.rng;
  const sx = 640;
  const sy = 280;
  const bodyScale = CONFIG.enemyScale.blank || 3.6;
  const body = createBody(sx, sy, bodyScale);
  const hp = Math.round(def.hp * scale.hp * waves.difficulty.hp);
  const boss = {
    id: 'boss-blank',
    kind: 'enemy',
    type: 'blank',
    x: sx, y: sy, px: sx, py: sy,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    r: def.r,
    facing: -1,
    dead: false, dying: false,
    invuln: 1.0,
    body,
    gun: { x: sx, y: sy, dx: -1, dy: 0 },
    aim: { x: 300, y: 400 },
    anim: { walk: 0, hurt: 0, dead: 0, flash: 0, dash: 0, melee: 0, reload: 0, spawn: 1.0, telegraph: 0 },
    weapon: null, mag: 0, magMax: 0,
    reloading: false, reloadT: 0,
    hitFlash: 0, walkx: 0, scale: bodyScale,
    sink: 0, _contactCd: 0,
    _floatY: 280,
  };
  boss.ai = createAI('blank', rng);
  return boss;
}

export function createPickup(kind, x, y, rngFn, value) {
  return {
    id: `p-${_nextId++}`,
    x, y,
    kind,
    value: value || 0,
    weapon: kind === 'weapon' ? (rngFn() > 0.5 ? 'brush' : 'nib') : null,
    lore: kind === 'lore' ? Math.ceil(rngFn() * 8) : null,
    t: 0,
    vx: (rngFn() - 0.5) * 60,
    vy: -80 - rngFn() * 40,
  };
}

export function generateWaveDrops(waves, x, y) {
  const drops = [];
  const rng = waves.rng;
  const inkCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < inkCount; i++) {
    drops.push(createPickup('ink', x + (rng() - 0.5) * 60, y - 20, rng, 7));
  }
  return drops;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
