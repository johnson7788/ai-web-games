// KILN 2048 · 釉色档位表：数值 = 窑温档位，2/4/8…映射到中国陶瓷釉色。
// 2048 = 天青出窑（signature）。颜色供 render 使用，名称供 HUD/结算使用。
export const GLAZE = {
  2:    { en: 'Bisque', zh: '素坯', color: '#E8D6BC', ink: '#4A3B28' },
  4:    { en: 'Celadon', zh: '青釉', color: '#9FBBA8', ink: '#16301F' },
  8:    { en: 'Jun Red', zh: '钧红', color: '#C95B4A', ink: '#3A1210' },
  16:   { en: 'Underglaze Red', zh: '釉里红', color: '#B23A3A', ink: '#FFFFFF' },
  32:   { en: 'Blue-and-White', zh: '青花', color: '#3F6FB5', ink: '#FFFFFF' },
  64:   { en: 'Flambé', zh: '窑变', color: '#8A5BB0', ink: '#FFFFFF' },
  128:  { en: 'Bean Red', zh: '豇豆红', color: '#C14B63', ink: '#FFFFFF' },
  256:  { en: 'Lang Red', zh: '郎窑红', color: '#A6332E', ink: '#FFFFFF' },
  512:  { en: 'Jun Purple', zh: '钧紫', color: '#6B4FA8', ink: '#FFFFFF' },
  1024: { en: 'Sapphire', zh: '宝石蓝', color: '#2E6FBF', ink: '#FFFFFF' },
  2048: { en: 'Sky Celadon', zh: '天青', color: '#6FD8E8', ink: '#083038', glow: true },
};

export const GLAZE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

export function glaze(v) {
  return GLAZE[v] || { en: String(v), zh: String(v), color: '#CBBFA8', ink: '#FFFFFF' };
}

export function glazeName(v, lang) {
  const g = glaze(v);
  return g[lang] || g.en;
}

export function glazeColor(v) {
  return glaze(v).color;
}

export function glazeInk(v) {
  return glaze(v).ink || '#FFFFFF';
}
