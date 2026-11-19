// 全局数值配置：SPIN CYCLE ORBIT（霓虹街机轨道弹跳）
// 玩法骨架 1:1 参考 Cocos 原作「转圈圈」：双臂互绕 + 目标链 + 命中窗口切换。
// 新机制：连击 / 节点类型（金核·岩核）/ 难度递进 + 狂热。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60; // 固定 60Hz 步长

export const ORBIT = {
  BALL_DISTANCE: 120,   // 双臂间距 / 轨道半径（px）
  ROT_SPEED: 4.5,       // 基础角速度（度 / 60fps 帧）≈ 270°/s
  ANGLE_RANGE: [25, 155], // 新目标相对上一节点的角度区间（度）
  VISIBLE_TARGETS: 7,   // 链上可见目标数
  CAPTURE_DIST: 20,     // 成功切换的距离阈值
  WINDOW_DIST: 40,      // 命中窗口开启距离（nearMiss 提示）
  OVERSHOOT_DIST: 90,   // 超过该距离判 overshoot 失败
  GRACE_SECONDS: 4,     // 首个目标宽限期：未捕获前 N 秒内 overshoot 不判负
  COMBO_WINDOW: 2.5,    // 连击保持时间窗（秒）
  FRENZY_EVERY: 8,      // 每 N 次捕获触发一次狂热
  FRENZY_SECONDS: 4,    // 狂热持续秒数
  FRENZY_MULT: 1.5,     // 狂热速度倍率
  LEVEL_EVERY: 5,       // 每 N 次捕获升一级
};

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'spin-cycle-orbit-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'spin-cycle-orbit-save',
};
