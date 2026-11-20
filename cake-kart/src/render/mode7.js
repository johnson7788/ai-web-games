// src/render/mode7.js — Mode7 地板投影：把俯视赛道贴图按相机透视投到低分辨率缓冲区。
// 只做地板与天空；卡丁车/特效由 index.js 以精灵方式叠画。
import { CAMERA, FLOOR, WORLD, scene, hexToRgb, rgbCss, mixRgb } from './theme.js';

const HALF = WORLD.MAP_SIZE / 2;      // 1024 世界单位
const SCALE = WORLD.MAP_SIZE / 1024;  // 2 世界单位 / 纹素

/**
 * 把 trackMap（canvas）投影为低分辨率地板 canvas（含天空）。
 * mapCanvas：1024×1024 赛道贴图；camX/camY：相机世界位置；angle：相机朝向（世界角）。
 */
export function renderFloor(mapCanvas, camX, camY, angle, sceneIdx) {
  const sc = scene(sceneIdx);
  const W = FLOOR.W;
  const H = FLOOR.H;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const data = img.data;

  // 读贴图像素
  const mctx = mapCanvas.getContext('2d');
  const mimg = mctx.getImageData(0, 0, 1024, 1024);
  const mp = mimg.data;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const skyTop = hexToRgb(sc.skyTop);
  const skyBottom = hexToRgb(sc.skyBottom);
  const fog = hexToRgb(sc.skyBottom);

  const horizon = CAMERA.HORIZON;
  const fogNear = 1200;   // 世界距离，超过开始起雾
  const fogFar = 2600;

  for (let py = 0; py < H; py += 1) {
    const sy = ((py + 0.5) * WORLD.HEIGHT) / H;
    // 天空渐变
    if (sy <= horizon) {
      const t = sy / horizon;
      const c = mixRgb(skyTop, skyBottom, t);
      for (let px = 0; px < W; px += 1) {
        const o = (py * W + px) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
      continue;
    }

    const z = (CAMERA.HEIGHT * CAMERA.FOCAL) / (sy - horizon);
    const scale = z / CAMERA.FOCAL;
    const fogT = Math.max(0, Math.min(1, (z - fogNear) / (fogFar - fogNear)));

    for (let px = 0; px < W; px += 1) {
      const sx = ((px + 0.5) * WORLD.WIDTH) / W - WORLD.WIDTH / 2;
      const l = sx * scale;
      const wx = camX + cosA * z - sinA * l;
      const wy = camY + sinA * z + cosA * l;

      const tx = (wx + HALF) / SCALE;
      const ty = (wy + HALF) / SCALE;
      const o = (py * W + px) * 4;

      let r;
      let g;
      let b;
      if (tx < 0 || tx >= 1024 || ty < 0 || ty >= 1024) {
        // 界外：填充场景地面色
        const gg = hexToRgb(sc.ground);
        r = gg[0]; g = gg[1]; b = gg[2];
      } else {
        const ti = ((ty | 0) * 1024 + (tx | 0)) * 4;
        r = mp[ti];
        g = mp[ti + 1];
        b = mp[ti + 2];
      }

      if (fogT > 0) {
        r = r + (fog[0] - r) * fogT;
        g = g + (fog[1] - g) * fogT;
        b = b + (fog[2] - b) * fogT;
      }

      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }

  octx.putImageData(img, 0, 0);
  return out;
}
