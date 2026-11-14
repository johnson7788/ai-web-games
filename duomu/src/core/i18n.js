/**
 * 双语。中文默认，英文完整可切。
 * 规则：文案一律走 t(key)，渲染层不许出现硬编码中文。
 */
const STRINGS = {
  zh: {
    'game.title': '夺木',
    'game.sub': '通天建木 · 双仙夺木',
    'menu.solo': '单人 · 战电脑',
    'menu.duo': '双人 · 同屏',
    'menu.howto': '玩法说明',
    'menu.diff': '对手',
    'menu.best': '最高夺木',
    'menu.hint': '点击开始，或按 Enter',
    'howto.title': '玩法说明',
    'howto.p1': '每一节木段会从天雷里落下。你只能砍「没有雷印」的那一边。',
    'howto.p2': '雷印一开始是蒙着的。0.45 秒后出现微光，再 0.45 秒才露出真印。',
    'howto.p3': '出手越早分越高：盲劈 ×3、赌微光 ×2、等明牌 ×1。同一节里先出手的人再 +1。',
    'howto.p4': '劈到雷印那一边就挨雷。木段停留计时走完你还没出手，天雷也劈你。',
    'howto.p5': '双雷段两侧都有印，碰哪边都死——只能按住不动，等它自己飘走。',
    'howto.p6': '先夺到 26 木，或把对手劈光三格血，就赢。',
    'howto.close': '知道了',
    'howto.keyboard': '键盘：← → 砍左/砍右　A D 供玩家二使用　P 暂停',
    'hud.target': '夺木目标',
    'hud.blind': '盲劈',
    'hud.hint': '赌微光',
    'hud.sure': '明牌',
    'hud.yours': '你',
    'hud.cpu': '电脑',
    'hud.left': '左',
    'hud.right': '右',
    'hud.p1': '玩家一',
    'hud.p2': '玩家二',
    'pause.title': '暂停',
    'pause.resume': '继续',
    'pause.restart': '重开一局',
    'pause.menu': '回主菜单',
    'pause.sound': '音效',
    'result.win': '夺木成功',
    'result.lose': '木归他人',
    'result.draw': '同归于尽',
    'result.p1win': '玩家一胜',
    'result.p2win': '玩家二胜',
    'result.logs': '夺木',
    'result.blind': '盲劈',
    'result.first': '先手',
    'result.best': '最高连击',
    'result.again': '再来一局',
    'result.revive': '▶ 看广告 · 复活',
    'result.reviveSub': '补两格血，比分保留',
    'result.menu': '回主菜单',
    'result.newbest': '新纪录',
    'act.wind': '第一劫 · 风',
    'act.fire': '第二劫 · 火',
    'act.thunder': '第三劫 · 雷',
    'act.sudden': '天劫',
    'ai.novice': '入门',
    'ai.veteran': '老手',
    'ai.master': '宗师',
    'toast.blind': '盲劈！',
    'toast.hint': '赌对了！',
    'toast.first': '先手',
    'toast.zap': '劈中雷印！',
    'toast.escape': '木段溜走了',
    'toast.smite': '天雷轰顶',
    'toast.both': '双雷 · 别碰',
    'toast.act': '劫数加深',
    'toast.sudden': '天劫降临',
    'rank.legend': '雷部正神',
    'rank.strong': '劈雷真人',
    'rank.ok': '手稳心狠',
    'rank.weak': '还在暖手',
    'common.loading': '正在引雷…',
    'menu.soundOn': '音效 ON',
    'menu.soundOff': '音效 OFF',
  },
  en: {
    'game.title': 'SEIZE THE LOG',
    'game.sub': 'Two immortals · One world tree',
    'menu.solo': 'Solo · vs CPU',
    'menu.duo': 'Duo · Same screen',
    'menu.howto': 'How to play',
    'menu.diff': 'Opponent',
    'menu.best': 'Best',
    'menu.hint': 'Tap to start, or press Enter',
    'howto.title': 'How to play',
    'howto.p1': 'Each log falls from the storm. Strike only the side with NO thunder brand.',
    'howto.p2': 'The brand starts hidden. At 0.45s a faint glow hints it; at 0.9s the real brand shows.',
    'howto.p3': 'Earlier strikes pay more: blind x3, hint x2, revealed x1. First to strike a log also gets +1.',
    'howto.p4': 'Strike the branded side and you are struck. Let the log time out and the storm strikes you too.',
    'howto.p5': 'A double-brand log is deadly on both sides — hold still and let it drift past.',
    'howto.p6': 'First to 26 logs wins, or drain all three of your rival\'s HP.',
    'howto.close': 'Got it',
    'howto.keyboard': 'Keys: ← → chop left/right　A D for player two　P pause',
    'hud.target': 'TARGET',
    'hud.blind': 'BLIND',
    'hud.hint': 'HINT',
    'hud.sure': 'SURE',
    'hud.yours': 'YOU',
    'hud.cpu': 'CPU',
    'hud.left': 'LEFT',
    'hud.right': 'RIGHT',
    'hud.p1': 'P1',
    'hud.p2': 'P2',
    'pause.title': 'PAUSED',
    'pause.resume': 'Resume',
    'pause.restart': 'Restart',
    'pause.menu': 'Main menu',
    'pause.sound': 'Sound',
    'result.win': 'LOGS CLAIMED',
    'result.lose': 'LOGS LOST',
    'result.draw': 'MUTUAL RUIN',
    'result.p1win': 'P1 WINS',
    'result.p2win': 'P2 WINS',
    'result.logs': 'Logs',
    'result.blind': 'Blind',
    'result.first': 'First strikes',
    'result.best': 'Best combo',
    'result.again': 'Play again',
    'result.revive': '▶ Watch ad · Revive',
    'result.reviveSub': 'Refill 2 HP, keep the score',
    'result.menu': 'Main menu',
    'result.newbest': 'NEW BEST',
    'act.wind': 'ACT I · WIND',
    'act.fire': 'ACT II · FIRE',
    'act.thunder': 'ACT III · THUNDER',
    'act.sudden': 'TRIBULATION',
    'ai.novice': 'Novice',
    'ai.veteran': 'Veteran',
    'ai.master': 'Master',
    'toast.blind': 'BLIND!',
    'toast.hint': 'GAMBLED!',
    'toast.first': 'FIRST',
    'toast.zap': 'STRUCK!',
    'toast.escape': 'Log drifted away',
    'toast.smite': 'HEAVEN STRIKES',
    'toast.both': 'DOUBLE · DO NOT TOUCH',
    'toast.act': 'The tribulation deepens',
    'toast.sudden': 'Tribulation arrives',
    'rank.legend': 'Thunder Sovereign',
    'rank.strong': 'Storm Adept',
    'rank.ok': 'Steady Hand',
    'rank.weak': 'Still Warming Up',
    'common.loading': 'Summoning thunder…',
    'menu.soundOn': 'Sound ON',
    'menu.soundOff': 'Sound OFF',
  },
};

