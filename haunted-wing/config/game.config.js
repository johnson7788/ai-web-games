// config/game.config.js — HAUNTED WING 唯一数值/地图/文案配置源（config-first）。
// 纯数据 + 纯函数，不碰 DOM/window/localStorage/Date.now。随机一律 seed。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  CELL: 2,          // 网格单元边长（米）
  FLOOR1_Y: 0,      // 一层地面高度
  FLOOR2_Y: 3,      // 二层地面高度
  WALL_H: 3,
  EYE: 1.7,         // 相机眼高
};

export const STEP = 1 / 60;

export const PLAYER = {
  RADIUS: 0.45,
  WALK: 4.2,
  SPRINT: 6.3,
  CROUCH: 2.2,
  LIVES: 3,
  BATTERY_MAX: 100,
  FLASHLIGHT_DRAIN: 1,   // %/s，开灯才耗
  BATTERY_PICKUP: 30,
  INTERACT_DIST: 2.0,
  CABINET_DIST: 1.6,
};

export const FLASHLIGHT = {
  RANGE: 16,
  CONE: 0.85,        // 半角（弧度）
  FLICKER_AT: 9,     // 签名事件触发时间（秒）
};

export const ENTITY = {
  PATROL: 2.2,
  INVESTIGATE: 3.2,
  CHASE: 4.8,
  FRENZY: 5.6,
  CATCH_RADIUS: 0.95,
  CATCH_COOLDOWN: 4,     // 被抓后无敌时间（也用于躲柜后安全）
  HEAR_RUN: 14,
  HEAR_SEARCH: 10,
  HEAR_WALK: 5,
  VISION_RANGE: 16,
  PROXIMITY: 3.0,        // 很近且未躲藏 → 直接冲刺
  CHECK_DIST: 2.6,       // 查柜判定距离
  CHECK_CHANCE: 0.30,    // 每秒查柜概率
  RETREAT_DIST: 20,      // 发电机开灯后撤退距离
};

export const GENERATOR = {
  LEVERS: 3,
  LIGHTS_SEC: 30,
  FIX_DIST: 2.2,
};

export const RATINGS = [
  ['S', 75, 3],
  ['A', 110, 2],
  ['B', 150, 1],
  ['C', 1e9, 0],
];

export const MAP = {
  cell: WORLD.CELL,
  // 每层：房间列表（网格坐标，含起止） + 门 + 楼梯 + 发电机 + 出口 + 出生点
  floors: {
    1: {
      w: 20, h: 22, y: WORLD.FLOOR1_Y,
      rooms: [
        { id: 'spawn', x: 1, z: 1, w: 18, d: 6 },
        { id: 'ward', x: 1, z: 8, w: 11, d: 6 },
        { id: 'gen', x: 14, z: 8, w: 4, d: 6 },
        { id: 'stairs', x: 1, z: 15, w: 18, d: 5 },
      ],
      // 非门通道（相邻房间之间的开口，直接打通为地板）
      openings: [
        { x: 12, z: 10, w: 2, h: 2 },
      ],
      doors: [
        { id: 'red', x: 8, z: 7, w: 2, h: 1, openWhen: 'red', dir: 'h' },
        { id: 'blue', x: 8, z: 14, w: 2, h: 1, openWhen: 'blue', dir: 'h' },
      ],
      stairs: { x: 9, z: 17, to: 2 },
      generator: { x: 16, z: 10 },
      spawn: { x: 5, z: 3, yaw: Math.PI },
      // 实体巡逻路径（网格坐标，ping-pong 往返；门不阻挡实体，墙阻挡）
      entityPath: [
        { x: 3, z: 2 }, { x: 16, z: 2 },
      ],
    },
    2: {
      w: 12, h: 12, y: WORLD.FLOOR2_Y,
      rooms: [
        { id: 'surgery', x: 1, z: 1, w: 10, d: 9 },
      ],
      openings: [],
      doors: [],
      stairs: { x: 9, z: 9, to: 1 },
      generator: null,
      spawn: null,
      entityPath: [],
    },
  },
  // 可搜索点（网格坐标）：抽屉/柜/尸体；keyGroup 表示可能藏哪把钥匙（seed 每色选一个）
  searchables: [
    { id: 's1', floor: 1, x: 3, z: 5, kind: 'drawer', keyGroup: 'red' },
    { id: 's2', floor: 1, x: 9, z: 5, kind: 'drawer', keyGroup: 'red' },
    { id: 's3', floor: 1, x: 15, z: 5, kind: 'corpse', keyGroup: 'red' },
    { id: 's4', floor: 1, x: 3, z: 9, kind: 'drawer', keyGroup: 'blue' },
    { id: 's5', floor: 1, x: 9, z: 9, kind: 'corpse', keyGroup: 'blue' },
    { id: 's6', floor: 1, x: 10, z: 9, kind: 'drawer', keyGroup: 'blue' },
    { id: 's7', floor: 1, x: 15, z: 9, kind: 'drawer', keyGroup: null, battery: true },
    { id: 's8', floor: 2, x: 5, z: 2, kind: 'drawer', keyGroup: 'gold' },
    { id: 's9', floor: 2, x: 7, z: 2, kind: 'corpse', keyGroup: 'gold' },
  ],
  // 躲藏柜（纯躲藏点，E 进/出，不含道具）
  cabinets: [
    { floor: 1, x: 2, z: 10 },
    { floor: 1, x: 10, z: 10 },
    { floor: 1, x: 3, z: 17 },
    { floor: 1, x: 16, z: 5 },
    { floor: 2, x: 8, z: 2 },
  ],
  // 电池拾取点（踩到即补）
  batteries: [
    { floor: 1, x: 5, z: 4 },
    { floor: 1, x: 15, z: 12 },
    { floor: 1, x: 6, z: 17 },
    { floor: 2, x: 8, z: 3 },
  ],
  exit: { floor: 2, x: 2, z: 9 },
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 未做则整块不暴露（locales 里删掉）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'haunted-wing-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'haunted-wing-save',
  title: 'HAUNTED WING',
};
