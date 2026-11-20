// src/game/spawner.js — 赛段地图生成（纯逻辑，零依赖）
// 依据 config/levels.js 的 SEGMENTS.pattern 把一段赛道铺成障碍/气泡/洋流/逆流区。
// 每个 chunk 占 ~480px，从 300px 开始依次放置，保证开局与终点附近都有呼吸空间。

import { WORLD, BUBBLE, CURRENT, OBSTACLE } from '../../config/gameplay.js';
import { segmentAt } from '../../config/levels.js';

const CHUNK_W = 480;
const START_X = 300;

function rand(rng, a, b) {
  return a + rng() * (b - a);
}

function randInt(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}

function pushReef(out, x, topY, w) {
  out.obstacles.push({ id: out.id++, x, y: topY, w, h: WORLD.BOTTOM_Y - topY, kind: 'reef' });
}

function pushRoot(out, x, botY, w) {
  out.obstacles.push({ id: out.id++, x, y: WORLD.SURFACE_Y, w, h: botY - WORLD.SURFACE_Y, kind: 'root' });
}

// 一个「上垂下礁」的竖直通道：gapY 是通道中心，gapH 是通道高度（玩家可过）。
// 上垂障碍与礁石同宽同 x，形成干净的一条竖直通道（避免宽礁石伸出通道外造成误判）。
function placeGap(out, cx, rng, gapY, gapH) {
  const gapTop = gapY - gapH / 2;
  const gapBottom = gapY + gapH / 2;
  if (gapBottom > WORLD.BOTTOM_Y - 40) return;
  if (gapTop < WORLD.SURFACE_Y + 24) return;
  const w = randInt(rng, 100, 140);
  out.obstacles.push({ id: out.id++, x: cx - w / 2, y: WORLD.SURFACE_Y, w, h: gapTop - WORLD.SURFACE_Y, kind: 'root' });
  out.obstacles.push({ id: out.id++, x: cx - w / 2, y: gapBottom, w, h: WORLD.BOTTOM_Y - gapBottom, kind: 'reef' });
}

function placeBubbles(out, cx, rng, n) {
  for (let i = 0; i < n; i += 1) {
    out.bubbles.push({
      id: out.id++,
      x: cx + rand(rng, -120, 120),
      y: rand(rng, 240, 600),
      r: BUBBLE.R,
    });
  }
}

function placeJelly(out, cx, rng, n) {
  const ys = [];
  for (let i = 0; i < n; i += 1) ys.push(rand(rng, 230, 620));
  ys.sort((a, b) => a - b);
  for (const y of ys) {
    out.obstacles.push({ id: out.id++, x: cx + rand(rng, -40, 40), y: y - OBSTACLE.JELLY_H / 2, w: OBSTACLE.JELLY_W, h: OBSTACLE.JELLY_H, kind: 'jelly' });
  }
}

function placeCurrent(out, cx) {
  out.currents.push({ id: out.id++, x: cx, y: WORLD.SURFACE_Y, h: WORLD.BOTTOM_Y - WORLD.SURFACE_Y, w: CURRENT.W, used: false });
}

function placeCounter(out, cx) {
  out.counterZones.push({ x: cx - 100, w: 200 });
}

function placeChunk(type, cx, rng, out) {
  switch (type) {
    case 'bubble':
      placeBubbles(out, cx, rng, randInt(rng, 3, 5));
      break;
    case 'wide':
      placeGap(out, cx, rng, rand(rng, 320, 470), rand(rng, 150, 190));
      placeBubbles(out, cx, rng, 2);
      break;
    case 'narrow':
      placeGap(out, cx, rng, rand(rng, 300, 470), rand(rng, 60, 72));
      break;
    case 'jelly':
      placeJelly(out, cx, rng, randInt(rng, 2, 4));
      placeBubbles(out, cx, rng, 1);
      break;
    case 'current':
      placeCurrent(out, cx);
      placeBubbles(out, cx, rng, 2);
      break;
    case 'counter':
      placeCounter(out, cx);
      placeGap(out, cx, rng, rand(rng, 320, 470), rand(rng, 150, 190));
      placeBubbles(out, cx, rng, 2);
      break;
    case 'reef': {
      const top1 = rand(rng, 420, 520);
      const top2 = rand(rng, 420, 520);
      pushReef(out, cx - 150, top1, randInt(rng, 120, 170));
      pushReef(out, cx + 110, top2, randInt(rng, 120, 170));
      placeBubbles(out, cx, rng, 2);
      break;
    }
    case 'jump': {
      pushReef(out, cx - 180, 250, 200);
      pushReef(out, cx + 120, 250, 200);
      placeBubbles(out, cx, rng, 1);
      break;
    }
    case 'root': {
      const bot1 = rand(rng, 430, 520);
      const bot2 = rand(rng, 430, 520);
      pushRoot(out, cx - 150, bot1, randInt(rng, 60, 90));
      pushRoot(out, cx + 110, bot2, randInt(rng, 60, 90));
      placeBubbles(out, cx, rng, 2);
      break;
    }
    default:
      break;
  }
}

export function generateCourse(segmentIndex, rng) {
  const seg = segmentAt(segmentIndex);
  const out = { id: 1, obstacles: [], bubbles: [], currents: [], counterZones: [] };
  const n = Math.max(3, Math.round(seg.length / CHUNK_W));
  for (let i = 0; i < n; i += 1) {
    const cx = START_X + i * CHUNK_W + rand(rng, -60, 60);
    if (cx + 200 > seg.length) break;
    const type = seg.pattern[i % seg.pattern.length];
    placeChunk(type, cx, rng, out);
  }
  return out;
}
