// config/game.config.js — 全局常量：世界尺寸 / 步长 / 语言 / 存档键（Lead 所有）
// 玩法数值集中在此，sim 与 selfplay 均从这里取数，保证测玩与真实运行同源。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 618,        // 玩家（烬灵）所在的高度
  SPAWN_Y: 84,          // 从 HUD 下方生成，避免被顶部 HUD 遮挡
  MIN_X: 60,
  MAX_X: 1220,
};

export const STEP = 1 / 60;

// 玩家：横向移动，无跳跃（简化为一维躲避+收集）
export const PLAYER = {
  HALF_W: 26,
  SPEED: 430,           // px/s
  LIVES: 3,
  LIVES_MAX: 3,
};

// 坠落物基础参数（level 越高越难，由 sim 按 level 缩放）
export const DROP = {
  FUEL_R: 17,
  COAL_R: 21,
  WATER_R: 16,
  SPARK_R: 15,
  FUEL_VY: 150,
  COAL_VY: 215,
  WATER_VY: 185,
  SPARK_VY: 320,
  // 每关每 tier 需要的燃料数（焰心→内焰→外焰）
  FUEL_PER_TIER: [4, 5, 6],
  // 连击窗口（秒）：窗口内连续收集则连击+1
  COMBO_WINDOW: 2.5,
};

export const LEVEL = {
  FINAL_LEVEL: 12,           // 通关第 12 关 = win
  SPAWN_INTERVAL: 0.82,      // 基础生成间隔（秒），随 level 递减
  SPAWN_MIN: 0.30,
  // 各物体生成权重（按 level 线性调整）
  WEIGHTS: {
    fuel: 0.76,
    coal: 0.09,
    water: 0.09,
    spark: 0.06,
  },
  // 每升一级的危险度增量（water/spark 权重上升，fuel 下降）
  HAZARD_STEP: 0.012,
  // 每升一级的速度增量（px/s per level）
  SPEED_STEP: 12,
};

export const SCORE = {
  FUEL: 10,
  COAL: 30,
  DODGE: 15,
  CRAFT_TIER: 100,
  LEVEL_CLEAR: 500,
  COMBO_CAP: 8,          // 连击加成封顶（连击越多每颗燃料分越高）
};

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'flame-craft-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'flame-craft-save',
};
