// config/game.config.js — 全局数值 / 物理 / 相机 / 色板 / i18n 配置（唯一数值真相）
// 玩法层不写死数字：src/game/* 全部从这里 import。

export const STEP = 1 / 60;

// 逻辑视口（HUD/UI 用；3D 世界用下面的 GREEN_W/GREEN_D 世界单位）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };

// 高尔夫物理与球场（世界单位）
export const GOLF = {
  GREEN_W: 64,          // 果岭 X 范围 [0, GREEN_W]
  GREEN_D: 42,          // 果岭 Z 范围 [0, GREEN_D]
  BALL_R: 0.5,          // 球半径
  MAX_SPEED: 20,        // power=1 时的出杆初速
  ROLL_RESIST: 5.0,     // 滚动阻力（恒定减速度 u/s²，滚动摩擦；停球距离 = v0²/(2·ROLL_RESIST)）
  SAND_MULT: 2.0,       // 沙坑内滚动阻力倍率（减速更快）
  RESTITUTION: 0.55,    // 墙体/弹板弹性碰撞恢复系数
  SLOPE_ACCEL: 1.1,     // 坡地重力分量最大加速度（乘 hole.slope 分量）
  WIND_MAX: 1.0,        // 风力最大加速度（乘 hole.wind 分量）
  STOP_SPEED: 0.12,     // 低于此速度视为停球
  CAPTURE_SPEED: 3.0,   // 低于此速度 + 进入洞半径 = 进洞
  HOLE_R: 0.5,          // 洞判定半径
  RIM_R: 1.25,          // 洞沿半径（擦洞减速/绕圈，near_miss 来源）
  BOUNCE_VY: 6.0,       // 弹板向上弹起速度
  CAPTURE_SEC: 1.4,     // 进洞吸入动画时长（签名：边缘绕一圈掉进去）
  BUST_STROKES: 3,      // 超过 par 这么多杆 = 爆杆（上限，自动推进）
  SHOT_CLOCK: 30,       // 每杆思考时限（s）：aim 阶段超过即爆杆（不作为也会失败的失败态）
  DAILY_BASE: 20261115, // 每日挑战洞 seed 基数
};

// 相机（球后跟随 + 进洞环绕）
export const CAMERA = {
  DIST: 16,
  HEIGHT: 11,
  ZOOM_MIN: 8,
  ZOOM_MAX: 26,
  ORBIT_SPEED: 0.9,      // 进洞环绕角速度（rad/s）
  LERP: 5,               // 跟随平滑
};

// 低多边形迷你高尔夫色板（美术升级只替换贴图，颜色保留为程序化兜底）
export const PALETTE = {
  green: 0x22c55e,
  greenDark: 0x15803d,
  sky: 0x7dd3fc,
  ball: 0xf8fafc,
  flag: 0xef4444,
  sand: 0xeab308,
  water: 0x38bdf8,
  windmill: 0xf59e0b,
  gate: 0x94a3b8,
  pad: 0xa78bfa,
  hole: 0x0f172a,
};

// i18n：默认英文，中文必做；ja/ko/ar/ru 未翻译整块不暴露
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mega-golf-3d-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'mega-golf-3d-save',
};
