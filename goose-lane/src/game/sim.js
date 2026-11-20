// src/game/sim.js — GOOSE LANE · M1 玩法核心（纯逻辑，零 DOM / 零 Date.now / 可复现）。
// 三车道自动前进跑酷：换道 / 停步 / 宝石 / 气球 / 红灯闸机 / 逆行外卖车 / 丝滑换乘。
// 契约：
//   createRun({seed}) → run
//   run.step(input)      input: { dir?: -1|0|1, lane?: 0|1|2, stop?: bool }
//   run.getHud() → { distance, gems, balloons, station, scene, speed, phase, ... }
//   run.drainEvents() → [ {type, ...} ]
//   run.revive() / run.reviveAvailable()
import {
  WORLD, STEP,
} from '../../config/game.config.js';
import {
  PX_PER_METER, SPEED, PLAYER, BALLOON, GATE, SPAWN, STATION, COMBO, MILESTONE, SCORE,
  clamp, speedAt,
} from '../../config/gameplay.js';
import { stationAt, sceneIndexForStation } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { createSpawner } from './spawner.js';

const REVERSE_SPEED = 7;   // 逆行外卖车额外逼近速度（m/s）
const CULL_M = 8;          // 越过玩家背后多少米后清理
const INVULN_SEC = 2.5;    // 复活后无敌秒数

export function createRun({ seed = 0, startDistance = 0 } = {}) {
  const rng = mulberry32(seed);
  const spawner = createSpawner(rng);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    distance: startDistance,
    lane: 1,
    laneX: WORLD.LANE_X[1],
    laneChangeCd: 0,
    stopped: false,
    stopHoldAcc: 0,
    stopHoldSent: false,
    balloons: 0,
    gems: 0,
    revived: false,
    invulnUntil: -Infinity,
    lastLaneChangeAt: -Infinity,
    quickLaneChanges: 0,
    smoothTransfers: 0,
    obstacles: [],
    pickups: [],
    spawner,
    nextSpawnZ: startDistance + 8,
    nextId: 1,
    stationReached: 1,
    sceneReached: 1,
    lastMile: 0,
    events: [],
    stats: {
      distance: 0,
      stationReached: 1,
      gems: 0,
      smoothTransfers: 0,
      sceneReached: 1,
    },
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.revive = () => revive(run);
  run.reviveAvailable = () => run.phase === 'dead' && !run.revived;
  return run;
}

// 兼容旧骨架别名
export function createSim() { return createRun({ seed: 0 }); }
export function updateSim(run, input = {}) {
  const dir = input.left ? -1 : input.right ? 1 : 0;
  run.step({ dir, stop: !!input.jump });
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const stopped = !!input.stop;
  run.stopped = stopped;

  // 1) 换道（冷却 0.12s，连续换道需节奏）
  let target = run.lane;
  if (input.lane === 0 || input.lane === 1 || input.lane === 2) target = input.lane;
  else if (input.dir === -1 || input.dir === 1) target = clamp(run.lane + input.dir, 0, 2);
  if (target !== run.lane && run.laneChangeCd <= 0) {
    run.lane = target;
    run.laneX = WORLD.LANE_X[target];
    run.laneChangeCd = PLAYER.LANE_CHANGE_CD;
    onLaneChange(run);
  }
  run.laneChangeCd = Math.max(0, run.laneChangeCd - dt);

  // 2) 停步事件（教学步 / 反馈密度）
  if (stopped) {
    run.stopHoldAcc += dt;
    if (!run.stopHoldSent && run.stopHoldAcc >= PLAYER.STOP_HOLD_MS) {
      run.stopHoldSent = true;
      emit(run, 'stopHold', {});
    }
  } else {
    run.stopHoldAcc = 0;
    run.stopHoldSent = false;
  }

  // 3) 前进（停步时里程不涨）
  const speed = stopped ? 0 : speedAt(run.distance);
  const moved = speed * dt;
  run.distance += moved;

  // 4) 里程里程碑（反馈密度）
  const mile = Math.floor(run.distance / MILESTONE.EVERY_M);
  if (mile > run.lastMile) {
    run.lastMile = mile;
    emit(run, 'milestone', { m: Math.floor(run.distance) });
  }

  // 5) 站 / 场景推进
  const stationIdx = Math.min(STATION.COUNT, Math.floor(run.distance / STATION.DISTANCE_M) + 1);
  if (stationIdx > run.stationReached) {
    run.stationReached = stationIdx;
    emit(run, 'stationEnter', { station: stationIdx, name: stationAt(run.distance).name });
    const scene = sceneIndexForStation(stationIdx);
    if (scene > run.sceneReached) {
      run.sceneReached = scene;
      emit(run, 'sceneEnter', { scene });
    }
  }

  // 6) 生成
  spawnUpTo(run);

  // 7) 移动实体（逆行车额外逼近）
  moveEntities(run, moved, dt);

  // 8) 红灯闸机等待进度（停步累计 1s 转绿）
  updateGates(run, dt);

  // 9) 碰撞 & 拾取
  handleCollisions(run);
  handlePickups(run);

  // 10) 清理
  cull(run);

  run.stats.distance = run.distance;
  run.stats.stationReached = run.stationReached;
  run.stats.gems = run.gems;
  run.stats.smoothTransfers = run.smoothTransfers;
  run.stats.sceneReached = run.sceneReached;
}

