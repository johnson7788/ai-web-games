const spawnRadius = 5.6;
const springRadius = 9.3;

export const CLOUD_RING = {
  id: 'cloud-ring',
  name: { zh: '云端擂台', en: 'Cloud Ring' },
  shape: 'circle',
  radius: 11.5,
  thickness: 0.9,
  friction: 1,
  palette: { surface: '#FFE9C7', side: '#FF7A59', rim: '#FFD166', sky1: '#8FD3FF', sky2: '#DFF4FF' },
  spawns: Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return { x: Math.sin(angle) * spawnRadius, y: 0, z: Math.cos(angle) * spawnRadius, facing: angle + Math.PI };
  }),
  springs: Array.from({ length: 4 }, (_, index) => {
    const angle = Math.PI / 4 + index * Math.PI / 2;
    return { x: Math.sin(angle) * springRadius, z: Math.cos(angle) * springRadius, rotation: angle };
  }),
  hazards: [],
  props: ['clouds', 'balloons', 'flags'],
};

export const CANDY_WORKS = {
  id: 'candy-works',
  name: { zh: '糖果工厂', en: 'Candy Works' },
  shape: 'rect',
  radius: 13,
  width: 26,
  depth: 16,
  thickness: 0.9,
  friction: 1,
  palette: { surface: '#FFD9E8', side: '#C96B9E', rim: '#FFB3CE', sky1: '#FFB7D5', sky2: '#FFF0F6' },
  // 出生点必须靠近中心：否则开局玩家在边缘、镜头只能看到自己，
  // 糖果工厂的糖棒/厂房又会占满画面（M4 实测）。
  spawns: Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return { x: Math.sin(angle) * 5.8, y: 0, z: Math.cos(angle) * 4.4, facing: angle + Math.PI };
  }),
  hazards: [
    { type: 'sweeper', x: -5.2, z: 0, length: 6.5, radius: 0.28, angularSpeed: 1.25, phase: 0, knock: 14, poise: 30, stagger: 0.3 },
    { type: 'sweeper', x: 5.2, z: 0, length: 6.5, radius: 0.28, angularSpeed: 1.25, phase: Math.PI, knock: 14, poise: 30, stagger: 0.3 },
    { type: 'conveyor', x: 0, z: 0, width: 5, depth: 16, dx: 1, dz: 0, speed: 1.6 },
  ],
  props: ['candy-canes', 'pipes', 'lollipops'],
};

export const FROZEN_LAKE = {
  id: 'frozen-lake',
  name: { zh: '冰湖', en: 'Frozen Lake' },
  shape: 'circle',
  radius: 13,
  thickness: 0.75,
  friction: 0.22,
  palette: { surface: '#CFEFFF', side: '#7FB6D9', rim: '#E8FBFF', sky1: '#122A55', sky2: '#4FC3C7' },
  spawns: Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return { x: Math.sin(angle) * 6.8, y: 0, z: Math.cos(angle) * 6.8, facing: angle + Math.PI };
  }),
  hazards: [],
  props: ['aurora', 'snow-pines', 'ice-floes'],
};

export const ARENAS = [CLOUD_RING, CANDY_WORKS, FROZEN_LAKE];
export const ARENA_MAP = Object.fromEntries(ARENAS.map((arena) => [arena.id, arena]));
