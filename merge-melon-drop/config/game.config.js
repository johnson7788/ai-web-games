// MERGE MELON DROP · 全局数值配置（config-first：逻辑层不写死数字）
// 玩法：Suika 式落球合成。把同阶「霓虹水果」落在一起 → 合成为下一阶，直到星爆瓜（NOVA）。
// 新机制：① 岩石（每 8 次落球出现，不合成，可被 ≥2 阶水果压碎）② 连击（1.5s 内连续合成加分）
//         ③ 星级结算（按最高阶与分数给 1–3 星）。

export const STEP = 1 / 60;

// 逻辑世界 16:9（1280×720）。容器在左侧竖条，右侧是 HUD/下一球预览。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  WALL_L: 150,      // 容器左壁
  WALL_R: 620,      // 容器右壁
  FLOOR_Y: 686,     // 容器底部
  CEIL_Y: 74,       // 容器顶部（视觉，避开顶部 HUD 不透明条）
  DASH_Y: 160,      // 游戏结束警示线（水果顶端越过它并停留 → 结束）
  HOLD_Y: 100,      // 持球（待落）的 y（避开 HUD）
  RIGHT_X: 660,     // 右侧 HUD 面板起点
};

export const PHYS = {
  GRAVITY: 1500,        // px/s² 向下
  DROP_VY: 700,         // 松手初始向下速度
  MAX_VY: 1500,
  WALL_REST: 0.22,      // 墙壁反弹系数
  ITER: 5,              // 每帧碰撞求解迭代
  CONTACT_DAMP: 0.86,   // 接触后速度阻尼
  MERGE_COOLDOWN: 0.10, // 新合成球短暂不可再合成（让连锁自然错开）
  SETTLE_VY: 46,        // 触底且 vy 低于此值视为稳定
  OVER_LINE_SEC: 3.0,   // 越过警示线停留多少秒判负
};

export const COMBO = {
  WINDOW: 1.5,     // 连续合成判定窗口（秒）
  MAX: 9,
  BONUS_PER: 1,    // 连击每 +1 额外加的分
};

export const ROCK = {
  RADIUS: 40,
  CRUSH_TIER: 2,   // 水果阶 ≥ 此值可压碎岩石
  SCORE: 5,
  EVERY: 8,        // 每第 N 个新球替换为岩石（含首个落球前的初始球不占位）
};

// 11 阶霓虹水果（0..10）。阶 10 = 星爆瓜（合成大西瓜的最终态，原创换皮）。
export const TIERS = [
  { r: 18,  name: 'EMBER',  zh: '樱桃',   color: '#ff4d6d', rim: '#ffa3b3', dark: '#b3122f' },
  { r: 26,  name: 'CITRUS', zh: '柑橘',   color: '#ff9f43', rim: '#ffd2a1', dark: '#c65f0a' },
  { r: 35,  name: 'LEMON',  zh: '柠檬',   color: '#ffd32a', rim: '#fff3b0', dark: '#c79a00' },
  { r: 45,  name: 'LIME',   zh: '青柠',   color: '#7bed9f', rim: '#d0ffdf', dark: '#1e8a4c' },
  { r: 56,  name: 'KIWI',   zh: '奇异果', color: '#3dcb6d', rim: '#9ff0bb', dark: '#0e7a3b' },
  { r: 68,  name: 'BERRY',  zh: '蓝莓',   color: '#45aaf2', rim: '#a8d8ff', dark: '#0f6cbf' },
  { r: 80,  name: 'PLUM',   zh: '李子',   color: '#5f6cf0', rim: '#b3bbff', dark: '#2632b8' },
  { r: 94,  name: 'GRAPE',  zh: '葡萄',   color: '#a55eea', rim: '#ddbaff', dark: '#6a2bb0' },
  { r: 108, name: 'DRAGON', zh: '火龙果', color: '#ff5cd9', rim: '#ffb3f0', dark: '#c014a8' },
  { r: 124, name: 'COCO',   zh: '椰子',   color: '#ff8fb1', rim: '#ffd0df', dark: '#c23a6b' },
  { r: 142, name: 'NOVA',   zh: '星爆瓜', color: '#ffd54a', rim: '#fff6c8', dark: '#e0a800' },
];

export const MAX_TIER = TIERS.length - 1; // 10

// 落球序列（P0 1:1）：首个持球恒为 0；此后队列 = [0,0,1,2,2,3] 再随机 0..4。
// 岩石按 ROCK.EVERY 注入（-1 表示岩石）。
export const SEQUENCE_FIXED = [0, 0, 1, 2, 2, 3];
export const SEQUENCE_RANDOM_MIN = 0;
export const SEQUENCE_RANDOM_MAX = 4;

// 星级结算阈值（按最高阶 + 分数，取更优者）。
export const STARS = {
  three: { tier: 8, score: 500 },
  two:   { tier: 5, score: 180 },
  one:   { tier: 1, score: 30 },
};

// 里程碑 → levelsReached（fun-report 的推进率口径）。
// 1=开局；2=合成到 3 阶；3=合成到 5 阶（第 3 关）。
export function milestoneForTier(tier) {
  if (tier >= 5) return 3;
  if (tier >= 3) return 2;
  return 1;
}

// 语言配置：默认英文；zh 必做（其余语言整块删掉，不暴露半成品）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'merge-melon-drop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'merge-melon-drop-save',
};
