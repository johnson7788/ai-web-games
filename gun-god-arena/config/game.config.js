// GUN GOD ARENA · 全局数值配置（P0 玩法事实表数值 1:1 移植自参考源码，主题换皮为霓虹街机）
// 参考：local/batch3/extracted/枪神之神-creator源码/assets/src/{Gunner,Bullet,GameLogic,LevelModel}.js
// 核心规则：拖拽瞄准-松手射击；子弹碰墙/道具反弹（≤MAX_BOUNCES 次）；命中全息靶击碎；清空全部可击碎靶过关；
//          子弹数有限 + 星级阈值；命中 VIP 中立目标立即失败。
// 新机制：连击计分 / 道具箱（补给·三连·加分·炸弹）/ 岩石坠落碾压。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 60,          // 顶部不透明 HUD 条高度（实体活动区从 y=HUD_H+margin 开始，避免遮挡）
  PLAY_TOP: 84,       // 实体活动上边界（子弹反弹墙）
  FLOOR_Y: 690,       // 底部：子弹落到底即消耗；全息靶/道具/岩石的活动下边界
};

export const STEP = 1 / 60;

export const GUN = {
  X: 640,             // 枪固定底座（底部居中炮塔）
  Y: 656,
  LENGTH: 48,         // 枪管长（决定枪口位置）
};

export const BULLET = {
  SPEED: 1200,        // 原 Bullet.js linearVelocity = 2000 → 按 1280 宽缩放到 1200（更快更爽）
  R: 6,
  MAX_BOUNCES: 8,     // 原 Bullet.js reflectCount > 20 消耗 → 收敛到 8（小场地更紧凑）
};

export const TARGET = {
  R: 26,              // 全息靶半径（原 suffer 的 body 碰撞近似）
  VIP_R: 26,          // VIP 中立目标半径
  Y_MIN: 150,         // 靶的活动上界
  Y_MAX: 540,         // 靶的活动下界（避免与底部炮塔/HUD 重叠）
};

export const CRATE = {
  R: 22,
  Y_MIN: 160,
  Y_MAX: 520,
};

export const ROCK = {
  R: 22,
  GRAVITY: 1400,      // 岩石被击中后下落加速度（原 block 受重力碾压）
};

export const POWERUP = {
  R: 15,
  SPEED: 95,          // 道具箱打爆后道具缓缓下坠，到底部自动拾取
};

export const COMBO = {
  WINDOW: 2.5,        // 连击窗口：无击杀即重置
};

export const STAR_LEVELS = 9; // 关卡总数（清空全部关卡 = 胜利）

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],   // 只暴露完整翻译的语言
  rtlLangs: [],
  langStorageKey: 'gun-god-arena-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'gun-god-arena-save',
};
