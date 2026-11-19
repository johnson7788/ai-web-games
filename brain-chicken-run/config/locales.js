// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'BRAIN CHICKEN RUN',
    'title.tagline': 'Judgment battle royale. Stand on the TRUE lane to survive. Wrong lane gets swept.',
    'title.best': 'Best {score}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.retry': 'Run again',
    'btn.home': 'Menu',
    'btn.skip': 'Skip',
    'btn.next': 'Got it',
    'btn.rotateSkip': 'Play anyway',
    'btn.share': 'Share',

    // 语言
    'set.language': 'Language',

    // HUD
    'hud.stage': 'Stage',
    'hud.score': 'Score',
    'hud.combo': 'Combo',
    'hud.shield': 'Shield',
    'hud.timer': 'Time',

    // 题目面板
    'q.true': 'TRUE',
    'q.false': 'FALSE',
    'q.golden': 'GOLDEN ×2',
    'q.category': 'Brain check',
    'q.tapHint': 'Pick TRUE or FALSE',
    'q.correct': 'Correct!',
    'q.wrong': 'Wrong!',
    'q.shieldSaved': 'Shield saved you!',
    'q.timeout': "Time's up!",
    'q.matching': 'Matching…',
    'q.go': 'GO!',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.titleWin': 'WINNER WINNER!',
    'result.titleLose': 'Eliminated!',
    'result.rank': 'Rank',
    'result.score': 'Score',
    'result.combo': 'Best combo',
    'result.correct': 'Correct',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to run again',

    // 首局引导
    'tut.title': 'First run',
    'tut.1': 'Read the statement, then tap TRUE or FALSE to pick a lane',
    'tut.2': 'Answer correctly to stay alive and score',
    'tut.3': 'Chain 3 correct answers to earn a shield (saves you once)',
    'tut.step': 'Step {n}/{total}',

    // 竖屏提示
    'rotate.text': 'Rotate for the best view',

    // toast
    'toast.stage': 'Stage {n}!',
    'toast.last': 'LAST CHICKEN STANDING!',
  },
  zh: {
    // 标题屏
    'title.logo': 'BRAIN CHICKEN RUN',
    'title.tagline': '判断力大逃杀：站到 TRUE 车道才能活下来，站错车道会被清场。',
    'title.best': '最佳 {score}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.retry': '再跑一局',
    'btn.home': '菜单',
    'btn.skip': '跳过',
    'btn.next': '明白了',
    'btn.rotateSkip': '继续游戏',
    'btn.share': '分享',

    // 语言
    'set.language': '语言',

    // HUD
    'hud.stage': '第几关',
    'hud.score': '得分',
    'hud.combo': '连击',
    'hud.shield': '护盾',
    'hud.timer': '时间',

    // 题目面板
    'q.true': '正确',
    'q.false': '错误',
    'q.golden': '金题 ×2',
    'q.category': '脑力考验',
    'q.tapHint': '选择正确或错误',
    'q.correct': '答对了！',
    'q.wrong': '答错了！',
    'q.shieldSaved': '护盾救了你一命！',
    'q.timeout': '时间到！',
    'q.matching': '匹配中…',
    'q.go': '开始！',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.titleWin': '大吉大利，今晚吃鸡！',
    'result.titleLose': '被淘汰了！',
    'result.rank': '名次',
    'result.score': '得分',
    'result.combo': '最大连击',
    'result.correct': '答对',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再跑一局',

    // 首局引导
    'tut.title': '初次奔跑',
    'tut.1': '读题，然后点「正确」或「错误」选择车道',
    'tut.2': '答对即可存活并得分',
    'tut.3': '连对 3 题获得护盾（可救你一次）',
    'tut.step': '步骤 {n}/{total}',

    // 竖屏提示
    'rotate.text': '旋转设备获得最佳体验',

    // toast
    'toast.stage': '第 {n} 关！',
    'toast.last': '最后一只鸡站到最后！',
  },
};
