import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { stationAt } from '../config/tracks.js';

test('buildTrack 生成闭合赛道且长度为正', () => {
  const t = buildTrack(stationAt(1).shape);
  assert.ok(t.length > 1000, `长度应 > 1000，实际 ${t.length}`);
  assert.ok(t.samples.length > 100);
});

test('sampleAt 在起点与终点连续（闭合）', () => {
  const t = buildTrack(stationAt(1).shape);
  const a = t.sampleAt(0);
  const b = t.sampleAt(t.length);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.5, '首尾应基本重合');
});

test('sampleAt 负进度回绕到末尾', () => {
  const t = buildTrack(stationAt(1).shape);
  const a = t.sampleAt(-10);
  assert.ok(a.x === a.x && a.y === a.y, '坐标应为有限值');
  const b = t.sampleAt(t.length - 10);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1.0, '负进度应等价于 length-10');
});

test('sampleAt 超长进度回绕', () => {
  const t = buildTrack(stationAt(1).shape);
  const a = t.sampleAt(t.length + 50);
  const b = t.sampleAt(50);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.5);
});

test('窄桥站存在半宽收窄的路段', () => {
  const t = buildTrack(stationAt(6).shape);
  const widths = t.samples.map((s) => s.halfWidth);
  const minW = Math.min(...widths);
  const maxW = Math.max(...widths);
  assert.ok(minW < maxW, '应有窄桥与非窄桥的宽度差');
});

test('所有采样点数值有限', () => {
  for (const st of [1, 6, 12]) {
    const t = buildTrack(stationAt(st).shape);
    for (const s of t.samples) {
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), `站 ${st} 坐标有限`);
      assert.ok(Number.isFinite(s.curvature), `站 ${st} 曲率有限`);
      assert.ok(Number.isFinite(s.angle), `站 ${st} 切线角有限`);
      assert.ok(s.halfWidth > 0, `站 ${st} 半宽为正`);
    }
  }
});
