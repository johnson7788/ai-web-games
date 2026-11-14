// 素材路径常量表 + 一次性预载（Image.decode）。
// 失败置 null，调用方回退程序化绘制；不白屏、不抛错。
const CLUE_NAMES = [
  'apple', 'cat', 'sun', 'dog', 'moon', 'star', 'fish', 'tree',
  'house', 'car', 'banana', 'pizza', 'lion', 'balloon', 'elephant', 'rainbow',
];

// 各素材在 assets/manifest.json 里的落点。
export const ART = {
  bg: 'assets/bg/puzzle.webp',
  cluePath: (name) => `assets/clues/${name}.webp`,
};

// manifest 约定：clue 统一 height=260、pivot=center（按底高对齐绘制）。
export const CLUE_H = 260;

const img = { bg: null, clues: new Map() };

async function loadImage(src) {
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/** 一次性预载背景 + 全部 clue；onProgress 收 0..1。 */
export async function preload(onProgress = () => {}) {
  const sources = [ART.bg, ...CLUE_NAMES.map(ART.cluePath)];
  let done = 0;
  const results = await Promise.all(sources.map(async (src) => {
    const image = await loadImage(src);
    done += 1;
    onProgress(done / sources.length);
    return image;
  }));
  img.bg = results[0];
  img.clues = new Map(CLUE_NAMES.map((name, i) => [name, results[i + 1]]));
  return art;
}

export const art = {
  get bg() { return img.bg; },
  clue(name) { return img.clues.get(String(name).toLowerCase()) || null; },
};
