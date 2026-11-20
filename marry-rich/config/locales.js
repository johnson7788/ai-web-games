// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// 剧情/结局正文在 config/story.js 与 config/endings.js（同样 en/zh 双语），这里只放 UI chrome。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'MARRY RICH',
    'title.tagline': 'One small-town girl. Twelve decisions. Eight destinies.',
    'title.best': 'Endings found {n}/{total}',

    // 按钮
    'btn.start': 'Begin your rise',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.back': 'Back',
    'btn.close': 'Close',
    'btn.continue': 'Continue',
    'btn.again': 'Play again',
    'btn.memory': 'What if…',
    'btn.memoryClose': 'Back to destiny',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Rising…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // 属性
    'attr.abi': 'Ability',
    'attr.net': 'Network',
    'attr.sav': 'Savings',
    'attr.mentor': 'Mentor',
    'attr.partner': 'Partner',
    'attr.brand': 'Reputation',

    // HUD
    'hud.chapter': 'Chapter {n}/{total}',
    'hud.scene.town': 'Hometown',
    'hud.scene.city': 'Metropolis',
    'hud.scene.peak': 'The Peak',
    'hud.timer': 'Decide now',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结局结算
    'result.title': 'Your Destiny',
    'result.found': 'Endings discovered {n}/{total}',
    'result.memoryHint': 'Memory shard unlocked — replay the road not taken.',

    // 首次交互引导
    'tut.title': 'First steps',
    'tut.step': 'Step {n}/{total}',
    'tut.1': 'Read the story, then choose an option',
    'tut.2': 'Tap Continue to move on',
    'tut.3': 'Make another choice to finish',

    // 分享文案
    'share.text': 'I rose from a small town to {ending} in MARRY RICH!',
  },
  zh: {
    // 标题屏
    'title.logo': 'MARRY RICH',
    'title.tagline': '一个小镇姑娘，十二个人生节点，八种命运。',
    'title.best': '已解锁结局 {n}/{total}',

    // 按钮
    'btn.start': '开始逆袭',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.back': '返回',
    'btn.close': '关闭',
    'btn.continue': '继续',
    'btn.again': '再玩一次',
    'btn.memory': '如果当初…',
    'btn.memoryClose': '回到命运',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '逆袭中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // 属性
    'attr.abi': '能力',
    'attr.net': '人脉',
    'attr.sav': '存款',
    'attr.mentor': '导师',
    'attr.partner': '搭档',
    'attr.brand': '口碑',

    // HUD
    'hud.chapter': '第 {n}/{total} 章',
    'hud.scene.town': '小镇',
    'hud.scene.city': '都市',
    'hud.scene.peak': '巅峰',
    'hud.timer': '现在抉择',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结局结算
    'result.title': '你的命运',
    'result.found': '已解锁结局 {n}/{total}',
    'result.memoryHint': '记忆碎片已解锁——重看另一分支。',

    // 首次交互引导
    'tut.title': '初次上路',
    'tut.step': '步骤 {n}/{total}',
    'tut.1': '读故事，然后选一个选项',
    'tut.2': '点「继续」进入下一章',
    'tut.3': '再做一次选择，完成引导',

    // 分享文案
    'share.text': '在《逆袭之路》里，我从小镇一路走到了「{ending}」！',
  },
};
