// 存档：统一走 Sdk.save/load 封装（SDK 可用时走 SDK，否则 localStorage 降级）。
// 业务代码不直接碰 localStorage。
import { Sdk } from './sdk.js';

const KEY = 'game';

export const save = {
  /** 读取整局存档对象；损坏/缺失返回默认空对象 */
  loadState(defaultValue = null) {
    return Sdk.load(KEY, defaultValue) ?? defaultValue;
  },

  /** 整局存档（传对象）；返回是否成功 */
  saveState(state) {
    return Sdk.save(KEY, state);
  },

  /** 单个字段读写（兼容旧骨架调用风格） */
  get(key, defaultValue = null) {
    const s = this.loadState(null) || {};
    return s[key] ?? defaultValue;
  },

  set(key, value) {
    const s = this.loadState(null) || {};
    s[key] = value;
    this.saveState(s);
    return value;
  },

  /** 清空本游戏存档（教程/测试用） */
  clear() {
    this.saveState({});
  },
};
