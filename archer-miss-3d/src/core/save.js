// 存档：统一走 Sdk.save/load 封装；SDK 不可用时 Sdk 内部落 localStorage。
// 业务代码不直碰 localStorage（语言键是运行时偏好，单独由 i18n 管）。
import Sdk from './sdk.js';

export const save = {
  get(key, defaultValue = null) {
    const v = Sdk.load(key, defaultValue);
    return v === undefined || v === null ? defaultValue : v;
  },

  set(key, value) {
    return Sdk.save(key, value);
  },

  // 常用：最佳得分 / 累计星级
  best() {
    return Number(this.get('best', 0)) || 0;
  },
  setBest(score) {
    if (score > this.best()) this.set('best', Math.floor(score));
  },
  totalStars() {
    return Number(this.get('totalStars', 0)) || 0;
  },
  addStars(n) {
    this.set('totalStars', this.totalStars() + n);
  },
};

export default save;
