import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, createAudio } from '../src/core/audio.js';

function rms(pcm) {
  let s = 0;
  for (let i = 0; i < pcm.length; i += 1) s += pcm[i] * pcm[i];
  return Math.sqrt(s / Math.max(1, pcm.length));
}

test('所有 SFX 合成 RMS > 0 且无 NaN', () => {
  assert.ok(SFX_NAMES.length >= 10, 'SFX 数量应足够');
  for (const name of SFX_NAMES) {
    const pcm = synthSfx(name, {}, 22050);
    assert.ok(pcm.length > 0, `${name} 应非空`);
    assert.ok(rms(pcm) > 0, `${name} RMS 应 > 0`);
    assert.ok(!pcm.some((x) => Number.isNaN(x)), `${name} 不应有 NaN`);
  }
});

test('BGM 循环条可合成且 RMS > 0', () => {
  for (const name of LOOP_NAMES) {
    const pcm = synthLoop(name, 22050);
    assert.ok(pcm.length > 2000, `${name} 应足够长`);
    assert.ok(rms(pcm) > 0, `${name} RMS 应 > 0`);
  }
});

test('createAudio API 形状正确', () => {
  const a = createAudio();
  for (const key of ['unlock', 'event', 'setMuted', 'setVolume', 'playBgm', 'stopBgm', 'beatPhase']) {
    assert.equal(typeof a[key], 'function', `${key} 应为函数`);
  }
});
