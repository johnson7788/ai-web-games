// 首次进入的交互引导：每一步都高亮真实 UI，并要求玩家完成动作。
// 文案在 locales；focus 是真实可点击的选择器。
export const TUTORIAL_STEPS = [
  {
    id: 'scan-one',
    titleKey: 'tutScanOneTitle',
    textKey: 'tutScanOneText',
    focus: '.item-row:not(.scanned)',
  },
  {
    id: 'scan-all',
    titleKey: 'tutScanAllTitle',
    textKey: 'tutScanAllText',
    focus: '.items-list',
  },
  {
    id: 'change',
    titleKey: 'tutChangeTitle',
    textKey: 'tutChangeText',
    focus: '.money-btn[data-cents="500"]',
  },
  {
    id: 'give',
    titleKey: 'tutGiveTitle',
    textKey: 'tutGiveText',
    focus: '#btn-give',
  },
];

export const TUTORIAL_SEED = 20261114;
