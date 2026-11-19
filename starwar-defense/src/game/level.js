// 关卡（波次）配置：程序化难度曲线。第 5 波 = Boss 波。
// 纯逻辑，无 DOM。

export const LEVEL_COUNT = 99; // 理论上无限波，展示层只显示「最高波次」

export function levelConfig(levelIndex) {
  const n = Math.max(1, (levelIndex | 0) + 1); // 1 基波次
  const boss = n % 5 === 0;
  return {
    waveCount: Math.min(12, 5 + n),
    enemiesPerWave: Math.min(8, 3 + (n >= 2 ? 1 : 0) + (n >= 4 ? 1 : 0) + (n >= 8 ? 1 : 0)),
    spawnInterval: Math.max(0.85, 1.3 - n * 0.05),
    enemyHp: Math.round(16 + n * 3),
    enemySpeed: Math.min(85, 48 + n * 3),
    boss,
    bossHp: Math.round((16 + n * 3) * 14),
    bossSpeed: Math.min(40, 26 + n * 1.2),
    leakLimit: boss ? 1 : 5,
    unlock2: n >= 2,
    unlock3: n >= 3,
  };
}
