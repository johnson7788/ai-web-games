// 素材路径常量表 + 一次性预载（Image.decode，失败置 null）。
// 玩法层（棋盘格/高亮/判定）不走这里，仍由 render 程序化绘制。
export const PATHS = {
  board: 'assets/bg/board-wood.webp',
  keyart: 'assets/keyart/chess-master.webp',
  'piece:w:p': 'assets/pieces/white-pawn.webp',
  'piece:w:n': 'assets/pieces/white-knight.webp',
  'piece:w:b': 'assets/pieces/white-bishop.webp',
  'piece:w:r': 'assets/pieces/white-rook.webp',
  'piece:w:q': 'assets/pieces/white-queen.webp',
  'piece:w:k': 'assets/pieces/white-king.webp',
  'piece:b:p': 'assets/pieces/black-pawn.webp',
  'piece:b:n': 'assets/pieces/black-knight.webp',
  'piece:b:b': 'assets/pieces/black-bishop.webp',
  'piece:b:r': 'assets/pieces/black-rook.webp',
  'piece:b:q': 'assets/pieces/black-queen.webp',
  'piece:b:k': 'assets/pieces/black-king.webp',
};

const store = new Map(); // key -> { img, w, h, pivot } | null
let progress = 0;
let ready = false;

function pivotOf(key) {
  return key.startsWith('piece:') ? 'bottom' : 'center';
}

export const art = {
  get ready() { return ready; },
  get progress() { return progress; },
  get(key) { const e = store.get(key); return e && e.img ? e : null; },
};

export async function preload(onProgress) {
  const entries = Object.entries(PATHS);
  let done = 0;
  for (const [key, file] of entries) {
    const img = new Image();
    try {
      img.src = file;
      await img.decode();
      store.set(key, { img, w: img.naturalWidth, h: img.naturalHeight, pivot: pivotOf(key) });
    } catch {
      store.set(key, null); // 加载失败置 null，渲染端回退占位
    }
    done += 1;
    progress = done / entries.length;
    if (onProgress) onProgress(progress);
  }
  ready = true;
}
