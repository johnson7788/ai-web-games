// Marble Dash — procedural canvas textures (original, zero external assets)
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Soft radial glow sprite (additive halos for gems / goal / ball highlight)
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Vertical dusk-sky gradient used as scene background
export function skyTexture() {
  const c = canvas(4, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#05030f');
  grad.addColorStop(0.35, '#140b33');
  grad.addColorStop(0.62, '#2b1552');
  grad.addColorStop(0.80, '#4b1e5e');
  grad.addColorStop(0.92, '#8a2f57');
  grad.addColorStop(1.0, '#c65a4e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Dark slate track top with faint tech grid
export function trackTopTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#171a33';
  g.fillRect(0, 0, 256, 256);
  // speckle
  for (let i = 0; i < 420; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 60 | 0},${130 + Math.random() * 60 | 0},${190 + Math.random() * 60 | 0},${0.03 + Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(110,130,220,0.16)';
  g.lineWidth = 1;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(256, i + 0.5); g.stroke();
  }
  g.strokeStyle = 'rgba(140,160,255,0.10)';
  for (let i = 32; i < 256; i += 64) {
    g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(256, i + 0.5); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Chevron arrows (boost strips / ramp slope / mover direction)
export function chevronTexture(color = '#ffd75e', bg = 'rgba(20,16,44,0.92)') {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = color;
  g.lineWidth = 9;
  g.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    const y = 40 + k * 52;
    g.beginPath();
    g.moveTo(24, y + 22); g.lineTo(64, y - 10); g.lineTo(104, y + 22);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Hazard stripes for sweeper arms
export function hazardTexture() {
  const c = canvas(128, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#241a33';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#ff9f43';
  for (let x = -64; x < 160; x += 32) {
    g.beginPath();
    g.moveTo(x, 64); g.lineTo(x + 16, 0); g.lineTo(x + 30, 0); g.lineTo(x + 14, 64);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Ring marker (checkpoint / goal apron)
export function ringTexture(color = '#5eead4') {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = color;
  g.lineWidth = 7;
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}