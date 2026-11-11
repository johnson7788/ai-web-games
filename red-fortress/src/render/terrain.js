import { WORLD } from '../../config/game.config.js';
import { SHARED } from '../../config/palette.js';

export function hash(x, y, seed = 0) {
  let h = Math.imul((x | 0) + 374761393, 668265263) ^ Math.imul((y | 0) + 1442695041, 2246822519) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function roadCenter(ty, seed) {
  return 9.5 + Math.sin(ty * 0.21 + seed * 0.001) * 1.35;
}

function drawGroundTile(ctx, pal, theme, tx, ty, px, py, size, seed, value) {
  const n = hash(tx, ty, seed);
  const onRoad = Math.abs(tx - roadCenter(ty, seed)) < (theme === 'fortress' ? 3.8 : 3.1);
  let color = n > 0.52 ? pal.groundAlt : pal.ground;
  if (onRoad) color = n > 0.55 ? pal.roadAlt : pal.road;
  if (value === 2) color = pal.water;
  if (theme === 'river' && (tx < 3 || tx > 16) && value === 0) color = pal.water;
  if (theme === 'river' && ty % 19 >= 4 && ty % 19 <= 7 && value === 0 && !onRoad) color = pal.water;
  rect(ctx, color, px, py, size + 1, size + 1);

  if (color === pal.water) {
    const phase = ((tx + ty + Math.floor(seed % 5)) & 3) * 8;
    rect(ctx, pal.waterAlt, px + 5 + phase, py + 14, 22, 3);
    rect(ctx, pal.waterAlt, px + 30 - phase * 0.5, py + 43, 25, 2);
    if (theme === 'river' && onRoad) {
      rect(ctx, pal.road, px, py, size, size);
      rect(ctx, pal.roadAlt, px + 4, py + 5, size - 8, 8);
      rect(ctx, pal.prop, px + 8, py + 48, size - 16, 5);
    }
    return;
  }

  if (theme === 'fortress') {
    rect(ctx, pal.deep, px, py, size, 2);
    rect(ctx, pal.ground2, px + 3, py + 4, 3, size - 7);
    if ((tx + ty) % 3 === 0) rect(ctx, pal.rockAlt, px + 46, py + 45, 4, 4);
  } else if (theme === 'desert') {
    rect(ctx, pal.ground2, px + 7 + n * 24, py + 17, 28, 2);
    if (n > 0.72) rect(ctx, pal.rockAlt, px + 42, py + 39, 7, 5);
  } else if (theme === 'jungle') {
    if (onRoad && n > 0.68) {
      rect(ctx, pal.water, px + 12, py + 33, 29, 9);
      rect(ctx, pal.waterAlt, px + 17, py + 34, 17, 2);
    } else if (!onRoad && n > 0.55) {
      rect(ctx, pal.ground2, px + 9, py + 12, 6, 20);
      rect(ctx, pal.ground2, px + 20, py + 25, 18, 5);
    }
  } else if (theme === 'river') {
    rect(ctx, n > 0.5 ? pal.rock : pal.ground2, px + 8, py + 11, 3, 39);
    if (n > 0.7) rect(ctx, pal.waterAlt, px + 30, py + 42, 22, 4);
  }
}

function drawRock(ctx, pal, theme, px, py, size, n) {
  rect(ctx, pal.deep, px + 3, py + 9, size, size - 5);
  rect(ctx, pal.rock, px, py + 4, size - 4, size - 8);
  rect(ctx, pal.rockAlt, px + 5, py + 8, size - 14, 10);
  rect(ctx, pal.ground2, px + 10, py + 25, size - 24, 6);
  if (theme === 'fortress') {
    rect(ctx, pal.deep, px + 4, py + 35, size - 12, 4);
    rect(ctx, pal.accent, px + 10 + n * 25, py + 47, 7, 5);
  } else if (theme === 'jungle') {
    rect(ctx, pal.ground2, px + 4, py + 3, 18, 13);
    rect(ctx, pal.groundAlt, px + 33, py + 14, 25, 9);
  }
}

function drawSandbags(ctx, pal, px, py, size, hp) {
  rect(ctx, pal.deep, px + 3, py + 18, size - 2, 35);
  for (let i = 0; i < 4; i += 1) {
    const bx = px + 4 + (i % 2) * 29 + (i > 1 ? 8 : 0);
    const by = py + 12 + Math.floor(i / 2) * 21;
    rect(ctx, hp > 1 ? pal.sandbagAlt : pal.sandbag, bx, by, 27, 15);
    rect(ctx, pal.sandbag, bx + 4, by + 10, 19, 3);
  }
}

function drawTree(ctx, pal, x, y, n) {
  rect(ctx, pal.deep, x - 15, y + 13, 38, 12);
  rect(ctx, pal.prop, x - 3, y + 4, 7, 18);
  rect(ctx, pal.ground2, x - 22, y - 13, 43, 23);
  rect(ctx, n > 0.5 ? pal.groundAlt : pal.ground, x - 13, y - 24, 35, 24);
  rect(ctx, pal.ground2, x - 6, y - 20, 13, 7);
}

function drawFern(ctx, pal, x, y) {
  rect(ctx, pal.ground2, x - 2, y - 8, 4, 17);
  rect(ctx, pal.accent2, x - 12, y - 6, 10, 3);
  rect(ctx, pal.ground2, x + 2, y - 11, 12, 3);
  rect(ctx, pal.ground2, x - 9, y + 1, 8, 3);
}

function drawBarrel(ctx, pal, x, y) {
  rect(ctx, pal.deep, x - 8, y - 10, 18, 24);
  rect(ctx, pal.prop, x - 7, y - 12, 14, 22);
  rect(ctx, pal.propAlt, x - 5, y - 8, 3, 13);
  rect(ctx, pal.deep, x - 7, y - 3, 14, 3);
}

function drawBush(ctx, pal, x, y, n) {
  rect(ctx, pal.prop, x - 2, y - 8, 4, 17);
  rect(ctx, pal.propAlt, x - 12, y - 5, 12, 3);
  rect(ctx, pal.prop, x + 1, y - 12 - n * 5, 13, 3);
  rect(ctx, pal.deep, x - 9, y + 6, 20, 3);
}

function drawFortressProp(ctx, pal, tx, ty, px, py) {
  if (tx === 2 || tx === 17) {
    rect(ctx, pal.deep, px + 20, py, 7, 64);
    rect(ctx, pal.rockAlt, px + 22, py, 3, 64);
    rect(ctx, pal.prop, px + 4, py + 11, 52, 5);
    rect(ctx, pal.prop, px + 4, py + 43, 52, 5);
  }
  if ((ty + tx * 3) % 11 === 0) {
    rect(ctx, pal.deep, px + 44, py + 7, 8, 24);
    rect(ctx, pal.accent, px + 45, py + 8, 6, 6);
  }
}

function drawDecor(ctx, pal, theme, tx, ty, px, py, seed, quality) {
  const n = hash(tx * 3 + 7, ty * 5 + 11, seed);
  const onRoad = Math.abs(tx - roadCenter(ty, seed)) < 3.4;
  if (theme === 'jungle') {
    if (!onRoad && n > (quality === 'high' ? 0.74 : 0.9)) drawTree(ctx, pal, px + 30, py + 37, n);
    else if (!onRoad && n > 0.48) drawFern(ctx, pal, px + 24 + n * 17, py + 35);
  } else if (theme === 'river') {
    if (n > 0.86 && onRoad) drawBarrel(ctx, pal, px + 33, py + 35);
    if (quality === 'high' && n > 0.55 && !onRoad) {
      rect(ctx, pal.accent2, px + 8, py + 20, 24, 2);
      rect(ctx, pal.waterAlt, px + 16, py + 25, 31, 2);
    }
  } else if (theme === 'desert') {
    if (!onRoad && n > (quality === 'high' ? 0.79 : 0.92)) drawBush(ctx, pal, px + 31, py + 37, n);
    if (quality === 'high' && n > 0.57) {
      rect(ctx, pal.propAlt, px + 12, py + 49, 10, 3);
      rect(ctx, pal.rock, px + 43, py + 19, 8, 6);
    }
  } else if (theme === 'fortress') {
    drawFortressProp(ctx, pal, tx, ty, px, py);
  }
}

function drawHelipad(ctx, pal, z) {
  ctx.save();
  ctx.globalAlpha = 0.42;
  rect(ctx, pal.deep, z.x, z.y, z.w, z.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = pal.glow;
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 10]);
  ctx.strokeRect(z.x + 8, z.y + 8, z.w - 16, z.h - 16);
  ctx.setLineDash([]);
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2;
  rect(ctx, pal.glow, cx - 35, cy - 35, 7, 70);
  rect(ctx, pal.glow, cx + 28, cy - 35, 7, 70);
  rect(ctx, pal.glow, cx - 30, cy - 4, 60, 8);
  ctx.restore();
}

