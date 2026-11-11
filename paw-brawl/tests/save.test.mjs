import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../config/game.config.js';
import {
  clearSaveCache,
  createDefaultSave,
  loadSave,
  resetSave,
  updateSettings,
  writeSave,
} from '../src/core/save.js';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let values;

function installStorage(overrides = {}) {
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    ...overrides,
  };
}

test.beforeEach(() => {
  values = new Map();
  installStorage();
  clearSaveCache();
});

test.after(() => {
  clearSaveCache();
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('默认存档字段完整且每次创建互不影响', () => {
  assert.deepEqual(loadSave(), {
    v: 1,
    coins: 0,
    unlocked: ['shiba', 'cat', 'rabbit', 'panda'],
    lastChar: 'shiba',
    wins: 0,
    matches: 0,
    kos: 0,
    bestRank: 0,
    settings: { sfx: true, music: true, quality: 'auto', shake: true, muted: false },
  });
  const first = createDefaultSave();
  const second = createDefaultSave();
  first.unlocked.push('bear');
  first.settings.sfx = false;
  assert.deepEqual(second.unlocked, ['shiba', 'cat', 'rabbit', 'panda']);
  assert.equal(second.settings.sfx, true);
});

test('写读一致且 writeSave 深合并 settings', () => {
  writeSave({ coins: 325, wins: 1, settings: { music: false } });
  updateSettings({ quality: 'low' });
  writeSave({ matches: 2, settings: { sfx: false } });
  clearSaveCache();
  const loaded = loadSave();
  assert.equal(loaded.coins, 325);
  assert.equal(loaded.wins, 1);
  assert.equal(loaded.matches, 2);
  assert.deepEqual(loaded.unlocked, ['shiba', 'cat', 'rabbit', 'panda']);
  assert.deepEqual(loaded.settings, {
    sfx: false,
    music: false,
    quality: 'low',
    shake: true,
    muted: false,
  });
  assert.deepEqual(JSON.parse(values.get(CONFIG.saveKey)), loaded);
});

test('损坏 JSON 和旧版本存档回退到默认值', () => {
  values.set(CONFIG.saveKey, '{broken');
  assert.doesNotThrow(() => loadSave());
  assert.deepEqual(loadSave(), createDefaultSave());

  clearSaveCache();
  values.set(CONFIG.saveKey, JSON.stringify({ v: 0, coins: 999 }));
  assert.deepEqual(loadSave(), createDefaultSave());
});

test('localStorage 读取抛错时回退且不抛异常', () => {
  installStorage({ getItem() { throw new Error('private mode'); } });
  assert.doesNotThrow(() => loadSave());
  assert.deepEqual(loadSave(), createDefaultSave());
});

test('localStorage 写入抛错时保留内存存档且不抛异常', () => {
  installStorage({ setItem() { throw new Error('private mode'); } });
  let written;
  assert.doesNotThrow(() => { written = writeSave({ coins: 50, settings: { sfx: false } }); });
  assert.equal(written.coins, 50);
  assert.equal(written.settings.sfx, false);
  assert.equal(written.settings.music, true);
  assert.deepEqual(loadSave(), written);
  assert.doesNotThrow(() => resetSave());
  assert.deepEqual(loadSave(), createDefaultSave());
});

test('resetSave 重置内存和持久化存档', () => {
  writeSave({ coins: 900, unlocked: ['shiba', 'fox'], settings: { music: false } });
  const reset = resetSave();
  assert.deepEqual(reset, createDefaultSave());
  clearSaveCache();
  assert.deepEqual(loadSave(), createDefaultSave());
});
