import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCamera, updateCamera } from '../src/game/camera.js';
import { CONFIG } from '../config/game.config.js';

const lv = { w: 100, h: 16, spawn: { x: 50, y: 2 } };
const t = (x, extra = {}) => ({ x, y: 2, vx: 0, grounded: true, ...extra });

test('死区内移动，相机不动', () => {
  const cam = { x: 50, y: 4 };
  updateCamera(cam, t(51.5), lv, 1 / 60);
  assert.equal(cam.x, 50);
});

test('超出死区后跟随并夹在死区边界', () => {
  const cam = { x: 50, y: 4 };
  updateCamera(cam, t(56), lv, 1 / 60);
  assert.ok(Math.abs(cam.x - (56 - CONFIG.camera.deadzoneX)) < 1e-6, `x=${cam.x}`);
});

test('关卡边界钳制', () => {
  const cam = { x: 50, y: 4 };
  for (let i = 0; i < 200; i++) updateCamera(cam, t(99), lv, 1 / 60);
  assert.ok(cam.x <= lv.w - 12 + 1e-6, `x=${cam.x}`);
  for (let i = 0; i < 300; i++) updateCamera(cam, t(0), lv, 1 / 60);
  assert.ok(cam.x >= 12 - 1e-6, `x=${cam.x}`);
});

test('落地才跟随 Y，腾空小位移时不动', () => {
  const cam = { x: 50, y: 7 };
  const y0 = cam.y;
  updateCamera(cam, t(50, { y: 7.2, grounded: false }), lv, 1 / 60);
  assert.ok(Math.abs(cam.y - y0) < 1e-6, `y=${cam.y}`);
  for (let i = 0; i < 120; i++) updateCamera(cam, t(50, { y: 9, grounded: true }), lv, 1 / 60);
  assert.ok(cam.y > y0, '落地后应向上跟随');
  assert.ok(cam.y <= 11 + 1e-6, `y=${cam.y}`);
});

test('makeCamera 落在出生点', () => {
  const cam = makeCamera(lv);
  assert.equal(cam.x, 50);
});
