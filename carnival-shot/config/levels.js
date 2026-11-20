// CARNIVAL SHOT · 12 关定义。
// 每关：目标分 + 时限 + 目标行为轮换 + 场景包。三场景包：灯会(1-4) / 河灯(5-8) / 烟花夜(9-12)。
// spawns 为加权列表（[kind, weight]），weight 越大越常出现。
export const SCENES = {
  lantern: { index: 1, name: 'scene.lantern' },
  river: { index: 2, name: 'scene.river' },
  fireworks: { index: 3, name: 'scene.fireworks' },
};

export const LEVELS = [
  {
    index: 1, time: 30, targetScore: 400, scene: 'lantern', spawnInterval: 1.0, speedMul: 1.0,
    spawns: [['kite', 10]], redDucks: 3, newElement: 'paper kite ducks cross the sky',
  },
  {
    index: 2, time: 30, targetScore: 600, scene: 'lantern', spawnInterval: 0.95, speedMul: 1.05,
    spawns: [['kite', 7], ['moving', 3]], redDucks: 3, newElement: 'sliding bullseye target pops up',
  },
  {
    index: 3, time: 30, targetScore: 800, scene: 'lantern', spawnInterval: 0.9, speedMul: 1.1,
    spawns: [['kite', 6], ['lantern', 3], ['moving', 2]], redDucks: 3, newElement: 'slow high-value lantern ducks',
  },
  {
    index: 4, time: 28, targetScore: 1000, scene: 'lantern', spawnInterval: 0.85, speedMul: 1.15,
    spawns: [['kite', 5], ['lantern', 3], ['dive', 3], ['moving', 2]], redDucks: 3, newElement: 'diving ducks swoop fast',
  },
  {
    index: 5, time: 28, targetScore: 1200, scene: 'river', spawnInterval: 0.85, speedMul: 1.2,
    spawns: [['kite', 5], ['lantern', 3], ['dive', 3], ['ghost', 2], ['moving', 2]], redDucks: 3, newElement: 'ghost lanterns punish careless shots',
  },
  {
    index: 6, time: 27, targetScore: 1400, scene: 'river', spawnInterval: 0.8, speedMul: 1.25,
    spawns: [['kite', 4], ['lantern', 3], ['dive', 3], ['ghost', 2], ['moving', 2]], redDucks: 3, newElement: 'flocks of ducks swarm in groups',
  },
  {
    index: 7, time: 27, targetScore: 1700, scene: 'river', spawnInterval: 0.8, speedMul: 1.3,
    spawns: [['kite', 4], ['lantern', 4], ['dive', 3], ['ghost', 3], ['moving', 2]], redDucks: 3, newElement: 'river-lantern night: new cyan palette',
  },
  {
    index: 8, time: 26, targetScore: 2000, scene: 'river', spawnInterval: 0.78, speedMul: 1.35,
    spawns: [['kite', 4], ['lantern', 3], ['dive', 3], ['golden', 2], ['ghost', 2], ['moving', 2]], redDucks: 3, newElement: 'timed golden ducks appear and vanish',
  },
  {
    index: 9, time: 26, targetScore: 2400, scene: 'fireworks', spawnInterval: 0.75, speedMul: 1.4,
    spawns: [['kite', 4], ['lantern', 3], ['dive', 4], ['golden', 2], ['ghost', 3], ['moving', 2]], redDucks: 3, newElement: 'fireworks night: gold-and-purple palette',
  },
  {
    index: 10, time: 25, targetScore: 2800, scene: 'fireworks', spawnInterval: 0.72, speedMul: 1.5,
    spawns: [['kite', 3], ['lantern', 3], ['dive', 4], ['golden', 3], ['ghost', 3], ['moving', 2]], redDucks: 3, newElement: 'accelerated spawn frenzy',
  },
  {
    index: 11, time: 25, targetScore: 3300, scene: 'fireworks', spawnInterval: 0.7, speedMul: 1.6,
    spawns: [['kite', 3], ['lantern', 3], ['dive', 4], ['golden', 3], ['ghost', 4], ['moving', 2]], redDucks: 3, newElement: 'full mixed gauntlet of every target',
  },
  {
    index: 12, time: 24, targetScore: 4000, scene: 'fireworks', spawnInterval: 0.65, speedMul: 1.75,
    spawns: [['kite', 3], ['lantern', 3], ['dive', 4], ['golden', 4], ['ghost', 4], ['moving', 3]], redDucks: 3, newElement: 'grand finale: everything at once',
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index) {
  return LEVELS[Math.min(LEVEL_COUNT - 1, Math.max(0, index - 1))];
}

export function sceneFor(index) {
  return levelAt(index).scene;
}
