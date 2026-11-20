// HERO VANGUARD · 12 波推进结构
// 敌人类型轮换：蜂群(swarm) / 重甲(armored) / 自爆(kamikaze) / 护盾兵(shield)
// Boss 每 4 波（wave 4 / 8 / 12）；换章换场景包（近轨 / 小行星 / 深空）。

export const WAVES = [
  { wave: 1,  comp: [{ kind: 'swarm', count: 7 }] },
  { wave: 2,  comp: [{ kind: 'swarm', count: 5 }, { kind: 'shield', count: 2 }] },
  { wave: 3,  comp: [{ kind: 'swarm', count: 8 }, { kind: 'armored', count: 1 }] },
  { wave: 4,  comp: [{ kind: 'swarm', count: 5 }, { kind: 'armored', count: 1 }, { kind: 'boss', count: 1 }] },
  { wave: 5,  comp: [{ kind: 'kamikaze', count: 6 }, { kind: 'swarm', count: 5 }] },
  { wave: 6,  comp: [{ kind: 'armored', count: 3 }, { kind: 'shield', count: 3 }] },
  { wave: 7,  comp: [{ kind: 'kamikaze', count: 5 }, { kind: 'armored', count: 3 }] },
  { wave: 8,  comp: [{ kind: 'shield', count: 3 }, { kind: 'kamikaze', count: 4 }, { kind: 'boss', count: 1 }] },
  { wave: 9,  comp: [{ kind: 'swarm', count: 8 }, { kind: 'kamikaze', count: 5 }] },
  { wave: 10, comp: [{ kind: 'armored', count: 4 }, { kind: 'shield', count: 4 }] },
  { wave: 11, comp: [{ kind: 'kamikaze', count: 6 }, { kind: 'armored', count: 4 }] },
  { wave: 12, comp: [{ kind: 'shield', count: 4 }, { kind: 'armored', count: 3 }, { kind: 'boss', count: 1 }] },
];

// 每波敌人总数（供 HUD 显示进度与 spawner 计数）
export function waveComp(wave) {
  return WAVES[Math.min(WAVES.length - 1, Math.max(0, wave - 1))].comp;
}
