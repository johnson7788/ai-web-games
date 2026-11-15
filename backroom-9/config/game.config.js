// config/game.config.js — BACKROOM 9 全局数值（config-first：所有玩法数值都在这）
// 纯数据，无副作用；sim/render/ui/audio 只 import 这里与 locales。

export const STEP = 1 / 60;

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  // 迷宫（房间网格）：GRID_W×GRID_H 个房间，每格 CELL 单位
  GRID_W: 9,
  GRID_H: 9,
  CELL: 8,
  WALL_H: 4,
  EYE: 1.7,
  EXITS: 9,
  REGEN_EVERY: 2,          // 每 2 个出口重组一次迷宫（第 2/4/6/8 出口后）
  // 后室色板（THREE 颜色 int）
  COLORS: {
    wallpaper: 0xd4c17a,   // 壁纸黄
    carpet: 0x8a7340,      // 地毯棕
    fluorescent: 0xf5f5dc, // 荧光白
    shadow: 0x2a2416,      // 阴影黑
    door: 0x7cff9a,        // 出口门（当前激活，绿）
    doorDim: 0x4a4a3a,     // 未激活出口门
    entity: 0x14100c,      // 实体（近黑剪影）
    entityEye: 0xfff0c0,
    pickup: 0x66ccff,      // 体力药
    table: 0x6b5a34,       // 桌
  },
};

export const PLAYER = {
  radius: 0.4,
  walkSpeed: 4.2,
  sprintSpeed: 7.6,
  accel: 26,
  eye: WORLD.EYE,
  turnSens: 0.0026,        // 鼠标像素 → 弧度
  pitchMin: -1.35,
  pitchMax: 1.35,
  staminaMax: 100,
  sprintDrain: 26,         // /s
  regen: 17,               // /s
  regenDelay: 0.5,         // 停止奔跑后延迟再回
  pantSec: 3,              // 体力 0 强制喘气时长
  reachExit: 1.35,         // 判定到达出口
  reachPickup: 1.2,
  reachTable: 1.5,         // 可躲桌底距离
  stepStride: 1.7,         // 每走这么远发一次 footstep 事件
};

export const ENTITY = {
  radius: 0.5,
  wanderSpeed: 2.3,
  chaseSpeed: 4.8,         // 快于走(4.2)、慢于跑(7.6)：走会被追、跑能甩开
  searchSec: 4.0,
  visionDist: 15,
  visionFov: 1.15,         // 半角（rad）
  stareSec: 3.0,           // 直视 3s 触发追逐
  stareDecay: 1.2,         // 视线断了每秒衰减
  hearDist: 14,            // 喘气噪声半径（步行不引，只跑/喘）
  sprintHearDist: 16,
  catchDist: 0.95,
  hideCheckDist: 1.7,      // 躲桌底时实体靠近的查桌距离
  hideCheckChance: 0.5,
  pathRepickSec: 2.6,      // 漫游重新选目标间隔
};

export const PICKUP = {
  count: 3,                // 每段体力药数量（稀缺）
  staminaRestore: 55,
};

export const MAZE = {
  extraDoors: 0.26,        // 生成树之外额外开门比例（房间感/环线）
  tablesPerSegment: 7,
};

export const FX = {
  flickerMin: 1.6,         // 荧光灯闪烁间隔范围（s）
  flickerMax: 3.2,
  flickerOn: 0.16,         // 每次闪烁亮灭时长
  caughtPenalty: 20,       // 被抓扣时间（s）
};

export const CONFIG = {
  title: 'BACKROOM 9',
  appId: 'pipy-backroom-9',
  defaultLang: 'en',
  languages: ['en', 'zh'], // ja/ko/ar/ru 未翻译 → 整块不暴露
  rtlLangs: [],
  langStorageKey: 'backroom-9-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'backroom-9-save',
};
