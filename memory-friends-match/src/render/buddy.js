// 程序化霓虹「机器朋友」SVG 生成器（零素材，纯字符串拼装）。
// 每位朋友由 6 个部件组合：身体形状 / 霓虹配色 / 眼睛 / 嘴 / 头顶装饰 / 胸前徽章。
const PALETTES = [
  { body: '#FF2E97', glow: '#FF8FC9', face: '#FFD7EC', accent: '#FFB3DA' },
  { body: '#00E5FF', glow: '#8FF6FF', face: '#D7F7FF', accent: '#B3F0FF' },
  { body: '#7C4DFF', glow: '#B79CFF', face: '#E6DDFF', accent: '#CDBBFF' },
  { body: '#FFD12E', glow: '#FFE58A', face: '#FFF3CC', accent: '#FFE9A6' },
  { body: '#39FF6A', glow: '#96FFB8', face: '#D7FFE4', accent: '#B6FFD0' },
  { body: '#FF7A1A', glow: '#FFB380', face: '#FFE0CC', accent: '#FFD0A6' },
];

const INK = '#160E2E';

export function buddyPalette(friend) {
  return PALETTES[friend.looks.color % PALETTES.length];
}

export function buddyName(friend, lang) {
  return lang === 'zh' ? friend.nameZh : friend.nameEn;
}

function accessory(looks, p) {
  switch (looks.accessory) {
    case 0:
      return `<line x1="100" y1="66" x2="100" y2="34" stroke="${p.glow}" stroke-width="5" stroke-linecap="round"/>`
        + `<circle cx="100" cy="28" r="8" fill="${p.accent}" stroke="${p.glow}" stroke-width="3"/>`;
    case 1:
      return `<polygon points="112,24 84,52 100,52 92,72 120,42 104,42" fill="${p.accent}" stroke="${p.glow}" stroke-width="3" stroke-linejoin="round"/>`;
    case 2:
      return `<polygon points="100,18 108,44 134,44 113,58 121,84 100,68 79,84 87,58 66,44 92,44" fill="${p.accent}" stroke="${p.glow}" stroke-width="3" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}

function bodyShape(looks, p) {
  switch (looks.body) {
    case 0:
      return `<circle cx="100" cy="122" r="58" fill="${p.body}" stroke="${p.glow}" stroke-width="4"/>`;
    case 1:
      return `<rect x="46" y="72" width="108" height="108" rx="28" fill="${p.body}" stroke="${p.glow}" stroke-width="4"/>`;
    default:
      return `<polygon points="100,66 152,96 152,154 100,184 48,154 48,96" fill="${p.body}" stroke="${p.glow}" stroke-width="4" stroke-linejoin="round"/>`;
  }
}

function eyes(looks, p) {
  switch (looks.eye) {
    case 0:
      return `<line x1="82" y1="103" x2="118" y2="103" stroke="${INK}" stroke-width="5"/>`
        + `<circle cx="82" cy="103" r="9" fill="none" stroke="${INK}" stroke-width="5"/>`
        + `<circle cx="118" cy="103" r="9" fill="none" stroke="${INK}" stroke-width="5"/>`;
    case 1:
      return `<rect x="70" y="92" width="60" height="20" rx="10" fill="${INK}"/>`
        + `<rect x="78" y="97" width="13" height="10" rx="5" fill="${p.face}"/>`
        + `<rect x="109" y="97" width="13" height="10" rx="5" fill="${p.face}"/>`;
    default:
      return `<circle cx="88" cy="103" r="7" fill="${INK}"/><circle cx="112" cy="103" r="7" fill="${INK}"/>`;
  }
}

function mouth(looks) {
  switch (looks.mouth) {
    case 0:
      return `<path d="M84 121 Q100 133 116 121" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 1:
      return `<line x1="86" y1="121" x2="114" y2="121" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 2:
      return `<polyline points="84,123 92,115 100,123 108,115 116,123" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
    default:
      return `<circle cx="100" cy="121" r="6" fill="${INK}"/>`;
  }
}

function badge(looks, p) {
  switch (looks.badge) {
    case 0:
      return `<polygon points="100,148 91,162 109,162" fill="${p.accent}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    case 1:
      return `<circle cx="100" cy="156" r="8" fill="${p.accent}" stroke="${INK}" stroke-width="2"/>`;
    default:
      return `<rect x="92" y="148" width="16" height="16" rx="3" fill="${p.accent}" stroke="${INK}" stroke-width="2"/>`;
  }
}

export function buddySvg(friend) {
  const p = buddyPalette(friend);
  const parts = [
    accessory(friend.looks, p),
    bodyShape(friend.looks, p),
    `<rect x="62" y="80" width="76" height="58" rx="18" fill="${p.face}" stroke="${p.glow}" stroke-width="3"/>`,
    eyes(friend.looks, p),
    mouth(friend.looks),
    badge(friend.looks, p),
  ];
  return `<svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}
