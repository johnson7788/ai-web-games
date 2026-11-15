import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function rand(min, max) { return min + Math.random() * (max - min); }

/** Speckle a region with translucent noise dots. */
function speckle(ctx, x, y, w, h, count, alpha, dark = true) {
  for (let i = 0; i < count; i++) {
    const shade = dark ? rand(0, 60) : rand(160, 255);
    ctx.fillStyle = `rgba(${shade},${shade * 0.92},${shade * 0.8},${rand(0.02, alpha)})`;
    ctx.fillRect(x + Math.random() * w, y + Math.random() * h, rand(1, 3), rand(1, 3));
  }
}

/** Aged wooden floorboards. */
export function woodFloor() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const plankH = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    const base = 38 + rand(-10, 12);
    ctx.fillStyle = `rgb(${base + 18},${base + 6},${base - 6})`;
    ctx.fillRect(0, y, 512, plankH);
    // grain streaks
    for (let g = 0; g < 26; g++) {
      const gy = y + rand(2, plankH - 2);
      ctx.strokeStyle = `rgba(${base - 14},${base - 20},${base - 26},${rand(0.15, 0.45)})`;
      ctx.lineWidth = rand(0.5, 1.6);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, gy + rand(-2.5, 2.5));
      ctx.stroke();
    }
    // plank seams + stagger
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, y, 512, 2);
    const seamX = ((row * 197) % 512);
    ctx.fillRect(seamX, y, 2, plankH);
    // knots
    if (Math.random() < 0.7) {
      const kx = rand(30, 480), ky = y + rand(12, plankH - 12);
      const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, rand(4, 9));
      grad.addColorStop(0, 'rgba(15,9,5,0.9)');
      grad.addColorStop(1, 'rgba(15,9,5,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(kx - 10, ky - 10, 20, 20);
    }
    speckle(ctx, 0, y, 512, plankH, 220, 0.1);
  }
  // big dark stains
  for (let s = 0; s < 5; s++) {
    const sx = rand(0, 512), sy = rand(0, 512), r = rand(30, 90);
    const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
    grad.addColorStop(0, 'rgba(8,5,3,0.5)');
    grad.addColorStop(1, 'rgba(8,5,3,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  return toTexture(c);
}

/** Stained striped Victorian wallpaper. */
export function wallpaper() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a4234';
  ctx.fillRect(0, 0, 512, 512);
  // vertical stripes
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = 'rgba(62,52,38,1)';
    ctx.fillRect(x, 0, 32, 512);
    ctx.fillStyle = 'rgba(86,74,52,0.5)';
    ctx.fillRect(x + 34, 0, 4, 512);
  }
  // damask-ish motifs
  ctx.fillStyle = 'rgba(34,28,20,0.55)';
  for (let x = 16; x < 512; x += 64) {
    for (let y = 24; y < 512; y += 96) {
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + 48, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  speckle(ctx, 0, 0, 512, 512, 1400, 0.12);
  // water damage drips from top
  for (let d = 0; d < 9; d++) {
    const dx = rand(0, 512), dw = rand(8, 30), dh = rand(60, 280);
    const grad = ctx.createLinearGradient(0, 0, 0, dh);
    grad.addColorStop(0, 'rgba(18,13,8,0.55)');
    grad.addColorStop(1, 'rgba(18,13,8,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(dx, 0, dw, dh);
  }
  // mold patches near bottom
  for (let m = 0; m < 14; m++) {
    const mx = rand(0, 512), my = rand(380, 512), r = rand(8, 36);
    const grad = ctx.createRadialGradient(mx, my, 1, mx, my, r);
    grad.addColorStop(0, 'rgba(14,18,10,0.6)');
    grad.addColorStop(1, 'rgba(14,18,10,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(mx - r, my - r, r * 2, r * 2);
  }
  return toTexture(c);
}

/** Cracked plaster ceiling. */
export function plaster() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#56504a';
  ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 0, 0, 512, 512, 2600, 0.1);
  // cracks
  ctx.strokeStyle = 'rgba(20,16,12,0.7)';
  for (let k = 0; k < 7; k++) {
    let x = rand(0, 512), y = rand(0, 512);
    ctx.lineWidth = rand(0.6, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      x += rand(-40, 40); y += rand(-40, 40);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // stains
  for (let s = 0; s < 6; s++) {
    const sx = rand(0, 512), sy = rand(0, 512), r = rand(40, 110);
    const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, r);
    grad.addColorStop(0, 'rgba(40,30,16,0.4)');
    grad.addColorStop(1, 'rgba(40,30,16,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  return toTexture(c);
}

/** Dark old furniture wood. */
export function darkWood() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#241710';
  ctx.fillRect(0, 0, 256, 256);
  for (let g = 0; g < 60; g++) {
    const gy = rand(0, 256);
    ctx.strokeStyle = `rgba(${rand(10, 30)},${rand(6, 18)},${rand(3, 10)},${rand(0.2, 0.6)})`;
    ctx.lineWidth = rand(0.5, 2);
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= 256; x += 24) ctx.lineTo(x, gy + rand(-3, 3));
    ctx.stroke();
  }
  speckle(ctx, 0, 0, 256, 256, 500, 0.12);
  return toTexture(c);
}

/** Worn fabric for sofa / bed. */
export function fabric(baseR = 46, baseG = 38, baseB = 40) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = `rgba(0,0,0,${y % 6 === 0 ? 0.18 : 0.07})`;
    ctx.fillRect(0, y, 256, 1);
  }
  speckle(ctx, 0, 0, 256, 256, 900, 0.1);
  return toTexture(c);
}

