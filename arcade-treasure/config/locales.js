// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'ARCADE TREASURE',
    'title.tagline': 'Three neon cabinets. One coin purse. Beat them all to light the GRAND PRIX.',
    'title.best': 'Best rank {rank}',

    // 按钮
    'btn.start': 'Enter Arcade',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Back to title',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Powering the neon…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.tokens': 'Tokens',
    'hud.rank': 'Rank',
    'hud.score': 'Score',
    'hud.target': 'Target',
    'hud.heat': 'Heat',
    'hud.time': 'Time',
    'hud.lives': 'Lives',
    'hud.combo': 'Combo',
    'hud.hallHint': 'Tap a cabinet to play · 1 token',

    // 机台
    'machine.0': 'Server Night Watch',
    'machine.1': 'Rain Scavenger',
    'machine.2': 'Pixel Swarm',
    'machine.0.desc': 'Whack the gremlins, skip the sparks',
    'machine.1.desc': 'Catch coins, dodge lightning',
    'machine.2.desc': 'Shoot the descending bee swarm',

    // 12 段新元素（推进结构）
    'machine.1': 'Meet the three cabinets and the token door',
    'machine.2': 'Gremlin vents split: safe targets vs sparking hazards',
    'machine.3': 'Rain Scavenger lightning bolts fall among the coins',
    'machine.4': 'Pixel Swarm bees fire back at your ship',
    'machine.5': 'Heat unlocks: same-machine streaks pay ×1.2',
    'machine.6': 'Heat cap: 3-streak specialists cash out ×1.5',
    'machine.7': 'Gremlins retreat faster, more spark hazards',
    'machine.8': 'Coins fall faster, combo window tightens',
    'machine.9': 'Bee swarm drops lower and fires more often',
    'machine.10': 'Rank targets spike — the mid-arcade wall',
    'machine.11': 'Rare gold coins worth double appear in the rain',
    'machine.12': 'Final rank: clear all three to arm the GRAND PRIX sign',

    // 结算
    'result.title': 'Machine Result',
    'result.score': 'Score',
    'result.tokens': 'Tokens earned',
    'result.target': 'Target',
    'result.cleared': 'CLEARED',
    'result.missed': 'NOT YET',
    'result.rank': 'Rank',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Pick another cabinet to keep the streak',

    // 打烊 / 币尽
    'over.title': 'Closing Time',
    'over.out': 'Out of Tokens',
    'over.desc': 'The attendant slides you one more coin.',
    'over.hint': 'One token on the house',
    'over.back': 'Back to title',

    // GRAND PRIX
    'grand.title': 'GRAND PRIX',
    'grand.desc': 'All three cabinets mastered. The neon sign is yours.',
    'grand.hint': 'Play again to defend your rank',
    'grand.back': 'Back to title',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 首次交互引导
    'tut.title': 'First visit',
    'tut.1': 'Tap a cabinet to drop in your token',
    'tut.2': 'Hit the targets: gremlins, coins, or bees',
    'tut.3': 'Score to earn back tokens',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'ARCADE TREASURE',
    'title.tagline': '三台霓虹街机，一个代币袋。全通关，点亮 GRAND PRIX。',
    'title.best': '最高段位 {rank}',

    // 按钮
    'btn.start': '进入街机厅',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '回到标题',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '霓虹点亮中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.tokens': '代币',
    'hud.rank': '段位',
    'hud.score': '得分',
    'hud.target': '目标',
    'hud.heat': '热度',
    'hud.time': '时间',
    'hud.lives': '生命',
    'hud.combo': '连击',
    'hud.hallHint': '点一台街机开玩 · 1 代币',

    // 机台
    'machine.0': '机房守夜',
    'machine.1': '雨中拾荒',
    'machine.2': '像素蜂群',
    'machine.0.desc': '敲掉小怪，别碰火花',
    'machine.1.desc': '接住金币，躲开雷击',
    'machine.2.desc': '击落俯冲的蜂群',

    // 12 段新元素（推进结构）
    'machine.1': '认识三台街机与代币门',
    'machine.2': '通风口分家：安全目标 vs 火花危险',
    'machine.3': '雷击混在金币里落下',
    'machine.4': '蜂群开始朝你的飞船开火',
    'machine.5': '热度解锁：同台连玩 ×1.2',
    'machine.6': '热度封顶：3 连专精 ×1.5',
    'machine.7': '小怪缩头更快，火花更多',
    'machine.8': '金币下落更快，连击窗口收紧',
    'machine.9': '蜂群压得更低、开火更频',
    'machine.10': '段位目标陡增——中段墙',
    'machine.11': '雨中罕见双倍金币登场',
    'machine.12': '最终段：三台全通即点亮 GRAND PRIX',

    // 结算
    'result.title': '机台结算',
    'result.score': '得分',
    'result.tokens': '赢得代币',
    'result.target': '目标',
    'result.cleared': '已通关',
    'result.missed': '未达成',
    'result.rank': '段位',
    'result.newRecord': '新纪录',
    'result.hint': '再选一台，保持连机热度',

    // 打烊 / 币尽
    'over.title': '打烊了',
    'over.out': '代币用完了',
    'over.desc': '服务员递给你一枚硬币。',
    'over.hint': '服务员赠 1 币',
    'over.back': '回到标题',

    // GRAND PRIX
    'grand.title': 'GRAND PRIX',
    'grand.desc': '三台街机全部征服。霓虹招牌为你点亮。',
    'grand.hint': '再玩一局，守住段位',
    'grand.back': '回到标题',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 首次交互引导
    'tut.title': '初次到访',
    'tut.1': '点一台街机，投下代币',
    'tut.2': '命中目标：小怪、金币或蜜蜂',
    'tut.3': '得分赚回代币',
    'tut.step': '步骤 {n}/{total}',
  },
};
