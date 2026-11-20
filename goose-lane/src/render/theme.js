// src/render/theme.js — 三场景包色板与装饰（换章必换：色板 + 构图 + 装饰）
import { SCENES } from '../../config/levels.js';

export function sceneFor(index) {
  return SCENES[(index - 1) % SCENES.length] || SCENES[0];
}

export const SCENE_COUNT = SCENES.length;
export { SCENES };
