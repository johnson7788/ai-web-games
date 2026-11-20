// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'QUIZ SPRINT',
    'title.tagline': 'Answer right to sprint. Chain 5 for Scholar Sprint. Wager when you dare.',
    'title.best': 'Best {wins} wins',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Race again',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.answer': 'Answer',
    'btn.skipWager': 'Skip (safe)',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Sprinting…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.rank': 'Rank',
    'hud.stamina': 'Stamina',
    'hud.combo': 'Combo',
    'hud.distance': 'Distance',
    'hud.best': 'Best',
    'hud.wins': 'Wins',
    'hud.losses': 'Losses',
    'hud.race': 'Race',
    'hud.timer': 'Time',
    'hud.scholar': 'SCHOLAR SPRINT',

    // 类别
    'cat.general': 'General',
    'cat.science': 'Science',
    'cat.geography': 'Geography',
    'cat.sports': 'Sports',

    // 题目面板
    'q.wager': 'DOUBLE',
    'q.category': 'Category',
    'q.tapAnswer': 'Tap an answer',
    'q.correct': 'Correct!',
    'q.wrong': 'Wrong!',
    'q.timeout': 'Time up!',
    'q.skipped': 'Skipped',

    // AI 名字
    'ai.1': 'Rival A',
    'ai.2': 'Rival B',
    'ai.3': 'Rival C',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Marathon Over',
    'result.wins': 'Races won',
    'result.bestRank': 'Best rank',
    'result.maxCombo': 'Best combo',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best wins',
    'result.hint': 'Press R to race again',

    // 首局引导
    'tut.title': 'First sprint',
    'tut.1': 'Read the question, then tap an answer',
    'tut.2': 'Answer one correctly to surge forward',
    'tut.3': 'Chain 2 correct answers to build a combo',
    'tut.step': 'Step {n}/{total}',

    // 赛段 toast
    'race.win': 'Race {n}: 1st place!',
    'race.lose': 'Race {n}: {rank}th place',
  },
  zh: {
    // 标题屏
    'title.logo': 'QUIZ SPRINT',
    'title.tagline': '答对冲刺、连击加速，五连对触发学霸冲刺；有把握就押注。',
    'title.best': '最佳 {wins} 胜',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '再赛一局',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.answer': '作答',
    'btn.skipWager': '跳过（求稳）',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '冲刺中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.rank': '名次',
    'hud.stamina': '体力',
    'hud.combo': '连击',
    'hud.distance': '距离',
    'hud.best': '最佳',
    'hud.wins': '胜',
    'hud.losses': '负',
    'hud.race': '第几赛',
    'hud.timer': '时间',
    'hud.scholar': '学霸冲刺',

    // 类别
    'cat.general': '常识',
    'cat.science': '科学',
    'cat.geography': '地理',
    'cat.sports': '体育',

    // 题目面板
    'q.wager': '双倍',
    'q.category': '类别',
    'q.tapAnswer': '点击一个选项',
    'q.correct': '答对了！',
    'q.wrong': '答错了！',
    'q.timeout': '时间到！',
    'q.skipped': '已跳过',

    // AI 名字
    'ai.1': '对手 A',
    'ai.2': '对手 B',
    'ai.3': '对手 C',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '马拉松结束',
    'result.wins': '获胜场次',
    'result.bestRank': '最佳名次',
    'result.maxCombo': '最大连击',
    'result.newRecord': '新纪录',
    'result.best': '历史最佳胜场',
    'result.hint': '按 R 键再赛一局',

    // 首局引导
    'tut.title': '初次冲刺',
    'tut.1': '读题，然后点击一个选项作答',
    'tut.2': '答对一题即可冲刺前进',
    'tut.3': '连对 2 题建立连击',
    'tut.step': '步骤 {n}/{total}',

    // 赛段 toast
    'race.win': '第 {n} 赛：第 1 名！',
    'race.lose': '第 {n} 赛：第 {rank} 名',
  },
};
