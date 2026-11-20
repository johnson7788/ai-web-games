// PHANTOM RUN · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 600,        // 主地面顶边（y 向下）
  FLOOR_Y: 720,         // 掉坑判定线（玩家底部越过即判负）
};

export const STEP = 1 / 60;

// 跑酷物理（逻辑像素/秒²、像素/秒）
export const PHYSICS = {
  GRAVITY: 2400,
  JUMP_VEL: -860,
  BASE_SPEED: 320,      // 各关可覆盖 speed
  MAX_FALL: 1500,       // 终端下落速度
};

export const PLAYER = {
  W: 34,
  H: 46,
  SCREEN_X: 240,        // 玩家在屏幕上的固定横向位置（渲染用）
};

// 游戏规则数值（sim 从 levels/game.config 读取）
export const GAME = {
  RUNE_REVERT_SEC: 2.2,     // 符文砖虚化后恢复实体的秒数
  CORPOREAL_SEC: 1.6,       // 月光斑「现身」持续秒数
  COLLAPSE_SEC: 0.8,        // 塌陷檐踩后延迟落下秒数
  COYOTE_SEC: 0.12,         // 土狼时间
  JUMP_BUFFER_SEC: 0.15,    // 跳跃缓冲
  CHASE_GAP: 240,           // 追兵段幽灵火落后于玩家的恒定距离（屏幕内可见）
  TUTORIAL_STEPS: 3,
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'phantom-run-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'phantom-run-save',
};
