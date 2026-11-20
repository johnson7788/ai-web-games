// ACE GUNNER · 关卡数据（12 波推进结构；sim 拥有）
// 坐标约定：y 用 lane 下标（0..3）映射到道路四条道；x 由 sim 用 SPAWN_X 生成。
// 敌人种类：foot 步匪 / rider 马匪 / shield 盾匪 / barrel 炸药桶 / boss 酋长。
// 字段：index/scene/newElement/enemies（{kind,lane,at} 按 at 秒错峰入场）。

export const LANE_Y = [200, 330, 460, 590];
export const LANE_COUNT = LANE_Y.length;

// 敌人基础数值（sim 从这读；单波可覆盖）
export const ENEMY = {
  foot:   { hp: 30, speed: 22, damage: 8,  radius: 18, gold: 6,  mass: 'infantry' },
  rider:  { hp: 20, speed: 55, damage: 6,  radius: 16, gold: 8,  mass: 'cavalry' },
  shield: { hp: 55, speed: 16, damage: 10, radius: 20, gold: 12, mass: 'armored', shieldHp: 45 },
  barrel: { hp: 10, speed: 14, damage: 45, radius: 22, gold: 10, mass: 'siege', explodeRadius: 110, wallDanger: 230 },
  boss:   { hp: 420, speed: 20, damage: 25, radius: 40, gold: 80, mass: 'boss' },
};

export const WAVE_COUNT = 12;

// 每波场景与特性（场景三章：1-4 正午荒漠 / 5-8 沙暴边境 / 9-12 星夜要塞）
export const LEVELS = [
  { index: 1, scene: 'noon-desert', newElement: '步匪（foot）沿道路逼近' },
  { index: 2, scene: 'noon-desert', newElement: '马匪（rider）快而脆' },
  { index: 3, scene: 'noon-desert', newElement: '盾匪（shield）先射腿才破防' },
  { index: 4, scene: 'noon-desert', newElement: '炸药桶（barrel）射爆清群、靠墙炸城' },
  { index: 5, scene: 'sandstorm-border', newElement: '沙暴（命中与视野受扰）' },
  { index: 6, scene: 'sandstorm-border', newElement: '双门进攻（上下两路同时压上）' },
  { index: 7, scene: 'sandstorm-border', newElement: '盾匪 + 马匪混编' },
  { index: 8, scene: 'sandstorm-border', newElement: '酋长 Boss（血条 + 阶段）' },
  { index: 9, scene: 'starry-fortress', newElement: '夜袭（视野受限，火把照区）' },
  { index: 10, scene: 'starry-fortress', newElement: '精英盾匪 + 炸药桶混编' },
  { index: 11, scene: 'starry-fortress', newElement: '快速马匪群（rush）' },
  { index: 12, scene: 'starry-fortress', newElement: '终局大围攻（全兵种叠加）' },
];

