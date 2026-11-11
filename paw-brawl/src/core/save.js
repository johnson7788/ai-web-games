import { CONFIG } from '../../config/game.config.js';

export function createDefaultSave() {
  return {
    v: 1,
    coins: 0,
    unlocked: ['shiba', 'cat', 'rabbit', 'panda'],
    lastChar: 'shiba',
    wins: 0,
    matches: 0,
    kos: 0,
    bestRank: 0,
    settings: { sfx: true, music: true, quality: 'auto', shake: true, muted: false },
  };
}

let memory = null;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function persist(save) {
  try {
    globalThis.localStorage.setItem(CONFIG.saveKey, JSON.stringify(save));
  } catch {
    // 隐私模式或存储配额不足时仍保留内存存档。
  }
}

export function loadSave() {
  if (memory !== null) return memory;
  try {
    const raw = globalThis.localStorage.getItem(CONFIG.saveKey);
    const data = raw ? JSON.parse(raw) : null;
    if (!isObject(data) || data.v !== 1) {
      memory = createDefaultSave();
    } else {
      const defaults = createDefaultSave();
      memory = {
        ...defaults,
        ...data,
        settings: { ...defaults.settings, ...(isObject(data.settings) ? data.settings : {}) },
      };
    }
  } catch {
    memory = createDefaultSave();
  }
  return memory;
}

export function writeSave(patch = {}) {
  const current = loadSave();
  const safePatch = isObject(patch) ? patch : {};
  memory = {
    ...current,
    ...safePatch,
    settings: {
      ...current.settings,
      ...(isObject(safePatch.settings) ? safePatch.settings : {}),
    },
  };
  persist(memory);
  return memory;
}

export function updateSettings(patch) {
  return writeSave({ settings: patch });
}

export function resetSave() {
  memory = createDefaultSave();
  persist(memory);
  return memory;
}

// 仅清除内存缓存，供测试隔离或显式重新读取持久化数据使用。
export function clearSaveCache() {
  memory = null;
}
