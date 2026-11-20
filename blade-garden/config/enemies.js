// BLADE GARDEN · 敌人原型（Lead 拥有）。sim 按 prototype 生成实例，render 按 color/radius 绘制。
// 字段：id / name{en,zh} / hp / damage / speed / radius / xp / gold / color /
//       shoot(是否远程) / shootInterval / projSpeed / projDamage / elite
export const ENEMIES = {
  boar: {
    id: 'boar',
    name: { en: 'Boar', zh: '野猪' },
    hp: 34, damage: 8, speed: 58, radius: 20, xp: 1, gold: 0,
    color: '#8A5A3B', shoot: false,
  },
  crow: {
    id: 'crow',
    name: { en: 'Crow', zh: '乌鸦' },
    hp: 12, damage: 5, speed: 118, radius: 13, xp: 1, gold: 0,
    color: '#3B3B4A', shoot: false,
  },
  mandrill: {
    id: 'mandrill',
    name: { en: 'Mandrill', zh: '山魈' },
    hp: 52, damage: 12, speed: 76, radius: 20, xp: 2, gold: 0,
    color: '#4A5A3B', shoot: false,
  },
  thief: {
    id: 'thief',
    name: { en: 'Herb Thief', zh: '药贼' },
    hp: 22, damage: 7, speed: 132, radius: 14, xp: 2, gold: 1,
    color: '#5A3B6B', shoot: false,
  },
  // 精英 = 基础原型 + 体型/数值放大（sim 里按 elite 倍率合成，不单独定义 hp）
  eliteBoar: {
    id: 'eliteBoar',
    name: { en: 'Elite Boar', zh: '精英野猪' },
    hp: 120, damage: 16, speed: 52, radius: 30, xp: 5, gold: 0,
    color: '#B87A4B', shoot: false, elite: true,
  },
  eliteMandrill: {
    id: 'eliteMandrill',
    name: { en: 'Elite Mandrill', zh: '精英山魈' },
    hp: 160, damage: 20, speed: 70, radius: 30, xp: 6, gold: 0,
    color: '#7A8A5B', shoot: false, elite: true,
  },
  bossCauldron: {
    id: 'bossCauldron',
    name: { en: 'Medicine Cauldron', zh: '药王鼎' },
    hp: 520, damage: 22, speed: 30, radius: 46, xp: 20, gold: 5,
    color: '#2E7A5B', shoot: true, shootInterval: 2.6, projSpeed: 170, projDamage: 12, boss: true,
  },
  bossMandrillKing: {
    id: 'bossMandrillKing',
    name: { en: 'Mandrill King', zh: '山魈王' },
    hp: 820, damage: 26, speed: 46, radius: 52, xp: 30, gold: 8,
    color: '#6B4A7A', shoot: true, shootInterval: 2.0, projSpeed: 200, projDamage: 14, boss: true,
  },
};

// 各关卡使用的原型 id 顺序（sim 据此按场景换敌人）
export const SCENE_ENEMIES = {
  spring: ['boar', 'crow'],
  summer: ['mandrill', 'boar'],
  autumn: ['thief', 'mandrill', 'crow'],
};
