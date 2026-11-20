// SAUCER STRIKE · 生成器：碟飞行路径（直掠/Z 字/俯冲/悬停）纯逻辑
// 所有随机来自传入的 mulberry32 rng，同 seed 同结果。
import { WORLD } from '../../config/gameplay.js';
import { randInt } from './rng.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

// 路径点 { x, y, hold? }；hold 秒数 >0 表示在该点悬停。
function straight(rng) {
  const leftToRight = rng() < 0.5;
  const y1 = randInt(rng, 170, 460);
  const y2 = y1 + randInt(rng, -70, 70);
  if (leftToRight) {
    return [{ x: -60, y: y1 }, { x: W + 60, y: y2 }];
  }
  return [{ x: W + 60, y: y1 }, { x: -60, y: y2 }];
}

function zigzag(rng) {
  const y0 = randInt(rng, 180, 320);
  const amp = randInt(rng, 70, 120);
  const xs = [-60, 240, 520, 800, 1080, W + 60];
  const pts = xs.map((x, i) => ({
    x,
    y: i % 2 === 0 ? y0 : y0 + amp,
  }));
  return pts;
}

function swoop(rng) {
  const sx = randInt(rng, 150, 500);
  const ex = randInt(rng, 780, 1130);
  const dipY = randInt(rng, 360, 460);
  const dipX = randInt(rng, 520, 760);
  return [{ x: sx, y: -70 }, { x: dipX, y: dipY }, { x: ex, y: -70 }];
}

function hover(rng) {
  const y1 = randInt(rng, 170, 340);
  const hx = randInt(rng, 420, 860);
  const hy = randInt(rng, 180, 380);
  const y2 = y1 + randInt(rng, -80, 80);
  return [
    { x: -60, y: y1 },
    { x: hx, y: hy, hold: 2.0 },
    { x: W + 60, y: y2 },
  ];
}

const PATH_BUILDERS = {
  straight,
  zigzag,
  swoop,
  hover,
};

export function buildPath(rng, pathType) {
  const fn = PATH_BUILDERS[pathType] || straight;
  return fn(rng);
}
