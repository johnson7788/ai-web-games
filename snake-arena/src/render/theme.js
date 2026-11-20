// SNAKE ARENA · 三场景包色板（换章必换：色板 + 构图 + 装饰）
// core=数据核心(蓝) / meltdown=熔断区(橙红) / deepnet=深网(紫黑)
export const THEMES = {
  core: {
    bgTop: '#02050d',
    bgBottom: '#041224',
    grid: 'rgba(56,189,248,0.10)',
    gridHi: 'rgba(56,189,248,0.20)',
    decor: 'rgba(34,211,238,0.55)',
    food: '#22d3ee',
    shard: '#e0f2fe',
    accent: '#38bdf8',
    player: '#e0f2fe',
    playerGlow: '#7dd3fc',
    playerLabel: '#fbbf24',
    enemyLabel: 'rgba(186,230,253,0.85)',
    enemies: ['#3b82f6', '#0ea5e9', '#6366f1', '#0891b2'],
    enemyGlow: 'rgba(56,189,248,0.8)',
    wall: '#0b3a5e',
  },
  meltdown: {
    bgTop: '#140602',
    bgBottom: '#260d04',
    grid: 'rgba(251,146,60,0.12)',
    gridHi: 'rgba(251,146,60,0.22)',
    decor: 'rgba(251,113,40,0.6)',
    food: '#fb923c',
    shard: '#ffedd5',
    accent: '#fb923c',
    player: '#fff7ed',
    playerGlow: '#fdba74',
    playerLabel: '#fbbf24',
    enemyLabel: 'rgba(254,215,170,0.85)',
    enemies: ['#ea580c', '#f97316', '#ef4444', '#d97706'],
    enemyGlow: 'rgba(251,146,60,0.8)',
    wall: '#5c1a06',
  },
  deepnet: {
    bgTop: '#07030f',
    bgBottom: '#170a2a',
    grid: 'rgba(168,85,247,0.10)',
    gridHi: 'rgba(168,85,247,0.20)',
    decor: 'rgba(167,139,250,0.55)',
    food: '#a855f7',
    shard: '#f3e8ff',
    accent: '#a855f7',
    player: '#faf5ff',
    playerGlow: '#d8b4fe',
    playerLabel: '#fbbf24',
    enemyLabel: 'rgba(233,213,255,0.85)',
    enemies: ['#8b5cf6', '#a855f7', '#6d28d9', '#c084fc'],
    enemyGlow: 'rgba(168,85,247,0.8)',
    wall: '#3b1470',
  },
};

export function themeOf(name) {
  return THEMES[name] || THEMES.core;
}
