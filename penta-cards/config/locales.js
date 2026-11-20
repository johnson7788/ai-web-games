// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'PENTA CARDS',
    'title.tagline': 'Build constellations, win on the Five Star.',
    'title.best': 'Best rank {rank}',
    'title.rank': 'Rank {rank}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Back to title',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.next': 'Next round',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',
    'set.loading': 'Dealing stars…',

    // HUD
    'hud.round': 'Round',
    'hud.bet': 'Bet',
    'hud.chips': 'Chips',
    'hud.wall': 'Wall',
    'hud.turn': 'Your turn',
    'hud.wait': 'Opponents thinking…',

    // 行动
    'act.draw': 'Draw',
    'act.discard': 'Discard a tile',
    'act.peng': 'Pong',
    'act.gang': 'Kong',
    'act.hu': 'Hu',
    'act.pass': 'Pass',
    'act.stargaze': 'Stargaze',
    'act.swap': 'Swap',
    'act.claim': 'Claim',

    // 牌面 / 花色
    'suit.star': 'Star',
    'suit.orbit': 'Orbit',
    'suit.honor': 'Honor',
    'honor.sun': 'Sun',
    'honor.moon': 'Moon',
    'honor.pole': 'Polestar',

    // 场景
    'scene.observatory': 'Observatory',
    'scene.teahouse': 'Tea House',
    'scene.aurora': 'Aurora',

    // 番型
    'pat.normal': 'Plain',
    'pat.duidui': 'All Triplets',
    'pat.7pairs': 'Seven Pairs',
    'pat.qingyise': 'Pure Suit',
    'pat.dasanyuan': 'Great Trines',
    'pat.xiaosanyuan': 'Lesser Trines',
    'pat.kawuxing': 'Five Star',
    'pat.mingsigui': 'Open Quad',
    'pat.ansigui': 'Hidden Quad',
    'pat.jingouhu': 'One Tile',
    'pat.zimo': 'Self-draw',
    'pat.dianpao': 'Discard win',
    'pat.gang': 'Kong bonus',

    // 结算
    'result.win': 'Constellation formed!',
    'result.lose': 'Round lost',
    'result.draw': 'Wall empty',
    'result.fan': 'Fan',
    'result.score': 'Score',
    'result.chips': 'Chips',
    'result.round': 'Round',
    'result.newRecord': 'NEW BEST RANK',
    'result.sessionWin': 'You climbed the sky!',
    'result.sessionLose': 'The stars fade…',
    'result.hint': 'Press R for the next hand',
    'result.rank': 'Rank',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 首次交互引导
    'tut.title': 'First hand',
    'tut.1': 'Click a tile to discard it',
    'tut.2': 'Stargaze: peek the top 3 wall tiles',
    'tut.3': 'Swap: exchange one tile for a new one',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'PENTA CARDS',
    'title.tagline': '连成星阵，卡五星定胜负。',
    'title.best': '最佳段位 {rank}',
    'title.rank': '段位 {rank}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '回标题',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.next': '下一局',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',
    'set.loading': '发牌中…',

    // HUD
    'hud.round': '局数',
    'hud.bet': '底注',
    'hud.chips': '筹码',
    'hud.wall': '牌堆',
    'hud.turn': '轮到你',
    'hud.wait': '对手思考中…',

    // 行动
    'act.draw': '摸牌',
    'act.discard': '弃一张牌',
    'act.peng': '碰',
    'act.gang': '杠',
    'act.hu': '胡',
    'act.pass': '过',
    'act.stargaze': '观星',
    'act.swap': '换星',
    'act.claim': '吃碰杠胡',

    // 牌面 / 花色
    'suit.star': '星',
    'suit.orbit': '轨',
    'suit.honor': '三元',
    'honor.sun': '日',
    'honor.moon': '月',
    'honor.pole': '斗',

    // 场景
    'scene.observatory': '观星台',
    'scene.teahouse': '茶室',
    'scene.aurora': '极光',

    // 番型
    'pat.normal': '平胡',
    'pat.duidui': '对对胡',
    'pat.7pairs': '七对',
    'pat.qingyise': '清一色',
    'pat.dasanyuan': '大三元',
    'pat.xiaosanyuan': '小三元',
    'pat.kawuxing': '卡五星',
    'pat.mingsigui': '明四归',
    'pat.ansigui': '暗四归',
    'pat.jingouhu': '手抓一',
    'pat.zimo': '自摸',
    'pat.dianpao': '点炮',
    'pat.gang': '杠上加番',

    // 结算
    'result.win': '星阵连成！',
    'result.lose': '本局告负',
    'result.draw': '牌墙耗尽',
    'result.fan': '番数',
    'result.score': '得分',
    'result.chips': '筹码',
    'result.round': '局数',
    'result.newRecord': '新最佳段位',
    'result.sessionWin': '你登上了星空！',
    'result.sessionLose': '星光黯淡…',
    'result.hint': '按 R 进入下一局',
    'result.rank': '段位',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 首次交互引导
    'tut.title': '第一局',
    'tut.1': '点一张牌弃掉',
    'tut.2': '观星：看牌堆顶 3 张',
    'tut.3': '换星：弃 1 换 1',
    'tut.step': '步骤 {n}/{total}',
  },
};
