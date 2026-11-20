// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（其他语言整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'Q ADVENTURE',
    'title.tagline': 'Bounce, wall-jump and ride the beat to save the princess.',
    'title.best': 'Best stars {stars}',
    'title.level': 'Level {n}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.next': 'Next',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Bouncing…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.level': 'Level',
    'hud.stars': 'Stars',
    'hud.coins': 'Coins',
    'hud.hp': 'HP',
    'hud.goal': 'GOAL',
    'hud.best': 'Best',
    'hud.beat': 'BEAT JUMP!',

    // 关卡名
    'level.1': 'Candy Hills',
    'level.2': 'Candy Ridge',
    'level.3': 'Candy Canyon',
    'level.4': 'Gumdrop Crossing',
    'level.5': 'Cloud Walk',
    'level.6': 'Sky Springs',
    'level.7': 'Windy Peaks',
    'level.8': 'Cloud Castle',
    'level.9': 'Night Thorns',
    'level.10': 'Dusk Hollow',
    'level.11': 'Stormwood',
    'level.12': 'Moonlit Keep',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Adventure Over',
    'result.win': 'Princess saved!',
    'result.lose': 'Jelly down…',
    'result.level': 'Reached',
    'result.stars': 'Stars',
    'result.coins': 'Coins',
    'result.best': 'Best stars',
    'result.hint': 'Press R to try again',
    'result.newRecord': 'NEW RECORD',

    // 关卡过渡横幅
    'banner.clear': 'Level clear!',
    'banner.complete': 'You saved the princess!',

    // 首次交互引导
    'tut.title': 'First bounce',
    'tut.1': 'Hold ←/→ or A/D to run',
    'tut.2': 'Press Space to jump (again for double jump)',
    'tut.3': 'Grab a star',
    'tut.4': 'Reach the flag to clear the level',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'Q ADVENTURE',
    'title.tagline': '弹跳、蹬墙、踩着鼓点，救出公主。',
    'title.best': '最佳星星 {stars}',
    'title.level': '第 {n} 关',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重开',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.next': '下一关',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '弹跳中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.level': '关卡',
    'hud.stars': '星星',
    'hud.coins': '金币',
    'hud.hp': '血量',
    'hud.goal': '目标',
    'hud.best': '最佳',
    'hud.beat': '鼓点跳！',

    // 关卡名
    'level.1': '糖果丘',
    'level.2': '糖果岭',
    'level.3': '糖果峡谷',
    'level.4': '橡皮糖路口',
    'level.5': '云端漫步',
    'level.6': '天空弹簧',
    'level.7': '风之峰',
    'level.8': '云之城堡',
    'level.9': '夜之荆棘',
    'level.10': '黄昏洞窟',
    'level.11': '暴风木',
    'level.12': '月照要塞',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '冒险结束',
    'result.win': '公主得救了！',
    'result.lose': '果冻倒下了…',
    'result.level': '到达',
    'result.stars': '星星',
    'result.coins': '金币',
    'result.best': '最佳星星',
    'result.hint': '按 R 键再试一次',
    'result.newRecord': '新纪录',

    // 关卡过渡横幅
    'banner.clear': '过关！',
    'banner.complete': '你救出了公主！',

    // 首次交互引导
    'tut.title': '初次弹跳',
    'tut.1': '按住 ←/→ 或 A/D 奔跑',
    'tut.2': '按空格跳跃（再按一次二段跳）',
    'tut.3': '捡起一颗星星',
    'tut.4': '到达旗帜过关',
    'tut.step': '步骤 {n}/{total}',
  },
};
