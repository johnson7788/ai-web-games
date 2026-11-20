// INK FINCH · 关卡数据（12 关 3 场景包逐字落实）
// 场景包：mist 晨雾竹海（L1-4）/ rain 雨夜竹径（L5-8）/ snow 雪竹山道（L9-12）
// feature：normal | narrow | moving | updraft | wind | doubleGap | wheel 及其组合。
// 每关 target = 通关所需分数；穿单缝 +1，双缝远缝 +3 / 近缝 +1。

function L(index, scene, name, target, feature, opts = {}) {
  return {
    index,
    scene,           // 'mist' | 'rain' | 'snow'
    name: { en: name.en, zh: name.zh },
    target,
    feature,
    difficulty: opts.difficulty ?? index,
    // 竹节几何（默认；feature 覆盖）
    gapH: opts.gapH ?? 180,
    gapYMin: opts.gapYMin ?? 150,
    gapYMax: opts.gapYMax ?? 500,
    scroll: opts.scroll ?? 160,
    spacing: opts.spacing ?? 288,
    stalkW: opts.stalkW ?? 84,
    // 移动缝
    moveAmp: opts.moveAmp ?? 0,
    movePeriod: opts.movePeriod ?? 2.4,
    // 上升气流（长按滑翔；0 = 关）
    glideGravity: opts.glideGravity ?? 0,
    // 逆风（水平漂移；0 = 关）
    windVx: opts.windVx ?? 0,
    flapVx: opts.flapVx ?? 0,
    // 双缝（近+1 远+3）
    doubleGap: opts.doubleGap ?? false,
    doubleGapY: opts.doubleGapY ?? 360,
    gapSep: opts.gapSep ?? 220,
    doubleGapH: opts.doubleGapH ?? 150,
    nearPoints: opts.nearPoints ?? 1,
    farPoints: opts.farPoints ?? 3,
    // 竹刺转轮
    wheel: opts.wheel ?? false,
    wheelR: opts.wheelR ?? 50,
    wheelSpeed: opts.wheelSpeed ?? 2.2,
  };
}

export const LEVELS = [
  L(1, 'mist', { en: 'Mist Sea', zh: '晨雾竹海' }, 5, 'normal', { difficulty: 1 }),
  L(2, 'mist', { en: 'Narrow Gate', zh: '窄缝初现' }, 6, 'narrow', { gapH: 118, difficulty: 1.6 }),
  L(3, 'mist', { en: 'Swaying Bamboo', zh: '摆动竹节' }, 6, 'moving', { moveAmp: 62, movePeriod: 2.4, difficulty: 2.2 }),
  L(4, 'mist', { en: 'Updraft', zh: '上升气流' }, 7, 'updraft', { glideGravity: 320, difficulty: 2.8 }),
  L(5, 'rain', { en: 'Headwind', zh: '逆风竹径' }, 7, 'wind', { windVx: 78, flapVx: 150, difficulty: 3.3 }),
  L(6, 'rain', { en: 'Twin Gaps', zh: '双缝抉择' }, 8, 'doubleGap', { doubleGap: true, doubleGapY: 360, gapSep: 220, doubleGapH: 150, difficulty: 3.8 }),
  L(7, 'rain', { en: 'Spike Wheel', zh: '竹刺转轮' }, 8, 'wheel', { gapH: 300, gapYMin: 240, gapYMax: 460, wheel: true, wheelR: 48, wheelSpeed: 2.2, difficulty: 4.4 }),
  L(8, 'rain', { en: 'Storm Gate', zh: '风雨窄缝' }, 9, 'narrow+wheel', { gapH: 280, gapYMin: 240, gapYMax: 460, moveAmp: 40, movePeriod: 2.0, wheel: true, wheelR: 44, wheelSpeed: 2.6, difficulty: 5.0 }),
  L(9, 'snow', { en: 'Snow Drift', zh: '雪竹逆风' }, 9, 'wind+updraft', { glideGravity: 360, windVx: 66, flapVx: 140, difficulty: 5.5 }),
  L(10, 'snow', { en: 'Frost Wheel', zh: '霜竹双缝' }, 10, 'doubleGap+wheel', { doubleGap: true, doubleGapY: 360, gapSep: 280, doubleGapH: 140, wheel: true, wheelR: 52, wheelSpeed: 2.0, difficulty: 6.0 }),
  L(11, 'snow', { en: 'Gale Run', zh: '疾风窄缝' }, 10, 'narrow+wind', { gapH: 130, moveAmp: 50, movePeriod: 2.2, windVx: 70, flapVx: 140, scroll: 186, difficulty: 6.5 }),
  L(12, 'snow', { en: 'Master Ink', zh: '终章·墨雪' }, 12, 'master', { gapH: 150, moveAmp: 56, movePeriod: 2.3, glideGravity: 340, windVx: 70, flapVx: 140, doubleGap: true, doubleGapY: 360, gapSep: 240, doubleGapH: 140, wheel: true, wheelR: 40, wheelSpeed: 2.4, scroll: 180, difficulty: 7.5 }),
];

export const LEVEL_COUNT = LEVELS.length;
