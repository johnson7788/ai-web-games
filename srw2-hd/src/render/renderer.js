/**
 * src/render/renderer.js — 地图与机体绘制（Canvas 2D，矢量美术）
 */

import { GRID, SPRITES, LEGEND, TERRAIN } from "../../config/data.js";
import { GENERATED_MAP, GENERATED_CUTIN } from "../../config/sprites-generated.js";
import { TILE_ATLAS, TILE_FALLBACK, TILE_STAGE_FALLBACK } from "../../config/tile-atlas.js";
import { FANTASY_TILES, FANTASY_STAGE, FANTASY_VARIANTS } from "../../config/fantasy-tiles.js";

const T = GRID.tile;

/* ---------------------------------------------------- HD 素材（优云生成） */
const PIXEL_MODE = typeof location !== "undefined" && new URLSearchParams(location.search).has("pixel");
const PARAMS = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const TILE_MAP_MODE = PARAMS.has("tiles");
const MAP_STYLE = TILE_MAP_MODE ? "tiles" : (PARAMS.get("map") || "fantasy");
const IMG = {};
const IMG_MAP = {};
if (PIXEL_MODE && typeof Image !== "undefined") {
  GENERATED_MAP.forEach((k) => { const im = new Image(); im.src = `assets/hd/units-map/${k}.webp`; IMG_MAP[k] = im; });
}
const UNIT_KEYS = Object.keys(SPRITES).filter((k) => SPRITES[k].hd);
const FX_KEYS = ["beam","impact","explosion-1","explosion-2","explosion-3"];
if (typeof Image !== "undefined") {
  UNIT_KEYS.forEach((k) => { const im = new Image(); im.src = `assets/hd/units/${k}.webp`; IMG[k] = im; });
  FX_KEYS.forEach((k) => { const im = new Image(); im.src = `assets/hd/fx/${k}.webp`; IMG["fx-" + k] = im; });
}
const imgReady = (im) => !!(im && im.complete && im.naturalWidth > 0);
const TILES = {};
const TILE_KEYS = ["ground_grass","ground_sand","ground_space","ground_moon","forest","mountain","water","city","wall"];
if (typeof Image !== "undefined") {
  TILE_KEYS.forEach((k) => { const im = new Image(); im.src = `assets/hd/tiles/${k}.webp`; TILES[k] = im; });
}
const TILE_IMG = {};
if (TILE_MAP_MODE && typeof Image !== "undefined") {
  for (const [grp, src] of Object.entries(TILE_ATLAS)) {
    const im = new Image();
    im.src = src;
    TILE_IMG[grp] = im;
  }
}
function atlasReady() {
  const list = Object.values(TILE_IMG);
  return list.length > 0 && list.every(imgReady);
}
function tileImageFor(sc, grp, key) {
  const ch = String(sc.chapter || 1).padStart(2, "0");
  const fb = (TILE_FALLBACK[ch] && TILE_FALLBACK[ch][key])
    || (TILE_STAGE_FALLBACK[sc.stageType] && TILE_STAGE_FALLBACK[sc.stageType][key]);
  return TILE_IMG[grp] || (fb && TILE_IMG[fb]) || null;
}
const FANTASY_IMG = {};
if (MAP_STYLE === "fantasy" && typeof Image !== "undefined") {
  for (const [k, src] of Object.entries(FANTASY_TILES)) { const im = new Image(); im.src = src; FANTASY_IMG[k] = im; }
}
function fantasyReady() {
  const list = Object.values(FANTASY_IMG);
  return list.length > 0 && list.every(imgReady);
}
function fantasyKey(key, stage) {
  const map = FANTASY_STAGE[stage] || {};
  return map[key] || (key === "sea" ? "water" : key === "bush" ? "rough" : key);
}
function fantasyImage(key, x, y) {
  const vars = FANTASY_VARIANTS[key];
  const name = vars ? vars[(x * 7 + y * 13) % vars.length] : key;
  return FANTASY_IMG[name] || FANTASY_IMG[key] || FANTASY_IMG.plain;
}
const GROUND_BY_TEMPLATE = { desert: "ground_sand", space: "ground_space", moon: "ground_moon" };
function tileFor(terrainKey, template) {
  if (terrainKey === "forest") return "forest";
  if (terrainKey === "mountain") return "mountain";
  if (terrainKey === "water") return "water";
  if (terrainKey === "wall") return "wall";
  if (terrainKey === "city") return "city";
  return GROUND_BY_TEMPLATE[template] || "ground_grass";
}
const MAP_HD = null;
const HD_SCENARIO = {};
function hdScenarioImage(chapter) {
  if (typeof Image === "undefined") return null;
  const k = String(chapter || 1).padStart(2, "0");
  if (!HD_SCENARIO[k]) {
    const im = new Image();
    const ai = new URLSearchParams(location.search).get("maps") === "ai";
    im.src = ai ? `assets/hd/maps-ai/s${k}.webp` : `assets/hd/maps-clean/s${k}.webp`;
    HD_SCENARIO[k] = im;
  }
  return HD_SCENARIO[k];
}
export function hdMapReady(state) {
  const sc = (state && state.scenario) || {};
  if (MAP_STYLE === "tiles" && sc.tileGrid && sc.tileGrid.length) return atlasReady();
  if (MAP_STYLE === "fantasy") return fantasyReady();
  const im = hdScenarioImage(sc.chapter);
  return imgReady(im);
}

