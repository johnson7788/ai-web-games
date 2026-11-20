// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'GOOSE LANE',
    'title.tagline': 'A commuter goose on the morning metro. Dodge, grab gems, ride the smooth transfer.',
    'title.best': 'Best {distance}m',

    // 按钮
    'btn.start': 'Commute',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Commute again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.revive': 'Revive once',
    'btn.giveup': 'Give up',
    'btn.stop': 'STOP',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Boarding…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.distance': 'M',
    'hud.gems': 'Gems',
    'hud.station': 'Station',
    'hud.best': 'Best',
    'hud.balloons': 'Balloons',
    'hud.stop': 'STOP',

    // 场景
    'scene.morning': 'Morning Rush',
    'scene.afternoon': 'Afternoon Shift',
    'scene.night': 'Night Line',

    // 站名
    'station.depot': 'Depot',
    'station.pit-stop': 'Pit Stop',
    'station.narrow-alley': 'Narrow Alley',
    'station.turnstile': 'Turnstile',
    'station.noon-rush': 'Noon Rush',
    'station.food-run': 'Food Run',
    'station.balloon-sky': 'Balloon Sky',
    'station.night-narrow': 'Night Narrow',
    'station.neon-chase': 'Neon Chase',
    'station.gate-maze': 'Gate Maze',
    'station.parked-maze': 'Parked Maze',
    'station.final-sprint': 'Final Sprint',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 死亡结算
    'result.title': 'Trip Over',
    'result.distance': 'Distance',
    'result.gems': 'Gems',
    'result.station': 'Station',
    'result.best': 'Best',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to commute again',

    // 复活
    'revive.title': 'Caught at the gate?',
    'revive.hint': 'One free revive per trip.',

    // 首次交互引导
    'tut.title': 'First commute',
    'tut.1': 'Swipe or press ← → to change lanes',
    'tut.2': 'Collect a gem',
    'tut.3': 'Grab a balloon (it absorbs one hit)',
    'tut.4': 'Hold SPACE to stop at a red gate',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'GOOSE LANE',
    'title.tagline': '早高峰挤地铁的社畜大鹅：换道躲车、贪宝石、丝滑换乘。',
    'title.best': '最佳 {distance}m',

    // 按钮
    'btn.start': '通勤',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再通勤一次',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.revive': '复活一次',
    'btn.giveup': '放弃',
    'btn.stop': '停步',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '上车中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.distance': '米',
    'hud.gems': '宝石',
    'hud.station': '站',
    'hud.best': '最佳',
    'hud.balloons': '气球',
    'hud.stop': '停步',

    // 场景
    'scene.morning': '早高峰',
    'scene.afternoon': '午后换班',
    'scene.night': '夜班线',

    // 站名
    'station.depot': '车场',
    'station.pit-stop': '坑洼站',
    'station.narrow-alley': '窄缝巷',
    'station.turnstile': '闸机口',
    'station.noon-rush': '午间高峰',
    'station.food-run': '外卖飞奔',
    'station.balloon-sky': '气球天',
    'station.night-narrow': '夜窄缝',
    'station.neon-chase': '霓虹追逐',
    'station.gate-maze': '闸机迷宫',
    'station.parked-maze': '静车迷宫',
    'station.final-sprint': '终点冲刺',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 死亡结算
    'result.title': '旅程结束',
    'result.distance': '里程',
    'result.gems': '宝石',
    'result.station': '到达站',
    'result.best': '历史最佳',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再通勤一次',

    // 复活
    'revive.title': '在闸机口被卡住了？',
    'revive.hint': '每次旅程可免费复活一次。',

    // 首次交互引导
    'tut.title': '初次通勤',
    'tut.1': '左右滑动或按 ← → 换道',
    'tut.2': '收集一颗宝石',
    'tut.3': '捡一个气球（可抵一次碰撞）',
    'tut.4': '按住空格在红灯闸机前停步',
    'tut.step': '步骤 {n}/{total}',
  },
};
