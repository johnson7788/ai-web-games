// config/game.config.js — 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
import { WORLD, STEP } from './gameplay.js';

export { WORLD, STEP };

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'light-grid-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'light-grid-save',
};
