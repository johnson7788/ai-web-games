// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（其他语言整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'ABC POP',
    'title.tagline': 'Pop the letter bubbles in a candy sky!',
    'title.best': 'Best score {score}',
    'btn.play': 'Play',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Menu',
    'btn.share': 'Share',
    'btn.again': 'Play again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.back': 'Back',
    'set.loading': 'Popping…',
    'set.rotate': 'Rotate for the best view',

    // HUD
    'hud.letter': 'Letter',
    'hud.score': 'Score',
    'hud.streak': 'Streak',
    'hud.best': 'Best',
    'hud.round': 'Round',

    // 轮次名 / 提示
    'round.0': 'Find the letter',
    'round.1': 'Both forms',
    'round.2': 'First letter',
    'prompt.0': 'Tap the letter {letter}',
    'prompt.1': 'Tap both {upper} and {lower}',
    'prompt.2': 'Tap the first letter of {word}',

    // 场景包名
    'scene.morning': 'Morning Clouds',
    'scene.rain': 'After the Rain',
    'scene.night': 'Night Sky',

    // 过关 / 结算
    'win.letter': 'Letter {letter} done!',
    'win.game': 'You popped the whole alphabet!',
    'win.streak': 'Best streak {streak}',
    'result.title': 'Great job!',
    'result.score': 'Score',
    'result.streak': 'Best streak',
    'result.hint': 'Tap anywhere to continue',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 首次交互引导
    'tut.title': 'First pop',
    'tut.1': 'Tap any bubble to pop it',
    'tut.2': 'Tap the letter shown up top',
    'tut.3': 'Keep popping to clear the round',
    'tut.step': 'Step {n}/{total}',

    // 分享
    'share.text': 'I popped {score} letter bubbles in ABC POP!',
  },
  zh: {
    // 标题屏
    'title.logo': 'ABC POP',
    'title.tagline': '在糖果天空里，点破字母泡泡！',
    'title.best': '最佳得分 {score}',
    'btn.play': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '菜单',
    'btn.share': '分享',
    'btn.again': '再玩一次',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.back': '返回',
    'set.loading': '吹泡泡中…',
    'set.rotate': '旋转设备获得最佳体验',

    // HUD
    'hud.letter': '字母',
    'hud.score': '得分',
    'hud.streak': '连击',
    'hud.best': '最佳',
    'hud.round': '轮次',

    // 轮次名 / 提示
    'round.0': '找字母',
    'round.1': '大小写',
    'round.2': '首字母',
    'prompt.0': '点一点字母 {letter}',
    'prompt.1': '点 {upper} 和 {lower} 各一次',
    'prompt.2': '点 {word} 的首字母',

    // 场景包名
    'scene.morning': '晨云',
    'scene.rain': '雨后',
    'scene.night': '夜空',

    // 过关 / 结算
    'win.letter': '字母 {letter} 完成啦！',
    'win.game': '你点完了整个字母表！',
    'win.streak': '最佳连击 {streak}',
    'result.title': '太棒了！',
    'result.score': '得分',
    'result.streak': '最佳连击',
    'result.hint': '点任意处继续',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 首次交互引导
    'tut.title': '第一次点泡泡',
    'tut.1': '点任意泡泡，把它点破',
    'tut.2': '点上方显示的字母',
    'tut.3': '继续点对，完成这一轮',
    'tut.step': '步骤 {n}/{total}',

    // 分享
    'share.text': '我在 ABC POP 点破了 {score} 个字母泡泡！',
  },
};
