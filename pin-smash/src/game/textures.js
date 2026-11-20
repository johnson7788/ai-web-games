// src/game/textures.js — Procedural canvas textures (zero asset files, sandbox-safe).
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Maple wood lane with grain, board seams, aiming arrows and dots.
export function makeLaneTexture() {
  const W = 512, H = 1024;
  const c = canvas(W, H); const g = c.getContext('2d');
  // base maple
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#d9b27c'); grad.addColorStop(0.5, '#e6c491'); grad.addColorStop(1, '#d3aa74');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // boards (vertical planks along lane length)
  const boards = 12; const bw = W / boards;
  for (let i = 0; i < boards; i++) {
    const x = i * bw;
    const shade = 0.9 + Math.random() * 0.16;
    g.fillStyle = `rgba(${Math.floor(190 * shade)},${Math.floor(150 * shade)},${Math.floor(100 * shade)},0.28)`;
    g.fillRect(x, 0, bw, H);
    // seam
    g.fillStyle = 'rgba(90,60,30,0.45)'; g.fillRect(x, 0, 1.5, H);
    // grain streaks
    for (let s = 0; s < 26; s++) {
      const gx = x + Math.random() * bw;
      g.strokeStyle = `rgba(120,85,45,${0.05 + Math.random() * 0.12})`;
      g.lineWidth = 0.6 + Math.random() * 1.2;
      g.beginPath();
      let gy = Math.random() * H;
      g.moveTo(gx, gy);
      for (let k = 0; k < 6; k++) { gy += 40 + Math.random() * 60; g.lineTo(gx + (Math.random() - 0.5) * 5, gy); }
      g.stroke();
    }
  }
  // aiming arrows (7) around v ~ 0.62 (toward foul line) — dark red triangles
  const ay = H * 0.60;
  g.fillStyle = 'rgba(120,30,30,0.85)';
  for (let i = 0; i < 7; i++) {
    const ax = W * (0.18 + i * 0.107);
    const off = Math.abs(i - 3) * 16;
    g.beginPath();
    g.moveTo(ax, ay + off); g.lineTo(ax - 8, ay + off + 26); g.lineTo(ax + 8, ay + off + 26);
    g.closePath(); g.fill();
  }
  // approach dots
  g.fillStyle = 'rgba(60,40,25,0.7)';
  for (let i = 0; i < 7; i++) { const ax = W * (0.18 + i * 0.107); g.beginPath(); g.arc(ax, H * 0.80, 4, 0, 7); g.fill(); }
  // foul line
  g.fillStyle = 'rgba(30,20,15,0.8)'; g.fillRect(0, H * 0.90, W, 5);
  return tex(c);
}

// Pin: white body with two red neck bands (v along lathe profile).
export function makePinTexture() {
  const W = 128, H = 256;
  const c = canvas(W, H); const g = c.getContext('2d');
  g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, W, H);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(180,175,165,0.5)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(180,175,165,0.5)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // red neck bands (canvas y is inverted vs UV v; neck near top of pin => small y)
  g.fillStyle = '#d32027';
  g.fillRect(0, H * 0.20, W, H * 0.055);
  g.fillRect(0, H * 0.285, W, H * 0.055);
  // tiny brand dot
  g.fillStyle = 'rgba(211,32,39,0.85)'; g.beginPath(); g.arc(W * 0.5, H * 0.5, 6, 0, 7); g.fill();
  return tex(c);
}

// Ball: marbled swirl + three finger holes.
export function makeBallTexture(base = '#5b2a86', swirl = '#9d4edd') {
  const S = 256;
  const c = canvas(S, S); const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  // marble swirls
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 2 ? swirl : 'rgba(255,255,255,0.10)';
    g.lineWidth = 1 + Math.random() * 4;
    g.globalAlpha = 0.15 + Math.random() * 0.3;
    g.beginPath();
    let x = Math.random() * S, y = Math.random() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 80; y += (Math.random() - 0.5) * 80; g.quadraticCurveTo(x + 20, y - 20, x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  // finger holes (clustered near top)
  const holes = [[S * 0.42, S * 0.20], [S * 0.56, S * 0.20], [S * 0.49, S * 0.32]];
  for (const [hx, hy] of holes) {
    const rg = g.createRadialGradient(hx, hy, 1, hx, hy, 11);
    rg.addColorStop(0, '#0a0a0f'); rg.addColorStop(0.7, '#15121f'); rg.addColorStop(1, 'rgba(20,18,31,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(hx, hy, 11, 0, 7); g.fill();
  }
  return tex(c);
}

// Neon back-wall sign.
export function makeSignTexture(text = 'PIN SMASH') {
  const W = 1024, H = 256;
  const c = canvas(W, H); const g = c.getContext('2d');
  g.fillStyle = '#0a0a14'; g.fillRect(0, 0, W, H);
  // border neon
  g.strokeStyle = '#ff2d95'; g.lineWidth = 6; g.shadowColor = '#ff2d95'; g.shadowBlur = 24;
  g.strokeRect(16, 16, W - 32, H - 32);
  g.font = 'bold 120px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#22d3ee'; g.shadowBlur = 36;
  g.fillStyle = '#e8fbff';
  g.fillText(text, W / 2, H / 2 + 6);
  g.shadowBlur = 0;
  return tex(c);
}

// Dark carpet / alley floor.
export function makeFloorTexture() {
  const S = 256;
  const c = canvas(S, S); const g = c.getContext('2d');
  g.fillStyle = '#12121c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 40},${30 + Math.random() * 30},${70 + Math.random() * 50},${0.15 + Math.random() * 0.25})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  // neon flecks
  for (let i = 0; i < 40; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,45,149,0.25)' : 'rgba(34,211,238,0.25)';
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  return tex(c, 8, 8);
}