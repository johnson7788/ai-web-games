// MOSAIC SLIDE · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘/参考图几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 46,            // 顶部 HUD 条高（不透明，保证剪影可读）
  MARGIN_X: 24,         // 左右安全边
  MARGIN_Y: 18,
  REF_W: 208,           // 右侧参考图面板宽
  REF_GAP: 20,          // 棋盘与参考图间距
  CELL_MAX: 160,        // 单格上限
  FRAME: 14,            // 棋盘外框厚
};

// 语言：默认英文；zh 必做（未完整翻译的语言整块删除，当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mosaic-slide-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'mosaic-slide-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  BLANK_HOME: 0,           // 空格（缺片）的家：左上角，与源码 isBlank(0,0) 一致
  ROTATE_MAX: 4,           // 旋转块每块最多转回 0..3
  PEEK_COUNT: 3,           // 盲拼关每局可偷看次数
  PEEK_SECONDS: 3,         // 偷看参考图持续秒数
  REF_HIDE_SECONDS: 5,     // 盲拼关开局参考图可见秒数
  DUAL_SWITCH_SECONDS: 4,  // 双图交替关参考图切换周期
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 3,            // 无效点击小震屏
  LIGHT_BLOOM_SECONDS: 1.6, // 完成瞬间阳光点亮时长
};
