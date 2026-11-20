// CORGI DASH · 三场景包主题（晨雾草原 / 麦浪 / 暴雨山丘）
// 换章必换：色板 + 构图（地平线/远山/装饰）+ 天气装饰；纯程序化，无外部素材。

export const THEMES = {
  meadow: {
    decor: 'meadow',
    skyTop: '#8fd3b4',
    skyBottom: '#e6f4e8',
    ground: '#6aa85f',
    groundDark: '#4f8a4d',
    hillFar: '#a9ddc0',
    hillNear: '#7cc98f',
    accent: '#2f6f4f',
    fog: 'rgba(226,255,236,0.55)',
    cloud: 'rgba(255,255,255,0.75)',
    decorKind: 'mist',       // 晨雾
  },
  wheat: {
    decor: 'wheat',
    skyTop: '#f6d98a',
    skyBottom: '#fdf3d0',
    ground: '#d9a441',
    groundDark: '#b07f28',
    hillFar: '#efc263',
    hillNear: '#d99a3c',
    accent: '#8a5a1c',
    fog: 'rgba(255,240,200,0.5)',
    cloud: 'rgba(255,255,255,0.8)',
    decorKind: 'wheatWave',  // 麦浪
  },
  storm: {
    decor: 'storm',
    skyTop: '#3f4e5e',
    skyBottom: '#1f2730',
    ground: '#3a4a58',
    groundDark: '#28333e',
    hillFar: '#56697a',
    hillNear: '#43566a',
    accent: '#1d2733',
    fog: 'rgba(180,200,220,0.35)',
    cloud: 'rgba(120,140,160,0.55)',
    decorKind: 'rain',       // 暴雨
  },
};

export const THEME_KEYS = Object.keys(THEMES);

// decor key → 主题对象（未知回退 meadow）
export function themeFor(decor) {
  return THEMES[decor] || THEMES.meadow;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function clamp01(v) {
  const n = Number(v) || 0;
  return Math.min(1, Math.max(0, n));
}

export function blendPalette(fromTheme, toTheme, t) {
  const k = clamp01(t);
  const keys = ['skyTop', 'skyBottom', 'ground', 'groundDark', 'hillFar', 'hillNear', 'accent'];
  const out = { decor: k < 0.5 ? fromTheme.decor : toTheme.decor, decorKind: k < 0.5 ? fromTheme.decorKind : toTheme.decorKind };
  for (const key of keys) out[key] = mixHex(fromTheme[key], toTheme[key], k);
  return out;
}
