// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（其他语言整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值、全平铺。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'KISS COLLECTOR',
    'title.tagline': 'Collect kisses by cracking 24 sweet little puzzles. Cupid is watching.',
    'title.best': 'Best run {time}',
    'title.cleared': 'Cleared {n}/{total}',
    'title.kisses': 'Kisses collected {n}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.next': 'Next level',
    'btn.retry': 'Retry',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.hint': 'Hint',
    'btn.help': 'Cupid helps',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Warming up the kiss jar…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.level': 'Level',
    'hud.chapter': 'Chapter',
    'hud.time': 'Time',
    'hud.stars': 'Stars',
    'hud.mistakes': 'Mistakes',
    'hud.goal': 'Goal',
    'hud.kisses': 'Kisses',
    'hud.streak': 'Streak',
    'hud.helpUnlocked': 'Cupid is ready to help!',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算（过关）
    'result.title': 'Kissed!',
    'result.stars': 'Stars',
    'result.time': 'Time',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best',
    'result.hint': 'Press Enter for the next level',
    'result.roastLabel': 'Cupid says',
    'result.kisses': 'Kisses earned',

    // 通关
    'complete.title': 'You collected every kiss!',
    'complete.sub': 'All 24 sweet puzzles cleared',
    'complete.hint': 'Replay for a faster time',

    // 首次交互引导
    'tut.title': 'First kiss',
    'tut.1': 'Tap an object to try it',
    'tut.2': 'Drag the chocolate into the gift box',
    'tut.3': 'Crack the level and watch Cupid cheer',
    'tut.step': 'Step {n}/{total}',

    // 章节名
    'chapter.1': 'Sweet Street',
    'chapter.2': 'Heart Garden',
    'chapter.3': "Cupid's Studio",
    'chapter.4': 'Moonlight Ball',
  },
  zh: {
    // 标题屏
    'title.logo': '亲亲收集家',
    'title.tagline': '破解 24 个甜甜小谜题，收集满满一罐亲亲。丘比特在看着你。',
    'title.best': '最佳 {time}',
    'title.cleared': '已通 {n}/{total}',
    'title.kisses': '已收集亲亲 {n}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.next': '下一关',
    'btn.retry': '重试',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.hint': '提示',
    'btn.help': '丘比特帮你',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在暖热亲亲罐…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.level': '关卡',
    'hud.chapter': '章节',
    'hud.time': '时间',
    'hud.stars': '星级',
    'hud.mistakes': '失误',
    'hud.goal': '目标',
    'hud.kisses': '亲亲',
    'hud.streak': '连击',
    'hud.helpUnlocked': '丘比特准备好帮你了！',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算（过关）
    'result.title': '亲到啦！',
    'result.stars': '星级',
    'result.time': '用时',
    'result.newRecord': '新纪录',
    'result.best': '最佳',
    'result.hint': '按回车进入下一关',
    'result.roastLabel': '丘比特说',
    'result.kisses': '获得亲亲',

    // 通关
    'complete.title': '你集齐了所有亲亲！',
    'complete.sub': '24 个甜甜谜题全部破解',
    'complete.hint': '再玩一次，冲击更快纪录',

    // 首次交互引导
    'tut.title': '初次亲亲',
    'tut.1': '点一下物体试试',
    'tut.2': '把巧克力拖进礼物盒',
    'tut.3': '破解关卡，看丘比特欢呼',
    'tut.step': '步骤 {n}/{total}',

    // 章节名
    'chapter.1': '甜品街',
    'chapter.2': '心形花园',
    'chapter.3': '丘比特工作室',
    'chapter.4': '月光舞会',
  },
};