/**
 * 语言优先级：?lang= > localStorage > 默认英文。
 * 刻意不读 navigator.language ——「默认英文」是产品决定，中文由玩家显式切换。
 */
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'duomu.lang.v1';
let lang = DEFAULT_LANG;

function fromQuery() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    return STRINGS[q] ? q : null;
  } catch { return null; }
}

export function initLang() {
  let next = fromQuery();
  if (!next) {
    try { next = localStorage.getItem(STORAGE_KEY); } catch { next = null; }
  }
  lang = STRINGS[next] ? next : DEFAULT_LANG;
  applyDocLang();
  return lang;
}

function applyDocLang() {
  try {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dir = 'ltr';
  } catch { /* 无 DOM 环境（单测）忽略 */ }
}

export function setLang(next) {
  lang = STRINGS[next] ? next : DEFAULT_LANG;
  applyDocLang();
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* 隐私模式 */ }
  return lang;
}
export function getLang() { return lang; }

/** 标题按行给：中文一个字一行太重，英文两行刚好落在 720 宽里 */
export function titleLines() {
  return lang === 'zh' ? ['夺 木'] : ['SEIZE', 'THE LOG'];
}
export function t(key) { return STRINGS[lang]?.[key] ?? STRINGS.en?.[key] ?? key; }
export const LANGS = Object.keys(STRINGS);
