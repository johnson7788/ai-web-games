// STAR SLAYER · 12 波推进结构 + 敌型定义 + 三场景包
// 敌型：突袭者（近身自爆）/ 裂刃（冲刺）/ 织网蛛（束缚）/ 飞梭（自杀冲撞）/ 炮台（远程）
// 场景：0 舰桥（蓝白）/ 1 舰体外壳（灰橙）/ 2 反应堆（青紫）；每 4 波换章。

export const SCENES = [
  { id: 0, key: 'scene.bridge',   name: 'bridge' },
  { id: 1, key: 'scene.hull',     name: 'hull' },
  { id: 2, key: 'scene.reactor',  name: 'reactor' },
];

// 敌型数值：hp 是第 1 波基础值，之后乘 hpMult(wave)
export const ENEMY_TYPES = {
  raider: { // 突袭者：直线追近，贴身自爆
    name: 'raider',
    hp: 30,
    speed: 96,
    r: 14,
    touchDmg: 15,
    score: 10,
    color: '#ff5d73',
  },
  striker: { // 裂刃：周期性冲刺 + 接触伤害
    name: 'striker',
    hp: 55,
    speed: 130,
    r: 15,
    touchDmg: 12,
    score: 15,
    color: '#ff9e4f',
  },
  weaver: { // 织网蛛：从顶下降，接触后束缚玩家
    name: 'weaver',
    hp: 42,
    speed: 70,
    r: 13,
    touchDmg: 8,
    score: 18,
    color: '#b45fff',
  },
  shuttle: { // 飞梭：高速横穿场地
    name: 'shuttle',
    hp: 26,
    speed: 420,
    r: 12,
    touchDmg: 20,
    score: 12,
    color: '#ff8a4d',
  },
  turret: { // 炮台：保持距离，发射慢速弹
    name: 'turret',
    hp: 60,
    speed: 55,
    r: 16,
    touchDmg: 6,
    score: 22,
    color: '#ff6fb0',
    fireGap: 1.6,
    bulletDmg: 14,
  },
  boss: { // 核心巨兽：激光扇形 + 炸弹弹幕，死亡分裂
    name: 'boss',
    hp: 1400,
    speed: 40,
    r: 46,
    touchDmg: 25,
    score: 500,
    color: '#ff3d5a',
  },
};

export const HP_MULT_BASE = 1;
export const HP_MULT_STEP = 0.30; // 每波 +30% 血量

export function hpMult(wave) {
  return HP_MULT_BASE + (Math.max(1, wave) - 1) * HP_MULT_STEP;
}

// 12 波：types = [{type, count}]；boss 波每 3 波一次
export const WAVES = [
  { wave: 1, scene: 0, types: [{ type: 'raider', count: 6 }], spawnGap: 0.55 },
  { wave: 2, scene: 0, types: [{ type: 'raider', count: 4 }, { type: 'striker', count: 3 }], spawnGap: 0.5 },
  { wave: 3, scene: 0, boss: true, types: [{ type: 'raider', count: 3 }], spawnGap: 0.9 },
  { wave: 4, scene: 0, types: [{ type: 'raider', count: 5 }, { type: 'turret', count: 3 }], spawnGap: 0.5 },
  { wave: 5, scene: 1, types: [{ type: 'striker', count: 5 }, { type: 'weaver', count: 3 }], spawnGap: 0.45 },
  { wave: 6, scene: 1, boss: true, types: [{ type: 'shuttle', count: 4 }], spawnGap: 0.7 },
  { wave: 7, scene: 1, types: [{ type: 'raider', count: 5 }, { type: 'turret', count: 4 }, { type: 'striker', count: 4 }], spawnGap: 0.4 },
  { wave: 8, scene: 1, types: [{ type: 'weaver', count: 4 }, { type: 'shuttle', count: 4 }, { type: 'turret', count: 4 }], spawnGap: 0.4 },
  { wave: 9, scene: 2, boss: true, types: [{ type: 'raider', count: 4 }], spawnGap: 0.6 },
  { wave: 10, scene: 2, types: [{ type: 'striker', count: 6 }, { type: 'turret', count: 5 }, { type: 'weaver', count: 3 }], spawnGap: 0.35 },
  { wave: 11, scene: 2, types: [{ type: 'raider', count: 6 }, { type: 'shuttle', count: 5 }, { type: 'turret', count: 5 }, { type: 'weaver', count: 4 }], spawnGap: 0.3 },
  { wave: 12, scene: 2, boss: true, types: [{ type: 'striker', count: 4 }, { type: 'shuttle', count: 4 }], spawnGap: 0.5 },
];

export const WAVE_COUNT = WAVES.length;

export function waveAt(n) {
  return WAVES[Math.min(WAVE_COUNT - 1, Math.max(0, n - 1))];
}

// 构建某波的全部生成队列（按 spawnGap 错开）
export function buildSpawnQueue(wave) {
  const w = waveAt(wave);
  const queue = [];
  let t = 0.4;
  // Boss 波先出 Boss（带预警），再出小怪
  if (w.boss) {
    queue.push({ type: 'boss', delay: 0.9 });
    t = 1.6;
  }
  for (const grp of w.types) {
    for (let i = 0; i < grp.count; i += 1) {
      queue.push({ type: grp.type, delay: t });
      t += w.spawnGap;
    }
  }
  return queue;
}
