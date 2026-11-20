// FISH FRENZY · 12 场推进结构
// 每场：限时 durationSec + 营收目标 revenueTarget；达标晋级，超时或金币打空判负。
// roster = 可出现的鱼种 id 列表；paths = 可用的路径 id 列表；scene = 场景包（1 珊瑚/2 深沟/3 热泉）
// boss:true 的场次会周期性出巨口鲨（需高档炮）；unlockElectric 表示该场起解锁电击网。

export const STAGES = [
  { index: 1,  scene: 1, durationSec: 45, revenueTarget: 120,  roster: [1, 2, 4],          groupSize: [2, 3], spawnInterval: 2.2, paths: [1, 2] },
  { index: 2,  scene: 1, durationSec: 45, revenueTarget: 200,  roster: [1, 2, 3, 4],       groupSize: [2, 4], spawnInterval: 2.0, paths: [1, 2, 3] },
  { index: 3,  scene: 1, durationSec: 50, revenueTarget: 320,  roster: [2, 3, 4, 5],       groupSize: [2, 4], spawnInterval: 1.8, paths: [1, 2, 3, 4] },
  { index: 4,  scene: 1, durationSec: 50, revenueTarget: 460,  roster: [3, 4, 5, 6],       groupSize: [1, 3], spawnInterval: 1.6, paths: [1, 2, 3, 5], boss: true },
  { index: 5,  scene: 2, durationSec: 50, revenueTarget: 620,  roster: [4, 5, 6],          groupSize: [2, 3], spawnInterval: 1.6, paths: [2, 3, 5, 6] },
  { index: 6,  scene: 2, durationSec: 55, revenueTarget: 820,  roster: [5, 6, 7],          groupSize: [1, 3], spawnInterval: 1.5, paths: [2, 3, 5, 6] },
  { index: 7,  scene: 2, durationSec: 55, revenueTarget: 1050, roster: [6, 7],             groupSize: [2, 4], spawnInterval: 1.4, paths: [5, 6], unlockElectric: true },
  { index: 8,  scene: 2, durationSec: 55, revenueTarget: 1300, roster: [6, 7, 8],          groupSize: [1, 3], spawnInterval: 1.3, paths: [5, 6], boss: true },
  { index: 9,  scene: 3, durationSec: 55, revenueTarget: 1600, roster: [7, 8],             groupSize: [2, 3], spawnInterval: 1.3, paths: [1, 3, 5, 6] },
  { index: 10, scene: 3, durationSec: 60, revenueTarget: 2000, roster: [8, 9],             groupSize: [1, 2], spawnInterval: 1.2, paths: [1, 3, 5, 6] },
  { index: 11, scene: 3, durationSec: 60, revenueTarget: 2500, roster: [9],                groupSize: [1, 2], spawnInterval: 1.1, paths: [2, 3, 5, 6] },
  { index: 12, scene: 3, durationSec: 70, revenueTarget: 3300, roster: [9],                groupSize: [1, 1], spawnInterval: 1.0, paths: [2, 3], boss: true },
];

export const STAGE_COUNT = STAGES.length;

export function stageAt(index) {
  return STAGES[clampStage(index) - 1];
}

export function clampStage(n) {
  return Math.max(1, Math.min(STAGE_COUNT, Math.floor(n) || 1));
}
