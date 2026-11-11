const cache = new Map();
let totalGenerationMs = 0;

function ellipse(ctx, x, y, rx, ry, color, rotation = 0, stroke = null, lineWidth = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function eye(ctx, x, y, ink, scale = 1) {
  ellipse(ctx, x, y, 11 * scale, 14 * scale, '#FFFFFF', 0, ink, 2.5);
  ellipse(ctx, x + 1, y + 2, 5.2 * scale, 7 * scale, ink);
  ellipse(ctx, x - 1.5 * scale, y - 2.5 * scale, 2.3 * scale, 3 * scale, '#FFFFFF');
}

function pointyEars(ctx, character, ink) {
  const { fur, fur2 } = character.colors;
  const tall = character.id === 'fox';
  for (const side of [-1, 1]) {
    const x = 64 + side * 30;
    ctx.beginPath();
    ctx.moveTo(x - side * 17, 48);
    ctx.lineTo(x - side * 7, tall ? 5 : 12);
    ctx.quadraticCurveTo(x - side * 4, tall ? 0 : 6, x + side * 3, tall ? 9 : 16);
    ctx.lineTo(x + side * 15, 45);
    ctx.closePath();
    ctx.fillStyle = fur;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - side * 7, 37);
    ctx.lineTo(x - side * 3, tall ? 14 : 21);
    ctx.lineTo(x + side * 6, 38);
    ctx.closePath();
    ctx.fillStyle = fur2;
    ctx.fill();
  }
}

function drawEars(ctx, character, ink) {
  const { fur, fur2 } = character.colors;
  if (character.build.ear === 'pointy') {
    pointyEars(ctx, character, ink);
  } else if (character.build.ear === 'round') {
    const panda = character.id === 'panda';
    for (const x of [34, 94]) {
      ellipse(ctx, x, 36, 17, 17, panda ? fur2 : fur, 0, ink, 4);
      if (!panda) ellipse(ctx, x, 36, 9, 9, fur2);
    }
  } else if (character.build.ear === 'floppy') {
    for (const side of [-1, 1]) {
      const x = 64 + side * 23;
      ellipse(ctx, x, 28, 13, 27, fur, side * 0.12, ink, 4);
      ellipse(ctx, x, 28, 6, 20, fur2, side * 0.12);
    }
  } else {
    for (const x of [43, 85]) ellipse(ctx, x, 39, 8, 7, fur2, 0, ink, 3);
  }
}

function drawMuzzle(ctx, character, ink) {
  const { id, colors } = character;
  if (id === 'duck') {
    ellipse(ctx, 64, 84, 27, 12, colors.beak ?? colors.nose, 0, ink, 2.5);
    ctx.beginPath();
    ctx.moveTo(40, 85);
    ctx.quadraticCurveTo(64, 90, 88, 85);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  if (id === 'frog') {
    ellipse(ctx, 58, 62, 2.2, 2.8, colors.nose);
    ellipse(ctx, 70, 62, 2.2, 2.8, colors.nose);
    ctx.beginPath();
    ctx.arc(64, 70, 20, Math.PI * 0.12, Math.PI * 0.88);
    ctx.strokeStyle = colors.nose;
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }
  if (id === 'fox') {
    ctx.beginPath();
    ctx.moveTo(39, 80);
    ctx.quadraticCurveTo(64, 69, 89, 80);
    ctx.quadraticCurveTo(82, 103, 64, 108);
    ctx.quadraticCurveTo(46, 103, 39, 80);
    ctx.fillStyle = colors.fur2;
    ctx.fill();
  } else {
    ellipse(ctx, 64, 86, 25, 18, id === 'panda' ? colors.belly : colors.fur2);
  }
  ellipse(ctx, 64, 80, 7, 5.5, colors.nose);
  ctx.beginPath();
  ctx.moveTo(64, 85);
  ctx.lineTo(64, 89);
  ctx.quadraticCurveTo(59, 95, 54, 91);
  ctx.moveTo(64, 89);
  ctx.quadraticCurveTo(69, 95, 74, 91);
  ctx.strokeStyle = colors.nose;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawPortrait(character) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(2, 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ink = '#2B2440';
  const { id, colors } = character;
  drawEars(ctx, character, ink);

  const top = id === 'rabbit' ? 41 : id === 'frog' ? 43 : id === 'duck' ? 34 : 31;
  const height = id === 'rabbit' || id === 'frog' ? 69 : 79;
  ctx.beginPath();
  ctx.roundRect(20, top, 88, height, id === 'frog' ? 27 : 32);
  ctx.fillStyle = colors.fur;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.stroke();

  if (id === 'panda') {
    for (const side of [-1, 1]) ellipse(ctx, 64 + side * 22, 63, 17, 21, colors.fur2, side * 0.22);
  }
  if (id === 'cat') {
    ctx.strokeStyle = colors.fur2;
    ctx.lineWidth = 5;
    for (const [x, y] of [[51, 43], [64, 39], [77, 43]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 12);
      ctx.stroke();
    }
  }
  if (id === 'frog') {
    for (const x of [42, 86]) ellipse(ctx, x, 39, 17, 16, colors.fur, 0, ink, 3);
    eye(ctx, 42, 37, ink, 0.9);
    eye(ctx, 86, 37, ink, 0.9);
  } else {
    const eyeY = id === 'rabbit' ? 69 : 63;
    eye(ctx, 43, eyeY, ink, id === 'panda' ? 0.82 : 1);
    eye(ctx, 85, eyeY, ink, id === 'panda' ? 0.82 : 1);
  }

  ctx.save();
  ctx.globalAlpha = 0.5;
  const cheekY = id === 'frog' ? 69 : id === 'duck' ? 72 : 84;
  ellipse(ctx, 34, cheekY, 9, 6, colors.cheek);
  ellipse(ctx, 94, cheekY, 9, 6, colors.cheek);
  ctx.restore();
  drawMuzzle(ctx, character, ink);
  return canvas.toDataURL('image/webp', 1);
}

export function getPortrait(character) {
  if (cache.has(character.id)) return cache.get(character.id);
  const started = performance.now();
  const portrait = drawPortrait(character);
  totalGenerationMs += performance.now() - started;
  cache.set(character.id, portrait);
  return portrait;
}

export function prewarmPortraits(characters) {
  for (const character of characters) getPortrait(character);
  return getPortraitMetrics();
}

export function getPortraitMetrics() {
  return { count: cache.size, totalMs: totalGenerationMs, averageMs: cache.size ? totalGenerationMs / cache.size : 0 };
}
