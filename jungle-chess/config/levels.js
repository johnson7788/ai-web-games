// 斗兽棋 · 关卡数据（Lead 拥有）
// 1–6 关：一步杀/两步杀谜题（给定局面，N 步内占穴或吃关键子），setup 为稀疏摆放。
// 7–12 关：完整对局（8 对 8），AI 三档：随班(novice,深度1)/学长(senior,深度2)/长老(elder,深度3)，
//          第 12 关「长老的秘密」= 完美难度（深度4）。
// 坐标约定 [r, c]，r=0..8 顶，c=0..6 左；side: 0=蓝(玩家,底) 1=红(对手,顶)。
// goal: { type:'den' } 占穴即胜；{ type:'piece', animal: rank } 吃下该关键子即胜。
// 全部谜题由 tests 用 AI solver 验证存在必胜走法。
import { RAT, CAT, DOG, WOLF, LEOPARD, TIGER, LION, ELEPHANT, BLUE, RED } from '../src/game/rules.js';

const P = (r, c, side, rank) => ({ r, c, side, rank });

export const LEVELS = [
  {
    index: 1, kind: 'puzzle', scene: 'dawn-mist',
    goal: { type: 'den' }, movesToWin: 1, tutorial: true,
    setup: [
      P(1, 3, BLUE, LION),
      P(0, 0, RED, RAT), P(0, 1, RED, CAT),
    ],
    newElement: '基础移动与占穴（一步杀）',
  },
  {
    index: 2, kind: 'puzzle', scene: 'dawn-mist',
    goal: { type: 'piece', animal: ELEPHANT }, movesToWin: 1,
    setup: [
      P(1, 1, BLUE, RAT),
      P(0, 1, RED, ELEPHANT), P(0, 6, RED, DOG),
    ],
    newElement: '鼠克象：一步吃关键子',
  },
  {
    index: 3, kind: 'puzzle', scene: 'dawn-mist',
    goal: { type: 'den' }, movesToWin: 2,
    setup: [
      P(2, 3, BLUE, LION),
      P(1, 3, RED, RAT), P(0, 6, RED, CAT),
    ],
    newElement: '两步杀：算到对手应手',
  },
  {
    index: 4, kind: 'puzzle', scene: 'dawn-mist',
    goal: { type: 'piece', animal: LION }, movesToWin: 1,
    setup: [
      P(6, 3, BLUE, DOG),
      P(7, 3, RED, LION), P(0, 0, RED, RAT),
    ],
    newElement: '陷阱格：敌踩陷阱任意吃',
  },
  {
    index: 5, kind: 'puzzle', scene: 'monsoon',
    goal: { type: 'piece', animal: WOLF }, movesToWin: 1,
    setup: [
      P(3, 0, BLUE, TIGER),
      P(3, 3, RED, WOLF), P(0, 6, RED, RAT),
    ],
    newElement: '虎跳河：横向越水吃关键子',
  },
  {
    index: 6, kind: 'puzzle', scene: 'monsoon',
    goal: { type: 'piece', animal: TIGER }, movesToWin: 1,
    setup: [
      P(2, 1, BLUE, LION), P(4, 4, BLUE, RAT),
      P(6, 1, RED, TIGER), P(0, 6, RED, ELEPHANT),
    ],
    newElement: '狮跳河：纵向越水吃关键子',
  },
  {
    index: 7, kind: 'game', scene: 'monsoon',
    goal: { type: 'den' }, aiTier: 'novice', aiDepth: 1,
    newElement: '完整对局·随班 AI（浅层贪吃）',
  },
  {
    index: 8, kind: 'game', scene: 'monsoon',
    goal: { type: 'den' }, aiTier: 'novice', aiDepth: 1,
    newElement: '完整对局·河域攻防焦点',
  },
  {
    index: 9, kind: 'game', scene: 'night-song',
    goal: { type: 'den' }, aiTier: 'senior', aiDepth: 2,
    newElement: '完整对局·学长 AI（深度 2）',
  },
  {
    index: 10, kind: 'game', scene: 'night-song',
    goal: { type: 'den' }, aiTier: 'senior', aiDepth: 2,
    newElement: '完整对局·陷阱诱敌战术',
  },
  {
    index: 11, kind: 'game', scene: 'night-song',
    goal: { type: 'den' }, aiTier: 'elder', aiDepth: 3,
    newElement: '完整对局·长老 AI（深度 3）',
  },
  {
    index: 12, kind: 'game', scene: 'night-song',
    goal: { type: 'den' }, aiTier: 'perfect', aiDepth: 4,
    newElement: '长老的秘密（完美难度）',
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function aiTierName(tier) {
  switch (tier) {
    case 'senior': return 'tierSenior';
    case 'elder': return 'tierElder';
    case 'perfect': return 'tierPerfect';
    default: return 'tierNovice';
  }
}