/**
 * A pale gaunt face — reused for the entity, portraits, jumpscare.
 * variant 0: staring · 1: mouth torn wide open · 2: hollow black eyes
 */
export function drawFace(ctx, size, intensity = 1, variant = 0) {
  const cx = size / 2, cy = size / 2;
  const mouthScale = variant === 1 ? 2.1 : 1;
  const eyeScale = variant === 2 ? 1.7 : 1;
  const showPupils = variant !== 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  // head shape — elongated pale oval
  let grad = ctx.createRadialGradient(cx, cy * 0.92, size * 0.05, cx, cy, size * 0.42);
  grad.addColorStop(0, `rgba(${168 * intensity},${164 * intensity},${158 * intensity},1)`);
  grad.addColorStop(0.72, `rgba(${110 * intensity},${104 * intensity},${100 * intensity},1)`);
  grad.addColorStop(1, 'rgba(10,10,10,0)');
  ctx.fillStyle = grad;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.72, 1.0);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // sunken eye sockets
  for (const sx of [-1, 1]) {
    const ex = cx + sx * size * 0.115, ey = cy - size * 0.07;
    grad = ctx.createRadialGradient(ex, ey, 1, ex, ey, size * 0.085 * eyeScale);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.65, 'rgba(5,4,4,0.95)');
    grad.addColorStop(1, 'rgba(5,4,4,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(ex, ey, size * 0.075 * eyeScale, size * 0.095 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fill();
    if (showPupils) {
      // pinprick glowing pupils
      ctx.fillStyle = 'rgba(220,228,235,0.95)';
      ctx.beginPath();
      ctx.arc(ex, ey + size * 0.012, size * 0.011, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // long dark nose shadow
  grad = ctx.createLinearGradient(cx, cy - size * 0.02, cx, cy + size * 0.12);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - size * 0.022, cy - size * 0.02, size * 0.044, size * 0.14);
  // gaping vertical mouth
  grad = ctx.createRadialGradient(cx, cy + size * 0.21, 2, cx, cy + size * 0.21, size * 0.11 * mouthScale);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.8, 'rgba(8,4,4,0.92)');
  grad.addColorStop(1, 'rgba(8,4,4,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.21, size * 0.052 * mouthScale, size * 0.105 * mouthScale, 0, 0, Math.PI * 2);
  ctx.fill();
  if (variant === 1) {
    // strained jaw shadow lines around the torn mouth
    ctx.strokeStyle = 'rgba(20,12,10,0.7)';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.28;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * size * 0.06, cy + size * 0.21 + Math.sin(a) * size * 0.1);
      ctx.lineTo(cx + Math.cos(a) * size * 0.13, cy + size * 0.21 + Math.sin(a) * size * 0.22);
      ctx.stroke();
    }
  }
  // grime streaks down the face
  ctx.strokeStyle = 'rgba(30,26,24,0.35)';
  for (let i = 0; i < 24; i++) {
    const x = cx + rand(-size * 0.26, size * 0.26);
    ctx.lineWidth = rand(0.5, 2);
    ctx.beginPath();
    ctx.moveTo(x, cy - size * 0.3);
    ctx.lineTo(x + rand(-8, 8), cy + rand(size * 0.1, size * 0.34));
    ctx.stroke();
  }
}

