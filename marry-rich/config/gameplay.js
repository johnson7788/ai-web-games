// config/gameplay.js — MARRY RICH · 数值与属性契约（全部数值都在这，逻辑不写死数字）。
// 三属性：能力 ability(abi) / 人脉 network(net) / 存款 savings(sav)，互相牵制（多数选择 +A −B）。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 属性初始值 / 边界
export const ATTRS = {
  START: { abi: 2, net: 1, sav: 3 }, // 小镇姑娘开局：有点能力、有点人脉、攒了点钱
  MIN: 0,
  MAX: 12,
  KEYS: ['abi', 'net', 'sav'],
  // HUD 显示名（i18n key）
  LABELS: {
    abi: 'attr.abi',
    net: 'attr.net',
    sav: 'attr.sav',
  },
};

// 隐藏好感度 / 关系值（分支用；也写进 HUD 的进度条，但主要参与结局判定）
export const FLAGS = {
  KEYS: ['mentor', 'partner', 'brand'],
  START: { mentor: 0, partner: 0, brand: 0 },
};

// 限时抉择：关键节点倒计时；超时自动选「保守默认项」。
export const TIMED = {
  DEFAULT_SEC: 5,
  TICK_EVERY_SEC: 1, // timerTick 节流（每秒一次；但 reveal 的 typeTick 每帧都有）
};

// 打字机 reveal 节奏（sim 发 typeTick 事件，保证 bot 遥测事件密度、无空转）
export const REVEAL = {
  CHOICE_SEC: 1.2, // 抉择文本逐字揭示时长
  RESULT_SEC: 0.8, // 结果文本逐字揭示时长
};

// 结局前章节总数（人生节点 = 12）
export const CHAPTER_COUNT = 12;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clampAttrs(attrs) {
  for (const k of ATTRS.KEYS) {
    attrs[k] = clamp(attrs[k], ATTRS.MIN, ATTRS.MAX);
  }
  return attrs;
}
