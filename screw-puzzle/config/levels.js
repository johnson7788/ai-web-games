// 30 关关卡数据。板用世界坐标（1280×720）先按「外接盒缩放居中」归一化，
// 保证不同关卡视觉体量一致；轮廓在 横长(wide) / 竖高(tall) / 方阵(square) 间轮换。
// 每块板规格：[x, y, w, h, angle(度), colorKey, screwCount]；screws 由布局器展开。
import { WORLD, GAME } from './game.config.js';

const PALETTE = ['steel', 'gunmetal', 'copper', 'brass', 'iron', 'olive', 'rust', 'slate', 'navy'];

// 螺丝布局：相对板中心，往边缘铺开（横板宽、纵向受限）。2=对角，3=上两角+下中点，4=四角。
function screwLayout(w, h, n) {
  const mx = Math.min(160, w * 0.32);
  const my = Math.min(88, h * 0.42);
  const layout = {
    2: [[-mx, -my], [mx, my]],
    3: [[-mx, -my], [mx, -my], [0, my]],
    4: [[-mx, -my], [mx, -my], [-mx, my], [mx, my]],
  }[n];
  return (layout || []).map(([x, y]) => ({ x, y }));
}

// 三种轮廓：宽窄逐层收窄，形成「上层盖住下层螺丝」的可解一叠。
// n 由各 shape 固定；宽板(w)数组长度即层数。
const SHAPES = {
  wide:    { w: [800, 760, 720],             h: 130, gap: 100 }, // 横长
  wide4:   { w: [820, 780, 740, 700],        h: 128, gap: 72 },  // 横长(4层)
  square:  { w: [720, 690, 660, 630],        h: 126, gap: 99 },  // 方阵
  square5: { w: [720, 690, 660, 630, 600],   h: 124, gap: 70 },  // 方阵(5层)
  tall:    { w: [560, 540, 520, 540, 520],   h: 120, gap: 70 },  // 竖高
};

const ANGLE = [0, -2, 2, -1, 1, 2, -2, 0];

// 关卡谱表：shape 决定层数与轮廓；screws 为每层螺丝数（长度=层数）。
const SPEC = [
  { shape: 'wide',    screws: [2, 2, 2],          name: { en: 'First Bolts',   zh: '第一颗螺丝' } },
  { shape: 'wide4',   screws: [2, 2, 2, 2],       name: { en: 'Tilted Stack',  zh: '倾斜的板' } },
  { shape: 'tall',    screws: [2, 3, 2, 3, 2],    name: { en: 'Wide Load',     zh: '宽板' } },
  { shape: 'square5', screws: [3, 3, 3, 3, 3],    name: { en: 'Navy Tower',    zh: '海军塔' } },
  { shape: 'tall',    screws: [3, 3, 3, 3, 3],    name: { en: 'Iron Sandwich', zh: '铁夹心' } },
  { shape: 'tall',    screws: [3, 2, 3, 2, 3],    name: { en: 'Deep Blue',     zh: '深蓝' } },
  { shape: 'wide4',   screws: [3, 3, 3, 3],       name: { en: 'Copper Top',    zh: '铜顶' } },
  { shape: 'square5', screws: [3, 2, 3, 3, 3],    name: { en: 'Four Floors',   zh: '四层' } },
  { shape: 'tall',    screws: [3, 3, 2, 3, 3],    name: { en: 'Rusty Pile',    zh: '锈堆' } },
  { shape: 'wide',    screws: [3, 3, 3],          name: { en: 'Brass Belt',    zh: '黄铜带' } },
  { shape: 'square',  screws: [3, 3, 3, 3],       name: { en: 'Gunmetal Grid', zh: '枪钢格' } },
  { shape: 'square5', screws: [3, 3, 3, 3, 3],    name: { en: 'Olive Bunch',   zh: '橄榄堆' } },
  { shape: 'tall',    screws: [3, 2, 3, 3, 3],    name: { en: 'Rusty Fortress', zh: '锈堡垒' } },
  { shape: 'wide4',   screws: [3, 3, 3, 3],       name: { en: 'Copper Lock',   zh: '铜锁' } },
  { shape: 'square5', screws: [3, 3, 3, 3, 3],    name: { en: 'Slate Stack',   zh: '石板堆' } },
  { shape: 'tall',    screws: [2, 3, 3, 3, 3],    name: { en: 'Iron Spire',    zh: '铁尖塔' } },
  { shape: 'wide',    screws: [3, 3, 3],          name: { en: 'Five Floors',   zh: '五层' } },
  { shape: 'square',  screws: [3, 4, 3, 4],       name: { en: 'Navy Five',     zh: '海军五层' } },
  { shape: 'square5', screws: [3, 3, 3, 3, 3],    name: { en: 'Olive Giant',   zh: '橄榄巨人' } },
  { shape: 'tall',    screws: [3, 3, 3, 3, 2],    name: { en: 'Brass Gate',    zh: '黄铜门' } },
  { shape: 'wide4',   screws: [3, 3, 3, 3],       name: { en: 'Rust Bolt',     zh: '锈螺栓' } },
  { shape: 'square',  screws: [3, 3, 3, 3],       name: { en: 'Copper Five',   zh: '铜五层' } },
  { shape: 'tall',    screws: [2, 3, 3, 3, 3],    name: { en: 'Slate Five',    zh: '石板五层' } },
  { shape: 'wide4',   screws: [3, 3, 3, 2],       name: { en: 'Navy Giant',    zh: '海军巨人' } },
  { shape: 'square',  screws: [3, 3, 4, 3],       name: { en: 'Brass Ladder',  zh: '黄铜梯' } },
  { shape: 'square5', screws: [3, 3, 3, 3, 3],    name: { en: 'Olive Ladder',  zh: '橄榄梯' } },
  { shape: 'tall',    screws: [3, 3, 3, 3, 2],    name: { en: 'Rust Ladder',   zh: '锈梯' } },
  { shape: 'wide',    screws: [2, 3, 3],          name: { en: 'Slate Ladder',  zh: '石板梯' } },
  { shape: 'square',  screws: [3, 3, 3, 3],       name: { en: 'Copper Gate',   zh: '铜门' } },
  { shape: 'tall',    screws: [3, 3, 3, 3, 2],    name: { en: 'Final Tower',   zh: '最终塔' } },
];

