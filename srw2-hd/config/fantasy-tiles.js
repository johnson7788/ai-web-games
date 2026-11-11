// 手绘奇幻风格方形地形 tile（tools/gen_fantasy_tiles.py 生成）
export const FANTASY_TILES = {
  plain: "assets/hd/fantasy-tiles/plain.webp",
  forest: "assets/hd/fantasy-tiles/forest.webp",
  mountain: "assets/hd/fantasy-tiles/mountain.webp",
  water: "assets/hd/fantasy-tiles/water.webp",
  desert: "assets/hd/fantasy-tiles/desert.webp",
  town: "assets/hd/fantasy-tiles/town.webp",
  base: "assets/hd/fantasy-tiles/base.webp",
  wall: "assets/hd/fantasy-tiles/wall.webp",
  space: "assets/hd/fantasy-tiles/space.webp",
  moon: "assets/hd/fantasy-tiles/moon.webp",
  rock: "assets/hd/fantasy-tiles/rock.webp",
  rough: "assets/hd/fantasy-tiles/rough.webp",
  "plain-2": "assets/hd/fantasy-tiles/plain-2.webp",
  "water-2": "assets/hd/fantasy-tiles/water-2.webp",
};

export const FANTASY_VARIANTS = {
  plain: ["plain", "plain-2"],
  water: ["water", "water-2"],
};

// 同一地形在不同关卡换底：宇宙的 plain 用星海，基地的 plain 用要塞地板
export const FANTASY_STAGE = {
  space: { plain: "space", sea: "space", mountain: "space", rough: "space" },
  base: { plain: "base" },
};
