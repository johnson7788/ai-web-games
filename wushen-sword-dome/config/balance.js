// 玩法数值（全部集中在此，逻辑层不写死数字）
// 伤害公式（沿用原作风味）：
//   hurtPer  = max(0.2, (攻击方臂力 - 防守方根骨) / 攻击方臂力)
//   attack   = floor(weaponAttack * hurtPer * critMult * comboMult * buffMult)
// 内力恢复：每 0.32s 恢复 maxMp/30（约 9.6s 回满）。

export const FIGHTER_BASE = {
  maxHp: 1200,
  maxMp: 300,
  strength: 300,     // 臂力
  bone: 120,         // 根骨（越高受伤越少）
  critProb: 20,      // 暴击率 %
  critHarm: 150,     // 暴伤 %（150 = 1.5x）
};

// 三关对手（stage 1..3）
export const STAGES = [
  {
    name: 'neon-apprentice',   // 霓虹学徒
    maxHp: 700,
    maxMp: 260,
    strength: 220,
    bone: 90,
    critProb: 10,
    critHarm: 130,
    ai: { think: 1.2, aggression: 0.6, dodgeReflex: 0.3, skillBias: 0.3 },
  },
  {
    name: 'blade-veteran',     // 剑刃老手
    maxHp: 950,
    maxMp: 300,
    strength: 260,
    bone: 110,
    critProb: 15,
    critHarm: 140,
    ai: { think: 1.0, aggression: 0.8, dodgeReflex: 0.5, skillBias: 0.55 },
  },
  {
    name: 'dome-overlord',     // 穹顶霸主
    maxHp: 1250,
    maxMp: 340,
    strength: 300,
    bone: 130,
    critProb: 20,
    critHarm: 150,
    ai: { think: 0.72, aggression: 0.95, dodgeReflex: 0.7, skillBias: 0.75 },
  },
];

// 玩家三把兵器（index 0..2 对应底部三个按钮）
export const PLAYER_WEAPONS = [
  {
    key: 'light', type: 1, attack: 120, cost: 25, cd: 0.8, durable: 20,
    skillId: 'poison', skillProb: 25, skill: { poison: { time: 6, total: 120 } },
  },
  {
    key: 'arc', type: 2, attack: 150, cost: 40, cd: 1.4, durable: 22,
    skillId: 'multi', skillProb: 22, skill: { multi: { count: 3, spread: 90 } },
  },
  {
    key: 'heavy', type: 3, attack: 220, cost: 60, cd: 2.2, durable: 30,
    skillId: 'crit', skillProb: 20, skill: { crit: { chance: 100, mult: 2.0 } },
  },
];

// 对手兵器（按关数取用，越往后越强）
export const ENEMY_WEAPONS = [
  [
    { key: 'e-light', type: 1, attack: 90, cost: 25, cd: 1.6, durable: 18, skillId: null, skillProb: 0, skill: {} },
    { key: 'e-arc', type: 2, attack: 110, cost: 40, cd: 2.2, durable: 20, skillId: null, skillProb: 0, skill: {} },
  ],
  [
    { key: 'e-light', type: 1, attack: 110, cost: 25, cd: 1.4, durable: 20, skillId: 'poison', skillProb: 18, skill: { poison: { time: 5, total: 90 } } },
    { key: 'e-arc', type: 2, attack: 140, cost: 40, cd: 2.0, durable: 22, skillId: null, skillProb: 0, skill: {} },
    { key: 'e-heavy', type: 3, attack: 180, cost: 60, cd: 2.8, durable: 26, skillId: 'multi', skillProb: 18, skill: { multi: { count: 2, spread: 70 } } },
  ],
  [
    { key: 'e-light', type: 1, attack: 130, cost: 25, cd: 1.2, durable: 22, skillId: 'poison', skillProb: 20, skill: { poison: { time: 5, total: 110 } } },
    { key: 'e-arc', type: 2, attack: 160, cost: 40, cd: 1.7, durable: 24, skillId: 'multi', skillProb: 20, skill: { multi: { count: 2, spread: 70 } } },
    { key: 'e-heavy', type: 3, attack: 210, cost: 60, cd: 2.4, durable: 30, skillId: 'crit', skillProb: 20, skill: { crit: { chance: 100, mult: 1.8 } } },
  ],
];

// 玩家两个主动技能
export const PLAYER_SKILLS = [
  { key: 'dragon', nameKey: 'skillDragon', kind: 'dragon', cost: 50, cd: 8, attack: 300, type: 4 },
  { key: 'surge', nameKey: 'skillSurge', kind: 'surge', cost: 60, cd: 12, healPct: 0.15, mpBoost: 2, boostTime: 5 },
];

// 对手主动技能（stage 2/3 使用）
export const ENEMY_SKILLS = [
  { key: 'enemy-surge', kind: 'surge', cost: 60, cd: 14, healPct: 0.1, mpBoost: 1.5, boostTime: 5 },
  { key: 'enemy-blast', kind: 'dragon', cost: 50, cd: 9, attack: 260, type: 4 },
];

export const DODGE = {
  cost: 0,
  cd: 6,        // 闪避冷却
  invuln: 0.9,  // 无敌时长
};

export const COMBO = {
  max: 10,      // 最大连击
  per: 0.1,     // 每层连击伤害加成（10 层 = +100%）
  resetOnHit: true,
};

export const ORB = {
  spawnEvery: 5.0,   // 每隔多少秒生成
  lifetime: 4.0,     // 存在时长
  x: 640,
  y: 420,
  kinds: ['heal', 'mp', 'power'],
  heal: 220,
  mp: 150,
  powerMult: 1.3,
  powerTime: 8,
};

// 兵器飞行
export const PROJECTILE = {
  speed: 520,        // 水平速度 px/s
  arc: [0, 130, 220, 320],  // type 1..3 的抛物线峰值高度（type4 走技能）
  skillArc: 340,     // 技能 4 号轨迹峰值
};

export const AI = {
  mpReserve: 0.1,     // AI 保留内力比例（不花光）
  reactDistance: 320, // 敌人兵器逼近到该距离时考虑闪避
};
