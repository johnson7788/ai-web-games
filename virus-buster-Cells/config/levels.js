// 关卡波次设计（纯数据，供 sim 使用）。
// Level 1 保持 P0 结构：三波病毒，第三波带 BOSS（高血量）。
// Level 2 起加入晶体碎片（打不碎、需躲避）；Level %3==0 为 BOSS 关。
export function levelWaves(level) {
  const lv = Math.max(1, level | 0);
  if (lv === 1) {
    return [
      [1, 1, 1, 1, 6, 3, 1, 1, 1],
      [2, 2, 2, 6, 4, 2, 2, 2],
      [2, 2, 2, 24, 4, 2, 2, 2],
    ];
  }

  const waves = [];
  const waveCount = lv === 2 ? 3 : 4;
  const bossHp = lv % 3 === 0 ? 20 + lv * 14 : 0;
  for (let w = 0; w < waveCount; w += 1) {
    const n = 7 + Math.min(7, lv);
    const row = [];
    for (let i = 0; i < n; i += 1) {
      let hp = 1 + Math.floor(lv * 1.7) + (i % 3 === 0 ? lv * 2 : 0);
      hp = Math.min(hp, 20);
      row.push(hp);
    }
    if (w === waveCount - 1 && bossHp) row.push(bossHp);
    waves.push(row);
  }
  return waves;
}

// 本关活跃晶体碎片数量（Level 1 为 0，之后随关卡增长，封顶 5）
export function crystalCount(level) {
  const lv = Math.max(1, level | 0);
  if (lv <= 1) return 0;
  return Math.min(5, lv);
}

// 单关总血量（用于进度条）
export function levelTotalHp(level) {
  return levelWaves(level).reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
}
