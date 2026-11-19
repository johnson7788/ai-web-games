// SNOWMAN FACTORY · 全局数值配置（Lead 拥有；数值改动只改这里）
//
// 玩法 P0（1:1 参考雪人工厂源码）：
//   蛋筒从左上管道落下 → 落到下方传送带 → 向右滑；玩家在雪人处向下丢冰激凌球，
//   球落在蛋筒上 = 接住（成品继续右滑，到右侧仓门收集得分）；落空 = 失误掉命。
// 新机制：连击倍率 / 金色蛋筒奖励 / 岩石障碍。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量（canvas 坐标，sim 只用少量几何量做判定，render 据此画图）
export const LAYOUT = {
  HUD_H: 56,            // 顶部 HUD 条高（DOM，不透明，不压玩法区）
  PIPE_X: 70,           // 左上料斗 x
  PIPE_Y: 150,          // 料斗出口 y（蛋筒从这里落下；低于移动端 HUD 缩放后的覆盖区）
  BELT_Y: 592,          // 传送带表面 y（物品中心落点）
  BELT_H: 72,           // 传送带视觉高度
  ITEM_HALF: 26,        // 物品碰撞半宽（用于落点判定）
  SNOWMAN_X: 520,       // 雪人 / 发射口 x
  SNOWMAN_HAND_Y: 392,  // 冰激凌球出手高度
  CATCH_HALF: 30,       // 接住窗口半宽（|物品x - 雪人x| 之内算接住）
  DOOR_X: 1150,         // 右侧收集仓门 x
};

export const BALANCE = {
  lives: 5,             // 初始/最大命
  maxLives: 5,
  catchesPerLevel: 6,   // 每关需要接住的次数（升关）
  dropTime: 0.72,       // 冰激凌球下落时长（秒）
  fallSpeed: 420,       // 蛋筒/岩石从管道下落速度（px/s）
  coneSpawnMin: 1.25,   // 蛋筒生成间隔下限（秒）
  coneSpawnMax: 2.15,   // 蛋筒生成间隔上限（秒）
  spawnSpeedPerLevel: 0.16, // 每关生成更快（从间隔里扣）
  beltSpeedBase: 90,    // 传送带基础速度（px/s）
  beltSpeedPerLevel: 12,// 每关传送带更快
  crazyBeltMul: 1.35,   // 疯狂模式传送带倍率
  crazyTimeLimit: 130,  // 疯狂模式倒计时（秒）
  rockChanceBase: 0.17, // 从第 2 关起岩石占比
  goldenChance: 0.12,   // 从第 3 关起金色蛋筒占比
  coneValue: 1,         // 普通蛋筒基础分
  goldenValue: 5,       // 金色蛋筒基础分
  comboCap: 5,          // 连击倍率上限（×5）
  autoLaunchSec: 4.2,   // 空转兜底：超时自动丢一球（保证 noinput 也会失误死亡）
};

// 蛋筒颜色顺序（随机循环，视觉上用）
export const COLOR_ORDER = ['red', 'yellow', 'blue', 'green'];

// 手绘卡通风配色（全游戏统一）
export const PALETTE = {
  skyTop: '#7ec8e3',
  skyBottom: '#eaf6fd',
  snowFloor: '#f4f9ff',
  snowShadow: '#cfe0f2',
  belt: '#3f5573',
  beltEdge: '#2e3f57',
  beltTread: '#5b7598',
  snowman: '#ffffff',
  snowmanShade: '#dbe6f2',
  outline: '#2b2b3a',
  carrot: '#ff8c42',
  scarf: '#e0565e',
  coal: '#2b2b3a',
  pipe: '#8aa0b8',
  door: '#6b4a3a',
  doorGlow: '#ffd166',
  coneWaffle: '#e8b16a',
  cone: {
    red: '#ff6b6b',
    yellow: '#ffd166',
    blue: '#4ecdc4',
    green: '#7bd389',
  },
  golden: '#ffcf40',
  goldenDeep: '#e0a800',
  rock: '#7d8a99',
  rockDeep: '#5c6875',
  scoop: '#fff4e6',
  scoopPink: '#ffb3c1',
  scoopChoc: '#c98a5e',
  text: '#1e2a3a',
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块删除（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'snowman-factory-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'snowman-factory-save',
};
