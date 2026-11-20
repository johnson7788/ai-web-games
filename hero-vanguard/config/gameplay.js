// HERO VANGUARD · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/report.md（事件名/字段一字不差）

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280, // 逻辑世界宽（px）
  HEIGHT: 720, // 逻辑世界高（px）
  BASE_X: 96,  // 轨道站（基地）x 位置
  BASE_R: 52,  // 基地碰撞半径
  PLAY_ZONE_TOP: 350, // 英雄移动区上界（英雄在底部区域活动）
  PLAY_ZONE_BOTTOM: 690,
  PLAY_ZONE_LEFT: 170,
  PLAY_ZONE_RIGHT: 1230,
};

export const STEP = 1 / 60; // 固定步长（秒）

// ---- 基地（轨道站防线）----
export const BASE = {
  MAX_HP: 70,
  MAX_SHIELD: 60,      // 护盾分配技能可叠加的护盾上限
  SHIELD_CHARGE: 26,   // 一次充能提供的护盾
  CHARGE_TIME: 2.0,    // 站桩充能时长（秒）
};

// ---- 双子英雄 ----
export const HERO = {
  RADIUS: 24,
  SPEED: 300,          // 受控移动速度（px/s）
  AI_SPEED: 210,       // AI 协同时移动速度（px/s）
  SWAP_CD: 2.2,        // 换位共鸣冷却
  SWAP_DAMAGE: 20,     // 换位路径伤害
  SWAP_RANGE: 90,      // 换位路径宽度
};

export const HEROES = [
  {
    id: 0,
    kind: 'blade',     // 近战刃
    range: 120,
    atk: 9,
    atkInterval: 0.6,
    speed: 300,
    color: '#7ff2ff',
  },
  {
    id: 1,
    kind: 'bow',       // 远程弓
    range: 340,
    atk: 6,
    atkInterval: 0.75,
    speed: 300,
    color: '#ffd166',
  },
];

// ---- 技能 ----
export const SKILL = {
  resonance: {
    cd: 6.0,
    radius: 150,       // 基础范围
    radiusNearMult: 1.5, // 双英接近（<nearDist）时范围倍率
    nearDist: 230,
    damage: 52,
  },
  shield: {
    cd: 10.0,
    channel: 2.0,
    amount: 26,
  },
};

// ---- 敌人 ----
export const ENEMY = {
  SWARM:     { kind: 'swarm',     hp: 28,  dmg: 2,  speed: 130, gold: 6,  radius: 15, color: '#ff7a8a' },
  ARMORED:   { kind: 'armored',   hp: 200, dmg: 6,  speed: 55,  gold: 16, radius: 26, color: '#ff9f43' },
  KAMIKAZE:  { kind: 'kamikaze',  hp: 20,  dmg: 12, speed: 230, gold: 10, radius: 14, color: '#ff5470' },
  SHIELD:    { kind: 'shield',    hp: 140, shield: 50, dmg: 3, speed: 65,  gold: 18, radius: 24, color: '#c39bff' },
  BOSS:      { kind: 'boss',      hp: 620, dmg: 16, speed: 38,  gold: 120, radius: 44, color: '#ff2d55' },
};

// ---- 升级池（≥8，规则型 ≥35%）----
export const UPGRADES = [
  { id: 'bladeAtk',   kind: 'stat', title: 'bladeAtk',   desc: '+55% 刃攻击' },
  { id: 'bowAtk',     kind: 'stat', title: 'bowAtk',     desc: '+55% 弓攻击' },
  { id: 'atkSpeed',   kind: 'stat', title: 'atkSpeed',   desc: '+22% 攻速' },
  { id: 'baseMax',    kind: 'stat', title: 'baseMax',    desc: '+30 基地耐久' },
  { id: 'heroSpeed',  kind: 'stat', title: 'heroSpeed',  desc: '+18% 移动速度' },
  { id: 'resonanceRange', kind: 'rule', title: 'resonanceRange', desc: '共鸣斩范围 +50%' },
  { id: 'swapDamage', kind: 'rule', title: 'swapDamage',  desc: '换位伤害翻倍' },
  { id: 'shieldLink', kind: 'rule', title: 'shieldLink',  desc: '充能时每秒回 1 基地耐久' },
  { id: 'vampiric',   kind: 'rule', title: 'vampiric',    desc: '击杀回复 1 基地耐久' },
  { id: 'chainBow',   kind: 'rule', title: 'chainBow',    desc: '弓可再穿透 1 个敌人' },
  { id: 'twinLink',   kind: 'rule', title: 'twinLink',    desc: '双英靠近时攻速 +30%' },
];

export const WAVE_COUNT = 12;
export const SCENES = [
  { id: 0, key: 'orbit',    firstWave: 1, lastWave: 4 },
  { id: 1, key: 'asteroid', firstWave: 5, lastWave: 8 },
  { id: 2, key: 'deep',     firstWave: 9, lastWave: 12 },
];

// ---- 波间节奏 ----
export const FLOW = {
  WAVE_GAP: 2.0,          // 波结束 → 升级屏的延迟
  UPGRADE_TIMEOUT: 6.0,   // 升级屏无选择自动随机选
  SPAWN_INTERVAL_MIN: 0.3,
  SPAWN_INTERVAL_MAX: 0.6,
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function sceneForWave(wave) {
  for (const s of SCENES) {
    if (wave >= s.firstWave && wave <= s.lastWave) return s;
  }
  return SCENES[SCENES.length - 1];
}