function makePlates(spec, i) {
  const s = SHAPES[spec.shape];
  const n = s.w.length;
  const angle = Array.from({ length: n }, (_, k) => ANGLE[(i + k) % ANGLE.length]);
  const ss = Array.isArray(spec.screws) ? spec.screws : Array(n).fill(spec.screws);
  return s.w.map((w, k) => [
    640,
    620 - k * s.gap,
    w,
    s.h,
    angle[k],
    PALETTE[(i + k) % PALETTE.length],
    ss[k],
  ]);
}

// 外接盒（含旋转四角）。
function bboxOf(plates) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const p of plates) {
    const rad = (p.angle * Math.PI) / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    const hw = p.w / 2; const hh = p.h / 2;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const wx = p.x + sx * hw * cos - sy * hh * sin;
      const wy = p.y + sx * hw * sin + sy * hh * cos;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// 缩放居中：让外接盒占屏宽 55–70%、高 45–65%（顶部留 HUD 安全区），并夹紧缩放。
function fit(plates) {
  const bb = bboxOf(plates);
  if (bb.w <= 0 || bb.h <= 0) return;
  const usableH = WORLD.HEIGHT - GAME.FIT.topSafe;
  const targetW = WORLD.WIDTH * GAME.FIT.width;
  const targetH = usableH * GAME.FIT.height;
  let scale = Math.min(targetW / bb.w, targetH / bb.h);
  scale = Math.max(GAME.FIT.min, Math.min(GAME.FIT.max, scale));
  // 若仍超界则再压回世界内（留边距）。
  const margin = 40;
  scale = Math.min(scale, (WORLD.WIDTH - margin * 2) / bb.w, (WORLD.HEIGHT - GAME.FIT.topSafe - margin) / bb.h);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const tx = WORLD.WIDTH / 2;
  const ty = GAME.FIT.topSafe + usableH / 2;
  for (const p of plates) {
    p.x = tx + (p.x - cx) * scale;
    p.y = ty + (p.y - cy) * scale;
    p.w *= scale;
    p.h *= scale;
    for (const s of p.screws) { s.x *= scale; s.y *= scale; }
  }
}

function buildLevel(spec, index) {
  const raw = makePlates(spec, index).map(([x, y, w, h, angle, colorKey, n]) => ({
    x, y, w, h, angle,
    color: GAME.COLORS[colorKey] || colorKey,
    screws: screwLayout(w, h, n),
  }));
  fit(raw);
  return { id: index + 1, name: spec.name, plates: raw };
}

export const LEVELS = SPEC.map(buildLevel);
export const LEVEL_COUNT = LEVELS.length;