function drawCamp(ctx, pal, z) {
  ctx.save();
  ctx.globalAlpha = 0.32;
  rect(ctx, SHARED.powDark, z.x, z.y, z.w, z.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = SHARED.pow;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 12]);
  ctx.strokeRect(z.x + 6, z.y + 6, z.w - 12, z.h - 12);
  ctx.setLineDash([]);
  for (const side of [-1, 1]) {
    const x = z.x + (side < 0 ? 30 : z.w - 100);
    const y = z.y + 25;
    rect(ctx, pal.deep, x - 5, y + 9, 80, 60);
    rect(ctx, pal.prop, x, y + 15, 70, 48);
    ctx.fillStyle = pal.propAlt;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 18);
    ctx.lineTo(x + 34, y - 8);
    ctx.lineTo(x + 79, y + 18);
    ctx.closePath();
    ctx.fill();
    rect(ctx, pal.deep, x + 27, y + 35, 17, 28);
  }
  rect(ctx, SHARED.pow, z.x + z.w / 2 - 3, z.y + 18, 6, 45);
  rect(ctx, SHARED.pow, z.x + z.w / 2 + 3, z.y + 18, 30, 18);
  ctx.restore();
}

export function drawTerrain(ctx, run, pal, theme, t, quality, camY) {
  const map = run.map;
  const size = map.tile || WORLD.TILE;
  const seed = map.seed || run.seed || 1;
  const y0 = Math.max(0, Math.floor(camY / size) - 1);
  const y1 = Math.min(map.rows - 1, Math.ceil((camY + WORLD.H) / size) + 1);
  const tick = Math.floor(t * 8);

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = 0; tx < map.cols; tx += 1) {
      const index = ty * map.cols + tx;
      const value = map.solid[index] || 0;
      const px = tx * size;
      const py = ty * size;
      drawGroundTile(ctx, pal, theme, tx, ty, px, py, size, seed, value);
      if (value === 1) drawRock(ctx, pal, theme, px, py, size, hash(tx, ty, seed));
      else if (value === 3) drawSandbags(ctx, pal, px, py, size, map.sand[index] || 1);
      else if (value !== 2) drawDecor(ctx, pal, theme, tx, ty, px, py, seed, quality);

      if (value === 2 || (theme === 'river' && (tx < 3 || tx > 16))) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        const drift = (tick + tx * 7 + ty * 3) % 28;
        rect(ctx, pal.accent, px + drift, py + 29, 18, 2);
        ctx.restore();
      }
    }
  }

  if (theme === 'fortress') {
    for (const x of [150, 1118]) {
      rect(ctx, pal.deep, x, y0 * size, 8, (y1 - y0 + 1) * size);
      rect(ctx, pal.rockAlt, x + 2, y0 * size, 3, (y1 - y0 + 1) * size);
      for (let ty = y0; ty <= y1; ty += 1) rect(ctx, pal.prop, x - 14, ty * size + 27, 36, 6);
    }
  }

  for (const z of run.zones || []) {
    if (z.y + z.h < camY - size || z.y > camY + WORLD.H + size) continue;
    if (z.type === 'helipad') drawHelipad(ctx, pal, z);
    else if (z.type === 'camp') drawCamp(ctx, pal, z);
    else if (z.type === 'boss') {
      ctx.save();
      ctx.globalAlpha = 0.35;
      rect(ctx, pal.accent, z.x, z.y, z.w, 8);
      ctx.restore();
    }
  }
}

