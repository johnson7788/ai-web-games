// BEAR DASH RUN · 全局数值配置（霓虹街机横向跑酷）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 600,     // 地面顶部的 y 坐标
  GRAVITY: 2200,     // px/s^2
  MAX_FALL: 1400,    // 下落速度上限
};

export const STEP = 1 / 60;

export const PLAYER = {
  W: 44,
  H: 58,
  SPEED: 320,        // 左右移动速度 px/s
  JUMP_V: 820,       // 起跳竖直速度
  MAX_JUMPS: 2,      // 二段跳
  STOMP_BOUNCE: 0.55,// 踩踏反弹系数
  BOOST_SPEED: 2.1,  // 加速垫速度倍率
  BOOST_TIME: 0.4,   // 加速持续时间
  INV_TIME: 0.55,    // 加速垫无敌时间
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'bear-dash-run-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'bear-dash-run-save',
};
