// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'PLUMBER RUN',
    'title.tagline': 'Run, jump, wrench-boomerang. Fix the Steam City.',
    'title.best': 'Best level {level}',
    'title.how': 'How to play',

    // 按钮
    'btn.start': 'Play',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.again': 'Play again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Fixing pipes…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.level': 'Level',
    'hud.coins': 'Coins',
    'hud.lives': 'Lives',
    'hud.time': 'Time',
    'hud.score': 'Score',
    'hud.steam': 'Steam',
    'hud.best': 'Best',
    'hud.form.small': 'Small',
    'hud.form.big': 'Big',
    'hud.form.fire': 'Steam Jet',

    // 关卡名（场景）
    'level.1': 'Rooftop Dawn',
    'level.2': 'Copper Pipes',
    'level.3': 'Gutter Gap',
    'level.4': 'Iron Skyline',
    'level.5': 'Sewer Inlet',
    'level.6': 'Green Flow',
    'level.7': 'Black Tunnel',
    'level.8': 'Valve Gauntlet',
    'level.9': 'Factory Gate',
    'level.10': 'Bolt Line',
    'level.11': 'Pressure Lock',
    'level.12': 'Boiler Finale',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Run Over',
    'result.level': 'Level reached',
    'result.coins': 'Coins',
    'result.score': 'Score',
    'result.best': 'Best level',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to run again',
    'result.winTitle': 'CITY FIXED!',
    'result.winHint': 'All 12 pipes fixed. You are the wrench master.',
    'result.stars': 'Stars',

    // 首次交互引导
    'tut.title': 'First shift',
    'tut.1': 'Hold → or D to run right',
    'tut.2': 'Press Space / ↑ to jump',
    'tut.3': 'Stomp a pipe monster (land on its head)',
    'tut.4': 'Press J to throw the boomerang wrench',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '扳手师傅快跑',
    'title.tagline': '跑跳、回旋扳手，修好蒸汽都市。',
    'title.best': '最佳关卡 {level}',
    'title.how': '怎么玩',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.again': '再来一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在修管道…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.level': '关卡',
    'hud.coins': '金币',
    'hud.lives': '生命',
    'hud.time': '时间',
    'hud.score': '得分',
    'hud.steam': '蒸汽',
    'hud.best': '最佳',
    'hud.form.small': '小形态',
    'hud.form.big': '大形态',
    'hud.form.fire': '蒸汽喷射',

    // 关卡名（场景）
    'level.1': '屋顶晨光',
    'level.2': '铜管之间',
    'level.3': '排水沟豁口',
    'level.4': '钢铁天际线',
    'level.5': '下水道入口',
    'level.6': '绿色水流',
    'level.7': '黑隧道',
    'level.8': '阀门试炼',
    'level.9': '工厂大门',
    'level.10': '螺栓流水线',
    'level.11': '压力锁',
    'level.12': '锅炉终章',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '本局结束',
    'result.level': '到达关卡',
    'result.coins': '金币',
    'result.score': '得分',
    'result.best': '最佳关卡',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再来一局',
    'result.winTitle': '城市修好了！',
    'result.winHint': '12 根管道全部修好，你是扳手大师。',
    'result.stars': '星级',

    // 首次交互引导
    'tut.title': '第一次上班',
    'tut.1': '按住 → 或 D 向右跑',
    'tut.2': '按空格 / ↑ 跳跃',
    'tut.3': '踩扁一只管道怪兽（落在它头上）',
    'tut.4': '按 J 扔出回旋扳手',
    'tut.step': '步骤 {n}/{total}',
  },
};
