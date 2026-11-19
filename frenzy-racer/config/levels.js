// 关卡数值：疯狂赛车（Frenzy Racer）· 双车双道反应躲避
// 每关：duration 存活秒数 / goal 收集率门槛 / speed 难度速度 / lead 反应提前量
//       spawnEvery 波次间隔 / starMax·barrierMax 并发上限 / shieldChance 护盾概率
export const LEVELS = [
  { name: { en: 'Neon Dawn', zh: '霓虹黎明' }, duration: 18, timer: 1.5, speed: 1.0, lead: 2.0, spawnEvery: 0.90, starMax: 3, barrierMax: 2, goal: 0.30, shieldChance: 0.10 },
  { name: { en: 'Grid Runner', zh: '网格疾驰' }, duration: 18, timer: 1.5, speed: 1.1, lead: 1.85, spawnEvery: 0.85, starMax: 3, barrierMax: 2, goal: 0.32, shieldChance: 0.10 },
  { name: { en: 'Laser Alley', zh: '激光小巷' }, duration: 18, timer: 1.5, speed: 1.2, lead: 1.70, spawnEvery: 0.80, starMax: 3, barrierMax: 3, goal: 0.34, shieldChance: 0.12 },
  { name: { en: 'Chrome Canyon', zh: '铬金峡谷' }, duration: 18, timer: 1.5, speed: 1.3, lead: 1.60, spawnEvery: 0.80, starMax: 3, barrierMax: 3, goal: 0.36, shieldChance: 0.12 },
  { name: { en: 'Volt Sprint', zh: '伏特冲刺' }, duration: 20, timer: 1.5, speed: 1.4, lead: 1.50, spawnEvery: 0.75, starMax: 4, barrierMax: 3, goal: 0.38, shieldChance: 0.12 },
  { name: { en: 'Overdrive', zh: '过载狂飙' }, duration: 20, timer: 1.5, speed: 1.5, lead: 1.40, spawnEvery: 0.75, starMax: 4, barrierMax: 3, goal: 0.40, shieldChance: 0.14 },
  { name: { en: 'Photon Rush', zh: '光子冲线' }, duration: 20, timer: 1.5, speed: 1.6, lead: 1.30, spawnEvery: 0.70, starMax: 4, barrierMax: 4, goal: 0.42, shieldChance: 0.14 },
  { name: { en: 'Blitz Circuit', zh: '闪电赛道' }, duration: 20, timer: 1.5, speed: 1.7, lead: 1.20, spawnEvery: 0.70, starMax: 4, barrierMax: 4, goal: 0.44, shieldChance: 0.14 },
  { name: { en: 'Hyperloop', zh: '超级环路' }, duration: 22, timer: 1.5, speed: 1.8, lead: 1.10, spawnEvery: 0.65, starMax: 5, barrierMax: 4, goal: 0.46, shieldChance: 0.16 },
  { name: { en: 'Sunset Vector', zh: '落日矢量' }, duration: 22, timer: 1.5, speed: 1.9, lead: 1.00, spawnEvery: 0.65, starMax: 5, barrierMax: 4, goal: 0.48, shieldChance: 0.16 },
  { name: { en: 'Turbo Mirage', zh: '涡轮幻影' }, duration: 22, timer: 1.5, speed: 2.1, lead: 0.90, spawnEvery: 0.60, starMax: 5, barrierMax: 5, goal: 0.50, shieldChance: 0.16 },
  { name: { en: 'Final Frenzy', zh: '终章疯狂' }, duration: 24, timer: 1.5, speed: 2.3, lead: 0.80, spawnEvery: 0.60, starMax: 5, barrierMax: 5, goal: 0.52, shieldChance: 0.18 },
];

export const LEVEL_COUNT = LEVELS.length;
