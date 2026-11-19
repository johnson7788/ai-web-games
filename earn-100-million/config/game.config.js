// EARN 100 MILLION · 全局配置（纯逻辑 + i18n 开关）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 经济目标与人生周期
export const ECONOMY = {
  GOAL: 100_000_000,        // 目标资产：挣他一个亿
  START_AGE: 20,
  RETIRE_AGE: 70,           // 基础退休年龄（可被技能延长）
  START_HP: 100,
  HP_LINE: 50,              // 健康红线（低于则住院）
  HEALTH_SUB_AGE: 40,       // 从这岁数开始自然掉血
  START_WAREHOUSE: 100,
  MAX_WAREHOUSE: 200,
  ASSET_BURDEN: 0,          // 保留字段（原版资产暴涨掉血，此处改为连击奖励，不再惩罚）
};

// 语言：默认英文；zh 必做。?lang= 覆盖，localStorage 记忆。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'earn-100-million-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'earn-100-million-save',
};
