// Hook & Gold · 打捞物类型表（sim 与 render 共用；数值 + 视觉元数据）
// mass 决定回收速度（越重越慢），value 决定收益，hazard 决定特殊行为。
export const OBJECT_TYPES = {
  GOLD_INGOT:   { mass: 300, value: 150, r: 34, hazard: null,   label: 'gold' },
  SILVER_BAR:   { mass: 200, value: 70,  r: 30, hazard: null,   label: 'silver' },
  ANTIQUE_VASE: { mass: 120, value: 45,  r: 26, hazard: null,   label: 'vase' },
  DUMBBELL:     { mass: 450, value: 12,  r: 32, hazard: null,   label: 'scrap' },
  PEARL_SHELL:  { mass: 180, value: 90,  r: 28, hazard: 'clam',  label: 'clam' },
  JELLYFISH:    { mass: 60,  value: 0,   r: 27, hazard: 'sting', label: 'jelly' },
  DYNAMITE:     { mass: 150, value: 0,   r: 30, hazard: 'boom',  label: 'dynamite' },
  BLACK_PEARL:  { mass: 100, value: 220, r: 20, hazard: null,   label: 'pearl' },
};

export const TYPE_KEYS = Object.keys(OBJECT_TYPES);

// 每个物件实例在 sim 里存的字段（供 render 消费；shape 由 render 按 type 绘制）
export function objectInstance(type, x, y, rng) {
  const meta = OBJECT_TYPES[type];
  return {
    id: 0,
    type,
    x,
    y,
    mass: meta.mass,
    value: meta.value,
    r: meta.r,
    hazard: meta.hazard,
    alive: true,
    // 珍珠贝开合相位（0..2π）
    clamPhase: rng ? rng() * Math.PI * 2 : 0,
    clamOpen: true,
    // 漂移相位（洋流/水母摆动）
    driftPhase: rng ? rng() * Math.PI * 2 : 0,
    // 炸药桶引信（被钩住后的引爆时间戳，null=未点燃）
    fuseAt: null,
  };
}
