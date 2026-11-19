// POKER RUSH 7 · 关卡数据（20 关）
// 数值源自源码 game06.json（P0 1:1），并补充新机制字段。
// 字段：
//   index           1 基关卡号
//   countdownSec    3-2-1 倒计时总时长（s）
//   revealSec       目标卡展示时长（s）
//   targetRate      目标卡出现概率
//   speed           移动速度（× 屏宽/秒）
//   canErrorCount   允许点错次数（超过判负）
//   canMissRate     漏接容忍系数（canMissCount = MISS_BASE + round(canMissRate*4)）
//   timeLimit       回合时长（s），走完 = 过关
//   rockRate        干扰卡中「岩石卡」占比（L3 起 >0）
//   decoyRate       干扰卡中「同底色异花色点数」混淆卡占比（L5 起 >0）
//   direction       初始流向：'left' | 'right'

const LEVELS_RAW = [
  { index: 1,  targetRate: 0.60, speed: 0.25, canErrorCount: 0, canMissRate: 0.30, rockRate: 0.00, decoyRate: 0.00 },
  { index: 2,  targetRate: 0.60, speed: 0.30, canErrorCount: 0, canMissRate: 0.30, rockRate: 0.00, decoyRate: 0.00 },
  { index: 3,  targetRate: 0.60, speed: 0.40, canErrorCount: 0, canMissRate: 0.30, rockRate: 0.10, decoyRate: 0.00 },
  { index: 4,  targetRate: 0.60, speed: 0.50, canErrorCount: 0, canMissRate: 0.35, rockRate: 0.12, decoyRate: 0.00 },
  { index: 5,  targetRate: 0.65, speed: 0.60, canErrorCount: 0, canMissRate: 0.35, rockRate: 0.14, decoyRate: 0.10 },
  { index: 6,  targetRate: 0.65, speed: 0.70, canErrorCount: 0, canMissRate: 0.35, rockRate: 0.16, decoyRate: 0.12 },
  { index: 7,  targetRate: 0.65, speed: 0.80, canErrorCount: 0, canMissRate: 0.40, rockRate: 0.18, decoyRate: 0.14 },
  { index: 8,  targetRate: 0.65, speed: 0.90, canErrorCount: 1, canMissRate: 0.40, rockRate: 0.18, decoyRate: 0.16 },
  { index: 9,  targetRate: 0.70, speed: 1.00, canErrorCount: 1, canMissRate: 0.40, rockRate: 0.20, decoyRate: 0.18 },
  { index: 10, targetRate: 0.70, speed: 1.10, canErrorCount: 1, canMissRate: 0.45, rockRate: 0.20, decoyRate: 0.20 },
  { index: 11, targetRate: 0.70, speed: 1.20, canErrorCount: 1, canMissRate: 0.45, rockRate: 0.22, decoyRate: 0.22 },
  { index: 12, targetRate: 0.70, speed: 1.30, canErrorCount: 1, canMissRate: 0.45, rockRate: 0.22, decoyRate: 0.24 },
  { index: 13, targetRate: 0.75, speed: 1.40, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.24, decoyRate: 0.26 },
  { index: 14, targetRate: 0.75, speed: 1.50, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.24, decoyRate: 0.28 },
  { index: 15, targetRate: 0.75, speed: 1.60, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.26, decoyRate: 0.30 },
  { index: 16, targetRate: 0.75, speed: 1.70, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.26, decoyRate: 0.30 },
  { index: 17, targetRate: 0.75, speed: 1.80, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.28, decoyRate: 0.32 },
  { index: 18, targetRate: 0.75, speed: 1.90, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.28, decoyRate: 0.32 },
  { index: 19, targetRate: 0.75, speed: 2.00, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.30, decoyRate: 0.34 },
  { index: 20, targetRate: 0.75, speed: 2.10, canErrorCount: 1, canMissRate: 0.50, rockRate: 0.30, decoyRate: 0.34 },
];

export const LEVELS = LEVELS_RAW.map((raw, i) => ({
  ...raw,
  countdownSec: 1.5,
  revealSec: 2.6,
  timeLimit: 60,
  direction: i % 2 === 0 ? 'right' : 'left',
}));

export const LEVEL_COUNT = LEVELS.length;
