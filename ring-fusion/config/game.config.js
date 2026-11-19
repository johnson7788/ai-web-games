// 全局数值配置（零依赖纯静态）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };

export const STEP = 1 / 60;

// 霓虹街机 8 色（大/中/小三环共用）
export const COLORS = [
  '#22d3ee', // 0 cyan
  '#f472b6', // 1 pink
  '#facc15', // 2 yellow
  '#a78bfa', // 3 violet
  '#fb7185', // 4 rose
  '#4ade80', // 5 green
  '#fb923c', // 6 orange
  '#60a5fa', // 7 blue
];

export const BURST_NEED = 12;   // 连击充能满格需要的消环数
export const TIME_START = 60;    // 限时模式初始秒数
export const TIME_PER_CLEAR = 2; // 每消 1 环加秒

// 语言：默认英文；zh 必做；只暴露真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ring-fusion-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ring-fusion-save',
};