export function ghostFaceTexture(variant = 0) {
  const c = makeCanvas(512, 512);
  drawFace(c.getContext('2d'), 512, 1, variant);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ghostFaceDataURL() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  drawFace(ctx, 512, 1.15, 1); // mouth torn wide for the kill screen
  // extra noise for the fullscreen jumpscare
  speckle(ctx, 0, 0, 512, 512, 2200, 0.25, false);
  return c.toDataURL();
}

/** Dusty cobweb on a transparent plane. */
export function cobweb() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(190,188,180,0.55)';
  const cx = 12, cy = 12; // anchored in a corner
  // radial threads
  const spokes = [];
  for (let i = 0; i <= 7; i++) {
    const a = (i / 7) * (Math.PI / 2);
    spokes.push(a);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 240, cy + Math.sin(a) * 240);
    ctx.stroke();
  }
  // sagging connecting arcs
  for (let r = 30; r < 240; r += 24 + Math.random() * 14) {
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < spokes.length - 1; i++) {
      const a0 = spokes[i], a1 = spokes[i + 1];
      const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      const mx = (x0 + x1) / 2 + Math.cos((a0 + a1) / 2) * 8;
      const my = (y0 + y1) / 2 + Math.sin((a0 + a1) / 2) * 8;
      if (i === 0) ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(mx, my, x1, y1);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial falloff cookie so the flashlight beam has soft texture, not a hard disc. */
export function flashlightCookie() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(235,235,235,0.95)');
  grad.addColorStop(0.75, 'rgba(140,140,140,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  // faint lens rings + dirt
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  for (const r of [54, 88, 112]) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.arc(rand(30, 226), rand(30, 226), rand(2, 7), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/** Old portrait painting — dim hooded figure. */
export function portrait() {
  const c = makeCanvas(256, 320);
  const ctx = c.getContext('2d');
  let grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#241c12');
  grad.addColorStop(1, '#0d0a06');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 320);
  // shoulders
  ctx.fillStyle = '#0a0805';
  ctx.beginPath();
  ctx.ellipse(128, 320, 120, 110, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // dim face
  ctx.save();
  ctx.translate(128, 150);
  ctx.scale(0.42, 0.42);
  ctx.translate(-128, -128);
  drawFace(ctx, 256, 0.45);
  ctx.restore();
  // dark hood over face
  ctx.fillStyle = 'rgba(5,4,3,0.55)';
  ctx.beginPath();
  ctx.ellipse(128, 110, 70, 64, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // varnish cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  for (let k = 0; k < 16; k++) {
    let x = rand(0, 256), y = rand(0, 320);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += rand(-25, 25); y += rand(-25, 25); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Old paper note texture (for 3D note meshes). */
export function paper() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9bda2';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 0, 0, 128, 128, 250, 0.12);
  ctx.strokeStyle = 'rgba(60,48,30,0.5)';
  for (let y = 24; y < 120; y += 12) {
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(114, y + rand(-1, 1));
    ctx.stroke();
  }
  return toTexture(c);
}

/** Film grain tile for the CSS overlay. */
export function grainDataURL() {
  const c = makeCanvas(160, 160);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}
