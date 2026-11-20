// MOSAIC SLIDE · 程序化琉璃花窗图案生成（纯逻辑，零 DOM）
// 每关一个「对称随机（seeded）」的玫瑰花窗：径向 ring + fold 扇区，颜色/纹样由关卡 index 决定，
// 参考图与拼块永远来自同一图案（保证可复原）。run seed 只影响 shuffle，不影响图案。
// 只输出颜色/纹样元数据，像素换算在 render 层完成。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 三场景色板：晨光暖金 / 午后亮蓝 / 夜殿深紫烛金。每套 6 主色 + 4 强调色。
const PALETTES = {
  'workshop-dawn': {
    fills: ['#E8A33D', '#C25A3C', '#8E3B5B', '#3F7C8C', '#E8C77A', '#B85C4A'],
    accents: ['#FFE3A0', '#F2D06B', '#7FC8D8', '#F2B36B'],
    lead: '#4A2E1C',
    glow: 'rgba(255,224,150,0.55)',
  },
  'glass-afternoon': {
    fills: ['#2E86AB', '#37B6CE', '#4E9E7A', '#F2C14E', '#D96C7B', '#3A7CA5'],
    accents: ['#C9F2FF', '#F2D06B', '#8FE3C0', '#FF9FB2'],
    lead: '#1E3A45',
    glow: 'rgba(190,240,255,0.5)',
  },
  'candle-night': {
    fills: ['#5A3B8C', '#3E2A6B', '#C7794A', '#E0A458', '#8C5A9E', '#2E2450'],
    accents: ['#FFC77A', '#E0A458', '#C79BE8', '#FFE3B0'],
    lead: '#1A1230',
    glow: 'rgba(255,199,122,0.45)',
  },
};

// 归一化窗口半径（棋盘方形内接圆，含四角装饰）
const R_MAX = 0.72;

export function createPattern(level) {
  const seed = level.index * 7919 + 17;
  const rng = mulberry32(seed);
  const P = PALETTES[level.scene] || PALETTES['workshop-dawn'];
  const fold = level.rows >= 5 ? 8 : 6;           // 径向对称折数
  const rings = 4;                                 // 0 中心 / 1 内环 / 2 外环 / 3 角饰

  // 每扇区一个轻微色相偏移（确定性），让相邻扇区有区分度
  const sectorShift = [];
  for (let s = 0; s < fold; s += 1) sectorShift.push(Math.floor(rng() * P.fills.length));

  function cell(r, c) {
    const dx = (c + 0.5) / level.cols - 0.5;
    const dy = (r + 0.5) / level.rows - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const norm = Math.min(1, dist / R_MAX);
    const angle = Math.atan2(dy, dx);
    const seg = (Math.PI * 2) / fold;
    // 反射对称：把角度折进半个扇区，得到左右/上下镜像的花窗
    const folded = Math.abs((angle % seg + seg) % seg - seg / 2);
    const sector = Math.floor(((angle + Math.PI) % seg) / seg) % fold;

    let ring = 0;
    if (norm >= 0.2) ring = 1;
    if (norm >= 0.44) ring = 2;
    if (norm >= 0.62) ring = 3;

    const fillIdx = (ring * 2 + sector + sectorShift[sector]) % P.fills.length;
    const accentIdx = (sector + ring + sectorShift[(sector + 1) % fold]) % P.accents.length;
    const variant = level.dual ? ((r + c) % 2) : 0;   // 双图关：两幅纹样按棋盘交织

    // 纹样类型：0 花蕊 / 1 花瓣 / 2 面板 / 3 角饰
    let motif = 0;
    if (ring === 1) motif = 1;
    else if (ring === 2) motif = 2;
    else if (ring === 3) motif = 3;

    return {
      r, c,
      dist: norm,
      angle,
      folded,
      sector,
      ring,
      motif,
      variant,
      fill: P.fills[fillIdx],
      accent: P.accents[accentIdx],
      lead: P.lead,
      glow: P.glow,
      // 确定性微光泽，用于描边高光
      glint: 0.4 + 0.6 * sectorShift[(sector + ring) % fold] / fold,
    };
  }

  return { palette: P, fold, rings, R_MAX, cell, level: { rows: level.rows, cols: level.cols, dual: level.dual } };
}

export { PALETTES };