// ---------- 换道 / 丝滑换乘 ----------
function onLaneChange(run) {
  emit(run, 'laneChange', { lane: run.lane, x: run.laneX });
  const now = run.time;
  if (now - run.lastLaneChangeAt <= COMBO.SMOOTH_GAP) {
    run.quickLaneChanges += 1;
  } else {
    run.quickLaneChanges = 1;
  }
  run.lastLaneChangeAt = now;
  if (run.quickLaneChanges >= COMBO.SMOOTH_NEED) {
    run.quickLaneChanges = 0;
    run.smoothTransfers += 1;
    run.distance += COMBO.SMOOTH_BONUS_M; // 丝滑换乘里程奖励
    emit(run, 'smoothTransfer', { total: run.smoothTransfers });
  }
}

// ---------- 生成 ----------
function spawnUpTo(run) {
  while (run.nextSpawnZ < run.distance + SPAWN.LOOKAHEAD_M) {
    const z = run.nextSpawnZ;
    const row = run.spawner.row(z, z); // 以行的绝对米数选站/闸机
    if (row.type === 'gate') {
      run.obstacles.push({
        id: run.nextId++, kind: 'gate', lane: null, z,
        state: row.gate.state, progress: 0, resolved: false, dead: false,
      });
    } else {
      for (const o of row.obstacles) {
        run.obstacles.push({ id: run.nextId++, kind: o.kind, lane: o.lane, z, resolved: false, dead: false });
      }
      for (const p of row.pickups) {
        run.pickups.push({ id: run.nextId++, kind: p.kind, lane: p.lane, z, resolved: false, dead: false });
      }
    }
    const station = stationAt(run.distance);
    const gap = Math.max(SPAWN.GAP_MIN, SPAWN.GAP_START - (station.index - 1) * SPAWN.GAP_DECAY);
    run.nextSpawnZ = z + gap;
  }
}

// ---------- 移动实体 ----------
function moveEntities(run, moved, dt) {
  for (const o of run.obstacles) {
    o.z -= moved;
    if (o.kind === 'reverse') o.z -= REVERSE_SPEED * dt;
  }
  for (const p of run.pickups) p.z -= moved;
}

// ---------- 红灯闸机：停满 1s 转绿 ----------
function updateGates(run, dt) {
  if (!run.stopped) return;
  let nearest = null;
  for (const o of run.obstacles) {
    if (o.kind !== 'gate' || o.state !== 'red' || o.resolved || o.dead) continue;
    if (o.z > 0 && o.z <= GATE.ZONE_M) {
      if (!nearest || o.z < nearest.z) nearest = o;
    }
  }
  if (!nearest) return;
  nearest.progress += dt / GATE.WAIT_SEC;
  if (nearest.progress >= 1) {
    nearest.state = 'green';
    emit(run, 'gateOpen', {});
  }
}

// ---------- 碰撞 ----------
function handleCollisions(run) {
  for (const o of run.obstacles) {
    if (o.resolved || o.dead || o.z > 0) continue;
    o.resolved = true;
    if (o.kind === 'gate') {
      if (o.state === 'red') hit(run, o);
      else emit(run, 'gatePass', {});
    } else if (o.lane === run.lane) {
      hit(run, o);
    } else if (Math.abs(o.lane - run.lane) === 1) {
      emit(run, 'nearMiss', { lane: run.lane });
    }
    if (run.phase !== 'playing') return;
  }
}

function hit(run, o) {
  if (run.time < run.invulnUntil) return;
  if (run.balloons > 0) {
    run.balloons -= 1;
    emit(run, 'balloonSave', { kind: o.kind });
    emit(run, 'balloonPop', {});
    if (o.kind === 'gate') o.state = 'green';
    o.dead = true;
    return;
  }
  emit(run, 'hit', { kind: o.kind });
  die(run);
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { distance: run.distance });
}

function revive(run) {
  if (run.phase !== 'dead' || run.revived) return false;
  run.revived = true;
  run.phase = 'playing';
  run.invulnUntil = run.time + INVULN_SEC;
  // 清掉身边障碍，避免复活即死
  for (const o of run.obstacles) if (o.z < 3 && o.z > -1) o.dead = true;
  emit(run, 'revive', {});
  return true;
}

// ---------- 拾取 ----------
function handlePickups(run) {
  for (const p of run.pickups) {
    if (p.resolved || p.dead || p.z > 0) continue;
    p.resolved = true;
    if (p.lane !== run.lane) continue;
    if (p.kind === 'gem') {
      run.gems += 1;
      emit(run, 'gem', { lane: run.lane, gems: run.gems });
    } else if (p.kind === 'balloon') {
      if (run.balloons < BALLOON.MAX) {
        run.balloons += 1;
        emit(run, 'balloonGain', { balloons: run.balloons });
      } else {
        emit(run, 'balloonFull', {});
      }
    }
    p.dead = true;
  }
}

// ---------- 清理 ----------
function cull(run) {
  run.obstacles = run.obstacles.filter((o) => !o.dead && o.z > -CULL_M);
  run.pickups = run.pickups.filter((p) => !p.dead && p.z > -CULL_M);
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const station = stationAt(run.distance);
  return {
    distance: run.distance,
    gems: run.gems,
    balloons: run.balloons,
    station: run.stationReached,
    stationName: station.name,
    scene: run.sceneReached,
    speed: run.stopped ? 0 : speedAt(run.distance),
    phase: run.phase,
    stopped: run.stopped,
    smoothTransfers: run.smoothTransfers,
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

export { PX_PER_METER, WORLD };
