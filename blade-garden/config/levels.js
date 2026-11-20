// BLADE GARDEN · 12 关推进结构（Lead 拥有，M1 消费）。
// 契约：每关活到 duration 秒 + 击杀 killTarget；HP 归零=slain；时间到未达标=timeOut。
// scene: spring(春圃) | summer(夏泽) | autumn(秋崖)；换章换敌人/配色/装饰。
// spawn: { interval(波间隔秒), perWave(每波数量), cap(同屏上限) }
// elite: 定时刷精英；doubleElite: 双精英；boss: 定时 Boss；hazard: 'poison' 减速带；narrow: 窄道图。
const R = (x, y, w, h) => ({ x, y, w, h });

export const LEVELS = [
  {
    index: 1, scene: 'spring', name: { en: 'First Buds', zh: '初芽' },
    duration: 30, killTarget: 6,
    enemies: ['boar'], spawn: { interval: 2.0, perWave: 2, cap: 8 },
    elite: null, doubleElite: false, boss: null, hazard: null, narrow: false, walls: [],
    newElement: '普通野猪潮（自动挥剑 + 拾取修为）',
  },
  {
    index: 2, scene: 'spring', name: { en: 'Crows Overhead', zh: '鸦群压境' },
    duration: 30, killTarget: 8,
    enemies: ['boar', 'crow'], spawn: { interval: 1.8, perWave: 2, cap: 10 },
    elite: null, doubleElite: false, boss: null, hazard: null, narrow: false, walls: [],
    newElement: '乌鸦加入（高速低血）',
  },
  {
    index: 3, scene: 'spring', name: { en: 'Elite Boar', zh: '精英野猪' },
    duration: 35, killTarget: 10,
    enemies: ['boar', 'crow'], spawn: { interval: 1.6, perWave: 3, cap: 12 },
    elite: { at: 16, type: 'eliteBoar', count: 1 }, doubleElite: false, boss: null, hazard: null, narrow: false, walls: [],
    newElement: '精英怪首发（体型/血量放大）',
  },
  {
    index: 4, scene: 'spring', name: { en: 'Medicine Cauldron', zh: '药王鼎' },
    duration: 40, killTarget: 14,
    enemies: ['boar', 'crow'], spawn: { interval: 1.5, perWave: 3, cap: 14 },
    elite: null, doubleElite: false, boss: 'bossCauldron', hazard: null, narrow: false, walls: [],
    newElement: 'Boss 药王鼎（远程喷吐）',
  },
  {
    index: 5, scene: 'summer', name: { en: 'Marsh Mandrills', zh: '泽中山魈' },
    duration: 40, killTarget: 16,
    enemies: ['mandrill', 'boar'], spawn: { interval: 1.4, perWave: 3, cap: 16 },
    elite: null, doubleElite: false, boss: null, hazard: null, narrow: false, walls: [],
    newElement: '换章夏泽：山魈（中型高攻）',
  },
  {
    index: 6, scene: 'summer', name: { en: 'Twin Elites', zh: '双精英' },
    duration: 40, killTarget: 18,
    enemies: ['mandrill', 'boar'], spawn: { interval: 1.4, perWave: 3, cap: 18 },
    elite: { at: 14, type: 'eliteMandrill', count: 2 }, doubleElite: true, boss: null, hazard: null, narrow: false, walls: [],
    newElement: '双精英同场（被夹击的走位压力）',
  },
  {
    index: 7, scene: 'summer', name: { en: 'Rising Tide', zh: '潮汐加速' },
    duration: 45, killTarget: 20,
    enemies: ['mandrill', 'boar'], spawn: { interval: 1.1, perWave: 4, cap: 20 },
    elite: null, doubleElite: false, boss: null, hazard: null, narrow: false, walls: [],
    newElement: '潮汐加速（刷怪更快更密）',
  },
  {
    index: 8, scene: 'summer', name: { en: 'Cauldron Redux', zh: '药王鼎·贰' },
    duration: 45, killTarget: 22,
    enemies: ['mandrill', 'boar'], spawn: { interval: 1.1, perWave: 4, cap: 22 },
    elite: null, doubleElite: false, boss: 'bossCauldron', hazard: null, narrow: false, walls: [],
    newElement: 'Boss 药王鼎再临（血量更强）',
  },
  {
    index: 9, scene: 'autumn', name: { en: 'Herb Thieves', zh: '药贼夜袭' },
    duration: 45, killTarget: 24,
    enemies: ['thief', 'mandrill', 'crow'], spawn: { interval: 1.0, perWave: 4, cap: 24 },
    elite: null, doubleElite: false, boss: null, hazard: null, narrow: false, walls: [],
    newElement: '换章秋崖：药贼（极速低血）',
  },
  {
    index: 10, scene: 'autumn', name: { en: 'Poison Mire', zh: '毒沼' },
    duration: 50, killTarget: 26,
    enemies: ['thief', 'mandrill'], spawn: { interval: 1.0, perWave: 4, cap: 26 },
    elite: null, doubleElite: false, boss: null, hazard: 'poison', narrow: false,
    walls: [],
    hazards: [R(120, 190, 430, 150), R(760, 430, 400, 150)],
    newElement: '毒沼地形（减速带，绕行代价）',
  },
  {
    index: 11, scene: 'autumn', name: { en: 'Narrow Pass', zh: '窄道' },
    duration: 50, killTarget: 28,
    enemies: ['thief', 'mandrill', 'crow'], spawn: { interval: 0.9, perWave: 4, cap: 28 },
    elite: null, doubleElite: false, boss: null, hazard: null, narrow: true,
    walls: [R(0, 300, 500, 96), R(780, 300, 500, 96)],
    hazards: [],
    newElement: '窄道图（中央走廊，走位受限）',
  },
  {
    index: 12, scene: 'autumn', name: { en: 'Mandrill King', zh: '山魈王' },
    duration: 55, killTarget: 30,
    enemies: ['thief', 'mandrill'], spawn: { interval: 0.9, perWave: 4, cap: 30 },
    elite: null, doubleElite: false, boss: 'bossMandrillKing', hazard: null, narrow: false, walls: [], hazards: [],
    newElement: '终局 Boss 山魈王',
  },
];

export const LEVEL_COUNT = LEVELS.length;
