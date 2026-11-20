// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'HOLE MUNCH',
    'title.tagline': 'Swallow the midnight city. Grow. Beat 5 rival holes in 2 minutes.',
    'title.best': 'Best rank #{rank}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Play again',
    'btn.next': 'Next match',
    'btn.retry': 'Retry',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Sinking in…',
    'set.rotate': 'Rotate for the best view',
    'set.mute': 'Sound',
    'set.volume': 'Volume',
    'set.back': 'Back',

    // HUD
    'hud.time': 'Time',
    'hud.score': 'Size',
    'hud.rank': 'Rank',
    'hud.chain': 'Chain',
    'hud.scene': 'District',
    'hud.meteor': 'Meteor rain!',
    'hud.goal': 'Goal: Top 3',

    // 场景包
    'scene.old-town': 'Old Town',
    'scene.harbor': 'Harbor',
    'scene.future-city': 'Future City',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Match Over',
    'result.won': 'Match Won',
    'result.lost': 'Eliminated',
    'result.campaign': 'Night Conquered',
    'result.rank': 'Final rank',
    'result.score': 'Final size',
    'result.best': 'Best rank',
    'result.newRecord': 'NEW BEST RANK',
    'result.qualified': 'Top 3 — advance!',
    'result.hint': 'Pick an upgrade to continue',
    'result.retryHint': 'Rank 4–6 — try this match again',

    // 升级
    'up.title': 'Choose a growth',
    'up.gravityRadius': 'Gravity radius +25%',
    'up.devourSpeed': 'Devour speed +30%',
    'up.chainLower': 'Chain needs 7 objects',
    'up.chainBonus': 'Chain bonus +20%',
    'up.meteorBoost': 'Meteor growth 5×',
    'up.chainDuration': 'Gravity well lasts 7s',
    'up.moveSpeed': 'Move speed +12%',
    'up.startMass': 'Start +30 mass',
    'up.maxRadius': 'Max radius +25',
    'up.huntDouble': 'Swallowed holes give 2× mass',

    // 首次交互引导
    'tut.title': 'First night',
    'tut.1': 'Move your hole — drag, WASD or arrows',
    'tut.2': 'Swallow 3 street lamps',
    'tut.3': 'Swallow 10 things fast to trigger the gravity well',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'HOLE MUNCH',
    'title.tagline': '吞掉午夜城市，变大，在 2 分钟内击败 5 个对手黑洞。',
    'title.best': '最佳名次 #{rank}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再来一局',
    'btn.next': '下一场',
    'btn.retry': '重试',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在下沉…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.mute': '声音',
    'set.volume': '音量',
    'set.back': '返回',

    // HUD
    'hud.time': '时间',
    'hud.score': '体型',
    'hud.rank': '名次',
    'hud.chain': '连锁',
    'hud.scene': '街区',
    'hud.meteor': '陨石雨！',
    'hud.goal': '目标：前 3 名',

    // 场景包
    'scene.old-town': '老城街区',
    'scene.harbor': '港口',
    'scene.future-city': '未来城',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '本场结束',
    'result.won': '本场获胜',
    'result.lost': '被吞并',
    'result.campaign': '征服整座夜城',
    'result.rank': '最终名次',
    'result.score': '最终体型',
    'result.best': '最佳名次',
    'result.newRecord': '新最佳名次',
    'result.qualified': '前 3 名 — 晋级！',
    'result.hint': '选一个成长继续',
    'result.retryHint': '第 4–6 名 — 再来一次',

    // 升级
    'up.title': '选择成长',
    'up.gravityRadius': '引力半径 +25%',
    'up.devourSpeed': '吞噬速度 +30%',
    'up.chainLower': '连锁只需 7 个物体',
    'up.chainBonus': '连锁加成 +20%',
    'up.meteorBoost': '陨石成长 5 倍',
    'up.chainDuration': '引力井持续 7 秒',
    'up.moveSpeed': '移动速度 +12%',
    'up.startMass': '开局质量 +30',
    'up.maxRadius': '最大半径 +25',
    'up.huntDouble': '吞洞获得双倍质量',

    // 首次交互引导
    'tut.title': '第一个夜晚',
    'tut.1': '移动你的黑洞 — 拖动 / WASD / 方向键',
    'tut.2': '吞掉 3 盏路灯',
    'tut.3': '快速吞 10 个物体触发引力井',
    'tut.step': '步骤 {n}/{total}',
  },
};
