// SWIM OR SINK · 全局数值配置
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法数值（生存问答：空气条 / 连击 / 计分）
export const GAME = {
  maxAir: 3,             // 空气泡上限
  baseScore: 100,        // 答对基础分
  streakBonus: 20,       // 连击每层额外分
  streakRegenEvery: 3,   // 每 N 连击回 1 格空气
  feedbackMsCorrect: 900,  // 答对反馈时长（自动进入下一题）
  feedbackMsWrong: 1400,   // 答错反馈时长（自动回到本题）
};

// 语言：默认英文；zh 必做（只暴露 locales 里真实存在的语言）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'swim-or-sink-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'swim-or-sink-save',
};
