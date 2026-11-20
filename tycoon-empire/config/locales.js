// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'TYCOON EMPIRE',
    'title.tagline': 'Tap to earn. Buy 12 industries. Ride the stock market.',
    'title.best': 'Best net worth {worth}',

    // 按钮
    'btn.start': 'Build',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.collect': 'Collect',
    'btn.allin': 'All In',
    'btn.loan': 'Loan',
    'btn.repay': 'Repay',
    'btn.buy': 'Buy',
    'btn.upgrade': 'Up',
    'btn.hire': 'Mgr',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Building your empire…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.cash': 'Cash',
    'hud.networth': 'Net Worth',
    'hud.income': 'Income',
    'hud.industries': 'Businesses',
    'hud.debt': 'Debt',
    'hud.best': 'Best',

    // 场景
    'scene.0': 'Street Corner',
    'scene.1': 'Downtown',
    'scene.2': 'Finance Tower',

    // 产业
    'ind.newsstand': 'Newsstand',
    'ind.laundry': 'Laundry',
    'ind.diner': 'Diner',
    'ind.radio': 'Radio Studio',
    'ind.theater': 'Theater',
    'ind.newspaper': 'Newspaper',
    'ind.deptstore': 'Dept. Store',
    'ind.autoworks': 'Auto Works',
    'ind.shipping': 'Shipping Line',
    'ind.railway': 'Railway',
    'ind.oil': 'Oil Trust',
    'ind.bank': 'Intl. Bank',

    // 动作提示
    'act.tap': 'Tap the tower to earn cash',
    'act.collect': 'Collect income from your businesses',
    'act.buy': 'Buy a new business',
    'act.upgrade': 'Upgrade efficiency',
    'act.hire': 'Hire a manager to auto-collect',

    // 股市日
    'stock.title': 'Market Day',
    'stock.day': 'Market Day: {name}',
    'stock.up': 'Rumor: boom ×2',
    'stock.down': 'Rumor: crash ×0.5',
    'stock.win': 'All-in hit! Cash ×2',
    'stock.lose': 'All-in missed. Cash ×0.5',
    'stock.allinHint': 'Bet all cash on boom or crash',

    // 贷款
    'loan.title': 'Loan',
    'loan.take': 'Borrow 10× cash',
    'loan.repay': 'Repay loan',
    'loan.interest': 'Interest 5%/min',
    'loan.hint': 'Borrow to expand fast — interest can bankrupt you',

    // 破产
    'bankrupt.title': 'Bankrupt!',
    'bankrupt.hint': 'Interest broke you. Industries reset — rebuild from the street.',

    // 离线收益
    'offline.title': 'Welcome back',
    'offline.hint': 'Your empire earned {amount} while you were away',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 首次交互引导
    'tut.title': 'First deal',
    'tut.1': 'Tap the tower 3 times to earn cash',
    'tut.2': 'Buy the Laundry business',
    'tut.3': 'Collect your income',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'TYCOON EMPIRE',
    'title.tagline': '点击赚钱，买下 12 个产业，押注股市行情。',
    'title.best': '最高身家 {worth}',

    // 按钮
    'btn.start': '开建',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重开',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.collect': '收取',
    'btn.allin': '全押',
    'btn.loan': '贷款',
    'btn.repay': '还贷',
    'btn.buy': '买',
    'btn.upgrade': '升级',
    'btn.hire': '经理',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '正在建造你的帝国…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.cash': '现金',
    'hud.networth': '身家',
    'hud.income': '收益',
    'hud.industries': '产业',
    'hud.debt': '债务',
    'hud.best': '最佳',

    // 场景
    'scene.0': '街角',
    'scene.1': '市中心',
    'scene.2': '金融塔顶',

    // 产业
    'ind.newsstand': '报刊亭',
    'ind.laundry': '洗衣店',
    'ind.diner': '餐馆',
    'ind.radio': '电台',
    'ind.theater': '剧院',
    'ind.newspaper': '报社',
    'ind.deptstore': '百货公司',
    'ind.autoworks': '汽车厂',
    'ind.shipping': '航运公司',
    'ind.railway': '铁路',
    'ind.oil': '石油公司',
    'ind.bank': '国际银行',

    // 动作提示
    'act.tap': '点击大楼赚钱',
    'act.collect': '收取产业收益',
    'act.buy': '购买新产业',
    'act.upgrade': '升级效率',
    'act.hire': '雇佣经理自动收钱',

    // 股市日
    'stock.title': '行情日',
    'stock.day': '行情日：{name}',
    'stock.up': '传闻：暴涨 ×2',
    'stock.down': '传闻：崩盘 ×0.5',
    'stock.win': '押中！现金 ×2',
    'stock.lose': '押错。现金 ×0.5',
    'stock.allinHint': '把全部现金押在涨或跌上',

    // 贷款
    'loan.title': '贷款',
    'loan.take': '借 10 倍现金',
    'loan.repay': '偿还贷款',
    'loan.interest': '利息 5%/分钟',
    'loan.hint': '借贷可快速扩张——但利息会让你破产',

    // 破产
    'bankrupt.title': '破产！',
    'bankrupt.hint': '利息压垮了你。产业已清零——从街角重新开始。',

    // 离线收益
    'offline.title': '欢迎回来',
    'offline.hint': '你离开期间，帝国赚了 {amount}',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 首次交互引导
    'tut.title': '第一笔生意',
    'tut.1': '点击大楼 3 次赚钱',
    'tut.2': '购买洗衣店',
    'tut.3': '收取你的收益',
    'tut.step': '步骤 {n}/{total}',
  },
};
