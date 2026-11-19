// src/game/table.js — 太空弹球台面布局（固定单台，位置手工排布，seed 无关）
import { WORLD } from '../../config/game.config.js';
import { FLIPPER, REACTOR, BUMPER, BLACKHOLE, PORTAL, BUTTON, GATE, SHARD, ASTEROID, STAR } from '../../config/gameplay.js';

const L = WORLD.PF_LEFT;
const R = WORLD.PF_RIGHT;
const T = WORLD.PF_TOP;
const B = WORLD.PF_BOTTOM;

export function buildTable() {
  const segments = [];
  const seg = (x1, y1, x2, y2, kind = 'wall') => segments.push({ x1, y1, x2, y2, kind });

  // 外壁
  seg(L, T, R, T, 'wall');          // 顶
  seg(L, T, L, B, 'wall');          // 左
  seg(R, T, R, B, 'wall');          // 右

  // 偏转板（原版 RectTrampoline：沿自身法线把球弹开）
  seg(330, 210, 430, 130, 'deflector');
  seg(950, 210, 850, 130, 'deflector');

  // 发射台（原版 ShootTrampoline：球静置后向上发射）
  seg(560, 500, 720, 500, 'launchpad');

  return {
    segments,
    flippers: [
      { id: 'left', px: FLIPPER.LEFT_PX, py: FLIPPER.PY, len: FLIPPER.LEN, rest: FLIPPER.LEFT_REST, flip: FLIPPER.LEFT_FLIP },
      { id: 'right', px: FLIPPER.RIGHT_PX, py: FLIPPER.PY, len: FLIPPER.LEN, rest: FLIPPER.RIGHT_REST, flip: FLIPPER.RIGHT_FLIP },
    ],
    reactor: { x: 640, y: 340, r: REACTOR.R },
    bumpers: [
      { x: 505, y: 240, r: BUMPER.R },
      { x: 775, y: 240, r: BUMPER.R },
      { x: 640, y: 150, r: BUMPER.R },
    ],
    blackHoles: [{ x: 520, y: 90, r: BLACKHOLE.R }],
    portal: { in: { x: 900, y: 560, r: PORTAL.R }, out: { x: 380, y: 560 } },
    buttons: [{ x: 430, y: 585 }, { x: 640, y: 565 }, { x: 850, y: 585 }],
    gates: [{ x: 380, y: 90 }, { x: 900, y: 90 }, { x: 640, y: 45 }],
    shards: [{ x: 400, y: 300 }, { x: 880, y: 300 }, { x: 640, y: 210 }],
    upgradePads: [{ x: 360, y: 360 }, { x: 920, y: 360 }, { x: 640, y: 250 }],
    asteroids: [{ x: 470, y: 400 }, { x: 810, y: 400 }, { x: 600, y: 480 }],
    stars: [{ x: 400, y: 100 }, { x: 880, y: 100 }, { x: 640, y: 95 }],
  };
}
