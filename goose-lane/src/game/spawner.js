// src/game/spawner.js — 障碍行/闸机/拾取物生成（纯逻辑，可复现）。
// 保证每一行至少留一条安全车道；闸机单独成行并在前后留清空，保证可安全停步。
import { STATION, SPAWN, GATE } from '../../config/gameplay.js';
import { stationAt } from '../../config/levels.js';
import { chance, pick } from './rng.js';

const GATE_GAP_M = 26;         // 闸机站内闸机间隔（米）
const LANES = [0, 1, 2];

export function createSpawner(rng) {
  const state = { lastGateZ: -Infinity, rows: 0 };
  return { row, reset };

  function reset() {
    state.lastGateZ = -Infinity;
    state.rows = 0;
  }

  function row(z, distance) {
    const station = stationAt(distance);
    const rows = state.rows;
    state.rows += 1;

    // 闸机站：隔一定距离成行出现，且距上一闸机足够远、远离站起始（避免一进站就卡）
    const intoStation = distance - (station.index - 1) * STATION.DISTANCE_M;
    if (station.gate && z - state.lastGateZ >= GATE_GAP_M && intoStation > 6) {
      state.lastGateZ = z;
      return { type: 'gate', gate: { state: chance(rng, 0.6) ? 'red' : 'green' }, pickups: [] };
    }

    // 障碍行：blockedCount 由窄缝/密度决定
    let blockedCount = station.narrow ? 2 : (chance(rng, Math.min(0.9, Math.max(0.25, station.density - 0.35))) ? 2 : 1);
    const blocked = shuffle(LANES.slice(), rng).slice(0, blockedCount);
    const free = LANES.filter((l) => !blocked.includes(l));

    const obstacles = blocked.map((lane) => {
      let kind = pick(rng, station.hazards);
      // 窄缝里不放大块逆行，只放静车/坑，保证缝可读
      if (station.narrow && kind === 'reverse') kind = 'car';
      return { kind, lane };
    });

    // 拾取物只放安全车道；前两行保证教学能捡到宝石/气球
    const pickups = [];
    const balloonHeavy = station.balloonHeavy === true;
    const gemChance = SPAWN.GEM_CHANCE + (rows < 3 ? 0.5 : 0);
    const balloonChance = balloonHeavy ? 0.55 : SPAWN.BALLOON_CHANCE;

    for (const lane of free) {
      if (chance(rng, gemChance)) pickups.push({ kind: 'gem', lane });
    }
    // 前两行保证教学能捡到宝石 / 气球
    if (rows === 0) pickups.push({ kind: 'gem', lane: free[0] ?? 1 });
    if (rows === 1) pickups.push({ kind: 'balloon', lane: free[free.length - 1] ?? 1 });
    else if (free.length && chance(rng, balloonChance)) pickups.push({ kind: 'balloon', lane: pick(rng, free) });

    return { type: 'hazard', obstacles, pickups };
  }
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const LANE_COUNT = 3;
export { GATE_GAP_M };
