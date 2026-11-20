// src/game/table.js — 台面布局构建（纯逻辑，seed 无关：位置固定，只按台面参数开/关机关）
import { WORLD } from '../../config/game.config.js';
import { tableAt } from '../../config/tables.js';
import { FLIPPER, BUMPER, MAGNET, BLACKHOLE } from '../../config/gameplay.js';

const L = WORLD.PF_LEFT;
const R = WORLD.PF_RIGHT;
const T = WORLD.PF_TOP;
const B = WORLD.PF_BOTTOM;

// 各机关固定槽位（按台面参数切片开启）
const BUMPER_SLOTS = [[520, 260], [760, 260], [640, 340], [520, 430], [760, 430], [420, 330], [860, 330], [640, 200]];
const TARGET_SLOTS = [[360, 280], [920, 280], [640, 380], [480, 300], [800, 300], [360, 430], [920, 430], [560, 460]];
const SUPER_SLOTS = [[410, 110], [640, 70], [870, 110]];
const MAGNET_SLOTS = [[400, 200], [880, 200]];
const BH_SLOTS = [[640, 240], [520, 240], [760, 240]];
const RAMP_DEFS = [
  { x1: 330, y1: 520, x2: 430, y2: 360 },
  { x1: 950, y1: 520, x2: 850, y2: 360 },
  { x1: 560, y1: 420, x2: 720, y2: 300 },
  { x1: 330, y1: 360, x2: 430, y2: 240 },
];

export function buildTable(index) {
  const cfg = tableAt(index);
  const segments = [];
  const seg = (x1, y1, x2, y2, kind = 'wall', restitution) =>
    segments.push({ x1, y1, x2, y2, kind, restitution });

  // 外壁
  seg(L, T, R, T, 'wall');
  seg(L, T, L, B, 'wall');
  seg(R, T, R, B, 'wall');

  // 两侧 outlane 掉球缝：默认无底墙，球可从两侧漏掉（风险）。
  // 窄 outlane（machine 11+）：把两侧回球道收窄为很短的引导，掉球风险更大。
  if (cfg.narrowOutlanes) {
    seg(L, B, L + 40, B - 24, 'wall');
    seg(R, B, R - 40, B - 24, 'wall');
  }
  // 默认（机器 1–10）：无 outlane 引导，靠挡板救球

  // 坡道
  for (let i = 0; i < cfg.ramps; i += 1) {
    const d = RAMP_DEFS[i];
    if (d) seg(d.x1, d.y1, d.x2, d.y2, 'ramp');
  }

  // 挡板
  const flippers = [
    { id: 'left', px: FLIPPER.LEFT_PX, py: FLIPPER.PY, len: FLIPPER.LEN, rest: FLIPPER.LEFT_REST, flip: FLIPPER.LEFT_FLIP },
    { id: 'right', px: FLIPPER.RIGHT_PX, py: FLIPPER.PY, len: FLIPPER.LEN, rest: FLIPPER.RIGHT_REST, flip: FLIPPER.RIGHT_FLIP },
  ];
  if (cfg.rotatingFlipper) {
    flippers.push({ id: 'center', px: 640, py: 500, len: 86, rest: 0, flip: 0, spin: true, spinSpeed: 3.2 });
  }

  return {
    index,
    scene: cfg.scene,
    targetScore: cfg.targetScore,
    newElement: cfg.newElement,
    doubleBall: cfg.doubleBall,
    narrowOutlanes: cfg.narrowOutlanes,
    movingTargets: cfg.movingTargets,
    segments,
    flippers,
    bumpers: BUMPER_SLOTS.slice(0, cfg.bumpers).map(([x, y]) => ({ x, y, r: BUMPER.R })),
    targets: TARGET_SLOTS.slice(0, cfg.targets).map(([x, y]) => ({ x, y, moving: cfg.movingTargets })),
    superconducts: SUPER_SLOTS.map(([x, y]) => ({ x, y })),
    topRing: { x: 640, y: 150, r: 34 },
    magnets: MAGNET_SLOTS.slice(0, cfg.magnets).map(([x, y]) => ({ x, y, r: MAGNET.R })),
    blackHoles: BH_SLOTS.slice(0, cfg.blackHoles).map(([x, y]) => ({ x, y, r: BLACKHOLE ? 26 : 26 })),
  };
}
