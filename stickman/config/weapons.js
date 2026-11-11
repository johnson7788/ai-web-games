// 武器表 —— 全部数值由 sim 读取，渲染层只读 id/颜色。
// kick：后坐力把玩家推开的冲量（px/s，加到 pelvis，可用来"后坐力飞行"）
export const WEAPONS = {
  pencil: {
    id: 'pencil',
    nameKey: 'weapon.pencil',
    dmg: 17,
    rpm: 240,              // 每分钟射速
    pellets: 1,
    spread: 0.012,
    speed: 1600,
    radius: 3,
    mag: 12,
    reload: 0.95,
    pierce: 1,
    kick: 150,
    aimKick: 0.055,        // 瞄准抖动（弧度）
    shake: 0.7,
    length: 10,            // 枪管长度（渲染）
    color: '#e9e9e9',
    trail: '#9fd8ff',
    sfx: 'shot_pencil',
    auto: true,
  },
  brush: {
    id: 'brush',
    nameKey: 'weapon.brush',
    dmg: 9,
    rpm: 105,
    pellets: 6,
    spread: 0.19,
    speed: 1150,
    radius: 4,
    mag: 5,
    reload: 1.25,
    pierce: 1,
    kick: 620,
    aimKick: 0.16,
    shake: 2.4,
    length: 14,
    color: '#f4efe2',
    trail: '#c9553d',
    sfx: 'shot_brush',
    auto: true,
    splash: 0,             // 升级可给
  },
  nib: {
    id: 'nib',
    nameKey: 'weapon.nib',
    dmg: 26,
    rpm: 150,
    pellets: 1,
    spread: 0.004,
    speed: 2400,
    radius: 3,
    mag: 6,
    reload: 1.1,
    pierce: 2,
    kick: 260,
    aimKick: 0.03,
    shake: 1.2,
    length: 16,
    color: '#d8f3ff',
    trail: '#6be0ff',
    sfx: 'shot_nib',
    auto: true,
  },
};

export const WEAPON_ORDER = ['pencil', 'brush', 'nib'];

// 敌人弹种
export const ENEMY_SHOTS = {
  nib: { dmg: 12, speed: 620, radius: 4, life: 3.2, color: '#c9553d' },
  compass: { dmg: 20, speed: 1500, radius: 3, life: 2.4, color: '#ff5f8f', beam: true },
  smudge: { dmg: 14, speed: 380, radius: 7, life: 3.0, color: '#7a5cff', arcing: true },
  blank: { dmg: 18, speed: 520, radius: 6, life: 4.0, color: '#111111' },
};

export default WEAPONS;
