import test from 'node:test';
import assert from 'node:assert/strict';
import { t, setLang, getLang } from '../src/core/i18n.js';

test('默认英文', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('play'), 'PLAY');
});

test('切中文', () => {
  setLang('zh');
  assert.equal(t('play'), '开始游戏');
  assert.equal(t('gears'), '齿轮');
});

test('缺失 key 回落英文，未知 key 原样返回', () => {
  setLang('zh');
  assert.equal(t('__missing__'), '__missing__');
});

test('变量插值', () => {
  setLang('zh');
  assert.equal(t('starTime', { t: 30 }), '30 秒内');
});

test('非法语言回退英文', () => {
  setLang('fr');
  assert.equal(getLang(), 'en');
});
