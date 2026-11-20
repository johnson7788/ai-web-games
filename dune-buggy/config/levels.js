// DUNE BUGGY · 12 赛段定义（拉力赛段制 + 地形轮换）
// 场景包：0 晨沙（金）· 1 午漠（白热）· 2 暮丘（橙紫）
// 字段：length 米 / parSec 目标时间（秒）/ storm 0..1 能见度 / ridgeChance 沙脊覆盖占比
//       rockChance 岩区占比 / jumpChance 跳台占比 / oasisChance 绿洲占比 / curveAmp 弯道幅度

export const STAGES = [
  { index: 1,  name: 'stage.1',  scenePack: 0, length: 320, parSec: 22, storm: 0.00, ridgeChance: 0.00, rockChance: 0.00, jumpChance: 0.00, oasisChance: 0.00, curveAmp: 0.020 },
  { index: 2,  name: 'stage.2',  scenePack: 0, length: 380, parSec: 26, storm: 0.00, ridgeChance: 0.55, rockChance: 0.00, jumpChance: 0.00, oasisChance: 0.10, curveAmp: 0.030 },
  { index: 3,  name: 'stage.3',  scenePack: 0, length: 420, parSec: 30, storm: 0.00, ridgeChance: 0.35, rockChance: 0.30, jumpChance: 0.00, oasisChance: 0.05, curveAmp: 0.038 },
  { index: 4,  name: 'stage.4',  scenePack: 0, length: 460, parSec: 34, storm: 0.00, ridgeChance: 0.35, rockChance: 0.05, jumpChance: 0.16, oasisChance: 0.20, curveAmp: 0.042 },
  { index: 5,  name: 'stage.5',  scenePack: 1, length: 500, parSec: 38, storm: 0.32, ridgeChance: 0.40, rockChance: 0.10, jumpChance: 0.04, oasisChance: 0.06, curveAmp: 0.045 },
  { index: 6,  name: 'stage.6',  scenePack: 1, length: 520, parSec: 40, storm: 0.00, ridgeChance: 0.40, rockChance: 0.42, jumpChance: 0.00, oasisChance: 0.04, curveAmp: 0.048 },
  { index: 7,  name: 'stage.7',  scenePack: 1, length: 560, parSec: 44, storm: 0.00, ridgeChance: 0.80, rockChance: 0.06, jumpChance: 0.00, oasisChance: 0.02, curveAmp: 0.055 },
  { index: 8,  name: 'stage.8',  scenePack: 1, length: 600, parSec: 48, storm: 0.00, ridgeChance: 0.68, rockChance: 0.48, jumpChance: 0.00, oasisChance: 0.00, curveAmp: 0.052 },
  { index: 9,  name: 'stage.9',  scenePack: 2, length: 640, parSec: 52, storm: 0.00, ridgeChance: 0.70, rockChance: 0.05, jumpChance: 0.06, oasisChance: 0.04, curveAmp: 0.050 },
  { index: 10, name: 'stage.10', scenePack: 2, length: 680, parSec: 56, storm: 0.80, ridgeChance: 0.52, rockChance: 0.10, jumpChance: 0.00, oasisChance: 0.00, curveAmp: 0.040 },
  { index: 11, name: 'stage.11', scenePack: 2, length: 720, parSec: 60, storm: 0.00, ridgeChance: 0.90, rockChance: 0.08, jumpChance: 0.04, oasisChance: 0.02, curveAmp: 0.056, twin: true },
  { index: 12, name: 'stage.12', scenePack: 2, length: 800, parSec: 66, storm: 0.40, ridgeChance: 0.55, rockChance: 0.25, jumpChance: 0.10, oasisChance: 0.06, curveAmp: 0.058 },
];

export const STAGE_COUNT = STAGES.length;

export function stageAt(index) {
  return STAGES[Math.min(Math.max(1, index), STAGE_COUNT) - 1];
}
