// 全局参数：手感 / 相机 / 视口 / 规则。代码里不写死数字，改这里。
export const CONFIG = {
  appId: 'windup-kid',
  title: 'WIND-UP KID',
  lang: 'en',              // 'en' | 'zh'，也可用 ?lang=zh 覆盖
  logicFps: 60,

  view: { w: 960, h: 540 }, // 逻辑分辨率（24 × 13.5 格）

  player: { w: 0.72, h: 0.95, bigH: 1.9 },

  // 手感起始值：P1 阶段用试玩手调（单位：格 / 秒）
  phys: {
    gravityRise: 48,
    gravityFall: 58,
    maxFall: 32,
    walkMax: 5.4,
    runMax: 9.2,
    groundAccel: 30,
    airAccel: 18,
    friction: 34,
    skid: 46,
    jumpVel: 21,
    jumpCut: 0.62,        // 松开跳键时保留的上升速度
    coyote: 0.10,         // 土狼时间
    buffer: 0.12,         // 跳跃缓冲
    stompBounce: 14,
    stompBounceHeld: 18,
    invuln: 1.2,
  },

  camera: {
    fov: 30,
    dist: 21.0,
    height: 3.0,
    offsetX: 0,           // 正对镜头，避免横线在屏幕边缘倾斜
    lookY: 1.6,
    deadzoneX: 2.5,
    deadzoneY: 3.0,
    lookahead: 0.22,
    lookaheadMax: 3.0,
    followY: 6.0,
  },

  rules: { timeLimit: 240, maxLives: 9 },
};

export const P = CONFIG.phys;
