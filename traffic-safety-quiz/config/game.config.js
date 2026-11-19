// 全局数值配置
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法数值
export const QUIZ = {
  TOTAL_QUESTIONS: 10,      // 一局题量
  TIME_LIMIT: 30,           // 整局倒计时（秒）
  BASE_SCORE: 10,           // 答对基础分
  COMBO_BONUS: 5,           // 每层连击额外分（上限见下）
  COMBO_BONUS_MAX: 25,      // 连击额外分封顶
  STAR2_SCORE: 90,          // 2 星分数线
  STAR3_SCORE: 120,         // 3 星分数线
  CORRECT_ADVANCE_DELAY: 0.35, // 答对后自动翻题延迟（秒）
  WRONG_LOCK_DELAY: 0.35,   // 答错后按钮锁定时长（秒）
  ROUNDS: [3, 3, 4],        // 三关题量分布（人行道 / 过马路 / 信号与危险）
};

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'traffic-safety-quiz-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'traffic-safety-quiz-save',
};
