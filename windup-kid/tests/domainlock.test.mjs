import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedHost } from '../src/core/domainlock.js';

test('白名单域名放行', () => {
  assert.equal(isAllowedHost('localhost'), true);
  assert.equal(isAllowedHost('127.0.0.1'), true);
  assert.equal(isAllowedHost('pipygames.com'), true);
  assert.equal(isAllowedHost('www.pipygames.com'), true);
});

test('非白名单域名拦截', () => {
  assert.equal(isAllowedHost('example.com'), false);
  assert.equal(isAllowedHost('pipygames.com.evil.io'), false);
  assert.equal(isAllowedHost('192.168.1.10'), false);
});

test('file:// 与空 host 在开发期放行', () => {
  assert.equal(isAllowedHost('', 'file:'), true);
  assert.equal(isAllowedHost('', 'https:'), true);
});