/* ------------------------------------------------------------------ 色板 */

const EYE = {
  gundam: "#8fe3ff", mazinger: "#ffd75e", getter: "#7ef0ff", aphrodite: "#ffd0e0",
  texas: "#ffd75e", whitebase: "#9fe6ff", zaku: "#ff5a8a", zakuChar: "#ffdf7a",
  rada: "#ff6ad5", buda: "#ffb347", barrel: "#ff6a5a", zain: "#ff5a8a"
};

/** 统一从 units.js 的 SPRITES 取配色；未知 sprite 回退高达色 */
function paletteOf(sprite) {
  const sp = SPRITES[sprite] || SPRITES.gundam;
  return { main: sp.main, sub: sp.sub, accent: sp.accent, trim: sp.trim, eye: EYE[sprite] || "#8fe3ff" };
}

function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------ 地形图层 */

function drawTerrainTile(g, terrain, x, y) {
  const px = x * T;
  const py = y * T;
  const r = hash(x, y);

  switch (terrain.key === "sea" ? "water" : terrain.key === "town" ? "city" : terrain.key) {
    case "water": {
      const grad = g.createLinearGradient(px, py, px, py + T);
      grad.addColorStop(0, "#0c2233");
      grad.addColorStop(1, "#081a29");
      g.fillStyle = grad;
      g.fillRect(px, py, T, T);
      g.strokeStyle = "rgba(120, 200, 255, 0.18)";
      g.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const wy = py + 12 + i * 16 + r * 6;
        g.beginPath();
        g.moveTo(px + 6 + r * 6, wy);
        g.quadraticCurveTo(px + T / 2, wy - 5, px + T - 6, wy);
        g.stroke();
      }
      break;
    }
    case "forest": {
      g.fillStyle = "#16241a";
      g.fillRect(px, py, T, T);
      for (let i = 0; i < 3; i++) {
        const cx = px + 10 + hash(x + i, y * 3) * 24;
        const cy = py + 12 + hash(x * 5, y + i) * 22;
        g.fillStyle = "rgba(20, 40, 26, 0.9)";
        g.beginPath();
        g.ellipse(cx, cy + 5, 8, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = i % 2 ? "#2f5138" : "#39613f";
        g.beginPath();
        g.arc(cx, cy, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(140, 210, 150, 0.18)";
        g.beginPath();
        g.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "mountain": {
      g.fillStyle = "#23252b";
      g.fillRect(px, py, T, T);
      g.fillStyle = "#31343c";
      g.beginPath();
      g.moveTo(px + 4, py + T - 6);
      g.lineTo(px + 18, py + 10);
      g.lineTo(px + 32, py + T - 6);
      g.closePath();
      g.fill();
      g.fillStyle = "#3d414b";
      g.beginPath();
      g.moveTo(px + 20, py + T - 6);
      g.lineTo(px + 32, py + 16);
      g.lineTo(px + 42, py + T - 6);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(220, 235, 255, 0.55)";
      g.beginPath();
      g.moveTo(px + 15, py + 18);
      g.lineTo(px + 18, py + 10);
      g.lineTo(px + 22, py + 19);
      g.closePath();
      g.fill();
      break;
    }
    case "city": {
      g.fillStyle = "#151d2b";
      g.fillRect(px, py, T, T);
      for (let i = 0; i < 3; i++) {
        const w = 8 + hash(x + i, y) * 8;
        const h = 12 + hash(x, y + i) * 16;
        const bx = px + 5 + i * 13;
        const by = py + T - 6 - h;
        g.fillStyle = i % 2 ? "#242f45" : "#1d2739";
        g.fillRect(bx, by, w, h);
        g.fillStyle = "rgba(233, 179, 74, 0.75)";
        for (let wy = 0; wy < Math.floor(h / 6); wy++) {
          for (let wx = 0; wx < 2; wx++) {
            if (hash(bx + wx, by + wy) > 0.45) {
              g.fillRect(bx + 2 + wx * 4, by + 3 + wy * 6, 2, 2);
            }
          }
        }
      }
      break;
    }
    case "base": {
      const grad = g.createLinearGradient(px, py, px + T, py + T);
      grad.addColorStop(0, "#132a3a");
      grad.addColorStop(1, "#0c1d29");
      g.fillStyle = grad;
      g.fillRect(px, py, T, T);
      g.strokeStyle = "rgba(94, 200, 255, 0.45)";
      g.lineWidth = 1;
      g.strokeRect(px + 3.5, py + 3.5, T - 7, T - 7);
      g.strokeStyle = "rgba(94, 200, 255, 0.18)";
      g.beginPath();
      g.moveTo(px + T / 2, py + 6);
      g.lineTo(px + T - 6, py + T / 2);
      g.lineTo(px + T / 2, py + T - 6);
      g.lineTo(px + 6, py + T / 2);
      g.closePath();
      g.stroke();
      g.fillStyle = "rgba(94, 200, 255, 0.25)";
      g.fillRect(px + T / 2 - 2, py + T / 2 - 2, 4, 4);
      break;
    }
    case "desert": {
      const grad = g.createLinearGradient(px, py, px, py + T);
      grad.addColorStop(0, "#4a4326");
      grad.addColorStop(1, "#3a341e");
      g.fillStyle = grad;
      g.fillRect(px, py, T, T);
      g.fillStyle = "rgba(233, 214, 138, 0.12)";
      for (let i = 0; i < 3; i++) g.fillRect(px + 8 + hash(x, y + i) * 34, py + 10 + i * 14, 14, 2);
      break;
    }
    case "rock": {
      g.fillStyle = "#20242b";
      g.fillRect(px, py, T, T);
      g.fillStyle = "#3a414d";
      g.beginPath();
      g.ellipse(px + 18, py + 24, 16, 12, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#4a525f";
      g.beginPath();
      g.ellipse(px + 36, py + 38, 12, 9, -0.2, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "bush": {
      g.fillStyle = "#16241a";
      g.fillRect(px, py, T, T);
      for (let i = 0; i < 2; i++) {
        g.fillStyle = i % 2 ? "#25452c" : "#2f5138";
        g.beginPath();
        g.arc(px + 18 + i * 16, py + 26 + i * 6, 10, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "rough": {
      g.fillStyle = "#241f18";
      g.fillRect(px, py, T, T);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? "#3a3226" : "#4a4030";
        g.fillRect(px + 8 + hash(x + i, y) * 34, py + 10 + hash(x, y + i) * 32, 7, 5);
      }
      break;
    }
    case "tank": {
      g.fillStyle = "#141118";
      g.fillRect(px, py, T, T);
      g.strokeStyle = "rgba(233, 179, 74, 0.35)";
      g.lineWidth = 2;
      g.strokeRect(px + 8, py + 8, T - 16, T - 16);
      g.beginPath();
      g.moveTo(px + 10, py + 10);
      g.lineTo(px + T - 10, py + T - 10);
      g.moveTo(px + T - 10, py + 10);
      g.lineTo(px + 10, py + T - 10);
      g.stroke();
      break;
    }
    case "road": {
      g.fillStyle = "#24272c";
      g.fillRect(px, py, T, T);
      g.fillStyle = "rgba(233, 179, 74, 0.28)";
      g.fillRect(px + T / 2 - 1, py + 6, 2, 12);
      g.fillRect(px + T / 2 - 1, py + 28, 2, 12);
      break;
    }
    case "wall": {
      g.fillStyle = "#101319";
      g.fillRect(px, py, T, T);
      g.strokeStyle = "rgba(180, 200, 230, 0.16)";
      g.strokeRect(px + 2.5, py + 2.5, T - 5, T - 5);
      g.fillStyle = "rgba(255, 255, 255, 0.04)";
      for (let i = 0; i < 3; i++) g.fillRect(px + 6, py + 8 + i * 10, T - 12, 3);
      break;
    }
    default: {
      const grad = g.createLinearGradient(px, py, px, py + T);
      grad.addColorStop(0, "#1d2c22");
      grad.addColorStop(1, "#182419");
      g.fillStyle = grad;
      g.fillRect(px, py, T, T);
      if (r > 0.62) {
        g.strokeStyle = "rgba(120, 170, 120, 0.22)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(px + 8 + r * 20, py + T - 8);
        g.lineTo(px + 10 + r * 20, py + T - 16);
        g.stroke();
      }
      break;
    }
  }
}

export function buildTerrainLayer(state) {
  const cols = state.cols || state.map[0].length;
  const rows = state.rows || state.map.length;
  const layer = document.createElement("canvas");
  layer.width = cols * T;
  layer.height = rows * T;
  const g = layer.getContext("2d");
  const sc = state.scenario || {};
  const tg = sc.tileGrid;
  if (MAP_STYLE === "fantasy") {
    const stage = sc.stageType || "ground";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const key = fantasyKey((state.map[y][x] && state.map[y][x].key) || "plain", stage);
        const im = fantasyImage(key, x, y);
        if (imgReady(im)) g.drawImage(im, x * T, y * T, T, T);
        else drawTerrainTile(g, state.map[y][x], x, y);
      }
    }
  } else if (MAP_STYLE === "tiles" && tg && tg.length) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const grp = tg[y] && tg[y][x];
        const key = (state.map[y][x] && state.map[y][x].key) || "plain";
        const im = tileImageFor(sc, grp, key);
        if (imgReady(im)) g.drawImage(im, x * T, y * T, T, T);
        else drawTerrainTile(g, state.map[y][x], x, y);
      }
    }
  } else {
    const hd = hdScenarioImage(sc.chapter);
    if (imgReady(hd)) {
    // 官方图带 8px 装饰边框：scenario.bg 给出「地图内容框」，按比例裁切后铺满格子
    const bg = sc.bg;
    if (bg && bg.imgW && bg.imgH) {
      const sx = (bg.x / bg.imgW) * hd.width;
      const sy = (bg.y / bg.imgH) * hd.height;
      const sw = (bg.w / bg.imgW) * hd.width;
      const sh = (bg.h / bg.imgH) * hd.height;
      g.drawImage(hd, sx, sy, sw, sh, 0, 0, layer.width, layer.height);
    } else {
        g.drawImage(hd, 0, 0, layer.width, layer.height);
      }
    } else {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          drawTerrainTile(g, state.map[y][x], x, y);
        }
      }
    }
  }
  // 网格（tile 模式用深色细线，保留原版格子边界）
  g.strokeStyle = MAP_STYLE === "fantasy" ? "rgba(10, 12, 18, 0.17)"
    : (tg && tg.length) ? "rgba(10, 12, 18, 0.28)" : "rgba(140, 185, 240, 0.05)";
  g.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    g.beginPath();
    g.moveTo(x * T + 0.5, 0);
    g.lineTo(x * T + 0.5, rows * T);
    g.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    g.beginPath();
    g.moveTo(0, y * T + 0.5);
    g.lineTo(cols * T, y * T + 0.5);
    g.stroke();
  }
  return layer;
}