// 每波的敌人排布（at = 从本波开始起的秒数）
export const WAVE_ENEMIES = [
  // 1 纯步匪
  [{ kind: 'foot', lane: 1, at: 0 }, { kind: 'foot', lane: 2, at: 0.8 }, { kind: 'foot', lane: 0, at: 1.6 }, { kind: 'foot', lane: 3, at: 2.4 }, { kind: 'foot', lane: 1, at: 3.2 }, { kind: 'foot', lane: 2, at: 4.0 }],
  // 2 马匪（快）
  [{ kind: 'rider', lane: 1, at: 0 }, { kind: 'rider', lane: 2, at: 0.5 }, { kind: 'foot', lane: 0, at: 1.2 }, { kind: 'rider', lane: 3, at: 1.5 }, { kind: 'rider', lane: 1, at: 2.2 }, { kind: 'foot', lane: 2, at: 3.0 }],
  // 3 盾匪（先射腿）
  [{ kind: 'shield', lane: 1, at: 0 }, { kind: 'foot', lane: 0, at: 1.0 }, { kind: 'shield', lane: 2, at: 1.6 }, { kind: 'foot', lane: 3, at: 2.4 }, { kind: 'shield', lane: 1, at: 3.2 }],
  // 4 炸药桶
  [{ kind: 'barrel', lane: 1, at: 0 }, { kind: 'foot', lane: 0, at: 0.8 }, { kind: 'barrel', lane: 2, at: 2.0 }, { kind: 'foot', lane: 3, at: 3.0 }, { kind: 'foot', lane: 1, at: 4.2 }],
  // 5 沙暴（命中/视野受扰）
  [{ kind: 'rider', lane: 0, at: 0 }, { kind: 'foot', lane: 1, at: 0.6 }, { kind: 'rider', lane: 2, at: 1.2 }, { kind: 'rider', lane: 3, at: 1.8 }, { kind: 'foot', lane: 1, at: 2.6 }, { kind: 'rider', lane: 0, at: 3.4 }],
  // 6 双门进攻（四道同时）
  [{ kind: 'foot', lane: 0, at: 0 }, { kind: 'foot', lane: 1, at: 0 }, { kind: 'foot', lane: 2, at: 0.4 }, { kind: 'foot', lane: 3, at: 0.4 }, { kind: 'rider', lane: 0, at: 1.4 }, { kind: 'rider', lane: 3, at: 1.4 }, { kind: 'foot', lane: 1, at: 2.6 }, { kind: 'foot', lane: 2, at: 2.6 }],
  // 7 盾匪+马匪混编
  [{ kind: 'shield', lane: 0, at: 0 }, { kind: 'rider', lane: 2, at: 0.5 }, { kind: 'shield', lane: 3, at: 1.0 }, { kind: 'rider', lane: 1, at: 1.6 }, { kind: 'rider', lane: 0, at: 2.4 }, { kind: 'shield', lane: 2, at: 3.0 }],
  // 8 酋长 Boss
  [{ kind: 'boss', lane: 1, at: 0 }, { kind: 'foot', lane: 0, at: 2.0 }, { kind: 'foot', lane: 2, at: 3.0 }],
  // 9 夜袭（视野受限）
  [{ kind: 'foot', lane: 0, at: 0 }, { kind: 'rider', lane: 2, at: 0.7 }, { kind: 'foot', lane: 1, at: 1.6 }, { kind: 'rider', lane: 3, at: 2.2 }, { kind: 'foot', lane: 2, at: 3.2 }],
  // 10 精英盾匪+炸药桶
  [{ kind: 'shield', lane: 1, at: 0 }, { kind: 'barrel', lane: 2, at: 0.8 }, { kind: 'shield', lane: 0, at: 1.8 }, { kind: 'barrel', lane: 3, at: 2.6 }, { kind: 'shield', lane: 1, at: 3.6 }],
  // 11 快速马匪群
  [{ kind: 'rider', lane: 0, at: 0 }, { kind: 'rider', lane: 1, at: 0.3 }, { kind: 'rider', lane: 2, at: 0.6 }, { kind: 'rider', lane: 3, at: 0.9 }, { kind: 'rider', lane: 0, at: 1.8 }, { kind: 'rider', lane: 3, at: 2.2 }, { kind: 'rider', lane: 1, at: 3.0 }],
  // 12 终局大围攻
  [{ kind: 'foot', lane: 0, at: 0 }, { kind: 'shield', lane: 1, at: 0 }, { kind: 'rider', lane: 3, at: 0.3 }, { kind: 'barrel', lane: 2, at: 0.8 }, { kind: 'foot', lane: 1, at: 1.6 }, { kind: 'shield', lane: 3, at: 2.0 }, { kind: 'rider', lane: 0, at: 2.6 }, { kind: 'boss', lane: 1, at: 3.4 }],
];

// 每波通过奖励金币（用于波间升级）
export const WAVE_REWARD = [24, 28, 34, 40, 46, 52, 60, 90, 60, 66, 56, 120];

export function waveOf(index) {
  return LEVELS[Math.min(index, LEVELS.length - 1)];
}

export function sceneOf(index) {
  const w = waveOf(index);
  return w.scene || 'noon-desert';
}
