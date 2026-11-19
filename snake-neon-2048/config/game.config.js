// 全局数值配置（Lead 拥有；数值改动只改这里）。sim 不依赖任何 DOM。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 56,            // 顶部 HUD 条高
  MARGIN: 16,           // 左右安全边
  BOTTOM_SPACE: 96,     // 棋盘底部留白（教程卡 / 触屏提示）
  CELL_MAX: 48,         // 单格上限
};

// 语言：默认英文；zh 必做；其它语言完整翻译后才加入
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'snake-neon-2048-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'snake-neon-2048-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  AUTO_LAUNCH_SEC: 2.5,     // 无输入多久后自动起步（保证 noinput 也会触发死亡基线）
  COMBO_WINDOW: 3.0,        // 连击窗口：两次进食间隔 ≤3s 连击 +1
  COMBO_MAX: 5,             // 连击倍率上限
  GOLDEN_VALUE: 5,          // 黄金核心分值
  GOLDEN_SLOW_SEC: 3.0,     // 黄金核心触发的慢动作时长
  SLOW_FACTOR: 1.7,         // 慢动作时移动间隔放大倍数
  STAR_COMBO_3: 3,          // 三星所需最高连击
  STAR_COMBO_2: 2,          // 二星所需最高连击
  TUTORIAL_STEPS: 3,
};