export function drawAtmosphere(ctx, pal, theme, t, quality, reduced) {
  const tick = reduced ? 0 : Math.floor(t * 8);
  const count = quality === 'high' ? 34 : 14;
  ctx.save();
  if (theme === 'jungle' || theme === 'river') {
    ctx.strokeStyle = theme === 'river' ? pal.accent : pal.accent2;
    ctx.globalAlpha = theme === 'river' ? 0.13 : 0.1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      const x = (hash(i, 9, 17) * WORLD.W + tick * (theme === 'river' ? 3 : 6)) % WORLD.W;
      const y = (hash(i, 13, 29) * WORLD.H + tick * 11) % WORLD.H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 15);
    }
    ctx.stroke();
  } else if (theme === 'desert') {
    ctx.fillStyle = pal.accent2;
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < count; i += 1) {
      const x = (hash(i, 4, 71) * WORLD.W + tick * 13) % WORLD.W;
      const y = hash(i, 8, 37) * WORLD.H;
      ctx.fillRect(x, y, 18 + (i % 4) * 7, 2);
    }
    ctx.globalAlpha = 0.06;
    for (let y = 90; y < WORLD.H; y += 96) ctx.fillRect(0, y + Math.sin(tick * 0.2 + y) * 4, WORLD.W, 3);
  } else if (theme === 'fortress') {
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < count; i += 1) {
      const x = (hash(i, 3, 97) * WORLD.W + tick * (2 + i % 3)) % WORLD.W;
      const y = (hash(i, 5, 101) * WORLD.H - tick * 5 + WORLD.H * 20) % WORLD.H;
      ctx.fillRect(x, y, 3, 6);
    }
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = pal.glow;
    const sweep = reduced ? 0 : Math.sin(t * 0.45) * 260;
    ctx.beginPath();
    ctx.moveTo(120, 0);
    ctx.lineTo(520 + sweep, WORLD.H);
    ctx.lineTo(780 + sweep, WORLD.H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawTitleBackground(ctx, pal, t, reduced) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.H);
  sky.addColorStop(0, pal.deep);
  sky.addColorStop(0.58, pal.groundAlt);
  sky.addColorStop(1, pal.road);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = pal.accent2;
  const drift = reduced ? 0 : Math.floor(t * 5) % 160;
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect(-180 + i * 270 + drift, 100 + (i % 3) * 55, 240, 22);
    ctx.fillRect(-130 + i * 270 + drift, 85 + (i % 3) * 55, 130, 16);
  }
  ctx.restore();

  ctx.fillStyle = pal.deep;
  ctx.beginPath();
  ctx.moveTo(0, 410);
  ctx.lineTo(160, 325);
  ctx.lineTo(310, 390);
  ctx.lineTo(480, 300);
  ctx.lineTo(660, 390);
  ctx.lineTo(860, 285);
  ctx.lineTo(1080, 380);
  ctx.lineTo(1280, 310);
  ctx.lineTo(1280, 720);
  ctx.lineTo(0, 720);
  ctx.closePath();
  ctx.fill();

  rect(ctx, pal.ambient, 690, 195, 430, 260);
  rect(ctx, pal.deep, 730, 145, 82, 120);
  rect(ctx, pal.deep, 998, 125, 82, 140);
  rect(ctx, pal.rock, 680, 235, 450, 24);
  for (let x = 710; x < 1110; x += 52) rect(ctx, pal.deep, x, 182, 25, 55);
  for (const x of [770, 1040]) {
    ctx.save();
    ctx.globalAlpha = 0.65 + Math.sin(t * 2 + x) * 0.15;
    rect(ctx, pal.accent, x - 5, 164, 10, 9);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = pal.glow;
  const sweep = reduced ? 0 : Math.sin(t * 0.35) * 170;
  ctx.beginPath();
  ctx.moveTo(775, 170);
  ctx.lineTo(300 + sweep, 650);
  ctx.lineTo(480 + sweep, 650);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1040, 150);
  ctx.lineTo(920 - sweep, 650);
  ctx.lineTo(1110 - sweep, 650);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < 4; i += 1) {
    const x = 160 + i * 310;
    const rise = reduced ? 0 : (t * 12 + i * 37) % 100;
    ctx.save();
    ctx.globalAlpha = 0.25 - rise * 0.0015;
    ctx.fillStyle = SHARED.smoke;
    ctx.fillRect(x - 20, 280 - rise, 60 + rise * 0.35, 90);
    ctx.fillRect(x + 5, 230 - rise, 75 + rise * 0.25, 65);
    ctx.restore();
  }

  rect(ctx, pal.roadAlt, 0, 540, WORLD.W, 180);
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (let x = -40; x < WORLD.W; x += 90) rect(ctx, pal.deep, x, 590 + (x % 3) * 14, 60, 5);
  ctx.restore();

  ctx.save();
  ctx.translate(920, 565);
  ctx.scale(2.4, 2.4);
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = SHARED.black;
  ctx.beginPath();
  ctx.moveTo(-44, 17);
  ctx.lineTo(-36, -14);
  ctx.lineTo(9, -19);
  ctx.lineTo(37, -7);
  ctx.lineTo(45, 17);
  ctx.closePath();
  ctx.fill();
  rect(ctx, SHARED.black, -30, -27, 12, 54);
  rect(ctx, SHARED.black, 20, -27, 12, 54);
  rect(ctx, SHARED.black, -4, -25, 10, 31);
  rect(ctx, SHARED.black, 0, -29, 55, 6);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = SHARED.glass;
  ctx.beginPath();
  ctx.moveTo(34, -10);
  ctx.lineTo(180, -55);
  ctx.lineTo(180, 42);
  ctx.lineTo(34, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
