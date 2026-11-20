// 三场景包主题：晨跑（亮）/ 山道（绿）/ 夜城（霓虹）。
// 换章必换色板 + 构图 + 装饰；render/index.js 据此绘制。
export const SCENES = {
  morning: {
    skyTop: '#8ecbff',
    skyBot: '#eef8ff',
    sun: '#ffd166',
    ground: '#2f9e44',
    groundAlt: '#3fb54f',
    lane: 'rgba(255,255,255,0.20)',
    laneEdge: 'rgba(0,0,0,0.12)',
    track: '#46b45c',
    finishA: '#111111',
    finishB: '#ffffff',
    accent: '#ffb703',
    deco: 'city',
  },
  mountain: {
    skyTop: '#a8dcb0',
    skyBot: '#eaf6d5',
    sun: '#f6d365',
    ground: '#356b3a',
    groundAlt: '#407d45',
    lane: 'rgba(255,255,255,0.18)',
    laneEdge: 'rgba(0,0,0,0.12)',
    track: '#4a8b4e',
    finishA: '#222222',
    finishB: '#ffffff',
    accent: '#e7c14a',
    deco: 'mountain',
  },
  night: {
    skyTop: '#0b1026',
    skyBot: '#232a55',
    sun: '#e0e7ff',
    ground: '#2a1e4a',
    groundAlt: '#35286a',
    lane: 'rgba(120,140,255,0.22)',
    laneEdge: 'rgba(0,0,0,0.35)',
    track: '#3a2f6e',
    finishA: '#e6e6ff',
    finishB: '#111111',
    accent: '#ff2e97',
    deco: 'neon',
  },
};

export function sceneFor(level) {
  if (level <= 4) return SCENES.morning;
  if (level <= 8) return SCENES.mountain;
  return SCENES.night;
}

export function sceneName(level) {
  if (level <= 4) return 'morning';
  if (level <= 8) return 'mountain';
  return 'night';
}
