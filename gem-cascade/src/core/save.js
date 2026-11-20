// src/core/save.js — 存档统一出口：只经 Sdk.save/load（业务代码禁止直写 localStorage）。
// audio.js 等模块通过 save.get/set 读写设置，全部落到 SDK 命名空间。
import Sdk from './sdk.js';

export const save = {
  get(key, defaultValue = null) {
    return Sdk.load(key, defaultValue);
  },
  set(key, value) {
    Sdk.save(key, value);
  },
  load() {
    return {};
  },
};