/* ---------------------------------------------------------------- 机体 */

export function drawMech(g, sprite, size, opts = {}) {
  const p = paletteOf(sprite);
  const shape = opts.shape || (SPRITES[sprite] && SPRITES[sprite].shape) || "mech";
  const s = size / 40;
  g.save();
  g.scale(s, s);
  const outline = "rgba(4, 8, 14, 0.85)";
  g.lineJoin = "round";
  g.lineWidth = 1.6;
  g.strokeStyle = outline;

  const rect = (x, y, w, h, fill) => {
    g.fillStyle = fill;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
  };
  const poly = (pts, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
    g.stroke();
  };

  if (shape === "ship") {
    // 战舰：舰体 + 舰桥 + 弹射甲板
    poly([-18, 12, 18, 12, 12, 20, -12, 20], p.sub);
    poly([-20, 2, 20, 2, 14, 13, -14, 13], p.main);
    rect(-6, -6, 12, 9, p.main);
    rect(-2, -11, 4, 6, p.trim);
    rect(-14, 4, 6, 4, p.accent);
    rect(8, 4, 6, 4, p.accent);
    g.fillStyle = p.eye;
    g.fillRect(-1, -9, 2, 2);
    g.fillRect(-16, 7, 3, 2);
    g.fillRect(13, 7, 3, 2);
  } else if (shape === "beast") {
    // 机械兽 / 炮台
    poly([-16, 8, -10, -4, 6, -8, 16, -2, 14, 10, -12, 10], p.main);
    rect(-6, -12, 10, 8, p.sub);
    g.fillStyle = p.eye;
    g.beginPath();
    g.arc(1, -9, 2, 0, Math.PI * 2);
    g.fill();
    if (sprite === "buda") {
      poly([-18, -2, -12, -14, -6, -6], p.accent);
      poly([16, -2, 10, -14, 4, -6], p.accent);
    }
    if (sprite === "barrel") {
      rect(-14, -16, 5, 10, p.sub);
      rect(-7, -18, 5, 12, p.sub);
      rect(0, -16, 5, 10, p.sub);
    }
    rect(-12, 10, 5, 6, p.sub);
    rect(6, 10, 5, 6, p.sub);
  } else if (shape === "turret") {
    poly([-16, 12, 16, 12, 10, 4, -10, 4], p.sub);
    rect(-7, -8, 14, 12, p.main);
    rect(-2, -16, 4, 10, p.trim);
    g.fillStyle = p.eye;
    g.fillRect(-1, -15, 2, 2);
  } else if (shape === "mirror") {
    poly([0, -18, 14, -9, 14, 9, 0, 18, -14, 9, -14, -9], p.main);
    poly([0, -12, 9, -6, 9, 6, 0, 12, -9, 6, -9, -6], p.accent);
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.strokeRect(-10, 2, 20, 9);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(-10, 2, 20, 3);
  } else if (shape === "missile") {
    poly([0, -20, 6, -8, 6, 10, 0, 16, -6, 10, -6, -8], p.main);
    poly([6, 6, 13, 14, 6, 12], p.sub);
    poly([-6, 6, -13, 14, -6, 12], p.sub);
    g.fillStyle = p.accent;
    g.fillRect(-3, -6, 6, 4);
  } else if (shape === "boss") {
    // 大型 BOSS：宽肩 + 披风 + 独眼
    poly([-22, 14, 22, 14, 16, 22, -16, 22], p.sub);
    poly([-20, 4, 20, 4, 15, 16, -15, 16], p.main);
    poly([-26, -8, -12, -10, -10, 8, -22, 12], p.sub);
    poly([26, -8, 12, -10, 10, 8, 22, 12], p.sub);
    rect(-9, -12, 18, 14, p.main);
    poly([-12, -10, -4, -22, 0, -12], p.accent);
    poly([12, -10, 4, -22, 0, -12], p.accent);
    g.fillStyle = p.eye;
    g.beginPath();
    g.arc(0, -5, 4, 0, Math.PI * 2);
    g.fill();
    rect(-16, 16, 9, 6, p.accent);
    rect(7, 16, 9, 6, p.accent);
  } else {
    const wide = shape === "bulky" ? 1.28 : sprite === "mazinger" || sprite === "zain" ? 1.12 : 1;
    const headY = -14;
    // 腿
    rect(-8 * wide, 6, 6, 12, p.sub);
    rect(2 * wide, 6, 6, 12, p.sub);
    rect(-8 * wide, 16, 7, 4, p.accent);
    rect(1 * wide, 16, 7, 4, p.accent);
    // 躯干
    poly([-9 * wide, -6, 9 * wide, -6, 7 * wide, 8, -7 * wide, 8], p.main);
    rect(-4 * wide, -2, 8 * wide, 6, p.sub);
    if (sprite === "mazinger") {
      // 胸部火焰板
      g.fillStyle = "rgba(233, 179, 74, 0.35)";
      g.beginPath();
      g.arc(0, 1, 4, 0, Math.PI * 2);
      g.fill();
    }
    // 肩
    rect(-15 * wide, -7, 6, 8, p.sub);
    rect(9 * wide, -7, 6, 8, p.sub);
    // 手臂
    rect(-14 * wide, 1, 4, 10, p.main);
    rect(10 * wide, 1, 4, 10, p.main);
    // 头
    rect(-4, headY, 8, 7, p.main);
    g.fillStyle = p.eye;
    g.fillRect(-3, headY + 3, 6, 2);
    // 特征
    if (sprite === "gundam") {
      poly([-6, headY - 1, -2, headY - 7, 0, headY - 2], p.accent);
      poly([6, headY - 1, 2, headY - 7, 0, headY - 2], p.accent);
      rect(-1, headY - 2, 2, 3, p.trim);
    } else if (sprite === "zaku" || sprite === "zakuChar") {
      rect(-4, headY - 3, 8, 3, p.sub);
      g.fillStyle = p.eye;
      g.beginPath();
      g.arc(0, headY + 3, 2.2, 0, Math.PI * 2);
      g.fill();
      poly([9 * wide, -9, 16 * wide, -12, 15 * wide, -4], p.trim);
    } else if (sprite === "getter") {
      poly([-14, -8, -22, -16, -12, -12], p.accent);
      poly([14, -8, 22, -16, 12, -12], p.accent);
      g.fillStyle = p.trim;
      g.fillRect(-3, headY - 4, 6, 3);
    } else if (sprite === "aphrodite") {
      g.fillStyle = p.trim;
      g.beginPath();
      g.arc(0, -9, 6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (sprite === "texas") {
      rect(-7, headY - 2, 14, 3, p.accent);
      g.fillStyle = p.trim;
      g.fillRect(-5, headY - 5, 10, 3);
    } else if (sprite === "zain") {
      poly([-10, -8, -16, -18, -6, -12], p.accent);
      g.fillStyle = p.trim;
      g.fillRect(-2, headY - 4, 4, 2);
      rect(12 * wide, -4, 3, 18, p.trim);
    }
  }
  g.restore();
}

/* ---------------------------------------------------------------- 场景 */

export function drawScene(g, state, view, terrainLayer) {
  const time = view.time || 0;
  const cols = state.cols || state.map[0].length;
  const rows = state.rows || state.map.length;
  const cam = view.cam || { x: 0, y: 0 };
  g.clearRect(0, 0, 880, 605);
  g.fillStyle = "#04070d";
  g.fillRect(0, 0, 880, 605);
  g.save();
  g.translate(-cam.x * T, -cam.y * T);
  g.drawImage(terrainLayer, 0, 0);

  // 移动范围：高对比青色，带外轮廓和呼吸，避免在草地上看不清
  if (view.moveSet) {
    const pulse = 0.25 + Math.sin(time / 240) * 0.05;
    for (const k of view.moveSet) {
      const [x, y] = k.split(",").map(Number);
      g.fillStyle = `rgba(34, 196, 255, ${pulse})`;
      g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      g.strokeStyle = "rgba(170, 245, 255, 0.85)";
      g.lineWidth = 1.5;
      g.strokeRect(x * T + 1.75, y * T + 1.75, T - 3.5, T - 3.5);
      // 只画范围外边界，形成一圈明显的轮廓
      g.strokeStyle = "rgba(210, 255, 255, 0.95)";
      g.lineWidth = 2.5;
      g.beginPath();
      if (!view.moveSet.has(`${x},${y - 1}`)) { g.moveTo(x * T + 1, y * T + 1); g.lineTo((x + 1) * T - 1, y * T + 1); }
      if (!view.moveSet.has(`${x},${y + 1}`)) { g.moveTo(x * T + 1, (y + 1) * T - 1); g.lineTo((x + 1) * T - 1, (y + 1) * T - 1); }
      if (!view.moveSet.has(`${x - 1},${y}`)) { g.moveTo(x * T + 1, y * T + 1); g.lineTo(x * T + 1, (y + 1) * T - 1); }
      if (!view.moveSet.has(`${x + 1},${y}`)) { g.moveTo((x + 1) * T - 1, y * T + 1); g.lineTo((x + 1) * T - 1, (y + 1) * T - 1); }
      g.stroke();
    }
  }

  // 攻击范围：同样加强轮廓
  if (view.attackSet) {
    const pulse = 0.25 + Math.sin(time / 220) * 0.05;
    for (const k of view.attackSet) {
      const [x, y] = k.split(",").map(Number);
      g.fillStyle = `rgba(255, 64, 86, ${pulse})`;
      g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      g.strokeStyle = "rgba(255, 190, 200, 0.9)";
      g.lineWidth = 2.5;
      g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
    }
  }

  // 撤离点
  const esc = view.escape;
  if (esc) {
    const pulse = 0.16 + Math.sin(time / 320) * 0.06;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const edge = esc.exit === "right" ? x === cols - 1 : esc.exit === "left" ? x === 0
          : esc.exit === "bottom" ? y === rows - 1 : y === 0;
        if (!edge) continue;
        g.fillStyle = `rgba(120, 255, 200, ${pulse})`;
        g.fillRect(x * T + 2, y * T + 2, T - 4, T - 4);
      }
    }
  }

  // 悬停格
  if (view.hover) {
    const { x, y } = view.hover;
    g.strokeStyle = "rgba(233, 179, 74, 0.9)";
    g.lineWidth = 2;
    g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
    g.strokeStyle = "rgba(233, 179, 74, 0.25)";
    g.lineWidth = 4;
    g.strokeRect(x * T + 5, y * T + 5, T - 10, T - 10);
  }

  // 机体
  const anim = view.anim || {};
  for (const unit of state.units) {
    if (!unit.alive || unit.escaped) continue;
    let px = unit.x * T + T / 2;
    let py = unit.y * T + T / 2;
    if (anim.unitId === unit.id) {
      px = anim.x;
      py = anim.y;
    }
    const selected = view.selectedId === unit.id;
    const dim = unit.acted && unit.side === "player" && !selected;

    // 脚下软阴影（椭圆，不再画成圆形）
    g.save();
    g.translate(px, py + 17);
    g.scale(1, 0.3);
    const shadow = g.createRadialGradient(0, 0, 2, 0, 0, 19);
    shadow.addColorStop(0, "rgba(0,0,0,0.42)");
    shadow.addColorStop(0.65, "rgba(0,0,0,0.22)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = shadow;
    g.beginPath();
    g.arc(0, 0, 19, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 阵营环
    g.save();
    g.strokeStyle = unit.side === "player" ? "rgba(94, 200, 255, 0.75)"
      : unit.side === "npc" ? "rgba(233, 179, 74, 0.9)" : "rgba(255, 79, 99, 0.8)";
    g.lineWidth = selected ? 2.4 : 1.4;
    g.beginPath();
    g.ellipse(px, py + 15, 16, 6.5, 0, 0, Math.PI * 2);
    g.stroke();
    if (selected) {
      const pulse = 1 + Math.sin(time / 220) * 0.08;
      g.strokeStyle = "rgba(233, 179, 74, 0.9)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(px, py + 15, 20 * pulse, 8 * pulse, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    g.save();
    if (dim) g.globalAlpha = 0.55;
    const mapIcon = IMG_MAP[unit.sprite];
    const hd = IMG[unit.sprite];
    if (PIXEL_MODE && imgReady(mapIcon)) {
      const h = unit.boss ? 54 : 46;
      g.imageSmoothingEnabled = false;
      g.drawImage(mapIcon, px - h / 2, py + 18 - h, h, h);
      g.imageSmoothingEnabled = true;
    } else if (imgReady(hd)) {
      const h = unit.boss ? 58 : 50;
      const w = h * (hd.width / hd.height);
      g.drawImage(hd, px - w / 2, py + 18 - h, w, h);
    } else {
      g.translate(px, py - 2);
      drawMech(g, unit.sprite, unit.boss ? 40 : 36, { side: unit.side });
    }
    g.restore();

    // HP 条：放在脚边（人物下方），不再顶在头上
    const w = 32;
    const ratio = Math.max(0, unit.hp / unit.maxHp);
    const hy = py + 21;
    g.fillStyle = "rgba(0,0,0,0.68)";
    g.fillRect(px - w / 2 - 1, hy - 1, w + 2, 6);
    g.fillStyle = unit.side === "player"
      ? (ratio > 0.35 ? "#46d68a" : "#ff4f63")
      : "#ff4f63";
    g.fillRect(px - w / 2, hy, w * ratio, 4);
    g.strokeStyle = "rgba(255,255,255,0.22)";
    g.lineWidth = 0.5;
    g.strokeRect(px - w / 2 + 0.5, hy + 0.5, w - 1, 3);

    if (unit.protected) {
      g.strokeStyle = "rgba(120, 255, 200, 0.9)";
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(px, py - 3, 19, 0, Math.PI * 2);
      g.stroke();
    }

    if (unit.boss) {
      g.fillStyle = "#e9b34a";
      g.beginPath();
      g.moveTo(px - 4, py - 31);
      g.lineTo(px, py - 36);
      g.lineTo(px + 4, py - 31);
      g.closePath();
      g.fill();
    }

    if (unit.acted && unit.side === "player") {
      // 已行动：脚边一个小灰勾，不再用圆形阴影盖住人物
      g.strokeStyle = "rgba(220, 232, 245, 0.75)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px + 13, py + 12);
      g.lineTo(px + 16, py + 15);
      g.lineTo(px + 21, py + 8);
      g.stroke();
    }
  }

  // 光标 & 特效
  drawEffects(g, view.effects || [], time);

  g.restore();
  const vg = g.createRadialGradient(440, 302, 180, 440, 302, 620);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.42)");
  g.fillStyle = vg;
  g.fillRect(0, 0, 880, 605);
}

/* ---------------------------------------------------------------- 特效 */

export function drawEffects(g, effects, time) {
  for (const fx of effects) {
    const t = (time - fx.start) / fx.duration;
    if (t < 0 || t > 1) continue;
    const ease = 1 - Math.pow(1 - t, 3);
    switch (fx.kind) {
      case "beam": {
        if (imgReady(IMG["fx-beam"])) {
          const dx = fx.x2 - fx.x1;
          const dy = fx.y2 - fx.y1;
          const len = Math.hypot(dx, dy);
          g.save();
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 1 - t * 0.9;
          g.translate(fx.x1, fx.y1);
          g.rotate(Math.atan2(dy, dx));
          g.drawImage(IMG["fx-beam"], 0, -26, len, 52);
          g.restore();
          break;
        }
        g.save();
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = fx.color || "rgba(120, 220, 255, 0.95)";
        g.lineWidth = 5 * (1 - t) + 1;
        g.beginPath();
        g.moveTo(fx.x1, fx.y1);
        g.lineTo(fx.x1 + (fx.x2 - fx.x1) * Math.min(1, ease * 1.6), fx.y1 + (fx.y2 - fx.y1) * Math.min(1, ease * 1.6));
        g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.85)";
        g.lineWidth = 1.4;
        g.stroke();
        g.restore();
        break;
      }
      case "slash": {
        g.save();
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = "rgba(255, 240, 200, 0.95)";
        g.lineWidth = 3 * (1 - t);
        g.beginPath();
        g.arc(fx.x, fx.y, 22 * ease + 4, -0.9, 0.9);
        g.stroke();
        g.strokeStyle = "rgba(255, 120, 120, 0.8)";
        g.beginPath();
        g.arc(fx.x, fx.y, 16 * ease + 2, 2.2, 4.0);
        g.stroke();
        g.restore();
        break;
      }
      case "impact": {
        if (imgReady(IMG["fx-impact"])) {
          const size = 34 + 46 * ease;
          g.save();
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 1 - t;
          g.drawImage(IMG["fx-impact"], fx.x - size / 2, fx.y - size / 2, size, size);
          g.restore();
          break;
        }
        break;
      }
      case "explosion": {
        if (imgReady(IMG["fx-explosion-1"])) {
          const frame = t < 0.34 ? "fx-explosion-1" : t < 0.67 ? "fx-explosion-2" : "fx-explosion-3";
          const size = (fx.big ? 150 : 96) * (0.6 + ease * 0.6);
          g.save();
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 1 - t * 0.7;
          g.drawImage(IMG[frame], fx.x - size / 2, fx.y - size / 2, size, size);
          g.restore();
          break;
        }
        g.save();
        const radius = 6 + 26 * ease;
        const alpha = 1 - t;
        g.globalCompositeOperation = "lighter";
        const grad = g.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, radius);
        grad.addColorStop(0, `rgba(255, 255, 220, ${alpha})`);
        grad.addColorStop(0.45, `rgba(255, 160, 60, ${alpha * 0.85})`);
        grad.addColorStop(1, "rgba(255, 60, 30, 0)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
        g.fill();
        g.restore();
        break;
      }
      case "damage": {
        g.save();
        g.globalAlpha = 1 - t * 0.9;
        g.font = "800 20px 'PingFang SC', system-ui, sans-serif";
        g.textAlign = "center";
        g.fillStyle = fx.heal ? "#6ff0a8" : "#ff7a86";
        g.strokeStyle = "rgba(0,0,0,0.75)";
        g.lineWidth = 4;
        g.strokeText(fx.text, fx.x, fx.y - 34 * ease);
        g.fillText(fx.text, fx.x, fx.y - 34 * ease);
        g.restore();
        break;
      }
      case "move": {
        g.save();
        g.globalAlpha = 1 - t;
        g.strokeStyle = "rgba(94, 200, 255, 0.5)";
        g.lineWidth = 2;
        g.setLineDash([6, 6]);
        g.beginPath();
        g.moveTo(fx.x1, fx.y1);
        g.lineTo(fx.x2, fx.y2);
        g.stroke();
        g.restore();
        break;
      }
      default:
        break;
    }
  }
}

/* ---------------------------------------------------------- 战斗立绘 */

const _cutinCache = {};
export function spriteImageSrc(sprite) {
  if (UNIT_KEYS.includes(sprite)) return `assets/hd/units/${sprite}.webp`;
  if (GENERATED_CUTIN.includes(sprite)) return `assets/hd/units-gen/${sprite}@16x.png`;
  if (_cutinCache[sprite]) return _cutinCache[sprite];
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.translate(128, 190);
  drawMech(g, sprite, 230);
  const url = c.toDataURL();
  _cutinCache[sprite] = url;
  return url;
}

/* -------------------------------------------------------------- 立绘头像 */

export function drawPortrait(canvas, sprite) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const css = 92;
  canvas.width = css * dpr;
  canvas.height = css * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  g.clearRect(0, 0, css, css);

  const grad = g.createRadialGradient(css / 2, css * 0.4, 4, css / 2, css / 2, css * 0.7);
  grad.addColorStop(0, "rgba(94,200,255,0.18)");
  grad.addColorStop(1, "rgba(4,8,14,0.9)");
  g.fillStyle = grad;
  g.fillRect(0, 0, css, css);

  const hd = IMG[sprite];
  if (imgReady(hd)) {
    const h = 80;
    const w = h * (hd.width / hd.height);
    g.drawImage(hd, (css - w) / 2, (css - h) / 2 + 2, w, h);
    return;
  }
  g.save();
  g.translate(css / 2, css / 2 + 6);
  drawMech(g, sprite, 66);
  g.restore();
}
